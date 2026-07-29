import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import type {
  CountySeedPreflightSnapshot,
  PreflightCandidateRow,
} from "../lib/county-seeds/staging.ts";
import {
  buildCountyOperationReport,
  executeCountyOperation,
  planCountyOperation,
  type CountyCompletionBatchPlan,
  type CountyOperatorSnapshot,
  type CountyRunExecutionResult,
} from "../lib/michigan-completion/countyOperator.ts";
import { loadApprovedCountyInventory } from "../lib/michigan-completion/countyInventory.ts";
import { evaluateDeterministicIdentityClearance } from "../lib/michigan-completion/identityClearance.ts";
import {
  completionSha256,
  parseMichiganCompletionManifest,
} from "../lib/michigan-completion/manifest.ts";
import { buildCompletionRunReport } from "../lib/michigan-completion/orchestrator.ts";
import {
  composeRetainedSourceBundle,
  composeVerificationCase,
  type SourceCompositionServices,
  type VerificationCompositionServices,
} from "../lib/michigan-completion/privateComposition.ts";
import type {
  CompletionExceptionRecord,
  CompletionRun,
  CompletionRunEvent,
  CompletionRunSnapshot,
  MichiganCompletionManifest,
} from "../lib/michigan-completion/types.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXED_TIME = "2026-07-29T12:00:00.000Z";
const ART_CANDIDATE_ID = "72b00d6f-4b37-4fda-b04a-2bf30dd25800";
const ART_RUN_ID = "86875a83-0754-4245-80a7-646a3c9c37a5";

function candidate(args: {
  id: string;
  cleanId: string;
  name: string;
  slug: string;
  city: string;
  officialUrl: string;
  needsReview: boolean;
  duplicateStatus: string;
}): PreflightCandidateRow {
  return {
    id: args.id,
    candidate_name: args.name,
    normalized_name: args.name.toLowerCase(),
    slug_candidate: args.slug,
    city: args.city,
    county: "Macomb",
    venue_name: null,
    official_website_candidate: args.officialUrl,
    typical_month: null,
    typical_season: null,
    verification_status: "needs_review",
    duplicate_status: args.duplicateStatus,
    matched_event_id: null,
    needs_review: args.needsReview,
    raw_payload: {
      county_seed: {
        county_code: "macomb",
        clean_id: args.cleanId,
      },
    },
    source_urls: [args.officialUrl],
    created_at: FIXED_TIME,
  };
}

function fixtureManifest(args: {
  batchId: string;
  sourceRecordId: string;
  eventKey: string;
  candidateId: string;
}) {
  const parsed = parseMichiganCompletionManifest({
    schemaVersion: "michigan-completion-manifest/v1",
    stateId: "MI",
    countyCode: "macomb",
    batchId: args.batchId,
    inputManifestVersion: "validator/1",
    events: [
      {
        eventKey: args.eventKey,
        sourceRecordId: args.sourceRecordId,
        references: { candidateId: args.candidateId },
        editorialPolicy: "deterministic_only",
        perEventModelBudgetTokens: 0,
        artProvenance: "unknown",
        metadata: {},
      },
    ],
    metadata: {},
  });
  if (!parsed.ok) throw new Error(parsed.errors.join(", "));
  return { manifest: parsed.value, inputHash: parsed.inputHash };
}

