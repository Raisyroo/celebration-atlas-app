import {
  completionSha256,
} from "./manifest.ts";
import {
  completionEventHasStaleBlockingStage,
  completionExceptionAppliesToEvent,
  isOpenBlockingCompletionException,
} from "./exceptionPolicy.ts";
import { MICHIGAN_COMPLETION_STAGES } from "./stageRegistry.ts";
import {
  MICHIGAN_COMPLETION_ORCHESTRATOR_VERSION,
  type CompletionExceptionInput,
  type CompletionModelRequest,
  type CompletionRunEvent,
  type CompletionRunReport,
  type CompletionRunSnapshot,
  type CompletionStageExecutionResult,
  type CompletionStageExecutor,
  type CompletionStore,
  type MichiganCompletionEventInput,
  type MichiganCompletionManifest,
} from "./types.ts";

export const COMPLETION_EXIT_CODES = {
  completed: 0,
  exceptionBlocked: 2,
  failed: 1,
} as const;

function errorRecord(error: unknown) {
  const structured =
    error && typeof error === "object"
      ? error as {
          code?: unknown;
          details?: unknown;
          hint?: unknown;
          name?: unknown;
        }
      : {};
  return {
    code:
      typeof structured.code === "string" && structured.code.trim()
        ? structured.code
        : "MICHIGAN_COMPLETION_STAGE_OPERATION_FAILED",
    message:
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "Unexpected completion-stage failure.",
    ...(typeof structured.name === "string"
      ? { name: structured.name }
      : error instanceof Error
        ? { name: error.name }
        : {}),
    ...(typeof structured.details === "string" && structured.details
      ? { details: structured.details }
      : {}),
    ...(typeof structured.hint === "string" && structured.hint
      ? { hint: structured.hint }
      : {}),
  };
}

class CompletionStageOperationError extends Error {
  readonly eventKey: string;
  readonly stageId: string;
  readonly failure: ReturnType<typeof errorRecord>;

  constructor(eventKey: string, stageId: string, cause: unknown) {
    const failure = errorRecord(cause);
    super(failure.message, { cause });
    this.name = "CompletionStageOperationError";
    this.eventKey = eventKey;
    this.stageId = stageId;
    this.failure = failure;
  }
}

async function stageOperation<T>(
  eventKey: string,
  stageId: string,
  operation: () => Promise<T>,
) {
  try {
    return await operation();
  } catch (error) {
    throw new CompletionStageOperationError(eventKey, stageId, error);
  }
}

function exceptionDedupeKey(input: {
  runId: string;
  eventKey: string | null;
  stageId: string;
  exception: CompletionExceptionInput;
}) {
  return completionSha256({
    runId: input.runId,
    eventKey: input.eventKey,
    stageId: input.stageId,
    code: input.exception.code,
    classification: input.exception.classification,
    details: input.exception.details ?? {},
  });
}

function modelChargeKey(input: {
  runInputHash: string;
  eventInputHash: string;
  stageId: string;
  stageVersion: string;
  request: CompletionModelRequest;
}) {
  return completionSha256({
    runInputHash: input.runInputHash,
    eventInputHash: input.eventInputHash,
    stageId: input.stageId,
    stageVersion: input.stageVersion,
    processorId: input.request.processorId,
    routeId: input.request.routeId,
    configuredModel: input.request.configuredModel,
    deterministicPreconditions: input.request.deterministicPreconditions,
  });
}

async function mapWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<void>,
) {
  let next = 0;
  const workers = Array.from(
    { length: Math.min(Math.max(1, concurrency), items.length) },
    async () => {
      while (true) {
        const index = next++;
        if (index >= items.length) return;
        await worker(items[index], index);
      }
    },
  );
  await Promise.all(workers);
}

function priorOutputsForEvent(snapshot: CompletionRunSnapshot, runEventId: string) {
  return new Map(
    snapshot.checkpoints
      .filter(
        (checkpoint) =>
          checkpoint.runEventId === runEventId &&
          checkpoint.status === "succeeded",
      )
      .map((checkpoint) => [checkpoint.stageId, checkpoint.output]),
  );
}

