export const FAST_TRACK_SCHEMA_VERSION =
  "celebration-atlas-approved-event-list/v1" as const;

export const FAST_TRACK_PLAN_VERSION =
  "celebration-atlas-fast-track-plan/v1" as const;

export type FastTrackEventReferences = {
  candidateId?: string;
  canonicalEventId?: string;
  sourceBundleId?: string;
  synthesisId?: string;
  verificationCaseId?: string;
  packageId?: string;
};

export type FastTrackApprovedEvent = {
  sourceRecordId: string;
  eventKey: string;
  displayName: string;
  city: string;
  state: string;
  targetYear: number;
  officialUrl?: string;
  additionalSourceUrls: string[];
  county?: string;
  venueName?: string;
  knownConstraints: string[];
  notes?: string;
  references: FastTrackEventReferences;
  metadata: Record<string, unknown>;
  inputHash: string;
};

export type FastTrackApprovedList = {
  schemaVersion: typeof FAST_TRACK_SCHEMA_VERSION;
  listId: string;
  approvedBy: string;
  approvedAt: string;
  approvalScope: "inclusion_and_private_preparation_only";
  publicationAuthorized: false;
  defaultState?: string;
  defaultTargetYear?: number;
  events: FastTrackApprovedEvent[];
  metadata: Record<string, unknown>;
};

export type FastTrackStageId =
  | "identity_preflight"
  | "retain_official_evidence"
  | "reconcile_facts"
  | "record_fact_clearance"
  | "ultra_full_manifest"
  | "validate_full_manifest"
  | "luna_max_hero"
  | "visual_workflow_review"
  | "private_package_preview"
  | "publication_hold";

export type FastTrackStage = {
  sequence: number;
  id: FastTrackStageId;
  label: string;
  executor: "codex_operator" | "existing_event_factory" | "human_reviewer";
  failureScope: "event_only";
  requiredForPrivatePreview: boolean;
  completionRule: string;
};

export type FastTrackUltraHandoff = {
  eventKey: string;
  executionProfile: {
    host: "codex";
    model: "gpt-5.6-sol";
    reasoningEffort: "ultra";
  };
  task: "full_event_hub_manifest_authorship";
  initialAttemptLimit: 1;
  repairPolicy: "one_targeted_repair_only_after_validation_failure";
  editableScope: string[];
  protectedScope: string[];
  acceptanceChecks: string[];
};

export type FastTrackHeroHandoff = {
  eventKey: string;
  executionProfile: {
    host: "codex";
    model: "GPT-5.6 Luna";
    reasoningEffort: "max";
    hostMustPinProfile: true;
  };
  skill: "$create-celebration-atlas-hero";
  inputs: {
    eventName: string;
    city: string;
    state: string;
    officialUrl?: string;
    venueName?: string;
    targetYear: number;
    knownConstraints: string[];
  };
  generationPolicy: {
    primaryImageCount: 1;
    alternatives: "only_after_rejection_or_low_confidence";
    maximumFocusedAlternatives: 1;
    researchPasses: 1;
    defaultAspectRatio: "2:3";
    generatedTextAllowed: false;
  };
  downstreamBoundary: {
    localOutputIsApproval: false;
    approvedSupabaseVisualWorkflowRequired: true;
  };
};

export type FastTrackEventPlan = {
  eventKey: string;
  sourceRecordId: string;
  inputHash: string;
  displayName: string;
  targetYear: number;
  runPolicy: {
    isolation: "event";
    continueOtherEventsOnFailure: true;
    privateWritesAuthorizedByListApproval: true;
    publicationAuthorized: false;
  };
  retainedSafetyGates: string[];
  skippedCeremony: string[];
  stages: FastTrackStage[];
  ultraHandoff: FastTrackUltraHandoff;
  heroHandoff: FastTrackHeroHandoff;
  terminalState: "awaiting_explicit_package_approval";
};

export type FastTrackPlan = {
  schemaVersion: typeof FAST_TRACK_PLAN_VERSION;
  planId: string;
  preparedAt: string;
  approvedList: {
    listId: string;
    approvedBy: string;
    approvedAt: string;
    inputHash: string;
    eventCount: number;
  };
  executionPolicy: {
    mode: "codex_operated";
    eventIsolation: true;
    continueOnEventFailure: true;
    cohortCompletionRequired: false;
    publicationActionAvailable: false;
    stopBeforePublication: true;
  };
  compatibilityPolicy: {
    packageBoundary: "existing_event_factory_package";
    verificationRecord: "same_pass_from_retained_official_evidence";
    supportingSourceMinimum: 0;
    separateVerificationQueueWhenFactsComplete: false;
  };
  events: FastTrackEventPlan[];
};
