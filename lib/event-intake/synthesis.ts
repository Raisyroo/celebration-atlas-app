import 'server-only';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';
import { resolveEventPageManifest } from '@/lib/event-pages/publishedManifest';
import type { ScoutContentReference } from '@/lib/scout/composerContext';
import { validateEventPageManifest } from '@/data/eventPageManifestValidation';
import type { EventPageManifest } from '@/data/eventPageManifestTypes';
import {
  applyEditorialModelOutput,
  editorialInputHash,
  EDITORIAL_PROMPT_VERSION,
  type EditorialModelOutput,
} from './editorialAssistance';
import { generateEditorialModelDraft } from './editorialModel';
import { buildEditorialPlan } from './editorialPlanning';
import { synthesizeEventSourceBundle } from './synthesisEngine';
import { getApprovedEventVisualWorkflow } from '@/lib/event-factory/visuals';
import type {
  EventSourceSynthesisInput,
  EventSourceSynthesisSummary,
  EventSourceSynthesisStatus,
  EditorialReviewSummary,
  ModelEditorialReviewSummary,
  SourceClaimConfidence,
  SourceClaimReviewStatus,
  SynthesisContentSegment,
} from './synthesisTypes';

export type { EventSourceSynthesisSummary } from './synthesisTypes';

type BundleRow = {
  id: string;
  name: string;
  status: string;
  event_key: string | null;
  canonical_event_id: string | null;
  candidate_id: string | null;
  ready_at: string | null;
};

type SnapshotRow = {
  id: string;
  sequence_number: number;
  source_kind: string;
  canonical_url: string;
  page_title: string | null;
  content_hash: string;
  fetched_at: string;
  inspection: unknown;
};

type ClaimRow = {
  id: string;
  source_snapshot_id: string;
  field_path: string;
  value: unknown;
  normalized_text: string;
  confidence: SourceClaimConfidence;
  confidence_score: number | string | null;
  extraction_method: string;
  review_status: SourceClaimReviewStatus;
  created_at: string;
};

type ScheduleRow = {
  id: string;
  source_snapshot_id: string;
  dedupe_key: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  date_text: string | null;
  timezone: string | null;
  venue: string | null;
  category: string | null;
  tags: string[] | null;
  details: string | null;
  confidence: SourceClaimConfidence;
  confidence_score: number | string | null;
  review_status: SourceClaimReviewStatus;
};

type SynthesisRow = {
  synthesis_id: string;
  bundle_id: string;
  bundle_name: string;
  event_key: string | null;
  version_number: number;
  status: EventSourceSynthesisStatus;
  engine_kind: 'deterministic' | 'model_assisted';
  engine_version: string;
  input_hash: string;
  is_manifest_valid: boolean;
  quality_score: number | string;
  conflict_count: number | string;
  missing_field_count: number | string;
  validation_report: unknown;
  review_notes: string | null;
  created_by: string;
  reviewed_by: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type FullSynthesisRow = {
  id: string;
  bundle_id: string;
  status: EventSourceSynthesisStatus;
  engine_kind: 'deterministic' | 'model_assisted';
  engine_version: string;
  input_hash: string;
  reconciled_profile: unknown;
  conflicts: unknown;
  manifest_proposal: unknown;
  validation_report: unknown;
  is_manifest_valid: boolean;
  quality_score: number | string;
};

function requireServiceClient() {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error('Atlas Control Plane configuration is incomplete.');
  return supabase;
}

function firstRpcRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Synthesis operation returned no result.');
  return row as Record<string, unknown>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function validationReport(value: unknown) {
  const record = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    errors: stringArray(record.errors),
    warnings: stringArray(record.warnings),
    missingFields: stringArray(record.missingFields),
    editorial: editorialReviewSummary(record.editorial),
    modelEditorial: modelEditorialReviewSummary(record.modelEditorial),
  };
}

