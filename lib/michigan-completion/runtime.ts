import type { SupabaseClient } from "@supabase/supabase-js";
import { getEventPageManifest } from "../../data/eventPageManifests.ts";
import { validateEventPageContentReadiness } from "../../data/eventPageContentReadiness.ts";
import { prepareEventFactoryPackage } from "../event-factory/packages.ts";
import { synthesizeEventSourceBundle } from "../event-intake/synthesisEngine.ts";
import type {
  EventSourceSynthesisInput,
  SourceClaimConfidence,
  SourceClaimReviewStatus,
  SynthesisContentSegment,
} from "../event-intake/synthesisTypes.ts";
import { completionSha256 } from "./manifest.ts";
import { evaluateDeterministicIdentityClearance } from "./identityClearance.ts";
import {
  openBlockingCompletionExceptionsForEvent,
} from "./exceptionPolicy.ts";
import {
  composeRetainedSourceBundle,
  composeVerificationCase,
  createDefaultSourceCompositionServices,
  createDefaultVerificationCompositionServices,
  selectCompletionEvidenceClaims,
  type SourceBundleCompositionResult,
  type SourceCompositionServices,
  type VerificationClaimInput,
  type VerificationCompositionServices,
  type VerificationSnapshotInput,
} from "./privateComposition.ts";
import type {
  CompletionExceptionInput,
  CompletionStageExecutionResult,
  CompletionStageExecutor,
  CompletionStageExecutorContext,
} from "./types.ts";

type CompletionSupabaseClient = Pick<SupabaseClient, "from" | "rpc">;

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstRpcRow(value: unknown) {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isRecord(row)) throw new Error("The canonical service returned no result.");
  return row;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function metadata(context: CompletionStageExecutorContext) {
  return isRecord(context.event.metadata) ? context.event.metadata : {};
}

function candidateSeed(candidate: RecordValue) {
  const raw = isRecord(candidate.raw_payload) ? candidate.raw_payload : {};
  return isRecord(raw.county_seed) ? raw.county_seed : {};
}

function officialSourceUrl(
  context: CompletionStageExecutorContext,
  candidate?: RecordValue | null,
) {
  const retained = text(metadata(context).officialSourceUrl);
  if (retained) return retained;
  const countyCandidate = isRecord(context.event.countySeed?.candidate)
    ? context.event.countySeed?.candidate
    : {};
  return (
    text(countyCandidate.official_website_candidate) ||
    text(candidate?.official_website_candidate)
  );
}

function supportingSourceUrls(context: CompletionStageExecutorContext) {
  return stringArray(metadata(context).supportingSourceUrls)
    .filter((url) => /^https?:\/\//.test(url))
    .slice(0, 2);
}

function eventTargetYear(
  context: CompletionStageExecutorContext,
  candidate?: RecordValue | null,
) {
  const configured = Number(metadata(context).targetYear);
  if (Number.isSafeInteger(configured) && configured >= 2000 && configured <= 2100) {
    return configured;
  }
  const values = [
    text(candidate?.start_date),
    text(candidate?.end_date),
    text(
      isRecord(context.event.countySeed?.candidate)
        ? context.event.countySeed?.candidate.start_date
        : "",
    ),
  ];
  for (const value of values) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return Number(value.slice(0, 4));
  }
  return null;
}

function outputFor(
  context: CompletionStageExecutorContext,
  stageId: string,
) {
  return context.priorOutputs.get(stageId) ?? {};
}

function references(context: CompletionStageExecutorContext) {
  return {
    ...context.event.references,
    ...context.runEvent.references,
  };
}

function exception(
  code: CompletionExceptionInput["code"],
  classification: CompletionExceptionInput["classification"],
  message: string,
  details: RecordValue = {},
): CompletionExceptionInput {
  return {
    code,
    classification,
    message,
    details,
    retryable: classification === "retryable",
    modelReviewEligible: classification === "model_review_eligible",
    humanReviewRequired: classification === "human_review_required",
    publicationBlocking:
      classification === "publication_blocking" ||
      classification === "fatal" ||
      classification === "human_review_required",
    fatal: classification === "fatal",
  };
}

function inspectionContentSegments(value: unknown): SynthesisContentSegment[] {
  if (!isRecord(value) || !Array.isArray(value.contentSegments)) return [];
  return value.contentSegments.slice(0, 240).flatMap((segment) => {
    if (!isRecord(segment)) return [];
    if (
      !["heading", "paragraph", "listItem", "detail", "time"].includes(
        String(segment.kind),
      )
    ) {
      return [];
    }
    const segmentText = text(segment.text);
    if (!segmentText) return [];
    return [
      {
        kind: segment.kind as SynthesisContentSegment["kind"],
        text: segmentText.slice(0, 1_000),
      },
    ];
  });
}

async function resolveBundle(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
) {
  const retained = references(context).sourceBundleId;
  let query = client
    .from("event_source_bundles")
    .select(
      "id,name,status,event_key,canonical_event_id,candidate_id,ready_at,updated_at",
    );
  if (retained) {
    query = query.eq("id", retained);
  } else {
    const candidateId = references(context).candidateId;
    query = candidateId
      ? query.or(
          `candidate_id.eq.${candidateId},event_key.eq.${context.event.eventKey}`,
        )
      : query.eq("event_key", context.event.eventKey);
  }
  const result = await query
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data as RecordValue | null;
}

