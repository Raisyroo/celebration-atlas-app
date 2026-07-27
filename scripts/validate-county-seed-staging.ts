import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildBatch1Manifest,
  manifestHash,
  prepareCountySeedRecord,
  preflightCountySeedRecord,
  validateApplyAuthorization,
  validateBatch0NoWriteCrosswalk,
  verifyManifestIntegrity,
  type CountySeedBatchManifest,
  type CountySeedPreflightSnapshot,
  type PreflightCandidateRow,
} from "../lib/county-seeds/staging.ts";
import {
  CountySeedRpcRejectedError,
  executeGuardedCountySeedManifest,
} from "../lib/county-seeds/stagingApply.ts";
import {
  COUNTY_SEED_HEADERS,
  type NormalizedCountySeed,
  type RawSeedRow,
} from "../lib/county-seeds/types.ts";

const WORKBOOK_HASH = "a".repeat(64);
const SHEET_HASH = "b".repeat(64);
const CAPTURED_AT = "2026-07-27T12:00:00.000Z";
const BATCH_ID = `county-seed:macomb:batch-1:${WORKBOOK_HASH.slice(0, 16)}:v1`;

function rawRow(): RawSeedRow {
  return Object.fromEntries(COUNTY_SEED_HEADERS.map((header) => [header, null])) as RawSeedRow;
}

function seed(overrides: Partial<NormalizedCountySeed> = {}): NormalizedCountySeed {
  return {
    countyCode: "macomb",
    cleanId: "MAC-003",
    candidateName: "Blake's Lavender Festival",
    normalizedName: "blakes lavender festival",
    proposedSlugCandidate: "blakes-lavender-festival-armada-mi",
    alternateNames: ["Blake Lavender Festival"],
    normalizedAlternateNames: ["blake lavender festival"],
    county: "Macomb",
    municipality: "Armada",
    normalizedMunicipality: "armada",
    organizer: "Blake Farms",
    normalizedOrganizer: "blake farms",
    venue: "Blake's Orchard",
    normalizedVenue: "blakes orchard",
    address: "17985 Armada Center Rd, Armada, MI 48005",
    officialEventUrl: {
      original: "https://example.test/lavender",
      normalized: "https://example.test/lavender",
      identityKey: "example.test/lavender",
    },
    officialOrganizerUrl: {
      original: "https://example.test",
      normalized: "https://example.test",
      identityKey: "example.test",
    },
    supportingUrls: [],
    category: "Food, farm and harvest events",
    tags: ["Lavender", "Farm festival"],
    dateInformation: { kind: "year_only", original: "2026", year: 2026 },
    typicalMonthOrSeason: "July",
    mostRecentConfirmedEdition: "2026",
    earliestConfirmedEdition: "2020",
    confirmedYears: ["2025", "2026"],
    geocoding: {
      spreadsheetValue: "no",
      addressResolutionRequired: false,
      coordinatesPresent: false,
      requiresVerifiedCoordinates: true,
    },
    spreadsheet: {
      activityStatus: "Upcoming Edition Announced",
      qualificationStatus: "Qualifies",
      confidence: "High",
      reviewDecision: "Keep",
      existingAtlasMatch: "Not Checked",
    },
    cleanupProvenance: {
      researchDate: "2026-07-22",
      sourceSchema: "Full research",
      sourceRows: "QUALIFIED_EVENT_SERIES!1",
      duplicateGroup: null,
      decisionId: null,
      notes: null,
    },
    workbookFingerprint: WORKBOOK_HASH,
    approvedSheetFingerprint: SHEET_HASH,
    sourceSheet: "03_IMPORT_READY",
    sourceRow: 4,
    proposedIdempotencyKey: `county:macomb:MAC-003:${WORKBOOK_HASH}`,
    raw: rawRow(),
    ...overrides,
  };
}