function modelEditorialReviewSummary(value: unknown): ModelEditorialReviewSummary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const checks = record.qualityChecks;
  if (!checks || typeof checks !== 'object' || Array.isArray(checks)) return undefined;
  const quality = checks as Record<string, unknown>;
  if (typeof record.parentSynthesisId !== 'string' || typeof record.model !== 'string') return undefined;
  return {
    parentSynthesisId: record.parentSynthesisId,
    provider: typeof record.provider === 'string' ? record.provider : 'unknown',
    model: record.model,
    promptVersion: typeof record.promptVersion === 'string' ? record.promptVersion : 'unknown',
    proposedRewriteCount: typeof record.proposedRewriteCount === 'number' ? record.proposedRewriteCount : 0,
    appliedRewriteCount: typeof record.appliedRewriteCount === 'number' ? record.appliedRewriteCount : 0,
    rejectedRewriteCount: typeof record.rejectedRewriteCount === 'number' ? record.rejectedRewriteCount : 0,
    changedTargets: stringArray(record.changedTargets),
    addedAudienceGroupCount: typeof record.addedAudienceGroupCount === 'number' ? record.addedAudienceGroupCount : 0,
    addedSpotlight: record.addedSpotlight === true,
    qualityChecks: {
      immutableFactsLocked: quality.immutableFactsLocked === true,
      sourceIdsVerified: quality.sourceIdsVerified === true,
      numericClaimsGrounded: quality.numericClaimsGrounded === true,
      sponsorLanguageExcluded: quality.sponsorLanguageExcluded === true,
      researchNarrationExcluded: quality.researchNarrationExcluded === true,
      spotlightNarrativeSourceRequired: quality.spotlightNarrativeSourceRequired === true,
      manifestValid: quality.manifestValid === true,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function editorialReviewSummary(value: unknown): EditorialReviewSummary | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const quality = record.qualityChecks;
  if (typeof record.mode !== 'string' || typeof record.scheduleStatus !== 'string') return undefined;
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return undefined;
  const qualityRecord = quality as Record<string, unknown>;
  return {
    mode: record.mode as EditorialReviewSummary['mode'],
    scheduleStatus: record.scheduleStatus as EditorialReviewSummary['scheduleStatus'],
    currentEditionYear: typeof record.currentEditionYear === 'number' ? record.currentEditionYear : null,
    referenceYear: typeof record.referenceYear === 'number' ? record.referenceYear : null,
    referenceItemCount: typeof record.referenceItemCount === 'number' ? record.referenceItemCount : 0,
    traditionCount: typeof record.traditionCount === 'number' ? record.traditionCount : 0,
    highlightCount: typeof record.highlightCount === 'number' ? record.highlightCount : 0,
    recommendedTabs: stringArray(record.recommendedTabs),
    qualityChecks: {
      truthLayersSeparated: qualityRecord.truthLayersSeparated === true,
      currentScheduleProtected: qualityRecord.currentScheduleProtected === true,
      referenceScheduleCaveated: qualityRecord.referenceScheduleCaveated === true,
      traditionCoverage: qualityRecord.traditionCoverage === true,
      highlightCoverage: qualityRecord.highlightCoverage === true,
      editorialSourceCoverage: qualityRecord.editorialSourceCoverage === true,
    },
  };
}

function inspectionContentSegments(value: unknown): SynthesisContentSegment[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const segments = (value as Record<string, unknown>).contentSegments;
  if (!Array.isArray(segments)) return [];
  return segments.slice(0, 240).flatMap((segment) => {
    if (!segment || typeof segment !== 'object' || Array.isArray(segment)) return [];
    const record = segment as Record<string, unknown>;
    if (!['heading', 'paragraph', 'listItem', 'detail', 'time'].includes(String(record.kind))) return [];
    if (typeof record.text !== 'string' || !record.text.trim()) return [];
    return [{
      kind: record.kind as SynthesisContentSegment['kind'],
      text: record.text.trim().slice(0, 1_000),
    }];
  });
}

export async function listEventSourceSyntheses(): Promise<{
  items: EventSourceSynthesisSummary[];
  error: string | null;
}> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return { items: [], error: 'Atlas Control Plane configuration is incomplete.' };
  const { data, error } = await supabase.rpc('atlas_list_event_source_syntheses', { p_limit: 40 });
  if (error) return { items: [], error: error.message };

  const items = ((data ?? []) as SynthesisRow[]).map((row) => ({
    id: row.synthesis_id,
    bundleId: row.bundle_id,
    bundleName: row.bundle_name,
    eventKey: row.event_key,
    versionNumber: row.version_number,
    status: row.status,
    engineKind: row.engine_kind,
    engineVersion: row.engine_version,
    inputHash: row.input_hash,
    isManifestValid: row.is_manifest_valid,
    qualityScore: Number(row.quality_score),
    conflictCount: Number(row.conflict_count),
    missingFieldCount: Number(row.missing_field_count),
    validationReport: validationReport(row.validation_report),
    reviewNotes: row.review_notes,
    createdBy: row.created_by,
    reviewedBy: row.reviewed_by,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  }));
  return { items, error: null };
}

