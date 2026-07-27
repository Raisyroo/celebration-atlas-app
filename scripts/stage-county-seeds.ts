import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  type CountySeedBatchManifest,
  type CountySeedManifestRecord,
  preflightCountySeedRecord,
  verifyManifestIntegrity,
} from "../lib/county-seeds/staging.ts";
import {
  CountySeedRpcRejectedError,
  executeGuardedCountySeedManifest,
  type GuardedRpcResult,
} from "../lib/county-seeds/stagingApply.ts";
import { loadCountySeedPreflightSnapshot } from "../lib/county-seeds/stagingPreflight.ts";

function parseArgs(argv: string[]) {
  const manifest = argv[0];
  if (!manifest || manifest.startsWith("--")) {
    throw new Error("Usage: stage:county-seeds -- <manifest.json> [--preflight] | [--apply --confirm <manifest-sha256> --actor <email>]");
  }
  let mode: "preflight" | "apply" = "preflight";
  let confirmation: string | null = null;
  let actorIdentity: string | null = null;
  let auditPath: string | null = null;
  let sawPreflight = false;
  let sawApply = false;
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--preflight") {
      sawPreflight = true;
      mode = "preflight";
    } else if (arg === "--apply") {
      sawApply = true;
      mode = "apply";
    } else if (arg === "--confirm") confirmation = argv[++index] ?? null;
    else if (arg === "--actor") actorIdentity = argv[++index] ?? null;
    else if (arg === "--audit") auditPath = argv[++index] ?? null;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (sawPreflight && sawApply) throw new Error("Choose either --preflight or --apply, not both.");
  if (mode === "preflight" && confirmation) throw new Error("--confirm is accepted only with --apply.");
  if (mode === "apply" && (!confirmation || !actorIdentity)) {
    throw new Error("Future apply requires --confirm <manifest-sha256> and --actor <allowlisted administrator email>.");
  }
  const manifestPath = path.resolve(manifest);
  return {
    manifestPath,
    mode,
    confirmation,
    actorIdentity,
    auditPath: path.resolve(auditPath ?? `${manifestPath}.audit.jsonl`),
  };
}

function requireConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Guarded county staging requires configured Supabase credentials.");
  return { url: url.replace(/\/+$/, ""), key };
}

async function callGuardedRpc(
  record: CountySeedManifestRecord,
  manifestHash: string,
  actorIdentity: string,
): Promise<GuardedRpcResult> {
  const { url, key } = requireConnection();
  const response = await fetch(`${url}/rest/v1/rpc/atlas_stage_county_seed_candidate`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_actor_identity: actorIdentity,
      p_batch_id: record.args.p_candidate.county_seed.batch_id,
      p_manifest_hash: manifestHash,
      p_payload_hash: record.payload_sha256,
      p_idempotency_key: record.args.p_idempotency_key,
      p_candidate: record.args.p_candidate,
      p_sources: record.args.p_sources,
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && typeof (payload as { message?: unknown }).message === "string"
      ? (payload as { message: string }).message
      : `Guarded county staging RPC rejected with status ${response.status}.`;
    const databaseCode = payload && typeof payload === "object"
      ? (payload as { code?: unknown }).code
      : null;
    throw new CountySeedRpcRejectedError(message, response.status, typeof databaseCode === "string");
  }
  return payload as GuardedRpcResult;
}

const args = parseArgs(process.argv.slice(2));
const manifest = JSON.parse(await readFile(args.manifestPath, "utf8")) as CountySeedBatchManifest;
const manifestSha256 = verifyManifestIntegrity(manifest);

if (args.mode === "preflight") {
  const snapshot = await loadCountySeedPreflightSnapshot();
  const results = manifest.records.map((record) => preflightCountySeedRecord(record, snapshot));
  console.log(JSON.stringify({
    mode: "preflight",
    method: "PostgREST GET only",
    supabase_writes: 0,
    batch_id: manifest.batch_id,
    manifest_sha256: manifestSha256,
    schema_guard_visible: snapshot.schema_guard.guarded_rpc_visible,
    results,
  }, null, 2));
} else {
  const results = await executeGuardedCountySeedManifest({
    manifest,
    confirmation: args.confirmation,
    auditPath: args.auditPath,
    loadFreshPreflight: async (record) => {
      const snapshot = await loadCountySeedPreflightSnapshot();
      return preflightCountySeedRecord(record, snapshot);
    },
    callGuardedRpc: (record, hash) => callGuardedRpc(record, hash, args.actorIdentity!),
  });
  console.log(JSON.stringify({
    mode: "guarded_apply",
    batch_id: manifest.batch_id,
    manifest_sha256: manifestSha256,
    audit_path: args.auditPath,
    results,
  }, null, 2));
}