function runSnapshot(args: {
  runId: string;
  manifest: MichiganCompletionManifest;
  inputHash: string;
  status?: CompletionRun["status"];
  eventStatus?: CompletionRunEvent["status"];
  exceptionStatus?: CompletionExceptionRecord["status"] | null;
}): CompletionRunSnapshot {
  const status = args.status ?? "waiting_for_exceptions";
  const eventStatus = args.eventStatus ?? "waiting_for_exception";
  const eventInput = args.manifest.events[0];
  const run: CompletionRun = {
    id: args.runId,
    operationRunId: args.runId,
    stateId: "MI",
    countyCode: "macomb",
    batchId: args.manifest.batchId,
    inputManifestVersion: args.manifest.inputManifestVersion,
    inputHash: args.inputHash,
    orchestratorVersion: "michigan-completion-orchestrator/2",
    dryRun: true,
    deterministicOnly: true,
    status,
    stageCounts: {},
    retryCount: 0,
    maxConcurrency: 1,
    modelBudgetTokens: 0,
    perEventModelBudgetTokens: 0,
    modelReservedTokens: 0,
    modelUsageTokens: 0,
    estimatedModelInputTokens: 0,
    estimatedModelOutputTokens: 0,
    actualModelInputTokens: 0,
    actualModelOutputTokens: 0,
    exceptionCount: args.exceptionStatus ? 1 : 0,
    publicationEligibilityCount: 0,
    createdAt: FIXED_TIME,
    startedAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    completedAt:
      status === "completed" ? FIXED_TIME : null,
    error: null,
  };
  const event: CompletionRunEvent = {
    id: `${args.runId}:${eventInput.eventKey}`,
    runId: args.runId,
    eventKey: eventInput.eventKey,
    sourceRecordId: eventInput.sourceRecordId,
    inputHash: eventInput.inputHash,
    status: eventStatus,
    currentStageId:
      eventStatus === "completed" ? "publication_readiness" : "identity_matching",
    lastSuccessfulStageId: "candidate_staging",
    retryCount: 0,
    modelBudgetTokens: 0,
    modelReservedTokens: 0,
    modelUsageTokens: 0,
    readinessState: "publication_blocked",
    artProvenance: "unknown",
    publicationEligible: false,
    references: eventInput.references,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    completedAt: eventStatus === "completed" ? FIXED_TIME : null,
  };
  const exceptions: CompletionExceptionRecord[] = args.exceptionStatus
    ? [
        {
          id: "6a4020b6-7751-46d0-b25c-18abba8ff969",
          runId: args.runId,
          runEventId: event.id,
          eventKey: event.eventKey,
          stageId: "identity_matching",
          code: "uncertain_identity_match",
          classification: "human_review_required",
          status: args.exceptionStatus,
          message: "Fixture identity review.",
          details: {},
          publicationBlocking: true,
          createdAt: FIXED_TIME,
          updatedAt: FIXED_TIME,
          resolvedAt:
            args.exceptionStatus === "resolved" ? FIXED_TIME : null,
        },
      ]
    : [];
  return {
    run,
    manifest: args.manifest,
    events: [event],
    checkpoints: [],
    exceptions,
    modelActions: [],
    audit: [],
  };
}

function baseSnapshot(artRun: CompletionRunSnapshot): CountyOperatorSnapshot {
  const preflight: CountySeedPreflightSnapshot = {
    captured_at: FIXED_TIME,
    method: "PostgREST GET only",
    schema_guard: {
      guarded_rpc_visible: true,
      required_migration: "026_generalize_county_completion_staging.sql",
    },
    events: [
      {
        id: "46d7e6ff-bec5-4801-80da-2d21aa131092",
        name: "Armada Fair",
        slug: "armada-fair",
        city: "Armada",
        county: "Macomb",
        venue_name: null,
        official_website: "https://www.armadafair.org/",
        typical_month: "August",
        typical_season: null,
        status: "active",
        verification_status: "verified",
      },
      {
        id: "79fa12bb-8b3d-4b9f-bf55-1972295e6998",
        name: "Romeo Peach Festival",
        slug: "romeo-peach-festival",
        city: "Romeo",
        county: "Macomb",
        venue_name: null,
        official_website: "https://romeopeachfestival.com/",
        typical_month: "September",
        typical_season: null,
        status: "active",
        verification_status: "verified",
      },
    ],
    candidates: [
      candidate({
        id: ART_CANDIDATE_ID,
        cleanId: "MAC-041",
        name: "Art on the Bay",
        slug: "art-on-the-bay-new-baltimore-mi",
        city: "New Baltimore",
        officialUrl: "https://www.artonthebay.com/",
        needsReview: true,
        duplicateStatus: "unchecked",
      }),
    ],
    sources: [
      {
        id: "528bcd0e-ce4c-4fc4-8135-0edf9a6dbaa7",
        candidate_id: ART_CANDIDATE_ID,
        source_url: "https://www.artonthebay.com/",
        source_type: "official",
        created_at: FIXED_TIME,
      },
    ],
    operation_runs: [],
  };
  return {
    preflight,
    sourceBundles: [],
    syntheses: [],
    verificationCases: [],
    packages: [],
    visualWorkflows: [],
    completionRuns: [artRun],
  };
}

function statusCounts(plan: ReturnType<typeof planCountyOperation>) {
  return Object.fromEntries(
    plan.records.map((record) => record.status).map((status) => [
      status,
      plan.records.filter((record) => record.status === status).length,
    ]),
  );
}

