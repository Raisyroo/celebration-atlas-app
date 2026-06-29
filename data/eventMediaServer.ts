import 'server-only';

import { stat } from 'node:fs/promises';
import path from 'node:path';

import { getEventFlyer, type EventFlyerRecord } from './eventFlyers';
import { resolveEventFlyerMedia, type ResolvedEventMedia } from './eventMedia';
import { getCanonicalEventSlug } from './eventCanonicalSlugs';
import type { EventFlyerResolution, EventFlyerResolutionMap } from './eventMediaResolutionTypes';

const APPROVED_FLYER_SELECT = 'public_url,storage_bucket,storage_path,title,alt_text';

const LOCAL_FLYER_RUNTIME_PREFIX = '/event-media/flyers/';
const LOCAL_FLYER_PUBLIC_ROOT = path.join(process.cwd(), 'public', 'event-media', 'flyers');

type SupabaseEventMediaRow = {
  public_url?: unknown;
  storage_bucket?: unknown;
  storage_path?: unknown;
  title?: unknown;
  alt_text?: unknown;
};

function getSupabaseConfig(): { url: URL; serviceRoleKey: string } | undefined {
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!rawUrl || !serviceRoleKey) return undefined;

  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:') return undefined;
    return { url, serviceRoleKey };
  } catch {
    return undefined;
  }
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isStorageValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !value.includes('..');
}

function buildPublicStorageUrl(supabaseUrl: URL, bucket: string, path: string): string {
  const publicUrl = new URL(
    `/storage/v1/object/public/${encodeURIComponent(bucket)}/${path
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/')}`,
    supabaseUrl,
  );

  return publicUrl.toString();
}

function getLocalFlyerPublicPath(src: string): string | undefined {
  if (!src.startsWith(LOCAL_FLYER_RUNTIME_PREFIX)) return undefined;

  const relativeName = src.slice(LOCAL_FLYER_RUNTIME_PREFIX.length);
  const normalizedRelativeName = path.posix.normalize(relativeName);

  if (
    !relativeName ||
    path.isAbsolute(relativeName) ||
    path.win32.isAbsolute(relativeName) ||
    relativeName.includes('\\') ||
    normalizedRelativeName === '.' ||
    normalizedRelativeName.startsWith('../') ||
    normalizedRelativeName.includes('/../')
  ) {
    return undefined;
  }

  return path.join(LOCAL_FLYER_PUBLIC_ROOT, normalizedRelativeName);
}

async function localFlyerExists(fallback?: EventFlyerRecord): Promise<boolean> {
  if (!fallback || fallback.assetMode !== 'local') return false;
  const publicPath = getLocalFlyerPublicPath(fallback.src);
  if (!publicPath) return false;

  try {
    const fileStat = await stat(publicPath);
    return fileStat.isFile();
  } catch {
    return false;
  }
}

async function getValidLocalFlyerFallback(
  eventId: string,
): Promise<EventFlyerRecord | undefined> {
  const fallback = getEventFlyer(eventId);
  return (await localFlyerExists(fallback)) ? fallback : undefined;
}

export async function getEventFlyerDiagnostics(event: {
  id: string;
  flyerSrc?: string;
}) {
  const catalogFallback = getEventFlyer(event.id);
  const fallbackExists = await localFlyerExists(catalogFallback);
  const resolved = await resolveEventFlyerMediaServer(event);

  return {
    resolved,
    fallbackSrc: catalogFallback?.src,
    fallbackSource: catalogFallback?.assetMode,
    fallbackExists,
    fallbackPublicPath:
      catalogFallback?.assetMode === 'local'
        ? getLocalFlyerPublicPath(catalogFallback.src)
        : undefined,
  };
}

async function lookupApprovedSupabaseFlyer(
  canonicalSlug: string,
): Promise<Omit<ResolvedEventMedia, 'eventId' | 'fallbackUsed'> | undefined> {
  const config = getSupabaseConfig();
  if (!config) return undefined;

  const requestUrl = new URL('/rest/v1/event_media', config.url);
  requestUrl.searchParams.set('select', `${APPROVED_FLYER_SELECT},events!inner(slug)`);
  requestUrl.searchParams.set('media_role', 'eq.flyer');
  requestUrl.searchParams.set('status', 'eq.approved');
  requestUrl.searchParams.set('source', 'eq.supabase');
  requestUrl.searchParams.set('events.slug', `eq.${canonicalSlug}`);
  requestUrl.searchParams.set('limit', '1');

  try {
    const response = await fetch(requestUrl, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return undefined;

    const rows = (await response.json()) as SupabaseEventMediaRow[];
    const row = rows[0];
    if (!row) return undefined;

    const src = isHttpsUrl(row.public_url)
      ? row.public_url
      : isStorageValue(row.storage_bucket) && isStorageValue(row.storage_path)
        ? buildPublicStorageUrl(config.url, row.storage_bucket, row.storage_path)
        : undefined;

    if (!src) return undefined;

    return {
      mediaRole: 'flyer',
      src,
      source: 'supabase',
      record: {
        eventId: canonicalSlug,
        mediaRole: 'flyer',
        source: 'supabase',
        url: src,
        storagePath: isStorageValue(row.storage_path) ? row.storage_path : undefined,
        title: typeof row.title === 'string' ? row.title : undefined,
        altText: typeof row.alt_text === 'string' ? row.alt_text : undefined,
        status: 'approved',
      },
      title: typeof row.title === 'string' ? row.title : undefined,
      altText: typeof row.alt_text === 'string' ? row.alt_text : undefined,
    };
  } catch {
    return undefined;
  }
}

export async function resolveEventFlyerMediaServer(
  event: { id: string; flyerSrc?: string },
): Promise<EventFlyerResolution | undefined> {
  const canonicalSlug = getCanonicalEventSlug(event);
  const supabaseFlyer = await lookupApprovedSupabaseFlyer(canonicalSlug);
  const validLocalFallback = await getValidLocalFlyerFallback(event.id);

  if (supabaseFlyer) {
    return {
      ...supabaseFlyer,
      eventId: event.id,
      fallbackUsed: false,
      fallback: validLocalFallback,
      canonicalSlug,
    };
  }

  const localFallback = resolveEventFlyerMedia(event, validLocalFallback);
  return localFallback ? { ...localFallback, canonicalSlug } : undefined;
}

export async function resolveEventFlyerMediaMapServer(
  events: readonly { id: string; flyerSrc?: string }[],
): Promise<EventFlyerResolutionMap> {
  const entries = await Promise.all(
    events.map(async (event) => [event.id, await resolveEventFlyerMediaServer(event)] as const),
  );

  return Object.fromEntries(
    entries.filter((entry): entry is readonly [string, EventFlyerResolution] => Boolean(entry[1])),
  );
}
