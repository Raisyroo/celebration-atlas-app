import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  completionSha256,
  parseMichiganCompletionManifest,
  stableCompletionJson,
} from "../lib/michigan-completion/manifest.ts";
import {
  buildCompletionRunReport,
  COMPLETION_EXIT_CODES,
  completionEventByKey,
  executeMichiganCompletionRun,
} from "../lib/michigan-completion/orchestrator.ts";
import {
  MICHIGAN_COMPLETION_STAGES,
} from "../lib/michigan-completion/stageRegistry.ts";
import type {
  CompletionExceptionInput,
  CompletionExceptionRecord,
  CompletionModelActionRecord,
  CompletionModelRequest,
  CompletionRun,
  CompletionRunEvent,
  CompletionRunReport,
  CompletionRunSnapshot,
  CompletionStageCheckpoint,
  CompletionStageExecutionResult,
  CompletionStageExecutor,
  CompletionStore,
  MichiganCompletionEventInput,
  MichiganCompletionManifest,
  StartCompletionRunInput,
} from "../lib/michigan-completion/types.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/023_michigan_completion_operating_layer.sql",
);
const CORRECTION_MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/024_fix_michigan_completion_run_list_limit.sql",
);
const REVIEW_TYPE_MIGRATION_PATH = path.join(
  ROOT,
  "supabase/migrations/025_allow_michigan_completion_review_items.sql",
);
const FIXED_TIME = "2026-07-28T12:00:00.000Z";
const FIXED_ACTOR = "michigan-completion-validator";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);
const HASH_C = "c".repeat(64);
const SOURCE_DATE_A = "00000000-0000-4000-8000-000000000101";
const SOURCE_DATE_B = "00000000-0000-4000-8000-000000000102";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fixedUuid(sequence: number) {
  return `00000000-0000-4000-8000-${sequence.toString().padStart(12, "0")}`;
}

function expectError(
  operation: () => Promise<unknown>,
  pattern: RegExp,
  message: string,
) {
  return assert.rejects(operation, pattern, message);
}

type MutableSnapshot = CompletionRunSnapshot & {
  manifest: MichiganCompletionManifest;
};

class FixtureCompletionStore implements CompletionStore {
  private sequence = 1;
  private readonly runs = new Map<string, MutableSnapshot>();
  private readonly identities = new Map<
    string,
    { canonicalInput: string; runId: string }
  >();
  private interruptBefore:
    | { eventKey: string; stageId: string; used: boolean }
    | undefined;
  private failExceptionPersistence:
    | { eventKey: string; stageId: string; used: boolean }
    | undefined;

  interruptOnceBefore(eventKey: string, stageId: string) {
    this.interruptBefore = { eventKey, stageId, used: false };
  }

  failExceptionPersistenceOnce(eventKey: string, stageId: string) {
    this.failExceptionPersistence = { eventKey, stageId, used: false };
  }

  private id() {
    return fixedUuid(this.sequence++);
  }

  private snapshot(runId: string) {
    const snapshot = this.runs.get(runId);
    if (!snapshot) throw new Error(`Fixture run ${runId} does not exist.`);
    return snapshot;
  }

  private manifest(input: StartCompletionRunInput): MichiganCompletionManifest {
    return {
      schemaVersion: "michigan-completion-manifest/v1",
      stateId: "MI",
      countyCode: input.countyCode,
      batchId: input.batchId,
      inputManifestVersion: input.inputManifestVersion,
      createdAt: FIXED_TIME,
      events: clone(input.events),
      metadata: { fixture: true },
    };
  }

  async startRun(input: StartCompletionRunInput) {
    const identity = `${input.stateId}:${input.batchId}`;
    const canonicalInput = stableCompletionJson(input);
    const existing = this.identities.get(identity);
    if (existing) {
      if (existing.canonicalInput !== canonicalInput) {
        throw new Error(
          "Completion replay conflict: immutable batch identity has different input.",
        );
      }
      return { ...clone(this.snapshot(existing.runId)), exactReplay: true };
    }

    const runId = this.id();
    const run: CompletionRun = {
      id: runId,
      operationRunId: runId,
      stateId: input.stateId,
      countyCode: input.countyCode,
      batchId: input.batchId,
      inputManifestVersion: input.inputManifestVersion,
      inputHash: input.inputHash,
      orchestratorVersion: input.orchestratorVersion,
      dryRun: input.dryRun,
      deterministicOnly: input.deterministicOnly,
      status: "queued",
      stageCounts: {},
      retryCount: 0,
      maxConcurrency: input.maxConcurrency,
      modelBudgetTokens: input.modelBudgetTokens,
      perEventModelBudgetTokens: input.perEventModelBudgetTokens,
      modelReservedTokens: 0,
      modelUsageTokens: 0,
      estimatedModelInputTokens: 0,
      estimatedModelOutputTokens: 0,
      actualModelInputTokens: 0,
      actualModelOutputTokens: 0,
      exceptionCount: 0,
      publicationEligibilityCount: 0,
      createdAt: FIXED_TIME,
      startedAt: null,
      updatedAt: FIXED_TIME,
      completedAt: null,
      error: null,
    };
    const events: CompletionRunEvent[] = input.events.map((event) => ({
      id: this.id(),
      runId,
      eventKey: event.eventKey,
      sourceRecordId: event.sourceRecordId,
      inputHash: event.inputHash,
      status: "queued",
      currentStageId: null,
      lastSuccessfulStageId: null,
      retryCount: 0,
      modelBudgetTokens: event.perEventModelBudgetTokens,
      modelReservedTokens: 0,
      modelUsageTokens: 0,
      readinessState: "publication_blocked",
      artProvenance: event.artProvenance,
      publicationEligible: false,
      references: clone(event.references),
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
      completedAt: null,
    }));
    const snapshot: MutableSnapshot = {
      run,
      manifest: this.manifest(input),
      events,
      checkpoints: [],
      exceptions: [],
      modelActions: [],
      audit: [
        {
          id: this.id(),
          action: "run_started",
          runId,
          createdAt: FIXED_TIME,
        },
      ],
      exactReplay: false,
    };
    this.runs.set(runId, snapshot);
    this.identities.set(identity, { canonicalInput, runId });
    return clone(snapshot);
  }

  async resumeRun(runId: string, actorIdentity: string) {
    const snapshot = this.snapshot(runId);
    if (snapshot.run.status === "completed" || snapshot.run.status === "cancelled") {
      throw new Error("Completed or cancelled fixture runs cannot be resumed.");
    }
    snapshot.run.status = "running";
    snapshot.run.retryCount += 1;
    snapshot.run.startedAt ??= FIXED_TIME;
    snapshot.run.completedAt = null;
    snapshot.run.error = null;
    snapshot.audit.push({
      id: this.id(),
      action: "run_resumed",
      actorIdentity,
      retryCount: snapshot.run.retryCount,
      createdAt: FIXED_TIME,
    });
    return clone(snapshot);
  }

  async getRun(runId: string) {
    return clone(this.snapshot(runId));
  }

  async beginStage(input: {
    runId: string;
    eventKey: string;
    stageId: string;
    stageVersion: string;
    inputHash: string;
    deterministic: boolean;
    actorIdentity: string;
  }) {
    if (
      this.interruptBefore &&
      !this.interruptBefore.used &&
      this.interruptBefore.eventKey === input.eventKey &&
      this.interruptBefore.stageId === input.stageId
    ) {
      this.interruptBefore.used = true;
      throw new Error("Synthetic mid-event interruption.");
    }

    const snapshot = this.snapshot(input.runId);
    const runEvent = snapshot.events.find(
      (event) => event.eventKey === input.eventKey,
    );
    if (!runEvent) throw new Error(`Fixture event ${input.eventKey} is absent.`);
    const existing = snapshot.checkpoints.find(
      (checkpoint) =>
        checkpoint.runEventId === runEvent.id &&
        checkpoint.stageId === input.stageId &&
        checkpoint.stageVersion === input.stageVersion,
    );
    if (existing) {
      if (existing.inputHash !== input.inputHash) {
        throw new Error("Checkpoint replay conflicts with retained input.");
      }
      return { checkpoint: clone(existing), exactReplay: true };
    }

    snapshot.run.status = "running";
    snapshot.run.startedAt ??= FIXED_TIME;
    runEvent.status = "running";
    runEvent.currentStageId = input.stageId;
    const checkpoint: CompletionStageCheckpoint = {
      id: this.id(),
      runEventId: runEvent.id,
      stageId: input.stageId,
      stageVersion: input.stageVersion,
      status: "running",
      attemptCount: 1,
      inputHash: input.inputHash,
      deterministic: input.deterministic,
      output: {},
      error: null,
      startedAt: FIXED_TIME,
      completedAt: null,
    };
    snapshot.checkpoints.push(checkpoint);
    snapshot.audit.push({
      id: this.id(),
      action: "checkpoint_started",
      eventKey: input.eventKey,
      stageId: input.stageId,
      stageVersion: input.stageVersion,
      inputHash: input.inputHash,
      actorIdentity: input.actorIdentity,
      createdAt: FIXED_TIME,
    });
    return { checkpoint: clone(checkpoint), exactReplay: false };
  }