export async function getEventSourceSynthesisPreview(synthesisId: string): Promise<{
  manifest: EventPageManifest;
  scoutContentReference: ScoutContentReference;
}> {
  const supabase = requireServiceClient();
  const { data, error } = await supabase
    .from('event_source_syntheses')
    .select('version_number,manifest_proposal,is_manifest_valid')
    .eq('id', synthesisId)
    .maybeSingle<{
      version_number: number;
      manifest_proposal: unknown;
      is_manifest_valid: boolean;
    }>();
  if (error || !data) throw new Error('Synthesis proposal was not found.');
  if (!data.is_manifest_valid) throw new Error('Synthesis proposal is not ready for preview.');
  const validation = validateEventPageManifest(data.manifest_proposal);
  if (!validation.ok) throw new Error(`Synthesis preview is invalid: ${validation.errors.join(' ')}`);
  return {
    manifest: validation.value,
    scoutContentReference: {
      sourceKind: 'source-synthesis',
      packageId: synthesisId,
      packageVersion: String(data.version_number),
    },
  };
}

async function loadSynthesisInput(bundleId: string): Promise<EventSourceSynthesisInput> {
  const supabase = requireServiceClient();
  const [bundleResult, snapshotResult, claimResult, scheduleResult] = await Promise.all([
    supabase
      .from('event_source_bundles')
      .select('id,name,status,event_key,canonical_event_id,candidate_id,ready_at')
      .eq('id', bundleId)
      .maybeSingle<BundleRow>(),
    supabase
      .from('event_source_snapshots')
      .select('id,sequence_number,source_kind,canonical_url,page_title,content_hash,fetched_at,inspection')
      .eq('bundle_id', bundleId)
      .order('sequence_number', { ascending: true }),
    supabase
      .from('event_source_claims')
      .select('id,source_snapshot_id,field_path,value,normalized_text,confidence,confidence_score,extraction_method,review_status,created_at')
      .eq('bundle_id', bundleId)
      .order('field_path', { ascending: true })
      .order('id', { ascending: true }),
    supabase
      .from('event_schedule_candidates')
      .select('id,source_snapshot_id,dedupe_key,title,starts_at,ends_at,date_text,timezone,venue,category,tags,details,confidence,confidence_score,review_status')
      .eq('bundle_id', bundleId)
      .order('starts_at', { ascending: true, nullsFirst: false })
      .order('id', { ascending: true }),
  ]);

  if (bundleResult.error || !bundleResult.data) throw new Error('Source bundle was not found.');
  if (!['ready_for_synthesis', 'draft_ready'].includes(bundleResult.data.status)) {
    throw new Error('The source bundle must be ready before synthesis.');
  }
  if (snapshotResult.error || claimResult.error || scheduleResult.error) {
    throw new Error('The source bundle evidence could not be loaded.');
  }

  const snapshotRows = (snapshotResult.data ?? []) as SnapshotRow[];
  if (!snapshotRows.length) throw new Error('The source bundle has no archived source snapshots.');
  const claimRows = (claimResult.data ?? []) as ClaimRow[];
  const scheduleRows = (scheduleResult.data ?? []) as ScheduleRow[];
  const approvedVisualWorkflow = await getApprovedEventVisualWorkflow({
    candidateId: bundleResult.data.candidate_id,
    eventKey: bundleResult.data.event_key,
  });

  return {
    bundle: {
      id: bundleResult.data.id,
      name: bundleResult.data.name,
      status: bundleResult.data.status,
      eventKey: bundleResult.data.event_key,
      canonicalEventId: bundleResult.data.canonical_event_id,
      candidateId: bundleResult.data.candidate_id,
      readyAt: bundleResult.data.ready_at,
    },
    snapshots: snapshotRows.map((row) => ({
      id: row.id,
      sequenceNumber: row.sequence_number,
      sourceKind: row.source_kind,
      canonicalUrl: row.canonical_url,
      pageTitle: row.page_title,
      contentHash: row.content_hash,
      fetchedAt: row.fetched_at,
      contentSegments: inspectionContentSegments(row.inspection),
    })),
    claims: claimRows.map((row) => ({
      id: row.id,
      sourceSnapshotId: row.source_snapshot_id,
      fieldPath: row.field_path,
      value: row.value,
      normalizedText: row.normalized_text,
      confidence: row.confidence,
      confidenceScore: row.confidence_score === null ? null : Number(row.confidence_score),
      extractionMethod: row.extraction_method,
      reviewStatus: row.review_status,
      createdAt: row.created_at,
    })),
    scheduleCandidates: scheduleRows.map((row) => ({
      id: row.id,
      sourceSnapshotId: row.source_snapshot_id,
      dedupeKey: row.dedupe_key,
      title: row.title,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      dateText: row.date_text,
      timezone: row.timezone,
      venue: row.venue,
      category: row.category,
      tags: row.tags ?? [],
      details: row.details,
      confidence: row.confidence,
      confidenceScore: row.confidence_score === null ? null : Number(row.confidence_score),
      reviewStatus: row.review_status,
    })),
    ...(approvedVisualWorkflow?.asset ? {
      approvedVisual: {
        workflowId: approvedVisualWorkflow.id,
        imageSrc: approvedVisualWorkflow.asset.publicUrl,
        imageAlt: approvedVisualWorkflow.asset.altText,
        credit: approvedVisualWorkflow.asset.credit,
        contentHash: approvedVisualWorkflow.contentHash,
      },
    } : {}),
  };
}

