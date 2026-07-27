import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  approvedBayRamaRecord,
  BAY_RAMA_CANARY_CLEAN_ID,
  BAY_RAMA_CANARY_EVENT_NAME,
  BAY_RAMA_CANARY_PAYLOAD_SHA256,
  canaryAuthorizationHash,
  MACOMB_PILOT_MANIFEST_PATH,
  MACOMB_PILOT_MANIFEST_SHA256,
  MIGRATION_018_SHA256,
  type CanaryApplicationCounts,
  type CountySeedCanaryAuthorization,
} from "../lib/county-seeds/canary.ts";
import {
  preflightCountySeedRecord,
  type CountySeedBatchManifest,
} from "../lib/county-seeds/staging.ts";
import { loadCountySeedPreflightSnapshot } from "../lib/county-seeds/stagingPreflight.ts";

const OUTPUT_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-authorization.json",
);
const MIGRATION_018_PATH = path.resolve(
  "supabase/migrations/018_guard_county_seed_candidate_staging.sql",
);
const MIGRATION_019_PATH = path.resolve(
  "supabase/migrations/019_allow_revised_county_seed_pilot_manifest.sql",
);

function parseArgs(argv: string[]) {
  let authorizedAt = new Date().toISOString();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--authorized-at") authorizedAt = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (Number.isNaN(Date.parse(authorizedAt))) {
    throw new Error("--authorized-at must be an ISO timestamp.");
  }
  return { authorizedAt };
}

function sha256Bytes(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function requireConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Canary authorization requires configured Supabase read credentials.");
  return { url: url.replace(/\/+$/, ""), key };
}

async function getRows<T>(table: string, select = "id"): Promise<T[]> {
  const { url, key } = requireConnection();
  const endpoint = new URL(`${url}/rest/v1/${table}`);
  endpoint.searchParams.set("select", select);
  endpoint.searchParams.set("limit", "5000");
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  if (!response.ok) throw new Error(`Read-only ${table} baseline query failed with ${response.status}.`);
  return response.json() as Promise<T[]>;
}

const args = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(
  await readFile(path.resolve(MACOMB_PILOT_MANIFEST_PATH), "utf8"),
) as CountySeedBatchManifest;
const migration018Hash = sha256Bytes(await readFile(MIGRATION_018_PATH));
const migration019Hash = sha256Bytes(await readFile(MIGRATION_019_PATH));
if (migration018Hash !== MIGRATION_018_SHA256) {
  throw new Error(`Migration 018 hash changed: ${migration018Hash}.`);
}

const record = approvedBayRamaRecord(manifest);
const snapshot = await loadCountySeedPreflightSnapshot(args.authorizedAt);
if (!snapshot.schema_guard.guarded_rpc_visible) {
  throw new Error("The guarded county-seed RPC is not visible in deployed PostgREST.");
}
const preflight = preflightCountySeedRecord(record, snapshot);
if (preflight.action !== "stage_new_candidate" || preflight.blockers.length) {
  throw new Error(`Bay-Rama canary preflight is not clear: ${preflight.blockers.join(", ")}.`);
}
if (snapshot.candidates.some((candidate) => (
  (candidate.raw_payload as { county_seed?: { clean_id?: string } } | null)
    ?.county_seed?.clean_id
  === BAY_RAMA_CANARY_CLEAN_ID
))) {
  throw new Error("Bay-Rama already has a county-seed candidate.");
}

const [discoveryRuns, operationActions] = await Promise.all([
  getRows("discovery_runs"),
  getRows("atlas_operation_actions"),
]);
const baselineCounts: CanaryApplicationCounts = {
  discovery_runs: discoveryRuns.length,
  event_candidates: snapshot.candidates.length,
  event_candidate_sources: snapshot.sources.length,
  atlas_operation_runs: snapshot.operation_runs.length,
  atlas_operation_actions: operationActions.length,
  events: snapshot.events.length,
  matched_candidates: snapshot.candidates.filter((candidate) => candidate.matched_event_id).length,
};
const authorization: CountySeedCanaryAuthorization = {
  contract_version: 1,
  mode: "single_record_county_seed_canary_authorization",
  authorization_id: "county-seed:macomb:canary:MAC-042:v1",
  authorized_at: args.authorizedAt,
  manifest: {
    path: MACOMB_PILOT_MANIFEST_PATH,
    sha256: MACOMB_PILOT_MANIFEST_SHA256,
    immutable: true,
  },
  canary: {
    clean_id: BAY_RAMA_CANARY_CLEAN_ID,
    event_name: BAY_RAMA_CANARY_EVENT_NAME,
    payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
  },
  deployed_guards: [
    {
      version: "018",
      file: "018_guard_county_seed_candidate_staging.sql",
      sha256: MIGRATION_018_SHA256,
    },
    {
      version: "019",
      file: "019_allow_revised_county_seed_pilot_manifest.sql",
      sha256: migration019Hash,
    },
  ],
  baseline_counts: baselineCounts,
  authorization: {
    staging: "authorized",
    allowed_clean_ids: [BAY_RAMA_CANARY_CLEAN_ID],
    full_manifest_execution: false,
    exact_replay_verification: true,
    conflicting_replay_verification: true,
    uncertain_result_policy: "stop_and_reconcile_before_retry",
  },
  prohibited: {
    richmond_staging: true,
    memphis_staging: true,
    event_research: true,
    current_edition_synthesis: true,
    event_hub_generation: true,
    image_generation_or_search: true,
    canonical_promotion: true,
    publication: true,
  },
  integrity: {
    algorithm: "sha256",
    authorization_sha256: "",
  },
};
authorization.integrity.authorization_sha256 = canaryAuthorizationHash(authorization);
await writeFile(OUTPUT_PATH, `${JSON.stringify(authorization, null, 2)}\n`, "utf8");

console.log(JSON.stringify({
  mode: "read_only_canary_authorization_preparation",
  authorization_path: OUTPUT_PATH,
  authorization_sha256: authorization.integrity.authorization_sha256,
  migration_019_sha256: migration019Hash,
  manifest_sha256: MACOMB_PILOT_MANIFEST_SHA256,
  clean_id: BAY_RAMA_CANARY_CLEAN_ID,
  event_name: BAY_RAMA_CANARY_EVENT_NAME,
  payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
  baseline_counts: baselineCounts,
  supabase_writes: 0,
}, null, 2));