  async finishStage(input: {
    runId: string;
    eventKey: string;
    stageId: string;
    stageVersion: string;
    status: "succeeded" | "skipped" | "blocked" | "failed";
    output: Record<string, unknown>;
    error: Record<string, unknown> | null;
    links: {
      candidateId?: string | null;
      canonicalEventId?: string | null;
      sourceBundleId?: string | null;
      synthesisId?: string | null;
      verificationCaseId?: string | null;
      packageId?: string | null;
      evidenceId?: string | null;
      readinessState?: CompletionRunEvent["readinessState"];
      artProvenance?: CompletionRunEvent["artProvenance"];
      publicationEligible?: boolean;
    };
    actorIdentity: string;
  }) {
    const snapshot = this.snapshot(input.runId);
    const runEvent = snapshot.events.find(
      (event) => event.eventKey === input.eventKey,
    );
    if (!runEvent) throw new Error(`Fixture event ${input.eventKey} is absent.`);
    const checkpoint = snapshot.checkpoints.find(
      (candidate) =>
        candidate.runEventId === runEvent.id &&
        candidate.stageId === input.stageId &&
        candidate.stageVersion === input.stageVersion,
    );
    if (!checkpoint) throw new Error("Fixture checkpoint was not started.");
    if (checkpoint.status !== "running") {
      const same =
        checkpoint.status === input.status &&
        stableCompletionJson(checkpoint.output) ===
          stableCompletionJson(input.output) &&
        stableCompletionJson(checkpoint.error) ===
          stableCompletionJson(input.error);
      if (!same) throw new Error("Checkpoint finish replay conflicts.");
      return clone(checkpoint);
    }

    checkpoint.status = input.status;
    checkpoint.output = clone(input.output);
    checkpoint.error = clone(input.error);
    checkpoint.completedAt = FIXED_TIME;
    runEvent.currentStageId = input.stageId;
    if (input.status === "succeeded" || input.status === "skipped") {
      runEvent.lastSuccessfulStageId = input.stageId;
    }
    runEvent.references = {
      ...runEvent.references,
      ...Object.fromEntries(
        Object.entries(input.links).filter(
          ([key, value]) =>
            key.endsWith("Id") && value !== undefined,
        ),
      ),
    };
    if (input.links.readinessState) {
      runEvent.readinessState = input.links.readinessState;
    }
    if (input.links.artProvenance) {
      runEvent.artProvenance = input.links.artProvenance;
    }
    if (input.links.publicationEligible !== undefined) {
      runEvent.publicationEligible =
        input.links.publicationEligible &&
        runEvent.readinessState === "review_ready";
    }
    if (input.status === "blocked") {
      runEvent.status = "waiting_for_exception";
    } else if (input.status === "failed") {
      runEvent.status = "failed";
    } else if (input.stageId === "publication_readiness") {
      runEvent.status = runEvent.publicationEligible
        ? "ready_for_review"
        : "completed";
      runEvent.completedAt = FIXED_TIME;
    } else {
      runEvent.status = "running";
    }
    snapshot.audit.push({
      id: this.id(),
      action: "checkpoint_finished",
      eventKey: input.eventKey,
      stageId: input.stageId,
      stageVersion: input.stageVersion,
      status: input.status,
      actorIdentity: input.actorIdentity,
      createdAt: FIXED_TIME,
    });
    this.refreshCounts(snapshot);
    return clone(checkpoint);
  }

  async recordException(input: {
    runId: string;
    eventKey: string | null;
    stageId: string;
    exception: CompletionExceptionInput;
    dedupeKey: string;
    actorIdentity: string;
  }) {
    if (
      this.failExceptionPersistence &&
      !this.failExceptionPersistence.used &&
      this.failExceptionPersistence.eventKey === input.eventKey &&
      this.failExceptionPersistence.stageId === input.stageId
    ) {
      this.failExceptionPersistence.used = true;
      const failure = new Error(
        'new row for relation "atlas_review_items" violates check constraint "atlas_review_items_type_check"',
      ) as Error & { code?: string };
      failure.code = "23514";
      throw failure;
    }
    const snapshot = this.snapshot(input.runId);
    const existing = snapshot.exceptions.find(
      (exception) =>
        exception.details.dedupeKey === input.dedupeKey,
    );
    if (existing) return clone(existing);
    const runEvent = input.eventKey
      ? snapshot.events.find((event) => event.eventKey === input.eventKey)
      : undefined;
    const exception: CompletionExceptionRecord = {
      id: this.id(),
      runId: input.runId,
      runEventId: runEvent?.id ?? null,
      eventKey: input.eventKey,
      stageId: input.stageId,
      code: input.exception.code,
      classification: input.exception.classification,
      status: "open",
      message: input.exception.message,
      details: {
        ...(input.exception.details ?? {}),
        dedupeKey: input.dedupeKey,
        retryable: input.exception.retryable === true,
        modelReviewEligible: input.exception.modelReviewEligible === true,
        humanReviewRequired: input.exception.humanReviewRequired === true,
        fatal: input.exception.fatal === true,
      },
      publicationBlocking: input.exception.publicationBlocking === true,
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
      resolvedAt: null,
    };
    snapshot.exceptions.push(exception);
    snapshot.audit.push({
      id: this.id(),
      action: "exception_created",
      exceptionId: exception.id,
      dedupeKey: input.dedupeKey,
      eventKey: input.eventKey,
      stageId: input.stageId,
      actorIdentity: input.actorIdentity,
      createdAt: FIXED_TIME,
    });
    this.refreshCounts(snapshot);
    return clone(exception);
  }

  async reserveModelAction(input: {
    runId: string;
    eventKey: string;
    stageId: string;
    request: CompletionModelRequest;
    chargeKey: string;
    actorIdentity: string;
  }) {
    const snapshot = this.snapshot(input.runId);
    const existing = snapshot.modelActions.find(
      (action) => action.chargeKey === input.chargeKey,
    );
    if (existing) {
      return {
        action: clone(existing),
        reserved: existing.status !== "budget_blocked",
        exactReplay: true,
      };
    }
    const runEvent = snapshot.events.find(
      (event) => event.eventKey === input.eventKey,
    );
    if (!runEvent) throw new Error(`Fixture event ${input.eventKey} is absent.`);
    const estimate =
      input.request.estimatedInputTokens +
      input.request.estimatedOutputTokens;
    const runCommitted =
      snapshot.run.modelReservedTokens + snapshot.run.modelUsageTokens;
    const eventCommitted =
      runEvent.modelReservedTokens + runEvent.modelUsageTokens;
    const budgetBlocked =
      eventCommitted + estimate > runEvent.modelBudgetTokens ||
      runCommitted + estimate > snapshot.run.modelBudgetTokens;
    const action: CompletionModelActionRecord = {
      id: this.id(),
      runId: input.runId,
      runEventId: runEvent.id,
      eventKey: input.eventKey,
      stageId: input.stageId,
      processorId: input.request.processorId,
      routeId: input.request.routeId,
      configuredModel: input.request.configuredModel,
      status: budgetBlocked ? "budget_blocked" : "reserved",
      chargeKey: input.chargeKey,
      estimatedInputTokens: input.request.estimatedInputTokens,
      estimatedOutputTokens: input.request.estimatedOutputTokens,
      actualInputTokens: null,
      actualOutputTokens: null,
      createdAt: FIXED_TIME,
      completedAt: budgetBlocked ? FIXED_TIME : null,
    };
    snapshot.modelActions.push(action);
    if (!budgetBlocked) {
      snapshot.run.modelReservedTokens += estimate;
      runEvent.modelReservedTokens += estimate;
      snapshot.run.estimatedModelInputTokens +=
        input.request.estimatedInputTokens;
      snapshot.run.estimatedModelOutputTokens +=
        input.request.estimatedOutputTokens;
    }
    snapshot.audit.push({
      id: this.id(),
      action: budgetBlocked
        ? "model_budget_blocked"
        : "model_reserved",
      modelActionId: action.id,
      chargeKey: input.chargeKey,
      eventKey: input.eventKey,
      actorIdentity: input.actorIdentity,
      createdAt: FIXED_TIME,
    });
    this.refreshCounts(snapshot);
    return {
      action: clone(action),
      reserved: !budgetBlocked,
      exactReplay: false,
    };
  }

  async finishModelAction(input: {
    modelActionId: string;
    status: "succeeded" | "failed" | "rejected";
    actualInputTokens: number | null;
    actualOutputTokens: number | null;
    providerResponseId: string | null;
    failure: Record<string, unknown> | null;
    actorIdentity: string;
  }) {
    let owner: MutableSnapshot | undefined;
    let action: CompletionModelActionRecord | undefined;
    for (const snapshot of this.runs.values()) {
      const found = snapshot.modelActions.find(
        (candidate) => candidate.id === input.modelActionId,
      );
      if (found) {
        owner = snapshot;
        action = found;
        break;
      }
    }
    if (!owner || !action) throw new Error("Fixture model action was not found.");
    if (action.status !== "reserved") {
      if (action.status !== input.status) {
        throw new Error("Model finish replay conflicts.");
      }
      return clone(action);
    }
    const runEvent = owner.events.find(
      (event) => event.id === action?.runEventId,
    );
    if (!runEvent) throw new Error("Fixture model event was not found.");
    const estimate =
      action.estimatedInputTokens + action.estimatedOutputTokens;
    const actual =
      (input.actualInputTokens ?? 0) + (input.actualOutputTokens ?? 0);
    action.status = input.status;
    action.actualInputTokens = input.actualInputTokens;
    action.actualOutputTokens = input.actualOutputTokens;
    action.completedAt = FIXED_TIME;
    owner.run.modelReservedTokens -= estimate;
    runEvent.modelReservedTokens -= estimate;
    owner.run.modelUsageTokens += actual;
    runEvent.modelUsageTokens += actual;
    owner.run.actualModelInputTokens += input.actualInputTokens ?? 0;
    owner.run.actualModelOutputTokens += input.actualOutputTokens ?? 0;
    owner.audit.push({
      id: this.id(),
      action: "model_finished",
      modelActionId: action.id,
      status: input.status,
      providerResponseId: input.providerResponseId,
      failure: input.failure,
      actorIdentity: input.actorIdentity,
      createdAt: FIXED_TIME,
    });
    this.refreshCounts(owner);
    return clone(action);
  }

  async finalizeRun(input: {
    runId: string;
    requestedStatus:
      | "waiting_for_exceptions"
      | "ready_for_review"
      | "completed"
      | "failed"
      | "cancelled";
    summary: Record<string, unknown>;
    actorIdentity: string;
  }) {
    const snapshot = this.snapshot(input.runId);
    snapshot.run.status = input.requestedStatus;
    snapshot.run.error =
      input.requestedStatus === "failed" &&
      input.summary.error &&
      typeof input.summary.error === "object" &&
      !Array.isArray(input.summary.error)
        ? clone(input.summary.error as Record<string, unknown>)
        : null;
    snapshot.run.completedAt =
      input.requestedStatus === "completed" ||
      input.requestedStatus === "failed" ||
      input.requestedStatus === "cancelled"
        ? FIXED_TIME
        : null;
    snapshot.audit.push({
      id: this.id(),
      action: "run_finalized",
      status: input.requestedStatus,
      summary: clone(input.summary),
      actorIdentity: input.actorIdentity,
      createdAt: FIXED_TIME,
    });
    this.refreshCounts(snapshot);
    return clone(snapshot);
  }

