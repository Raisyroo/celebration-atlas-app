import {
  matchCountySeeds,
} from "../county-seeds/matching.ts";
import {
  preflightCountySeedRecord,
  prepareCountySeedRecord,
  type CountySeedPreflightSnapshot,
  type PreparedCountySeedRecord,
  type PreflightCandidateRow,
} from "../county-seeds/staging.ts";
import type { NormalizedCountySeed } from "../county-seeds/types.ts";
import type { ApprovedCountyInventory } from "./countyInventory.ts";
import {
  completionSha256,
  parseMichiganCompletionManifest,
} from "./manifest.ts";
import type {
  CompletionRunReport,
  CompletionRunSnapshot,
  MichiganCompletionManifest,
} from "./types.ts";

export const COUNTY_COMPLETION_OPERATOR_VERSION =
  "michigan-county-completion-operator/1";
export const DEFAULT_COUNTY_COMPLETION_BATCH_SIZE = 5;

export const COUNTY_RECORD_STATUSES = [
  "existing_canonical_or_completed",
  "active_or_resumable",
  "protected_or_editorially_held",
  "disputed_or_ambiguous_identity",
  "insufficient_for_staging",
  "eligible_for_guarded_staging",
  "evidence_or_current_edition_verification_required",
] as const;

export type CountyRecordStatus = (typeof COUNTY_RECORD_STATUSES)[number];

export type CountyOperatorBundleRow = {
  id: string;
  status: string;
  candidate_id: string | null;
  canonical_event_id?: string | null;
  event_key: string | null;
  updated_at?: string;
};

export type CountyOperatorSynthesisRow = {
  id: string;
  status: string;
  bundle_id: string;
  created_at?: string;
};

export type CountyOperatorVerificationRow = {
  id: string;
  status: string;
  candidate_id: string | null;
  event_id: string | null;
  target_year: number;
  updated_at?: string;
};

export type CountyOperatorPackageRow = {
  id: string;
  status: string;
  candidate_id: string | null;
  event_id: string | null;
  verification_case_id: string;
  source_bundle_id: string;
  synthesis_id: string;
  readiness_checks?: Record<string, unknown> | null;
  art_asset?: Record<string, unknown> | null;
  published_at?: string | null;
  updated_at?: string;
};

export type CountyOperatorVisualRow = {
  id: string;
  status: string;
  candidate_id: string | null;
  event_key: string | null;
  asset?: Record<string, unknown> | null;
  updated_at?: string;
};

export type CountyOperatorSnapshot = {
  preflight: CountySeedPreflightSnapshot;
  sourceBundles: CountyOperatorBundleRow[];
  syntheses: CountyOperatorSynthesisRow[];
  verificationCases: CountyOperatorVerificationRow[];
  packages: CountyOperatorPackageRow[];
  visualWorkflows: CountyOperatorVisualRow[];
  completionRuns: CompletionRunSnapshot[];
};

export type CountyRecordProjection = {
  sourceRecordId: string;
  eventName: string;
  municipality: string;
  status: CountyRecordStatus;
  statusReason: string;
  activity: "excluded" | "completed" | "active" | "resumable" | "exception" | "eligible";
  requirements: {
    currentEditionVerificationRequired: boolean;
    locationVerificationRequired: boolean;
    evidenceRequired: boolean;
  };
  canonicalEventId: string | null;
  candidateId: string | null;
  completionRunId: string | null;
  currentCompletionStage: string | null;
  exceptionCode: string | null;
  exceptionReviewState: string | null;
  sourceBundleId: string | null;
  sourceBundleState: string | null;
  synthesisId: string | null;
  synthesisState: string | null;
  verificationCaseId: string | null;
  verificationCaseState: string | null;
  privatePackageId: string | null;
  privatePackageState: string | null;
  artState: "approved" | "pending" | "not_started";
  publicationArtState:
    | "published_with_approved_art"
    | "published_without_art"
    | "image_uploaded_awaiting_approval"
    | "blocked_non_art"
    | "private_awaiting_verification";
  publicationReadinessState:
    | "already_completed"
    | "publication_blocked"
    | "art_pending"
    | "review_ready"
    | "not_reached";
  manifestBatchId: string | null;
  manifestHash: string | null;
};

type PlannedCountyRecord = CountyRecordProjection & {
  seed: NormalizedCountySeed;
  candidate: PreflightCandidateRow | null;
  preparedSeed: PreparedCountySeedRecord | null;
  compatibleRun: CompletionRunSnapshot | null;
  resumeRecommended: boolean;
};

export type CountyCompletionBatchPlan = {
  batchId: string;
  sourceRecordIds: string[];
  stagingManifestHash: string;
  manifest: MichiganCompletionManifest;
  manifestHash: string;
};

export type CountyOperationPlan = {
  schemaVersion: "michigan-county-operation-plan/v1";
  operatorVersion: typeof COUNTY_COMPLETION_OPERATOR_VERSION;
  inventory: {
    stateId: "MI";
    countyCode: string;
    countyName: string;
    artifactPath: string;
    artifactSha256: string;
    inventorySha256: string;
    workbookFileName: string;
    workbookSha256: string;
    sourceSheet: string;
    approvedSheetSha256: string;
    recordCount: number;
    workbookValidation: ApprovedCountyInventory["workbookValidation"];
  };
  execution: {
    dryRun: boolean;
    deterministicOnly: true;
    modelBudgetTokens: 0;
    perEventModelBudgetTokens: 0;
    concurrency: number;
    batchSize: number;
    privateWritesAuthorized: boolean;
    publicationAuthorized: false;
    imageActionsAuthorized: false;
  };
  records: CountyRecordProjection[];
  batches: CountyCompletionBatchPlan[];
  resumeRunIds: string[];
  internal: {
    records: PlannedCountyRecord[];
  };
};