function snapshot(overrides: Partial<CountySeedPreflightSnapshot> = {}): CountySeedPreflightSnapshot {
  return {
    captured_at: CAPTURED_AT,
    method: "PostgREST GET only",
    schema_guard: {
      guarded_rpc_visible: false,
      required_migration: "018_guard_county_seed_candidate_staging.sql",
    },
    events: [],
    candidates: [],
    sources: [],
    operation_runs: [],
    ...overrides,
  };
}

function prepared() {
  return prepareCountySeedRecord({
    seed: seed(),
    workbookFileName: "Macomb_County_Event_Inventory_Finalized.xlsx",
    inventoryName: "Macomb County Seed Inventory v1",
    batchId: BATCH_ID,
  });
}

function manifest(
  record = prepared(),
  preflight = preflightCountySeedRecord(record, snapshot()),
) {
  return buildBatch1Manifest({
    workbookFileName: "Macomb_County_Event_Inventory_Finalized.xlsx",
    workbookFingerprint: WORKBOOK_HASH,
    approvedSheetFingerprint: SHEET_HASH,
    inventoryName: "Macomb County Seed Inventory v1",
    batchId: BATCH_ID,
    preparedAt: CAPTURED_AT,
    records: [record],
    preflights: [preflight],
    schemaGuardDeployed: false,
    snapshotSummary: {
      captured_at: CAPTURED_AT,
      method: "PostgREST GET only",
      inspected_counts: {
        event_candidates: 0,
        event_candidate_sources: 0,
        atlas_operation_runs: 0,
        events: 0,
      },
      duplicate_candidate_slugs: 0,
      duplicate_candidate_source_associations: 0,
      duplicate_operation_identities: 0,
      duplicate_county_seed_identities: 0,
    },
  });
}

function approveManifest(input: CountySeedBatchManifest) {
  const approved = structuredClone(input);
  approved.required_schema_guard.deployed = true;
  approved.execution.authorized = true;
  for (const record of approved.records) {
    record.eligibility.execution_eligible = true;
    record.eligibility.blockers = [];
    record.approval.staging_execution = "human_approved";
  }
  approved.integrity.manifest_sha256 = manifestHash(approved);
  return approved;
}

const first = prepared();
const second = prepared();
assert.equal(first.payload_sha256, second.payload_sha256, "identical normalized seeds must have stable payload hashes");
assert.deepEqual(first.args, second.args, "adapter output must be deterministic");
assert.equal(
  first.args.p_candidate.county_seed.payload_hash,
  first.payload_sha256,
  "the deterministic payload hash must be retained in raw candidate provenance",
);

const manifestOne = manifest();
const manifestTwo = manifest();
assert.deepEqual(manifestOne, manifestTwo, "same inputs and fixed clock must produce deterministic manifests");
assert.equal(verifyManifestIntegrity(manifestOne), manifestOne.integrity.manifest_sha256);

const equivalentCandidate: PreflightCandidateRow = {
  id: "00000000-0000-4000-8000-000000000001",
  candidate_name: first.args.p_candidate.candidate_name,
  normalized_name: first.args.p_candidate.normalized_name,
  slug_candidate: first.args.p_candidate.slug_candidate,
  city: first.args.p_candidate.city,
  county: "Macomb",
  venue_name: first.args.p_candidate.venue_name,
  official_website_candidate: first.args.p_candidate.official_website_candidate,
  typical_month: "July",
  typical_season: null,
  verification_status: "needs_review",
  duplicate_status: "unchecked",
  matched_event_id: null,
  raw_payload: first.args.p_candidate,
};
const equivalent = preflightCountySeedRecord(first, snapshot({ candidates: [equivalentCandidate] }));
assert.equal(equivalent.action, "no_op_equivalent", "same exact identity and hash must be a no-op");
assert.equal(equivalent.equivalent_candidate_id, equivalentCandidate.id);

const mismatchCandidate = structuredClone(equivalentCandidate);
(mismatchCandidate.raw_payload as typeof first.args.p_candidate).county_seed.payload_hash = "c".repeat(64);
const mismatch = preflightCountySeedRecord(first, snapshot({ candidates: [mismatchCandidate] }));
assert.equal(mismatch.action, "blocked");
assert(mismatch.blockers.includes("county_identity_payload_conflict"), "payload mismatch must block");