function batchRunResult(
  batch: CountyCompletionBatchPlan,
  sequence: number,
): CountyRunExecutionResult {
  const runId = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  const run: CompletionRun = {
    id: runId,
    operationRunId: runId,
    stateId: "MI",
    countyCode: "macomb",
    batchId: batch.batchId,
    inputManifestVersion: batch.manifest.inputManifestVersion,
    inputHash: batch.manifestHash,
    orchestratorVersion: "michigan-completion-orchestrator/2",
    dryRun: true,
    deterministicOnly: true,
    status: "waiting_for_exceptions",
    stageCounts: {},
    retryCount: 0,
    maxConcurrency: 1,
    modelBudgetTokens: 0,
    perEventModelBudgetTokens: 0,
    modelReservedTokens: 0,
    modelUsageTokens: 0,
    estimatedModelInputTokens: 0,
    estimatedModelOutputTokens: 0,
    actualModelInputTokens: 0,
    actualModelOutputTokens: 0,
    exceptionCount: 1,
    publicationEligibilityCount: 0,
    createdAt: FIXED_TIME,
    startedAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    completedAt: null,
    error: null,
  };
  const events: CompletionRunEvent[] = batch.manifest.events.map(
    (event, index) => ({
      id: `${runId}:${event.eventKey}`,
      runId,
      eventKey: event.eventKey,
      sourceRecordId: event.sourceRecordId,
      inputHash: event.inputHash,
      status: index === 0 ? "waiting_for_exception" : "completed",
      currentStageId:
        index === 0 ? "evidence_readiness" : "publication_readiness",
      lastSuccessfulStageId:
        index === 0 ? "identity_matching" : "publication_readiness",
      retryCount: 0,
      modelBudgetTokens: 0,
      modelReservedTokens: 0,
      modelUsageTokens: 0,
      readinessState:
        index === 0 ? "publication_blocked" : "art_pending",
      artProvenance: "unknown",
      publicationEligible: false,
      references: event.references,
      createdAt: FIXED_TIME,
      updatedAt: FIXED_TIME,
      completedAt: index === 0 ? null : FIXED_TIME,
    }),
  );
  const exceptionRecord: CompletionExceptionRecord = {
    id: `10000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`,
    runId,
    runEventId: events[0].id,
    eventKey: events[0].eventKey,
    stageId: "evidence_readiness",
    code: "missing_official_source",
    classification: "human_review_required",
    status: "open",
    message: "Fixture source exception.",
    details: {},
    publicationBlocking: true,
    createdAt: FIXED_TIME,
    updatedAt: FIXED_TIME,
    resolvedAt: null,
  };
  const snapshot: CompletionRunSnapshot = {
    run,
    manifest: batch.manifest,
    events,
    checkpoints: [],
    exceptions: [exceptionRecord],
    modelActions: [],
    audit: [],
  };
  return {
    runId,
    exitCode: 2,
    snapshot,
    report: buildCompletionRunReport(snapshot, FIXED_TIME),
  };
}

