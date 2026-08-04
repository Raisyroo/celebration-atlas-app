import { fastTrackSha256 } from "./manifest.ts";
import {
  FAST_TRACK_PLAN_VERSION,
  type FastTrackApprovedEvent,
  type FastTrackApprovedList,
  type FastTrackEventPlan,
  type FastTrackHeroHandoff,
  type FastTrackPlan,
  type FastTrackStage,
  type FastTrackUltraHandoff,
} from "./types.ts";

const RETAINED_SAFETY_GATES = [
  "Exact identity and slug collision clearance",
  "Retained organizer-controlled evidence for event identity",
  "Current target-edition dates",
  "Confirmed city or venue and source-backed coordinates",
  "Annual or recurring-event proof required by the Event Factory",
  "Visible reconciliation of material factual disagreements",
  "Source-grounded full Event Hub manifest validation",
  "Approved Supabase visual workflow before generated art may be attached",
] as const;

const SKIPPED_CEREMONY = [
  "Discovery campaign qualification",
  "County-completion batch orchestration",
  "A second supporting-source quota when one official source proves the facts",
  "A separate verification queue after the retained evidence already clears every fact",
  "Waiting for every event in the approved list to finish",
] as const;

function stages(): FastTrackStage[] {
  return [
    {
      sequence: 1,
      id: "identity_preflight",
      label: "Clear exact identity and slug collisions",
      executor: "existing_event_factory",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "Reuse the matching canonical event or candidate when exact; otherwise retain a unique candidate identity.",
    },
    {
      sequence: 2,
      id: "retain_official_evidence",
      label: "Explore and retain the official event story",
      executor: "codex_operator",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "The organizer-controlled home page and useful schedule, planning, history, tradition, competition, or lineup pages are retained before authorship, without repeating discovery qualification.",
    },
    {
      sequence: 3,
      id: "reconcile_facts",
      label: "Reconcile retained claims and schedules",
      executor: "existing_event_factory",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "Deterministic reconciliation has no unresolved publication-blocking disagreement and preserves provenance for every current fact.",
    },
    {
      sequence: 4,
      id: "record_fact_clearance",
      label: "Record Event Factory fact clearance from the same evidence pass",
      executor: "existing_event_factory",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "The compatibility verification case is submitted and verified from retained evidence without a second research or supporting-source requirement.",
    },
    {
      sequence: 5,
      id: "ultra_full_manifest",
      label: "Author the complete visitor-facing Event Hub with Ultra",
      executor: "codex_operator",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "One complete, event-specific four-to-six-topic manifest is returned with protected facts unchanged and every visitor claim grounded.",
    },
    {
      sequence: 6,
      id: "validate_full_manifest",
      label: "Validate immutable facts, grounding, schema, and editorial quality",
      executor: "existing_event_factory",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "The full-manifest output passes the existing content, citation, schedule, sponsor, and semantic-quality checks.",
    },
    {
      sequence: 7,
      id: "luna_max_hero",
      label: "Create one event-specific hero with Luna Max",
      executor: "codex_operator",
      failureScope: "event_only",
      requiredForPrivatePreview: false,
      completionRule:
        "The named repository skill produces one 2:3 result; an alternative is allowed only after rejection or low confidence.",
    },
    {
      sequence: 8,
      id: "visual_workflow_review",
      label: "Validate, upload, and review hero art in the existing visual workflow",
      executor: "existing_event_factory",
      failureScope: "event_only",
      requiredForPrivatePreview: false,
      completionRule:
        "Only an approved, specification-compliant Supabase asset may enter the package; failed art does not hold other events.",
    },
    {
      sequence: 9,
      id: "private_package_preview",
      label: "Freeze the existing Event Factory package and private preview",
      executor: "existing_event_factory",
      failureScope: "event_only",
      requiredForPrivatePreview: true,
      completionRule:
        "The thin package envelope freezes exact evidence, synthesis, map, content, and approved art or an explicit art-pending state.",
    },
    {
      sequence: 10,
      id: "publication_hold",
      label: "Stop for explicit human package approval",
      executor: "human_reviewer",
      failureScope: "event_only",
      requiredForPrivatePreview: false,
      completionRule:
        "No canonicalization, Event Page activation, map discovery change, or publication action is available in Fast Track preparation.",
    },
  ];
}

