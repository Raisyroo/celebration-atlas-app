export const MICHIGAN_COMPLETION_ORCHESTRATOR_VERSION =
  "michigan-completion-orchestrator/1";

export const COMPLETION_RUN_STATUSES = [
  "queued",
  "validating",
  "running",
  "waiting_for_exceptions",
  "ready_for_review",
  "completed",
  "failed",
  "cancelled",
] as const;

export const COMPLETION_STAGE_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "skipped",
  "blocked",
  "failed",
] as const;

export const COMPLETION_EXCEPTION_CODES = [
  "invalid_manifest_record",
  "uncertain_identity_match",
  "duplicate_candidate",
  "conflicting_event_dates",
  "missing_official_source",
  "weak_source_evidence",
  "unsupported_source_format",
  "missing_or_ambiguous_location",
  "archive_current_program_ambiguity",
  "deterministic_synthesis_failure",
  "editorial_quality_failure",
  "model_budget_exceeded",
  "missing_approved_image",
  "image_provenance_failure",
  "event_factory_readiness_failure",
  "publication_readiness_failure",
  "identity_security_mismatch",
  "unexpected_system_failure",
] as const;

export const COMPLETION_EXCEPTION_CLASSIFICATIONS = [
  "informational",
  "retryable",
  "model_review_eligible",
  "human_review_required",
  "publication_blocking",
  "fatal",
] as const;

export const COMPLETION_READINESS_STATES = [
  "publication_blocked",
  "content_ready",
  "art_pending",
  "review_ready",
] as const;

export const ART_PROVENANCE_CATEGORIES = [
  "ray_provided",
  "organizer_provided",
  "licensed",
  "generated",
  "legacy",
  "unknown",
] as const;

export type CompletionRunStatus = (typeof COMPLETION_RUN_STATUSES)[number];
export type CompletionStageStatus = (typeof COMPLETION_STAGE_STATUSES)[number];
export type CompletionExceptionCode = (typeof COMPLETION_EXCEPTION_CODES)[number];
export type CompletionExceptionClassification =
  (typeof COMPLETION_EXCEPTION_CLASSIFICATIONS)[number];
export type CompletionReadinessState =
  (typeof COMPLETION_READINESS_STATES)[number];
export type ArtProvenanceCategory =
  (typeof ART_PROVENANCE_CATEGORIES)[number];

export type CompletionEventReferences = {
  candidateId?: string | null;
  canonicalEventId?: string | null;
  sourceBundleId?: string | null;
  synthesisId?: string | null;
  verificationCaseId?: string | null;
  packageId?: string | null;
  evidenceId?: string | null;
};

export type CompletionCountySeedInput = {
  batchId: string;
  manifestHash: string;
  payloadHash: string;
  idempotencyKey: string;
  candidate: Record<string, unknown>;
  sources: Record<string, unknown>[];
};

export type MichiganCompletionEventInput = {
  eventKey: string;
  sourceRecordId: string;
  inputHash: string;
  displayName?: string;
  references: CompletionEventReferences;
  countySeed?: CompletionCountySeedInput;
  editorialPolicy: "deterministic_only" | "economical_if_needed" | "reasoning_if_ambiguous";
  perEventModelBudgetTokens: number;
  artProvenance: ArtProvenanceCategory;
  metadata: Record<string, unknown>;
};

export type MichiganCompletionManifest = {
  schemaVersion: "michigan-completion-manifest/v1";
  stateId: "MI";
  countyCode: string;
  batchId: string;
  inputManifestVersion: string;
  createdAt?: string;
  events: MichiganCompletionEventInput[];
  metadata: Record<string, unknown>;
};

export type CompletionExceptionInput = {
  code: CompletionExceptionCode;
  classification: CompletionExceptionClassification;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
  modelReviewEligible?: boolean;
  humanReviewRequired?: boolean;
  publicationBlocking?: boolean;
  fatal?: boolean;
  related?: CompletionEventReferences;
};

export type CompletionStageLinks = CompletionEventReferences & {
  readinessState?: CompletionReadinessState;
  artProvenance?: ArtProvenanceCategory;
  publicationEligible?: boolean;
};