async function validateInventoryAndPlanning() {
  const inventory = await loadApprovedCountyInventory({
    repositoryRoot: ROOT,
    countyInput: "Macomb County",
  });
  assert.equal(inventory.seeds.length, 83);
  assert.equal(inventory.workbookValidation.mode, "retained_fingerprint");

  const artFixture = fixtureManifest({
    batchId: "art-on-the-bay-dry-proof",
    sourceRecordId: "MAC-041",
    eventKey: "art-on-the-bay-new-baltimore-mi",
    candidateId: ART_CANDIDATE_ID,
  });
  const artRun = runSnapshot({
    runId: ART_RUN_ID,
    manifest: artFixture.manifest,
    inputHash: artFixture.inputHash,
    exceptionStatus: "open",
  });
  const snapshot = baseSnapshot(artRun);
  const plan = planCountyOperation({
    inventory,
    snapshot,
    batchSize: 5,
    concurrency: 1,
  });
  assert.equal(plan.records.length, 83);
  assert.deepEqual(statusCounts(plan), {
    existing_canonical_or_completed: 2,
    eligible_for_guarded_staging: 43,
    insufficient_for_staging: 34,
    active_or_resumable: 1,
    protected_or_editorially_held: 3,
  });
  assert.equal(plan.batches.length, 9);
  assert.equal(
    plan.records.filter(
      (record) => record.requirements.currentEditionVerificationRequired,
    ).length,
    83,
  );
  assert.equal(
    plan.records.filter(
      (record) => record.requirements.locationVerificationRequired,
    ).length,
    83,
  );
  const excludedIds = new Set([
    "MAC-001",
    "MAC-026",
    "MAC-041",
    "MAC-042",
    "MAC-049",
    "MAC-050",
  ]);
  for (const batch of plan.batches) {
    assert.equal(batch.manifest.events.length <= 5, true);
    assert.equal(
      batch.sourceRecordIds.some((sourceRecordId) =>
        excludedIds.has(sourceRecordId),
      ),
      false,
    );
    assert.equal(
      completionSha256(batch.manifest),
      batch.manifestHash,
    );
  }

  const replayPlan = planCountyOperation({
    inventory,
    snapshot,
    batchSize: 5,
    concurrency: 1,
  });
  assert.deepEqual(
    replayPlan.batches.map((batch) => batch.manifestHash),
    plan.batches.map((batch) => batch.manifestHash),
  );
  assert.equal(replayPlan.inventory.inventorySha256, plan.inventory.inventorySha256);

  const eligible = plan.records.find(
    (record) => record.status === "eligible_for_guarded_staging",
  );
  assert(eligible);
  const seed = inventory.seeds.find(
    (candidateSeed) => candidateSeed.cleanId === eligible.sourceRecordId,
  );
  assert(seed);
  const reusableCandidateId = "00000000-0000-4000-8000-000000000303";
  const reuseSnapshot = structuredClone(snapshot);
  reuseSnapshot.preflight.candidates.push(
    candidate({
      id: reusableCandidateId,
      cleanId: seed.cleanId,
      name: seed.candidateName,
      slug: seed.proposedSlugCandidate,
      city: seed.municipality,
      officialUrl: seed.officialEventUrl.original!,
      needsReview: false,
      duplicateStatus: "unique_candidate",
    }),
  );
  const reusePlan = planCountyOperation({
    inventory,
    snapshot: reuseSnapshot,
    batchSize: 5,
  });
  const reused = reusePlan.records.find(
    (record) => record.sourceRecordId === seed.cleanId,
  );
  assert.equal(
    reused?.status,
    "evidence_or_current_edition_verification_required",
  );
  assert.equal(reused?.candidateId, reusableCandidateId);
  const reusedManifestEvent = reusePlan.batches
    .flatMap((batch) => batch.manifest.events)
    .find((event) => event.sourceRecordId === seed.cleanId);
  assert.equal(reusedManifestEvent?.references.candidateId, reusableCandidateId);
  assert.equal(reusedManifestEvent?.countySeed, undefined);

  const privatePlan = planCountyOperation({
    inventory,
    snapshot,
    authorizePrivateWrites: true,
    batchSize: 5,
  });
  const guarded = privatePlan.batches
    .flatMap((batch) => batch.manifest.events)
    .find((event) => Boolean(event.countySeed));
  assert(guarded?.countySeed);
  const guardedCandidate = guarded.countySeed.candidate as {
    county_seed?: {
      resolved_decision?: Record<string, unknown>;
    };
  };
  assert.equal(
    guardedCandidate.county_seed?.resolved_decision
      ?.phase_c1_disposition,
    "reviewed_county_completion_manifest",
  );
  assert.equal(
    guardedCandidate.county_seed?.resolved_decision?.execution_approval,
    "private_writes_explicitly_authorized",
  );

  const ambiguousSnapshot = structuredClone(snapshot);
  ambiguousSnapshot.preflight.candidates.push(
    candidate({
      id: "00000000-0000-4000-8000-000000000304",
      cleanId: seed.cleanId,
      name: seed.candidateName,
      slug: seed.proposedSlugCandidate,
      city: seed.municipality,
      officialUrl: seed.officialEventUrl.original!,
      needsReview: true,
      duplicateStatus: "possible_duplicate",
    }),
  );
  const ambiguousPlan = planCountyOperation({
    inventory,
    snapshot: ambiguousSnapshot,
  });
  assert.equal(
    ambiguousPlan.records.find(
      (record) => record.sourceRecordId === seed.cleanId,
    )?.status,
    "disputed_or_ambiguous_identity",
  );
  assert.equal(
    ambiguousPlan.batches
      .flatMap((batch) => batch.sourceRecordIds)
      .includes(seed.cleanId),
    false,
  );

  return { inventory, snapshot, plan, artRun };
}

function validateIdentityClearance() {
  assert.deepEqual(
    evaluateDeterministicIdentityClearance({
      needsReview: true,
      duplicateStatus: "unchecked",
      countyDisposition: "reviewed_county_completion_manifest",
      executionApproval: "private_writes_explicitly_authorized",
      reviewedInventoryHash: "a".repeat(64),
      exactCollisionIds: [],
      fuzzyReviewSignals: [],
    }),
    {
      disposition: "clear_distinct_private_candidate",
      reasonCode: "deterministic_clean_no_collision",
    },
  );
  assert.equal(
    evaluateDeterministicIdentityClearance({
      needsReview: true,
      duplicateStatus: "unchecked",
      countyDisposition: "reviewed_county_completion_manifest",
      executionApproval: "private_writes_explicitly_authorized",
      reviewedInventoryHash: "a".repeat(64),
      exactCollisionIds: [],
      fuzzyReviewSignals: ["similar name"],
    }).disposition,
    "human_review",
  );
  assert.equal(
    evaluateDeterministicIdentityClearance({
      needsReview: true,
      duplicateStatus: "unchecked",
      countyDisposition: "reviewed_county_completion_manifest",
      executionApproval: "private_writes_explicitly_authorized",
      reviewedInventoryHash: "a".repeat(64),
      exactCollisionIds: ["canonical-id"],
      fuzzyReviewSignals: [],
    }).disposition,
    "human_review",
  );
}