function findRunEvent(snapshot: CompletionRunSnapshot, eventKey: string) {
  const event = snapshot.events.find((candidate) => candidate.eventKey === eventKey);
  if (!event) throw new Error(`Completion run is missing event ${eventKey}.`);
  return event;
}

async function recordExceptions(args: {
  store: CompletionStore;
  runId: string;
  eventKey: string;
  stageId: string;
  exceptions: CompletionExceptionInput[];
  actorIdentity: string;
}) {
  for (const exception of args.exceptions) {
    await args.store.recordException({
      runId: args.runId,
      eventKey: args.eventKey,
      stageId: args.stageId,
      exception,
      dedupeKey: exceptionDedupeKey({
        runId: args.runId,
        eventKey: args.eventKey,
        stageId: args.stageId,
        exception,
      }),
      actorIdentity: args.actorIdentity,
    });
  }
}

function normalizeModelFailure(
  request: CompletionModelRequest,
  error: unknown,
): CompletionExceptionInput {
  return {
    code: "editorial_quality_failure",
    classification: request.failureBlocking
      ? "publication_blocking"
      : "model_review_eligible",
    message: errorRecord(error).message,
    details: {
      processorId: request.processorId,
      routeId: request.routeId,
      configuredModel: request.configuredModel,
      fallbackBehavior: request.fallbackBehavior,
    },
    modelReviewEligible: true,
    publicationBlocking: request.failureBlocking,
  };
}

async function executeModelRequest(args: {
  store: CompletionStore;
  executor: CompletionStageExecutor;
  request: CompletionModelRequest;
  context: Parameters<CompletionStageExecutor["execute"]>[1];
  stageId: string;
  stageVersion: string;
}) {
  const chargeKey = modelChargeKey({
    runInputHash: args.context.run.inputHash,
    eventInputHash: args.context.event.inputHash,
    stageId: args.stageId,
    stageVersion: args.stageVersion,
    request: args.request,
  });
  const reservation = await args.store.reserveModelAction({
    runId: args.context.run.id,
    eventKey: args.context.event.eventKey,
    stageId: args.stageId,
    request: args.request,
    chargeKey,
    actorIdentity: args.context.actorIdentity,
  });

  if (!reservation.reserved) {
    const exception: CompletionExceptionInput = {
      code: "model_budget_exceeded",
      classification: "human_review_required",
      message:
        "The configured event or run model budget was exhausted before the model call.",
      details: {
        processorId: args.request.processorId,
        routeId: args.request.routeId,
        estimatedInputTokens: args.request.estimatedInputTokens,
        estimatedOutputTokens: args.request.estimatedOutputTokens,
        chargeKey,
      },
      humanReviewRequired: true,
      publicationBlocking: args.request.failureBlocking,
    };
    return {
      outcome: args.request.failureBlocking ? "blocked" : "skipped",
      output: {
        modelCallInvoked: false,
        budgetBlocked: true,
        deterministicContentRetained: true,
      },
      exceptions: [exception],
    } satisfies CompletionStageExecutionResult;
  }

  if (reservation.exactReplay && reservation.action.status === "succeeded") {
    return {
      outcome: "succeeded",
      output: {
        modelCallInvoked: false,
        exactChargeReplay: true,
        modelActionId: reservation.action.id,
      },
    } satisfies CompletionStageExecutionResult;
  }

  if (!args.executor.executeModel) {
    const failure = {
      message: "The configured completion runtime has no model executor.",
    };
    await args.store.finishModelAction({
      runId: args.context.run.id,
      modelActionId: reservation.action.id,
      status: "failed",
      actualInputTokens: null,
      actualOutputTokens: null,
      providerResponseId: null,
      failure,
      actorIdentity: args.context.actorIdentity,
    });
    return {
      outcome: args.request.failureBlocking ? "blocked" : "skipped",
      output: {
        modelCallInvoked: false,
        deterministicContentRetained: true,
        fallbackBehavior: args.request.fallbackBehavior,
      },
      exceptions: [normalizeModelFailure(args.request, failure)],
    } satisfies CompletionStageExecutionResult;
  }

  try {
    const result = await args.executor.executeModel(args.request, args.context);
    await args.store.finishModelAction({
      runId: args.context.run.id,
      modelActionId: reservation.action.id,
      status: "succeeded",
      actualInputTokens: result.actualInputTokens ?? null,
      actualOutputTokens: result.actualOutputTokens ?? null,
      providerResponseId: result.providerResponseId ?? null,
      failure: null,
      actorIdentity: args.context.actorIdentity,
    });
    return {
      outcome: "succeeded",
      output: {
        modelCallInvoked: true,
        modelActionId: reservation.action.id,
        ...result.output,
      },
      links: result.links,
      exceptions: result.exceptions,
    } satisfies CompletionStageExecutionResult;
  } catch (error) {
    await args.store.finishModelAction({
      runId: args.context.run.id,
      modelActionId: reservation.action.id,
      status: "failed",
      actualInputTokens: null,
      actualOutputTokens: null,
      providerResponseId: null,
      failure: errorRecord(error),
      actorIdentity: args.context.actorIdentity,
    });
    return {
      outcome: args.request.failureBlocking ? "blocked" : "skipped",
      output: {
        modelCallInvoked: true,
        deterministicContentRetained: true,
        fallbackBehavior: args.request.fallbackBehavior,
      },
      error: errorRecord(error),
      exceptions: [normalizeModelFailure(args.request, error)],
    } satisfies CompletionStageExecutionResult;
  }
}

