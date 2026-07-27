import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  BATCH_0_CLEAN_IDS,
  BATCH_1_CLEAN_IDS,
  buildBatch1Manifest,
  prepareCountySeedRecord,
  preflightCountySeedRecord,
  sha256Canonical,
} from "../lib/county-seeds/staging.ts";
import {
  loadCountySeedPreflightSnapshot,
  summarizeDuplicateConstraints,
} from "../lib/county-seeds/stagingPreflight.ts";
import { parseCountySeedWorkbook } from "../lib/county-seeds/workbook.ts";

const APPROVED_WORKBOOK_SHA256 = "72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27";
const APPROVED_SHEET_SHA256 = "4fd822cb6c261a433f2b8942c57027cbce714d363caec689ae7a573241f6a6fc";
const INVENTORY_NAME = "Macomb County Seed Inventory v1";
const C0_PLAN_PATH = path.resolve("artifacts/county-seeds/schema-contract/county-seed-batch-write-plan.json");

type C0Plan = {
  batch0: {
    records: Array<{
      clean_id: string;
      canonical_event_id: string;
      canonical_event_slug: string;
      existing_candidate_id: string;
      expected_candidate_state: {
        verification_status: string;
        duplicate_status: string;
        matched_event_id: string;
      };
    }>;
  };
};

function parseArgs(argv: string[]) {
  const workbookPath = argv[0];
  if (!workbookPath || workbookPath.startsWith("--")) {
    throw new Error("Usage: prepare-county-seed-staging.ts <workbook.xlsx> [--output <directory>] [--captured-at <ISO timestamp>]");
  }
  let output = "artifacts/county-seeds/macomb";
  let capturedAt = new Date().toISOString();
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output") output = argv[++index] ?? "";
    else if (arg === "--captured-at") capturedAt = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!output) throw new Error("--output requires a directory.");
  if (Number.isNaN(Date.parse(capturedAt))) throw new Error("--captured-at must be an ISO timestamp.");
  return { workbookPath: path.resolve(workbookPath), output: path.resolve(output), capturedAt };
}

function exactRecord<T extends { cleanId: string }>(records: T[], cleanId: string) {
  const record = records.find((candidate) => candidate.cleanId === cleanId);
  if (!record) throw new Error(`Missing approved seed ${cleanId}.`);
  return record;
}

const args = parseArgs(process.argv.slice(2));
const workbook = await parseCountySeedWorkbook(args.workbookPath, "macomb");
if (workbook.workbookFingerprint !== APPROVED_WORKBOOK_SHA256) {
  throw new Error(`Workbook fingerprint mismatch: ${workbook.workbookFingerprint}.`);
}
if (workbook.approvedSheetFingerprint !== APPROVED_SHEET_SHA256) {
  throw new Error(`Approved-sheet fingerprint mismatch: ${workbook.approvedSheetFingerprint}.`);
}
if (workbook.seeds.length !== 83) throw new Error(`Expected 83 approved seeds; received ${workbook.seeds.length}.`);

const snapshot = await loadCountySeedPreflightSnapshot(args.capturedAt);
const duplicateSummary = summarizeDuplicateConstraints(snapshot);
const batchId = `county-seed:macomb:batch-1:${workbook.workbookFingerprint.slice(0, 16)}:v1`;
const cohortIds = (
  selected: (seed: (typeof workbook.seeds)[number]) => string | null,
  value: string | null,
) => workbook.seeds
  .filter((candidate) => Boolean(value && selected(candidate) === value))
  .map((candidate) => candidate.cleanId)
  .sort();