export async function generateEventSourceSynthesis(args: {
  bundleId: string;
  actorIdentity: string;
}) {
  const input = await loadSynthesisInput(args.bundleId);
  const baseManifest = input.bundle.eventKey
    ? await resolveEventPageManifest(input.bundle.eventKey)
    : undefined;
  const synthesis = synthesizeEventSourceBundle(input, baseManifest);
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_create_event_source_synthesis', {
    p_bundle_id: args.bundleId,
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
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return { result: firstRpcRow(data), synthesis };
}

async function loadEditorialSynthesisContext(synthesisId: string) {
  const supabase = requireServiceClient();
  const parentResult = await supabase
    .from('event_source_syntheses')
    .select('id,bundle_id,status,engine_kind,engine_version,input_hash,reconciled_profile,conflicts,manifest_proposal,validation_report,is_manifest_valid,quality_score')
    .eq('id', synthesisId)
    .maybeSingle<FullSynthesisRow>();
  if (parentResult.error || !parentResult.data) throw new Error('Synthesis proposal was not found.');
  const parent = parentResult.data;
  if (parent.engine_kind !== 'deterministic' || parent.status !== 'generated') {
    throw new Error('Editorial assistance requires an unsubmitted deterministic proposal.');
  }
  const manifestValidation = validateEventPageManifest(parent.manifest_proposal);
  const parentManifest = (manifestValidation.ok ? manifestValidation.value : parent.manifest_proposal) as EventPageManifest;
  if (!isRecord(parentManifest)) throw new Error('The deterministic manifest proposal is unavailable.');
  const input = await loadSynthesisInput(parent.bundle_id);
  return { parent, parentManifest, input };
}

export async function prepareEventSourceEditorialWorkspace(synthesisId: string) {
  const context = await loadEditorialSynthesisContext(synthesisId);
  const profile = isRecord(context.parent.reconciled_profile) ? context.parent.reconciled_profile : {};
  const values = isRecord(profile.values) ? profile.values : {};
  return {
    input: context.input,
    manifest: context.parentManifest,
    plan: buildEditorialPlan(context.input, values),
  };
}

