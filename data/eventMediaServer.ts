import 'server-only';

import { getEventFlyer } from './eventFlyers';
import { CELEBRATION_ATLAS_MEDIA_BUCKET, resolveEventFlyerMedia, type ResolvedEventMedia } from './eventMedia';
import { getCanonicalEventSlug } from './eventCanonicalSlugs';
import {
  OFFICIAL_EVENT_URL_FIELDS,
  diagnoseOfficialEventUrl,
  selectOfficialEventUrl,
  type OfficialEventSourceRejectionReason,
  type OfficialEventSourceRow,
  type ResolvedOfficialEventUrl,
} from './officialEventUrl';
import type { EventFlyerResolution, EventFlyerResolutionMap } from './eventMediaResolutionTypes';

const APPROVED_FLYER_SELECT = 'media_role,public_url,storage_bucket,storage_path,title,alt_text,sort_order';

const CURATED_EVENT_CARD_DECKS = {
  'alpena-brown-trout': [
    {
      mediaRole: 'event-card',
      storagePath: 'alpena-brown-trout/cards/why-go.webp',
      title: 'Brown Trout Festival Why Go card',
      altText: 'Brown Trout Festival Why Go planning card',
      sortOrder: 10,
    },
    {
      mediaRole: 'event-card',
      storagePath: 'alpena-brown-trout/cards/fishing-tournament-schedule.webp',
      title: 'Brown Trout Festival fishing tournament schedule',
      altText: 'Brown Trout Festival fishing tournament schedule card',
      sortOrder: 20,
    },
    {
      mediaRole: 'event-card',
      storagePath: 'alpena-brown-trout/cards/music-tent-schedule.webp',
      title: 'Brown Trout Festival music tent schedule',
      altText: 'Brown Trout Festival music tent schedule card',
      sortOrder: 30,
    },
  ],
} as const;

type SupabaseEventMediaRow = {
  media_role?: unknown;
  public_url?: unknown;
  storage_bucket?: unknown;
  storage_path?: unknown;
  title?: unknown;
  alt_text?: unknown;
  sort_order?: unknown;
};

type SupabaseOfficialUrlRow = Record<string, unknown>;

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

function toResolvedSupabaseMedia(
  config: { url: URL; serviceRoleKey: string },
  canonicalSlug: string,
  row: SupabaseEventMediaRow,
): Omit<ResolvedEventMedia, 'eventId' | 'fallbackUsed'> | undefined {
  const mediaRole = row.media_role === 'event-card' ? 'event-card' : row.media_role === 'flyer' ? 'flyer' : undefined;
  if (!mediaRole) return undefined;

  const src = isHttpsUrl(row.public_url)
    ? row.public_url
    : isStorageValue(row.storage_bucket) && isStorageValue(row.storage_path)
      ? buildPublicStorageUrl(config.url, row.storage_bucket, row.storage_path)
      : undefined;

  if (!src) return undefined;

  return {
    mediaRole,
    src,
    source: 'supabase',
    record: {
      eventId: canonicalSlug,
      mediaRole,
      source: 'supabase',
      url: src,
      storagePath: isStorageValue(row.storage_path) ? row.storage_path : undefined,
      title: typeof row.title === 'string' ? row.title : undefined,
      altText: typeof row.alt_text === 'string' ? row.alt_text : undefined,
      sortOrder: typeof row.sort_order === 'number' ? row.sort_order : undefined,
      status: 'approved',
    },
    title: typeof row.title === 'string' ? row.title : undefined,
    altText: typeof row.alt_text === 'string' ? row.alt_text : undefined,
  };
}

function getSupabasePublicUrl(): URL | undefined {
  const rawUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}

async function lookupApprovedSupabaseDeck(
  canonicalSlug: string,
): Promise<Omit<ResolvedEventMedia, 'eventId' | 'fallbackUsed'>[]> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const requestUrl = new URL('/rest/v1/event_media', config.url);
  requestUrl.searchParams.set('select', `${APPROVED_FLYER_SELECT},events!inner(slug)`);
  requestUrl.searchParams.set('media_role', 'in.(flyer,event-card)');
  requestUrl.searchParams.set('status', 'eq.approved');
  requestUrl.searchParams.set('source', 'eq.supabase');
  requestUrl.searchParams.set('events.slug', `eq.${canonicalSlug}`);
  requestUrl.searchParams.set('order', 'sort_order.asc.nullslast,updated_at.desc');

  try {
    const response = await fetch(requestUrl, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return [];

    const rows = (await response.json()) as SupabaseEventMediaRow[];
    return rows.flatMap((row) => {
      const media = toResolvedSupabaseMedia(config, canonicalSlug, row);
      return media ? [media] : [];
    });
  } catch {
    return [];
  }
}

