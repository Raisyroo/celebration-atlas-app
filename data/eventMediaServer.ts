import 'server-only';

import { getEventFlyer } from './eventFlyers';
import { resolveEventFlyerMedia, type ResolvedEventMedia } from './eventMedia';
import { getCanonicalEventSlug } from './eventCanonicalSlugs';
import type { EventFlyerResolution, EventFlyerResolutionMap } from './eventMediaResolutionTypes';

const APPROVED_FLYER_SELECT = 'public_url,storage_bucket,storage_path,title,alt_text';
const OFFICIAL_URL_FIELDS = ['official_url', 'official_site', 'website_url'] as const;

type SupabaseEventMediaRow = {
  public_url?: unknown;
  storage_bucket?: unknown;
  storage_path?: unknown;
  title?: unknown;
  alt_text?: unknown;
};

type SupabaseOfficialUrlRow = Record<string, unknown>;

type ResolvedOfficialUrl = {
  url: `https://${string}`;
  field: (typeof OFFICIAL_URL_FIELDS)[number];
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

async function lookupOfficialEventUrl(canonicalSlug: string): Promise<ResolvedOfficialUrl | undefined> {
  const config = getSupabaseConfig();
  if (!config) return undefined;

  for (const field of OFFICIAL_URL_FIELDS) {
    const requestUrl = new URL('/rest/v1/events', config.url);
    requestUrl.searchParams.set('select', `slug,${field}`);
    requestUrl.searchParams.set('slug', `eq.${canonicalSlug}`);
    requestUrl.searchParams.set('limit', '1');

    try {
      const response = await fetch(requestUrl, {
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
        },
        cache: 'no-store',
      });

      if (!response.ok) continue;

      const rows = (await response.json()) as SupabaseOfficialUrlRow[];
      const candidate = rows[0]?.[field];

      if (isHttpsUrl(candidate)) {
        return { url: candidate as `https://${string}`, field };
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

export async function resolveEventFlyerMediaServer(
  event: { id: string; flyerSrc?: string },
): Promise<EventFlyerResolution | undefined> {
  const canonicalSlug = getCanonicalEventSlug(event);
  const [supabaseFlyer, officialUrl] = await Promise.all([
    lookupApprovedSupabaseFlyer(canonicalSlug),
    lookupOfficialEventUrl(canonicalSlug),
  ]);

  if (supabaseFlyer) {
    return {
      ...supabaseFlyer,
      eventId: event.id,
      fallbackUsed: false,
      fallback: getEventFlyer(event.id),
      canonicalSlug,
      officialUrl: officialUrl?.url,
      officialUrlField: officialUrl?.field,
    };
  }

  const localFallback = resolveEventFlyerMedia(event, getEventFlyer(event.id));
  return localFallback
    ? {
        ...localFallback,
        canonicalSlug,
        officialUrl: officialUrl?.url,
        officialUrlField: officialUrl?.field,
      }
    : undefined;
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
