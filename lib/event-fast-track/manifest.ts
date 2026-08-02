import { createHash } from "node:crypto";
import {
  FAST_TRACK_SCHEMA_VERSION,
  type FastTrackApprovedEvent,
  type FastTrackApprovedList,
  type FastTrackEventReferences,
} from "./types.ts";

const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, stableValue(entry)]),
  );
}

export function stableFastTrackJson(value: unknown) {
  return JSON.stringify(stableValue(value));
}

export function fastTrackSha256(value: unknown) {
  return createHash("sha256").update(stableFastTrackJson(value)).digest("hex");
}

function cleanString(value: unknown, maximum = 300) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximum);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180)
    .replace(/-+$/g, "");
}

function parseUrl(
  value: unknown,
  path: string,
  errors: string[],
): string | undefined {
  const text = cleanString(value, 2_000);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("unsupported protocol");
    }
    url.hash = "";
    return url.toString();
  } catch {
    errors.push(`${path} must be a valid HTTP(S) URL when provided.`);
    return undefined;
  }
}

function parseStringList(
  value: unknown,
  path: string,
  errors: string[],
  maximumItems: number,
) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    errors.push(`${path} must be an array when provided.`);
    return [];
  }
  if (value.length > maximumItems) {
    errors.push(`${path} cannot contain more than ${maximumItems} items.`);
  }
  const cleaned = value
    .slice(0, maximumItems)
    .map((entry) => cleanString(entry, 1_000))
    .filter(Boolean);
  if (cleaned.length !== value.slice(0, maximumItems).length) {
    errors.push(`${path} entries must be non-empty strings.`);
  }
  return [...new Set(cleaned)];
}

function parseReferences(
  value: unknown,
  path: string,
  errors: string[],
): FastTrackEventReferences {
  if (value === undefined) return {};
  if (!isRecord(value)) {
    errors.push(`${path} must be an object when provided.`);
    return {};
  }
  const keys = [
    "candidateId",
    "canonicalEventId",
    "sourceBundleId",
    "synthesisId",
    "verificationCaseId",
    "packageId",
  ] as const;
  const references: FastTrackEventReferences = {};
  for (const key of keys) {
    const candidate = cleanString(value[key], 100);
    if (!candidate) continue;
    if (!UUID_PATTERN.test(candidate)) {
      errors.push(`${path}.${key} must be a UUID when provided.`);
      continue;
    }
    references[key] = candidate;
  }
  return references;
}

function parseTargetYear(
  value: unknown,
  fallback: number | undefined,
  path: string,
  errors: string[],
) {
  const year = value === undefined ? fallback : value;
  if (!Number.isSafeInteger(year) || Number(year) < 2000 || Number(year) > 2100) {
    errors.push(`${path} must be an integer from 2000 through 2100.`);
    return 2000;
  }
  return Number(year);
}

function parseEvent(args: {
  value: unknown;
  index: number;
  defaultState?: string;
  defaultTargetYear?: number;
  errors: string[];
}): FastTrackApprovedEvent | null {
  const path = `list.events[${args.index}]`;
  if (!isRecord(args.value)) {
    args.errors.push(`${path} must be an object.`);
    return null;
  }
  const displayName = cleanString(args.value.name ?? args.value.displayName, 300);
  const city = cleanString(args.value.city, 200);
  const state = cleanString(args.value.state ?? args.defaultState, 200);
  if (!displayName) args.errors.push(`${path}.name is required.`);
  if (!city) args.errors.push(`${path}.city is required.`);
  if (!state) args.errors.push(`${path}.state or list.defaultState is required.`);

  const generatedKey = slugify(`${displayName}-${city}-${state}`);
  const eventKey = cleanString(args.value.eventKey, 180) || generatedKey;
  if (!KEY_PATTERN.test(eventKey)) {
    args.errors.push(`${path}.eventKey must be a stable lowercase hyphenated key.`);
  }
  const sourceRecordId =
    cleanString(args.value.sourceRecordId, 300) || eventKey;
  if (!sourceRecordId) {
    args.errors.push(`${path}.sourceRecordId could not be derived.`);
  }
  const targetYear = parseTargetYear(
    args.value.targetYear,
    args.defaultTargetYear,
    `${path}.targetYear`,
    args.errors,
  );
  const officialUrl = parseUrl(
    args.value.officialUrl,
    `${path}.officialUrl`,
    args.errors,
  );
  const rawAdditionalUrls = Array.isArray(args.value.additionalSourceUrls)
    ? args.value.additionalSourceUrls
    : args.value.sourceUrls;
  const additionalSourceUrls = Array.isArray(rawAdditionalUrls)
    ? rawAdditionalUrls
        .map((url, index) =>
          parseUrl(url, `${path}.additionalSourceUrls[${index}]`, args.errors),
        )
        .filter((url): url is string => Boolean(url))
        .filter((url) => url !== officialUrl)
    : rawAdditionalUrls === undefined
      ? []
      : (args.errors.push(`${path}.additionalSourceUrls must be an array when provided.`), []);
  const knownConstraints = parseStringList(
    args.value.knownConstraints,
    `${path}.knownConstraints`,
    args.errors,
    20,
  );
  const references = parseReferences(
    args.value.references,
    `${path}.references`,
    args.errors,
  );
  const metadata = isRecord(args.value.metadata) ? args.value.metadata : {};
  if (args.value.metadata !== undefined && !isRecord(args.value.metadata)) {
    args.errors.push(`${path}.metadata must be an object when provided.`);
  }
  if (!displayName || !city || !state || !eventKey || !sourceRecordId) return null;

  const input = {
    sourceRecordId,
    eventKey,
    displayName,
    city,
    state,
    targetYear,
    ...(officialUrl ? { officialUrl } : {}),
    additionalSourceUrls: [...new Set(additionalSourceUrls)],
    ...(cleanString(args.value.county, 200)
      ? { county: cleanString(args.value.county, 200) }
      : {}),
    ...(cleanString(args.value.venueName, 300)
      ? { venueName: cleanString(args.value.venueName, 300) }
      : {}),
    knownConstraints,
    ...(cleanString(args.value.notes, 2_000)
      ? { notes: cleanString(args.value.notes, 2_000) }
      : {}),
    references,
    metadata,
  };
  const suppliedHash =
    typeof args.value.inputHash === "string" ? args.value.inputHash.trim() : "";
  const inputHash = fastTrackSha256(input);
  if (suppliedHash && suppliedHash !== inputHash) {
    args.errors.push(`${path}.inputHash does not match the canonical event input.`);
  }
  return { ...input, inputHash };
}