async function loadSynthesisInput(
  client: CompletionSupabaseClient,
  bundle: RecordValue,
): Promise<EventSourceSynthesisInput> {
  const bundleId = text(bundle.id);
  const [snapshotResult, claimResult, scheduleResult, visualResult] =
    await Promise.all([
      client
        .from("event_source_snapshots")
        .select(
          "id,sequence_number,source_kind,canonical_url,page_title,content_hash,fetched_at,inspection",
        )
        .eq("bundle_id", bundleId)
        .order("sequence_number", { ascending: true }),
      client
        .from("event_source_claims")
        .select(
          "id,source_snapshot_id,field_path,value,normalized_text,confidence,confidence_score,extraction_method,review_status,created_at",
        )
        .eq("bundle_id", bundleId)
        .order("field_path", { ascending: true })
        .order("id", { ascending: true }),
      client
        .from("event_schedule_candidates")
        .select(
          "id,source_snapshot_id,dedupe_key,title,starts_at,ends_at,date_text,timezone,venue,category,tags,details,confidence,confidence_score,review_status",
        )
        .eq("bundle_id", bundleId)
        .order("starts_at", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true }),
      client
        .from("event_visual_workflows")
        .select("id,status,asset,content_hash")
        .or(
          [
            text(bundle.candidate_id)
              ? `candidate_id.eq.${text(bundle.candidate_id)}`
              : "",
            text(bundle.event_key)
              ? `event_key.eq.${text(bundle.event_key)}`
              : "",
          ]
            .filter(Boolean)
            .join(","),
        )
        .eq("status", "approved")
        .order("revision_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (snapshotResult.error || claimResult.error || scheduleResult.error) {
    throw new Error("The retained source evidence could not be loaded.");
  }
  const snapshots = (snapshotResult.data ?? []) as RecordValue[];
  if (!snapshots.length) {
    throw new Error("The retained source bundle contains no snapshots.");
  }
  const visual = visualResult.error ? null : (visualResult.data as RecordValue | null);
  const asset = isRecord(visual?.asset) ? visual.asset : null;
  const publicUrl = text(asset?.publicUrl);
  const altText = text(asset?.altText);
  return {
    bundle: {
      id: bundleId,
      name: text(bundle.name),
      status: text(bundle.status),
      eventKey: text(bundle.event_key) || null,
      canonicalEventId: text(bundle.canonical_event_id) || null,
      candidateId: text(bundle.candidate_id) || null,
      readyAt: text(bundle.ready_at) || null,
    },
    snapshots: snapshots.map((row) => ({
      id: text(row.id),
      sequenceNumber: numberValue(row.sequence_number),
      sourceKind: text(row.source_kind),
      canonicalUrl: text(row.canonical_url),
      pageTitle: text(row.page_title) || null,
      contentHash: text(row.content_hash),
      fetchedAt: text(row.fetched_at),
      contentSegments: inspectionContentSegments(row.inspection),
    })),
    claims: ((claimResult.data ?? []) as RecordValue[]).map((row) => ({
      id: text(row.id),
      sourceSnapshotId: text(row.source_snapshot_id),
      fieldPath: text(row.field_path),
      value: row.value,
      normalizedText: text(row.normalized_text),
      confidence: text(row.confidence) as SourceClaimConfidence,
      confidenceScore:
        row.confidence_score === null
          ? null
          : numberValue(row.confidence_score),
      extractionMethod: text(row.extraction_method),
      reviewStatus: text(row.review_status) as SourceClaimReviewStatus,
      createdAt: text(row.created_at),
    })),
    scheduleCandidates: ((scheduleResult.data ?? []) as RecordValue[]).map(
      (row) => ({
        id: text(row.id),
        sourceSnapshotId: text(row.source_snapshot_id),
        dedupeKey: text(row.dedupe_key),
        title: text(row.title),
        startsAt: text(row.starts_at) || null,
        endsAt: text(row.ends_at) || null,
        dateText: text(row.date_text) || null,
        timezone: text(row.timezone) || null,
        venue: text(row.venue) || null,
        category: text(row.category) || null,
        tags: stringArray(row.tags),
        details: text(row.details) || null,
        confidence: text(row.confidence) as SourceClaimConfidence,
        confidenceScore:
          row.confidence_score === null
            ? null
            : numberValue(row.confidence_score),
        reviewStatus: text(row.review_status) as SourceClaimReviewStatus,
      }),
    ),
    ...(visual && asset && publicUrl && altText
      ? {
          approvedVisual: {
            workflowId: text(visual.id),
            imageSrc: publicUrl,
            imageAlt: altText,
            credit: text(asset.credit) || undefined,
            contentHash: text(visual.content_hash),
          },
        }
      : {}),
  };
}

async function stageCandidate(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
): Promise<CompletionStageExecutionResult> {
  const retained = references(context);
  if (retained.candidateId) {
    const result = await client
      .from("event_candidates")
      .select("id,matched_event_id")
      .eq("id", retained.candidateId)
      .maybeSingle();
    if (result.error || !result.data) {
      return {
        outcome: "blocked",
        exceptions: [
          exception(
            "identity_security_mismatch",
            "publication_blocking",
            "The referenced event candidate is unavailable.",
            { candidateId: retained.candidateId },
          ),
        ],
      };
    }
    return {
      outcome: "succeeded",
      output: { candidateStaged: false, existingCandidate: true },
      links: {
        candidateId: retained.candidateId,
        canonicalEventId: result.data.matched_event_id,
      },
    };
  }
  if (retained.canonicalEventId) {
    const result = await client
      .from("events")
      .select("id")
      .eq("id", retained.canonicalEventId)
      .maybeSingle();
    if (result.error || !result.data) {
      return {
        outcome: "blocked",
        exceptions: [
          exception(
            "identity_security_mismatch",
            "publication_blocking",
            "The referenced canonical event is unavailable.",
          ),
        ],
      };
    }
    return {
      outcome: "succeeded",
      output: { candidateStaged: false, canonicalReference: true },
      links: { canonicalEventId: retained.canonicalEventId },
    };
  }
  if (!context.event.countySeed) {
    return {
      outcome: "blocked",
      exceptions: [
        exception(
          "invalid_manifest_record",
          "publication_blocking",
          "No guarded county-seed input or retained identity was supplied.",
        ),
      ],
    };
  }
  if (context.dryRun) {
    return {
      outcome: "succeeded",
      output: {
        candidateStaged: false,
        dryRun: true,
        guardedRpc: "atlas_stage_county_seed_candidate",
      },
    };
  }
  const seed = context.event.countySeed;
  const result = await client.rpc("atlas_stage_county_seed_candidate", {
    p_actor_identity: context.actorIdentity,
    p_batch_id: seed.batchId,
    p_manifest_hash: seed.manifestHash,
    p_payload_hash: seed.payloadHash,
    p_idempotency_key: seed.idempotencyKey,
    p_candidate: seed.candidate,
    p_sources: seed.sources,
  });
  if (result.error) throw new Error(result.error.message);
  const row = firstRpcRow(result.data);
  return {
    outcome: "succeeded",
    output: {
      candidateStaged: true,
      idempotentReplay: row.idempotent_replay === true,
      operationRunId: row.operation_run_id ?? null,
    },
    links: { candidateId: text(row.candidate_id) },
  };
}

async function stageIdentity(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
): Promise<CompletionStageExecutionResult> {
  const retained = references(context);
  if (retained.canonicalEventId) {
    return {
      outcome: "succeeded",
      output: { disposition: "matched_existing" },
      links: { canonicalEventId: retained.canonicalEventId },
    };
  }
  const candidateId = retained.candidateId;
  if (!candidateId) {
    return context.dryRun
      ? {
          outcome: "succeeded",
          output: { disposition: "dry_run_new_candidate" },
        }
      : {
          outcome: "blocked",
          exceptions: [
            exception(
              "uncertain_identity_match",
              "human_review_required",
              "Candidate identity is unavailable after staging.",
            ),
          ],
        };
  }
  const candidateResult = await client
    .from("event_candidates")
    .select(
      "id,candidate_name,normalized_name,slug_candidate,city,official_website_candidate,start_date,end_date,matched_event_id,verification_status,duplicate_status,needs_review,raw_payload",
    )
    .eq("id", candidateId)
    .maybeSingle();
  if (candidateResult.error || !candidateResult.data) {
    throw new Error(candidateResult.error?.message ?? "Candidate was not found.");
  }
  const candidate = candidateResult.data;
  if (candidate.matched_event_id) {
    return {
      outcome: "succeeded",
      output: { disposition: "matched_existing" },
      links: {
        candidateId,
        canonicalEventId: candidate.matched_event_id,
      },
    };
  }
  if (
    ["possible_duplicate", "duplicate", "merged"].includes(
      text(candidate.duplicate_status),
    )
  ) {
    return {
      outcome: "blocked",
      exceptions: [
        exception(
          "uncertain_identity_match",
          "human_review_required",
          "The retained candidate has a disputed duplicate disposition; no merge was attempted.",
          { candidateId, duplicateStatus: candidate.duplicate_status },
        ),
      ],
    };
  }

  const normalizedName =
    text(candidate.normalized_name) || text(candidate.candidate_name).toLowerCase();
  const city = text(candidate.city).toLowerCase();
  const website = text(candidate.official_website_candidate);
  const collisionResults = await Promise.all([
    website
      ? client
          .from("event_candidates")
          .select("id,candidate_name,matched_event_id")
          .neq("id", candidateId)
          .eq("official_website_candidate", website)
          .limit(2)
      : Promise.resolve({ data: [], error: null }),
    normalizedName && city
      ? client
          .from("event_candidates")
          .select("id,candidate_name,matched_event_id")
          .neq("id", candidateId)
          .eq("normalized_name", normalizedName)
          .ilike("city", city)
          .limit(2)
      : Promise.resolve({ data: [], error: null }),
    website
      ? client
          .from("events")
          .select("id,name")
          .eq("official_website", website)
          .limit(2)
      : Promise.resolve({ data: [], error: null }),
    normalizedName && city
      ? client
          .from("events")
          .select("id,name")
          .ilike("name", text(candidate.candidate_name))
          .ilike("city", city)
          .limit(2)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const collisionError = collisionResults.find((result) => result.error)?.error;
  if (collisionError) throw new Error(collisionError.message);
  const collisionRows: Array<{ id: string }> = collisionResults.flatMap(
    (result) => (result.data ?? []) as Array<{ id: string }>,
  );
  const collisions = [
    ...new Map(
      collisionRows.map((row) => [row.id, row]),
    ).values(),
  ];
  if (collisions.length) {
    return {
      outcome: "blocked",
      exceptions: [
        exception(
          "duplicate_candidate",
          "human_review_required",
          "A deterministic candidate collision was retained for human review.",
          {
            candidateId,
            collisionIds: collisions.map((row) => row.id),
          },
        ),
      ],
    };
  }
  if (candidate.needs_review) {
    const seed = candidateSeed(candidate);
    const decision = isRecord(seed.resolved_decision)
      ? seed.resolved_decision
      : {};
    const clearanceDecision = evaluateDeterministicIdentityClearance({
      needsReview: candidate.needs_review === true,
      duplicateStatus: text(candidate.duplicate_status),
      countyDisposition: text(decision.phase_c1_disposition),
      executionApproval: text(decision.execution_approval),
      reviewedInventoryHash: text(decision.reviewed_inventory_hash),
      exactCollisionIds: [],
      fuzzyReviewSignals: stringArray(
        metadata(context).identityPreflightWarnings,
      ),
    });
    if (
      clearanceDecision.disposition !==
        "clear_distinct_private_candidate" ||
      context.dryRun
    ) {
      return {
        outcome: "blocked",
        exceptions: [
          exception(
            "uncertain_identity_match",
            "human_review_required",
            "The retained candidate requires identity review and is not eligible for the narrow reviewed county-completion clearance.",
            {
              candidateId,
              duplicateStatus: candidate.duplicate_status,
              countyDisposition:
                text(decision.phase_c1_disposition) || null,
              reasonCode: clearanceDecision.reasonCode,
              mergeAttempted: false,
            },
          ),
        ],
      };
    }
    const reason = [
      "Deterministic county-completion identity clearance.",
      "No canonical URL, slug, normalized-name/municipality, alias/location, candidate-source ownership, or exact candidate collision was found.",
      "Fuzzy similarity was not used as identity proof.",
      "The candidate remains private and unmatched.",
    ].join(" ");
    const identityInputHash = completionSha256({
      runId: context.run.id,
      candidateId,
      eventInputHash: context.event.inputHash,
      candidateName: candidate.candidate_name,
      normalizedName,
      slug: candidate.slug_candidate,
      city,
      officialSourceUrl: website,
      countyCleanId: seed.clean_id,
      payloadHash: seed.payload_hash,
      reviewedInventoryHash: decision.reviewed_inventory_hash,
      collisionIds: [],
      identityRuleVersion: "county-completion-clean-identity/1",
    });
    const cleared = await client.rpc(
      "atlas_clear_county_completion_candidate_identity",
      {
        p_run_id: context.run.id,
        p_candidate_id: candidateId,
        p_identity_input_hash: identityInputHash,
        p_actor_identity: context.actorIdentity,
        p_reason: reason,
      },
    );
    if (cleared.error) {
      return {
        outcome: "blocked",
        error: { message: cleared.error.message },
        exceptions: [
          exception(
            /collision|identity|source/i.test(cleared.error.message)
              ? "duplicate_candidate"
              : "identity_security_mismatch",
            "human_review_required",
            cleared.error.message,
            {
              candidateId,
              identityInputHash,
              mergeAttempted: false,
            },
          ),
        ],
      };
    }
    const clearance = firstRpcRow(cleared.data);
    return {
      outcome: "succeeded",
      output: {
        disposition: "unique_private_candidate",
        identityAutomaticallyCleared: true,
        identityInputHash,
        identityAuditActionId: clearance.action_id ?? null,
        identityRuleVersion: "county-completion-clean-identity/1",
        reason,
        mergeAttempted: false,
        canonicalizationAttempted: false,
      },
      links: { candidateId },
    };
  }
  return {
    outcome: "succeeded",
    output: {
      disposition: "unique_candidate",
      identityAutomaticallyCleared: false,
      mergeAttempted: false,
      canonicalizationAttempted: false,
    },
    links: { candidateId },
  };
}

async function stageEvidence(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
  sourceServices: SourceCompositionServices,
  verificationServices: VerificationCompositionServices,
): Promise<CompletionStageExecutionResult> {
  const retained = references(context);
  const candidateId = retained.candidateId;
  let candidate: RecordValue | null = null;
  if (candidateId) {
    const candidateResult = await client
      .from("event_candidates")
      .select(
        "id,candidate_name,official_website_candidate,start_date,end_date,raw_payload",
      )
      .eq("id", candidateId)
      .maybeSingle();
    if (candidateResult.error) throw new Error(candidateResult.error.message);
    candidate = candidateResult.data as RecordValue | null;
  }
  let sourceComposition: SourceBundleCompositionResult | null = null;
  let bundle = await resolveBundle(client, context);
  if (!bundle) {
    const sourceUrl = officialSourceUrl(context, candidate);
    const plannedComposition = {
      authorized: !context.dryRun,
      officialSourceUrl: sourceUrl || null,
      supportingSourceUrls: supportingSourceUrls(context),
      maxAdditionalSources: 5,
      imageActionInvoked: false,
      publicationInvoked: false,
    };
    if (context.dryRun || !candidateId || !sourceUrl) {
      return {
        outcome: "blocked",
        output: {
          sourceBundleComposition: plannedComposition,
          sourceBundleCreated: false,
          dryRun: context.dryRun,
        },
        exceptions: [
          exception(
            "missing_official_source",
            "publication_blocking",
            sourceUrl
              ? "No retained source bundle is attached; the bounded official-source composition is only predicted in this dry run."
              : "No retained official source is available for bounded source-bundle composition.",
            { candidateId, sourceUrl: sourceUrl || null },
          ),
        ],
      };
    }
    try {
      const composed = await composeRetainedSourceBundle({
        services: sourceServices,
        eventName:
          context.event.displayName ||
          text(candidate?.candidate_name) ||
          context.event.eventKey,
        eventKey: context.event.eventKey,
        candidateId,
        officialSourceUrl: sourceUrl,
        supportingSourceUrls: supportingSourceUrls(context),
        actorIdentity: context.actorIdentity,
        maxAdditionalSources: 5,
      });
      sourceComposition = composed;
      bundle = await resolveBundle(client, context);
      if (!bundle || text(bundle.id) !== composed.bundleId) {
        throw new Error(
          "The retained source bundle could not be resolved after composition.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bounded official-source composition failed.";
      return {
        outcome: "blocked",
        output: {
          sourceBundleComposition: plannedComposition,
          sourceBundleCreated: false,
        },
        error: { message },
        exceptions: [
          exception(
            /unsupported|content[- ]type|archive|compressed/i.test(message)
              ? "unsupported_source_format"
              : "weak_source_evidence",
            /timeout|temporar|network/i.test(message)
              ? "retryable"
              : "human_review_required",
            message,
            {
              candidateId,
              officialSourceUrl: sourceUrl,
              automaticRetryAttempted: false,
            },
          ),
        ],
      };
    }
  }
  const bundleId = text(bundle.id);
  const [snapshotResult, claimResult, scheduleResult] = await Promise.all([
    client
      .from("event_source_snapshots")
      .select(
        "id,source_kind,canonical_url,page_title,content_hash,inspection",
      )
      .eq("bundle_id", bundleId),
    client
      .from("event_source_claims")
      .select(
        "id,source_snapshot_id,field_path,value,normalized_text,review_status,confidence,confidence_score",
      )
      .eq("bundle_id", bundleId),
    client
      .from("event_schedule_candidates")
      .select("id,source_snapshot_id,starts_at,date_text,review_status")
      .eq("bundle_id", bundleId),
  ]);
  if (snapshotResult.error || claimResult.error || scheduleResult.error) {
    throw new Error("Retained source evidence could not be inspected.");
  }
  const snapshots = (snapshotResult.data ?? []) as RecordValue[];
  const rawClaims = (claimResult.data ?? []) as RecordValue[];
  const official = snapshots.filter(
    (snapshot) => text(snapshot.source_kind) === "official_home",
  );
  const year = eventTargetYear(context, candidate);
  const eventName =
    context.event.displayName ||
    text(candidate?.candidate_name) ||
    context.event.eventKey;
  const verificationSnapshots = snapshots.map(
    (row): VerificationSnapshotInput => ({
      id: text(row.id),
      sourceKind: text(row.source_kind),
      canonicalUrl: text(row.canonical_url),
      pageTitle: text(row.page_title) || null,
      contentHash: text(row.content_hash),
      contentSegments: inspectionContentSegments(row.inspection),
    }),
  );
  const verificationClaims = rawClaims.map(
    (row): VerificationClaimInput => ({
      id: text(row.id),
      sourceSnapshotId: text(row.source_snapshot_id),
      fieldPath: text(row.field_path),
      value: row.value,
      normalizedText: text(row.normalized_text),
      confidence: text(row.confidence),
      confidenceScore:
        row.confidence_score === null
          ? null
          : numberValue(row.confidence_score),
      reviewStatus: text(row.review_status),
    }),
  );
  const evidenceSelection = selectCompletionEvidenceClaims({
    eventName,
    targetYear: year,
    snapshots: verificationSnapshots,
    claims: verificationClaims,
  });
  const claims = evidenceSelection.claims;
  const compatibleSnapshotIds = new Set(
    evidenceSelection.compatibleSnapshotIds,
  );
  const verificationEvidenceClaims = [
    ...new Map(
      [
        ...claims,
        ...verificationClaims.filter(
          (claim) =>
            compatibleSnapshotIds.has(claim.sourceSnapshotId) &&
            ["identity.description", "recurrence.annual"].includes(
              claim.fieldPath,
            ),
        ),
      ].map((claim) => [claim.id, claim]),
    ).values(),
  ];
  const conflicts = evidenceSelection.dateConflicts;
  if (!official.length) {
    return {
      outcome: "blocked",
      links: { sourceBundleId: bundleId },
      exceptions: [
        exception(
          "missing_official_source",
          "publication_blocking",
          "The retained bundle has no official-home snapshot.",
          { bundleId, snapshotIds: snapshots.map((row) => row.id) },
        ),
      ],
    };
  }
  if (conflicts.length) {
    return {
      outcome: "blocked",
      output: {
        conflicts,
        retainedClaimCount: rawClaims.length,
        selectedClaimCount: claims.length,
        evidencePolicyVersion: evidenceSelection.policyVersion,
        targetYear: year,
        ignoredClaimCount: evidenceSelection.ignoredClaims.length,
        ignoredClaims: evidenceSelection.ignoredClaims,
        relevantSnapshotIds: evidenceSelection.relevantSnapshotIds,
      },
      links: { sourceBundleId: bundleId },
      exceptions: [
        exception(
          "conflicting_event_dates",
          "human_review_required",
          "Distinct active date claims remain in retained evidence.",
          { bundleId, conflicts },
        ),
      ],
    };
  }
  if (
    !["ready_for_synthesis", "draft_ready"].includes(text(bundle.status)) ||
    claims.length < 2
  ) {
    return {
      outcome: "blocked",
      links: { sourceBundleId: bundleId },
      exceptions: [
        exception(
          "weak_source_evidence",
          "publication_blocking",
          "The retained bundle is not ready for deterministic synthesis.",
          {
            bundleId,
            status: bundle.status,
            snapshotCount: snapshots.length,
            retainedClaimCount: rawClaims.length,
            selectedClaimCount: claims.length,
            evidencePolicyVersion: evidenceSelection.policyVersion,
            targetYear: year,
          },
        ),
      ],
    };
  }
  const verificationExceptions: CompletionExceptionInput[] = [];
  let verificationCaseId = retained.verificationCaseId ?? null;
  let verificationCaseStatus: string | null = null;
  let verificationAutomaticallyCompleted = false;
  let verificationMissingFacts: string[] = [];
  if (candidateId && year) {
    let existingCase: { id: string; status: string } | null = null;
    if (verificationCaseId) {
      const result = await client
        .from("event_verification_cases")
        .select("id,status")
        .eq("id", verificationCaseId)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      existingCase = result.data as { id: string; status: string } | null;
    } else {
      const result = await client
        .from("event_verification_cases")
        .select("id,status")
        .eq("candidate_id", candidateId)
        .eq("target_year", year)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      existingCase = result.data as { id: string; status: string } | null;
    }
    if (context.dryRun) {
      verificationCaseId = existingCase?.id ?? null;
      verificationCaseStatus = existingCase?.status ?? "planned";
    } else {
      const verification = await composeVerificationCase({
        services: verificationServices,
        candidateId,
        targetYear: year,
        actorIdentity: context.actorIdentity,
        existingCase,
        snapshots: verificationSnapshots,
        claims: verificationEvidenceClaims,
      });
      verificationCaseId = verification.verificationCaseId;
      verificationCaseStatus = verification.status;
      verificationAutomaticallyCompleted = verification.automaticallyVerified;
      verificationMissingFacts = verification.missingFacts;
    }
    if (verificationCaseStatus !== "verified") {
      verificationExceptions.push(
        exception(
          "verification_review_required",
          "human_review_required",
          verificationCaseStatus === "needs_review"
            ? verificationMissingFacts.length
              ? `Please verify: ${verificationMissingFacts.join(", ")}.`
              : "The retained facts require human verification."
            : "The Event Factory diligence case is not yet verified.",
          {
            verificationCaseId,
            status: verificationCaseStatus,
            targetYear: year,
            automaticallyVerified: verificationAutomaticallyCompleted,
            missingFacts: verificationMissingFacts,
          },
        ),
      );
    }
  } else {
    verificationExceptions.push(
      exception(
        "verification_review_required",
        "human_review_required",
        "A retained candidate and unambiguous target year are required to prepare the Event Factory diligence case.",
        { candidateId, targetYear: year },
      ),
    );
  }
  return {
    outcome: "succeeded",
    output: {
      bundleId,
      bundleStatus: bundle.status,
      snapshotCount: snapshots.length,
      retainedClaimCount: rawClaims.length,
      selectedClaimCount: claims.length,
      evidencePolicyVersion: evidenceSelection.policyVersion,
      targetYear: year,
      ignoredClaimCount: evidenceSelection.ignoredClaims.length,
      ignoredClaims: evidenceSelection.ignoredClaims,
      relevantSnapshotIds: evidenceSelection.relevantSnapshotIds,
      scheduleCandidateCount: (scheduleResult.data ?? []).length,
      officialSnapshotIds: official.map((row) => row.id),
      dateConflicts: [],
      verificationCaseId,
      verificationCaseStatus,
      verificationAutomaticallyCompleted,
      verificationMissingFacts,
      sourceBundleComposition: sourceComposition,
    },
    links: { sourceBundleId: bundleId, verificationCaseId },
    exceptions: verificationExceptions,
  };
}

async function stageSynthesis(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
): Promise<CompletionStageExecutionResult> {
  const bundle = await resolveBundle(client, context);
  if (!bundle) {
    return {
      outcome: "blocked",
      exceptions: [
        exception(
          "deterministic_synthesis_failure",
          "publication_blocking",
          "The source bundle is unavailable.",
        ),
      ],
    };
  }
  const bundleId = text(bundle.id);
  const retainedInput = await loadSynthesisInput(client, bundle);
  const evidenceTargetYear = Number(
    outputFor(context, "evidence_readiness").targetYear,
  );
  const targetYear =
    Number.isSafeInteger(evidenceTargetYear) &&
    evidenceTargetYear >= 2000 &&
    evidenceTargetYear <= 2100
      ? evidenceTargetYear
      : eventTargetYear(context);
  const evidenceSelection = selectCompletionEvidenceClaims({
    eventName:
      context.event.displayName ||
      retainedInput.bundle.name.replace(
        /\s+retained official-source bundle$/i,
        "",
      ),
    targetYear,
    snapshots: retainedInput.snapshots.map(
      (snapshot): VerificationSnapshotInput => ({
        id: snapshot.id,
        sourceKind: snapshot.sourceKind,
        canonicalUrl: snapshot.canonicalUrl,
        pageTitle: snapshot.pageTitle,
        contentHash: snapshot.contentHash,
      }),
    ),
    claims: retainedInput.claims.map(
      (claim): VerificationClaimInput => ({
        id: claim.id,
        sourceSnapshotId: claim.sourceSnapshotId,
        fieldPath: claim.fieldPath,
        value: claim.value,
        normalizedText: claim.normalizedText,
        confidence: claim.confidence,
        confidenceScore: claim.confidenceScore,
        reviewStatus: claim.reviewStatus,
      }),
    ),
  });
  const selectedClaimIds = new Set(
    evidenceSelection.claims.map((claim) => claim.id),
  );
  const relevantSnapshotIds = new Set(
    evidenceSelection.relevantSnapshotIds,
  );
  const scheduleMatchesTargetYear = (value: string | null) => {
    if (!value || targetYear === null) return true;
    const year = Number(value.match(/^(\d{4})-\d{2}-\d{2}/)?.[1]);
    return !year || year === targetYear;
  };
  const input: EventSourceSynthesisInput = {
    ...retainedInput,
    snapshots: retainedInput.snapshots.filter((snapshot) =>
      relevantSnapshotIds.has(snapshot.id),
    ),
    claims: retainedInput.claims.filter((claim) =>
      selectedClaimIds.has(claim.id),
    ),
    scheduleCandidates: retainedInput.scheduleCandidates.filter(
      (schedule) =>
        !["rejected", "superseded"].includes(schedule.reviewStatus) &&
        relevantSnapshotIds.has(schedule.sourceSnapshotId) &&
        scheduleMatchesTargetYear(schedule.startsAt) &&
        scheduleMatchesTargetYear(schedule.endsAt),
    ),
  };
  const baseManifest = input.bundle.eventKey
    ? getEventPageManifest(input.bundle.eventKey)
    : undefined;
  const synthesis = synthesizeEventSourceBundle(input, baseManifest);
  const existing = await client
    .from("event_source_syntheses")
    .select(
      "id,engine_kind,engine_version,input_hash,status,reconciled_profile,conflicts,manifest_proposal,validation_report,is_manifest_valid,quality_score",
    )
    .eq("bundle_id", bundleId)
    .eq("engine_kind", "deterministic")
    .eq("engine_version", synthesis.engineVersion)
    .eq("input_hash", synthesis.inputHash)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data) {
    return {
      outcome: "succeeded",
      output: {
        synthesisId: existing.data.id,
        engineKind: existing.data.engine_kind,
        engineVersion: existing.data.engine_version,
        inputHash: existing.data.input_hash,
        status: existing.data.status,
        reconciledProfile: existing.data.reconciled_profile,
        conflicts: existing.data.conflicts,
        manifestProposal: existing.data.manifest_proposal,
        validationReport: existing.data.validation_report,
        isManifestValid: existing.data.is_manifest_valid,
        qualityScore: numberValue(existing.data.quality_score),
        exactReplay: true,
        retainedSnapshotCount: retainedInput.snapshots.length,
        selectedSnapshotCount: input.snapshots.length,
        retainedClaimCount: retainedInput.claims.length,
        selectedClaimCount: input.claims.length,
        retainedScheduleCandidateCount:
          retainedInput.scheduleCandidates.length,
        selectedScheduleCandidateCount: input.scheduleCandidates.length,
        evidencePolicyVersion: evidenceSelection.policyVersion,
        ignoredClaims: evidenceSelection.ignoredClaims,
      },
      links: { sourceBundleId: bundleId, synthesisId: existing.data.id },
    };
  }

  if (synthesis.conflicts.length) {
    return {
      outcome: "blocked",
      output: {
        conflicts: synthesis.conflicts,
        validationReport: synthesis.validationReport,
        retainedSnapshotCount: retainedInput.snapshots.length,
        selectedSnapshotCount: input.snapshots.length,
        retainedClaimCount: retainedInput.claims.length,
        selectedClaimCount: input.claims.length,
        retainedScheduleCandidateCount:
          retainedInput.scheduleCandidates.length,
        selectedScheduleCandidateCount: input.scheduleCandidates.length,
        evidencePolicyVersion: evidenceSelection.policyVersion,
        ignoredClaims: evidenceSelection.ignoredClaims,
      },
      links: { sourceBundleId: bundleId },
      exceptions: [
        exception(
          "deterministic_synthesis_failure",
          "human_review_required",
          "Deterministic synthesis retained unresolved factual conflicts.",
          { conflicts: synthesis.conflicts },
        ),
      ],
    };
  }

  let synthesisId: string | null = null;
  let replay = false;
  if (!context.dryRun) {
    const result = await client.rpc("atlas_create_event_source_synthesis", {
      p_bundle_id: bundleId,
      p_engine_kind: synthesis.engineKind,
      p_engine_version: synthesis.engineVersion,
      p_input_hash: synthesis.inputHash,
      p_reconciled_profile: synthesis.reconciledProfile,
      p_conflicts: synthesis.conflicts,
      p_manifest_proposal: synthesis.manifestProposal,
      p_validation_report: synthesis.validationReport,
      p_is_manifest_valid: synthesis.isManifestValid,
      p_quality_score: synthesis.qualityScore,
      p_model_provider: null,
      p_model_name: null,
      p_model_response_id: null,
      p_actor_identity: context.actorIdentity,
    });
    if (result.error) throw new Error(result.error.message);
    const row = firstRpcRow(result.data);
    synthesisId = text(row.synthesis_id);
    replay = row.created === false;
  }
  return {
    outcome: "succeeded",
    output: {
      synthesisId,
      engineKind: synthesis.engineKind,
      engineVersion: synthesis.engineVersion,
      inputHash: synthesis.inputHash,
      reconciledProfile: synthesis.reconciledProfile,
      conflicts: synthesis.conflicts,
      manifestProposal: synthesis.manifestProposal,
      validationReport: synthesis.validationReport,
      isManifestValid: synthesis.isManifestValid,
      qualityScore: synthesis.qualityScore,
      dryRun: context.dryRun,
      exactReplay: replay,
      retainedSnapshotCount: retainedInput.snapshots.length,
      selectedSnapshotCount: input.snapshots.length,
      retainedClaimCount: retainedInput.claims.length,
      selectedClaimCount: input.claims.length,
      retainedScheduleCandidateCount:
        retainedInput.scheduleCandidates.length,
      selectedScheduleCandidateCount: input.scheduleCandidates.length,
      evidencePolicyVersion: evidenceSelection.policyVersion,
      ignoredClaims: evidenceSelection.ignoredClaims,
    },
    links: {
      sourceBundleId: bundleId,
      synthesisId,
    },
  };
}

function stageEditorial(
  context: CompletionStageExecutorContext,
): CompletionStageExecutionResult {
  const synthesis = outputFor(context, "deterministic_synthesis");
  const qualityScore = numberValue(synthesis.qualityScore);
  if (
    context.dryRun ||
    context.event.editorialPolicy === "deterministic_only" ||
    qualityScore >= 0.9
  ) {
    return {
      outcome: "skipped",
      output: {
        modelCallRequired: false,
        reason:
          context.dryRun
            ? "dry_run_model_calls_disabled"
            : context.event.editorialPolicy === "deterministic_only"
            ? "deterministic_only_policy"
            : "deterministic_quality_sufficient",
        deterministicContentRetained: true,
      },
    };
  }
  const strength =
    context.event.editorialPolicy === "reasoning_if_ambiguous"
      ? "reasoning"
      : "economical";
  return {
    outcome: "succeeded",
    modelRequest: {
      processorId: "event-source-editorial",
      routeId:
        strength === "economical"
          ? "editorial-economical-v1"
          : "editorial-reasoning-v1",
      reason:
        strength === "economical"
          ? "Deterministic facts are safe, but retained prose quality is below the configured threshold."
          : "A reviewed factual ambiguity requires the configured reasoning route.",
      deterministicPreconditions: {
        deterministicSynthesisId: synthesis.synthesisId ?? null,
        deterministicInputHash: synthesis.inputHash ?? null,
        qualityScore,
        conflicts: synthesis.conflicts ?? [],
      },
      modelFamily: strength === "economical" ? "editorial-small" : "reasoning",
      configuredModel:
        strength === "economical"
          ? process.env.AI_GATEWAY_EDITORIAL_MODEL?.trim() ||
            "openai/gpt-5.4-mini"
          : process.env.AI_GATEWAY_REASONING_MODEL?.trim() ||
            "openai/gpt-5.4",
      reasoningLevel: strength === "reasoning" ? "medium" : null,
      maximumAttempts: 1,
      estimatedInputTokens: 12_000,
      estimatedOutputTokens: 3_000,
      fallbackBehavior: "retain_deterministic_content_and_open_exception",
      failureBlocking: strength === "reasoning",
      strength,
    },
  };
}

function stageContent(
  context: CompletionStageExecutorContext,
): CompletionStageExecutionResult {
  const deterministic = outputFor(context, "deterministic_synthesis");
  const editorial = outputFor(context, "editorial_assistance");
  const synthesis =
    editorial.editorialAccepted === true && isRecord(editorial.manifestProposal)
      ? editorial
      : deterministic;
  const conflicts = Array.isArray(synthesis.conflicts)
    ? synthesis.conflicts
    : [];
  if (conflicts.length) {
    return {
      outcome: "blocked",
      exceptions: [
        exception(
          "conflicting_event_dates",
          "human_review_required",
          "Conflicting deterministic facts block content readiness.",
          { conflicts },
        ),
      ],
    };
  }
  const validation = validateEventPageContentReadiness(
    synthesis.manifestProposal,
  );
  if (!validation.ok) {
    return {
      outcome: "blocked",
      output: { validationErrors: validation.errors },
      exceptions: [
        exception(
          "editorial_quality_failure",
          "publication_blocking",
          "The deterministic Event Hub content is incomplete.",
          {
            errors: validation.errors,
            validationReport: synthesis.validationReport ?? {},
          },
        ),
      ],
    };
  }
  return {
    outcome: "succeeded",
    output: {
      contentReady: true,
      artPending: validation.artPending,
      manifestProposal: validation.value,
      manifestHash: completionSha256(validation.value),
      synthesisId: synthesis.synthesisId ?? null,
      reconciledProfile: synthesis.reconciledProfile ?? {},
      contentSource:
        synthesis === editorial
          ? "model_assisted_editorial_synthesis"
          : "deterministic_synthesis",
    },
    links: {
      synthesisId: text(synthesis.synthesisId) || null,
      readinessState: validation.artPending ? "art_pending" : "content_ready",
      publicationEligible: false,
    },
  };
}

async function stagePackage(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
): Promise<CompletionStageExecutionResult> {
  const retained = references(context);
  if (retained.packageId) {
    const packageResult = await client
      .from("event_factory_packages")
      .select("id,status,readiness_checks,readiness_score")
      .eq("id", retained.packageId)
      .maybeSingle();
    if (packageResult.error || !packageResult.data) {
      throw new Error(packageResult.error?.message ?? "Package was not found.");
    }
    const artReady =
      isRecord(packageResult.data.readiness_checks) &&
      packageResult.data.readiness_checks.art === true;
    return {
      outcome: "succeeded",
      output: {
        packageId: packageResult.data.id,
        status: packageResult.data.status,
        readinessChecks: packageResult.data.readiness_checks,
        privatePreviewAvailable: true,
        artPending: !artReady,
      },
      links: {
        packageId: packageResult.data.id,
        readinessState: artReady ? "review_ready" : "art_pending",
        publicationEligible: false,
      },
    };
  }
  if (context.dryRun) {
    return {
      outcome: "succeeded",
      output: {
        packagePrepared: false,
        dryRun: true,
        privatePreviewAvailable: false,
        artPending:
          outputFor(context, "content_readiness").artPending === true,
      },
      links: {
        readinessState:
          outputFor(context, "content_readiness").artPending === true
            ? "art_pending"
            : "content_ready",
        publicationEligible: false,
      },
    };
  }
  try {
    const candidateId = retained.candidateId;
    if (!candidateId) {
      throw new Error(
        "A retained candidate is required for Event Factory package preparation.",
      );
    }
    let verificationCaseId = retained.verificationCaseId;
    if (verificationCaseId) {
      const retainedVerification = await client
        .from("event_verification_cases")
        .select("id,status")
        .eq("id", verificationCaseId)
        .maybeSingle();
      if (retainedVerification.error) {
        throw new Error(retainedVerification.error.message);
      }
      if (retainedVerification.data?.status !== "verified") {
        verificationCaseId = null;
      }
    }
    if (!verificationCaseId) {
      const verification = await client
        .from("event_verification_cases")
        .select("id")
        .eq("candidate_id", candidateId)
        .eq("status", "verified")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (verification.error) throw new Error(verification.error.message);
      verificationCaseId = verification.data?.id ?? null;
    }
    if (!verificationCaseId) {
      throw new Error("A verified Event Factory diligence case is required.");
    }
    const result = await prepareEventFactoryPackage({
      verificationCaseId,
      candidateId,
      actorIdentity: context.actorIdentity,
      artProvenance: context.event.artProvenance,
    });
    const packageId = text(result.package_id);
    const artPending = result.art_pending === true;
    return {
      outcome: "succeeded",
      output: {
        packageId,
        packagePrepared: result.created !== false,
        status: result.status,
        readinessScore: numberValue(result.readiness_score),
        privatePreviewAvailable: true,
        artPending,
      },
      links: {
        packageId,
        verificationCaseId,
        readinessState: artPending ? "art_pending" : "review_ready",
        publicationEligible: false,
      },
    };
  } catch (error) {
    return {
      outcome: "blocked",
      error: { message: error instanceof Error ? error.message : String(error) },
      exceptions: [
        exception(
          "event_factory_readiness_failure",
          "publication_blocking",
          error instanceof Error ? error.message : "Event Factory preparation failed.",
        ),
      ],
    };
  }
}

async function stageVisual(
  client: CompletionSupabaseClient,
  context: CompletionStageExecutorContext,
): Promise<CompletionStageExecutionResult> {
  const packageOutput = outputFor(context, "package_preparation");
  if (packageOutput.artPending === true) {
    return {
      outcome: "succeeded",
      output: {
        visualReady: false,
        artPending: true,
        imageActionInvoked: false,
      },
      links: {
        readinessState: "art_pending",
        artProvenance: context.event.artProvenance,
        publicationEligible: false,
      },
    };
  }
  const candidateId = references(context).candidateId;
  const workflow = await client
    .from("event_visual_workflows")
    .select("id,status,asset,qa_checks")
    .or(
      [
        candidateId ? `candidate_id.eq.${candidateId}` : "",
        `event_key.eq.${context.event.eventKey}`,
      ]
        .filter(Boolean)
        .join(","),
    )
    .eq("status", "approved")
    .order("revision_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (workflow.error) throw new Error(workflow.error.message);
  if (!workflow.data) {
    return {
      outcome: "succeeded",
      output: { visualReady: false, artPending: true, imageActionInvoked: false },
      links: {
        readinessState: "art_pending",
        publicationEligible: false,
      },
    };
  }
  if (context.event.artProvenance === "unknown") {
    return {
      outcome: "succeeded",
      output: {
        visualReady: false,
        workflowId: workflow.data.id,
        provenanceBlocked: true,
        imageActionInvoked: false,
      },
      links: {
        readinessState: "publication_blocked",
        artProvenance: "unknown",
        publicationEligible: false,
      },
      exceptions: [
        exception(
          "image_provenance_failure",
          "human_review_required",
          "Approved art exists, but its provenance category remains unknown.",
          { workflowId: workflow.data.id },
        ),
      ],
    };
  }
  return {
    outcome: "succeeded",
    output: {
      visualReady: true,
      workflowId: workflow.data.id,
      provenanceCategory: context.event.artProvenance,
      imageActionInvoked: false,
    },
    links: {
      readinessState: "review_ready",
      artProvenance: context.event.artProvenance,
      publicationEligible: false,
    },
  };
}

function stageExceptionReview(
  context: CompletionStageExecutorContext,
): CompletionStageExecutionResult {
  const openBlockingExceptions =
    openBlockingCompletionExceptionsForEvent(
      context.eventExceptions,
      context.event.eventKey,
    );
  const output = {
    exceptionQueueInspected: true,
    openBlockingExceptionCount: openBlockingExceptions.length,
    openBlockingExceptions: openBlockingExceptions.map((exception) => ({
      id: exception.id,
      stageId: exception.stageId,
      code: exception.code,
      status: exception.status,
    })),
    humanDecisionRequired:
      openBlockingExceptions.length > 0 ||
      outputFor(context, "visual_readiness").provenanceBlocked === true,
  };
  if (openBlockingExceptions.length) {
    return {
      outcome: "blocked",
      output,
      links: {
        readinessState: "publication_blocked",
        publicationEligible: false,
      },
    };
  }
  return {
    outcome: "succeeded",
    output,
  };
}

function stagePublicationReadiness(
  context: CompletionStageExecutorContext,
): CompletionStageExecutionResult {
  const packageOutput = outputFor(context, "package_preparation");
  const visualOutput = outputFor(context, "visual_readiness");
  const eligible =
    packageOutput.privatePreviewAvailable === true &&
    visualOutput.provenanceBlocked !== true;
  return {
    outcome: "succeeded",
    output: {
      publicationEligible: eligible,
      publicationInvoked: false,
      requiresHumanPackageApproval: true,
      packageId: packageOutput.packageId ?? null,
      artPending: visualOutput.visualReady !== true,
    },
    links: {
      packageId: text(packageOutput.packageId) || null,
      readinessState: eligible ? "review_ready" : "publication_blocked",
      publicationEligible: eligible,
    },
    ...(!eligible
      ? {
          exceptions: [
            exception(
              "publication_readiness_failure",
              "publication_blocking",
              "The private package is retained, but publication readiness is blocked.",
              {
                packageId: packageOutput.packageId ?? null,
                artPending: visualOutput.visualReady !== true,
              },
            ),
          ],
        }
      : {}),
  };
}

export function createSupabaseMichiganCompletionExecutor(
  client: CompletionSupabaseClient,
  options?: {
    executeModel?: NonNullable<CompletionStageExecutor["executeModel"]>;
    sourceCompositionServices?: SourceCompositionServices;
    verificationCompositionServices?: VerificationCompositionServices;
  },
): CompletionStageExecutor {
  const sourceCompositionServices =
    options?.sourceCompositionServices ??
    createDefaultSourceCompositionServices();
  const verificationCompositionServices =
    options?.verificationCompositionServices ??
    createDefaultVerificationCompositionServices();
  return {
    async execute(stageId, context) {
      if (stageId === "manifest_validation") {
        return {
          outcome: "succeeded",
          output: {
            schemaVersion: context.manifest.schemaVersion,
            eventInputHash: context.event.inputHash,
          },
        };
      }
      if (stageId === "candidate_staging") {
        return stageCandidate(client, context);
      }
      if (stageId === "identity_matching") {
        return stageIdentity(client, context);
      }
      if (stageId === "evidence_readiness") {
        return stageEvidence(
          client,
          context,
          sourceCompositionServices,
          verificationCompositionServices,
        );
      }
      if (stageId === "deterministic_synthesis") {
        return stageSynthesis(client, context);
      }
      if (stageId === "editorial_assistance") {
        return stageEditorial(context);
      }
      if (stageId === "content_readiness") {
        return stageContent(context);
      }
      if (stageId === "package_preparation") {
        return stagePackage(client, context);
      }
      if (stageId === "visual_readiness") {
        return stageVisual(client, context);
      }
      if (stageId === "exception_review") {
        return stageExceptionReview(context);
      }
      if (stageId === "publication_readiness") {
        return stagePublicationReadiness(context);
      }
      throw new Error(`Unsupported Michigan completion stage ${stageId}.`);
    },
    ...(options?.executeModel ? { executeModel: options.executeModel } : {}),
  };
}
