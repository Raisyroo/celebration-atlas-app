import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  COUNTY_SEED_HEADERS,
  COUNTY_SEED_SOURCE_SHEET,
  type NormalizedCountySeed,
} from "../county-seeds/types.ts";
import { parseCountySeedWorkbook } from "../county-seeds/workbook.ts";
import { completionSha256 } from "./manifest.ts";

export const COUNTY_COMPLETION_INVENTORY_VERSION =
  "michigan-county-completion-inventory/1";

export type CountyEditorialHold = {
  sourceRecordId: string;
  kind: "protected" | "editorial_hold";
  reason: string;
};

export type MichiganCountyInventoryConfig = {
  stateId: "MI";
  countyCode: string;
  countyName: string;
  artifactPath: string;
  artifactSha256: string;
  workbookFileName: string;
  workbookSha256: string;
  sourceSheet: typeof COUNTY_SEED_SOURCE_SHEET;
  approvedSheetSha256: string;
  expectedRecordCount: number;
  editorialHolds: readonly CountyEditorialHold[];
};

const COUNTY_INVENTORIES: Readonly<Record<string, MichiganCountyInventoryConfig>> = {
  macomb: {
    stateId: "MI",
    countyCode: "macomb",
    countyName: "Macomb County",
    artifactPath: "artifacts/county-seeds/macomb/county-seed-dry-run.json",
    artifactSha256:
      "10d8fed6b90cffd192cda8c849ef3f15239cfe5c4ea190128882ba968be614dc",
    workbookFileName: "Macomb_County_Event_Inventory_Finalized.xlsx",
    workbookSha256:
      "72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27",
    sourceSheet: COUNTY_SEED_SOURCE_SHEET,
    approvedSheetSha256:
      "4fd822cb6c261a433f2b8942c57027cbce714d363caec689ae7a573241f6a6fc",
    expectedRecordCount: 83,
    editorialHolds: [
      {
        sourceRecordId: "MAC-026",
        kind: "editorial_hold",
        reason:
          "Memphis Festival Days remains outside generalized county staging until its insufficient identity and source evidence is reviewed.",
      },
      {
        sourceRecordId: "MAC-042",
        kind: "protected",
        reason:
          "Bay-Rama Fishfly Festival is a protected pilot candidate with its own retained review history and is excluded from automatic county handling.",
      },
      {
        sourceRecordId: "MAC-049",
        kind: "editorial_hold",
        reason:
          "Richmond Good Old Days Festival remains under the retained editorial hold and is not eligible for automatic county staging.",
      },
    ],
  },
};

type RetainedCountyInventoryArtifact = {
  schemaVersion: number;
  mode: string;
  source: {
    workbookFileName: string;
    workbookFingerprint: string;
    approvedSheetFingerprint: string;
    sourceSheet: string;
    rowCount: number;
  };
  safeguards: Record<string, unknown>;
  records: Array<{
    seed: NormalizedCountySeed;
    match?: Record<string, unknown>;
  }>;
};