export type CountyBatchExecution = {
  kind: "started" | "resumed";
  batchId: string | null;
  runId: string | null;
  exitCode: number;
  snapshot: CompletionRunSnapshot | null;
  report: CompletionRunReport | null;
  error: string | null;
};

export type CountyRunExecutionResult = {
  runId: string;
  exitCode: number;
  snapshot: CompletionRunSnapshot;
  report: CompletionRunReport;
};

export type CountyOperationReport = {
  schemaVersion: "michigan-county-operation-report/v1";
  generatedAt: string;
  operatorVersion: typeof COUNTY_COMPLETION_OPERATOR_VERSION;
  inventory: CountyOperationPlan["inventory"];
  safeguards: {
    dryRun: boolean;
    deterministicOnly: true;
    modelBudgetTokens: 0;
    perEventModelBudgetTokens: 0;
    automaticImageActions: 0;
    publicationActions: 0;
    publicationWrites: 0;
    humanPublicationApprovalRequired: true;
  };
  counts: Record<CountyRecordStatus, number> & {
    total: number;
    batches: number;
    startedRuns: number;
    resumedRuns: number;
    runFailures: number;
    modelActions: number;
    modelUsageTokens: number;
  };
  batches: Array<{
    batchId: string | null;
    sourceRecordIds: string[];
    manifestHash: string | null;
    runId: string | null;
    action: "planned" | "started" | "resumed" | "retained" | "failed";
    finalStatus: string | null;
    exitCode: number | null;
    error: string | null;
  }>;
  records: CountyRecordProjection[];
  integrity: {
    algorithm: "sha256";
    reportSha256: string;
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function targetYear(seed: NormalizedCountySeed) {
  if (seed.dateInformation.kind === "exact_range") {
    return Number(seed.dateInformation.startDate.slice(0, 4));
  }
  if (seed.dateInformation.kind === "year_only") {
    return seed.dateInformation.year;
  }
  if (/^\d{4}$/.test(seed.mostRecentConfirmedEdition ?? "")) {
    return Number(seed.mostRecentConfirmedEdition);
  }
  return null;
}

function cohortRelationships(seeds: NormalizedCountySeed[], seed: NormalizedCountySeed) {
  const matching = (selector: (candidate: NormalizedCountySeed) => string | null) => {
    const identity = selector(seed);
    if (!identity) return [seed.cleanId];
    return seeds
      .filter((candidate) => selector(candidate) === identity)
      .map((candidate) => candidate.cleanId)
      .sort();
  };
  return {
    shared_official_url_clean_ids: matching(
      (candidate) => candidate.officialEventUrl.identityKey,
    ),
    shared_organizer_clean_ids: matching(
      (candidate) => candidate.normalizedOrganizer,
    ),
    shared_venue_clean_ids: matching(
      (candidate) => candidate.normalizedVenue,
    ),
  };
}

function latestByUpdatedAt<
  T extends { updated_at?: string; created_at?: string },
>(rows: T[]) {
  return [...rows].sort(
    (left, right) =>
      text(right.updated_at || right.created_at).localeCompare(
        text(left.updated_at || left.created_at),
      ),
  )[0] ?? null;
}

function candidateCleanId(candidate: PreflightCandidateRow) {
  const raw = isRecord(candidate.raw_payload) ? candidate.raw_payload : {};
  const countySeed = isRecord(raw.county_seed) ? raw.county_seed : {};
  return text(countySeed.clean_id);
}

function matchingCompletionRun(
  seed: NormalizedCountySeed,
  snapshot: CountyOperatorSnapshot,
  dryRun: boolean,
  countyCode: string,
  inventorySha256: string,
  candidateId: string | null,
  canonicalEventId: string | null,
) {
  return [...snapshot.completionRuns]
    .filter(
      (run) => run.run.countyCode === countyCode,
    )
    .filter(
      (run) =>
        run.run.dryRun === dryRun &&
        run.run.deterministicOnly &&
        run.run.modelBudgetTokens === 0 &&
        run.run.perEventModelBudgetTokens === 0,
    )
    .filter((run) => {
      const event = run.manifest?.events.find(
        (candidate) => candidate.sourceRecordId === seed.cleanId,
      );
      if (!event) return false;
      const retainedCandidateId = event.references?.candidateId ?? null;
      const retainedCanonicalId = event.references?.canonicalEventId ?? null;
      if (
        candidateId &&
        retainedCandidateId &&
        retainedCandidateId !== candidateId
      ) {
        return false;
      }
      if (
        canonicalEventId &&
        retainedCanonicalId &&
        retainedCanonicalId !== canonicalEventId
      ) {
        return false;
      }
      const eventMetadata = isRecord(event.metadata) ? event.metadata : {};
      const retainedInventoryHash = text(eventMetadata.inventorySha256);
      if (
        retainedInventoryHash &&
        retainedInventoryHash !== inventorySha256
      ) {
        return false;
      }
      const retainedOfficialSource = text(eventMetadata.officialSourceUrl);
      if (
        retainedOfficialSource &&
        retainedOfficialSource !== seed.officialEventUrl.original
      ) {
        return false;
      }
      const countySeedCandidate = isRecord(event.countySeed?.candidate)
        ? event.countySeed.candidate
        : {};
      const retainedCountySeed = isRecord(countySeedCandidate.county_seed)
        ? countySeedCandidate.county_seed
        : {};
      const retainedDecision = isRecord(retainedCountySeed.resolved_decision)
        ? retainedCountySeed.resolved_decision
        : {};
      const retainedReviewedInventoryHash = text(
        retainedDecision.reviewed_inventory_hash,
      );
      if (
        retainedReviewedInventoryHash &&
        retainedReviewedInventoryHash !== inventorySha256
      ) {
        return false;
      }
      return Boolean(
        retainedInventoryHash === inventorySha256 ||
          retainedReviewedInventoryHash === inventorySha256 ||
          (candidateId && retainedCandidateId === candidateId) ||
          (canonicalEventId && retainedCanonicalId === canonicalEventId),
      );
    })
    .sort((left, right) =>
      right.run.updatedAt.localeCompare(left.run.updatedAt),
    )[0] ?? null;
}

function runProjection(
  run: CompletionRunSnapshot | null,
  sourceRecordId: string,
) {
  if (!run?.manifest) {
    return {
      runId: null,
      currentStage: null,
      exceptionCode: null,
      exceptionReviewState: null,
      completed: false,
      active: false,
      resumeRecommended: false,
    };
  }
  const eventInput = run.manifest.events.find(
    (event) => event.sourceRecordId === sourceRecordId,
  );
  const event = eventInput
    ? run.events.find((candidate) => candidate.eventKey === eventInput.eventKey)
    : null;
  const exceptions = eventInput
    ? run.exceptions.filter(
        (exception) => exception.eventKey === eventInput.eventKey,
      )
    : [];
  const openException = exceptions.find((exception) =>
    ["open", "acknowledged"].includes(exception.status),
  );
  const completed =
    event?.status === "completed" ||
    event?.status === "ready_for_review" ||
    run.run.status === "completed";
  const active = ["queued", "validating", "running"].includes(run.run.status);
  const resumeRecommended =
    run.run.status === "waiting_for_exceptions" &&
    !run.exceptions.some((exception) =>
      ["open", "acknowledged"].includes(exception.status),
    );
  return {
    runId: run.run.id,
    currentStage: event?.currentStageId ?? null,
    exceptionCode: openException?.code ?? null,
    exceptionReviewState: openException?.status ?? null,
    completed,
    active,
    resumeRecommended,
  };
}

function referencesForCandidate(
  candidateId: string | null,
  canonicalEventId: string | null,
  eventKey: string,
  year: number | null,
  snapshot: CountyOperatorSnapshot,
) {
  const bundle = latestByUpdatedAt(
    snapshot.sourceBundles.filter(
      (row) =>
        (candidateId && row.candidate_id === candidateId) ||
        (canonicalEventId && row.canonical_event_id === canonicalEventId) ||
        row.event_key === eventKey,
    ),
  );
  const synthesis = bundle
    ? latestByUpdatedAt(
        snapshot.syntheses.filter(
          (row) => row.bundle_id === bundle.id,
        ),
      )
    : null;
  const verification = latestByUpdatedAt(
    snapshot.verificationCases.filter(
      (row) =>
        ((!year || row.target_year === year) &&
          ((candidateId && row.candidate_id === candidateId) ||
            (canonicalEventId && row.event_id === canonicalEventId))),
    ),
  );
  const packageRow = latestByUpdatedAt(
    snapshot.packages.filter(
      (row) =>
        (candidateId && row.candidate_id === candidateId) ||
        (canonicalEventId && row.event_id === canonicalEventId) ||
        (verification && row.verification_case_id === verification.id),
    ),
  );
  const publishedPackage = latestByUpdatedAt(
    snapshot.packages.filter(
      (row) =>
        row.status === "published" &&
        ((candidateId && row.candidate_id === candidateId) ||
          (canonicalEventId && row.event_id === canonicalEventId) ||
          (verification && row.verification_case_id === verification.id)),
    ),
  );
  const visual = latestByUpdatedAt(
    snapshot.visualWorkflows.filter(
      (row) =>
        (candidateId && row.candidate_id === candidateId) ||
        row.event_key === eventKey,
    ),
  );
  const artReady =
    isRecord(publishedPackage?.readiness_checks) &&
    publishedPackage.readiness_checks.art === true &&
    isRecord(publishedPackage.art_asset) &&
    typeof (publishedPackage.art_asset.publicUrl ?? publishedPackage.art_asset.src) === "string";
  const uploadedAwaitingApproval =
    visual?.status === "ready_for_review" &&
    isRecord(visual.asset) &&
    typeof visual.asset.publicUrl === "string";
  return {
    bundle,
    synthesis,
    verification,
    packageRow,
    publishedPackage,
    visual,
    artReady,
    uploadedAwaitingApproval,
    references: {
      candidateId,
      canonicalEventId,
      sourceBundleId: bundle?.id ?? null,
      synthesisId: synthesis?.id ?? null,
      verificationCaseId: verification?.id ?? null,
      packageId: packageRow?.id ?? null,
    },
  };
}

function baseProjection(args: {
  seed: NormalizedCountySeed;
  status: CountyRecordStatus;
  statusReason: string;
  activity: CountyRecordProjection["activity"];
  candidateId?: string | null;
  canonicalEventId?: string | null;
  run?: ReturnType<typeof runProjection>;
  refs?: ReturnType<typeof referencesForCandidate>;
}): CountyRecordProjection {
  const { seed } = args;
  const run = args.run;
  const refs = args.refs;
  return {
    sourceRecordId: seed.cleanId,
    eventName: seed.candidateName,
    municipality: seed.municipality,
    status: args.status,
    statusReason: args.statusReason,
    activity: args.activity,
    requirements: {
      currentEditionVerificationRequired: true,
      locationVerificationRequired:
        seed.geocoding.requiresVerifiedCoordinates ||
        seed.geocoding.addressResolutionRequired,
      evidenceRequired: true,
    },
    canonicalEventId: args.canonicalEventId ?? null,
    candidateId: args.candidateId ?? null,
    completionRunId: run?.runId ?? null,
    currentCompletionStage: run?.currentStage ?? null,
    exceptionCode: run?.exceptionCode ?? null,
    exceptionReviewState: run?.exceptionReviewState ?? null,
    sourceBundleId: refs?.bundle?.id ?? null,
    sourceBundleState: refs?.bundle?.status ?? null,
    synthesisId: refs?.synthesis?.id ?? null,
    synthesisState: refs?.synthesis?.status ?? null,
    verificationCaseId: refs?.verification?.id ?? null,
    verificationCaseState: refs?.verification?.status ?? null,
    privatePackageId: refs?.packageRow?.id ?? null,
    privatePackageState: refs?.packageRow?.status ?? null,
    artState: refs?.artReady
      ? "approved"
      : refs?.packageRow
        ? "pending"
        : "not_started",
    publicationArtState: refs?.publishedPackage
      ? refs.artReady
        ? "published_with_approved_art"
        : refs.uploadedAwaitingApproval
          ? "image_uploaded_awaiting_approval"
          : "published_without_art"
      : refs?.verification?.status === "verified" && args.activity !== "exception"
        ? "private_awaiting_verification"
        : args.activity === "exception" || args.activity === "excluded"
          ? "blocked_non_art"
          : "private_awaiting_verification",
    publicationReadinessState:
      args.status === "existing_canonical_or_completed"
        ? "already_completed"
        : refs?.artReady
          ? "review_ready"
          : refs?.packageRow
            ? "art_pending"
            : "not_reached",
    manifestBatchId: null,
    manifestHash: null,
  };
}

function classifyRecords(args: {
  inventory: ApprovedCountyInventory;
  snapshot: CountyOperatorSnapshot;
  dryRun: boolean;
  privateWritesAuthorized: boolean;
}): PlannedCountyRecord[] {
  const { inventory, snapshot } = args;
  const matches = matchCountySeeds(
    inventory.seeds,
    snapshot.preflight.events,
    snapshot.preflight.candidates,
  );
  const matchById = new Map(matches.map((match) => [match.cleanId, match]));
  const holdById = new Map(
    inventory.config.editorialHolds.map((hold) => [hold.sourceRecordId, hold]),
  );
  const candidatesBySeedId = new Map(
    snapshot.preflight.candidates
      .map((candidate) => [candidateCleanId(candidate), candidate] as const)
      .filter(([cleanId]) => cleanId),
  );

  return inventory.seeds.map((seed): PlannedCountyRecord => {
    const eventKey = seed.proposedSlugCandidate;
    const hold = holdById.get(seed.cleanId);
    const match = matchById.get(seed.cleanId);
    const matchedCandidateId =
      match?.proposedCandidateMatch?.id ??
      candidatesBySeedId.get(seed.cleanId)?.id ??
      null;
    const candidate = matchedCandidateId
      ? snapshot.preflight.candidates.find(
          (row) => row.id === matchedCandidateId,
        ) ?? null
      : null;
    const matchedCanonicalId =
      match?.proposedCanonicalMatch?.id ??
      candidate?.matched_event_id ??
      null;
    const run = matchingCompletionRun(
      seed,
      snapshot,
      args.dryRun,
      inventory.config.countyCode,
      inventory.inventorySha256,
      candidate?.id ?? null,
      matchedCanonicalId,
    );
    const projectedRun = runProjection(run, seed.cleanId);
    const refs = referencesForCandidate(
      candidate?.id ?? null,
      matchedCanonicalId,
      eventKey,
      targetYear(seed),
      snapshot,
    );
    const finish = (
      projection: CountyRecordProjection,
      preparedSeed: PreparedCountySeedRecord | null = null,
    ): PlannedCountyRecord => ({
      ...projection,
      seed,
      candidate,
      preparedSeed,
      compatibleRun: run,
      resumeRecommended: projectedRun.resumeRecommended,
    });

    if (hold) {
      return finish(
        baseProjection({
          seed,
          status: "protected_or_editorially_held",
          statusReason: hold.reason,
          activity: "excluded",
          candidateId: candidate?.id,
          canonicalEventId: matchedCanonicalId,
          run: projectedRun,
          refs,
        }),
      );
    }
    if (projectedRun.completed || matchedCanonicalId) {
      return finish(
        baseProjection({
          seed,
          status: "existing_canonical_or_completed",
          statusReason: projectedRun.completed
            ? "A compatible immutable completion run already completed this inventory record."
            : "Deterministic county matching resolves this record to an existing canonical event.",
          activity: "completed",
          candidateId: candidate?.id,
          canonicalEventId: matchedCanonicalId,
          run: projectedRun,
          refs,
        }),
      );
    }
    if (run) {
      return finish(
        baseProjection({
          seed,
          status: "active_or_resumable",
          statusReason: projectedRun.active
            ? "A compatible immutable completion run is already active."
            : projectedRun.exceptionCode
              ? "A compatible immutable run is retained and waiting for its recorded exception."
              : "A compatible immutable run can resume from retained checkpoints.",
          activity: projectedRun.active
            ? "active"
            : projectedRun.exceptionCode
              ? "exception"
              : "resumable",
          candidateId: candidate?.id,
          run: projectedRun,
          refs,
        }),
      );
    }
    if (
      match?.primaryClassification === "Possible alias or duplicate" ||
      (candidate &&
        (candidate.needs_review !== false ||
          !["unique_candidate"].includes(candidate.duplicate_status)))
    ) {
      return finish(
        baseProjection({
          seed,
          status: "disputed_or_ambiguous_identity",
          statusReason: candidate
            ? "The retained candidate has not cleared its identity-review and unique-candidate contracts."
            : "Only a fuzzy or otherwise non-deterministic identity signal exists; no match or merge is inferred.",
          activity: "exception",
          candidateId: candidate?.id,
          refs,
        }),
      );
    }
    if (candidate) {
      return finish(
        baseProjection({
          seed,
          status: "evidence_or_current_edition_verification_required",
          statusReason:
            "The retained unique candidate can continue without restaging, but evidence and current-edition diligence remain incomplete.",
          activity: "eligible",
          candidateId: candidate.id,
          refs,
        }),
      );
    }
    if (
      match?.primaryClassification === "Insufficient information" ||
      !seed.officialEventUrl.original ||
      !seed.candidateName ||
      !seed.municipality ||
      !seed.address ||
      targetYear(seed) === null
    ) {
      return finish(
        baseProjection({
          seed,
          status: "insufficient_for_staging",
          statusReason:
            "The approved inventory record lacks the official-source, current-edition, location, or stable identity facts required for guarded staging.",
          activity: "excluded",
        }),
      );
    }

    const classificationBatchId = [
      "county-completion-classification",
      inventory.config.countyCode,
      inventory.inventorySha256.slice(0, 16),
      seed.cleanId.toLowerCase(),
    ].join(":");
    const preparedSeed = prepareCountySeedRecord({
      seed,
      workbookFileName: inventory.config.workbookFileName,
      inventoryName: `${inventory.config.countyName} approved inventory`,
      batchId: classificationBatchId,
      cohortRelationships: cohortRelationships(inventory.seeds, seed),
      reviewedSelection: "reviewed_county_completion_v1",
      executionApproval: args.privateWritesAuthorized
        ? "private_writes_explicitly_authorized"
        : "not_authorized",
      reviewedInventoryHash: inventory.inventorySha256,
    });
    const preflight = preflightCountySeedRecord(
      preparedSeed,
      snapshot.preflight,
    );
    if (
      preflight.action === "blocked" ||
      preflight.blockers.length ||
      preflight.warnings.includes("fuzzy_review_only")
    ) {
      return finish(
        baseProjection({
          seed,
          status: "disputed_or_ambiguous_identity",
          statusReason: preflight.warnings.includes("fuzzy_review_only")
            ? "A fuzzy-name signal requires human identity review and is not used to stage, match, or clear the candidate automatically."
            : `Guarded staging preflight blocked: ${preflight.blockers.join(", ")}.`,
          activity: "exception",
        }),
      );
    }
    return finish(
      baseProjection({
        seed,
        status: "eligible_for_guarded_staging",
        statusReason:
          "The record has a stable annual identity, official source, usable municipality/location, and a clean deterministic staging preflight.",
        activity: "eligible",
      }),
      preparedSeed,
    );
  });
}

function buildBatch(args: {
  inventory: ApprovedCountyInventory;
  records: PlannedCountyRecord[];
  privateWritesAuthorized: boolean;
}): CountyCompletionBatchPlan {
  const sourceRecordIds = args.records
    .map((record) => record.sourceRecordId)
    .sort();
  const mode = args.privateWritesAuthorized ? "private" : "dry";
  const recordSetHash = completionSha256(sourceRecordIds).slice(0, 16);
  const batchId = [
    "county-completion",
    args.inventory.config.countyCode,
    args.inventory.inventorySha256.slice(0, 16),
    mode,
    recordSetHash,
    "v1",
  ].join(":");
  const preparedById = new Map<string, PreparedCountySeedRecord>();
  for (const record of args.records) {
    if (record.status !== "eligible_for_guarded_staging") continue;
    preparedById.set(
      record.sourceRecordId,
      prepareCountySeedRecord({
        seed: record.seed,
        workbookFileName: args.inventory.config.workbookFileName,
        inventoryName: `${args.inventory.config.countyName} approved inventory`,
        batchId,
        cohortRelationships: cohortRelationships(
          args.inventory.seeds,
          record.seed,
        ),
        reviewedSelection: "reviewed_county_completion_v1",
        executionApproval: args.privateWritesAuthorized
          ? "private_writes_explicitly_authorized"
          : "not_authorized",
        reviewedInventoryHash: args.inventory.inventorySha256,
      }),
    );
  }
  const stagingManifestHash = completionSha256({
    contractVersion: "reviewed-county-completion-staging/v1",
    stateId: "MI",
    countyCode: args.inventory.config.countyCode,
    batchId,
    inventorySha256: args.inventory.inventorySha256,
    workbookSha256: args.inventory.config.workbookSha256,
    approvedSheetSha256: args.inventory.config.approvedSheetSha256,
    privateWritesAuthorized: args.privateWritesAuthorized,
    records: sourceRecordIds.map((sourceRecordId) => ({
      sourceRecordId,
      payloadSha256: preparedById.get(sourceRecordId)?.payload_sha256 ?? null,
      retainedCandidateId:
        args.records.find((record) => record.sourceRecordId === sourceRecordId)
          ?.candidateId ?? null,
    })),
  });

  const rawManifest = {
    schemaVersion: "michigan-completion-manifest/v1",
    stateId: "MI",
    countyCode: args.inventory.config.countyCode,
    batchId,
    inputManifestVersion: COUNTY_COMPLETION_OPERATOR_VERSION,
    events: args.records.map((record) => {
      const prepared = preparedById.get(record.sourceRecordId);
      const references = {
        candidateId: record.candidateId,
        canonicalEventId: record.canonicalEventId,
        sourceBundleId: record.sourceBundleId,
        synthesisId: record.synthesisId,
        verificationCaseId: record.verificationCaseId,
        packageId: record.privatePackageId,
      };
      return {
        eventKey: record.seed.proposedSlugCandidate,
        sourceRecordId: record.sourceRecordId,
        displayName: record.eventName,
        references,
        ...(prepared
          ? {
              countySeed: {
                batchId,
                manifestHash: stagingManifestHash,
                payloadHash: prepared.payload_sha256,
                idempotencyKey: prepared.args.p_idempotency_key,
                candidate: prepared.args.p_candidate,
                sources: prepared.args.p_sources,
              },
            }
          : {}),
        editorialPolicy: "deterministic_only",
        perEventModelBudgetTokens: 0,
        artProvenance: "unknown",
        metadata: {
          operatorVersion: COUNTY_COMPLETION_OPERATOR_VERSION,
          inventorySha256: args.inventory.inventorySha256,
          inventoryArtifactSha256: args.inventory.artifactSha256,
          workbookSha256: args.inventory.config.workbookSha256,
          approvedSheetSha256: args.inventory.config.approvedSheetSha256,
          sourceSheet: args.inventory.config.sourceSheet,
          sourceRow: record.seed.sourceRow,
          targetYear: targetYear(record.seed),
          officialSourceUrl: record.seed.officialEventUrl.original,
          supportingSourceUrls: record.seed.supportingUrls.map(
            (source) => source.original,
          ),
          classification: record.status,
          privateWritesAuthorized: args.privateWritesAuthorized,
          candidateStagingAuthorized:
            args.privateWritesAuthorized && Boolean(prepared),
          sourceBundleCompositionAuthorized: args.privateWritesAuthorized,
          verificationCompositionAuthorized: args.privateWritesAuthorized,
          deterministicIdentityRuleVersion:
            "county-completion-clean-identity/1",
          identityPreflightWarnings: [],
          canonicalizationAuthorized: false,
          imageActionAuthorized: false,
          publicationAuthorized: false,
        },
      };
    }),
    metadata: {
      operatorVersion: COUNTY_COMPLETION_OPERATOR_VERSION,
      inventorySha256: args.inventory.inventorySha256,
      inventoryArtifactSha256: args.inventory.artifactSha256,
      workbookFileName: args.inventory.config.workbookFileName,
      workbookSha256: args.inventory.config.workbookSha256,
      sourceSheet: args.inventory.config.sourceSheet,
      approvedSheetSha256: args.inventory.config.approvedSheetSha256,
      stagingManifestHash,
      deterministicOnly: true,
      runModelBudgetTokens: 0,
      perEventModelBudgetTokens: 0,
      canonicalizationAuthorized: false,
      imageActionAuthorized: false,
      publicationAuthorized: false,
    },
  };
  const parsed = parseMichiganCompletionManifest(rawManifest);
  if (!parsed.ok) {
    throw new Error(
      `Generated county completion manifest is invalid:\n- ${parsed.errors.join("\n- ")}`,
    );
  }
  return {
    batchId,
    sourceRecordIds,
    stagingManifestHash,
    manifest: parsed.value,
    manifestHash: parsed.inputHash,
  };
}

export function planCountyOperation(args: {
  inventory: ApprovedCountyInventory;
  snapshot: CountyOperatorSnapshot;
  authorizePrivateWrites?: boolean;
  batchSize?: number;
  concurrency?: number;
}): CountyOperationPlan {
  const batchSize = Math.max(
    1,
    Math.min(500, args.batchSize ?? DEFAULT_COUNTY_COMPLETION_BATCH_SIZE),
  );
  const concurrency = Math.max(1, Math.min(16, args.concurrency ?? 1));
  const dryRun = args.authorizePrivateWrites !== true;
  const internalRecords = classifyRecords({
    inventory: args.inventory,
    snapshot: args.snapshot,
    dryRun,
    privateWritesAuthorized: args.authorizePrivateWrites === true,
  });
  const processable = internalRecords.filter((record) =>
    [
      "eligible_for_guarded_staging",
      "evidence_or_current_edition_verification_required",
    ].includes(record.status),
  );
  const batches: CountyCompletionBatchPlan[] = [];
  for (let index = 0; index < processable.length; index += batchSize) {
    batches.push(
      buildBatch({
        inventory: args.inventory,
        records: processable.slice(index, index + batchSize),
        privateWritesAuthorized: args.authorizePrivateWrites === true,
      }),
    );
  }
  const batchByRecord = new Map(
    batches.flatMap((batch) =>
      batch.sourceRecordIds.map(
        (sourceRecordId) => [sourceRecordId, batch] as const,
      ),
    ),
  );
  const records = internalRecords.map((record) => {
    const batch = batchByRecord.get(record.sourceRecordId);
    return {
      ...record,
      manifestBatchId: batch?.batchId ?? record.manifestBatchId,
      manifestHash: batch?.manifestHash ?? record.manifestHash,
    };
  });
  const resumeRunIds = [
    ...new Set(
      internalRecords
        .filter((record) => record.resumeRecommended)
        .map((record) => record.completionRunId)
        .filter((runId): runId is string => Boolean(runId)),
    ),
  ].sort();
  return {
    schemaVersion: "michigan-county-operation-plan/v1",
    operatorVersion: COUNTY_COMPLETION_OPERATOR_VERSION,
    inventory: {
      stateId: "MI",
      countyCode: args.inventory.config.countyCode,
      countyName: args.inventory.config.countyName,
      artifactPath: args.inventory.artifactPath,
      artifactSha256: args.inventory.artifactSha256,
      inventorySha256: args.inventory.inventorySha256,
      workbookFileName: args.inventory.config.workbookFileName,
      workbookSha256: args.inventory.config.workbookSha256,
      sourceSheet: args.inventory.config.sourceSheet,
      approvedSheetSha256: args.inventory.config.approvedSheetSha256,
      recordCount: args.inventory.seeds.length,
      workbookValidation: args.inventory.workbookValidation,
    },
    execution: {
      dryRun,
      deterministicOnly: true,
      modelBudgetTokens: 0,
      perEventModelBudgetTokens: 0,
      concurrency,
      batchSize,
      privateWritesAuthorized: args.authorizePrivateWrites === true,
      publicationAuthorized: false,
      imageActionsAuthorized: false,
    },
    records,
    batches,
    resumeRunIds,
    internal: { records: internalRecords },
  };
}

function completionProjection(
  projection: CountyRecordProjection,
  execution: CountyBatchExecution,
) {
  const manifestEvent = execution.snapshot?.manifest?.events.find(
    (event) => event.sourceRecordId === projection.sourceRecordId,
  );
  if (!manifestEvent || !execution.snapshot || !execution.runId) {
    return projection;
  }
  const event = execution.snapshot.events.find(
    (candidate) => candidate.eventKey === manifestEvent.eventKey,
  );
  const openException = execution.snapshot.exceptions.find(
    (exception) =>
      exception.eventKey === manifestEvent.eventKey &&
      ["open", "acknowledged"].includes(exception.status),
  );
  return {
    ...projection,
    completionRunId: execution.runId,
    currentCompletionStage: event?.currentStageId ?? null,
    exceptionCode: openException?.code ?? null,
    exceptionReviewState: openException?.status ?? null,
    candidateId: event?.references.candidateId ?? projection.candidateId,
    canonicalEventId:
      event?.references.canonicalEventId ?? projection.canonicalEventId,
    sourceBundleId:
      event?.references.sourceBundleId ?? projection.sourceBundleId,
    synthesisId: event?.references.synthesisId ?? projection.synthesisId,
    verificationCaseId:
      event?.references.verificationCaseId ?? projection.verificationCaseId,
    privatePackageId:
      event?.references.packageId ?? projection.privatePackageId,
    privatePackageState:
      event?.references.packageId
        ? projection.privatePackageState ?? "private"
        : projection.privatePackageState,
    artState:
      event?.readinessState === "review_ready"
        ? "approved"
        : event?.readinessState === "art_pending"
          ? "pending"
          : projection.artState,
    publicationArtState:
      event?.readinessState === "review_ready" && event.publicationEligible
        ? projection.publicationArtState
        : openException
          ? "blocked_non_art"
          : projection.publicationArtState,
    publicationReadinessState:
      event?.readinessState === "review_ready"
        ? "review_ready"
        : event?.readinessState === "art_pending"
          ? "art_pending"
          : event
            ? "publication_blocked"
            : projection.publicationReadinessState,
    activity:
      event?.status === "completed" || event?.status === "ready_for_review"
        ? "completed"
        : openException
          ? "exception"
          : projection.activity,
  } satisfies CountyRecordProjection;
}

export function buildCountyOperationReport(args: {
  plan: CountyOperationPlan;
  executions?: CountyBatchExecution[];
  generatedAt?: string;
}): CountyOperationReport {
  const executions = args.executions ?? [];
  const records = args.plan.records.map((record) => {
    const execution = [...executions]
      .reverse()
      .find((item) =>
        item.snapshot?.manifest?.events.some(
          (event) => event.sourceRecordId === record.sourceRecordId,
        ),
      );
    return execution ? completionProjection(record, execution) : record;
  });
  const statusCounts = Object.fromEntries(
    COUNTY_RECORD_STATUSES.map((status) => [
      status,
      records.filter((record) => record.status === status).length,
    ]),
  ) as Record<CountyRecordStatus, number>;
  const plannedBatches = args.plan.batches.map((batch) => {
    const execution = executions.find(
      (item) => item.batchId === batch.batchId,
    );
    return {
      batchId: batch.batchId,
      sourceRecordIds: batch.sourceRecordIds,
      manifestHash: batch.manifestHash,
      runId: execution?.runId ?? null,
      action: execution
        ? execution.error
          ? "failed" as const
          : execution.kind
        : "planned" as const,
      finalStatus: execution?.snapshot?.run.status ?? null,
      exitCode: execution?.exitCode ?? null,
      error: execution?.error ?? null,
    };
  });
  const resumed = executions
    .filter((execution) => execution.kind === "resumed")
    .filter(
      (execution) =>
        !plannedBatches.some((batch) => batch.runId === execution.runId),
    )
    .map((execution) => ({
      batchId: execution.batchId,
      sourceRecordIds:
        execution.snapshot?.manifest?.events.map(
          (event) => event.sourceRecordId,
        ) ?? [],
      manifestHash: execution.snapshot?.run.inputHash ?? null,
      runId: execution.runId,
      action: execution.error ? "failed" as const : "resumed" as const,
      finalStatus: execution.snapshot?.run.status ?? null,
      exitCode: execution.exitCode,
      error: execution.error,
    }));
  const reportWithoutIntegrity: Omit<CountyOperationReport, "integrity"> = {
    schemaVersion: "michigan-county-operation-report/v1",
    generatedAt: args.generatedAt ?? new Date().toISOString(),
    operatorVersion: COUNTY_COMPLETION_OPERATOR_VERSION,
    inventory: args.plan.inventory,
    safeguards: {
      dryRun: args.plan.execution.dryRun,
      deterministicOnly: true,
      modelBudgetTokens: 0,
      perEventModelBudgetTokens: 0,
      automaticImageActions: 0,
      publicationActions: 0,
      publicationWrites: 0,
      humanPublicationApprovalRequired: true,
    },
    counts: {
      ...statusCounts,
      total: records.length,
      batches: args.plan.batches.length,
      startedRuns: executions.filter(
        (execution) => execution.kind === "started",
      ).length,
      resumedRuns: executions.filter(
        (execution) => execution.kind === "resumed",
      ).length,
      runFailures: executions.filter((execution) => execution.error).length,
      modelActions: executions.reduce(
        (sum, execution) =>
          sum + (execution.report?.counts.modelActions ?? 0),
        0,
      ),
      modelUsageTokens: executions.reduce(
        (sum, execution) =>
          sum + (execution.report?.counts.modelUsageTokens ?? 0),
        0,
      ),
    },
    batches: [...plannedBatches, ...resumed],
    records,
  };
  return {
    ...reportWithoutIntegrity,
    integrity: {
      algorithm: "sha256",
      reportSha256: completionSha256(reportWithoutIntegrity),
    },
  };
}

export async function executeCountyOperation(args: {
  plan: CountyOperationPlan;
  startBatch: (
    batch: CountyCompletionBatchPlan,
  ) => Promise<CountyRunExecutionResult>;
  resumeRun: (
    runId: string,
  ) => Promise<CountyRunExecutionResult>;
  planOnly?: boolean;
  generatedAt?: string;
}) {
  if (args.planOnly) {
    return {
      executions: [] as CountyBatchExecution[],
      report: buildCountyOperationReport({
        plan: args.plan,
        generatedAt: args.generatedAt,
      }),
    };
  }
  const executions: CountyBatchExecution[] = [];
  for (const runId of args.plan.resumeRunIds) {
    try {
      const result = await args.resumeRun(runId);
      executions.push({
        ...result,
        kind: "resumed",
        batchId: result.snapshot.run.batchId,
        error: null,
      });
    } catch (error) {
      const retained = args.plan.internal.records.find(
        (record) => record.completionRunId === runId,
      )?.compatibleRun;
      if (!retained) throw error;
      executions.push({
        kind: "resumed",
        batchId: retained.run.batchId,
        runId,
        exitCode: 1,
        snapshot: retained,
        report: {
          schemaVersion: 1,
          generatedAt: args.generatedAt ?? new Date().toISOString(),
          run: retained.run,
          safeguards: {
            publicationInvoked: false,
            automaticImageActionInvoked: false,
            dryRun: retained.run.dryRun,
            deterministicOnly: retained.run.deterministicOnly,
          },
          counts: {
            events: retained.events.length,
            completed: 0,
            readyForReview: 0,
            blocked: retained.events.length,
            failed: 1,
            openExceptions: retained.exceptions.length,
            publicationEligible: 0,
            modelActions: retained.modelActions.length,
            modelUsageTokens: retained.run.modelUsageTokens,
          },
          events: retained.events,
          exceptions: retained.exceptions,
          modelActions: retained.modelActions,
          failure: null,
        },
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  for (const batch of args.plan.batches) {
    try {
      const result = await args.startBatch(batch);
      executions.push({
        ...result,
        kind: "started",
        batchId: batch.batchId,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      executions.push({
        kind: "started",
        batchId: batch.batchId,
        runId: null,
        exitCode: 1,
        snapshot: null,
        report: null,
        error: message,
      });
    }
  }
  return {
    executions,
    report: buildCountyOperationReport({
      plan: args.plan,
      executions,
      generatedAt: args.generatedAt,
    }),
  };
}
