import {
  sha256Canonical,
  verifyManifestIntegrity,
  type CountySeedBatchManifest,
  type CountySeedManifestRecord,
} from "./staging.ts";

export const BAY_RAMA_CANARY_CLEAN_ID = "MAC-042";
export const BAY_RAMA_CANARY_EVENT_NAME = "Bay-Rama Fishfly Festival";
export const BAY_RAMA_CANARY_PAYLOAD_SHA256 =
  "8672985d675e18749bec93030b4b2f13eda7df7a4f73d398e453d5a2fc3f6594";
export const MACOMB_PILOT_MANIFEST_SHA256 =
  "d2d1c245c1c8ac4abea3a1fef1e21a9ab8da2adf7a05d0db6c8bfbaba3079fd8";
export const MACOMB_PILOT_MANIFEST_PATH =
  "artifacts/county-seeds/macomb/county-seed-first-event-pilot-staging-manifest-v2.json";
export const MIGRATION_018_SHA256 =
  "b96691f274c93a5e9b08d93e44a51cc836411f263ce780ab1b3b002826879675";
export const MIGRATION_019_FILE =
  "019_allow_revised_county_seed_pilot_manifest.sql";

export type CanaryApplicationCounts = {
  discovery_runs: number;
  event_candidates: number;
  event_candidate_sources: number;
  atlas_operation_runs: number;
  atlas_operation_actions: number;
  events: number;
  matched_candidates: number;
};

export type CountySeedCanaryAuthorization = {
  contract_version: 1;
  mode: "single_record_county_seed_canary_authorization";
  authorization_id: "county-seed:macomb:canary:MAC-042:v1";
  authorized_at: string;
  manifest: {
    path: typeof MACOMB_PILOT_MANIFEST_PATH;
    sha256: typeof MACOMB_PILOT_MANIFEST_SHA256;
    immutable: true;
  };
  canary: {
    clean_id: typeof BAY_RAMA_CANARY_CLEAN_ID;
    event_name: typeof BAY_RAMA_CANARY_EVENT_NAME;
    payload_sha256: typeof BAY_RAMA_CANARY_PAYLOAD_SHA256;
  };
  deployed_guards: [
    {
      version: "018";
      file: "018_guard_county_seed_candidate_staging.sql";
      sha256: typeof MIGRATION_018_SHA256;
    },
    {
      version: "019";
      file: typeof MIGRATION_019_FILE;
      sha256: string;
    },
  ];
  baseline_counts: CanaryApplicationCounts;
  authorization: {
    staging: "authorized";
    allowed_clean_ids: [typeof BAY_RAMA_CANARY_CLEAN_ID];
    full_manifest_execution: false;
    exact_replay_verification: true;
    conflicting_replay_verification: true;
    uncertain_result_policy: "stop_and_reconcile_before_retry";
  };
  prohibited: {
    richmond_staging: true;
    memphis_staging: true;
    event_research: true;
    current_edition_synthesis: true;
    event_hub_generation: true;
    image_generation_or_search: true;
    canonical_promotion: true;
    publication: true;
  };
  integrity: {
    algorithm: "sha256";
    authorization_sha256: string;
  };
};

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function canaryAuthorizationHash(
  authorization: CountySeedCanaryAuthorization,
) {
  const copy = structuredClone(authorization);
  copy.integrity.authorization_sha256 = "";
  return sha256Canonical(copy);
}

