import { createHash } from "node:crypto";
import { open, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  authorizedBayRamaRecord,
  BAY_RAMA_CANARY_CLEAN_ID,
  BAY_RAMA_CANARY_PAYLOAD_SHA256,
  type CanaryApplicationCounts,
  type CountySeedCanaryAuthorization,
  MACOMB_PILOT_MANIFEST_PATH,
  MACOMB_PILOT_MANIFEST_SHA256,
  verifyCanaryAuthorization,
} from "../lib/county-seeds/canary.ts";
import {
  preflightCountySeedRecord,
  sha256Canonical,
  type CountySeedBatchManifest,
  type CountySeedManifestRecord,
} from "../lib/county-seeds/staging.ts";
import type { GuardedRpcResult } from "../lib/county-seeds/stagingApply.ts";
import { loadCountySeedPreflightSnapshot } from "../lib/county-seeds/stagingPreflight.ts";

const AUTHORIZATION_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-authorization.json",
);
const AUDIT_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-audit.jsonl",
);
const VERIFICATION_PATH = path.resolve(
  "artifacts/county-seeds/macomb/county-seed-bay-rama-canary-verification.json",
);
const MIGRATION_019_PATH = path.resolve(
  "supabase/migrations/019_allow_revised_county_seed_pilot_manifest.sql",
);

type Mode = "preflight" | "apply";

type CanaryAuditState =
  | "authorization_verified"
  | "fresh_preflight_passed"
  | "success_response_interrupted"
  | "succeeded"
  | "idempotent_replay"
  | "equivalence_conflict"
  | "confirmed_rollback"
  | "rpc_rejected"
  | "network_uncertainty"
  | "verification_passed";

type CanaryAuditEntry = {
  at: string;
  authorization_sha256: string;
  manifest_sha256: typeof MACOMB_PILOT_MANIFEST_SHA256;
  payload_sha256: string;
  clean_id: typeof BAY_RAMA_CANARY_CLEAN_ID;
  operation: "authorization" | "preflight" | "initial_apply" | "exact_replay" | "conflicting_replay" | "verification";
  state: CanaryAuditState;
  candidate_id: string | null;
  operation_run_id: string | null;
  action_id: string | null;
  detail: string;
  retry: "not_needed" | "blocked" | "reconcile_before_retry";
};

type CandidateRow = {
  id: string;
  discovery_run_id: string;
  candidate_name: string;
  normalized_name: string;
  slug_candidate: string | null;
  city: string | null;
  official_website_candidate: string | null;
  verification_status: string;
  matched_event_id: string | null;
  needs_review: boolean;
  raw_payload: Record<string, unknown> | null;
};

type SourceRow = {
  id: string;
  candidate_id: string;
  source_name: string;
  source_url: string;
  source_type: string | null;
};

type OperationRow = {
  id: string;
  operation_type: string;
  actor_type: string;
  actor_identity: string;
  idempotency_key: string;
  status: string;
  request: Record<string, unknown>;
  summary: Record<string, unknown>;
};

type ActionRow = {
  id: string;
  operation_run_id: string;
  action_type: string;
  lifecycle_state: string;
  target_entity_type: string | null;
  target_entity_id: string | null;
  requested_payload: Record<string, unknown> | null;
};

type DiscoveryRunRow = {
  id: string;
  run_type: string;
  status: string;
  items_found: number;
  candidates_created: number;
  run_metadata: Record<string, unknown>;
};

class ConfirmedRpcRejection extends Error {
  readonly responseStatus: number;
  readonly databaseCode: string | null;

  constructor(message: string, responseStatus: number, databaseCode: string | null) {
    super(message);
    this.name = "ConfirmedRpcRejection";
    this.responseStatus = responseStatus;
    this.databaseCode = databaseCode;
  }
}

function parseArgs(argv: string[]) {
  let mode: Mode = "preflight";
  let confirmation: string | null = null;
  let actorIdentity: string | null = null;
  let sawPreflight = false;
  let sawApply = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preflight") {
      sawPreflight = true;
      mode = "preflight";
    } else if (arg === "--apply") {
      sawApply = true;
      mode = "apply";
    } else if (arg === "--confirm") {
      confirmation = argv[++index] ?? null;
    } else if (arg === "--actor") {
      actorIdentity = argv[++index] ?? null;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (sawPreflight && sawApply) throw new Error("Choose --preflight or --apply, not both.");
  if (mode === "preflight" && (confirmation || actorIdentity)) {
    throw new Error("--confirm and --actor are accepted only with --apply.");
  }
  if (mode === "apply" && (!confirmation || !actorIdentity)) {
    throw new Error("--apply requires --confirm <authorization-sha256> and --actor <allowlisted email>.");
  }
  return { mode, confirmation, actorIdentity };
}