  private refreshCounts(snapshot: MutableSnapshot) {
    snapshot.run.stageCounts = Object.fromEntries(
      ["queued", "running", "succeeded", "skipped", "blocked", "failed"].map(
        (status) => [
          status,
          snapshot.checkpoints.filter(
            (checkpoint) => checkpoint.status === status,
          ).length,
        ],
      ),
    );
    snapshot.run.exceptionCount = snapshot.exceptions.filter((exception) =>
      exception.status === "open" || exception.status === "acknowledged"
    ).length;
    snapshot.run.publicationEligibilityCount = snapshot.events.filter(
      (event) => event.publicationEligible,
    ).length;
    snapshot.run.updatedAt = FIXED_TIME;
  }
}

type FixtureEffects = {
  candidateWrites: Map<string, number>;
  synthesisWrites: Map<string, number>;
  packageWrites: Map<string, number>;
  modelCalls: Map<string, number>;
  publicationCalls: number;
  materializationCalls: number;
  imageActions: number;
};

function increment(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function createEffects(): FixtureEffects {
  return {
    candidateWrites: new Map(),
    synthesisWrites: new Map(),
    packageWrites: new Map(),
    modelCalls: new Map(),
    publicationCalls: 0,
    materializationCalls: 0,
    imageActions: 0,
  };
}

function modelRequest(eventKey: string): CompletionModelRequest {
  return {
    processorId: "editorial-assistance-v1",
    routeId: `route:${eventKey}`,
    reason: "Deterministic content is factually safe but editorially weak.",
    deterministicPreconditions: {
      deterministicSynthesisRetained: true,
      factualAmbiguity: false,
    },
    modelFamily: "openai",
    configuredModel: "openai/gpt-5.4-mini",
    reasoningLevel: "low",
    maximumAttempts: 1,
    estimatedInputTokens: 6,
    estimatedOutputTokens: 4,
    fallbackBehavior: "retain_deterministic_content",
    failureBlocking: false,
    strength: "economical",
  };
}

function createFixtureExecutor(
  effects: FixtureEffects,
): CompletionStageExecutor {
  const success = (
    output: Record<string, unknown> = {},
  ): CompletionStageExecutionResult => ({ outcome: "succeeded", output });
  return {
    async execute(stageId, context) {
      const eventKey = context.event.eventKey;
      if (stageId === "manifest_validation") {
        if (eventKey === "exception-persistence-failure") {
          return {
            outcome: "blocked",
            output: { valid: false },
            exceptions: [
              {
                code: "invalid_manifest_record",
                classification: "fatal",
                message: "Synthetic exception persistence failure.",
                fatal: true,
                publicationBlocking: true,
              },
            ],
          };
        }
        return success({ valid: true });
      }
      if (stageId === "candidate_staging") {
        increment(effects.candidateWrites, eventKey);
        return {
          ...success({ candidateRetained: true }),
          links: { candidateId: context.event.references.candidateId },
        };
      }
      if (stageId === "identity_matching") {
        if (eventKey === "identity-ambiguity") {
          return {
            outcome: "blocked",
            output: { merged: false, identityInvented: false },
            exceptions: [
              {
                code: "uncertain_identity_match",
                classification: "human_review_required",
                message: "Two retained identities require human review.",
                humanReviewRequired: true,
                publicationBlocking: true,
                details: {
                  candidateIds: [
                    context.event.references.candidateId,
                    fixedUuid(999),
                  ],
                  mergePerformed: false,
                },
              },
            ],
          };
        }
        return success({ uniqueIdentity: true, mergePerformed: false });
      }
      if (stageId === "evidence_readiness") {
        if (eventKey === "date-conflict") {
          return {
            outcome: "blocked",
            output: {
              retainedSourceIds: [SOURCE_DATE_A, SOURCE_DATE_B],
            },
            exceptions: [
              {
                code: "conflicting_event_dates",
                classification: "publication_blocking",
                message: "Retained official sources disagree on current dates.",
                publicationBlocking: true,
                details: {
                  sourceIds: [SOURCE_DATE_A, SOURCE_DATE_B],
                  evidenceRetained: true,
                },
              },
            ],
          };
        }
        return success({ officialSourceReady: true, sourceCount: 2 });
      }
      if (stageId === "deterministic_synthesis") {
        increment(effects.synthesisWrites, eventKey);
        return {
          ...success({
            deterministicContentRetained: true,
            synthesisKind: "deterministic",
          }),
          links: { synthesisId: context.event.references.synthesisId },
        };
      }
      if (stageId === "editorial_assistance") {
        if (context.event.editorialPolicy === "deterministic_only") {
          return {
            outcome: "skipped",
            output: {
              modelCallInvoked: false,
              deterministicContentRetained: true,
            },
          };
        }
        return {
          outcome: "succeeded",
          modelRequest: modelRequest(eventKey),
        };
      }
      if (stageId === "content_readiness") {
        return {
          ...success({
            contentReady: true,
            deterministicContentRetained: true,
          }),
          links: { readinessState: "content_ready" },
        };
      }
      if (stageId === "package_preparation") {
        increment(effects.packageWrites, eventKey);
        const packageId =
          context.event.references.packageId ?? fixedUuid(800);
        return {
          ...success({
            privatePreviewAvailable: true,
            packageId,
            publicationInvoked: false,
          }),
          links: {
            packageId,
            readinessState:
              eventKey === "art-pending" ? "art_pending" : "content_ready",
          },
        };
      }
      if (stageId === "visual_readiness") {
        if (eventKey === "art-pending") {
          return {
            ...success({
              contentWorkRetained: true,
              approvedImagePresent: false,
              imageGenerated: false,
              imageSubstituted: false,
              readinessStatus: "art_pending",
            }),
            links: {
              readinessState: "art_pending",
              artProvenance: "unknown",
              publicationEligible: false,
            },
            exceptions: [
              {
                code: "missing_approved_image",
                classification: "publication_blocking",
                message: "Content is ready; approved art remains pending.",
                publicationBlocking: true,
                details: {
                  imageGenerated: false,
                  imageSubstituted: false,
                  privatePreviewAvailable: true,
                },
              },
            ],
          };
        }
        return success({
          approvedImagePresent: false,
          imageActionInvoked: false,
        });
      }
      if (stageId === "exception_review") {
        if (eventKey === "art-pending") {
          return {
            outcome: "blocked",
            output: {
              publicationBlocked: true,
              contentWorkRetained: true,
            },
          };
        }
        return success({ blockingExceptionPresent: false });
      }
      if (stageId === "publication_readiness") {
        return {
          ...success({
            publicationEligible: false,
            publicationInvoked: false,
            readinessStatus: "content_ready",
          }),
          links: {
            readinessState: "content_ready",
            publicationEligible: false,
          },
        };
      }
      throw new Error(`Unexpected fixture stage ${stageId}.`);
    },
    async executeModel(request, context) {
      increment(effects.modelCalls, context.event.eventKey);
      if (context.event.eventKey === "model-failure") {
        throw new Error("Synthetic bounded model failure.");
      }
      return {
        output: {
          editorialAccepted: true,
          deterministicContentRetained: true,
          routeId: request.routeId,
        },
        providerResponseId: `response:${context.event.eventKey}`,
        actualInputTokens: 5,
        actualOutputTokens: 3,
      };
    },
  };
}

type EventFixtureOptions = {
  policy?: MichiganCompletionEventInput["editorialPolicy"];
  modelBudget?: number;
  artProvenance?: MichiganCompletionEventInput["artProvenance"];
};

type RawEventFixture = Omit<MichiganCompletionEventInput, "inputHash">;

function rawEvent(
  eventKey: string,
  sequence: number,
  options: EventFixtureOptions = {},
): RawEventFixture {
  return {
    eventKey,
    sourceRecordId: `fixture:${eventKey}`,
    displayName: eventKey
      .split("-")
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" "),
    references: {
      candidateId: fixedUuid(1000 + sequence),
      sourceBundleId: fixedUuid(2000 + sequence),
      synthesisId: fixedUuid(3000 + sequence),
      verificationCaseId: fixedUuid(4000 + sequence),
      packageId: fixedUuid(5000 + sequence),
    },
    editorialPolicy: options.policy ?? "deterministic_only",
    perEventModelBudgetTokens: options.modelBudget ?? 100,
    artProvenance: options.artProvenance ?? "unknown",
    metadata: { fixtureSequence: sequence },
  };
}

function fixtureManifest(
  batchId: string,
  events: RawEventFixture[],
) {
  const parsed = parseMichiganCompletionManifest({
    schemaVersion: "michigan-completion-manifest/v1",
    stateId: "MI",
    countyCode: "macomb",
    batchId,
    inputManifestVersion: "fixture-manifest/v1",
    createdAt: FIXED_TIME,
    events,
    metadata: { validator: "michigan-completion-v1" },
  });
  assert.equal(
    parsed.ok,
    true,
    parsed.ok ? undefined : parsed.errors.join(" "),
  );
  return parsed;
}

function auditCount(
  snapshot: CompletionRunSnapshot,
  predicate: (entry: Record<string, unknown>) => boolean,
) {
  return snapshot.audit.filter(predicate).length;
}

function checkpointFor(
  snapshot: CompletionRunSnapshot,
  eventKey: string,
  stageId: string,
) {
  const event = completionEventByKey(snapshot, eventKey);
  return snapshot.checkpoints.find(
    (checkpoint) =>
      checkpoint.runEventId === event.id &&
      checkpoint.stageId === stageId,
  );
}

