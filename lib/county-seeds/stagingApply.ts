import { open } from "node:fs/promises";
import type {
  CountySeedBatchManifest,
  CountySeedManifestRecord,
  CountySeedRecordPreflight,
} from "./staging.ts";
import {
  validateApplyAuthorization,
} from "./staging.ts";

export type CountySeedExecutionState =
  | "preflight_blocked"
  | "rpc_rejected"
  | "network_uncertainty"
  | "confirmed_rollback"
  | "success_response_interrupted"
  | "idempotent_replay"
  | "equivalence_conflict"
  | "succeeded";

export type CountySeedExecutionAudit = {
  at: string;
  batch_id: string;
  manifest_sha256: string;
  clean_id: string;
  attempt: number;
  state: CountySeedExecutionState;
  candidate_id: string | null;
  operation_run_id: string | null;
  error: string | null;
  retry: "not_needed" | "blocked" | "reconcile_before_retry";
};

export type GuardedRpcResult = {
  operation_run_id: string;
  action_id?: string;
  candidate_id: string;
  status: "created" | "updated";
  idempotent_replay?: boolean;
};

export class CountySeedRpcRejectedError extends Error {
  readonly responseStatus: number;
  readonly confirmedDatabaseRejection: boolean;

  constructor(message: string, responseStatus: number, confirmedDatabaseRejection = false) {
    super(message);
    this.name = "CountySeedRpcRejectedError";
    this.responseStatus = responseStatus;
    this.confirmedDatabaseRejection = confirmedDatabaseRejection;
  }
}

async function appendDurableAudit(path: string, entry: CountySeedExecutionAudit) {
  const handle = await open(path, "a");
  try {
    await handle.appendFile(`${JSON.stringify(entry)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
}

function audit(args: {
  manifest: CountySeedBatchManifest;
  record: CountySeedManifestRecord;
  attempt: number;
  state: CountySeedExecutionState;
  result?: GuardedRpcResult;
  error?: unknown;
  now: () => string;
}): CountySeedExecutionAudit {
  return {
    at: args.now(),
    batch_id: args.manifest.batch_id,
    manifest_sha256: args.manifest.integrity.manifest_sha256,
    clean_id: args.record.clean_id,
    attempt: args.attempt,
    state: args.state,
    candidate_id: args.result?.candidate_id ?? null,
    operation_run_id: args.result?.operation_run_id ?? null,
    error: args.error instanceof Error ? args.error.message : args.error ? String(args.error) : null,
    retry: args.state === "succeeded" || args.state === "idempotent_replay"
      ? "not_needed"
      : args.state === "network_uncertainty" || args.state === "success_response_interrupted"
        ? "reconcile_before_retry"
        : "blocked",
  };
}

export async function executeGuardedCountySeedManifest(args: {
  manifest: CountySeedBatchManifest;
  confirmation: string | null;
  auditPath: string;
  loadFreshPreflight: (record: CountySeedManifestRecord) => Promise<CountySeedRecordPreflight>;
  callGuardedRpc: (
    record: CountySeedManifestRecord,
    manifestHash: string,
  ) => Promise<GuardedRpcResult>;
  now?: () => string;
}) {
  const manifestHash = validateApplyAuthorization({
    manifest: args.manifest,
    confirmation: args.confirmation,
    allowExecution: true,
  });
  const now = args.now ?? (() => new Date().toISOString());
  const results: CountySeedExecutionAudit[] = [];

  for (const record of args.manifest.records) {
    const attempt = record.retry.attempts + 1;
    const fresh = await args.loadFreshPreflight(record);
    if (fresh.action === "no_op_equivalent") {
      const entry = audit({
        manifest: args.manifest,
        record,
        attempt,
        state: "idempotent_replay",
        result: fresh.equivalent_candidate_id
          ? { candidate_id: fresh.equivalent_candidate_id, operation_run_id: "", status: "updated", idempotent_replay: true }
          : undefined,
        now,
      });
      await appendDurableAudit(args.auditPath, entry);
      results.push(entry);
      continue;
    }
    if (fresh.action === "blocked" || fresh.blockers.length) {
      const equivalenceConflict = fresh.blockers.some((code) => (
        code.includes("payload")
        || code.includes("identity")
        || code.includes("idempotency")
      ));
      const entry = audit({
        manifest: args.manifest,
        record,
        attempt,
        state: equivalenceConflict ? "equivalence_conflict" : "preflight_blocked",
        error: fresh.blockers.join(", "),
        now,
      });
      await appendDurableAudit(args.auditPath, entry);
      results.push(entry);
      throw new Error(`Fresh preflight blocked ${record.clean_id}: ${fresh.blockers.join(", ")}.`);
    }

    const started = audit({
      manifest: args.manifest,
      record,
      attempt,
      state: "success_response_interrupted",
      error: "Guarded RPC started; this checkpoint remains uncertain until a result audit is durably appended.",
      now,
    });
    await appendDurableAudit(args.auditPath, started);
    results.push(started);
    try {
      const rpcResult = await args.callGuardedRpc(record, manifestHash);
      const complete = audit({
        manifest: args.manifest,
        record,
        attempt,
        state: rpcResult.idempotent_replay ? "idempotent_replay" : "succeeded",
        result: rpcResult,
        now,
      });
      await appendDurableAudit(args.auditPath, complete);
      results.push(complete);
    } catch (error) {
      const rejected = error instanceof CountySeedRpcRejectedError;
      const failed = audit({
        manifest: args.manifest,
        record,
        attempt,
        state: rejected ? "rpc_rejected" : "network_uncertainty",
        error,
        now,
      });
      await appendDurableAudit(args.auditPath, failed);
      results.push(failed);
      if (error instanceof CountySeedRpcRejectedError && error.confirmedDatabaseRejection) {
        const rollback = audit({
          manifest: args.manifest,
          record,
          attempt,
          state: "confirmed_rollback",
          error: "The guarded PostgreSQL RPC returned an error response; its transaction was rolled back.",
          now,
        });
        await appendDurableAudit(args.auditPath, rollback);
        results.push(rollback);
      }
      throw error;
    }
  }
  return results;
}