function sha256Bytes(value: Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedString(value: unknown, keys: string[]) {
  let current: unknown = value;
  for (const key of keys) current = object(current)?.[key];
  return typeof current === "string" ? current : null;
}

function requireConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
    || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Bay-Rama canary requires configured Supabase credentials.");
  return { url: url.replace(/\/+$/, ""), key };
}

function requireAllowlistedActor(actorIdentity: string | null) {
  if (!actorIdentity) throw new Error("The canary requires an explicit actor identity.");
  const allowed = (process.env.ATLAS_ADMIN_EMAILS ?? "")
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (!allowed.includes(actorIdentity.trim().toLowerCase())) {
    throw new Error("The canary actor is not present in ATLAS_ADMIN_EMAILS.");
  }
  return actorIdentity.trim().toLowerCase();
}

async function getRows<T>(table: string, select: string): Promise<T[]> {
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
  if (!response.ok) {
    throw new Error(`GET-only ${table} verification failed with ${response.status}.`);
  }
  return response.json() as Promise<T[]>;
}

async function loadApplicationCounts(): Promise<CanaryApplicationCounts> {
  const snapshot = await loadCountySeedPreflightSnapshot();
  const [discoveryRuns, operationActions] = await Promise.all([
    getRows<{ id: string }>("discovery_runs", "id"),
    getRows<{ id: string }>("atlas_operation_actions", "id"),
  ]);
  return {
    discovery_runs: discoveryRuns.length,
    event_candidates: snapshot.candidates.length,
    event_candidate_sources: snapshot.sources.length,
    atlas_operation_runs: snapshot.operation_runs.length,
    atlas_operation_actions: operationActions.length,
    events: snapshot.events.length,
    matched_candidates: snapshot.candidates.filter((row) => row.matched_event_id).length,
  };
}

function assertCountsEqual(
  actual: CanaryApplicationCounts,
  expected: CanaryApplicationCounts,
  label: string,
) {
  for (const key of Object.keys(expected) as Array<keyof CanaryApplicationCounts>) {
    if (actual[key] !== expected[key]) {
      throw new Error(`${label} ${key}: expected ${expected[key]}, received ${actual[key]}.`);
    }
  }
}