async function validateSourceAndVerificationComposition() {
  const calls: string[] = [];
  const sourceServices: SourceCompositionServices = {
    async createBundle() {
      calls.push("create");
      return { bundle_id: "bundle-1" };
    },
    async attachCandidate() {
      calls.push("attach");
      return {};
    },
    async captureSource(args) {
      calls.push(`capture:${args.sourceKind}:${args.sourceUrl}`);
      if (args.sourceUrl.includes("broken")) {
        throw new Error("Unsupported supporting source.");
      }
      return {
        result: { created: true },
        inspection: {
          requestedUrl: args.sourceUrl,
          finalUrl: args.sourceUrl,
          canonicalUrl: args.sourceUrl,
          usefulLinks: [],
        },
      };
    },
    async collectRelated(args) {
      calls.push(`related:${args.maxRelatedSources}`);
      return {
        attempted: 1,
        added: 1,
        reused: 0,
        failures: [],
      };
    },
    async transitionReady() {
      calls.push("ready");
      return {};
    },
  };
  const source = await composeRetainedSourceBundle({
    services: sourceServices,
    eventName: "Fixture Festival",
    eventKey: "fixture-festival",
    candidateId: "candidate-1",
    officialSourceUrl: "https://official.example/",
    supportingSourceUrls: [
      "https://supporting.example/",
      "https://broken.example/",
    ],
    actorIdentity: "validator",
    maxAdditionalSources: 5,
  });
  assert.equal(source.bundleId, "bundle-1");
  assert.equal(source.supportingSourcesAttempted, 2);
  assert.equal(source.supportingSourcesAdded, 1);
  assert.equal(source.failures.length, 1);
  assert.equal(calls.at(-1), "ready");
  assert.equal(calls.includes("related:3"), true);

  const verificationCalls: string[] = [];
  const verificationServices: VerificationCompositionServices = {
    async createCase() {
      verificationCalls.push("create");
      return { verification_case_id: "case-1", status: "collecting" };
    },
    async addEvidence(args) {
      verificationCalls.push(`evidence:${args.proofKind}`);
      return { created: true };
    },
    async submitCase() {
      verificationCalls.push("submit");
      return { status: "needs_review" };
    },
  };
  const verification = await composeVerificationCase({
    services: verificationServices,
    candidateId: "candidate-1",
    targetYear: 2026,
    actorIdentity: "validator",
    snapshots: [
      {
        id: "official",
        sourceKind: "official_home",
        canonicalUrl: "https://official.example/",
        pageTitle: "Fixture Festival",
        contentHash: "b".repeat(64),
      },
    ],
    claims: [
      {
        id: "name",
        sourceSnapshotId: "official",
        fieldPath: "identity.name",
        value: "Fixture Festival",
        normalizedText: "fixture festival",
        confidence: "high",
        confidenceScore: 0.9,
        reviewStatus: "unreviewed",
      },
      {
        id: "date",
        sourceSnapshotId: "official",
        fieldPath: "timing.startDate",
        value: "2026-08-01",
        normalizedText: "2026-08-01",
        confidence: "high",
        confidenceScore: 0.9,
        reviewStatus: "unreviewed",
      },
      {
        id: "location",
        sourceSnapshotId: "official",
        fieldPath: "location.display",
        value: "Fixture Park",
        normalizedText: "fixture park",
        confidence: "high",
        confidenceScore: 0.9,
        reviewStatus: "unreviewed",
      },
    ],
  });
  assert.equal(verification.status, "needs_review");
  assert.equal(verification.submittedForHumanReview, true);
  assert.equal(verification.automaticallyVerified, false);
  assert.equal(verificationCalls.includes("submit"), true);
  assert.equal(
    verificationCalls.some((call) => call === "verify"),
    false,
  );
}