async function validateStageRegistryAndSourceBoundaries() {
  const expected = [
    "manifest_validation@1",
    "candidate_staging@1",
    "identity_matching@2",
    "evidence_readiness@2",
    "deterministic_synthesis@19",
    "editorial_assistance@1",
    "content_readiness@1",
    "package_preparation@1",
    "visual_readiness@1",
    "exception_review@1",
    "publication_readiness@1",
  ];
  assert.deepEqual(
    MICHIGAN_COMPLETION_STAGES.map(
      (stage) => `${stage.id}@${stage.version}`,
    ),
    expected,
    "The Michigan stage registry order and versions are part of the replay contract.",
  );
  assert.equal(
    new Set(MICHIGAN_COMPLETION_STAGES.map((stage) => stage.id)).size,
    expected.length,
    "Stage identifiers must be unique.",
  );
  for (const stage of MICHIGAN_COMPLETION_STAGES) {
    assert(stage.capability.length > 0);
    assert(stage.idempotencyContract.length > 0);
    assert(stage.completionConditions.length > 0);
    assert(stage.retryBehavior.length > 0);
    assert(stage.exceptionCodes.length > 0);
    assert.notEqual(
      stage.id,
      "publication",
      "Publication itself must never become an orchestrator stage.",
    );
  }

  const [runtimeSource, orchestratorSource, migrationSource] =
    await Promise.all([
      readFile(
        path.join(ROOT, "lib/michigan-completion/runtime.ts"),
        "utf8",
      ),
      readFile(
        path.join(ROOT, "lib/michigan-completion/orchestrator.ts"),
        "utf8",
      ),
      readFile(MIGRATION_PATH, "utf8"),
    ]);
  const combinedRuntime = `${runtimeSource}\n${orchestratorSource}`;
  for (const prohibited of [
    "atlas_activate_event_factory_publication",
    "atlas_finish_event_factory_publication",
    "atlas_publish_event_page_version",
    "atlas_materialize_event_factory_package",
    "image_gen",
    "generateImage",
    "atlas_upsert_event_visual_workflow",
  ]) {
    assert.equal(
      combinedRuntime.includes(prohibited),
      false,
      `Completion runtime must not invoke ${prohibited}.`,
    );
  }
  for (const prohibited of [
    "create or replace function public.atlas_activate_event_factory_publication",
    "create or replace function public.atlas_materialize_event_factory_package",
    "create table public.michigan_events",
    "create table public.atlas_completion_runs",
  ]) {
    assert.equal(
      migrationSource.toLowerCase().includes(prohibited),
      false,
      `Migration 023 must not introduce prohibited object: ${prohibited}.`,
    );
  }
}

