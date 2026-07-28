import type { AtlasCategory, AtlasEvent } from './events.ts';
import {
  isStateAtlasDatabaseValue,
  isValidIanaTimeZone,
  resolveStateAtlasRegionAtmosphere,
  type StateAtlasConfig,
} from './stateAtlasConfig.ts';

export const PUBLISHED_ATLAS_DISCOVERY_SCHEMA_VERSION = 1;

export type PublishedAtlasDiscoveryRow = {
  canonical_event_id: string;
  slug: string;
  event_name: string;
  manifest_name: string | null;
  manifest_short_name: string | null;
  manifest_location: string | null;
  city: string | null;
  state: string;
  event_type: string;
  category: string | null;
  subcategory: string | null;
  short_description: string | null;
  official_url: string | null;
  latitude: number;
  longitude: number;
  location_source: string | null;
  lifecycle_state: string;
  verification_state: string;
  starts_on: string;
  ends_on: string | null;
  time_zone: string | null;
  package_id: string;
  package_version: number;
  target_year: number;
  package_status: string;
  package_published_at: string | null;
  event_page_version_id: string;
  event_page_version_number: number;
  event_page_version_status: string;
  event_page_published_at: string | null;
  thumbnail_url: string | null;
  thumbnail_alt: string | null;
};