async function appendAudit(entry: CanaryAuditEntry) {
  const handle = await open(AUDIT_PATH, "a");
  try {
    await handle.appendFile(`${JSON.stringify(entry)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function auditEntry(args: {
  authorization: CountySeedCanaryAuthorization;
  operation: CanaryAuditEntry["operation"];
  state: CanaryAuditState;
  result?: GuardedRpcResult;
  payloadSha256?: string;
  detail: string;
}): CanaryAuditEntry {
  const uncertain = args.state === "success_response_interrupted"
    || args.state === "network_uncertainty";
  return {
    at: new Date().toISOString(),
    authorization_sha256: args.authorization.integrity.authorization_sha256,
    manifest_sha256: MACOMB_PILOT_MANIFEST_SHA256,
    payload_sha256: args.payloadSha256 ?? BAY_RAMA_CANARY_PAYLOAD_SHA256,
    clean_id: BAY_RAMA_CANARY_CLEAN_ID,
    operation: args.operation,
    state: args.state,
    candidate_id: args.result?.candidate_id ?? null,
    operation_run_id: args.result?.operation_run_id ?? null,
    action_id: args.result?.action_id ?? null,
    detail: args.detail,
    retry: uncertain ? "reconcile_before_retry" : args.state === "rpc_rejected"
      || args.state === "equivalence_conflict"
      || args.state === "confirmed_rollback"
        ? "blocked"
        : "not_needed",
  };
}

async function callGuardedRpc(args: {
  record: CountySeedManifestRecord;
  actorIdentity: string;
  payloadSha256?: string;
  candidate?: CountySeedManifestRecord["args"]["p_candidate"];
}): Promise<GuardedRpcResult> {
  const { url, key } = requireConnection();
  const payloadSha256 = args.payloadSha256 ?? args.record.payload_sha256;
  const response = await fetch(`${url}/rest/v1/rpc/atlas_stage_county_seed_candidate`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_actor_identity: args.actorIdentity,
      p_batch_id: args.record.args.p_candidate.county_seed.batch_id,
      p_manifest_hash: MACOMB_PILOT_MANIFEST_SHA256,
      p_payload_hash: payloadSha256,
      p_idempotency_key: args.record.args.p_idempotency_key,
      p_candidate: args.candidate ?? args.record.args.p_candidate,
      p_sources: args.record.args.p_sources,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const body = object(payload);
    const message = typeof body?.message === "string"
      ? body.message
      : `Guarded county staging RPC rejected with status ${response.status}.`;
    const code = typeof body?.code === "string" ? body.code : null;
    throw new ConfirmedRpcRejection(message, response.status, code);
  }
  return payload as GuardedRpcResult;
}

async function verifyCreatedRecords(args: {
  authorization: CountySeedCanaryAuthorization;
  record: CountySeedManifestRecord;
  initial: GuardedRpcResult;
  replay: GuardedRpcResult;
  conflictSha256: string;
}) {
  const [
    candidates,
    sources,
    operations,
    actions,
    discoveryRuns,
    visualWorkflows,
    packages,
  ] = await Promise.all([
    getRows<CandidateRow>(
      "event_candidates",
      "id,discovery_run_id,candidate_name,normalized_name,slug_candidate,city,official_website_candidate,verification_status,matched_event_id,needs_review,raw_payload",
    ),
    getRows<SourceRow>(
      "event_candidate_sources",
      "id,candidate_id,source_name,source_url,source_type",
    ),
    getRows<OperationRow>(
      "atlas_operation_runs",
      "id,operation_type,actor_type,actor_identity,idempotency_key,status,request,summary",
    ),
    getRows<ActionRow>(
      "atlas_operation_actions",
      "id,operation_run_id,action_type,lifecycle_state,target_entity_type,target_entity_id,requested_payload",
    ),
    getRows<DiscoveryRunRow>(
      "discovery_runs",
      "id,run_type,status,items_found,candidates_created,run_metadata",
    ),
    getRows<{ id: string; candidate_id: string }>(
      "event_visual_workflows",
      "id,candidate_id",
    ),
    getRows<{ id: string; candidate_id: string; status: string }>(
      "event_factory_packages",
      "id,candidate_id,status",
    ),
  ]);
  const countyCandidates = candidates.filter((candidate) => (
    nestedString(candidate.raw_payload, ["county_seed", "county_code"])?.toLowerCase() === "macomb"
  ));
  const bayCandidates = countyCandidates.filter((candidate) => (
    nestedString(candidate.raw_payload, ["county_seed", "clean_id"]) === BAY_RAMA_CANARY_CLEAN_ID
  ));
  if (bayCandidates.length !== 1) throw new Error(`Expected exactly one MAC-042 candidate, found ${bayCandidates.length}.`);
  const candidate = bayCandidates[0]!;
  if (
    candidate.id !== args.initial.candidate_id
    || candidate.id !== args.replay.candidate_id
    || candidate.candidate_name !== args.record.args.p_candidate.candidate_name
    || candidate.slug_candidate !== args.record.args.p_candidate.slug_candidate
    || candidate.city !== args.record.args.p_candidate.city
    || candidate.official_website_candidate !== args.record.args.p_candidate.official_website_candidate
    || candidate.matched_event_id !== null
    || candidate.verification_status !== "needs_review"
    || candidate.needs_review !== true
    || nestedString(candidate.raw_payload, ["county_seed", "payload_hash"]) !== BAY_RAMA_CANARY_PAYLOAD_SHA256
    || nestedString(candidate.raw_payload, ["county_seed", "manifest_hash"]) !== MACOMB_PILOT_MANIFEST_SHA256
    || nestedString(candidate.raw_payload, ["county_seed", "batch_id"])
      !== args.record.args.p_candidate.county_seed.batch_id
  ) {
    throw new Error("The staged MAC-042 candidate does not match the authorized payload and provenance.");
  }
  const forbiddenCandidates = countyCandidates.filter((row) => (
    ["MAC-026", "MAC-049"].includes(
      nestedString(row.raw_payload, ["county_seed", "clean_id"]) ?? "",
    )
  ));
  if (forbiddenCandidates.length) throw new Error("Richmond or Memphis was staged.");
  if (candidates.filter((row) => row.slug_candidate === candidate.slug_candidate).length !== 1) {
    throw new Error("Bay-Rama candidate slug is duplicated.");
  }
  const candidateSources = sources.filter((source) => source.candidate_id === candidate.id);
  if (
    candidateSources.length !== 1
    || candidateSources[0]?.source_url !== args.record.args.p_sources[0]?.source_url
    || candidateSources[0]?.source_type !== "official"
  ) {
    throw new Error("Bay-Rama candidate/source relationship is missing or duplicated.");
  }
  const operation = operations.find((row) => row.id === args.initial.operation_run_id);
  if (
    !operation
    || operation.id !== args.replay.operation_run_id
    || operation.operation_type !== "candidate_intake"
    || operation.idempotency_key !== args.record.args.p_idempotency_key
    || operation.status !== "succeeded"
    || nestedString(operation.request, ["candidate", "county_seed", "payload_hash"])
      !== BAY_RAMA_CANARY_PAYLOAD_SHA256
    || nestedString(operation.summary, ["candidate_id"]) !== candidate.id
  ) {
    throw new Error("Bay-Rama operation audit row is incomplete or inconsistent.");
  }
  const operationActions = actions.filter((action) => action.operation_run_id === operation.id);
  if (
    operationActions.length !== 1
    || operationActions[0]?.id !== args.initial.action_id
    || operationActions[0]?.action_type !== "candidate_intake"
    || operationActions[0]?.lifecycle_state !== "applied"
    || operationActions[0]?.target_entity_type !== "event_candidate"
    || operationActions[0]?.target_entity_id !== candidate.id
  ) {
    throw new Error("Bay-Rama operation action is missing, duplicated, or unapplied.");
  }
  const discoveryRun = discoveryRuns.find((run) => run.id === candidate.discovery_run_id);
  if (
    !discoveryRun
    || discoveryRun.run_type !== "control_plane_intake"
    || discoveryRun.status !== "completed"
    || discoveryRun.items_found !== 1
    || discoveryRun.candidates_created !== 1
    || nestedString(discoveryRun.run_metadata, ["operation_run_id"]) !== operation.id
  ) {
    throw new Error("Bay-Rama discovery-run record is missing or inconsistent.");
  }
  if (visualWorkflows.some((row) => row.candidate_id === candidate.id)) {
    throw new Error("The canary unexpectedly created a visual workflow.");
  }
  if (packages.some((row) => row.candidate_id === candidate.id)) {
    throw new Error("The canary unexpectedly created Event Factory or Event Hub content.");
  }
  const afterCounts = await loadApplicationCounts();
  const expectedCounts: CanaryApplicationCounts = {
    discovery_runs: args.authorization.baseline_counts.discovery_runs + 1,
    event_candidates: args.authorization.baseline_counts.event_candidates + 1,
    event_candidate_sources: args.authorization.baseline_counts.event_candidate_sources + 1,
    atlas_operation_runs: args.authorization.baseline_counts.atlas_operation_runs + 1,
    atlas_operation_actions: args.authorization.baseline_counts.atlas_operation_actions + 1,
    events: args.authorization.baseline_counts.events,
    matched_candidates: args.authorization.baseline_counts.matched_candidates,
  };
  assertCountsEqual(afterCounts, expectedCounts, "Post-canary count mismatch for");

  const verification = {
    contract_version: 1,
    mode: "bay_rama_county_seed_canary_verification",
    verified_at: new Date().toISOString(),
    authorization_sha256: args.authorization.integrity.authorization_sha256,
    manifest_sha256: MACOMB_PILOT_MANIFEST_SHA256,
    payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
    conflict_probe_payload_sha256: args.conflictSha256,
    records: {
      discovery_run_id: discoveryRun.id,
      event_candidate_id: candidate.id,
      event_candidate_source_id: candidateSources[0]!.id,
      atlas_operation_run_id: operation.id,
      atlas_operation_action_id: operationActions[0]!.id,
    },
    before_counts: args.authorization.baseline_counts,
    after_counts: afterCounts,
    exact_replay: {
      idempotent_replay: args.replay.idempotent_replay === true,
      candidate_id_unchanged: args.replay.candidate_id === candidate.id,
      operation_run_id_unchanged: args.replay.operation_run_id === operation.id,
      duplicate_rows_created: false,
    },
    conflicting_replay: {
      rejected: true,
      transaction_rolled_back: true,
      duplicate_rows_created: false,
    },
    protected_outcomes: {
      richmond_mac_049_unstaged: true,
      memphis_mac_026_unstaged: true,
      canonical_event_created: false,
      publication_created: false,
      event_hub_or_factory_package_created: false,
      image_or_placeholder_art_created: false,
    },
    integrity: {
      algorithm: "sha256",
      verification_sha256: "",
    },
  };
  verification.integrity.verification_sha256 = sha256Canonical({
    ...verification,
    integrity: { ...verification.integrity, verification_sha256: "" },
  });
  await writeFile(VERIFICATION_PATH, `${JSON.stringify(verification, null, 2)}\n`, "utf8");
  return verification;
}

const cli = parseArgs(process.argv.slice(2));
const [manifestValue, authorizationValue, migration019] = await Promise.all([
  readFile(path.resolve(MACOMB_PILOT_MANIFEST_PATH), "utf8"),
  readFile(AUTHORIZATION_PATH, "utf8"),
  readFile(MIGRATION_019_PATH),
]);
const manifest = JSON.parse(manifestValue) as CountySeedBatchManifest;
const authorization = verifyCanaryAuthorization(JSON.parse(authorizationValue));
const record = authorizedBayRamaRecord({ manifest, authorization });
if (authorization.deployed_guards[1].sha256 !== sha256Bytes(migration019)) {
  throw new Error("Migration 019 no longer matches the canary authorization.");
}

const freshSnapshot = await loadCountySeedPreflightSnapshot();
const freshPreflight = preflightCountySeedRecord(record, freshSnapshot);
const currentCounts = await loadApplicationCounts();
assertCountsEqual(currentCounts, authorization.baseline_counts, "Authorization baseline drift for");
if (
  !freshSnapshot.schema_guard.guarded_rpc_visible
  || freshPreflight.action !== "stage_new_candidate"
  || freshPreflight.blockers.length
) {
  throw new Error(`Fresh Bay-Rama preflight blocked: ${freshPreflight.blockers.join(", ")}.`);
}

if (cli.mode === "preflight") {
  console.log(JSON.stringify({
    mode: "GET-only Bay-Rama canary preflight",
    method: "PostgREST GET only",
    supabase_writes: 0,
    authorization_sha256: authorization.integrity.authorization_sha256,
    manifest_sha256: MACOMB_PILOT_MANIFEST_SHA256,
    clean_id: BAY_RAMA_CANARY_CLEAN_ID,
    payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
    application_counts: currentCounts,
    preflight: freshPreflight,
  }, null, 2));
  process.exit(0);
}

if (cli.confirmation !== authorization.integrity.authorization_sha256) {
  throw new Error("Apply confirmation must equal the exact canary authorization SHA-256.");
}
const actorIdentity = requireAllowlistedActor(cli.actorIdentity);
const auditHandle = await open(AUDIT_PATH, "wx");
await auditHandle.close();
await appendAudit(auditEntry({
  authorization,
  operation: "authorization",
  state: "authorization_verified",
  detail: "Separate authorization verified; staging is limited to MAC-042.",
}));
await appendAudit(auditEntry({
  authorization,
  operation: "preflight",
  state: "fresh_preflight_passed",
  detail: "Fresh GET-only identity and collision preflight passed with unchanged baseline counts.",
}));

let initial: GuardedRpcResult;
await appendAudit(auditEntry({
  authorization,
  operation: "initial_apply",
  state: "success_response_interrupted",
  detail: "Initial guarded RPC started; stop and reconcile if no durable result follows.",
}));
try {
  initial = await callGuardedRpc({ record, actorIdentity });
  if (
    initial.status !== "created"
    || initial.idempotent_replay === true
    || !initial.candidate_id
    || !initial.operation_run_id
    || !initial.action_id
  ) {
    throw new Error("Initial Bay-Rama RPC did not return a new fully audited candidate.");
  }
  await appendAudit(auditEntry({
    authorization,
    operation: "initial_apply",
    state: "succeeded",
    result: initial,
    detail: "Guarded RPC created the authorized MAC-042 candidate.",
  }));
} catch (error) {
  if (error instanceof ConfirmedRpcRejection) {
    await appendAudit(auditEntry({
      authorization,
      operation: "initial_apply",
      state: "rpc_rejected",
      detail: `${error.databaseCode ?? "database_error"}: ${error.message}`,
    }));
    await appendAudit(auditEntry({
      authorization,
      operation: "initial_apply",
      state: "confirmed_rollback",
      detail: "PostgreSQL rejected the guarded RPC and rolled back its transaction.",
    }));
  } else {
    await appendAudit(auditEntry({
      authorization,
      operation: "initial_apply",
      state: "network_uncertainty",
      detail: error instanceof Error ? error.message : String(error),
    }));
  }
  throw error;
}

let replay: GuardedRpcResult;
await appendAudit(auditEntry({
  authorization,
  operation: "exact_replay",
  state: "success_response_interrupted",
  result: initial,
  detail: "Exact replay started; stop and reconcile if no durable result follows.",
}));
try {
  replay = await callGuardedRpc({ record, actorIdentity });
  if (
    replay.idempotent_replay !== true
    || replay.candidate_id !== initial.candidate_id
    || replay.operation_run_id !== initial.operation_run_id
  ) {
    throw new Error("Exact replay was not an idempotent reference to the original records.");
  }
  await appendAudit(auditEntry({
    authorization,
    operation: "exact_replay",
    state: "idempotent_replay",
    result: replay,
    detail: "Exact manifest/payload replay returned the original candidate and operation.",
  }));
} catch (error) {
  await appendAudit(auditEntry({
    authorization,
    operation: "exact_replay",
    state: error instanceof ConfirmedRpcRejection ? "rpc_rejected" : "network_uncertainty",
    result: initial,
    detail: error instanceof Error ? error.message : String(error),
  }));
  throw error;
}

const conflictingCandidate = structuredClone(record.args.p_candidate);
const conflictSha256 = sha256Canonical({
  probe: "Bay-Rama conflicting replay",
  approved_payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
});
conflictingCandidate.county_seed.payload_hash = conflictSha256;
let conflictRejection: ConfirmedRpcRejection | null = null;
try {
  await callGuardedRpc({
    record,
    actorIdentity,
    payloadSha256: conflictSha256,
    candidate: conflictingCandidate,
  });
} catch (error) {
  if (error instanceof ConfirmedRpcRejection) {
    conflictRejection = error;
  } else {
    await appendAudit(auditEntry({
      authorization,
      operation: "conflicting_replay",
      state: "network_uncertainty",
      result: initial,
      payloadSha256: conflictSha256,
      detail: error instanceof Error ? error.message : String(error),
    }));
    throw error;
  }
}
if (!conflictRejection) {
  const error = new Error("Conflicting replay unexpectedly succeeded.");
  await appendAudit(auditEntry({
    authorization,
    operation: "conflicting_replay",
    state: "rpc_rejected",
    result: initial,
    payloadSha256: conflictSha256,
    detail: error.message,
  }));
  throw error;
}
if (
  conflictRejection.databaseCode !== "23505"
  || !conflictRejection.message.includes("idempotency key has a different payload hash")
) {
    await appendAudit(auditEntry({
      authorization,
      operation: "conflicting_replay",
      state: "rpc_rejected",
      result: initial,
      payloadSha256: conflictSha256,
      detail: `${conflictRejection.databaseCode ?? "database_error"}: ${conflictRejection.message}`,
    }));
  throw conflictRejection;
}
await appendAudit(auditEntry({
  authorization,
  operation: "conflicting_replay",
  state: "equivalence_conflict",
  result: initial,
  payloadSha256: conflictSha256,
  detail: "Conflicting payload replay was rejected by the guarded idempotency contract.",
}));
await appendAudit(auditEntry({
  authorization,
  operation: "conflicting_replay",
  state: "confirmed_rollback",
  result: initial,
  payloadSha256: conflictSha256,
  detail: "The conflicting replay transaction was rolled back.",
}));

const verification = await verifyCreatedRecords({
  authorization,
  record,
  initial,
  replay,
  conflictSha256,
});
await appendAudit(auditEntry({
  authorization,
  operation: "verification",
  state: "verification_passed",
  result: initial,
  detail: `GET-only verification passed: ${verification.integrity.verification_sha256}.`,
}));

console.log(JSON.stringify({
  mode: "authorized_single_record_canary_apply",
  authorization_sha256: authorization.integrity.authorization_sha256,
  manifest_sha256: MACOMB_PILOT_MANIFEST_SHA256,
  payload_sha256: BAY_RAMA_CANARY_PAYLOAD_SHA256,
  candidate_id: initial.candidate_id,
  operation_run_id: initial.operation_run_id,
  action_id: initial.action_id,
  exact_replay_idempotent: replay.idempotent_replay === true,
  conflicting_replay_rejected: true,
  verification_path: VERIFICATION_PATH,
  audit_path: AUDIT_PATH,
  verification,
}, null, 2));
