import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { load } from "cheerio";
import {
  COUNTY_SEED_HEADERS,
  COUNTY_SEED_SOURCE_SHEET,
  type CountySeedHeader,
  type CountySeedWorkbook,
  type DateInformation,
  type NormalizedCountySeed,
  type RawSeedRow,
} from "./types.ts";

type ZipEntry = {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
};

function sha256(value: Uint8Array | string) {
  return createHash("sha256").update(value).digest("hex");
}

function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).normalize("NFKC").replace(/\s+/g, " ").trim();
  return normalized || null;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function findEndOfCentralDirectory(buffer: Buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("The workbook is not a supported ZIP-based XLSX file.");
}

function readZipDirectory(buffer: Buffer) {
  const entries = new Map<string, ZipEntry>();
  const endOffset = findEndOfCentralDirectory(buffer);
  const totalEntries = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);

  for (let index = 0; index < totalEntries; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("The workbook ZIP directory is malformed.");
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8");
    entries.set(name.replaceAll("\\", "/"), { compressionMethod, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function extractZipEntry(buffer: Buffer, entries: Map<string, ZipEntry>, name: string) {
  const entry = entries.get(name);
  if (!entry) throw new Error(`Workbook entry ${name} was not found.`);
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) throw new Error(`Workbook entry ${name} has an invalid local header.`);
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(dataOffset, dataOffset + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return inflateRawSync(compressed);
  throw new Error(`Workbook entry ${name} uses unsupported ZIP compression ${entry.compressionMethod}.`);
}

function parseSharedStrings(xml: Buffer | null) {
  if (!xml) return [];
  const $ = load(xml.toString("utf8"), { xmlMode: true });
  return $("*")
    .filter((_, node) => (node as { name?: string }).name?.split(":").pop() === "si")
    .map((_, node) => $(node).find("*")
      .filter((__, child) => (child as { name?: string }).name?.split(":").pop() === "t")
      .map((__, child) => $(child).text())
      .get()
      .join(""))
    .get();
}

function resolveSourceSheetPath(buffer: Buffer, entries: Map<string, ZipEntry>) {
  const workbookXml = extractZipEntry(buffer, entries, "xl/workbook.xml");
  const relationshipsXml = extractZipEntry(buffer, entries, "xl/_rels/workbook.xml.rels");
  const workbook = load(workbookXml.toString("utf8"), { xmlMode: true });
  const relationships = load(relationshipsXml.toString("utf8"), { xmlMode: true });
  const sheet = workbook("*")
    .filter((_, node) => (
      (node as { name?: string }).name?.split(":").pop() === "sheet"
      && workbook(node).attr("name") === COUNTY_SEED_SOURCE_SHEET
    ))
    .first();
  if (!sheet.length) throw new Error(`Required workbook sheet ${COUNTY_SEED_SOURCE_SHEET} was not found.`);
  const relationshipId = sheet.attr("r:id");
  const relationship = relationships("*")
    .filter((_, node) => (
      (node as { name?: string }).name?.split(":").pop() === "Relationship"
      && relationships(node).attr("Id") === relationshipId
    ))
    .first();
  const target = relationship.attr("Target");
  if (!target) throw new Error(`Workbook relationship for ${COUNTY_SEED_SOURCE_SHEET} is missing.`);
  const normalized = target.replace(/^\/+/, "").replaceAll("\\", "/");
  return normalized.startsWith("xl/") ? normalized : `xl/${normalized}`;
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0]?.toUpperCase();
  if (!letters) throw new Error(`Invalid workbook cell reference ${reference}.`);
  return [...letters].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseWorksheet(xml: Buffer, sharedStrings: string[]) {
  const $ = load(xml.toString("utf8"), { xmlMode: true });
  const rows: Array<Array<string | number | boolean | null>> = [];
  $("*").filter((_, node) => (node as { name?: string }).name?.split(":").pop() === "row").each((_, rowNode) => {
    const rowNumber = Number($(rowNode).attr("r"));
    const values: Array<string | number | boolean | null> = [];
    $(rowNode).children().filter((__, node) => (node as { name?: string }).name?.split(":").pop() === "c").each((__, cellNode) => {
      const cell = $(cellNode);
      const reference = cell.attr("r") ?? "";
      const type = cell.attr("t");
      const rawValue = cell.children()
        .filter((___, node) => (node as { name?: string }).name?.split(":").pop() === "v")
        .first()
        .text();
      let value: string | number | boolean | null = null;
      if (type === "s") value = sharedStrings[Number(rawValue)] ?? "";
      else if (type === "inlineStr") value = cell.find("*")
        .filter((___, node) => (node as { name?: string }).name?.split(":").pop() === "t")
        .map((___, node) => $(node).text())
        .get()
        .join("");
      else if (type === "b") value = rawValue === "1";
      else if (type === "str") value = rawValue;
      else if (rawValue !== "") value = Number.isFinite(Number(rawValue)) ? Number(rawValue) : rawValue;
      values[columnIndex(reference)] = value;
    });
    rows[rowNumber - 1] = values;
  });
  return rows;
}

export function normalizeName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function slugifySeed(name: string, municipality: string) {
  return `${name}-${municipality}-MI`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export function normalizeCounty(value: string) {
  return value.replace(/\s+County$/i, "").replace(/\s+/g, " ").trim();
}

export function normalizeMunicipality(value: string) {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function normalizeOfficialUrl(value: string | null) {
  if (!value) return { original: null, normalized: null, identityKey: null };
  try {
    const url = new URL(value);
    url.hash = "";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    if ((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80")) url.port = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(?:utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    const normalized = url.toString().replace(/\/$/, "");
    const query = url.searchParams.toString();
    const identityKey = `${url.hostname}${url.port ? `:${url.port}` : ""}${url.pathname === "/" ? "" : url.pathname}${query ? `?${query}` : ""}`.toLowerCase();
    return { original: value, normalized, identityKey };
  } catch {
    throw new Error(`Invalid official URL: ${value}`);
  }
}

function splitValues(value: string | null) {
  if (!value) return [];
  return [...new Set(value.split(/[;\n|]+/).map((part) => text(part)).filter((part): part is string => Boolean(part)))];
}

export function parseDateInformation(value: string | null): DateInformation {
  if (!value || /^unknown$/i.test(value)) return { kind: "unresolved", original: value };
  const exact = value.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
  if (exact) return { kind: "exact_range", original: value, startDate: exact[1], endDate: exact[2] };
  if (/^\d{4}$/.test(value)) return { kind: "year_only", original: value, year: Number(value) };
  return { kind: "other", original: value };
}

export function excelDateToIso(value: string | number | boolean | null) {
  if (value === null || value === "") return null;
  if (typeof value === "number") {
    const milliseconds = Math.round((value - 25_569) * 86_400_000);
    return new Date(milliseconds).toISOString().slice(0, 10);
  }
  const candidate = text(value);
  if (!candidate) return null;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.valueOf()) ? candidate : parsed.toISOString().slice(0, 10);
}

function toRawRow(headers: readonly string[], cells: Array<string | number | boolean | null>) {
  return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? null])) as RawSeedRow;
}

function normalizeSeed(args: {
  raw: RawSeedRow;
  sourceRow: number;
  countyCode: string;
  workbookFingerprint: string;
  approvedSheetFingerprint: string;
}): NormalizedCountySeed {
  const raw = args.raw;
  const required = (header: CountySeedHeader) => {
    const value = text(raw[header]);
    if (!value) throw new Error(`${COUNTY_SEED_SOURCE_SHEET} row ${args.sourceRow} is missing ${header}.`);
    return value;
  };
  const cleanId = required("Clean ID");
  const candidateName = required("Canonical Event Name");
  const county = normalizeCounty(required("County"));
  const municipality = normalizeMunicipality(required("Municipality"));
  const aliases = splitValues(text(raw["Alternate Names"]));
  const officialEventUrl = normalizeOfficialUrl(text(raw["Official Event Source"]));
  const officialOrganizerUrl = normalizeOfficialUrl(text(raw["Official Organizer Source"]));
  const supportingUrls = [text(raw["Supporting Source 1"]), text(raw["Supporting Source 2"])]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      const normalized = normalizeOfficialUrl(value);
      return { original: value, normalized: normalized.normalized!, identityKey: normalized.identityKey! };
    });
  const latitudeValue = text(raw.Latitude);
  const longitudeValue = text(raw.Longitude);
  const latitude = latitudeValue === null ? Number.NaN : Number(latitudeValue);
  const longitude = longitudeValue === null ? Number.NaN : Number(longitudeValue);
  const coordinatesPresent = Number.isFinite(latitude) && Number.isFinite(longitude);
  const spreadsheetGeocoding = text(raw["Needs Geocoding"])?.toLowerCase();

  return {
    countyCode: args.countyCode,
    cleanId,
    candidateName,
    normalizedName: normalizeName(candidateName),
    proposedSlugCandidate: slugifySeed(candidateName, municipality),
    alternateNames: aliases,
    normalizedAlternateNames: aliases.map(normalizeName),
    county,
    municipality,
    normalizedMunicipality: normalizeName(municipality),
    organizer: text(raw.Organizer),
    normalizedOrganizer: text(raw.Organizer) ? normalizeName(text(raw.Organizer)!) : null,
    venue: text(raw.Venue),
    normalizedVenue: text(raw.Venue) ? normalizeName(text(raw.Venue)!) : null,
    address: text(raw["Full Address"]),
    officialEventUrl,
    officialOrganizerUrl,
    supportingUrls,
    category: text(raw["Primary Category"]),
    tags: splitValues(text(raw["Secondary Tags"])),
    dateInformation: parseDateInformation(text(raw["Next Announced Edition"])),
    typicalMonthOrSeason: text(raw["Typical Month / Season"]),
    mostRecentConfirmedEdition: text(raw["Most Recent Confirmed Edition"]),
    earliestConfirmedEdition: text(raw["Earliest Confirmed Edition"]),
    confirmedYears: splitValues(text(raw["Confirmed Years"])),
    geocoding: {
      spreadsheetValue: spreadsheetGeocoding === "yes" ? "yes" : spreadsheetGeocoding === "no" ? "no" : "unknown",
      addressResolutionRequired: !text(raw["Full Address"]),
      coordinatesPresent,
      requiresVerifiedCoordinates: true,
    },
    spreadsheet: {
      activityStatus: text(raw["Activity Status"]),
      qualificationStatus: text(raw["Qualification Status"]),
      confidence: text(raw.Confidence),
      reviewDecision: text(raw["Review Decision"]),
      existingAtlasMatch: text(raw["Existing Atlas Match"]),
    },
    cleanupProvenance: {
      researchDate: excelDateToIso(raw["Research Date"]),
      sourceSchema: text(raw["Source Schema"]),
      sourceRows: text(raw["Source Rows"]),
      duplicateGroup: text(raw["Duplicate Group"]),
      decisionId: text(raw["Decision ID"]),
      notes: text(raw["Cleanup Notes"]),
    },
    workbookFingerprint: args.workbookFingerprint,
    approvedSheetFingerprint: args.approvedSheetFingerprint,
    sourceSheet: COUNTY_SEED_SOURCE_SHEET,
    sourceRow: args.sourceRow,
    proposedIdempotencyKey: `county:${args.countyCode}:${cleanId}:${args.workbookFingerprint}`,
    raw,
  };
}

export async function parseCountySeedWorkbook(workbookPath: string, countyCode: string): Promise<CountySeedWorkbook> {
  const buffer = await readFile(workbookPath);
  const workbookFingerprint = sha256(buffer);
  const entries = readZipDirectory(buffer);
  const sourceSheetPath = resolveSourceSheetPath(buffer, entries);
  const sharedStrings = entries.has("xl/sharedStrings.xml")
    ? parseSharedStrings(extractZipEntry(buffer, entries, "xl/sharedStrings.xml"))
    : [];
  const rows = parseWorksheet(extractZipEntry(buffer, entries, sourceSheetPath), sharedStrings);
  const headers = (rows[0] ?? []).slice(0, COUNTY_SEED_HEADERS.length).map((value) => text(value) ?? "");
  if (headers.length !== COUNTY_SEED_HEADERS.length || headers.some((header, index) => header !== COUNTY_SEED_HEADERS[index])) {
    throw new Error(`Unexpected ${COUNTY_SEED_SOURCE_SHEET} headers. County seed intake requires the finalized 40-column contract.`);
  }
  const dataRows = rows.slice(1).filter((row) => row?.some((value) => text(value) !== null));
  const rawRows = dataRows.map((row) => toRawRow(headers, row));
  const approvedSheetFingerprint = sha256(canonicalJson({ headers, rows: rawRows }));
  const seen = new Set<string>();
  const seeds = rawRows.map((raw, index) => {
    const sourceRow = index + 2;
    const cleanId = text(raw["Clean ID"]);
    if (!cleanId) throw new Error(`${COUNTY_SEED_SOURCE_SHEET} row ${sourceRow} is missing Clean ID.`);
    if (seen.has(cleanId)) throw new Error(`${COUNTY_SEED_SOURCE_SHEET} contains duplicate Clean ID ${cleanId}.`);
    seen.add(cleanId);
    return normalizeSeed({ raw, sourceRow, countyCode, workbookFingerprint, approvedSheetFingerprint });
  });
  return {
    workbookPath,
    workbookFileName: path.basename(workbookPath),
    workbookFingerprint,
    approvedSheetFingerprint,
    sourceSheet: COUNTY_SEED_SOURCE_SHEET,
    headers,
    seeds,
  };
}