const slugCandidate = structuredClone(equivalentCandidate);
slugCandidate.id = "00000000-0000-4000-8000-000000000002";
(slugCandidate.raw_payload as typeof first.args.p_candidate).county_seed.clean_id = "MAC-999";
const slugCollision = preflightCountySeedRecord(first, snapshot({ candidates: [slugCandidate] }));
assert(slugCollision.blockers.includes("slug_owned_by_different_identity"), "non-equivalent slug must block");

const sourceCollision = preflightCountySeedRecord(first, snapshot({
  sources: [{
    id: "00000000-0000-4000-8000-000000000003",
    candidate_id: "00000000-0000-4000-8000-000000000004",
    source_url: first.args.p_sources[0].source_url,
    source_type: "official",
  }],
}));
assert(sourceCollision.blockers.includes("official_source_attached_elsewhere"), "official source attached elsewhere must block");

const canonicalCollision = preflightCountySeedRecord(first, snapshot({
  events: [{
    id: "00000000-0000-4000-8000-000000000005",
    name: first.args.p_candidate.candidate_name,
    slug: "existing-event",
    city: first.args.p_candidate.city,
    county: "Macomb",
    venue_name: null,
    official_website: null,
    typical_month: null,
    typical_season: null,
    status: "published",
    verification_status: "verified",
  }],
}));
assert(canonicalCollision.blockers.includes("canonical_identity_exists"), "deterministic canonical match must block");

const promotedCandidate = structuredClone(slugCandidate);
promotedCandidate.slug_candidate = "different-slug";
promotedCandidate.matched_event_id = "00000000-0000-4000-8000-000000000009";
promotedCandidate.verification_status = "promoted";
const promotedCollision = preflightCountySeedRecord(first, snapshot({ candidates: [promotedCandidate] }));
assert(promotedCollision.blockers.includes("promoted_candidate_identity"), "promoted deterministic candidate must block");

const fuzzyOnly = preflightCountySeedRecord(first, snapshot({
  events: [{
    id: "00000000-0000-4000-8000-000000000010",
    name: "Blakes Lavendar Festival",
    slug: "similar-name",
    city: "Different City",
    county: "Macomb",
    venue_name: null,
    official_website: null,
    typical_month: null,
    typical_season: null,
    status: "published",
    verification_status: "verified",
  }],
}));
assert.equal(fuzzyOnly.action, "stage_new_candidate", "fuzzy similarity alone may not create a match");
assert(fuzzyOnly.warnings.includes("fuzzy_review_only"), "fuzzy similarity must remain a review warning");

const idempotentOperation = preflightCountySeedRecord(first, snapshot({
  operation_runs: [{
    id: "00000000-0000-4000-8000-000000000006",
    operation_type: "candidate_intake",
    idempotency_key: first.args.p_idempotency_key,
    status: "succeeded",
    request: { candidate: { county_seed: { payload_hash: first.payload_sha256 } } },
    summary: { candidate_id: equivalentCandidate.id },
  }],
}));
assert.equal(idempotentOperation.action, "no_op_equivalent", "successful same-hash operation must be an idempotent no-op");

const mismatchOperation = preflightCountySeedRecord(first, snapshot({
  operation_runs: [{
    id: "00000000-0000-4000-8000-000000000007",
    operation_type: "candidate_intake",
    idempotency_key: first.args.p_idempotency_key,
    status: "succeeded",
    request: { candidate: { county_seed: { payload_hash: "d".repeat(64) } } },
    summary: {},
  }],
}));
assert(mismatchOperation.blockers.includes("idempotency_payload_hash_mismatch"));

