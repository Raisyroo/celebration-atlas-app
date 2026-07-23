import 'server-only';
import { gzipSync } from 'node:zlib';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';
import { captureOfficialEventSource } from './officialSourceInspection';
import {
  claimsFromInspection,
  inferEventSourceKind,
  type EventSourceKind,
} from './sourceBundlePayload';
import { selectBoundedOfficialSourceLinks } from './sourceCollection';
import { collectDynamicSchedule } from './dynamicSchedule';
import type {
  EventSourceCollectionSummary,
  EventSourceBundleSummary,
  EventSourceBundleStatus,
  OfficialEventSourceInspection,
} from './types';

export type { EventSourceBundleSummary, EventSourceBundleStatus } from './types';

export const EVENT_SOURCE_ARCHIVE_BUCKET = 'event-source-archive';

type BundleRow = {
  bundle_id: string;
  name: string;
  status: EventSourceBundleStatus;
  event_key: string | null;
  candidate_id: string | null;
  event_page_version_id: string | null;
  source_count: number | string;
  claim_count: number | string;
  unresolved_claim_count: number | string;
  discovered_link_count: number | string;
  inspected_link_count: number | string;
  schedule_candidate_count: number | string;
  created_by: string;
  created_at: string;
  updated_at: string;
  ready_at: string | null;
};

type ScheduleDateClaimRow = {
  id: string;
  field_path: string;
  value: unknown;
};

function requireServiceClient() {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error('Atlas Control Plane configuration is incomplete.');
  return supabase;
}

function firstRpcRow(data: unknown): Record<string, unknown> {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') throw new Error('Source bundle operation returned no result.');
  return row as Record<string, unknown>;
}

function dateClaimValue(value: unknown) {
  const candidate = typeof value === 'string' ? value : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : '';
}

async function loadBundleScheduleDateBasis(
  supabase: ReturnType<typeof requireServiceClient>,
  bundleId: string,
) {
  const { data, error } = await supabase
    .from('event_source_claims')
    .select('id,field_path,value')
    .eq('bundle_id', bundleId)
    .in('field_path', ['timing.startDate', 'timing.endDate'])
    .in('review_status', ['unreviewed', 'accepted'])
    .order('confidence_score', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return null;

  const rows = (data ?? []) as ScheduleDateClaimRow[];
  const startClaim = rows.find((row) => row.field_path === 'timing.startDate' && dateClaimValue(row.value));
  const endClaim = rows.find((row) => row.field_path === 'timing.endDate' && dateClaimValue(row.value));
  const startDate = dateClaimValue(startClaim?.value);
  const endDate = dateClaimValue(endClaim?.value) || startDate;
  if (!startClaim || !startDate || endDate < startDate || startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    return null;
  }
  return {
    startDate,
    endDate,
    startDateClaimId: startClaim.id,
    endDateClaimId: endClaim?.id ?? startClaim.id,
  };
}

export async function listEventSourceBundles(): Promise<{
  items: EventSourceBundleSummary[];
  error: string | null;
}> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return { items: [], error: 'Atlas Control Plane configuration is incomplete.' };
  const { data, error } = await supabase.rpc('atlas_list_event_source_bundles', { p_limit: 30 });
  if (error) return { items: [], error: error.message };

  const items = ((data ?? []) as BundleRow[]).map((row) => ({
    id: row.bundle_id,
    name: row.name,
    status: row.status,
    eventKey: row.event_key,
    candidateId: row.candidate_id,
    eventPageVersionId: row.event_page_version_id,
    sourceCount: Number(row.source_count),
    claimCount: Number(row.claim_count),
    unresolvedClaimCount: Number(row.unresolved_claim_count),
    discoveredLinkCount: Number(row.discovered_link_count),
    inspectedLinkCount: Number(row.inspected_link_count),
    scheduleCandidateCount: Number(row.schedule_candidate_count),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    readyAt: row.ready_at,
  }));
  return { items, error: null };
}

export async function createEventSourceBundle(args: {
  name: string;
  eventKey?: string;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_create_event_source_bundle', {
    p_name: args.name,
    p_event_key: args.eventKey ?? null,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data) as Record<string, unknown> & { bundle_id: string };
}