async function persistModelAssistedEditorialSynthesis(args: {
  synthesisId: string;
  actorIdentity: string;
  provider: string;
  model: string;
  requestedModel: string;
  responseId: string | null;
  output: EditorialModelOutput;
}) {
  const { parent, parentManifest, input } = await loadEditorialSynthesisContext(args.synthesisId);
  const supabase = requireServiceClient();
  const editorial = applyEditorialModelOutput({
    parentSynthesisId: parent.id,
    provider: args.provider,
    model: args.model,
    input,
    manifest: parentManifest,
    output: args.output,
  });
  if (!editorial.report.appliedRewriteCount && !editorial.report.addedAudienceGroupCount && !editorial.report.addedSpotlight) {
    throw new Error('The editorial model produced no grounded improvements.');
  }
  const validation = validateEventPageManifest(editorial.manifest);
  const parentValidation = validationReport(parent.validation_report);
  const warnings = [
    ...parentValidation.warnings,
    ...validation.warnings,
    ...editorial.rejected.map((item) => `Editorial rewrite rejected for ${item.target}: ${item.reason}`),
  ];
  const report = {
    errors: validation.errors,
    warnings: [...new Set(warnings)],
    missingFields: parentValidation.missingFields,
    editorial: parentValidation.editorial,
    modelEditorial: editorial.report,
  };
  const modelVersion = `${EDITORIAL_PROMPT_VERSION}-${args.requestedModel}`
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .slice(0, 100);
  const hash = editorialInputHash({
    parentInputHash: parent.input_hash,
    parentManifest,
    model: args.requestedModel,
  });
  const { data, error } = await supabase.rpc('atlas_create_model_assisted_synthesis', {
    p_parent_synthesis_id: parent.id,
    p_engine_version: modelVersion,
    p_input_hash: hash,
    p_reconciled_profile: parent.reconciled_profile,
    p_conflicts: Array.isArray(parent.conflicts) ? parent.conflicts : [],
    p_manifest_proposal: validation.ok ? validation.value : editorial.manifest,
    p_validation_report: report,
    p_is_manifest_valid: validation.ok,
    p_quality_score: Number(parent.quality_score),
    p_model_provider: args.provider,
    p_model_name: args.model,
    p_model_response_id: args.responseId,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return {
    result: firstRpcRow(data),
    proposal: {
      isManifestValid: validation.ok,
      qualityScore: Number(parent.quality_score),
      missingFields: parentValidation.missingFields,
      editorial: editorial.report,
    },
  };
}

export async function createModelAssistedEditorialSynthesisFromOutput(args: {
  synthesisId: string;
  actorIdentity: string;
  provider: string;
  model: string;
  responseId?: string | null;
  output: EditorialModelOutput;
}) {
  return persistModelAssistedEditorialSynthesis({
    ...args,
    requestedModel: args.model,
    responseId: args.responseId ?? null,
  });
}

export async function generateModelAssistedEditorialSynthesis(args: {
  synthesisId: string;
  actorIdentity: string;
}) {
  const { input, manifest, plan } = await prepareEventSourceEditorialWorkspace(args.synthesisId);
  const generated = await generateEditorialModelDraft({ input, manifest, plan });
  return persistModelAssistedEditorialSynthesis({
    synthesisId: args.synthesisId,
    actorIdentity: args.actorIdentity,
    provider: generated.provider,
    model: generated.model,
    requestedModel: generated.requestedModel,
    responseId: generated.responseId,
    output: generated.output,
  });
}

export async function attachEventSourceSynthesisMapRecord(args: {
  synthesisId: string;
  mapRecord: {
    latitude: number;
    longitude: number;
    sourceUrl: string;
    sourceLabel: string;
    coordinateMethod: string;
    confidenceScore: number;
  };
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_attach_source_synthesis_map_record', {
    p_synthesis_id: args.synthesisId,
    p_map_record: args.mapRecord,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function transitionEventSourceSynthesis(args: {
  synthesisId: string;
  action: 'submit' | 'accept' | 'reject';
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_transition_event_source_synthesis', {
    p_synthesis_id: args.synthesisId,
    p_action: args.action,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}
