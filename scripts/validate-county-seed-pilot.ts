import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  MACOMB_FIRST_EVENT_PILOT_CLEAN_IDS,
  sha256Canonical,
  verifyManifestIntegrity,
  type CountySeedBatchManifest,
} from "../lib/county-seeds/staging.ts";

const MANIFEST_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-first-event-pilot-staging-manifest-v2.json",
);
const HISTORICAL_MANIFEST_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-batch-1-staging-manifest.json",
);
const HISTORICAL_MANIFEST_SHA256 = "d0203c6b9141f068a3a4c25ad6449ed641877117d7010fefabc535fb25bae9f2";
const EXPECTED_NAMES: Record<string, string> = {
  "MAC-026": "Memphis Festival Days",
  "MAC-042": "Bay-Rama Fishfly Festival",
  "MAC-049": "Richmond Good Old Days Festival",
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function payloadHash(record: CountySeedBatchManifest["records"][number]) {
  const candidate = structuredClone(record.args.p_candidate);
  delete candidate.county_seed.payload_hash;
  return sha256Canonical({
    contract_version: candidate.county_seed.contract_version,
    adapter_version: candidate.county_seed.adapter_version,
    rpc: record.rpc,
    p_idempotency_key: record.args.p_idempotency_key,
    p_candidate: candidate,
    p_sources: record.args.p_sources,
  });
}

function containsImageryField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsImageryField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => (
    /(^|_)(art|hero|image|imagery|media|visual)(_|$)/i.test(key)
    || containsImageryField(child)
  ));
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as CountySeedBatchManifest;
const historicalManifest = JSON.parse(
  await readFile(HISTORICAL_MANIFEST_PATH, "utf8"),
) as CountySeedBatchManifest;

const manifestSha256 = verifyManifestIntegrity(manifest);
assert(
  verifyManifestIntegrity(historicalManifest) === HISTORICAL_MANIFEST_SHA256,
  "The approved seven-event historical manifest changed.",
);
assert(historicalManifest.records.length === 7, "The historical preparation must retain seven records.");
assert(manifest.mode === "immutable_non_executed_batch_1_manifest", "Unexpected manifest mode.");
assert(manifest.execution.authorized === false, "Pilot execution must remain unauthorized.");
assert(manifest.required_schema_guard.deployed === false, "Migration 018 must remain undeployed.");
assert(manifest.pilot_scope?.designation === "macomb_first_event_pilot_v2", "Missing pilot scope.");
assert(
  manifest.pilot_scope.historical_preparation_retained.manifest_sha256 === HISTORICAL_MANIFEST_SHA256,
  "Pilot scope must retain the historical manifest identity.",
);
assert(
  manifest.pilot_scope.imagery_policy.automated_visual_workflow === "prohibited"
  && manifest.pilot_scope.imagery_policy.generated_or_placeholder_art === "prohibited"
  && manifest.pilot_scope.imagery_policy.ray_provided_approved_image_required_for_publication,
  "Pilot imagery policy is incomplete.",
);

const expectedIds = [...MACOMB_FIRST_EVENT_PILOT_CLEAN_IDS].sort();
const actualIds = manifest.records.map((record) => record.clean_id).sort();
assert(
  JSON.stringify(actualIds) === JSON.stringify(expectedIds),
  `Pilot manifest must contain only ${expectedIds.join(", ")}.`,
);

for (const record of manifest.records) {
  const candidate = record.args.p_candidate;
  const seed = candidate.county_seed;
  assert(candidate.candidate_name === EXPECTED_NAMES[record.clean_id], `Wrong event for ${record.clean_id}.`);
  assert(seed.source_sheet === "03_IMPORT_READY", `${record.clean_id} must retain 03_IMPORT_READY provenance.`);
  assert(record.status === "not_executed", `${record.clean_id} must remain unexecuted.`);
  assert(record.eventual_candidate_id === null, `${record.clean_id} may not have a candidate result.`);
  assert(record.approval.staging_execution === "not_authorized", `${record.clean_id} staging is unauthorized.`);
  assert(record.approval.publication === "not_authorized", `${record.clean_id} publication is unauthorized.`);
  assert(record.eligibility.execution_eligible === false, `${record.clean_id} may not be execution eligible.`);
  assert(record.preflight.method === "PostgREST GET only", `${record.clean_id} preflight must be GET-only.`);
  assert(record.payload_sha256 === payloadHash(record), `${record.clean_id} payload hash is unstable.`);
  assert(
    seed.payload_hash === record.payload_sha256,
    `${record.clean_id} embedded payload hash must match the record hash.`,
  );
  assert(!containsImageryField(record.args), `${record.clean_id} staging payload may not contain imagery fields.`);
  assert(record.pilot_review?.imagery_included === false, `${record.clean_id} must exclude imagery.`);
  assert(record.pilot_review.publication === "blocked", `${record.clean_id} publication must be blocked.`);
  assert(
    record.pilot_review.future_work.art === "Waiting for Ray-provided image.",
    `${record.clean_id} must retain the Ray-provided-image Art gate.`,
  );
  assert(
    Object.values(record.pilot_review.future_work)
      .every((value) => value === "pending" || value === "Waiting for Ray-provided image."),
    `${record.clean_id} future-work gates are incomplete.`,
  );
}

console.log(JSON.stringify({
  status: "passed",
  manifest: MANIFEST_PATH,
  manifest_sha256: manifestSha256,
  clean_ids: actualIds,
  historical_seven_event_manifest_retained: true,
  imagery_included: false,
  publication_blocked: true,
  supabase_writes: 0,
  batches_executed: 0,
}, null, 2));