const prepared = BATCH_1_CLEAN_IDS.map((cleanId) => prepareCountySeedRecord({
  seed: exactRecord(workbook.seeds, cleanId),
  workbookFileName: workbook.workbookFileName,
  inventoryName: INVENTORY_NAME,
  batchId,
  cohortRelationships: (() => {
    const selectedSeed = exactRecord(workbook.seeds, cleanId);
    return {
      shared_official_url_clean_ids: cohortIds(
        (candidate) => candidate.officialEventUrl.identityKey,
        selectedSeed.officialEventUrl.identityKey,
      ),
      shared_organizer_clean_ids: cohortIds(
        (candidate) => candidate.normalizedOrganizer,
        selectedSeed.normalizedOrganizer,
      ),
      shared_venue_clean_ids: cohortIds(
        (candidate) => candidate.normalizedVenue,
        selectedSeed.normalizedVenue,
      ),
    };
  })(),
}));
const preflights = prepared.map((record) => preflightCountySeedRecord(record, snapshot));
const manifest = buildBatch1Manifest({
  workbookFileName: workbook.workbookFileName,
  workbookFingerprint: workbook.workbookFingerprint,
  approvedSheetFingerprint: workbook.approvedSheetFingerprint,
  inventoryName: INVENTORY_NAME,
  batchId,
  preparedAt: args.capturedAt,
  records: prepared,
  preflights,
  schemaGuardDeployed: snapshot.schema_guard.guarded_rpc_visible,
  snapshotSummary: {
    captured_at: snapshot.captured_at,
    method: snapshot.method,
    inspected_counts: duplicateSummary.inspected_counts,
    duplicate_candidate_slugs: duplicateSummary.duplicate_candidate_slugs.length,
    duplicate_candidate_source_associations: duplicateSummary.duplicate_candidate_source_associations.length,
    duplicate_operation_identities: duplicateSummary.duplicate_operation_identities.length,
    duplicate_county_seed_identities: duplicateSummary.duplicate_county_seed_identities.length,
  },
});

const c0Plan = JSON.parse(await readFile(C0_PLAN_PATH, "utf8")) as C0Plan;
const batch0Records = BATCH_0_CLEAN_IDS.map((cleanId) => {
  const planned = c0Plan.batch0.records.find((record) => record.clean_id === cleanId);
  if (!planned) throw new Error(`C0 plan is missing ${cleanId}.`);
  const event = snapshot.events.find((row) => row.id === planned.canonical_event_id);
  const candidate = snapshot.candidates.find((row) => row.id === planned.existing_candidate_id);
  if (!event || !candidate) throw new Error(`Fresh read-only preflight did not confirm both records for ${cleanId}.`);
  if (
    candidate.matched_event_id !== event.id
    || candidate.verification_status !== planned.expected_candidate_state.verification_status
  ) {
    throw new Error(`Fresh read-only preflight found a changed promoted-candidate state for ${cleanId}.`);
  }
  const seed = exactRecord(workbook.seeds, cleanId);
  return {
    clean_id: cleanId,
    seed_name: seed.candidateName,
    canonical_event_id: event.id,
    canonical_event_slug: event.slug,
    existing_candidate_id: candidate.id,
    reviewed_match_signals: [
      {
        kind: "exact_official_url",
        value: seed.officialEventUrl.identityKey,
      },
      {
        kind: "exact_name_municipality",
        value: `${seed.normalizedName}|${seed.normalizedMunicipality}`,
      },
      {
        kind: "promoted_candidate_link",
        value: candidate.matched_event_id,
      },
    ],
    human_approved_disposition: "retain_seed_to_canonical_crosswalk_only",
    action: "retain_seed_to_canonical_crosswalk_only",
    rpc: null,
    database_writes: [],
  };
});
const batch0WithoutHash = {
  contract_version: 1,
  mode: "batch_0_crosswalk_only_no_write",
  inventory_name: INVENTORY_NAME,
  workbook_file_name: workbook.workbookFileName,
  workbook_fingerprint: workbook.workbookFingerprint,
  approved_sheet_fingerprint: workbook.approvedSheetFingerprint,
  reviewed_at: args.capturedAt,
  approval: {
    status: "human_approved_no_write_disposition",
    scope: "crosswalk_only",
    candidate_creation: false,
    rpc_execution: false,
    canonical_update: false,
  },
  records: batch0Records,
};
const batch0 = {
  ...batch0WithoutHash,
  integrity: {
    algorithm: "sha256",
    artifact_sha256: sha256Canonical(batch0WithoutHash),
  },
};

await mkdir(args.output, { recursive: true });
const crosswalkPath = path.join(args.output, "county-seed-batch-0-crosswalk.json");
const manifestPath = path.join(args.output, "county-seed-batch-1-staging-manifest.json");
await Promise.all([
  writeFile(crosswalkPath, `${JSON.stringify(batch0, null, 2)}\n`, "utf8"),
  writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8"),
]);

console.log(JSON.stringify({
  mode: "local_artifact_preparation_with_read_only_supabase_preflight",
  supabase_writes: 0,
  batches_executed: 0,
  batch0: crosswalkPath,
  batch1: manifestPath,
  manifest_sha256: manifest.integrity.manifest_sha256,
  schema_guard_deployed: manifest.required_schema_guard.deployed,
  preflight_actions: Object.fromEntries(
    manifest.records.map((record) => [record.clean_id, record.preflight.action]),
  ),
}, null, 2));
