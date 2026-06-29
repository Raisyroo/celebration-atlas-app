export const CELEBRATION_ATLAS_MEDIA_BUCKET = 'celebration-atlas-media';

export const BROWN_TROUT_MEDIA_PATHS = {
  flyer: 'events/brown-trout-festival/flyer/',
  fishingTournamentCard: 'events/brown-trout-festival/cards/fishing-tournament/',
  musicScheduleCard: 'events/brown-trout-festival/cards/music-schedule/',
  thumbnail: 'events/brown-trout-festival/thumbnails/',
} as const;

export type AtlasEventMediaRole =
  | 'flyer'
  | 'thumbnail'
  | 'hero'
  | 'event-card'
  | 'gallery'
  | 'map-art'
  | 'brand';

export type AtlasEventMediaSource = 'supabase' | 'local';
export type AtlasEventMediaStatus = 'draft' | 'approved' | 'archived';

export type AtlasEventMediaRecord = {
  eventId: string;
  mediaRole: AtlasEventMediaRole;
  source: AtlasEventMediaSource;
  url?: string;
  storagePath?: string;
  title?: string;
  altText?: string;
  sortOrder?: number;
  status?: AtlasEventMediaStatus;
  updatedAt?: string;
  version?: string;
};

export type ResolvedEventMedia = {
  eventId: string;
  mediaRole: AtlasEventMediaRole;
  src: string;
  source: AtlasEventMediaSource;
  record?: AtlasEventMediaRecord;
  fallbackUsed: boolean;
  fallback?: { src: string };
  title?: string;
  altText?: string;
};

export const EVENT_MEDIA_RECORDS = [
  {
    eventId: 'alpena-brown-trout',
    mediaRole: 'flyer',
    source: 'supabase',
    storagePath: `${BROWN_TROUT_MEDIA_PATHS.flyer}README-paste-approved-flyer-path-here`,
    title: 'Brown Trout Festival flyer Supabase pilot placeholder',
    altText: 'Brown Trout Festival flyer',
    sortOrder: 10,
    status: 'draft',
    updatedAt: '2026-06-29',
    version: 'pilot-placeholder',
  },
  {
    eventId: 'alpena-brown-trout',
    mediaRole: 'event-card',
    source: 'supabase',
    storagePath: `${BROWN_TROUT_MEDIA_PATHS.fishingTournamentCard}README-paste-approved-card-path-here`,
    title: 'Brown Trout fishing tournament Event Card placeholder',
    altText: 'Brown Trout Festival fishing tournament Event Card',
    sortOrder: 20,
    status: 'draft',
    updatedAt: '2026-06-29',
    version: 'pilot-placeholder',
  },
  {
    eventId: 'alpena-brown-trout',
    mediaRole: 'event-card',
    source: 'supabase',
    storagePath: `${BROWN_TROUT_MEDIA_PATHS.musicScheduleCard}README-paste-approved-card-path-here`,
    title: 'Brown Trout music schedule Event Card placeholder',
    altText: 'Brown Trout Festival music schedule Event Card',
    sortOrder: 30,
    status: 'draft',
    updatedAt: '2026-06-29',
    version: 'pilot-placeholder',
  },
  {
    eventId: 'alpena-brown-trout',
    mediaRole: 'thumbnail',
    source: 'supabase',
    storagePath: `${BROWN_TROUT_MEDIA_PATHS.thumbnail}README-paste-approved-thumbnail-path-here`,
    title: 'Brown Trout thumbnail placeholder',
    altText: 'Brown Trout Festival thumbnail',
    sortOrder: 40,
    status: 'draft',
    updatedAt: '2026-06-29',
    version: 'pilot-placeholder',
  },
] as const satisfies AtlasEventMediaRecord[];

function isApprovedSupabaseMedia(record: AtlasEventMediaRecord): boolean {
  return record.source === 'supabase' && record.status === 'approved' && Boolean(record.url);
}

export function getEventMediaRecords(eventId: string, mediaRole?: AtlasEventMediaRole): AtlasEventMediaRecord[] {
  return EVENT_MEDIA_RECORDS.filter(
    (record) => record.eventId === eventId && (!mediaRole || record.mediaRole === mediaRole),
  ).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function resolveEventMedia(
  event: { id: string },
  mediaRole: AtlasEventMediaRole,
  fallbackSrc?: string,
  fallback?: { src: string },
): ResolvedEventMedia | undefined {
  const approvedSupabaseRecord = getEventMediaRecords(event.id, mediaRole).find(isApprovedSupabaseMedia);

  if (approvedSupabaseRecord?.url) {
    return {
      eventId: event.id,
      mediaRole,
      src: approvedSupabaseRecord.url,
      source: 'supabase',
      record: approvedSupabaseRecord,
      fallbackUsed: false,
      title: approvedSupabaseRecord.title,
      altText: approvedSupabaseRecord.altText,
    };
  }

  const localSrc = fallback?.src ?? fallbackSrc;

  if (!localSrc) return undefined;

  return {
    eventId: event.id,
    mediaRole,
    src: localSrc,
    source: 'local',
    fallbackUsed: true,
    fallback,
    title: fallback ? `${event.id} local flyer fallback` : undefined,
  };
}

export function resolveEventFlyerMedia(
  event: { id: string; flyerSrc?: string },
  fallback?: { src: string },
): ResolvedEventMedia | undefined {
  return resolveEventMedia(event, 'flyer', event.flyerSrc, fallback);
}