async function processEvent(args: {
  store: CompletionStore;
  executor: CompletionStageExecutor;
  manifest: MichiganCompletionManifest;
  event: MichiganCompletionEventInput;
  initialSnapshot: CompletionRunSnapshot;
  actorIdentity: string;
}) {
  let snapshot = await args.store.getRun(args.initialSnapshot.run.id);
  let runEvent = findRunEvent(snapshot, args.event.eventKey);
  const priorOutputs = priorOutputsForEvent(snapshot, runEvent.id);

  for (const stage of MICHIGAN_COMPLETION_STAGES) {
    const stageInputHash = completionSha256({
      runInputHash: snapshot.run.inputHash,
      eventInputHash: args.event.inputHash,
      stageId: stage.id,
      stageVersion: stage.version,
      prerequisites: stage.prerequisites.map((id) => priorOutputs.get(id) ?? null),
    });
    const existing = snapshot.checkpoints.find(
      (checkpoint) =>
          checkpoint.runEventId === runEvent.id &&
          checkpoint.stageId === stage.id &&
          checkpoint.stageVersion === stage.version &&
          checkpoint.inputHash === stageInputHash &&
          (checkpoint.status === "succeeded" ||
            checkpoint.status === "skipped"),
    );
    if (existing) {
      priorOutputs.set(stage.id, existing.output);
      continue;
    }

    const begun = await stageOperation(
      args.event.eventKey,
      stage.id,
      () => args.store.beginStage({
        runId: snapshot.run.id,
        eventKey: args.event.eventKey,
        stageId: stage.id,
        stageVersion: stage.version,
        inputHash: stageInputHash,
        deterministic: stage.processor !== "model_assisted",
        actorIdentity: args.actorIdentity,
      }),
    );
    if (
      begun.exactReplay &&
      (begun.checkpoint.status === "succeeded" ||
        begun.checkpoint.status === "skipped")
    ) {
      priorOutputs.set(stage.id, begun.checkpoint.output);
      continue;
    }

    let result: CompletionStageExecutionResult;
    const context = {
      run: snapshot.run,
      event: args.event,
      runEvent,
      manifest: args.manifest,
      dryRun: snapshot.run.dryRun,
      deterministicOnly: snapshot.run.deterministicOnly,
      actorIdentity: args.actorIdentity,
      priorOutputs,
      eventExceptions: snapshot.exceptions.filter((exception) =>
        completionExceptionAppliesToEvent(
          exception,
          args.event.eventKey,
        ),
      ),
    };
    try {
      result = await args.executor.execute(stage.id, context);
      if (result.modelRequest) {
        if (snapshot.run.deterministicOnly) {
          result = {
            outcome: "skipped",
            output: {
              modelCallInvoked: false,
              deterministicOnly: true,
              deterministicContentRetained: true,
            },
          };
        } else {
          result = await executeModelRequest({
            store: args.store,
            executor: args.executor,
            request: result.modelRequest,
            context,
            stageId: stage.id,
            stageVersion: stage.version,
          });
        }
      }
    } catch (error) {
      result = {
        outcome: "failed",
        error: errorRecord(error),
        exceptions: [
          {
            code: "unexpected_system_failure",
            classification: "fatal",
            message: errorRecord(error).message,
            details: errorRecord(error),
            fatal: true,
            publicationBlocking: true,
          },
        ],
      };
    }

    await stageOperation(
      args.event.eventKey,
      stage.id,
      () => recordExceptions({
        store: args.store,
        runId: snapshot.run.id,
        eventKey: args.event.eventKey,
        stageId: stage.id,
        exceptions: result.exceptions ?? [],
        actorIdentity: args.actorIdentity,
      }),
    );
    const checkpoint = await stageOperation(
      args.event.eventKey,
      stage.id,
      () => args.store.finishStage({
        runId: snapshot.run.id,
        eventKey: args.event.eventKey,
        stageId: stage.id,
        stageVersion: stage.version,
        status: result.outcome,
        output: result.output ?? {},
        error: result.error ?? null,
        links: result.links ?? {},
        actorIdentity: args.actorIdentity,
      }),
    );
    if (
      checkpoint.status === "succeeded" ||
      checkpoint.status === "skipped"
    ) {
      priorOutputs.set(stage.id, checkpoint.output);
    }
    snapshot = await args.store.getRun(snapshot.run.id);
    runEvent = findRunEvent(snapshot, args.event.eventKey);

    if (
      (result.outcome === "failed" || result.outcome === "blocked") &&
      stage.blocksLaterStages
    ) {
      return;
    }
  }
}