async function validateAttachmentCasesAThroughE() {
  const parsed = fixtureManifest("macomb-a-e", [
    rawEvent("clean-event", 1),
    rawEvent("identity-ambiguity", 2),
    rawEvent("date-conflict", 3),
    rawEvent("art-pending", 4),
    rawEvent("model-success", 5, {
      policy: "economical_if_needed",
      modelBudget: 100,
    }),
    rawEvent("event-budget-exceeded", 6, {
      policy: "economical_if_needed",
      modelBudget: 5,
    }),
    rawEvent("run-budget-exceeded", 7, {
      policy: "economical_if_needed",
      modelBudget: 100,
    }),
  ]);
  const store = new FixtureCompletionStore();
  const effects = createEffects();
  const result = await executeMichiganCompletionRun({
    store,
    executor: createFixtureExecutor(effects),
    manifest: parsed.value,
    inputHash: parsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: false,
    maxConcurrency: 1,
    modelBudgetTokens: 15,
    perEventModelBudgetTokens: 100,
    now: () => FIXED_TIME,
  });
  const snapshot = result.snapshot;

  // A. Clean event: deterministic completion, no model, private content, no publish.
  const clean = completionEventByKey(snapshot, "clean-event");
  assert.equal(clean.status, "completed");
  assert.equal(clean.readinessState, "content_ready");
  assert.equal(clean.publicationEligible, false);
  assert.equal(effects.modelCalls.get("clean-event") ?? 0, 0);
  assert.equal(
    checkpointFor(snapshot, "clean-event", "package_preparation")?.output
      .privatePreviewAvailable,
    true,
  );
  assert.equal(effects.publicationCalls, 0);
  assert.equal(effects.materializationCalls, 0);

  // B. Identity ambiguity: human review, no invented merge, other records continue.
  const ambiguity = completionEventByKey(snapshot, "identity-ambiguity");
  assert.equal(ambiguity.status, "waiting_for_exception");
  const ambiguityException = snapshot.exceptions.find(
    (exception) =>
      exception.eventKey === "identity-ambiguity" &&
      exception.code === "uncertain_identity_match",
  );
  assert(ambiguityException);
  assert.equal(ambiguityException.classification, "human_review_required");
  assert.equal(ambiguityException.publicationBlocking, true);
  assert.equal(
    checkpointFor(snapshot, "identity-ambiguity", "identity_matching")?.output
      .merged,
    false,
  );
  assert.equal(
    completionEventByKey(snapshot, "model-success").status,
    "completed",
    "An ambiguous identity must not stop later batch records.",
  );

  // C. Conflicting dates: exception retains source IDs and blocks readiness.
  const dateConflict = completionEventByKey(snapshot, "date-conflict");
  assert.equal(dateConflict.status, "waiting_for_exception");
  assert.equal(dateConflict.publicationEligible, false);
  const dateException = snapshot.exceptions.find(
    (exception) =>
      exception.eventKey === "date-conflict" &&
      exception.code === "conflicting_event_dates",
  );
  assert(dateException);
  assert.deepEqual(dateException.details.sourceIds, [
    SOURCE_DATE_A,
    SOURCE_DATE_B,
  ]);
  assert.equal(dateException.details.evidenceRetained, true);
  assert.deepEqual(
    checkpointFor(snapshot, "date-conflict", "evidence_readiness")?.output
      .retainedSourceIds,
    [SOURCE_DATE_A, SOURCE_DATE_B],
  );
  assert.equal(
    checkpointFor(snapshot, "date-conflict", "publication_readiness"),
    undefined,
  );

  // D. Art pending: content and private preview survive; no image action; publish blocked.
  const artPending = completionEventByKey(snapshot, "art-pending");
  assert.equal(artPending.readinessState, "art_pending");
  assert.equal(artPending.status, "waiting_for_exception");
  assert.equal(artPending.publicationEligible, false);
  assert.equal(
    checkpointFor(snapshot, "art-pending", "content_readiness")?.output
      .contentReady,
    true,
  );
  assert.equal(
    checkpointFor(snapshot, "art-pending", "package_preparation")?.output
      .privatePreviewAvailable,
    true,
  );
  assert.equal(
    checkpointFor(snapshot, "art-pending", "visual_readiness")?.output
      .imageGenerated,
    false,
  );
  assert.equal(
    checkpointFor(snapshot, "art-pending", "visual_readiness")?.output
      .imageSubstituted,
    false,
  );
  assert.equal(effects.imageActions, 0);
  assert(
    snapshot.exceptions.some(
      (exception) =>
        exception.eventKey === "art-pending" &&
        exception.code === "missing_approved_image" &&
        exception.publicationBlocking,
    ),
  );

  // E. Event and run budgets block calls without stopping deterministic records.
  assert.equal(
    effects.modelCalls.get("model-success"),
    1,
    "The first bounded editorial route establishes committed run usage.",
  );
  assert.equal(effects.modelCalls.get("event-budget-exceeded") ?? 0, 0);
  assert.equal(effects.modelCalls.get("run-budget-exceeded") ?? 0, 0);
  for (const eventKey of [
    "event-budget-exceeded",
    "run-budget-exceeded",
  ]) {
    assert.equal(
      completionEventByKey(snapshot, eventKey).status,
      "completed",
      "Budget exhaustion must not discard or stop deterministic content.",
    );
    assert.equal(
      checkpointFor(snapshot, eventKey, "deterministic_synthesis")?.output
        .deterministicContentRetained,
      true,
    );
    assert(
      snapshot.exceptions.some(
        (exception) =>
          exception.eventKey === eventKey &&
          exception.code === "model_budget_exceeded",
      ),
    );
    assert(
      snapshot.modelActions.some(
        (action) =>
          action.eventKey === eventKey &&
          action.status === "budget_blocked",
      ),
    );
  }
  assert.equal(snapshot.run.modelUsageTokens, 8);
  assert.equal(snapshot.run.modelReservedTokens, 0);
  assert.equal(result.report.safeguards.publicationInvoked, false);
  assert.equal(result.report.safeguards.automaticImageActionInvoked, false);

  const report = buildCompletionRunReport(snapshot, FIXED_TIME);
  const stableReport = stableCompletionJson(report);
  assert.equal(stableReport, stableCompletionJson(report));
  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "atlas-michigan-completion-"),
  );
  try {
    const reportPath = path.join(temporaryDirectory, "run-report.json");
    await writeFile(reportPath, `${stableReport}\n`, "utf8");
    assert.equal(await readFile(reportPath, "utf8"), `${stableReport}\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

async function validateCasesFThroughHAndModelFallback() {
  // F. Resume begins after the last successful checkpoint and does not repeat effects.
  const resumeParsed = fixtureManifest("macomb-resume", [
    rawEvent("resume-event", 20),
  ]);
  const resumeStore = new FixtureCompletionStore();
  const resumeEffects = createEffects();
  resumeStore.interruptOnceBefore(
    "resume-event",
    "deterministic_synthesis",
  );
  const interruptedResult = await executeMichiganCompletionRun({
    store: resumeStore,
    executor: createFixtureExecutor(resumeEffects),
    manifest: resumeParsed.value,
    inputHash: resumeParsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: true,
    maxConcurrency: 1,
    modelBudgetTokens: 0,
    perEventModelBudgetTokens: 0,
    now: () => FIXED_TIME,
  });
  assert.equal(interruptedResult.exitCode, COMPLETION_EXIT_CODES.failed);
  assert.equal(interruptedResult.snapshot.run.status, "failed");
  const interrupted = await resumeStore.getRun(fixedUuid(1));
  assert.equal(
    completionEventByKey(interrupted, "resume-event").lastSuccessfulStageId,
    "evidence_readiness",
  );
  const resumed = await executeMichiganCompletionRun({
    store: resumeStore,
    executor: createFixtureExecutor(resumeEffects),
    resumeRunId: interrupted.run.id,
    actorIdentity: FIXED_ACTOR,
    now: () => FIXED_TIME,
  });
  assert.equal(resumed.snapshot.run.retryCount, 1);
  assert.equal(
    completionEventByKey(resumed.snapshot, "resume-event").status,
    "completed",
  );
  assert.equal(resumeEffects.candidateWrites.get("resume-event"), 1);
  assert.equal(resumeEffects.synthesisWrites.get("resume-event"), 1);
  assert.equal(resumeEffects.packageWrites.get("resume-event"), 1);
  for (const stage of MICHIGAN_COMPLETION_STAGES) {
    const event = completionEventByKey(resumed.snapshot, "resume-event");
    assert.equal(
      resumed.snapshot.checkpoints.filter(
        (checkpoint) =>
          checkpoint.runEventId === event.id &&
          checkpoint.stageId === stage.id,
      ).length,
      1,
      `Resume duplicated checkpoint ${stage.id}.`,
    );
  }
  assert.equal(
    new Set(
      resumed.snapshot.audit.map((entry) => String(entry.id)),
    ).size,
    resumed.snapshot.audit.length,
    "Resume audit rows must be append-only and uniquely identified.",
  );
  assert.equal(
    auditCount(
      resumed.snapshot,
      (entry) =>
        entry.action === "checkpoint_finished" &&
        entry.stageId === "candidate_staging",
    ),
    1,
  );

  // G. Exact replay performs no duplicate work or model charge.
  const replayParsed = fixtureManifest("macomb-exact-replay", [
    rawEvent("charged-event", 30, {
      policy: "economical_if_needed",
      modelBudget: 100,
    }),
  ]);
  const replayStore = new FixtureCompletionStore();
  const replayEffects = createEffects();
  const replayExecutor = createFixtureExecutor(replayEffects);
  const first = await executeMichiganCompletionRun({
    store: replayStore,
    executor: replayExecutor,
    manifest: replayParsed.value,
    inputHash: replayParsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: false,
    maxConcurrency: 1,
    modelBudgetTokens: 100,
    perEventModelBudgetTokens: 100,
    now: () => FIXED_TIME,
  });
  const auditBeforeReplay = first.snapshot.audit.length;
  const exactReplay = await executeMichiganCompletionRun({
    store: replayStore,
    executor: replayExecutor,
    manifest: replayParsed.value,
    inputHash: replayParsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: false,
    maxConcurrency: 1,
    modelBudgetTokens: 100,
    perEventModelBudgetTokens: 100,
    now: () => FIXED_TIME,
  });
  assert.equal(exactReplay.snapshot.exactReplay, true);
  assert.equal(exactReplay.snapshot.audit.length, auditBeforeReplay);
  assert.equal(replayEffects.candidateWrites.get("charged-event"), 1);
  assert.equal(replayEffects.synthesisWrites.get("charged-event"), 1);
  assert.equal(replayEffects.packageWrites.get("charged-event"), 1);
  assert.equal(replayEffects.modelCalls.get("charged-event"), 1);
  assert.equal(exactReplay.snapshot.modelActions.length, 1);
  assert.equal(
    new Set(exactReplay.snapshot.modelActions.map((action) => action.chargeKey))
      .size,
    1,
  );

  // H. The same immutable state/batch identity rejects changed content.
  const conflicting = fixtureManifest("macomb-exact-replay", [
    {
      ...rawEvent("charged-event", 30, {
        policy: "economical_if_needed",
        modelBudget: 100,
      }),
      metadata: { fixtureSequence: 30, changed: true },
    },
  ]);
  assert.notEqual(conflicting.inputHash, replayParsed.inputHash);
  await expectError(
    () =>
      executeMichiganCompletionRun({
        store: replayStore,
        executor: replayExecutor,
        manifest: conflicting.value,
        inputHash: conflicting.inputHash,
        actorIdentity: FIXED_ACTOR,
        dryRun: true,
        deterministicOnly: false,
        maxConcurrency: 1,
        modelBudgetTokens: 100,
        perEventModelBudgetTokens: 100,
        now: () => FIXED_TIME,
      }),
    /replay conflict/i,
    "Changed content under the same immutable batch identity must fail.",
  );

  // Model failure remains bounded and keeps deterministic content available.
  const failureParsed = fixtureManifest("macomb-model-failure", [
    rawEvent("model-failure", 40, {
      policy: "economical_if_needed",
      modelBudget: 100,
    }),
  ]);
  const failureStore = new FixtureCompletionStore();
  const failureEffects = createEffects();
  const failedModel = await executeMichiganCompletionRun({
    store: failureStore,
    executor: createFixtureExecutor(failureEffects),
    manifest: failureParsed.value,
    inputHash: failureParsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: false,
    maxConcurrency: 1,
    modelBudgetTokens: 100,
    perEventModelBudgetTokens: 100,
    now: () => FIXED_TIME,
  });
  assert.equal(failureEffects.modelCalls.get("model-failure"), 1);
  assert.equal(
    checkpointFor(
      failedModel.snapshot,
      "model-failure",
      "editorial_assistance",
    )?.output.deterministicContentRetained,
    true,
  );
  assert.equal(
    completionEventByKey(failedModel.snapshot, "model-failure").status,
    "completed",
  );
  assert(
    failedModel.snapshot.exceptions.some(
      (exception) =>
        exception.eventKey === "model-failure" &&
        exception.code === "editorial_quality_failure",
    ),
  );
}

async function validateTerminalFailureAndStructuredReport() {
  const parsed = fixtureManifest("macomb-failure-report", [
    rawEvent("exception-persistence-failure", 60),
  ]);
  const store = new FixtureCompletionStore();
  store.failExceptionPersistenceOnce(
    "exception-persistence-failure",
    "manifest_validation",
  );
  const effects = createEffects();

  const result = await executeMichiganCompletionRun({
    store,
    executor: createFixtureExecutor(effects),
    manifest: parsed.value,
    inputHash: parsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: true,
    maxConcurrency: 1,
    modelBudgetTokens: 0,
    perEventModelBudgetTokens: 0,
    now: () => FIXED_TIME,
  });

  assert.equal(result.exitCode, COMPLETION_EXIT_CODES.failed);
  assert.equal(result.snapshot.run.status, "failed");
  assert.equal(result.snapshot.run.completedAt, FIXED_TIME);
  assert.equal(result.snapshot.run.error?.code, "23514");
  assert.equal(result.report.failure?.runId, result.snapshot.run.id);
  assert.equal(result.report.failure?.manifestHash, parsed.inputHash);
  assert.equal(result.report.failure?.eventKey, "exception-persistence-failure");
  assert.equal(result.report.failure?.failedStage, "manifest_validation");
  assert.equal(result.report.failure?.lastSuccessfulStage, null);
  assert.equal(result.report.failure?.errorCode, "23514");
  assert.equal(result.report.failure?.modelUsage.usedTokens, 0);
  assert.equal(result.report.failure?.reportTimestamp, FIXED_TIME);
  assert.equal(
    auditCount(
      result.snapshot,
      (entry) =>
        entry.action === "run_finalized" &&
        entry.status === "failed",
    ),
    1,
    "A stage-operation failure must append one terminal failure action.",
  );
  assert.equal(effects.candidateWrites.size, 0);
  assert.equal(effects.synthesisWrites.size, 0);
  assert.equal(effects.packageWrites.size, 0);
  assert.equal(effects.modelCalls.size, 0);
  assert.equal(effects.publicationCalls, 0);
  assert.equal(effects.materializationCalls, 0);
  assert.equal(effects.imageActions, 0);

  const temporaryDirectory = await mkdtemp(
    path.join(os.tmpdir(), "atlas-michigan-completion-failure-"),
  );
  try {
    const reportPath = path.join(temporaryDirectory, "run-report.json");
    await writeFile(
      reportPath,
      `${stableCompletionJson(result.report)}\n`,
      "utf8",
    );
    const retainedReport = JSON.parse(
      await readFile(reportPath, "utf8"),
    ) as CompletionRunReport;
    assert.deepEqual(retainedReport.failure, result.report.failure);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }

  const auditBeforeExactReplay = result.snapshot.audit.length;
  const exactReplay = await executeMichiganCompletionRun({
    store,
    executor: createFixtureExecutor(effects),
    manifest: parsed.value,
    inputHash: parsed.inputHash,
    actorIdentity: FIXED_ACTOR,
    dryRun: true,
    deterministicOnly: true,
    maxConcurrency: 1,
    modelBudgetTokens: 0,
    perEventModelBudgetTokens: 0,
    now: () => FIXED_TIME,
  });
  assert.equal(exactReplay.snapshot.exactReplay, true);
  assert.equal(exactReplay.exitCode, COMPLETION_EXIT_CODES.failed);
  assert.equal(exactReplay.snapshot.audit.length, auditBeforeExactReplay);
  assert.equal(exactReplay.snapshot.exceptions.length, 0);
  assert.equal(effects.candidateWrites.size, 0);
  assert.equal(effects.synthesisWrites.size, 0);
  assert.equal(effects.packageWrites.size, 0);
  assert.equal(effects.modelCalls.size, 0);
}

async function one(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>> {
  const result = await db.query(sql, params);
  assert.equal(result.rows.length, 1, `Expected exactly one row from:\n${sql}`);
  return result.rows[0] as Record<string, unknown>;
}

async function scalar(
  db: PGlite,
  sql: string,
  params: unknown[] = [],
) {
  return Object.values(await one(db, sql, params))[0];
}

function jsonValue(row: Record<string, unknown>) {
  const value = Object.values(row)[0];
  assert(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}

async function expectDatabaseError(
  db: PGlite,
  sql: string,
  params: unknown[],
  pattern: RegExp,
  message: string,
) {
  await assert.rejects(
    () => db.query(sql, params),
    pattern,
    message,
  );
}

const PREDECESSOR_SCHEMA = `
  create role browser_public nologin;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create table public.events (
    id uuid primary key default gen_random_uuid()
  );

  create table public.event_candidates (
    id uuid primary key default gen_random_uuid()
  );

  create table public.atlas_operation_runs (
    id uuid primary key default gen_random_uuid(),
    operation_type text not null check (
      nullif(pg_catalog.btrim(operation_type), '') is not null
    ),
    actor_type text not null check (
      actor_type in ('human', 'automation', 'system')
    ),
    actor_identity text not null check (
      nullif(pg_catalog.btrim(actor_identity), '') is not null
    ),
    status text not null default 'planned' check (
      status in ('planned', 'running', 'succeeded', 'partial', 'failed', 'cancelled')
    ),
    idempotency_key text not null check (
      nullif(pg_catalog.btrim(idempotency_key), '') is not null
    ),
    request jsonb not null default '{}'::jsonb,
    summary jsonb not null default '{}'::jsonb,
    error jsonb,
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (operation_type, idempotency_key),
    check (
      completed_at is null
      or started_at is null
      or completed_at >= started_at
    )
  );

  create table public.atlas_operation_actions (
    id uuid primary key default gen_random_uuid(),
    operation_run_id uuid not null
      references public.atlas_operation_runs(id) on delete cascade,
    action_type text not null check (
      nullif(pg_catalog.btrim(action_type), '') is not null
    ),
    target_entity_type text,
    target_entity_id text,
    lifecycle_state text not null default 'proposed' check (
      lifecycle_state in ('proposed', 'applied', 'skipped', 'blocked', 'failed')
    ),
    source_references jsonb not null default '[]'::jsonb check (
      pg_catalog.jsonb_typeof(source_references) = 'array'
    ),
    requested_payload jsonb not null default '{}'::jsonb,
    before_snapshot jsonb,
    applied_payload jsonb,
    after_snapshot jsonb,
    reason text,
    warnings jsonb not null default '[]'::jsonb check (
      pg_catalog.jsonb_typeof(warnings) = 'array'
    ),
    failure jsonb,
    applied_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create table public.atlas_review_items (
    id uuid primary key default gen_random_uuid(),
    operation_run_id uuid
      references public.atlas_operation_runs(id) on delete cascade,
    operation_action_id uuid
      references public.atlas_operation_actions(id) on delete set null,
    review_type text not null,
    event_id uuid references public.events(id) on delete set null,
    candidate_id uuid references public.event_candidates(id) on delete set null,
    priority integer not null default 1,
    status text not null default 'open' check (
      status in ('open', 'resolved', 'dismissed')
    ),
    evidence jsonb not null default '{}'::jsonb,
    recommended_action text not null,
    resolution_details jsonb,
    resolved_by text,
    resolved_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  alter table public.atlas_review_items
    add constraint atlas_review_items_type_check check (
      review_type = any (
        array[
          'ambiguous_event_match'::text,
          'duplicate_risk'::text,
          'conflicting_source_data'::text,
          'missing_or_non_official_source'::text,
          'suspicious_date_location_change'::text,
          'media_collision'::text,
          'policy_or_validation_block'::text,
          'other'::text
        ]
      )
    );

  alter table public.atlas_operation_runs enable row level security;
  alter table public.atlas_operation_actions enable row level security;
  alter table public.atlas_review_items enable row level security;

  revoke all on table public.atlas_operation_runs
    from public, browser_public, anon, authenticated, service_role;
  revoke all on table public.atlas_operation_actions
    from public, browser_public, anon, authenticated, service_role;
  revoke all on table public.atlas_review_items
    from public, browser_public, anon, authenticated, service_role;
  grant select on table public.atlas_operation_runs to service_role;
  grant select on table public.atlas_operation_actions to service_role;
  grant select on table public.atlas_review_items to service_role;

  create or replace function public.atlas_assert_service_role()
  returns void
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    if session_user in ('postgres', 'service_role') then
      return;
    end if;
    raise exception 'service role required' using errcode = '42501';
  end;
  $$;

  revoke all on function public.atlas_assert_service_role()
    from public, browser_public, anon, authenticated;
  grant execute on function public.atlas_assert_service_role()
    to service_role;
`;

const START_RUN_SQL = `
  select public.atlas_start_michigan_completion_run(
    $1::text,
    $2::text,
    $3::text,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::boolean,
    $10::boolean,
    $11::integer,
    $12::jsonb,
    $13::jsonb,
    $14::jsonb
  ) as result
`;

async function startDatabaseRun(
  db: PGlite,
  inputHash = HASH_A,
  events?: Array<Record<string, unknown>>,
  batchId = "sql-fixture-batch",
) {
  return jsonValue(
    await one(db, START_RUN_SQL, [
      "automation",
      FIXED_ACTOR,
      "MI",
      "macomb",
      batchId,
      "sql-manifest/v1",
      inputHash,
      "sql-validator/1",
      true,
      false,
      1,
      JSON.stringify({
        inputTokens: 10,
        outputTokens: 8,
        costMicros: 1000,
      }),
      JSON.stringify({
        inputTokens: 8,
        outputTokens: 6,
        costMicros: 1000,
      }),
      JSON.stringify(
        events ?? [
          {
            eventKey: "sql-clean",
            inputHash: HASH_B,
            readinessStatus: "publication_blocked",
            artProvenance: "unknown",
          },
          {
            eventKey: "sql-second",
            inputHash: HASH_C,
            readinessStatus: "publication_blocked",
            artProvenance: "unknown",
          },
        ],
      ),
    ]),
  );
}

const CHECKPOINT_SQL = `
  select public.atlas_record_michigan_completion_checkpoint(
    $1::uuid,
    $2::text,
    $3::text,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::text,
    $10::jsonb,
    $11::jsonb,
    $12::jsonb,
    $13::jsonb
  ) as result
`;

async function recordDatabaseCheckpoint(
  db: PGlite,
  runId: string,
  input: {
    eventKey: string;
    stageId: string;
    stageVersion?: string;
    checkpointKey?: string;
    actionKey?: string;
    status?: string;
    output?: Record<string, unknown>;
    links?: Record<string, unknown>;
    failure?: Record<string, unknown> | null;
  },
) {
  const stageVersion = input.stageVersion ?? "1";
  const checkpointKey =
    input.checkpointKey ?? `${input.stageId}@${stageVersion}`;
  const status = input.status ?? "succeeded";
  const actionKey =
    input.actionKey ??
    `${input.eventKey}:${checkpointKey}:${status}`;
  return jsonValue(
    await one(db, CHECKPOINT_SQL, [
      runId,
      FIXED_ACTOR,
      input.eventKey,
      input.stageId,
      stageVersion,
      completionSha256({
        eventKey: input.eventKey,
        stageId: input.stageId,
        stageVersion,
      }),
      checkpointKey,
      actionKey,
      status,
      JSON.stringify(input.output ?? {}),
      JSON.stringify(input.links ?? {}),
      JSON.stringify([]),
      input.failure === null || input.failure === undefined
        ? null
        : JSON.stringify(input.failure),
    ]),
  );
}

const EXCEPTION_SQL = `
  select public.atlas_record_michigan_completion_exception(
    $1::uuid,
    $2::text,
    $3::text,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::jsonb,
    $10::jsonb,
    $11::text
  ) as result
`;

const RESERVE_MODEL_SQL = `
  select public.atlas_reserve_michigan_completion_model_action(
    $1::uuid,
    $2::text,
    $3::text,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::jsonb,
    $10::text,
    $11::text,
    $12::text,
    $13::integer,
    $14::integer,
    $15::bigint,
    $16::bigint,
    $17::bigint,
    $18::text,
    $19::boolean
  ) as result
`;

async function reserveDatabaseModel(
  db: PGlite,
  runId: string,
  input: {
    eventKey: string;
    chargeKey: string;
    estimatedInput: number;
    estimatedOutput: number;
  },
) {
  return jsonValue(
    await one(db, RESERVE_MODEL_SQL, [
      runId,
      FIXED_ACTOR,
      input.eventKey,
      "editorial_assistance",
      input.chargeKey,
      "editorial-assistance-v1",
      "economical-safe-prose",
      "Deterministic copy is safe but weak.",
      JSON.stringify({
        deterministicSynthesisAttempted: true,
        immutableFactsLocked: true,
      }),
      "openai",
      "openai/gpt-5.4-mini",
      "low",
      1,
      1,
      input.estimatedInput,
      input.estimatedOutput,
      100,
      "retain_deterministic_content",
      false,
    ]),
  );
}

async function validateMigrationLifecycleAndSecurity() {
  const migration = await readFile(MIGRATION_PATH, "utf8");
  const correctionMigration = await readFile(
    CORRECTION_MIGRATION_PATH,
    "utf8",
  );
  const reviewTypeMigration = await readFile(
    REVIEW_TYPE_MIGRATION_PATH,
    "utf8",
  );
  assert.doesNotMatch(
    correctionMigration,
    /pg_catalog\.(?:least|greatest)\s*\(/i,
    "The hosted-Postgres list correction must not schema-qualify LEAST/GREATEST.",
  );
  const db = new PGlite();
  try {
    await db.exec(PREDECESSOR_SCHEMA);
    await db.exec(migration);
    await db.exec(correctionMigration);
    await db.exec(reviewTypeMigration);

    const candidateId = fixedUuid(7001);
    const eventId = fixedUuid(7002);
    await db.query(
      "insert into public.event_candidates (id) values ($1::uuid)",
      [candidateId],
    );
    await db.query(
      "insert into public.events (id) values ($1::uuid)",
      [eventId],
    );

    // A and B: reproduce the deployed allowlist, then prove the forward repair
    // accepts the exact private type and retains its run/candidate/stage links.
    const macRun = await startDatabaseRun(
      db,
      HASH_B,
      [
        {
          eventKey: "MAC-042",
          inputHash: HASH_C,
          readinessStatus: "publication_blocked",
          artProvenance: "unknown",
          references: { candidateId },
        },
      ],
      "mac-042-review-constraint",
    );
    const uncertainIdentity = jsonValue(
      await one(db, EXCEPTION_SQL, [
        macRun.runId,
        FIXED_ACTOR,
        "MAC-042",
        "identity_matching",
        "uncertain_identity_match",
        "human_review_required",
        "mac-042-uncertain-identity",
        "The retained candidate requires identity review.",
        JSON.stringify({
          humanReviewRequired: true,
          publicationBlocking: false,
        }),
        JSON.stringify({ candidateId }),
        "Review the retained candidate identity before continuing.",
      ]),
    );
    const uncertainReplay = jsonValue(
      await one(db, EXCEPTION_SQL, [
        macRun.runId,
        FIXED_ACTOR,
        "MAC-042",
        "identity_matching",
        "uncertain_identity_match",
        "human_review_required",
        "mac-042-uncertain-identity",
        "The retained candidate requires identity review.",
        JSON.stringify({
          humanReviewRequired: true,
          publicationBlocking: false,
        }),
        JSON.stringify({ candidateId }),
        "Review the retained candidate identity before continuing.",
      ]),
    );
    assert.equal(uncertainIdentity.exactReplay, false);
    assert.equal(uncertainReplay.exactReplay, true);
    assert.equal(uncertainReplay.reviewItemId, uncertainIdentity.reviewItemId);
    const uncertainRow = await one(
      db,
      `
        select operation_run_id, candidate_id, review_type,
               evidence->>'eventKey' as event_key,
               evidence->>'stageId' as stage_id,
               evidence->>'exceptionCode' as exception_code
        from public.atlas_review_items
        where id = $1::uuid
      `,
      [uncertainIdentity.reviewItemId],
    );
    assert.equal(uncertainRow.operation_run_id, macRun.runId);
    assert.equal(uncertainRow.candidate_id, candidateId);
    assert.equal(uncertainRow.review_type, "michigan_completion_exception");
    assert.equal(uncertainRow.event_key, "MAC-042");
    assert.equal(uncertainRow.stage_id, "identity_matching");
    assert.equal(uncertainRow.exception_code, "uncertain_identity_match");
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_review_items
            where operation_run_id = $1::uuid
              and review_type = 'michigan_completion_exception'
          `,
          [macRun.runId],
        ),
      ),
      1,
      "Exact exception replay must not duplicate the review item.",
    );
    await expectDatabaseError(
      db,
      `
        insert into public.atlas_review_items (
          review_type, recommended_action
        ) values (
          'arbitrary_text', 'Must remain rejected.'
        )
      `,
      [],
      /atlas_review_items_type_check/i,
      "The repaired constraint must continue to reject arbitrary text.",
    );

    // H and G at the SQL boundary: exact replay is stable; conflicting input fails.
    const started = await startDatabaseRun(db);
    const runId = String(started.runId);
    assert.equal(started.exactReplay, false);
    assert.equal(started.status, "queued");
    const exactStart = await startDatabaseRun(db);
    assert.equal(exactStart.exactReplay, true);
    assert.equal(exactStart.runId, runId);
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_operation_runs
            where operation_type = 'michigan_completion_v1'
              and request->>'batchIdentity' = 'sql-fixture-batch'
          `,
        ),
      ),
      1,
    );
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_operation_actions
            where operation_run_id = $1::uuid
              and action_type = 'michigan_completion_run_started'
          `,
          [runId],
        ),
      ),
      1,
    );
    await expectDatabaseError(
      db,
      START_RUN_SQL,
      [
        "automation",
        FIXED_ACTOR,
        "MI",
        "macomb",
        "sql-fixture-batch",
        "sql-manifest/v1",
        HASH_C,
        "sql-validator/1",
        true,
        false,
        1,
        JSON.stringify({
          inputTokens: 10,
          outputTokens: 8,
          costMicros: 1000,
        }),
        JSON.stringify({
          inputTokens: 8,
          outputTokens: 6,
          costMicros: 1000,
        }),
        JSON.stringify([
          {
            eventKey: "sql-clean",
            inputHash: HASH_B,
            readinessStatus: "publication_blocked",
            artProvenance: "unknown",
          },
          {
            eventKey: "sql-second",
            inputHash: HASH_C,
            readinessStatus: "publication_blocked",
            artProvenance: "unknown",
          },
        ]),
      ],
      /replay conflict/i,
      "Conflicting immutable SQL replay must fail.",
    );

    // F. Resume starts after retained successful checkpoints and exact checkpoint replay is free.
    const manifestCheckpoint = await recordDatabaseCheckpoint(db, runId, {
      eventKey: "sql-clean",
      stageId: "manifest_validation",
    });
    const candidateCheckpoint = await recordDatabaseCheckpoint(db, runId, {
      eventKey: "sql-clean",
      stageId: "candidate_staging",
      output: {
        candidateId,
        candidateRetained: true,
      },
      links: { candidateId },
    });
    const candidateReplay = await recordDatabaseCheckpoint(db, runId, {
      eventKey: "sql-clean",
      stageId: "candidate_staging",
      output: {
        candidateId,
        candidateRetained: true,
      },
      links: { candidateId },
    });
    assert.equal(candidateReplay.exactReplay, true);
    assert.equal(candidateReplay.actionId, candidateCheckpoint.actionId);
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_operation_actions
            where operation_run_id = $1::uuid
              and action_type = 'michigan_completion_checkpoint'
              and requested_payload->>'eventKey' = 'sql-clean'
              and requested_payload->>'stageId' = 'candidate_staging'
          `,
          [runId],
        ),
      ),
      1,
    );
    await one(
      db,
      `
        select public.atlas_resume_michigan_completion_run(
          $1::uuid,
          $2::text
        ) as result
      `,
      [runId, FIXED_ACTOR],
    );
    const identityCheckpoint = await recordDatabaseCheckpoint(db, runId, {
      eventKey: "sql-clean",
      stageId: "identity_matching",
      output: { uniqueIdentity: true, mergePerformed: false },
    });
    assert(identityCheckpoint.actionId);
    assert.notEqual(identityCheckpoint.actionId, manifestCheckpoint.actionId);
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select (summary->>'retryCount')::integer
            from public.atlas_operation_runs
            where id = $1::uuid
          `,
          [runId],
        ),
      ),
      1,
    );
    await expectDatabaseError(
      db,
      CHECKPOINT_SQL,
      [
        runId,
        FIXED_ACTOR,
        "sql-clean",
        "candidate_staging",
        "1",
        completionSha256({
          eventKey: "sql-clean",
          stageId: "candidate_staging",
          stageVersion: "1",
        }),
        "candidate_staging@1",
        "sql-clean:candidate_staging@1:succeeded",
        "succeeded",
        JSON.stringify({ changed: true }),
        JSON.stringify({ candidateId }),
        JSON.stringify([]),
        null,
      ],
      /checkpoint replay conflicts/i,
      "A retained checkpoint action key cannot accept changed output.",
    );

    // C at the SQL layer: date conflict preserves source IDs and blocks completion.
    const dateException = jsonValue(
      await one(db, EXCEPTION_SQL, [
        runId,
        FIXED_ACTOR,
        "sql-clean",
        "evidence_readiness",
        "conflicting_event_dates",
        "publication_blocking",
        "sql-date-conflict",
        "Retained sources disagree on current dates.",
        JSON.stringify({
          sourceIds: [SOURCE_DATE_A, SOURCE_DATE_B],
          evidenceRetained: true,
          publicationBlocking: true,
        }),
        JSON.stringify({ candidateId, eventId }),
        "Resolve the retained date conflict.",
      ]),
    );
    assert.equal(dateException.exactReplay, false);
    const dateReplay = jsonValue(
      await one(db, EXCEPTION_SQL, [
        runId,
        FIXED_ACTOR,
        "sql-clean",
        "evidence_readiness",
        "conflicting_event_dates",
        "publication_blocking",
        "sql-date-conflict",
        "Retained sources disagree on current dates.",
        JSON.stringify({
          sourceIds: [SOURCE_DATE_A, SOURCE_DATE_B],
          evidenceRetained: true,
          publicationBlocking: true,
        }),
        JSON.stringify({ candidateId, eventId }),
        "Resolve the retained date conflict.",
      ]),
    );
    assert.equal(dateReplay.exactReplay, true);
    assert.equal(dateReplay.reviewItemId, dateException.reviewItemId);
    const retainedEvidence = await scalar(
      db,
      `
        select evidence
        from public.atlas_review_items
        where id = $1::uuid
      `,
      [dateException.reviewItemId],
    ) as Record<string, unknown>;
    assert.deepEqual(retainedEvidence.sourceIds, [
      SOURCE_DATE_A,
      SOURCE_DATE_B,
    ]);
    await expectDatabaseError(
      db,
      `
        select public.atlas_finalize_michigan_completion_run(
          $1::uuid,
          $2::text,
          'completed'::text,
          '{}'::jsonb,
          '{}'::jsonb,
          '{}'::jsonb,
          null::jsonb
        )
      `,
      [runId, FIXED_ACTOR],
      /active blocking exceptions/i,
      "A publication-blocking conflict must prevent completed finalization.",
    );

    const acknowledged = jsonValue(
      await one(
        db,
        `
          select public.atlas_transition_michigan_completion_exception(
            $1::uuid,
            $2::text,
            'acknowledged'::text,
            'Review started.'::text,
            '{"reviewed":true}'::jsonb
          ) as result
        `,
        [dateException.reviewItemId, FIXED_ACTOR],
      ),
    );
    assert.equal(acknowledged.exactReplay, false);
    const acknowledgedReplay = jsonValue(
      await one(
        db,
        `
          select public.atlas_transition_michigan_completion_exception(
            $1::uuid,
            $2::text,
            'acknowledged'::text,
            'Review started.'::text,
            '{"reviewed":true}'::jsonb
          ) as result
        `,
        [dateException.reviewItemId, FIXED_ACTOR],
      ),
    );
    assert.equal(acknowledgedReplay.exactReplay, true);
    const resolved = jsonValue(
      await one(
        db,
        `
          select public.atlas_transition_michigan_completion_exception(
            $1::uuid,
            $2::text,
            'resolved'::text,
            'Retained evidence reconciled.'::text,
            '{"selectedSourceId":"${SOURCE_DATE_A}"}'::jsonb
          ) as result
        `,
        [dateException.reviewItemId, FIXED_ACTOR],
      ),
    );
    assert.equal(resolved.toStatus, "resolved");
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_review_item_actions
            where review_item_id = $1::uuid
          `,
          [dateException.reviewItemId],
        ),
      ),
      3,
    );

    // E and G at the SQL layer: bounded reservations are atomic and exact replay is free.
    const reserved = await reserveDatabaseModel(db, runId, {
      eventKey: "sql-clean",
      chargeKey: "sql-charge-success",
      estimatedInput: 6,
      estimatedOutput: 4,
    });
    assert.equal(reserved.reserved, true);
    assert.equal(reserved.status, "reserved");
    const reservedReplay = await reserveDatabaseModel(db, runId, {
      eventKey: "sql-clean",
      chargeKey: "sql-charge-success",
      estimatedInput: 6,
      estimatedOutput: 4,
    });
    assert.equal(reservedReplay.exactReplay, true);
    assert.equal(reservedReplay.actionId, reserved.actionId);
    const finished = jsonValue(
      await one(
        db,
        `
          select public.atlas_finish_michigan_completion_model_action(
            $1::uuid,
            $2::uuid,
            $3::text,
            'succeeded'::text,
            5::bigint,
            3::bigint,
            80::bigint,
            'sql-provider-response'::text,
            null::jsonb
          ) as result
        `,
        [runId, reserved.actionId, FIXED_ACTOR],
      ),
    );
    assert.equal(finished.exactReplay, false);
    const finishedReplay = jsonValue(
      await one(
        db,
        `
          select public.atlas_finish_michigan_completion_model_action(
            $1::uuid,
            $2::uuid,
            $3::text,
            'succeeded'::text,
            5::bigint,
            3::bigint,
            80::bigint,
            'sql-provider-response'::text,
            null::jsonb
          ) as result
        `,
        [runId, reserved.actionId, FIXED_ACTOR],
      ),
    );
    assert.equal(finishedReplay.exactReplay, true);

    const eventBudget = await reserveDatabaseModel(db, runId, {
      eventKey: "sql-clean",
      chargeKey: "sql-charge-event-budget",
      estimatedInput: 4,
      estimatedOutput: 4,
    });
    assert.equal(eventBudget.reserved, false);
    assert.equal(eventBudget.status, "budget_blocked");
    const runBudget = await reserveDatabaseModel(db, runId, {
      eventKey: "sql-second",
      chargeKey: "sql-charge-run-budget",
      estimatedInput: 8,
      estimatedOutput: 6,
    });
    assert.equal(runBudget.reserved, false);
    assert.equal(runBudget.status, "budget_blocked");
    const runBudgetReplay = await reserveDatabaseModel(db, runId, {
      eventKey: "sql-second",
      chargeKey: "sql-charge-run-budget",
      estimatedInput: 8,
      estimatedOutput: 6,
    });
    assert.equal(runBudgetReplay.exactReplay, true);
    assert.equal(runBudgetReplay.actionId, runBudget.actionId);
    for (const [eventKey, actionId, dedupeKey] of [
      [
        "sql-clean",
        eventBudget.actionId,
        "sql-event-budget-exception",
      ],
      [
        "sql-second",
        runBudget.actionId,
        "sql-run-budget-exception",
      ],
    ]) {
      const modelException = jsonValue(
        await one(db, EXCEPTION_SQL, [
          runId,
          FIXED_ACTOR,
          eventKey,
          "editorial_assistance",
          "model_budget_exceeded",
          "model_review_eligible",
          dedupeKey,
          "The bounded model budget cannot cover this optional action.",
          JSON.stringify({
            modelActionId: actionId,
            modelReviewEligible: true,
            publicationBlocking: false,
            deterministicContentRetained: true,
          }),
          JSON.stringify({ modelActionId: actionId }),
          "Retain deterministic content and review only if editorial improvement is still needed.",
        ]),
      );
      assert.equal(modelException.exactReplay, false);
    }
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_operation_actions
            where operation_run_id = $1::uuid
              and action_type in (
                'michigan_completion_model_reserved',
                'michigan_completion_model_budget_blocked',
                'michigan_completion_model_rejected'
              )
          `,
          [runId],
        ),
      ),
      3,
      "Exact model replay must not create another charge action.",
    );
    assert.equal(
      Number(
        await scalar(
          db,
          `
            select count(*)
            from public.atlas_review_items
            where operation_run_id = $1::uuid
              and evidence->>'exceptionCode' = 'model_budget_exceeded'
          `,
          [runId],
        ),
      ),
      2,
      "Each distinct exhausted record is routed to one deduplicated exception.",
    );

    const finalized = jsonValue(
      await one(
        db,
        `
          select public.atlas_finalize_michigan_completion_run(
            $1::uuid,
            $2::text,
            'waiting_for_exceptions'::text,
            '{"succeeded":3}'::jsonb,
            '{"running":2}'::jsonb,
            '{"publication_blocked":2}'::jsonb,
            null::jsonb
          ) as result
        `,
        [runId, FIXED_ACTOR],
      ),
    );
    assert.equal(finalized.publicationPerformed, false);
    const finalizedReplay = jsonValue(
      await one(
        db,
        `
          select public.atlas_finalize_michigan_completion_run(
            $1::uuid,
            $2::text,
            'waiting_for_exceptions'::text,
            '{"succeeded":3}'::jsonb,
            '{"running":2}'::jsonb,
            '{"publication_blocked":2}'::jsonb,
            null::jsonb
          ) as result
        `,
        [runId, FIXED_ACTOR],
      ),
    );
    assert.equal(finalizedReplay.exactReplay, true);

    // Completion histories are append-only at every reused projection.
    const checkpointActionId = String(candidateCheckpoint.actionId);
    for (const operation of [
      {
        sql: "update public.atlas_operation_actions set reason = 'tampered' where id = $1::uuid",
        params: [checkpointActionId],
      },
      {
        sql: "delete from public.atlas_operation_actions where id = $1::uuid",
        params: [checkpointActionId],
      },
      {
        sql: "update public.atlas_review_items set evidence = '{}'::jsonb where id = $1::uuid",
        params: [dateException.reviewItemId],
      },
      {
        sql: "delete from public.atlas_review_items where id = $1::uuid",
        params: [dateException.reviewItemId],
      },
      {
        sql: "update public.atlas_review_item_actions set reason = 'tampered' where review_item_id = $1::uuid",
        params: [dateException.reviewItemId],
      },
      {
        sql: "delete from public.atlas_review_item_actions where review_item_id = $1::uuid",
        params: [dateException.reviewItemId],
      },
      {
        sql: "update public.atlas_operation_runs set request = '{}'::jsonb where id = $1::uuid",
        params: [runId],
      },
      {
        sql: "delete from public.atlas_operation_runs where id = $1::uuid",
        params: [runId],
      },
    ]) {
      await expectDatabaseError(
        db,
        operation.sql,
        operation.params,
        /immutable|append-only|cannot be deleted/i,
        "Completion audit history must reject update and delete.",
      );
    }

    const databaseSnapshotOne = await scalar(
      db,
      "select public.atlas_get_michigan_completion_run($1::uuid)",
      [runId],
    );
    const databaseSnapshotTwo = await scalar(
      db,
      "select public.atlas_get_michigan_completion_run($1::uuid)",
      [runId],
    );
    assert.equal(
      stableCompletionJson(databaseSnapshotOne),
      stableCompletionJson(databaseSnapshotTwo),
      "Read-only structured run reports must serialize stably.",
    );
    const databaseSnapshot = databaseSnapshotOne as Record<string, unknown>;
    assert(Array.isArray(databaseSnapshot.audit));
    assert(
      (databaseSnapshot.audit as Array<Record<string, unknown>>).every(
        (entry) =>
          ![
            "atlas_activate_event_factory_publication",
            "atlas_materialize_event_factory_package",
            "image_generated",
          ].includes(String(entry.actionType)),
      ),
    );

    // I. Public-only, anon, and authenticated roles have no table/RPC access.
    const protectedFunctions = [
      "public.atlas_start_michigan_completion_run(text,text,text,text,text,text,text,text,boolean,boolean,integer,jsonb,jsonb,jsonb)",
      "public.atlas_resume_michigan_completion_run(uuid,text)",
      "public.atlas_record_michigan_completion_checkpoint(uuid,text,text,text,text,text,text,text,text,jsonb,jsonb,jsonb,jsonb)",
      "public.atlas_record_michigan_completion_exception(uuid,text,text,text,text,text,text,text,jsonb,jsonb,text)",
      "public.atlas_transition_michigan_completion_exception(uuid,text,text,text,jsonb)",
      "public.atlas_reserve_michigan_completion_model_action(uuid,text,text,text,text,text,text,text,jsonb,text,text,text,integer,integer,bigint,bigint,bigint,text,boolean)",
      "public.atlas_finish_michigan_completion_model_action(uuid,uuid,text,text,bigint,bigint,bigint,text,jsonb)",
      "public.atlas_finalize_michigan_completion_run(uuid,text,text,jsonb,jsonb,jsonb,jsonb)",
      "public.atlas_get_michigan_completion_run(uuid)",
      "public.atlas_list_michigan_completion_runs(integer)",
    ];
    for (const role of ["browser_public", "anon", "authenticated"]) {
      assert.equal(
        await scalar(
          db,
          `
            select has_table_privilege(
              $1::text,
              'public.atlas_review_item_actions',
              'select'
            )
          `,
          [role],
        ),
        false,
        `${role} unexpectedly reads the new private table.`,
      );
      for (const identity of protectedFunctions) {
        assert.equal(
          await scalar(
            db,
            "select has_function_privilege($1::text, $2::text, 'execute')",
            [role, identity],
          ),
          false,
          `${role} unexpectedly executes ${identity}.`,
        );
      }
      await db.exec(`set role ${role}`);
      try {
        await assert.rejects(
          () =>
            db.query(
              "select public.atlas_list_michigan_completion_runs(1)",
            ),
          /permission denied/i,
          `${role} must not execute completion RPCs.`,
        );
        await assert.rejects(
          () =>
            db.query(
              "select count(*) from public.atlas_review_item_actions",
            ),
          /permission denied/i,
          `${role} must not read completion exception history.`,
        );
      } finally {
        await db.exec("reset role");
      }
    }
    assert.equal(
      await scalar(
        db,
        `
          select has_table_privilege(
            'service_role',
            'public.atlas_review_item_actions',
            'select'
          )
        `,
      ),
      true,
    );
    for (const identity of protectedFunctions) {
      assert.equal(
        await scalar(
          db,
          "select has_function_privilege('service_role', $1::text, 'execute')",
          [identity],
        ),
        true,
        `service_role is missing protected execution for ${identity}.`,
      );
    }
    await db.exec("set role service_role");
    try {
      assert.equal(
        Number(
          await scalar(
            db,
            "select count(*) from public.atlas_review_item_actions",
          ),
        ) > 0,
        true,
      );
      const serviceSnapshot = await scalar(
        db,
        "select public.atlas_get_michigan_completion_run($1::uuid)",
        [runId],
      ) as Record<string, unknown>;
      assert.equal(
        (serviceSnapshot.run as Record<string, unknown>).runId,
        runId,
      );
      const serviceRunList = await scalar(
        db,
        "select public.atlas_list_michigan_completion_runs(1)",
      ) as Array<Record<string, unknown>>;
      assert.equal(serviceRunList.length, 1);
      assert.equal(serviceRunList[0]?.runId, runId);
    } finally {
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
}

async function main() {
  await validateStageRegistryAndSourceBoundaries();
  await validateAttachmentCasesAThroughE();
  await validateCasesFThroughHAndModelFallback();
  await validateTerminalFailureAndStructuredReport();
  await validateMigrationLifecycleAndSecurity();
  console.log(
    "Michigan completion validation passed: A-I behavior, replay/resume, budgets, append-only history, no publication/image actions, stable reports, and service-role isolation.",
  );
}

await main();