export type PublishedAtlasDiscoveryPayload = {
  schemaVersion: typeof PUBLISHED_ATLAS_DISCOVERY_SCHEMA_VERSION;
  items: PublishedAtlasDiscoveryRow[];
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function optionalString(value: unknown): string | null {
  return value === null || value === undefined ? null : requiredString(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveInteger(value: unknown): number | null {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function isDateOnly(value: string | null): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isHttpsUrl(value: string | null): value is `https://${string}` {
  if (!value) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function parseRow(value: unknown): PublishedAtlasDiscoveryRow | null {
  const row = record(value);
  if (!row) return null;

  const parsed: PublishedAtlasDiscoveryRow = {
    canonical_event_id: requiredString(row.canonical_event_id) ?? '',
    slug: requiredString(row.slug) ?? '',
    event_name: requiredString(row.event_name) ?? '',
    manifest_name: optionalString(row.manifest_name),
    manifest_short_name: optionalString(row.manifest_short_name),
    manifest_location: optionalString(row.manifest_location),
    city: optionalString(row.city),
    state: requiredString(row.state) ?? '',
    event_type: requiredString(row.event_type) ?? '',
    category: optionalString(row.category),
    subcategory: optionalString(row.subcategory),
    short_description: optionalString(row.short_description),
    official_url: optionalString(row.official_url),
    latitude: finiteNumber(row.latitude) ?? Number.NaN,
    longitude: finiteNumber(row.longitude) ?? Number.NaN,
    location_source: optionalString(row.location_source),
    lifecycle_state: requiredString(row.lifecycle_state) ?? '',
    verification_state: requiredString(row.verification_state) ?? '',
    starts_on: requiredString(row.starts_on) ?? '',
    ends_on: optionalString(row.ends_on),
    time_zone: optionalString(row.time_zone),
    package_id: requiredString(row.package_id) ?? '',
    package_version: positiveInteger(row.package_version) ?? 0,
    target_year: positiveInteger(row.target_year) ?? 0,
    package_status: requiredString(row.package_status) ?? '',
    package_published_at: optionalString(row.package_published_at),
    event_page_version_id: requiredString(row.event_page_version_id) ?? '',
    event_page_version_number: positiveInteger(row.event_page_version_number) ?? 0,
    event_page_version_status: requiredString(row.event_page_version_status) ?? '',
    event_page_published_at: optionalString(row.event_page_published_at),
    thumbnail_url: optionalString(row.thumbnail_url),
    thumbnail_alt: optionalString(row.thumbnail_alt),
  };

  if (
    !parsed.canonical_event_id
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(parsed.slug)
    || !parsed.event_name
    || !parsed.event_type
    || !Number.isFinite(parsed.latitude)
    || !Number.isFinite(parsed.longitude)
    || parsed.lifecycle_state !== 'active'
    || parsed.verification_state !== 'verified'
    || !isDateOnly(parsed.starts_on)
    || (parsed.ends_on !== null && !isDateOnly(parsed.ends_on))
    || !parsed.package_id
    || parsed.package_version < 1
    || parsed.target_year < 2000
    || parsed.package_status !== 'published'
    || !parsed.event_page_version_id
    || parsed.event_page_version_number < 1
    || parsed.event_page_version_status !== 'published'
  ) {
    return null;
  }

  return parsed;
}

export function parsePublishedAtlasDiscoveryPayload(
  value: unknown,
): PublishedAtlasDiscoveryPayload | null {
  const payload = record(value);
  if (
    payload?.schemaVersion !== PUBLISHED_ATLAS_DISCOVERY_SCHEMA_VERSION
    || !Array.isArray(payload.items)
  ) {
    return null;
  }

  return {
    schemaVersion: PUBLISHED_ATLAS_DISCOVERY_SCHEMA_VERSION,
    items: payload.items.flatMap((item) => {
      const parsed = parseRow(item);
      return parsed ? [parsed] : [];
    }),
  };
}

function atlasCategory(row: PublishedAtlasDiscoveryRow): AtlasCategory {
  const category = `${row.category ?? ''} ${row.event_type} ${row.subcategory ?? ''}`.toLowerCase();
  if (/music|concert|jazz/.test(category)) return 'Music';
  if (/fair|carnival/.test(category)) return 'Fairs';
  if (/art|culture|heritage|museum/.test(category)) return 'Arts & Culture';
  return 'Festivals';
}

function iconType(row: PublishedAtlasDiscoveryRow): NonNullable<AtlasEvent['iconType']> {
  const kind = `${row.category ?? ''} ${row.event_type} ${row.subcategory ?? ''}`.toLowerCase();
  if (/music|concert|jazz/.test(kind)) return 'music';
  if (/art/.test(kind)) return 'art';
  if (/food|harvest|agricultur/.test(kind)) return 'harvest';
  if (/water|fish|coast|marina/.test(kind)) return 'waterfront';
  if (/winter|ice|snow/.test(kind)) return 'winter';
  if (/heritage|culture|parade/.test(kind)) return 'heritage';
  return 'fair';
}

export function publishedDiscoveryRowToAtlasEvent(
  config: StateAtlasConfig,
  row: PublishedAtlasDiscoveryRow,
): AtlasEvent | null {
  if (!isStateAtlasDatabaseValue(config, row.state)) return null;

  const name = row.manifest_short_name || row.event_name;
  const category = atlasCategory(row);
  const categoryText = `${row.category ?? ''} ${row.event_type} ${row.subcategory ?? ''}`;
  const thumbnailUrl = requiredString(row.thumbnail_url);
  const officialUrl = isHttpsUrl(row.official_url) ? row.official_url : undefined;

  return {
    id: row.slug,
    name,
    searchAliases: [row.event_name, row.manifest_name].filter(
      (value): value is string => Boolean(value),
    ),
    location: row.city
      ? `${row.city}, ${config.identity.postalCode}`
      : row.manifest_location || config.identity.name,
    latitude: row.latitude,
    longitude: row.longitude,
    coordinateSource: row.location_source
      ? {
          label: 'Approved Event Factory map record',
          url: row.location_source,
          method: 'manual-verification',
        }
      : undefined,
    atmosphereLabel: `${row.city ?? config.identity.name} annual celebration`,
    blurb: row.short_description ?? `${name} published event`,
    category,
    cardTag: row.event_type.replaceAll('_', ' '),
    officialUrl,
    publishedDiscovery: {
      canonicalEventId: row.canonical_event_id,
      lifecycleState: 'active',
      verificationState: 'verified',
      packageId: row.package_id,
      packageVersion: row.package_version,
      targetYear: row.target_year,
      packagePublishedAt: row.package_published_at ?? undefined,
      eventPageVersionId: row.event_page_version_id,
      eventPageVersionNumber: row.event_page_version_number,
      eventPagePublishedAt: row.event_page_published_at ?? undefined,
    },
    eventPageKind: 'manifest',
    iconType: iconType(row),
    x: 50,
    y: 50,
    regionAtmosphere: resolveStateAtlasRegionAtmosphere(config, {
      latitude: row.latitude,
      longitude: row.longitude,
      categoryText,
    }),
    dateRange: {
      startDate: row.starts_on,
      endDate: row.ends_on ?? undefined,
      timeZone: row.time_zone && isValidIanaTimeZone(row.time_zone)
        ? row.time_zone
        : config.defaultTimeZone,
      isEstimated: false,
    },
    cardMedia: thumbnailUrl
      ? {
          thumbnailSrc: thumbnailUrl,
          thumbnailSourceType: 'generated',
          thumbnailGenerationStatus: 'generated',
          thumbnailAlt: row.thumbnail_alt ?? `${name} Celebration Atlas event image`,
        }
      : undefined,
  };
}

export function publishedDiscoveryPayloadToAtlasEvents(
  config: StateAtlasConfig,
  value: unknown,
): AtlasEvent[] | null {
  const payload = parsePublishedAtlasDiscoveryPayload(value);
  if (!payload) return null;

  return payload.items.flatMap((row) => {
    const event = publishedDiscoveryRowToAtlasEvent(config, row);
    return event ? [event] : [];
  });
}