function requestedFinalStatus(snapshot: CompletionRunSnapshot) {
  if (snapshot.events.some((event) => event.status === "failed")) return "failed" as const;
  const openBlocking = snapshot.exceptions.some(
    (exception) =>
      (exception.status === "open" || exception.status === "acknowledged") &&
      exception.publicationBlocking,
  );
  if (openBlocking) return "waiting_for_exceptions" as const;
  if (
    snapshot.events.every(
      (event) =>
        event.readinessState === "review_ready" && event.publicationEligible,
    )
  ) {
    return "ready_for_review" as const;
  }
  if (
    snapshot.events.every((event) =>
      ["completed", "ready_for_review"].includes(event.status),
    )
  ) {
    return "completed" as const;
  }
  return "waiting_for_exceptions" as const;
}

export function buildCompletionRunReport(
  snapshot: CompletionRunSnapshot,
  generatedAt = new Date().toISOString(),
): CompletionRunReport {
  const openExceptions = snapshot.exceptions.filter((exception) =>
    ["open", "acknowledged"].includes(exception.status),
  );
  return {
    schemaVersion: 1,
    generatedAt,
    run: snapshot.run,
    safeguards: {
      publicationInvoked: false,
      automaticImageActionInvoked: false,
      dryRun: snapshot.run.dryRun,
      deterministicOnly: snapshot.run.deterministicOnly,
    },
    counts: {
      events: snapshot.events.length,
      completed: snapshot.events.filter((event) => event.status === "completed").length,
      readyForReview: snapshot.events.filter(
        (event) => event.status === "ready_for_review",
      ).length,
      blocked: snapshot.events.filter(
        (event) => event.status === "waiting_for_exception",
      ).length,
      failed: snapshot.events.filter((event) => event.status === "failed").length,
      openExceptions: openExceptions.length,
      publicationEligible: snapshot.events.filter(
        (event) => event.publicationEligible,
      ).length,
      modelActions: snapshot.modelActions.length,
      modelUsageTokens: snapshot.run.modelUsageTokens,
    },
    events: snapshot.events,
    exceptions: snapshot.exceptions,
    modelActions: snapshot.modelActions,
    failure:
      snapshot.run.status === "failed" && snapshot.run.error
        ? {
            runId: snapshot.run.id,
            manifestHash: snapshot.run.inputHash,
            eventKey:
              typeof snapshot.run.error.eventKey === "string"
                ? snapshot.run.error.eventKey
                : null,
            failedStage:
              typeof snapshot.run.error.failedStage === "string"
                ? snapshot.run.error.failedStage
                : null,
            lastSuccessfulStage:
              typeof snapshot.run.error.lastSuccessfulStage === "string"
                ? snapshot.run.error.lastSuccessfulStage
                : null,
            errorCode:
              typeof snapshot.run.error.code === "string"
                ? snapshot.run.error.code
                : "MICHIGAN_COMPLETION_STAGE_OPERATION_FAILED",
            errorMessage:
              typeof snapshot.run.error.message === "string"
                ? snapshot.run.error.message
                : "Michigan completion execution failed.",
            modelUsage: {
              reservedTokens: snapshot.run.modelReservedTokens,
              usedTokens: snapshot.run.modelUsageTokens,
              actualInputTokens: snapshot.run.actualModelInputTokens,
              actualOutputTokens: snapshot.run.actualModelOutputTokens,
            },
            reportTimestamp: generatedAt,
          }
        : null,
  };
}

