import type { SupabaseClient } from "@supabase/supabase-js";
import { completionSha256 } from "./manifest.ts";
import { getMichiganCompletionStage } from "./stageRegistry.ts";
import {
  COMPLETION_RUN_STATUSES,
  type ArtProvenanceCategory,
  type CompletionExceptionClassification,
  type CompletionExceptionCode,
  type CompletionExceptionRecord,
  type CompletionModelActionRecord,
  type CompletionReadinessState,
  type CompletionRun,
  type CompletionRunEvent,
  type CompletionRunSnapshot,
  type CompletionStageCheckpoint,
  type CompletionStageLinks,
  type CompletionStageStatus,
  type CompletionStore,
  type MichiganCompletionEventInput,
  type MichiganCompletionManifest,
  type StartCompletionRunInput,
} from "./types.ts";

type CompletionRpcClient = Pick<SupabaseClient, "rpc">;
type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function record(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function array(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

function boolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function nullableText(value: unknown) {
  const result = text(value).trim();
  return result || null;
}

function jsonObject<T extends JsonRecord>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function callRpc(
  client: CompletionRpcClient,
  name: string,
  args: JsonRecord,
) {
  const { data, error } = await client.rpc(name, args);
  if (error) {
    const failure = new Error(error.message) as Error & {
      code?: string;
      details?: string;
      hint?: string;
    };
    failure.code = error.code;
    failure.details = error.details;
    failure.hint = error.hint;
    throw failure;
  }
  return data;
}

function runEventId(runId: string, eventKey: string) {
  return `${runId}:${eventKey}`;
}

function checkpointKey(input: {
  runId: string;
  eventKey: string;
  stageId: string;
  stageVersion: string;
  inputHash: string;
}) {
  return completionSha256({
    contractVersion: "michigan-completion-checkpoint/v1",
    ...input,
  });
}

function stageActionKey(key: string, status: string, attempt: number) {
  return `${key}:${status}:${attempt}`;
}

function countBy<T>(items: readonly T[], key: (item: T) => string) {
  const counts: Record<string, number> = {};
  for (const item of items) {
    const value = key(item);
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function completionStatus(value: unknown): CompletionRun["status"] {
  const status = text(value);
  return COMPLETION_RUN_STATUSES.includes(
    status as CompletionRun["status"],
  )
    ? (status as CompletionRun["status"])
    : "queued";
}

function modelUsage(rawRun: JsonRecord) {
  return record(rawRun.modelUsage);
}

function projectRun(rawRun: JsonRecord): CompletionRun {
  const runBudget = record(rawRun.runBudget);
  const perEventBudget = record(rawRun.perEventBudget);
  const usage = modelUsage(rawRun);
  const reservedInput = integer(usage.reservedInputUsage);
  const reservedOutput = integer(usage.reservedOutputUsage);
  const actualInput = integer(usage.actualInputUsage);
  const actualOutput = integer(usage.actualOutputUsage);
  const runId = text(rawRun.runId);
  return {
    id: runId,
    operationRunId: text(rawRun.operationRunId, runId),
    stateId: text(rawRun.stateId),
    countyCode: text(rawRun.countyIdentity),
    batchId: text(rawRun.batchIdentity),
    inputManifestVersion: text(rawRun.manifestVersion),
    inputHash: text(rawRun.inputHash),
    orchestratorVersion: text(rawRun.orchestratorVersion),
    dryRun: boolean(rawRun.dryRun, true),
    deterministicOnly: boolean(rawRun.deterministicOnly),
    status: completionStatus(rawRun.status),
    stageCounts: record(rawRun.stageCounts) as Record<string, number>,
    retryCount: integer(rawRun.retryCount),
    maxConcurrency: integer(rawRun.maxConcurrency, 1),
    modelBudgetTokens: integer(
      runBudget.totalTokens,
      integer(runBudget.inputTokens) + integer(runBudget.outputTokens),
    ),
    perEventModelBudgetTokens: integer(
      perEventBudget.totalTokens,
      integer(perEventBudget.inputTokens) +
        integer(perEventBudget.outputTokens),
    ),
    modelReservedTokens: reservedInput + reservedOutput,
    modelUsageTokens: actualInput + actualOutput,
    estimatedModelInputTokens: reservedInput,
    estimatedModelOutputTokens: reservedOutput,
    actualModelInputTokens: actualInput,
    actualModelOutputTokens: actualOutput,
    exceptionCount: integer(rawRun.exceptionCount),
    publicationEligibilityCount: integer(
      rawRun.publicationEligibilityCount,
    ),
    createdAt: text(rawRun.createdAt),
    startedAt: nullableText(rawRun.startedAt),
    updatedAt: text(rawRun.updatedAt),
    completedAt: nullableText(rawRun.completedAt),
    error: isRecord(rawRun.error) ? rawRun.error : null,
  };
}

function projectManifest(
  rawManifest: JsonRecord,
  run: CompletionRun,
): MichiganCompletionManifest {
  return {
    schemaVersion: "michigan-completion-manifest/v1",
    stateId: "MI",
    countyCode: text(rawManifest.countyIdentity, run.countyCode),
    batchId: text(rawManifest.batchIdentity, run.batchId),
    inputManifestVersion: text(
      rawManifest.manifestVersion,
      run.inputManifestVersion,
    ),
    events: array(rawManifest.events) as MichiganCompletionEventInput[],
    metadata: {
      persistedContractVersion: text(rawManifest.contractVersion),
    },
  };
}

function terminalCheckpoint(status: string) {
  return ["succeeded", "skipped", "blocked", "failed"].includes(status);
}

function projectCheckpoints(
  rawCheckpoints: JsonRecord[],
  runId: string,
): {
  checkpoints: CompletionStageCheckpoint[];
  latestLinks: Map<string, CompletionStageLinks>;
} {
  const groups = new Map<string, JsonRecord[]>();
  for (const item of rawCheckpoints) {
    const key =
      text(item.checkpointKey) ||
      `${text(item.eventKey)}:${text(item.stageId)}:${text(item.stageVersion)}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }

  const checkpoints: CompletionStageCheckpoint[] = [];
  const latestLinks = new Map<string, CompletionStageLinks>();
  for (const history of groups.values()) {
    history.sort((left, right) =>
      text(left.createdAt).localeCompare(text(right.createdAt)),
    );
    const latest = history.at(-1)!;
    const eventKey = text(latest.eventKey);
    const status = text(latest.status, "queued") as CompletionStageStatus;
    const started = history.find((item) => text(item.status) === "running");
    const completed = [...history]
      .reverse()
      .find((item) => terminalCheckpoint(text(item.status)));
    checkpoints.push({
      id: text(latest.actionId),
      runEventId: runEventId(runId, eventKey),
      stageId: text(latest.stageId),
      stageVersion: text(latest.stageVersion),
      status,
      attemptCount: Math.max(
        1,
        history.filter((item) => text(item.status) === "running").length,
      ),
      inputHash: text(latest.inputHash),
      deterministic:
        getMichiganCompletionStage(text(latest.stageId))?.processor !==
        "model_assisted",
      output: record(latest.output),
      error: isRecord(latest.failure) ? latest.failure : null,
      startedAt: started ? text(started.createdAt) : null,
      completedAt: completed ? text(completed.createdAt) : null,
    });
    latestLinks.set(eventKey, {
      ...(latestLinks.get(eventKey) ?? {}),
      ...(record(latest.links) as CompletionStageLinks),
    });
  }
  checkpoints.sort(
    (left, right) =>
      (left.startedAt ?? left.completedAt ?? "").localeCompare(
        right.startedAt ?? right.completedAt ?? "",
      ) || left.id.localeCompare(right.id),
  );
  return { checkpoints, latestLinks };
}

function projectExceptions(
  rawExceptions: JsonRecord[],
  runId: string,
): CompletionExceptionRecord[] {
  return rawExceptions.map((item) => {
    const evidence = record(item.evidence);
    const eventKey = nullableText(item.eventKey);
    return {
      id: text(item.reviewItemId),
      runId,
      runEventId: eventKey ? runEventId(runId, eventKey) : null,
      eventKey,
      stageId: text(item.stageId),
      code: text(item.exceptionCode) as CompletionExceptionCode,
      classification: text(
        item.classification,
      ) as CompletionExceptionClassification,
      status: text(item.status, "open") as CompletionExceptionRecord["status"],
      message: text(item.message),
      details: record(evidence.details),
      publicationBlocking: boolean(item.publicationBlocking),
      createdAt: text(item.createdAt),
      updatedAt: text(item.updatedAt),
      resolvedAt: nullableText(item.resolvedAt),
    };
  });
}

function projectModelActions(
  rawActions: JsonRecord[],
  runId: string,
): CompletionModelActionRecord[] {
  const reservations = rawActions.filter((item) =>
    [
      "michigan_completion_model_reserved",
      "michigan_completion_model_budget_blocked",
      "michigan_completion_model_rejected",
    ].includes(text(item.actionType)),
  );
  const finishes = new Map(
    rawActions
      .filter(
        (item) =>
          text(item.actionType) === "michigan_completion_model_finished",
      )
      .map((item) => [text(item.reservationActionId), item]),
  );
  return reservations.map((reservation) => {
    const request = record(reservation.request);
    const finish = finishes.get(text(reservation.actionId));
    const finishRequest = record(finish?.request);
    const rawStatus = finish
      ? text(finish.status)
      : text(reservation.status, "reserved");
    return {
      id: text(reservation.actionId),
      runId,
      runEventId: runEventId(runId, text(reservation.eventKey)),
      eventKey: text(reservation.eventKey),
      stageId: text(request.stageId, "editorial_assistance"),
      processorId: text(request.processor),
      routeId: text(request.routeId),
      configuredModel: text(request.configuredModel),
      status: rawStatus as CompletionModelActionRecord["status"],
      chargeKey: text(reservation.chargeKey),
      estimatedInputTokens: integer(request.estimatedInputUsage),
      estimatedOutputTokens: integer(request.estimatedOutputUsage),
      actualInputTokens: finish
        ? integer(finishRequest.actualInputUsage)
        : null,
      actualOutputTokens: finish
        ? integer(finishRequest.actualOutputUsage)
        : null,
      createdAt: text(reservation.createdAt),
      completedAt: finish ? text(finish.createdAt) : null,
    };
  });
}

function projectEvents(args: {
  rawEvents: JsonRecord[];
  run: CompletionRun;
  modelActions: CompletionModelActionRecord[];
  latestLinks: Map<string, CompletionStageLinks>;
}): CompletionRunEvent[] {
  return args.rawEvents.map((rawEvent) => {
    const progress = record(rawEvent.progress);
    const eventKey = text(rawEvent.eventKey);
    const links = args.latestLinks.get(eventKey) ?? {};
    const references = {
      ...record(rawEvent.references),
      ...Object.fromEntries(
        Object.entries(links).filter(
          ([key, value]) =>
            [
              "candidateId",
              "canonicalEventId",
              "sourceBundleId",
              "synthesisId",
              "verificationCaseId",
              "packageId",
              "evidenceId",
            ].includes(key) && value,
        ),
      ),
    };
    const eventModelActions = args.modelActions.filter(
      (action) => action.eventKey === eventKey,
    );
    const reserved = eventModelActions.reduce(
      (total, action) =>
        total +
        action.estimatedInputTokens +
        action.estimatedOutputTokens,
      0,
    );
    const used = eventModelActions.reduce(
      (total, action) =>
        total +
        (action.actualInputTokens ?? 0) +
        (action.actualOutputTokens ?? 0),
      0,
    );
    const status = text(
      progress.status,
      "queued",
    ) as CompletionRunEvent["status"];
    const readiness = text(
      progress.readinessStatus,
      "publication_blocked",
    ) as CompletionReadinessState;
    return {
      id: runEventId(args.run.id, eventKey),
      runId: args.run.id,
      eventKey,
      sourceRecordId: text(rawEvent.sourceRecordId),
      inputHash: text(rawEvent.inputHash),
      status,
      currentStageId: nullableText(progress.currentStageId),
      lastSuccessfulStageId: nullableText(progress.lastSuccessfulStageId),
      retryCount: integer(progress.retryCount),
      modelBudgetTokens: integer(
        rawEvent.perEventModelBudgetTokens,
        args.run.perEventModelBudgetTokens,
      ),
      modelReservedTokens: reserved,
      modelUsageTokens: used,
      readinessState: readiness,
      artProvenance: text(
        progress.artProvenance,
        text(rawEvent.artProvenance, "unknown"),
      ) as ArtProvenanceCategory,
      publicationEligible: boolean(progress.publicationEligible),
      references,
      createdAt: args.run.createdAt,
      updatedAt: text(progress.updatedAt, args.run.updatedAt),
      completedAt:
        status === "completed" || status === "ready_for_review"
          ? args.run.completedAt ?? text(progress.updatedAt, args.run.updatedAt)
          : null,
    };
  });
}

function projectSnapshot(value: unknown): CompletionRunSnapshot {
  if (!isRecord(value) || !isRecord(value.run)) {
    throw new Error("The Michigan completion snapshot is unavailable.");
  }
  const run = projectRun(value.run);
  const checkpointProjection = projectCheckpoints(
    array(value.checkpoints),
    run.id,
  );
  const modelActions = projectModelActions(array(value.modelActions), run.id);
  const events = projectEvents({
    rawEvents: array(value.events),
    run,
    modelActions,
    latestLinks: checkpointProjection.latestLinks,
  });
  return {
    run,
    manifest: projectManifest(record(value.manifest), run),
    events,
    checkpoints: checkpointProjection.checkpoints,
    exceptions: projectExceptions(array(value.exceptions), run.id),
    modelActions,
    audit: array(value.audit),
  };
}

function terminalEventStatus(
  stageId: string,
  status: Exclude<CompletionStageStatus, "queued" | "running">,
  links: CompletionStageLinks,
) {
  if (status === "failed") return "failed";
  if (status === "blocked") return "waiting_for_exception";
  if (stageId === "publication_readiness") {
    return links.publicationEligible ? "ready_for_review" : "completed";
  }
  return "running";
}

export function createSupabaseMichiganCompletionStore(
  client: CompletionRpcClient,
): CompletionStore {
  async function getRun(runId: string) {
    return projectSnapshot(
      await callRpc(client, "atlas_get_michigan_completion_run", {
        p_run_id: runId,
      }),
    );
  }

  return {
    async startRun(input: StartCompletionRunInput) {
      const totalRunBudget = Math.max(0, input.modelBudgetTokens);
      const totalEventBudget = Math.max(
        0,
        input.perEventModelBudgetTokens,
      );
      const started = record(
        await callRpc(client, "atlas_start_michigan_completion_run", {
          p_actor_type: "automation",
          p_actor_identity: input.actorIdentity,
          p_state_id: input.stateId,
          p_county_identity: input.countyCode,
          p_batch_identity: input.batchId,
          p_manifest_version: input.inputManifestVersion,
          p_input_hash: input.inputHash,
          p_orchestrator_version: input.orchestratorVersion,
          p_dry_run: input.dryRun,
          p_deterministic_only: input.deterministicOnly,
          p_max_concurrency: input.maxConcurrency,
          p_run_budget: {
            totalTokens: totalRunBudget,
            inputTokens: totalRunBudget,
            outputTokens: totalRunBudget,
            costMicros: 0,
          },
          p_per_event_budget: {
            totalTokens: totalEventBudget,
            inputTokens: totalEventBudget,
            outputTokens: totalEventBudget,
            costMicros: 0,
          },
          p_events: input.events.map((event) => ({
            ...event,
            readinessStatus: "publication_blocked",
          })),
        }),
      );
      const snapshot = await getRun(text(started.runId));
      return {
        ...snapshot,
        exactReplay: boolean(started.exactReplay),
      };
    },

    async resumeRun(runId, actorIdentity) {
      await callRpc(client, "atlas_resume_michigan_completion_run", {
        p_run_id: runId,
        p_actor_identity: actorIdentity,
      });
      return getRun(runId);
    },

    getRun,

    async beginStage(input) {
      const snapshot = await getRun(input.runId);
      const key = checkpointKey(input);
      const history = snapshot.audit.filter((item) => {
        const requested = record(item.requestedPayload);
        return (
          text(item.actionType) === "michigan_completion_checkpoint" &&
          text(requested.checkpointKey) === key
        );
      });
      const latest = snapshot.checkpoints.find(
        (item) =>
          item.runEventId === runEventId(input.runId, input.eventKey) &&
          item.stageId === input.stageId &&
          item.stageVersion === input.stageVersion &&
          item.inputHash === input.inputHash,
      );
      if (
        latest &&
        ["running", "succeeded", "skipped"].includes(latest.status)
      ) {
        return { checkpoint: latest, exactReplay: true };
      }
      const attempt =
        history.filter((item) => {
          const requested = record(item.requestedPayload);
          return text(requested.status) === "running";
        }).length + 1;
      const result = record(
        await callRpc(client, "atlas_record_michigan_completion_checkpoint", {
          p_run_id: input.runId,
          p_actor_identity: input.actorIdentity,
          p_event_key: input.eventKey,
          p_stage_id: input.stageId,
          p_stage_version: input.stageVersion,
          p_input_hash: input.inputHash,
          p_checkpoint_key: key,
          p_action_idempotency_key: stageActionKey(
            key,
            "running",
            attempt,
          ),
          p_status: "running",
          p_output: { eventStatus: "running" },
          p_links: {},
          p_warnings: [],
          p_failure: null,
        }),
      );
      const next = await getRun(input.runId);
      const checkpoint = next.checkpoints.find(
        (item) =>
          item.runEventId === runEventId(input.runId, input.eventKey) &&
          item.stageId === input.stageId &&
          item.stageVersion === input.stageVersion &&
          item.inputHash === input.inputHash,
      );
      if (!checkpoint) throw new Error("The stage checkpoint was not retained.");
      return {
        checkpoint,
        exactReplay: boolean(result.exactReplay),
      };
    },

    async finishStage(input) {
      const snapshot = await getRun(input.runId);
      const candidates = snapshot.checkpoints.filter(
          (item) =>
            item.runEventId === runEventId(input.runId, input.eventKey) &&
            item.stageId === input.stageId &&
            item.stageVersion === input.stageVersion,
      );
      const checkpoint =
        candidates.find((item) => item.status === "running") ??
        candidates.at(-1);
      if (!checkpoint) {
        throw new Error("A running checkpoint is required before completion.");
      }
      const key = checkpointKey({
        runId: input.runId,
        eventKey: input.eventKey,
        stageId: input.stageId,
        stageVersion: input.stageVersion,
        inputHash: checkpoint.inputHash,
      });
      const output = jsonObject({
        ...input.output,
        eventStatus: terminalEventStatus(
          input.stageId,
          input.status,
          input.links,
        ),
        ...(input.links.readinessState
          ? { readinessStatus: input.links.readinessState }
          : {}),
        ...(input.links.artProvenance
          ? { artProvenance: input.links.artProvenance }
          : {}),
        publicationEligible: input.links.publicationEligible === true,
      });
      await callRpc(client, "atlas_record_michigan_completion_checkpoint", {
        p_run_id: input.runId,
        p_actor_identity: input.actorIdentity,
        p_event_key: input.eventKey,
        p_stage_id: input.stageId,
        p_stage_version: input.stageVersion,
        p_input_hash: checkpoint.inputHash,
        p_checkpoint_key: key,
        p_action_idempotency_key: stageActionKey(
          key,
          input.status,
          checkpoint.attemptCount,
        ),
        p_status: input.status,
        p_output: output,
        p_links: jsonObject(input.links),
        p_warnings: [],
        p_failure:
          input.status === "failed"
            ? input.error ?? {
                message: "The stage failed without a structured error.",
              }
            : input.error,
      });
      const next = await getRun(input.runId);
      const retained = [...next.checkpoints]
        .reverse()
        .find(
          (item) =>
            item.runEventId === runEventId(input.runId, input.eventKey) &&
            item.stageId === input.stageId &&
            item.stageVersion === input.stageVersion &&
            item.inputHash === checkpoint.inputHash,
        );
      if (!retained) throw new Error("The completed checkpoint was not retained.");
      return retained;
    },

    async recordException(input) {
      const response = record(
        await callRpc(client, "atlas_record_michigan_completion_exception", {
        p_run_id: input.runId,
        p_actor_identity: input.actorIdentity,
        p_event_key: input.eventKey,
        p_stage_id: input.stageId,
        p_exception_code: input.exception.code,
        p_classification: input.exception.classification,
        p_dedupe_key: input.dedupeKey,
        p_message: input.exception.message,
        p_evidence: {
          details: input.exception.details ?? {},
          retryable:
            input.exception.retryable ??
            input.exception.classification === "retryable",
          modelReviewEligible:
            input.exception.modelReviewEligible ??
            input.exception.classification === "model_review_eligible",
          humanReviewRequired:
            input.exception.humanReviewRequired ??
            input.exception.classification === "human_review_required",
          publicationBlocking:
            input.exception.publicationBlocking ??
            ["publication_blocking", "fatal"].includes(
              input.exception.classification,
            ),
          fatal:
            input.exception.fatal ??
            input.exception.classification === "fatal",
        },
        p_related_ids: input.exception.related ?? {},
        p_recommended_action:
          input.exception.humanReviewRequired ||
          input.exception.publicationBlocking
            ? "Review retained evidence, record a reasoned disposition, then resume the run."
            : "Retry the deterministic stage when its prerequisites are available.",
        }),
      );
      const snapshot = await getRun(input.runId);
      const retained = snapshot.exceptions.find(
        (item) => item.id === text(response.reviewItemId),
      );
      if (!retained) throw new Error("The completion exception was not retained.");
      return retained;
    },

    async reserveModelAction(input) {
      const response = record(
        await callRpc(client, "atlas_reserve_michigan_completion_model_action", {
          p_run_id: input.runId,
          p_actor_identity: input.actorIdentity,
          p_event_key: input.eventKey,
          p_stage_id: input.stageId,
          p_charge_key: input.chargeKey,
          p_processor: input.request.processorId,
          p_route_id: input.request.routeId,
          p_reason: input.request.reason,
          p_deterministic_preconditions:
            input.request.deterministicPreconditions,
          p_model_family: input.request.modelFamily,
          p_configured_model: input.request.configuredModel,
          p_reasoning_level: input.request.reasoningLevel ?? null,
          p_max_attempts: input.request.maximumAttempts,
          p_attempt_number: 1,
          p_estimated_input_usage: input.request.estimatedInputTokens,
          p_estimated_output_usage: input.request.estimatedOutputTokens,
          p_estimated_cost_micros: 0,
          p_fallback_behavior: input.request.fallbackBehavior,
          p_failure_blocking: input.request.failureBlocking,
        }),
      );
      const snapshot = await getRun(input.runId);
      const action = snapshot.modelActions.find(
        (item) => item.chargeKey === input.chargeKey,
      );
      if (!action) throw new Error("The model reservation was not retained.");
      return {
        action,
        reserved: boolean(response.reserved),
        exactReplay: boolean(response.exactReplay),
      };
    },

    async finishModelAction(input) {
      const snapshot = await getRun(input.runId);
      const reservation = snapshot.modelActions.find(
        (item) => item.id === input.modelActionId,
      );
      if (!reservation) throw new Error("The model reservation was not found.");
      await callRpc(client, "atlas_finish_michigan_completion_model_action", {
        p_run_id: input.runId,
        p_reservation_action_id: input.modelActionId,
        p_actor_identity: input.actorIdentity,
        p_status: input.status,
        p_actual_input_usage: input.actualInputTokens ?? 0,
        p_actual_output_usage: input.actualOutputTokens ?? 0,
        p_actual_cost_micros: 0,
        p_provider_response_id: input.providerResponseId,
        p_failure: input.failure,
      });
      const next = await getRun(input.runId);
      const action = next.modelActions.find(
        (item) => item.id === input.modelActionId,
      );
      if (!action) throw new Error("The completed model action was not retained.");
      return action;
    },

    async finalizeRun(input) {
      const snapshot = await getRun(input.runId);
      await callRpc(client, "atlas_finalize_michigan_completion_run", {
        p_run_id: input.runId,
        p_actor_identity: input.actorIdentity,
        p_status: input.requestedStatus,
        p_stage_counts: countBy(
          snapshot.checkpoints,
          (checkpoint) => `${checkpoint.stageId}:${checkpoint.status}`,
        ),
        p_event_counts: countBy(snapshot.events, (event) => event.status),
        p_readiness_counts: countBy(
          snapshot.events,
          (event) => event.readinessState,
        ),
        p_error:
          input.requestedStatus === "failed"
            ? record(input.summary.error)
            : null,
      });
      return getRun(input.runId);
    },
  };
}