async function validateResumeReplayContinuation(args: Awaited<ReturnType<typeof validateInventoryAndPlanning>>) {
  const { inventory, snapshot, plan, artRun } = args;
  const resolvedRun = structuredClone(artRun);
  resolvedRun.exceptions[0].status = "resolved";
  resolvedRun.exceptions[0].resolvedAt = FIXED_TIME;
  const resumablePlan = planCountyOperation({
    inventory,
    snapshot: {
      ...snapshot,
      completionRuns: [resolvedRun],
    },
  });
  assert.deepEqual(resumablePlan.resumeRunIds, [ART_RUN_ID]);
  let resumed = 0;
  const resumeOnlyPlan = {
    ...resumablePlan,
    batches: [],
  };
  await executeCountyOperation({
    plan: resumeOnlyPlan,
    async startBatch() {
      throw new Error("No new batch should start in the resume-only fixture.");
    },
    async resumeRun() {
      resumed += 1;
      return {
        runId: ART_RUN_ID,
        exitCode: 2,
        snapshot: resolvedRun,
        report: buildCompletionRunReport(resolvedRun, FIXED_TIME),
      };
    },
    generatedAt: FIXED_TIME,
  });
  assert.equal(resumed, 1);

  let started = 0;
  const operation = await executeCountyOperation({
    plan,
    async startBatch(batch) {
      started += 1;
      return batchRunResult(batch, started);
    },
    async resumeRun() {
      throw new Error("The open-exception Art run must not be blindly resumed.");
    },
    generatedAt: FIXED_TIME,
  });
  assert.equal(started, plan.batches.length);
  assert.equal(operation.report.records.length, 83);
  assert.equal(operation.report.counts.runFailures, 0);
  assert.equal(operation.report.counts.modelActions, 0);
  assert.equal(operation.report.counts.modelUsageTokens, 0);
  assert.equal(operation.report.safeguards.automaticImageActions, 0);
  assert.equal(operation.report.safeguards.publicationActions, 0);
  assert.equal(operation.report.safeguards.publicationWrites, 0);
  assert.equal(
    operation.report.records.some(
      (record) => record.exceptionCode === "missing_official_source",
    ),
    true,
  );
  assert.equal(
    operation.report.records.some(
      (record) => record.activity === "completed",
    ),
    true,
  );

  const firstReport = buildCountyOperationReport({
    plan,
    generatedAt: FIXED_TIME,
  });
  const replayReport = buildCountyOperationReport({
    plan,
    generatedAt: FIXED_TIME,
  });
  assert.equal(
    firstReport.integrity.reportSha256,
    replayReport.integrity.reportSha256,
  );

  const completedArt = structuredClone(artRun);
  completedArt.run.status = "completed";
  completedArt.events[0].status = "completed";
  completedArt.exceptions = [];
  const completedPlan = planCountyOperation({
    inventory,
    snapshot: { ...snapshot, completionRuns: [completedArt] },
  });
  assert.equal(
    completedPlan.records.find(
      (record) => record.sourceRecordId === "MAC-041",
    )?.status,
    "existing_canonical_or_completed",
  );
  assert.equal(
    completedPlan.batches.some((batch) =>
      batch.sourceRecordIds.includes("MAC-041"),
    ),
    false,
  );

  const incompatibleArt = structuredClone(artRun);
  incompatibleArt.manifest!.events[0].references.candidateId =
    "10000000-0000-4000-8000-000000000099";
  const incompatiblePlan = planCountyOperation({
    inventory,
    snapshot: { ...snapshot, completionRuns: [incompatibleArt] },
  });
  const incompatibleProjection = incompatiblePlan.records.find(
    (record) => record.sourceRecordId === "MAC-041",
  );
  assert.notEqual(
    incompatibleProjection?.status,
    "active_or_resumable",
    "A run bound to a different retained candidate is not compatible.",
  );
  assert.equal(incompatibleProjection?.completionRunId, null);
}