assert.throws(
  () => prepareCountySeedRecord({
    seed: seed({
      officialEventUrl: { original: null, normalized: null, identityKey: null },
    }),
    workbookFileName: "Macomb_County_Event_Inventory_Finalized.xlsx",
    inventoryName: "Macomb County Seed Inventory v1",
    batchId: BATCH_ID,
  }),
  /no official event URL/,
  "insufficient-information seeds must be rejected",
);

assert.equal(validateBatch0NoWriteCrosswalk({
  mode: "batch_0_crosswalk_only_no_write",
  records: [
    { clean_id: "MAC-001", action: "retain_seed_to_canonical_crosswalk_only", rpc: null, database_writes: [] },
    { clean_id: "MAC-050", action: "retain_seed_to_canonical_crosswalk_only", rpc: null, database_writes: [] },
  ],
}), true);
assert.throws(
  () => validateBatch0NoWriteCrosswalk({
    mode: "batch_0_crosswalk_only_no_write",
    records: [
      { clean_id: "MAC-001", action: "stage", rpc: "atlas_intake_event_candidate", database_writes: ["candidate"] },
      { clean_id: "MAC-050", action: "retain_seed_to_canonical_crosswalk_only", rpc: null, database_writes: [] },
    ],
  }),
  /may not define an RPC/,
  "Batch 0 write definitions must be rejected",
);

const dirty = structuredClone(manifestOne);
dirty.records[0].args.p_candidate.candidate_name = "Changed after review";
assert.throws(() => verifyManifestIntegrity(dirty), /Dirty manifest/);

const approved = approveManifest(manifestOne);
assert.throws(
  () => validateApplyAuthorization({ manifest: approved, confirmation: "wrong", allowExecution: true }),
  /Confirmation token/,
);
assert.equal(
  validateApplyAuthorization({
    manifest: approved,
    confirmation: approved.integrity.manifest_sha256,
    allowExecution: true,
  }),
  approved.integrity.manifest_sha256,
);

const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "county-seed-staging-"));
try {
  const auditPath = path.join(tempDirectory, "audit.jsonl");
  let writeCalls = 0;
  const replayResults = await executeGuardedCountySeedManifest({
    manifest: approved,
    confirmation: approved.integrity.manifest_sha256,
    auditPath,
    loadFreshPreflight: async () => ({
      ...equivalent,
      action: "no_op_equivalent",
      equivalent_candidate_id: equivalentCandidate.id,
    }),
    callGuardedRpc: async () => {
      writeCalls += 1;
      throw new Error("must not be called for equivalent replay");
    },
    now: () => CAPTURED_AT,
  });
  assert.equal(writeCalls, 0, "equivalent resume must not call the RPC");
  assert.equal(replayResults.at(-1)?.state, "idempotent_replay");

  const rejectedAudit = path.join(tempDirectory, "rejected.jsonl");
  await assert.rejects(
    executeGuardedCountySeedManifest({
      manifest: approved,
      confirmation: approved.integrity.manifest_sha256,
      auditPath: rejectedAudit,
      loadFreshPreflight: async () => preflightCountySeedRecord(first, snapshot()),
      callGuardedRpc: async () => {
        throw new CountySeedRpcRejectedError("fixture rejection", 409, true);
      },
      now: () => CAPTURED_AT,
    }),
    /fixture rejection/,
  );
  const rejectedStates = (await readFile(rejectedAudit, "utf8"))
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as { state: string })
    .map((entry) => entry.state);
  assert.deepEqual(
    rejectedStates,
    ["success_response_interrupted", "rpc_rejected", "confirmed_rollback"],
    "failure audit must survive independently of the rejected candidate transaction",
  );
} finally {
  await rm(tempDirectory, { recursive: true, force: true });
}

const preflightSource = await readFile(
  path.resolve("lib/county-seeds/stagingPreflight.ts"),
  "utf8",
);
assert.match(preflightSource, /method:\s*"GET"/, "preflight transport must be explicitly GET-only");
assert.doesNotMatch(preflightSource, /method:\s*"POST"/, "preflight transport may not contain a write method");
assert.doesNotMatch(preflightSource, /atlas_intake_event_candidate/, "preflight may not call candidate intake");