function getCuratedSupabaseDeckFallback(
  canonicalSlug: string,
): Omit<ResolvedEventMedia, 'eventId' | 'fallbackUsed'>[] {
  const supabaseUrl = getSupabasePublicUrl();
  const cards = CURATED_EVENT_CARD_DECKS[canonicalSlug as keyof typeof CURATED_EVENT_CARD_DECKS];
  if (!supabaseUrl || !cards?.length) return [];

  return cards.map((card) => {
    const src = buildPublicStorageUrl(supabaseUrl, CELEBRATION_ATLAS_MEDIA_BUCKET, card.storagePath);

    return {
      mediaRole: card.mediaRole,
      src,
      source: 'supabase',
      record: {
        eventId: canonicalSlug,
        mediaRole: card.mediaRole,
        source: 'supabase',
        url: src,
        storagePath: card.storagePath,
        title: card.title,
        altText: card.altText,
        sortOrder: card.sortOrder,
        status: 'approved',
      },
      title: card.title,
      altText: card.altText,
    };
  });
}

async function lookupOfficialUrlFromEvents(canonicalSlug: string): Promise<SupabaseOfficialUrlRow | undefined> {
  const config = getSupabaseConfig();
  if (!config) return undefined;

  for (const field of OFFICIAL_EVENT_URL_FIELDS) {
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
      if (isHttpsUrl(rows[0]?.[field])) return rows[0];
    } catch {
      continue;
    }
  }

  return undefined;
}

async function lookupOfficialUrlFromEventSources(
  canonicalSlug: string,
): Promise<OfficialEventSourceRow[]> {
  const config = getSupabaseConfig();
  if (!config) return [];

  const requestUrl = new URL('/rest/v1/event_sources', config.url);
  requestUrl.searchParams.set('select', '*,events!inner(slug)');
  requestUrl.searchParams.set('events.slug', `eq.${canonicalSlug}`);

  try {
    const response = await fetch(requestUrl, {
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) return [];

    return (await response.json()) as OfficialEventSourceRow[];
  } catch {
    return [];
  }
}

async function lookupOfficialEventUrl(
  canonicalSlug: string,
): Promise<{ officialUrl?: ResolvedOfficialEventUrl; debug: { sourcePath: 'events' | 'event_sources' | 'none'; rejectedReasons: OfficialEventSourceRejectionReason[] } }> {
  const [eventsRow, eventSourceRows] = await Promise.all([
    lookupOfficialUrlFromEvents(canonicalSlug),
    lookupOfficialUrlFromEventSources(canonicalSlug),
  ]);

  const officialUrl = selectOfficialEventUrl(eventsRow, eventSourceRows);
  const diagnostics = diagnoseOfficialEventUrl(eventsRow, eventSourceRows);

  return {
    officialUrl,
    debug: {
      sourcePath: diagnostics.sourcePath,
      rejectedReasons: diagnostics.eventSourceRejectedReasons,
    },
  };
}

export async function resolveEventFlyerMediaServer(
  event: { id: string; flyerSrc?: string },
): Promise<EventFlyerResolution | undefined> {
  const canonicalSlug = getCanonicalEventSlug(event);
  const [supabaseDeck, officialUrlResolution] = await Promise.all([
    lookupApprovedSupabaseDeck(canonicalSlug),
    lookupOfficialEventUrl(canonicalSlug),
  ]);
  const resolvedSupabaseDeck = supabaseDeck.length
    ? supabaseDeck
    : getCuratedSupabaseDeckFallback(canonicalSlug);
  const supabaseFlyer = resolvedSupabaseDeck[0];

  if (supabaseFlyer) {
    return {
      ...supabaseFlyer,
      eventId: event.id,
      fallbackUsed: false,
      fallback: getEventFlyer(event.id),
      deck: resolvedSupabaseDeck.map((card) => ({
        ...card,
        eventId: event.id,
        fallbackUsed: false,
      })),
      canonicalSlug,
      officialUrl: officialUrlResolution.officialUrl?.url,
      officialUrlSource: officialUrlResolution.officialUrl?.source,
      officialUrlField: officialUrlResolution.officialUrl?.field,
      officialUrlDebug: officialUrlResolution.debug,
    };
  }

  const localFallback = resolveEventFlyerMedia(event, getEventFlyer(event.id));
  return localFallback
    ? {
        ...localFallback,
        canonicalSlug,
        officialUrl: officialUrlResolution.officialUrl?.url,
        officialUrlSource: officialUrlResolution.officialUrl?.source,
        officialUrlField: officialUrlResolution.officialUrl?.field,
        officialUrlDebug: officialUrlResolution.debug,
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