export type CompletionModelRequest = {
  processorId: string;
  routeId: string;
  reason: string;
  deterministicPreconditions: Record<string, unknown>;
  modelFamily: string;
  configuredModel: string;
  reasoningLevel?: string | null;
  maximumAttempts: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  fallbackBehavior: string;
  failureBlocking: boolean;
  strength: "economical" | "reasoning";
};

export type CompletionModelResult = {
  output: Record<string, unknown>;
  providerResponseId?: string | null;
  actualInputTokens?: number | null;
  actualOutputTokens?: number | null;
  links?: CompletionStageLinks;
  exceptions?: CompletionExceptionInput[];
};

export type CompletionStageExecutionResult = {
  outcome: Exclude<CompletionStageStatus, "queued" | "running">;
  output?: Record<string, unknown>;
  error?: Record<string, unknown> | null;
  links?: CompletionStageLinks;
  exceptions?: CompletionExceptionInput[];
  modelRequest?: CompletionModelRequest;
};

export type CompletionStageCheckpoint = {
  id: string;
  runEventId: string;
  stageId: string;
  stageVersion: string;
  status: CompletionStageStatus;
  attemptCount: number;
  inputHash: string;
  deterministic: boolean;
  output: Record<string, unknown>;
  error: Record<string, unknown> | null;
  startedAt: string | null;
  completedAt: string | null;
};