export function verifyCanaryAuthorization(
  value: unknown,
): CountySeedCanaryAuthorization {
  const root = object(value);
  if (!root) throw new Error("Canary authorization must be a JSON object.");
  const authorization = value as CountySeedCanaryAuthorization;
  const actualHash = canaryAuthorizationHash(authorization);

  if (
    authorization.contract_version !== 1
    || authorization.mode !== "single_record_county_seed_canary_authorization"
    || authorization.authorization_id !== "county-seed:macomb:canary:MAC-042:v1"
  ) {
    throw new Error("Unexpected county-seed canary authorization contract.");
  }
  if (authorization.integrity?.authorization_sha256 !== actualHash) {
    throw new Error(
      `Dirty canary authorization: expected ${authorization.integrity?.authorization_sha256}, calculated ${actualHash}.`,
    );
  }
  if (
    authorization.manifest.path !== MACOMB_PILOT_MANIFEST_PATH
    || authorization.manifest.sha256 !== MACOMB_PILOT_MANIFEST_SHA256
    || authorization.manifest.immutable !== true
  ) {
    throw new Error("Canary authorization does not bind the approved immutable pilot manifest.");
  }
  if (
    authorization.canary.clean_id !== BAY_RAMA_CANARY_CLEAN_ID
    || authorization.canary.event_name !== BAY_RAMA_CANARY_EVENT_NAME
    || authorization.canary.payload_sha256 !== BAY_RAMA_CANARY_PAYLOAD_SHA256
  ) {
    throw new Error("Canary authorization does not bind the approved Bay-Rama payload.");
  }
  if (
    authorization.deployed_guards.length !== 2
    || authorization.deployed_guards[0]?.version !== "018"
    || authorization.deployed_guards[0]?.sha256 !== MIGRATION_018_SHA256
    || authorization.deployed_guards[1]?.version !== "019"
    || authorization.deployed_guards[1]?.file !== MIGRATION_019_FILE
    || !/^[0-9a-f]{64}$/.test(authorization.deployed_guards[1]?.sha256 ?? "")
  ) {
    throw new Error("Canary authorization does not bind exactly migrations 018 and 019.");
  }
  if (
    authorization.authorization.staging !== "authorized"
    || authorization.authorization.allowed_clean_ids.length !== 1
    || authorization.authorization.allowed_clean_ids[0] !== BAY_RAMA_CANARY_CLEAN_ID
    || authorization.authorization.full_manifest_execution !== false
    || authorization.authorization.exact_replay_verification !== true
    || authorization.authorization.conflicting_replay_verification !== true
    || authorization.authorization.uncertain_result_policy !== "stop_and_reconcile_before_retry"
  ) {
    throw new Error("Canary authorization is not limited to the approved single-record execution.");
  }
  if (Object.values(authorization.prohibited).some((blocked) => blocked !== true)) {
    throw new Error("Canary authorization must retain every non-staging prohibition.");
  }
  if (
    !authorization.authorized_at
    || Number.isNaN(Date.parse(authorization.authorized_at))
    || Object.values(authorization.baseline_counts)
      .some((count) => !Number.isInteger(count) || count < 0)
  ) {
    throw new Error("Canary authorization has invalid timestamp or baseline counts.");
  }
  return authorization;
}

export function approvedBayRamaRecord(
  manifest: CountySeedBatchManifest,
): CountySeedManifestRecord {
  const manifestHash = verifyManifestIntegrity(manifest);
  if (manifestHash !== MACOMB_PILOT_MANIFEST_SHA256) {
    throw new Error("Canary execution requires the exact approved immutable pilot manifest.");
  }
  const manifestIds = manifest.records.map((record) => record.clean_id).sort();
  if (
    manifestIds.length !== 3
    || manifestIds.join(",") !== ["MAC-026", "MAC-042", "MAC-049"].join(",")
  ) {
    throw new Error("Approved pilot manifest membership changed.");
  }
  const record = manifest.records.find(
    (candidate) => candidate.clean_id === BAY_RAMA_CANARY_CLEAN_ID,
  );
  if (
    !record
    || record.payload_sha256 !== BAY_RAMA_CANARY_PAYLOAD_SHA256
    || record.args.p_candidate.candidate_name !== BAY_RAMA_CANARY_EVENT_NAME
    || record.args.p_candidate.county_seed.resolved_decision.phase_c1_disposition
      !== "revised_three_event_pilot_manifest_only"
  ) {
    throw new Error("Approved Bay-Rama record or payload changed.");
  }
  return record;
}

export function authorizedBayRamaRecord(args: {
  manifest: CountySeedBatchManifest;
  authorization: CountySeedCanaryAuthorization;
}): CountySeedManifestRecord {
  const authorization = verifyCanaryAuthorization(args.authorization);
  const record = approvedBayRamaRecord(args.manifest);
  if (authorization.manifest.sha256 !== MACOMB_PILOT_MANIFEST_SHA256) {
    throw new Error("Canary authorization and immutable manifest do not match.");
  }
  return record;
}