async function validateMigrationAndPersistentBoundaries() {
  const [migration, runtime] = await Promise.all([
    readFile(
      path.join(
        ROOT,
        "supabase/migrations/026_generalize_county_completion_staging.sql",
      ),
      "utf8",
    ),
    readFile(
      path.join(ROOT, "lib/michigan-completion/runtime.ts"),
      "utf8",
    ),
  ]);
  assert.match(migration, /reviewed_county_completion_manifest/);
  assert.match(
    migration,
    /(?:^|\n)begin;\s*[\s\S]*\scommit;\s*$/i,
    "Migration 026 must apply its guard, index, RPC, and privileges atomically.",
  );
  assert.match(migration, /private_writes_explicitly_authorized/);
  assert.match(migration, /reviewed_inventory_hash/);
  assert.match(
    migration,
    /atlas_clear_county_completion_candidate_identity/,
  );
  assert.match(migration, /duplicate_status = 'unique_candidate'/);
  assert.match(migration, /needs_review = false/);
  assert.match(migration, /canonicalizationAttempted', false/);
  assert.match(migration, /fuzzy_similarity_used_as_proof', false/);
  assert.match(
    migration,
    /revoke all on function public\.atlas_clear_county_completion_candidate_identity[\s\S]*from public, anon, authenticated/,
  );
  assert.doesNotMatch(migration, /insert into public\.events/);
  assert.doesNotMatch(
    migration,
    /atlas_activate_event_factory_publication|atlas_publish_event_page_version/,
  );
  assert.match(
    runtime,
    /reviewedInventoryHash: text\(decision\.reviewed_inventory_hash\)/,
  );
  assert.match(
    runtime,
    /reviewedInventoryHash: decision\.reviewed_inventory_hash/,
  );
  assert.doesNotMatch(runtime, /seed\.reviewed_inventory_hash/);

  const [packageJsonSource, supabaseProjection] = await Promise.all([
    readFile(path.join(ROOT, "package.json"), "utf8"),
    readFile(
      path.join(
        ROOT,
        "lib/michigan-completion/countyOperatorSupabase.ts",
      ),
      "utf8",
    ),
  ]);
  const packageJson = JSON.parse(packageJsonSource) as {
    scripts?: Record<string, string>;
  };
  assert.equal(
    packageJson.scripts?.["atlas:create-county-events"],
    "node --env-file=.env.local --import ./scripts/register-server-runtime.mjs --experimental-strip-types scripts/create-county-events.ts",
  );
  assert.match(
    supabaseProjection,
    /\.select\("id,status,bundle_id,updated_at"\)/,
  );
  assert.doesNotMatch(
    supabaseProjection,
    /event_source_syntheses"\)[\s\S]{0,120}source_bundle_id/,
  );
}

async function validateMigrationExecution() {
  const migration = await readFile(
    path.join(
      ROOT,
      "supabase/migrations/026_generalize_county_completion_staging.sql",
    ),
    "utf8",
  );
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;

      create table public.events (
        id uuid primary key default gen_random_uuid(),
        name text not null,
        city text,
        official_website text,
        slug text
      );
      create table public.event_candidates (
        id uuid primary key default gen_random_uuid(),
        candidate_name text not null,
        normalized_name text,
        slug_candidate text,
        city text,
        official_website_candidate text,
        raw_payload jsonb not null default '{}'::jsonb,
        matched_event_id uuid,
        verification_status text not null default 'needs_review',
        duplicate_status text not null default 'unchecked',
        needs_review boolean not null default true,
        updated_at timestamptz not null default now()
      );
      create table public.event_candidate_sources (
        id uuid primary key default gen_random_uuid(),
        candidate_id uuid not null references public.event_candidates(id),
        source_url text not null
      );
      create table public.atlas_operation_runs (
        id uuid primary key default gen_random_uuid(),
        operation_type text not null,
        request jsonb not null default '{}'::jsonb
      );
      create table public.atlas_operation_actions (
        id uuid primary key default gen_random_uuid(),
        operation_run_id uuid not null references public.atlas_operation_runs(id),
        action_type text not null,
        target_entity_type text,
        target_entity_id text,
        lifecycle_state text not null,
        source_references jsonb not null default '[]'::jsonb,
        requested_payload jsonb not null default '{}'::jsonb,
        before_snapshot jsonb,
        applied_payload jsonb,
        after_snapshot jsonb,
        reason text,
        warnings jsonb not null default '[]'::jsonb,
        failure jsonb,
        applied_at timestamptz,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );

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

      create or replace function public.atlas_stage_county_seed_candidate(
        p_actor_identity text,
        p_discovery_idempotency_key text,
        p_discovery_query text,
        p_idempotency_key text,
        p_payload_hash text,
        p_candidate jsonb,
        p_sources jsonb
      )
      returns jsonb
      language plpgsql
      security definer
      set search_path = ''
      as $$
      begin
        if coalesce(
          p_candidate #>> '{county_seed,resolved_decision,phase_c1_disposition}',
          ''
        ) not in (
          'provisional_batch_1_manifest_only',
          'revised_three_event_pilot_manifest_only'
        ) then
          raise exception 'County staging requires an approved county-seed manifest disposition.'
            using errcode = '22023';
        end if;
        return pg_catalog.jsonb_build_object('accepted', true);
      end;
      $$;
    `.replace(/^ {6}/gm, ""));
    await database.exec(migration);

    const inventoryHash = "1".repeat(64);
    const payloadHash = "2".repeat(64);
    const identityHash = "3".repeat(64);
    const candidateId = "10000000-0000-4000-8000-000000000001";
    const runId = "10000000-0000-4000-8000-000000000002";
    const candidatePayload = {
      county_seed: {
        county_code: "macomb",
        clean_id: "MAC-003",
        payload_hash: payloadHash,
        cohort_relationships: {
          shared_official_url_clean_ids: ["MAC-003"],
        },
        resolved_decision: {
          phase_c1_disposition: "reviewed_county_completion_manifest",
          execution_approval: "private_writes_explicitly_authorized",
          reviewed_inventory_hash: inventoryHash,
        },
      },
    };
    const unauthorizedPayload = structuredClone(candidatePayload);
    unauthorizedPayload.county_seed.resolved_decision.execution_approval =
      "not_authorized";
    await assert.rejects(
      () =>
        database.query(
          `select public.atlas_stage_county_seed_candidate(
            'validator', 'discovery', 'query', 'candidate', $1, $2::jsonb, '[]'::jsonb
          )`,
          [payloadHash, JSON.stringify(unauthorizedPayload)],
        ),
      /explicit private authorization/i,
    );
    const accepted = await database.query(
      `select public.atlas_stage_county_seed_candidate(
        'validator', 'discovery', 'query', 'candidate', $1, $2::jsonb, '[]'::jsonb
      ) as result`,
      [payloadHash, JSON.stringify(candidatePayload)],
    );
    assert.equal(
      (accepted.rows[0] as { result: { accepted: boolean } }).result.accepted,
      true,
    );

    await database.query(
      `insert into public.event_candidates (
        id, candidate_name, normalized_name, slug_candidate, city,
        official_website_candidate, raw_payload
      ) values ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb)`,
      [
        candidateId,
        "Blake's Lavender Festival",
        "blakes lavender festival",
        "blakes-lavender-festival-armada-mi",
        "Armada",
        "https://example.test/lavender",
        JSON.stringify(candidatePayload),
      ],
    );
    await database.query(
      `insert into public.atlas_operation_runs (id, operation_type, request)
       values ($1::uuid, 'michigan_completion_v1', $2::jsonb)`,
      [
        runId,
        JSON.stringify({
          dryRun: false,
          deterministicOnly: true,
          events: [
            {
              countySeed: {
                candidate: candidatePayload,
              },
            },
          ],
        }),
      ],
    );
    const cleared = await database.query(
      `select public.atlas_clear_county_completion_candidate_identity(
        $1::uuid, $2::uuid, $3, 'validator', 'Exact deterministic no-collision fixture.'
      ) as result`,
      [runId, candidateId, identityHash],
    );
    assert.equal(
      (cleared.rows[0] as { result: { identity_cleared: boolean } }).result
        .identity_cleared,
      true,
    );
    const candidateState = await database.query(
      `select duplicate_status, needs_review, matched_event_id
       from public.event_candidates where id = $1::uuid`,
      [candidateId],
    );
    assert.deepEqual(candidateState.rows[0], {
      duplicate_status: "unique_candidate",
      needs_review: false,
      matched_event_id: null,
    });
    const replay = await database.query(
      `select public.atlas_clear_county_completion_candidate_identity(
        $1::uuid, $2::uuid, $3, 'validator', 'Exact deterministic no-collision fixture.'
      ) as result`,
      [runId, candidateId, identityHash],
    );
    assert.equal(
      (replay.rows[0] as { result: { exact_replay: boolean } }).result
        .exact_replay,
      true,
    );
    const actionCount = await database.query(
      `select count(*)::integer as count
       from public.atlas_operation_actions
       where action_type = 'michigan_completion_candidate_identity_cleared'`,
    );
    assert.equal((actionCount.rows[0] as { count: number }).count, 1);
    const eventCount = await database.query(
      "select count(*)::integer as count from public.events",
    );
    assert.equal((eventCount.rows[0] as { count: number }).count, 0);
  } finally {
    await database.close();
  }
}

async function main() {
  const planning = await validateInventoryAndPlanning();
  validateIdentityClearance();
  await validateSourceAndVerificationComposition();
  await validateResumeReplayContinuation(planning);
  await validateMigrationAndPersistentBoundaries();
  await validateMigrationExecution();
  console.log(
    "County completion operator validation passed: 83-record classification, stable hashes, exclusions, candidate reuse, guarded staging, deterministic identity, bounded sources, verification review, replay/resume, mixed continuation, aggregate reporting, and zero model/image/publication effects.",
  );
}

await main();
