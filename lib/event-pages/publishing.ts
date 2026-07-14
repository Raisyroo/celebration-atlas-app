import 'server-only';
import { createHash } from 'node:crypto';
import type { EventPageManifest } from '@/data/eventPageManifestTypes';
import {
  stableStringifyEventPageManifest,
  validateEventPageManifest,
} from '@/data/eventPageManifestValidation';
import { getEventPageManifest } from '@/data/eventPageManifests';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';

export type EventPageVersionStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'rejected'
  | 'archived';

export type EventPageVersionSummary = {
  id: string;
  eventPageId: string;
  eventKey: string;
  slug: string;
  versionNumber: number;
  schemaVersion: number;
  status: EventPageVersionStatus;
  isValid: boolean;
  sourceKind: string;
  changeSummary: string | null;
  reviewNotes: string | null;
  createdBy: string;
  reviewedBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

type EventPageVersionRow = {
  id: string;
  event_page_id: string;
  version_number: number;
  schema_version: number;
  status: EventPageVersionStatus;
  is_valid: boolean;
  source_kind: string;
  change_summary: string | null;
  review_notes: string | null;
  created_by: string;
  reviewed_by: string | null;
  published_by: string | null;
  created_at: string;
  reviewed_at: string | null;
  published_at: string | null;
  event_pages: { event_key: string; slug: string } | Array<{ event_key: string; slug: string }>;
};

type RpcTableResult = Record<string, unknown>;

function firstRpcRow(data: unknown): RpcTableResult {
  const value = Array.isArray(data) ? data[0] : data;
  if (!value || typeof value !== 'object') throw new Error('Event page operation returned no result.');
  return value as RpcTableResult;
}

function requireServiceClient() {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error('Atlas Control Plane configuration is incomplete.');
  return supabase;
}

function eventPageContentHash(manifest: EventPageManifest) {
  return createHash('sha256')
    .update(stableStringifyEventPageManifest(manifest))
    .digest('hex');
}

export async function listEventPageVersions(): Promise<{
  items: EventPageVersionSummary[];
  error: string | null;
}> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return { items: [], error: 'Atlas Control Plane configuration is incomplete.' };

  const { data, error } = await supabase
    .from('event_page_versions')
    .select(
      'id,event_page_id,version_number,schema_version,status,is_valid,source_kind,change_summary,review_notes,created_by,reviewed_by,published_by,created_at,reviewed_at,published_at,event_pages!inner(event_key,slug)',
    )
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return { items: [], error: error.message };

  const items = ((data ?? []) as unknown as EventPageVersionRow[]).map((row) => {
    const page = Array.isArray(row.event_pages) ? row.event_pages[0] : row.event_pages;
    return {
      id: row.id,
      eventPageId: row.event_page_id,
      eventKey: page.event_key,
      slug: page.slug,
      versionNumber: row.version_number,
      schemaVersion: row.schema_version,
      status: row.status,
      isValid: row.is_valid,
      sourceKind: row.source_kind,
      changeSummary: row.change_summary,
      reviewNotes: row.review_notes,
      createdBy: row.created_by,
      reviewedBy: row.reviewed_by,
      publishedBy: row.published_by,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
      publishedAt: row.published_at,
    };
  });

  return { items, error: null };
}

export async function createEventPageDraft(args: {
  eventId: string;
  actorIdentity: string;
  changeSummary?: string;
  sourceKind?: 'local_seed' | 'operator' | 'import' | 'ai_assisted';
}) {
  const manifest = getEventPageManifest(args.eventId);
  if (!manifest) throw new Error(`No local Event Hub manifest exists for ${args.eventId}.`);
  return createEventPageDraftFromManifest({
    manifest,
    actorIdentity: args.actorIdentity,
    changeSummary: args.changeSummary,
    sourceKind: args.sourceKind,
  });
}

export async function createEventPageDraftFromManifest(args: {
  manifest: EventPageManifest;
  actorIdentity: string;
  changeSummary?: string;
  sourceKind?: 'local_seed' | 'operator' | 'import' | 'ai_assisted';
}) {
  const { manifest } = args;
  const validation = validateEventPageManifest(manifest);
  if (!validation.ok) {
    throw new Error(`Manifest validation failed: ${validation.errors.join(' ')}`);
  }

  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_create_event_page_draft', {
    p_event_key: manifest.eventId,
    p_slug: manifest.slug,
    p_schema_version: manifest.schemaVersion,
    p_manifest: manifest,
    p_content_hash: eventPageContentHash(manifest),
    p_validation_report: { errors: [], warnings: validation.warnings },
    p_source_kind: args.sourceKind ?? 'local_seed',
    p_change_summary: args.changeSummary ?? null,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function submitEventPageVersion(versionId: string, actorIdentity: string) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_submit_event_page_version', {
    p_version_id: versionId,
    p_actor_identity: actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function reviewEventPageVersion(args: {
  versionId: string;
  actorIdentity: string;
  decision: 'approve' | 'reject';
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_review_event_page_version', {
    p_version_id: args.versionId,
    p_actor_identity: args.actorIdentity,
    p_decision: args.decision,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function publishEventPageVersion(versionId: string, actorIdentity: string) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_publish_event_page_version', {
    p_version_id: versionId,
    p_actor_identity: actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data) as RpcTableResult & { slug: string };
}