export async function captureEventSourceToBundle(args: {
  bundleId: string;
  sourceUrl: string;
  sourceKind?: EventSourceKind;
  includeEventIdentity?: boolean;
  includeEventDescription?: boolean;
  includeEventLocation?: boolean;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const bundle = await supabase
    .from('event_source_bundles')
    .select('id,status')
    .eq('id', args.bundleId)
    .maybeSingle<{ id: string; status: string }>();
  if (bundle.error || !bundle.data || bundle.data.status !== 'collecting') {
    throw new Error('Sources can only be added to an active collecting bundle.');
  }

  const capture = await captureOfficialEventSource(args.sourceUrl);
  const sourceKind = inferEventSourceKind(capture.inspection.finalUrl, args.sourceKind);
  const scheduleDateBasis = sourceKind === 'schedule'
    && (!capture.inspection.candidate.startDate || !capture.inspection.candidate.endDate)
    ? await loadBundleScheduleDateBasis(supabase, args.bundleId)
    : null;
  const scheduleInspection = scheduleDateBasis
    ? {
        ...capture.inspection,
        candidate: {
          ...capture.inspection.candidate,
          startDate: capture.inspection.candidate.startDate || scheduleDateBasis.startDate,
          endDate: capture.inspection.candidate.endDate || scheduleDateBasis.endDate,
        },
      }
    : capture.inspection;
  let scheduleItems: Awaited<ReturnType<typeof collectDynamicSchedule>> = [];
  try {
    scheduleItems = await collectDynamicSchedule({
      inspection: scheduleInspection,
      rawHtml: capture.rawHtml,
      sourceKind,
    });
    if (scheduleDateBasis) {
      scheduleItems = scheduleItems.map((item) => ({
        ...item,
        sourceLocator: {
          ...item.sourceLocator,
          dateBasis: {
            kind: 'bundle_claims',
            startDateClaimId: scheduleDateBasis.startDateClaimId,
            endDateClaimId: scheduleDateBasis.endDateClaimId,
          },
        },
      }));
    }
  } catch {
    capture.inspection.warnings.push('The page exposed a dynamic official schedule, but its structured calendar endpoint needs manual review.');
  }
  const archive = gzipSync(Buffer.from(capture.rawHtml, 'utf8'), { level: 9 });
  if (archive.byteLength > 3_000_000) throw new Error('Compressed source archive exceeds the private bucket limit.');
  const storagePath = `bundles/${args.bundleId}/${capture.contentHash}.html.gz`;
  const upload = await supabase.storage
    .from(EVENT_SOURCE_ARCHIVE_BUCKET)
    .upload(storagePath, archive, {
      contentType: 'application/gzip',
      cacheControl: '0',
      upsert: true,
    });
  if (upload.error) throw new Error(upload.error.message);

  const { data, error } = await supabase.rpc('atlas_add_event_source_snapshot', {
    p_bundle_id: args.bundleId,
    p_source_url: capture.inspection.requestedUrl,
    p_final_url: capture.inspection.finalUrl,
    p_canonical_url: capture.inspection.canonicalUrl,
    p_source_kind: sourceKind,
    p_page_title: capture.inspection.candidate.sourceName,
    p_content_hash: capture.contentHash,
    p_storage_bucket: EVENT_SOURCE_ARCHIVE_BUCKET,
    p_storage_path: storagePath,
    p_content_type: capture.contentType,
    p_content_encoding: 'gzip',
    p_downloaded_bytes: capture.downloadedBytes,
    p_inspection: capture.inspection,
    p_fetch_metadata: capture.fetchMetadata,
    p_claims: claimsFromInspection(capture.inspection, {
      sourceKind,
      includeEventIdentity: args.includeEventIdentity,
      includeEventDescription: args.includeEventDescription,
      includeEventLocation: args.includeEventLocation,
    }),
    p_links: capture.inspection.usefulLinks,
    p_schedule_items: scheduleItems,
    p_fetched_at: capture.inspection.fetchedAt,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return { result: firstRpcRow(data), inspection: capture.inspection };
}

export async function collectRelatedEventSources(args: {
  bundleId: string;
  seedInspection: OfficialEventSourceInspection;
  actorIdentity: string;
  maxRelatedSources?: number;
}): Promise<EventSourceCollectionSummary> {
  const links = selectBoundedOfficialSourceLinks(
    args.seedInspection,
    args.maxRelatedSources ?? 5,
  );
  const summary: EventSourceCollectionSummary = {
    attempted: links.length,
    added: 0,
    reused: 0,
    failures: [],
  };

  for (const link of links) {
    try {
      const capture = await captureEventSourceToBundle({
        bundleId: args.bundleId,
        sourceUrl: link.url,
        sourceKind: link.kind,
        actorIdentity: args.actorIdentity,
      });
      if (capture.result.created === false) summary.reused += 1;
      else summary.added += 1;
    } catch (error) {
      summary.failures.push({
        ...link,
        message: error instanceof Error ? error.message.slice(0, 300) : 'Source capture failed.',
      });
    }
  }

  return summary;
}

export async function transitionEventSourceBundle(args: {
  bundleId: string;
  action: 'ready' | 'reopen' | 'archive';
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_transition_event_source_bundle', {
    p_bundle_id: args.bundleId,
    p_action: args.action,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

export async function attachEventSourceBundleCandidate(args: {
  bundleId: string;
  candidateId: string;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc('atlas_attach_event_source_bundle_candidate', {
    p_bundle_id: args.bundleId,
    p_candidate_id: args.candidateId,
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}