export function parseFastTrackApprovedList(value: unknown) {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false as const, errors: ["Approved list must be a JSON object."] };
  }
  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== FAST_TRACK_SCHEMA_VERSION
  ) {
    errors.push(`list.schemaVersion must be ${FAST_TRACK_SCHEMA_VERSION}.`);
  }
  if (
    value.approvalScope !== undefined &&
    value.approvalScope !== "inclusion_and_private_preparation_only"
  ) {
    errors.push(
      "list.approvalScope must be inclusion_and_private_preparation_only.",
    );
  }
  if (value.publicationAuthorized !== undefined && value.publicationAuthorized !== false) {
    errors.push("list.publicationAuthorized must be false.");
  }
  const listId = cleanString(value.listId, 180);
  const approvedBy = cleanString(value.approvedBy, 300);
  const approvedAt = cleanString(value.approvedAt, 100);
  if (!listId || !KEY_PATTERN.test(listId)) {
    errors.push("list.listId must be a stable lowercase hyphenated key.");
  }
  if (!approvedBy) errors.push("list.approvedBy is required.");
  if (!approvedAt || Number.isNaN(Date.parse(approvedAt))) {
    errors.push("list.approvedAt must be a valid timestamp.");
  }
  const defaultState = cleanString(value.defaultState, 200) || undefined;
  const defaultTargetYear =
    value.defaultTargetYear === undefined
      ? undefined
      : parseTargetYear(
          value.defaultTargetYear,
          undefined,
          "list.defaultTargetYear",
          errors,
        );
  if (!Array.isArray(value.events) || value.events.length < 1) {
    errors.push("list.events must contain at least one event.");
  }
  if (Array.isArray(value.events) && value.events.length > 500) {
    errors.push("list.events cannot contain more than 500 events.");
  }
  const events = Array.isArray(value.events)
    ? value.events
        .slice(0, 500)
        .map((event, index) =>
          parseEvent({
            value: event,
            index,
            defaultState,
            defaultTargetYear,
            errors,
          }),
        )
        .filter((event): event is FastTrackApprovedEvent => Boolean(event))
    : [];
  const eventKeys = new Set<string>();
  const sourceRecordIds = new Set<string>();
  for (const event of events) {
    if (eventKeys.has(event.eventKey)) {
      errors.push(`list.events contains duplicate eventKey ${event.eventKey}.`);
    }
    if (sourceRecordIds.has(event.sourceRecordId)) {
      errors.push(
        `list.events contains duplicate sourceRecordId ${event.sourceRecordId}.`,
      );
    }
    eventKeys.add(event.eventKey);
    sourceRecordIds.add(event.sourceRecordId);
  }
  const metadata = isRecord(value.metadata) ? value.metadata : {};
  if (value.metadata !== undefined && !isRecord(value.metadata)) {
    errors.push("list.metadata must be an object when provided.");
  }
  if (errors.length) return { ok: false as const, errors };

  const list: FastTrackApprovedList = {
    schemaVersion: FAST_TRACK_SCHEMA_VERSION,
    listId,
    approvedBy,
    approvedAt: new Date(approvedAt).toISOString(),
    approvalScope: "inclusion_and_private_preparation_only",
    publicationAuthorized: false,
    ...(defaultState ? { defaultState } : {}),
    ...(defaultTargetYear ? { defaultTargetYear } : {}),
    events,
    metadata,
  };
  return {
    ok: true as const,
    value: list,
    inputHash: fastTrackSha256(list),
  };
}
