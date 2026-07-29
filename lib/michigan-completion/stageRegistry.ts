import type {
  CompletionExceptionCode,
} from "./types.ts";

export type MichiganCompletionStageDefinition = {
  id: string;
  version: string;
  capability: string;
  processor: "deterministic" | "model_assisted" | "human_review";
  prerequisites: string[];
  idempotencyContract: string;
  completionConditions: string[];
  retryBehavior: string;
  exceptionCodes: CompletionExceptionCode[];
  blocksLaterStages: boolean;
  requiredForEveryEvent: boolean;
};

export const MICHIGAN_COMPLETION_STAGES: readonly MichiganCompletionStageDefinition[] = [
  {
    id: "manifest_validation",
    version: "1",
    capability: "lib/michigan-completion/manifest.ts",
    processor: "deterministic",
    prerequisites: [],
    idempotencyContract: "Immutable run input hash plus event input hash.",
    completionConditions: ["Manifest and event record satisfy the v1 contract."],
    retryBehavior: "Retry only with the same immutable input; changed input requires a new batch identity.",
    exceptionCodes: ["invalid_manifest_record", "identity_security_mismatch"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "candidate_staging",
    version: "1",
    capability: "atlas_stage_county_seed_candidate / existing event_candidates",
    processor: "deterministic",
    prerequisites: ["manifest_validation"],
    idempotencyContract: "Existing guarded county-seed payload hash and idempotency key.",
    completionConditions: ["An equivalent candidate is retained or a referenced candidate exists."],
    retryBehavior: "Reconcile uncertain calls before retry; never repeat an equivalent successful intake.",
    exceptionCodes: ["invalid_manifest_record", "duplicate_candidate", "identity_security_mismatch", "unexpected_system_failure"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "identity_matching",
    version: "2",
    capability: "event_candidates, events, lib/county-seeds/matching.ts",
    processor: "deterministic",
    prerequisites: ["candidate_staging"],
    idempotencyContract: "Candidate identity and retained source fingerprint.",
    completionConditions: ["Identity is a unique existing event or an unmerged unique candidate."],
    retryBehavior: "Re-evaluate after an operator resolves the retained ambiguity.",
    exceptionCodes: ["uncertain_identity_match", "duplicate_candidate", "identity_security_mismatch"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "evidence_readiness",
    version: "4",
    capability: "event_source_bundles, snapshots, claims, links, and schedule candidates",
    processor: "deterministic",
    prerequisites: ["identity_matching"],
    idempotencyContract: "Bundle identity plus retained source and claim hashes.",
    completionConditions: ["Official retained source exists and evidence is sufficient for deterministic synthesis."],
    retryBehavior: "Authorized private runs may compose one bounded retained bundle; retry only after retained evidence or review state changes.",
    exceptionCodes: [
      "conflicting_event_dates",
      "missing_official_source",
      "weak_source_evidence",
      "unsupported_source_format",
      "missing_or_ambiguous_location",
      "archive_current_program_ambiguity",
      "verification_review_required",
    ],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "deterministic_synthesis",
    version: "22",
    capability: "lib/event-intake/synthesisEngine.ts and atlas_create_event_source_synthesis",
    processor: "deterministic",
    prerequisites: ["evidence_readiness"],
    idempotencyContract: "Existing synthesis bundle, engine version, and input hash uniqueness.",
    completionConditions: ["A deterministic proposal and its complete validation report are retained."],
    retryBehavior: "Exact replay reuses the synthesis; changed evidence creates a new deterministic input.",
    exceptionCodes: ["conflicting_event_dates", "deterministic_synthesis_failure", "archive_current_program_ambiguity"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "editorial_assistance",
    version: "1",
    capability: "Existing evidence-bound model-assisted editorial synthesis",
    processor: "model_assisted",
    prerequisites: ["deterministic_synthesis"],
    idempotencyContract: "Parent synthesis, route, prompt/model version, and charge key.",
    completionConditions: ["Skipped after deterministic success or one bounded, budgeted editorial proposal is retained."],
    retryBehavior: "No silent escalation; bounded attempts and a new reviewed charge key are required.",
    exceptionCodes: ["editorial_quality_failure", "model_budget_exceeded", "unexpected_system_failure"],
    blocksLaterStages: false,
    requiredForEveryEvent: false,
  },
  {
    id: "content_readiness",
    version: "2",
    capability: "Event Page manifest validation and source-synthesis validation report",
    processor: "deterministic",
    prerequisites: ["deterministic_synthesis"],
    idempotencyContract: "Selected synthesis identity and immutable manifest content hash.",
    completionConditions: ["Identity, dates, location, sources, four substantive Event Hub topics, and public copy are valid; hero art may remain pending."],
    retryBehavior: "Retry after evidence or editorial review; deterministic content remains available.",
    exceptionCodes: ["conflicting_event_dates", "editorial_quality_failure", "publication_readiness_failure"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "package_preparation",
    version: "1",
    capability: "Existing event_factory_packages and atlas_upsert_event_factory_package",
    processor: "deterministic",
    prerequisites: ["content_readiness"],
    idempotencyContract: "Verification case, target year, and frozen package content hash.",
    completionConditions: ["A private package preview exists in content-ready, art-pending, or review-ready state."],
    retryBehavior: "Exact package replay is reused; released packages remain immutable.",
    exceptionCodes: ["event_factory_readiness_failure", "identity_security_mismatch"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "visual_readiness",
    version: "2",
    capability: "Existing event_visual_workflows approval and provenance records",
    processor: "deterministic",
    prerequisites: ["package_preparation"],
    idempotencyContract: "Approved visual workflow/content hash or explicit art-pending state.",
    completionConditions: ["Approved provenance is retained, or art pending is recorded without image action."],
    retryBehavior: "Retry only after a human-approved visual workflow changes state.",
    exceptionCodes: ["image_provenance_failure"],
    blocksLaterStages: false,
    requiredForEveryEvent: true,
  },
  {
    id: "exception_review",
    version: "3",
    capability: "atlas_review_items, atlas_review_item_actions, and Atlas Control read-only review surface",
    processor: "human_review",
    prerequisites: ["visual_readiness"],
    idempotencyContract: "Run/event/stage exception dedupe key.",
    completionConditions: ["No open publication-blocking exception, or the run waits for human review."],
    retryBehavior: "Resume after exceptions are resolved, waived with reason, or superseded.",
    exceptionCodes: ["identity_security_mismatch", "unexpected_system_failure"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
  {
    id: "publication_readiness",
    version: "2",
    capability: "Read-only Event Factory, Event Hub, visual, and exception gate inspection",
    processor: "deterministic",
    prerequisites: ["exception_review"],
    idempotencyContract: "Frozen package, optional approved visual, and current exception state.",
    completionConditions: ["Eligibility is recorded for human review; no publication function is invoked."],
    retryBehavior: "Re-evaluate after package, art, or exception state changes.",
    exceptionCodes: ["publication_readiness_failure", "image_provenance_failure"],
    blocksLaterStages: true,
    requiredForEveryEvent: true,
  },
] as const;

export function getMichiganCompletionStage(stageId: string) {
  return MICHIGAN_COMPLETION_STAGES.find((stage) => stage.id === stageId);
}
