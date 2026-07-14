import "server-only";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import type { EventVerificationCaseSummary } from "./types";

type VerificationRow = {
  verification_case_id: string;
  candidate_id: string | null;
  event_id: string | null;
  event_name: string;
  event_slug: string;
  target_year: number;
  status: EventVerificationCaseSummary["status"];
  existence_status: EventVerificationCaseSummary["existenceStatus"];
  recurrence_status: EventVerificationCaseSummary["recurrenceStatus"];
  dates_status: EventVerificationCaseSummary["datesStatus"];
  location_status: EventVerificationCaseSummary["locationStatus"];
  official_source_count: number | string;
  supporting_source_count: number | string;
  historical_occurrence_count: number | string;
  verification_score: number | string;
  evidence_count: number | string;
  created_at: string;
  updated_at: string;
  verified_at: string | null;
};

function requireServiceClient() {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error("Atlas Control Plane configuration is incomplete.");
  return supabase;
}

function firstRpcRow(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Verification operation returned no result.");
  return row as Record<string, unknown>;
}

export async function listEventVerificationCases(): Promise<{ items: EventVerificationCaseSummary[]; error: string | null }> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return { items: [], error: "Atlas Control Plane configuration is incomplete." };
  const { data, error } = await supabase.rpc("atlas_list_event_verification_cases", { p_limit: 200 });
  if (error) return { items: [], error: error.message };

  const items = ((data ?? []) as VerificationRow[]).map((row) => ({
    id: row.verification_case_id,
    candidateId: row.candidate_id,
    eventId: row.event_id,
    eventName: row.event_name,
    eventSlug: row.event_slug,
    targetYear: row.target_year,
    status: row.status,
    existenceStatus: row.existence_status,
    recurrenceStatus: row.recurrence_status,
    datesStatus: row.dates_status,
    locationStatus: row.location_status,
    officialSourceCount: Number(row.official_source_count),
    supportingSourceCount: Number(row.supporting_source_count),
    historicalOccurrenceCount: Number(row.historical_occurrence_count),
    verificationScore: Number(row.verification_score),
    evidenceCount: Number(row.evidence_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    verifiedAt: row.verified_at,
  }));
  return { items, error: null };
}

export async function createEventVerificationCase(args: {
  candidateId?: string;
  eventId?: string;
  targetYear: number;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_create_event_verification_case", {
    p_candidate_id: args.candidateId ?? null,
    p_event_id: args.eventId ?? null,
    p_target_year: args.targetYear,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function addEventVerificationEvidence(args: {
  verificationCaseId: string;
  sourceSnapshotId?: string;
  proofKind: string;
  sourceKind: string;
  sourceUrl: string;
  sourceTitle?: string;
  excerpt: string;
  occurrenceYear?: number;
  isOfficial: boolean;
  confidence: string;
  confidenceScore?: number;
  contentHash?: string;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_add_event_verification_evidence", {
    p_verification_case_id: args.verificationCaseId,
    p_source_snapshot_id: args.sourceSnapshotId ?? null,
    p_proof_kind: args.proofKind,
    p_source_kind: args.sourceKind,
    p_source_url: args.sourceUrl,
    p_source_title: args.sourceTitle ?? null,
    p_excerpt: args.excerpt,
    p_occurrence_year: args.occurrenceYear ?? null,
    p_is_official: args.isOfficial,
    p_confidence: args.confidence,
    p_confidence_score: args.confidenceScore ?? null,
    p_content_hash: args.contentHash ?? null,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function transitionEventVerificationCase(args: {
  verificationCaseId: string;
  action: "submit" | "verify" | "reject" | "reopen";
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_transition_event_verification_case", {
    p_verification_case_id: args.verificationCaseId,
    p_action: args.action,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}