const committedBatch0 = JSON.parse(await readFile(
  path.resolve("artifacts/county-seeds/macomb/county-seed-batch-0-crosswalk.json"),
  "utf8",
));
assert.equal(validateBatch0NoWriteCrosswalk(committedBatch0), true);

const committedManifest = JSON.parse(await readFile(
  path.resolve("artifacts/county-seeds/macomb/county-seed-batch-1-staging-manifest.json"),
  "utf8",
)) as CountySeedBatchManifest;
assert.equal(verifyManifestIntegrity(committedManifest), committedManifest.integrity.manifest_sha256);
assert.deepEqual(
  committedManifest.records.map((record) => record.clean_id),
  ["MAC-003", "MAC-004", "MAC-008", "MAC-011", "MAC-041", "MAC-042", "MAC-049"],
);
assert(committedManifest.records.every((record) => record.status === "not_executed"));
assert(committedManifest.records.every((record) => record.eventual_candidate_id === null));
assert(committedManifest.records.every((record) => record.eligibility.execution_eligible === false));
assert.equal(committedManifest.execution.authorized, false);
assert.equal(committedManifest.required_schema_guard.deployed, false);
assert(
  committedManifest.records.find((record) => record.clean_id === "MAC-003")
    ?.preflight.warnings.includes("reviewed_seed_cohort_shared_organizer_or_venue"),
  "shared organizer/venue cohort must remain a warning",
);
assert(
  committedManifest.records.find((record) => record.clean_id === "MAC-008")
    ?.preflight.warnings.includes("reviewed_seed_cohort_shared_official_listing"),
  "shared official listing cohort must remain a warning",
);

const migration = await readFile(
  path.resolve("supabase/migrations/018_guard_county_seed_candidate_staging.sql"),
  "utf8",
);
assert.match(migration, /REVIEW-ONLY IN PHASE C1/);
assert.match(migration, /duplicate candidate slugs exist/);
assert.match(migration, /event_candidates_slug_candidate_uidx/);
assert.match(migration, /event_candidate_sources_candidate_url_uidx/);
assert.match(migration, /event_candidates_county_seed_identity_uidx/);
assert.match(migration, /atlas_stage_county_seed_candidate/);
assert.match(migration, /idempotency key has a different payload hash/);
assert.match(migration, /revoke execute[\s\S]+from public, anon, authenticated/i);

const compatibilityMigration = await readFile(
  path.resolve("supabase/migrations/019_allow_revised_county_seed_pilot_manifest.sql"),
  "utf8",
);
assert.match(compatibilityMigration, /v_match_count <> 1/);
assert.match(
  compatibilityMigration,
  /not in \(\s*'provisional_batch_1_manifest_only',\s*'revised_three_event_pilot_manifest_only'\s*\)/,
);
assert.match(compatibilityMigration, /execute v_definition/);
assert.match(
  compatibilityMigration,
  /revoke execute[\s\S]+from public, anon, authenticated/i,
);
assert.doesNotMatch(
  compatibilityMigration,
  /\b(create|alter|drop)\s+(table|index|policy|type|trigger)\b/i,
);

console.log(JSON.stringify({
  ok: true,
  tests: {
    stable_payload_hashes: true,
    deterministic_manifests: true,
    equivalence_no_op: true,
    mismatch_blocker: true,
    slug_collision: true,
    source_collision: true,
    canonical_match_rejection: true,
    promoted_candidate_rejection: true,
    fuzzy_warning_only: true,
    batch_0_no_write: true,
    insufficient_information_rejection: true,
    dirty_manifest_rejection: true,
    confirmation_token_validation: true,
    resumability: true,
    independent_failure_audit: true,
    preflight_transport_get_only: true,
    committed_artifact_integrity: true,
    proposed_migration_guards: true,
    migration_019_exact_scope_compatibility: true,
  },
  supabase_writes: 0,
}, null, 2));
