import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildMacombFirstEventPilotManifest,
  MACOMB_FIRST_EVENT_PILOT_CLEAN_IDS,
  prepareCountySeedRecord,
  preflightCountySeedRecord,
  verifyManifestIntegrity,
  type CountySeedBatchManifest,
} from "../lib/county-seeds/staging.ts";
import {
  loadCountySeedPreflightSnapshot,
  summarizeDuplicateConstraints,
} from "../lib/county-seeds/stagingPreflight.ts";
import { parseCountySeedWorkbook } from "../lib/county-seeds/workbook.ts";

const APPROVED_WORKBOOK_SHA256 = "72ca71ed633d8a8dc309955fe37df971acd1b5f27fd4f581ff32ab47a2c07a27";
const APPROVED_SHEET_SHA256 = "4fd822cb6c261a433f2b8942c57027cbce714d363caec689ae7a573241f6a6fc";
const HISTORICAL_MANIFEST_SHA256 = "d0203c6b9141f068a3a4c25ad6449ed641877117d7010fefabc535fb25bae9f2";
const INVENTORY_NAME = "Macomb County Seed Inventory v1";
const HISTORICAL_MANIFEST_REPOSITORY_PATH =
  "artifacts/county-seeds/macomb/county-seed-batch-1-staging-manifest.json";
const OUTPUT_FILE_NAME = "county-seed-first-event-pilot-staging-manifest-v2.json";

function parseArgs(argv: string[]) {
  const workbookPath = argv[0];
  if (!workbookPath || workbookPath.startsWith("--")) {
    throw new Error(
      "Usage: prepare-county-seed-pilot.ts <workbook.xlsx> [--output <directory>] [--captured-at <ISO timestamp>]",
    );
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
  return {
    workbookPath: path.resolve(workbookPath),
    output: path.resolve(output),
    capturedAt,
  };
}

function exactRecord<T extends { cleanId: string }>(records: T[], cleanId: string) {
  const record = records.find((candidate) => candidate.cleanId === cleanId);
  if (!record) throw new Error(`Missing approved seed ${cleanId}.`);
  return record;
}

function warningsForSeed(seed: Awaited<ReturnType<typeof parseCountySeedWorkbook>>["seeds"][number]) {
  const warnings = [
    "Current-edition verification is pending.",
    "Verified coordinates or address resolution are pending.",
  ];
  if (seed.cleanId === "MAC-026") {
    warnings.push(
      "Phase B classified this approved seed as Insufficient information; identity evidence must be resolved before staging approval.",
    );
  }
  if (!seed.address) warnings.push("The approved seed inventory does not contain a full address.");
  if (!seed.officialOrganizerUrl.original) {
    warnings.push("The approved seed inventory does not contain a separate official organizer URL.");
  }
  if (seed.cleanupProvenance.duplicateGroup) {
    warnings.push(
      `Spreadsheet duplicate group ${seed.cleanupProvenance.duplicateGroup} is resolved provenance and must not be re-merged automatically.`,
    );
  }
  return warnings;
}

const args = parseArgs(process.argv.slice(2));
const workbook = await parseCountySeedWorkbook(args.workbookPath, "macomb");
if (workbook.workbookFingerprint !== APPROVED_WORKBOOK_SHA256) {
  throw new Error(`Workbook fingerprint mismatch: ${workbook.workbookFingerprint}.`);
}
if (workbook.approvedSheetFingerprint !== APPROVED_SHEET_SHA256) {
  throw new Error(`Approved-sheet fingerprint mismatch: ${workbook.approvedSheetFingerprint}.`);
}
if (workbook.seeds.length !== 83) {
  throw new Error(`Expected 83 approved seeds; received ${workbook.seeds.length}.`);
}

const historicalManifestPath = path.resolve(HISTORICAL_MANIFEST_REPOSITORY_PATH);
const historicalManifest = JSON.parse(
  await readFile(historicalManifestPath, "utf8"),
) as CountySeedBatchManifest;
const historicalHash = verifyManifestIntegrity(historicalManifest);
if (historicalHash !== HISTORICAL_MANIFEST_SHA256 || historicalManifest.records.length !== 7) {
  throw new Error("The retained seven-event historical manifest does not match its approved evidence.");
}

const snapshot = await loadCountySeedPreflightSnapshot(args.capturedAt);
const duplicateSummary = summarizeDuplicateConstraints(snapshot);
const batchId = `county-seed:macomb:first-event-pilot:${workbook.workbookFingerprint.slice(0, 16)}:v2`;
const cohortIds = (
  selected: (seed: (typeof workbook.seeds)[number]) => string | null,
  value: string | null,
) => workbook.seeds
  .filter((candidate) => Boolean(value && selected(candidate) === value))
  .map((candidate) => candidate.cleanId)
  .sort();
const prepared = MACOMB_FIRST_EVENT_PILOT_CLEAN_IDS.map((cleanId) => {
  const selectedSeed = exactRecord(workbook.seeds, cleanId);
  return prepareCountySeedRecord({
    seed: selectedSeed,
    workbookFileName: workbook.workbookFileName,
    inventoryName: INVENTORY_NAME,
    batchId,
    reviewedSelection: "macomb_first_event_pilot_v2",
    cohortRelationships: {
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
    },
  });
});
const preflights = prepared.map((record) => preflightCountySeedRecord(record, snapshot));
const manifest = buildMacombFirstEventPilotManifest({
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
  historicalManifest: {
    path: HISTORICAL_MANIFEST_REPOSITORY_PATH,
    manifestSha256: historicalHash,
  },
  warningsByCleanId: Object.fromEntries(
    MACOMB_FIRST_EVENT_PILOT_CLEAN_IDS.map((cleanId) => {
      const seed = exactRecord(workbook.seeds, cleanId);
      return [cleanId, warningsForSeed(seed)];
    }),
  ),
});

await mkdir(args.output, { recursive: true });
const manifestPath = path.join(args.output, OUTPUT_FILE_NAME);
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  mode: "local_three_event_pilot_preparation_with_read_only_supabase_preflight",
  supabase_method: snapshot.method,
  supabase_writes: 0,
  batches_executed: 0,
  staging_rpc_calls: 0,
  migration_018_applied: false,
  historical_seven_event_manifest_retained: HISTORICAL_MANIFEST_REPOSITORY_PATH,
  pilot_manifest: manifestPath,
  manifest_sha256: manifest.integrity.manifest_sha256,
  schema_guard_deployed: manifest.required_schema_guard.deployed,
  preflight_actions: Object.fromEntries(
    manifest.records.map((record) => [record.clean_id, record.preflight.action]),
  ),
}, null, 2));