function ultraHandoff(event: FastTrackApprovedEvent): FastTrackUltraHandoff {
  return {
    eventKey: event.eventKey,
    executionProfile: {
      host: "codex",
      model: "gpt-5.6-sol",
      reasoningEffort: "ultra",
    },
    task: "full_event_hub_manifest_authorship",
    initialAttemptLimit: 1,
    repairPolicy: "one_targeted_repair_only_after_validation_failure",
    editableScope: [
      "Hero tagline and visitor hook",
      "Event-specific topic count, navigation labels, and topic order",
      "Why Go, Schedule, one to three Highlights or Traditions topics, and Plan presentation",
      "Source-backed schedule presentation groups such as real stages, venues, days, or competition classes",
      "Source-backed visitor guidance, links, audience framing, and Scout content",
      "Complete visitor-facing hierarchy and prose across the manifest",
    ],
    protectedScope: [
      "Event identity and URL keys",
      "Dates, timezone, location, and coordinates",
      "Retained source identities and citations",
      "Current, recurring, and historical schedule facts",
      "Approved hero asset identity",
      "Lifecycle, review, package, and publication state",
    ],
    acceptanceChecks: [
      "Four to six substantive Event Hub topics chosen from the event evidence",
      "Every factual claim resolves to retained evidence",
      "No invented or altered event facts",
      "No sponsor or research-narration copy",
      "No core-copy repetition or generic factory language",
      "Why Go tells a complete event story and any Scout Spotlight is distinctive enough to keep",
      "All protected values remain equivalent",
    ],
  };
}

function heroHandoff(event: FastTrackApprovedEvent): FastTrackHeroHandoff {
  return {
    eventKey: event.eventKey,
    executionProfile: {
      host: "codex",
      model: "GPT-5.6 Luna",
      reasoningEffort: "max",
      hostMustPinProfile: true,
    },
    skill: "$create-celebration-atlas-hero",
    inputs: {
      eventName: event.displayName,
      city: event.city,
      state: event.state,
      ...(event.officialUrl ? { officialUrl: event.officialUrl } : {}),
      ...(event.venueName ? { venueName: event.venueName } : {}),
      targetYear: event.targetYear,
      knownConstraints: event.knownConstraints,
    },
    generationPolicy: {
      primaryImageCount: 1,
      alternatives: "only_after_rejection_or_low_confidence",
      maximumFocusedAlternatives: 1,
      researchPasses: 1,
      defaultAspectRatio: "2:3",
      generatedTextAllowed: false,
    },
    downstreamBoundary: {
      localOutputIsApproval: false,
      approvedSupabaseVisualWorkflowRequired: true,
    },
  };
}

function eventPlan(event: FastTrackApprovedEvent): FastTrackEventPlan {
  return {
    eventKey: event.eventKey,
    sourceRecordId: event.sourceRecordId,
    inputHash: event.inputHash,
    displayName: event.displayName,
    targetYear: event.targetYear,
    runPolicy: {
      isolation: "event",
      continueOtherEventsOnFailure: true,
      privateWritesAuthorizedByListApproval: true,
      publicationAuthorized: false,
    },
    retainedSafetyGates: [...RETAINED_SAFETY_GATES],
    skippedCeremony: [...SKIPPED_CEREMONY],
    stages: stages(),
    ultraHandoff: ultraHandoff(event),
    heroHandoff: heroHandoff(event),
    terminalState: "awaiting_explicit_package_approval",
  };
}

export function planFastTrackApprovedList(args: {
  list: FastTrackApprovedList;
  inputHash?: string;
  preparedAt?: string;
}): FastTrackPlan {
  const preparedAt = args.preparedAt ?? new Date().toISOString();
  if (Number.isNaN(Date.parse(preparedAt))) {
    throw new Error("preparedAt must be a valid timestamp.");
  }
  const inputHash = args.inputHash ?? fastTrackSha256(args.list);
  return {
    schemaVersion: FAST_TRACK_PLAN_VERSION,
    planId: `fast-track:${args.list.listId}:${inputHash.slice(0, 16)}`,
    preparedAt: new Date(preparedAt).toISOString(),
    approvedList: {
      listId: args.list.listId,
      approvedBy: args.list.approvedBy,
      approvedAt: args.list.approvedAt,
      inputHash,
      eventCount: args.list.events.length,
    },
    executionPolicy: {
      mode: "codex_operated",
      eventIsolation: true,
      continueOnEventFailure: true,
      cohortCompletionRequired: false,
      publicationActionAvailable: false,
      stopBeforePublication: true,
    },
    compatibilityPolicy: {
      packageBoundary: "existing_event_factory_package",
      verificationRecord: "same_pass_from_retained_official_evidence",
      supportingSourceMinimum: 0,
      separateVerificationQueueWhenFactsComplete: false,
    },
    events: args.list.events.map(eventPlan),
  };
}
