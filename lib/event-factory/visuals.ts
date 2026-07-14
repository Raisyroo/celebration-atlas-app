import "server-only";

import { createHash } from "node:crypto";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import type {
  EventVisualAsset,
  EventVisualGenerationBrief,
  EventVisualLane,
  EventVisualQaChecks,
  EventVisualReference,
  EventVisualSignature,
  EventVisualWorkflowStatus,
  EventVisualWorkflowSummary,
} from "./types";
import { buildEventVisualGenerationBrief } from "./visualPrompt";

export { buildEventVisualGenerationBrief } from "./visualPrompt";

type VisualWorkflowRow = {
  workflow_id: string;
  candidate_id: string;
  event_id: string | null;
  source_bundle_id: string | null;
  target_year: number;
  event_key: string;
  event_name: string;
  location_label: string;
  lane: EventVisualLane;
  status: EventVisualWorkflowStatus;
  search_query: string;
  reviewed_thumbnail_count: number;
  reference_sources: unknown;
  visual_signature: unknown;
  generation_brief: unknown;
  asset: unknown;
  qa_checks: unknown;
  content_hash: string;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
};

type StoredVisualWorkflowRow = Omit<VisualWorkflowRow, "workflow_id"> & { id: string };

const DEFAULT_QA_CHECKS: EventVisualQaChecks = {
  visualElementsVerified: false,
  independentComposition: false,
  noInventedTextOrMarks: false,
  mobileCropVerified: false,
  publicAssetVerified: false,
};

function requireServiceClient() {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error("Atlas Control Plane configuration is incomplete.");
  return supabase;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim())
    : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: string[], limit: number) {
  const seen = new Set<string>();
  return values.flatMap((value) => {
    const normalized = value.trim();
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key) || seen.size >= limit) return [];
    seen.add(key);
    return [normalized];
  });
}

function publicHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function mapReferences(value: unknown): EventVisualReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const source = record(item);
    const url = publicHttpUrl(text(source?.url));
    if (!url) return [];
    const label = text(source?.label);
    return [{ url, ...(label ? { label } : {}) }];
  });
}

function mapSignature(value: unknown): EventVisualSignature {
  const source = record(value);
  return {
    motifs: uniqueStrings(strings(source?.motifs), 5),
    heroMoment: text(source?.heroMoment),
  };
}

function mapGenerationBrief(value: unknown): EventVisualGenerationBrief {
  const source = record(value);
  return {
    prompt: text(source?.prompt),
    aspectRatio: "2:3",
    textPolicy: "no_generated_text",
    style: text(source?.style) || "Cinematic Celebration Atlas realism",
  };
}

function mapAsset(value: unknown): EventVisualAsset | null {
  const source = record(value);
  const publicUrl = text(source?.publicUrl);
  const storagePath = text(source?.storagePath);
  const altText = text(source?.altText);
  if (!publicUrl || !storagePath || !altText || source?.sourceKind !== "supabase") return null;
  return {
    publicUrl,
    altText,
    credit: text(source.credit) || "Celebration Atlas artwork",
    sourceKind: "supabase",
    storageBucket: text(source.storageBucket) || "celebration-atlas-media",
    storagePath,
    ...(text(source.contentType) ? { contentType: text(source.contentType) } : {}),
    ...(Number.isFinite(Number(source.byteSize)) ? { byteSize: Number(source.byteSize) } : {}),
  };
}

function mapQaChecks(value: unknown): EventVisualQaChecks {
  const source = record(value);
  return {
    visualElementsVerified: source?.visualElementsVerified === true,
    independentComposition: source?.independentComposition === true,
    noInventedTextOrMarks: source?.noInventedTextOrMarks === true,
    mobileCropVerified: source?.mobileCropVerified === true,
    publicAssetVerified: source?.publicAssetVerified === true,
  };
}

function mapWorkflowRow(row: VisualWorkflowRow | StoredVisualWorkflowRow): EventVisualWorkflowSummary {
  return {
    id: "workflow_id" in row ? row.workflow_id : row.id,
    candidateId: row.candidate_id,
    eventId: row.event_id,
    sourceBundleId: row.source_bundle_id,
    targetYear: row.target_year,
    eventKey: row.event_key,
    eventName: row.event_name,
    locationLabel: row.location_label,
    lane: row.lane,
    status: row.status,
    searchQuery: row.search_query,
    reviewedThumbnailCount: row.reviewed_thumbnail_count,
    referenceSources: mapReferences(row.reference_sources),
    visualSignature: mapSignature(row.visual_signature),
    generationBrief: mapGenerationBrief(row.generation_brief),
    asset: mapAsset(row.asset),
    qaChecks: mapQaChecks(row.qa_checks),
    contentHash: row.content_hash,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
  };
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export async function listEventVisualWorkflows(): Promise<{ items: EventVisualWorkflowSummary[]; error: string | null }> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return { items: [], error: "Atlas Control Plane configuration is incomplete." };
  const { data, error } = await supabase.rpc("atlas_list_event_visual_workflows", { p_limit: 200 });
  if (error) return { items: [], error: error.message };
  return { items: ((data ?? []) as VisualWorkflowRow[]).map(mapWorkflowRow), error: null };
}