export type CompletionRunEvent = {
  id: string;
  runId: string;
  eventKey: string;
  sourceRecordId: string;
  inputHash: string;
  status:
    | "queued"
    | "running"
    | "waiting_for_exception"
    | "ready_for_review"
    | "completed"
    | "failed";
  currentStageId: string | null;
  lastSuccessfulStageId: string | null;
  retryCount: number;
  modelBudgetTokens: number;
  modelReservedTokens: number;
  modelUsageTokens: number;
  readinessState: CompletionReadinessState;
  artProvenance: ArtProvenanceCategory;
  publicationEligible: boolean;
  references: CompletionEventReferences;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type CompletionExceptionRecord = {
  id: string;
  runId: string;
  runEventId: string | null;
  eventKey: string | null;
  stageId: string;
  code: CompletionExceptionCode;
  classification: CompletionExceptionClassification;
  status: "open" | "acknowledged" | "resolved" | "waived" | "superseded";
  message: string;
  details: Record<string, unknown>;
  publicationBlocking: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type CompletionModelActionRecord = {
  id: string;
  runId: string;
  runEventId: string;
  eventKey: string;
  stageId: string;
  processorId: string;
  routeId: string;
  configuredModel: string;
  status: "reserved" | "succeeded" | "failed" | "budget_blocked" | "rejected";
  chargeKey: string;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  actualInputTokens: number | null;
  actualOutputTokens: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type CompletionRun = {
  id: string;
  operationRunId: string;
  stateId: string;
  countyCode: string;
  batchId: string;
  inputManifestVersion: string;
  inputHash: string;
  orchestratorVersion: string;
  dryRun: boolean;
  deterministicOnly: boolean;
  status: CompletionRunStatus;
  stageCounts: Record<string, number>;
  retryCount: number;
  maxConcurrency: number;
  modelBudgetTokens: number;
  perEventModelBudgetTokens: number;
  modelReservedTokens: number;
  modelUsageTokens: number;
  estimatedModelInputTokens: number;
  estimatedModelOutputTokens: number;
  actualModelInputTokens: number;
  actualModelOutputTokens: number;
  exceptionCount: number;
  publicationEligibilityCount: number;
  createdAt: string;
  startedAt: string | null;
  updatedAt: string;
  completedAt: string | null;
};

export type CompletionRunSnapshot = {
  run: CompletionRun;
  manifest?: MichiganCompletionManifest;
  events: CompletionRunEvent[];
  checkpoints: CompletionStageCheckpoint[];
  exceptions: CompletionExceptionRecord[];
  modelActions: CompletionModelActionRecord[];
  audit: Array<Record<string, unknown>>;
  exactReplay?: boolean;
};

export type StartCompletionRunInput = {
  stateId: "MI";
  countyCode: string;
  batchId: string;
  inputManifestVersion: string;
  inputHash: string;
  orchestratorVersion: string;
  dryRun: boolean;
  deterministicOnly: boolean;
  maxConcurrency: number;
  modelBudgetTokens: number;
  perEventModelBudgetTokens: number;
  actorIdentity: string;
  events: MichiganCompletionEventInput[];
};

export type CompletionStore = {
  startRun(input: StartCompletionRunInput): Promise<CompletionRunSnapshot>;
  resumeRun(runId: string, actorIdentity: string): Promise<CompletionRunSnapshot>;
  getRun(runId: string): Promise<CompletionRunSnapshot>;
  beginStage(input: {
    runId: string;
    eventKey: string;
    stageId: string;
    stageVersion: string;
    inputHash: string;
    deterministic: boolean;
    actorIdentity: string;
  }): Promise<{ checkpoint: CompletionStageCheckpoint; exactReplay: boolean }>;
  finishStage(input: {
    runId: string;
    eventKey: string;
    stageId: string;
    stageVersion: string;
    status: Exclude<CompletionStageStatus, "queued" | "running">;
    output: Record<string, unknown>;
    error: Record<string, unknown> | null;
    links: CompletionStageLinks;
    actorIdentity: string;
  }): Promise<CompletionStageCheckpoint>;
  recordException(input: {
    runId: string;
    eventKey: string | null;
    stageId: string;
    exception: CompletionExceptionInput;
    dedupeKey: string;
    actorIdentity: string;
  }): Promise<CompletionExceptionRecord>;
  reserveModelAction(input: {
    runId: string;
    eventKey: string;
    stageId: string;
    request: CompletionModelRequest;
    chargeKey: string;
    actorIdentity: string;
  }): Promise<{
    action: CompletionModelActionRecord;
    reserved: boolean;
    exactReplay: boolean;
  }>;
  finishModelAction(input: {
    runId: string;
    modelActionId: string;
    status: "succeeded" | "failed" | "rejected";
    actualInputTokens: number | null;
    actualOutputTokens: number | null;
    providerResponseId: string | null;
    failure: Record<string, unknown> | null;
    actorIdentity: string;
  }): Promise<CompletionModelActionRecord>;
  finalizeRun(input: {
    runId: string;
    requestedStatus:
      | "waiting_for_exceptions"
      | "ready_for_review"
      | "completed"
      | "failed"
      | "cancelled";
    summary: Record<string, unknown>;
    actorIdentity: string;
  }): Promise<CompletionRunSnapshot>;
};

export type CompletionStageExecutorContext = {
  run: CompletionRun;
  event: MichiganCompletionEventInput;
  runEvent: CompletionRunEvent;
  manifest: MichiganCompletionManifest;
  dryRun: boolean;
  deterministicOnly: boolean;
  actorIdentity: string;
  priorOutputs: ReadonlyMap<string, Record<string, unknown>>;
};

export type CompletionStageExecutor = {
  execute(
    stageId: string,
    context: CompletionStageExecutorContext,
  ): Promise<CompletionStageExecutionResult>;
  executeModel?(
    request: CompletionModelRequest,
    context: CompletionStageExecutorContext,
  ): Promise<CompletionModelResult>;
};

export type CompletionRunReport = {
  schemaVersion: 1;
  generatedAt: string;
  run: CompletionRun;
  safeguards: {
    publicationInvoked: false;
    automaticImageActionInvoked: false;
    dryRun: boolean;
    deterministicOnly: boolean;
  };
  counts: {
    events: number;
    completed: number;
    readyForReview: number;
    blocked: number;
    failed: number;
    openExceptions: number;
    publicationEligible: number;
    modelActions: number;
    modelUsageTokens: number;
  };
  events: CompletionRunEvent[];
  exceptions: CompletionExceptionRecord[];
  modelActions: CompletionModelActionRecord[];
};