export async function executeMichiganCompletionRun(args: {
  store: CompletionStore;
  executor: CompletionStageExecutor;
  manifest?: MichiganCompletionManifest;
  inputHash?: string;
  resumeRunId?: string;
  actorIdentity: string;
  dryRun?: boolean;
  deterministicOnly?: boolean;
  maxConcurrency?: number;
  modelBudgetTokens?: number;
  perEventModelBudgetTokens?: number;
  now?: () => string;
}) {
  let snapshot: CompletionRunSnapshot;
  let manifest = args.manifest;
  if (args.resumeRunId) {
    snapshot = await args.store.resumeRun(args.resumeRunId, args.actorIdentity);
    manifest = manifest ?? snapshot.manifest;
    if (!manifest) {
      throw new Error("The persisted completion run does not expose its immutable manifest.");
    }
  } else {
    if (!manifest || !args.inputHash) {
      throw new Error("A validated manifest and input hash are required to start a run.");
    }
    snapshot = await args.store.startRun({
      stateId: "MI",
      countyCode: manifest.countyCode,
      batchId: manifest.batchId,
      inputManifestVersion: manifest.inputManifestVersion,
      inputHash: args.inputHash,
      orchestratorVersion: MICHIGAN_COMPLETION_ORCHESTRATOR_VERSION,
      dryRun: args.dryRun !== false,
      deterministicOnly: args.deterministicOnly === true,
      maxConcurrency: Math.max(1, Math.min(16, args.maxConcurrency ?? 3)),
      modelBudgetTokens: Math.max(0, args.modelBudgetTokens ?? 0),
      perEventModelBudgetTokens: Math.max(
        0,
        args.perEventModelBudgetTokens ?? 0,
      ),
      actorIdentity: args.actorIdentity,
      events: manifest.events,
    });
    if (snapshot.exactReplay) {
      const report = buildCompletionRunReport(snapshot, args.now?.());
      return {
        snapshot,
        report,
        exitCode:
          snapshot.run.status === "failed"
            ? COMPLETION_EXIT_CODES.failed
            : snapshot.run.status === "waiting_for_exceptions"
              ? COMPLETION_EXIT_CODES.exceptionBlocked
              : COMPLETION_EXIT_CODES.completed,
      };
    }
  }

  try {
    const eventsToProcess = args.resumeRunId
      ? manifest.events.filter((event) => {
          const runEvent = findRunEvent(snapshot, event.eventKey);
          if (["completed", "ready_for_review"].includes(runEvent.status)) {
            return false;
          }
          const blocked = snapshot.exceptions.some(
            (exception) =>
              completionExceptionAppliesToEvent(
                exception,
                event.eventKey,
              ) &&
              isOpenBlockingCompletionException(exception),
          );
          return (
            !blocked ||
            completionEventHasStaleBlockingStage({
              exceptions: snapshot.exceptions,
              eventKey: event.eventKey,
              runEventId: runEvent.id,
              checkpoints: snapshot.checkpoints,
              stages: MICHIGAN_COMPLETION_STAGES,
            })
          );
        })
      : manifest.events;
    await mapWithConcurrency(
      eventsToProcess,
      snapshot.run.maxConcurrency,
      async (event) => {
        await processEvent({
          store: args.store,
          executor: args.executor,
          manifest,
          event,
          initialSnapshot: snapshot,
          actorIdentity: args.actorIdentity,
        });
      },
    );
  } catch (error) {
    const failure = error instanceof CompletionStageOperationError
      ? error
      : new CompletionStageOperationError(
          "",
          "",
          error,
        );
    const retained = await args.store.getRun(snapshot.run.id);
    const failedEvent =
      retained.events.find(
        (event) => event.eventKey === failure.eventKey,
      ) ??
      retained.events.find(
        (event) => event.status === "running" && event.currentStageId,
      ) ??
      retained.events.find((event) => event.currentStageId);
    snapshot = await args.store.finalizeRun({
      runId: retained.run.id,
      requestedStatus: "failed",
      summary: {
        orchestratorVersion: MICHIGAN_COMPLETION_ORCHESTRATOR_VERSION,
        publicationInvoked: false,
        automaticImageActionInvoked: false,
        error: {
          ...failure.failure,
          eventKey: failure.eventKey || failedEvent?.eventKey || null,
          failedStage: failure.stageId || failedEvent?.currentStageId || null,
          lastSuccessfulStage: failedEvent?.lastSuccessfulStageId ?? null,
        },
      },
      actorIdentity: args.actorIdentity,
    });
    return {
      snapshot,
      report: buildCompletionRunReport(snapshot, args.now?.()),
      exitCode: COMPLETION_EXIT_CODES.failed,
    };
  }

  snapshot = await args.store.getRun(snapshot.run.id);
  const finalStatus = requestedFinalStatus(snapshot);
  const failedEvent = finalStatus === "failed"
    ? snapshot.events.find((event) => event.status === "failed")
    : undefined;
  const failedCheckpoint = failedEvent
    ? [...snapshot.checkpoints]
        .reverse()
        .find(
          (checkpoint) =>
            checkpoint.runEventId === failedEvent.id &&
            checkpoint.status === "failed",
        )
    : undefined;
  const retainedFailure = failedCheckpoint?.error ?? {};
  snapshot = await args.store.finalizeRun({
    runId: snapshot.run.id,
    requestedStatus: finalStatus,
    summary: {
      orchestratorVersion: MICHIGAN_COMPLETION_ORCHESTRATOR_VERSION,
      publicationInvoked: false,
      automaticImageActionInvoked: false,
      ...(finalStatus === "failed"
        ? {
            error: {
              code:
                typeof retainedFailure.code === "string"
                  ? retainedFailure.code
                  : "MICHIGAN_COMPLETION_STAGE_FAILED",
              message:
                typeof retainedFailure.message === "string"
                  ? retainedFailure.message
                  : "A Michigan completion stage failed.",
              eventKey: failedEvent?.eventKey ?? null,
              failedStage:
                failedCheckpoint?.stageId ??
                failedEvent?.currentStageId ??
                null,
              lastSuccessfulStage:
                failedEvent?.lastSuccessfulStageId ?? null,
            },
          }
        : {}),
    },
    actorIdentity: args.actorIdentity,
  });
  const report = buildCompletionRunReport(snapshot, args.now?.());
  return {
    snapshot,
    report,
    exitCode:
      finalStatus === "failed"
        ? COMPLETION_EXIT_CODES.failed
        : finalStatus === "waiting_for_exceptions"
          ? COMPLETION_EXIT_CODES.exceptionBlocked
          : COMPLETION_EXIT_CODES.completed,
  };
}

export function completionEventByKey(
  snapshot: CompletionRunSnapshot,
  eventKey: string,
): CompletionRunEvent {
  return findRunEvent(snapshot, eventKey);
}