export async function getEventVisualWorkflow(workflowId: string): Promise<EventVisualWorkflowSummary> {
  const supabase = requireServiceClient();
  const { data, error } = await supabase
    .from("event_visual_workflows")
    .select("id,candidate_id,event_id,source_bundle_id,target_year,event_key,event_name,location_label,lane,status,search_query,reviewed_thumbnail_count,reference_sources,visual_signature,generation_brief,asset,qa_checks,content_hash,reviewed_by,review_notes,created_at,updated_at,reviewed_at")
    .eq("id", workflowId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Visual workflow was not found.");
  return mapWorkflowRow(data as StoredVisualWorkflowRow);
}

export async function getApprovedEventVisualWorkflow(args: {
  candidateId?: string | null;
  eventKey?: string | null;
}): Promise<EventVisualWorkflowSummary | null> {
  const supabase = requireServiceClient();
  let query = supabase
    .from("event_visual_workflows")
    .select("id,candidate_id,event_id,source_bundle_id,target_year,event_key,event_name,location_label,lane,status,search_query,reviewed_thumbnail_count,reference_sources,visual_signature,generation_brief,asset,qa_checks,content_hash,reviewed_by,review_notes,created_at,updated_at,reviewed_at")
    .eq("status", "approved")
    .order("target_year", { ascending: false })
    .limit(1);
  if (args.candidateId) query = query.eq("candidate_id", args.candidateId);
  else if (args.eventKey) query = query.eq("event_key", args.eventKey);
  else return null;
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapWorkflowRow(data as StoredVisualWorkflowRow) : null;
}

export async function saveEventVisualWorkflow(args: {
  candidateId: string;
  sourceBundleId?: string | null;
  targetYear: number;
  eventKey: string;
  eventName: string;
  locationLabel: string;
  lane: EventVisualLane;
  searchQuery: string;
  reviewedThumbnailCount: number;
  referenceSources: EventVisualReference[];
  motifs: string[];
  heroMoment: string;
  asset?: EventVisualAsset | null;
  qaChecks?: Partial<EventVisualQaChecks>;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const referenceSources = args.referenceSources.flatMap((reference) => {
    const url = publicHttpUrl(reference.url);
    if (!url) return [];
    const label = reference.label?.trim();
    return [{ url, ...(label ? { label } : {}) }];
  }).slice(0, 12);
  const visualSignature: EventVisualSignature = {
    motifs: uniqueStrings(args.motifs, 5),
    heroMoment: args.heroMoment.trim(),
  };
  const generationBrief = buildEventVisualGenerationBrief({
    eventName: args.eventName.trim(),
    locationLabel: args.locationLabel.trim(),
    motifs: visualSignature.motifs,
    heroMoment: visualSignature.heroMoment,
  });
  const qaChecks: EventVisualQaChecks = { ...DEFAULT_QA_CHECKS, ...args.qaChecks };
  const asset = args.asset ?? {};
  const payload = {
    eventKey: args.eventKey,
    eventName: args.eventName.trim(),
    locationLabel: args.locationLabel.trim(),
    lane: args.lane,
    searchQuery: args.searchQuery.trim(),
    reviewedThumbnailCount: args.reviewedThumbnailCount,
    referenceSources,
    visualSignature,
    generationBrief,
    asset,
    qaChecks,
  };
  const { data, error } = await supabase.rpc("atlas_upsert_event_visual_workflow", {
    p_candidate_id: args.candidateId,
    p_source_bundle_id: args.sourceBundleId ?? null,
    p_target_year: args.targetYear,
    p_event_key: args.eventKey,
    p_event_name: args.eventName.trim(),
    p_location_label: args.locationLabel.trim(),
    p_lane: args.lane,
    p_search_query: args.searchQuery.trim(),
    p_reviewed_thumbnail_count: args.reviewedThumbnailCount,
    p_reference_sources: referenceSources,
    p_visual_signature: visualSignature,
    p_generation_brief: generationBrief,
    p_asset: asset,
    p_qa_checks: qaChecks,
    p_content_hash: contentHash(payload),
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Visual workflow operation returned no result.");
  return row as Record<string, unknown>;
}

export async function reviewEventVisualWorkflow(args: {
  workflowId: string;
  decision: "approve" | "reject" | "reopen";
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_review_event_visual_workflow", {
    p_workflow_id: args.workflowId,
    p_decision: args.decision,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Visual workflow review returned no result.");
  return row as Record<string, unknown>;
}