export type ApprovedCountyInventory = {
  config: MichiganCountyInventoryConfig;
  artifactPath: string;
  artifactSha256: string;
  inventorySha256: string;
  workbookValidation:
    | {
        mode: "retained_fingerprint";
        workbookPath: null;
        workbookSha256: string;
        approvedSheetSha256: string;
      }
    | {
        mode: "recomputed_workbook";
        workbookPath: string;
        workbookSha256: string;
        approvedSheetSha256: string;
      };
  seeds: NormalizedCountySeed[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sha256Bytes(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function assertExact(value: unknown, expected: unknown, label: string) {
  if (value !== expected) {
    throw new Error(
      `${label} mismatch: expected ${String(expected)}, received ${String(value)}.`,
    );
  }
}

function validateSeed(
  seed: NormalizedCountySeed,
  config: MichiganCountyInventoryConfig,
  seenIds: Set<string>,
) {
  if (!isRecord(seed)) throw new Error("County inventory contains an invalid seed.");
  if (!seed.cleanId || seenIds.has(seed.cleanId)) {
    throw new Error(`County inventory contains a missing or duplicate Clean ID ${seed.cleanId}.`);
  }
  seenIds.add(seed.cleanId);
  assertExact(seed.countyCode, config.countyCode, `${seed.cleanId} county code`);
  assertExact(seed.sourceSheet, config.sourceSheet, `${seed.cleanId} source sheet`);
  assertExact(
    seed.workbookFingerprint,
    config.workbookSha256,
    `${seed.cleanId} workbook fingerprint`,
  );
  assertExact(
    seed.approvedSheetFingerprint,
    config.approvedSheetSha256,
    `${seed.cleanId} approved-sheet fingerprint`,
  );
  if (!Number.isSafeInteger(seed.sourceRow) || seed.sourceRow < 2) {
    throw new Error(`${seed.cleanId} has an invalid retained source row.`);
  }
  if (!isRecord(seed.raw)) {
    throw new Error(`${seed.cleanId} does not retain its complete workbook row.`);
  }
  const rawHeaders = Object.keys(seed.raw).sort();
  const expectedHeaders = [...COUNTY_SEED_HEADERS].sort();
  if (JSON.stringify(rawHeaders) !== JSON.stringify(expectedHeaders)) {
    throw new Error(`${seed.cleanId} does not satisfy the 40-column county schema.`);
  }
  assertExact(seed.raw["Clean ID"], seed.cleanId, `${seed.cleanId} raw Clean ID`);
  if (
    seed.spreadsheet.qualificationStatus !== "Qualifies" ||
    seed.spreadsheet.reviewDecision !== "Keep"
  ) {
    throw new Error(
      `${seed.cleanId} is not an approved Qualifies/Keep inventory record.`,
    );
  }
}

export function resolveMichiganCountyInventoryConfig(
  countyInput: string,
): MichiganCountyInventoryConfig {
  const countyCode = countyInput
    .trim()
    .toLowerCase()
    .replace(/\s+county$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const config = COUNTY_INVENTORIES[countyCode];
  if (!config) {
    throw new Error(
      `No retained approved Michigan county inventory is registered for ${countyInput}.`,
    );
  }
  return config;
}

export async function loadApprovedCountyInventory(args: {
  repositoryRoot: string;
  countyInput: string;
  workbookPath?: string;
}): Promise<ApprovedCountyInventory> {
  const config = resolveMichiganCountyInventoryConfig(args.countyInput);
  const artifactPath = path.resolve(args.repositoryRoot, config.artifactPath);
  const artifactBytes = await readFile(artifactPath);
  const artifactSha256 = sha256Bytes(artifactBytes);
  assertExact(
    artifactSha256,
    config.artifactSha256,
    `${config.countyName} retained inventory artifact SHA-256`,
  );

  const parsed = JSON.parse(artifactBytes.toString("utf8")) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${config.countyName} retained inventory is not a JSON object.`);
  }
  const artifact = parsed as RetainedCountyInventoryArtifact;
  assertExact(artifact.schemaVersion, 1, "County inventory schema version");
  assertExact(artifact.mode, "read-only-dry-run", "County inventory mode");
  if (!isRecord(artifact.source)) {
    throw new Error("County inventory source identity is missing.");
  }
  assertExact(
    artifact.source.workbookFileName,
    config.workbookFileName,
    "County workbook file name",
  );
  assertExact(
    artifact.source.workbookFingerprint,
    config.workbookSha256,
    "County workbook fingerprint",
  );
  assertExact(
    artifact.source.approvedSheetFingerprint,
    config.approvedSheetSha256,
    "County approved-sheet fingerprint",
  );
  assertExact(
    artifact.source.sourceSheet,
    config.sourceSheet,
    "County source sheet",
  );
  assertExact(
    artifact.source.rowCount,
    config.expectedRecordCount,
    "County source row count",
  );
  if (!Array.isArray(artifact.records)) {
    throw new Error("County inventory records are missing.");
  }
  assertExact(
    artifact.records.length,
    config.expectedRecordCount,
    "County inventory record count",
  );

  const seenIds = new Set<string>();
  const seeds = artifact.records.map((record) => {
    if (!isRecord(record) || !isRecord(record.seed)) {
      throw new Error("County inventory contains a malformed retained record.");
    }
    const seed = record.seed as NormalizedCountySeed;
    validateSeed(seed, config, seenIds);
    return seed;
  });
  seeds.sort((left, right) => left.cleanId.localeCompare(right.cleanId));

  let workbookValidation: ApprovedCountyInventory["workbookValidation"] = {
    mode: "retained_fingerprint",
    workbookPath: null,
    workbookSha256: config.workbookSha256,
    approvedSheetSha256: config.approvedSheetSha256,
  };
  if (args.workbookPath) {
    const workbook = await parseCountySeedWorkbook(
      path.resolve(args.workbookPath),
      config.countyCode,
    );
    assertExact(
      workbook.workbookFileName,
      config.workbookFileName,
      "Recomputed workbook file name",
    );
    assertExact(
      workbook.workbookFingerprint,
      config.workbookSha256,
      "Recomputed workbook SHA-256",
    );
    assertExact(
      workbook.approvedSheetFingerprint,
      config.approvedSheetSha256,
      "Recomputed approved-sheet SHA-256",
    );
    assertExact(workbook.sourceSheet, config.sourceSheet, "Recomputed source sheet");
    assertExact(
      workbook.seeds.length,
      config.expectedRecordCount,
      "Recomputed approved record count",
    );
    workbookValidation = {
      mode: "recomputed_workbook",
      workbookPath: path.resolve(args.workbookPath),
      workbookSha256: workbook.workbookFingerprint,
      approvedSheetSha256: workbook.approvedSheetFingerprint,
    };
  }

  const inventorySha256 = completionSha256({
    contractVersion: COUNTY_COMPLETION_INVENTORY_VERSION,
    stateId: config.stateId,
    countyCode: config.countyCode,
    workbookFileName: config.workbookFileName,
    workbookSha256: config.workbookSha256,
    sourceSheet: config.sourceSheet,
    approvedSheetSha256: config.approvedSheetSha256,
    records: seeds,
  });

  return {
    config,
    artifactPath,
    artifactSha256,
    inventorySha256,
    workbookValidation,
    seeds,
  };
}
