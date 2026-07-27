import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  approvedBayRamaRecord,
  BAY_RAMA_CANARY_CLEAN_ID,
  BAY_RAMA_CANARY_PAYLOAD_SHA256,
  MACOMB_PILOT_MANIFEST_PATH,
  MACOMB_PILOT_MANIFEST_SHA256,
  MIGRATION_018_SHA256,
  verifyCanaryAuthorization,
} from "../lib/county-seeds/canary.ts";
import {
  sha256Canonical,
  type CountySeedBatchManifest,
} from "../lib/county-seeds/staging.ts";

const MIGRATION_018_PATH = path.resolve(
  "supabase/migrations/018_guard_county_seed_candidate_staging.sql",
);
const MIGRATION_019_PATH = path.resolve(
  "supabase/migrations/019_allow_revised_county_seed_pilot_manifest.sql",
);
const AUTHORIZATION_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-authorization.json",
);
const AUDIT_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-audit.jsonl",
);
const VERIFICATION_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-verification.json",
);

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function sha256Bytes(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

const [migration018, migration019, manifestRaw] = await Promise.all([
  readFile(MIGRATION_018_PATH),
  readFile(MIGRATION_019_PATH, "utf8"),
  readFile(path.resolve(MACOMB_PILOT_MANIFEST_PATH), "utf8"),
]);
assert.equal(sha256Bytes(migration018), MIGRATION_018_SHA256);
assert.match(migration019, /019 requires the migration-018 county staging RPC/);
assert.match(migration019, /v_match_count <> 1/);
assert.match(
  migration019,
  /not in \(\s*'provisional_batch_1_manifest_only',\s*'revised_three_event_pilot_manifest_only'\s*\)/,
);
assert.match(migration019, /execute v_definition/);
assert.match(
  migration019,
  /revoke execute[\s\S]+from public, anon, authenticated/i,
);
assert.match(
  migration019,
  /grant execute[\s\S]+to service_role/i,
);
assert.doesNotMatch(
  migration019,
  /\b(create|alter|drop)\s+(table|index|policy|type|trigger)\b/i,
);
assert.doesNotMatch(
  migration019,
  /\b(insert\s+into|update\s+public\.|delete\s+from|truncate)\b/i,
);
assert.doesNotMatch(
  migration019,
  /(like|ilike|starts_with|regexp_replace)\s*\(/i,
  "Migration 019 must not broaden scope matching to prefixes or patterns.",
);

const manifest = JSON.parse(manifestRaw) as CountySeedBatchManifest;
const record = approvedBayRamaRecord(manifest);
assert.equal(record.clean_id, BAY_RAMA_CANARY_CLEAN_ID);
assert.equal(record.payload_sha256, BAY_RAMA_CANARY_PAYLOAD_SHA256);
assert.equal(manifest.integrity.manifest_sha256, MACOMB_PILOT_MANIFEST_SHA256);

const authorizationPresent = await exists(AUTHORIZATION_PATH);
const auditPresent = await exists(AUDIT_PATH);
const verificationPresent = await exists(VERIFICATION_PATH);
if (auditPresent || verificationPresent) {
  assert(authorizationPresent, "Canary execution evidence requires its authorization artifact.");
}
if (auditPresent !== verificationPresent) {
  throw new Error("Canary audit and verification artifacts must be retained together.");
}

let authorizationSha256: string | null = null;
if (authorizationPresent) {
  const authorization = verifyCanaryAuthorization(JSON.parse(
    await readFile(AUTHORIZATION_PATH, "utf8"),
  ));
  authorizationSha256 = authorization.integrity.authorization_sha256;
  assert.equal(
    authorization.deployed_guards[1].sha256,
    sha256Bytes(migration019),
  );
  assert.deepEqual(authorization.authorization.allowed_clean_ids, [BAY_RAMA_CANARY_CLEAN_ID]);
  assert.equal(authorization.authorization.full_manifest_execution, false);
  assert(Object.values(authorization.prohibited).every(Boolean));

  if (auditPresent && verificationPresent) {
    const auditLines = (await readFile(AUDIT_PATH, "utf8"))
      .trim()
      .split(/\r?\n/)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    assert.deepEqual(
      auditLines.map((entry) => entry.state),
      [
        "authorization_verified",
        "fresh_preflight_passed",
        "success_response_interrupted",
        "succeeded",
        "success_response_interrupted",
        "idempotent_replay",
        "equivalence_conflict",
        "confirmed_rollback",
        "verification_passed",
      ],
    );
    assert(auditLines.every((entry) => entry.clean_id === BAY_RAMA_CANARY_CLEAN_ID));
    assert(auditLines.every((entry) => entry.manifest_sha256 === MACOMB_PILOT_MANIFEST_SHA256));
    assert(auditLines.every((entry) => entry.authorization_sha256 === authorizationSha256));

    const verification = JSON.parse(
      await readFile(VERIFICATION_PATH, "utf8"),
    ) as Record<string, unknown> & {
      before_counts: Record<string, number>;
      after_counts: Record<string, number>;
      exact_replay: Record<string, unknown>;
      conflicting_replay: Record<string, unknown>;
      protected_outcomes: Record<string, unknown>;
      integrity: { algorithm: string; verification_sha256: string };
    };
    const storedVerificationHash = verification.integrity.verification_sha256;
    assert.equal(
      storedVerificationHash,
      sha256Canonical({
        ...verification,
        integrity: {
          ...verification.integrity,
          verification_sha256: "",
        },
      }),
    );
    assert.equal(verification.authorization_sha256, authorizationSha256);
    assert.equal(verification.manifest_sha256, MACOMB_PILOT_MANIFEST_SHA256);
    assert.equal(verification.payload_sha256, BAY_RAMA_CANARY_PAYLOAD_SHA256);
    assert.equal(verification.exact_replay.idempotent_replay, true);
    assert.equal(verification.exact_replay.duplicate_rows_created, false);
    assert.equal(verification.conflicting_replay.rejected, true);
    assert.equal(verification.conflicting_replay.transaction_rolled_back, true);
    assert.equal(verification.protected_outcomes.richmond_mac_049_unstaged, true);
    assert.equal(verification.protected_outcomes.memphis_mac_026_unstaged, true);
    assert.equal(verification.protected_outcomes.canonical_event_created, false);
    assert.equal(verification.protected_outcomes.publication_created, false);
    assert.equal(
      verification.protected_outcomes.event_hub_or_factory_package_created,
      false,
    );
    assert.equal(
      verification.protected_outcomes.image_or_placeholder_art_created,
      false,
    );
    for (const table of [
      "discovery_runs",
      "event_candidates",
      "event_candidate_sources",
      "atlas_operation_runs",
      "atlas_operation_actions",
    ]) {
      assert.equal(
        verification.after_counts[table],
        verification.before_counts[table] + 1,
      );
    }
    assert.equal(verification.after_counts.events, verification.before_counts.events);
    assert.equal(
      verification.after_counts.matched_candidates,
      verification.before_counts.matched_candidates,
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  migration_019_sha256: sha256Bytes(migration019),
  migration_scope_values: [
    "provisional_batch_1_manifest_only",
    "revised_three_event_pilot_manifest_only",
  ],
  immutable_manifest_sha256: MACOMB_PILOT_MANIFEST_SHA256,
  canary_payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
  authorization_artifact: authorizationPresent ? "valid" : "not_yet_prepared",
  execution_audit: auditPresent ? "valid" : "not_yet_executed",
  verification_artifact: verificationPresent ? "valid" : "not_yet_executed",
}, null, 2));
