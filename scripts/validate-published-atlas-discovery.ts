import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import type { EventProfile } from '../data/eventProfileTypes.ts';
import { resolveHomeAtlasDiscovery } from '../data/homeAtlasDiscovery.ts';
import { searchHomeAtlas } from '../data/homeAtlasSearch.ts';
import {
  parsePublishedAtlasDiscoveryPayload,
  publishedDiscoveryPayloadToAtlasEvents,
  type PublishedAtlasDiscoveryPayload,
  type PublishedAtlasDiscoveryRow,
} from '../data/publishedAtlasDiscovery.ts';
import { MICHIGAN_HOME_ATLAS_SEARCH_RULES } from '../data/stateAtlasSearchRules.ts';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig.ts';
import { reconcileStateAtlasEvents } from '../data/stateAtlasEvents.ts';
import type { AtlasEvent } from '../data/events.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) =>
  fs.readFileSync(path.join(root, relativePath), 'utf8');

const baseRow: PublishedAtlasDiscoveryRow = {
  canonical_event_id: '10000000-0000-4000-8000-000000000001',
  slug: 'armada-fair',
  event_name: 'Armada Fair',
  manifest_name: 'Armada Fair',
  manifest_short_name: 'Armada Fair',
  manifest_location: 'Armada, Michigan',
  city: 'Armada',
  state: 'Michigan',
  event_type: 'county_fair',
  category: 'fair',
  subcategory: 'agriculture',
  short_description: 'Classic fair rides, livestock showcases, and local midway favorites.',
  official_url: 'https://www.armadafair.org/',
  latitude: 42.8442,
  longitude: -82.8841,
  location_source: 'https://www.openstreetmap.org/',
  lifecycle_state: 'active',
  verification_state: 'verified',
  starts_on: '2026-08-17',
  ends_on: '2026-08-23',
  time_zone: 'America/Detroit',
  package_id: '20000000-0000-4000-8000-000000000001',
  package_version: 1,
  target_year: 2026,
  package_status: 'published',
  package_published_at: '2026-07-23T16:00:00.000Z',
  event_page_version_id: '30000000-0000-4000-8000-000000000001',
  event_page_version_number: 1,
  event_page_version_status: 'published',
  event_page_published_at: '2026-07-23T16:00:00.000Z',
  thumbnail_url: 'https://example.supabase.co/storage/v1/object/public/celebration-atlas-media/armada.webp',
  thumbnail_alt: 'Celebration Atlas artwork for Armada Fair',
};

const missingMediaRow: PublishedAtlasDiscoveryRow = {
  ...baseRow,
  canonical_event_id: '10000000-0000-4000-8000-000000000002',
  slug: 'missing-media-festival',
  event_name: 'Missing Media Festival',
  manifest_name: 'Missing Media Festival',
  manifest_short_name: null,
  city: 'Sample City',
  event_type: 'festival',
  category: 'festival',
  subcategory: null,
  official_url: null,
  package_id: '20000000-0000-4000-8000-000000000002',
  event_page_version_id: '30000000-0000-4000-8000-000000000002',
  thumbnail_url: null,
  thumbnail_alt: null,
};

const invalidPublicationRow: PublishedAtlasDiscoveryRow = {
  ...baseRow,
  canonical_event_id: '10000000-0000-4000-8000-000000000003',
  slug: 'private-package-event',
  event_name: 'Private Package Event',
  package_id: '20000000-0000-4000-8000-000000000003',
  package_status: 'approved',
  event_page_version_id: '30000000-0000-4000-8000-000000000003',
};

const rawPayload = {
  schemaVersion: 1,
  items: [baseRow, missingMediaRow, invalidPublicationRow],
};
const parsedPayload = parsePublishedAtlasDiscoveryPayload(rawPayload);
assert(parsedPayload, 'The versioned discovery document should parse');
assert.equal(
  parsedPayload.items.length,
  2,
  'Non-published package rows must fail closed in the application mapper',
);

const databaseEvents = publishedDiscoveryPayloadToAtlasEvents(
  MICHIGAN_STATE_ATLAS_CONFIG,
  rawPayload,
);
assert(databaseEvents, 'The discovery document should map to Atlas events');
assert.equal(databaseEvents.length, 2, 'Both valid published rows should remain discoverable');

const armada = databaseEvents.find((event) => event.id === 'armada-fair');
assert(armada, 'Armada should be present');
assert.deepEqual(
  {
    id: armada.id,
    name: armada.name,
    location: armada.location,
    category: armada.category,
    coordinates: [armada.latitude, armada.longitude],
    dateRange: armada.dateRange,
    officialUrl: armada.officialUrl,
    thumbnail: armada.cardMedia,
    publication: armada.publishedDiscovery,
  },
  {
    id: 'armada-fair',
    name: 'Armada Fair',
    location: 'Armada, MI',
    category: 'Fairs',
    coordinates: [42.8442, -82.8841],
    dateRange: {
      startDate: '2026-08-17',
      endDate: '2026-08-23',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
    officialUrl: 'https://www.armadafair.org/',
    thumbnail: {
      thumbnailSrc: baseRow.thumbnail_url,
      thumbnailSourceType: 'generated',
      thumbnailGenerationStatus: 'generated',
      thumbnailAlt: baseRow.thumbnail_alt,
    },
    publication: {
      canonicalEventId: baseRow.canonical_event_id,
      lifecycleState: 'active',
      verificationState: 'verified',
      packageId: baseRow.package_id,
      packageVersion: 1,
      targetYear: 2026,
      packagePublishedAt: baseRow.package_published_at,
      eventPageVersionId: baseRow.event_page_version_id,
      eventPageVersionNumber: 1,
      eventPagePublishedAt: baseRow.event_page_published_at,
    },
  },
  'The lightweight row should preserve the existing homepage discovery fields',
);

const missingMediaEvent = databaseEvents.find(
  (event) => event.id === 'missing-media-festival',
);
assert(missingMediaEvent, 'Missing optional media must not remove a published event');
assert.equal(
  missingMediaEvent.cardMedia,
  undefined,
  'Missing optional media should use the existing glyph fallback contract',
);

const checkedInFallback: AtlasEvent = {
  id: 'checked-in-transition',
  name: 'Checked-in Transition Event',
  location: 'Fallback, MI',
  latitude: 44,
  longitude: -85,
  atmosphereLabel: 'Checked-in fallback',
  blurb: 'Retained transition manifest fixture.',
  category: 'Festivals',
  x: 50,
  y: 50,
};
const reconciled = reconcileStateAtlasEvents(
  [checkedInFallback],
  databaseEvents,
);
assert(
  reconciled.some((event) => event.id === checkedInFallback.id),
  'Checked-in discovery fallbacks must remain available',
);

const profiles: EventProfile[] = databaseEvents.map((event) => ({
  id: event.id,
  slug: event.id,
  name: event.name,
  alternateNames: event.searchAliases,
  shortDescription: event.blurb,
  eventTypes: [event.cardTag ?? event.category],
  categories: [event.category],
  tags: [],
  city: event.location.split(',')[0]?.trim() ?? event.location,
  region: event.regionAtmosphere,
  state: 'Michigan',
  stateSlug: 'michigan',
  locationName: event.location,
  coordinates: {
    latitude: event.latitude,
    longitude: event.longitude,
    precision: 'exact',
  },
  dateRange: event.dateRange
    ? {
        startDate: event.dateRange.startDate,
        endDate: event.dateRange.endDate,
        timezone: event.dateRange.timeZone,
        isEstimated: event.dateRange.isEstimated,
      }
    : {
        startDate: 'Unknown',
        displayText: 'Unknown',
        isEstimated: true,
      },
  coverageLevel: 'basicNationalCoverage',
  sources: [],
  trust: {
    sourceStatus: 'officialConfirmed',
    confidence: 'high',
    confidenceScore: 1,
  },
}));
const now = new Date('2026-07-28T16:00:00.000Z');
const resultIds = (query: string) =>
  searchHomeAtlas({
    query,
    events: databaseEvents,
    profiles,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
    now,
  }).results.map((result) => result.event.id);

for (const [query, label] of [
  ['Armada Fair', 'exact event'],
  ['Armada', 'city and identity'],
  ['fairs', 'category'],
  ['August', 'reviewed date'],
  ['thumb', 'curated region'],
  ['upcoming', 'live/upcoming status'],
] as const) {
  assert(
    resultIds(query).includes('armada-fair'),
    `The discovery payload must support ${label} matching`,
  );
}

const searchResponse = searchHomeAtlas({
  query: '',
  events: databaseEvents,
  profiles,
  stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
  rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  now,
});
const discoveryResponse = resolveHomeAtlasDiscovery({
  events: databaseEvents,
  profiles,
  stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
  searchRules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  searchResponse,
  filters: {
    category: 'Fairs',
    regionRuleId: 'thumb',
    city: 'Armada',
    date: { kind: 'live-upcoming' },
  },
  now,
});
assert.deepEqual(
  discoveryResponse.events.map((event) => event.id),
  ['armada-fair'],
  'Category, region, city, and live/upcoming discovery filters need no heavy records',
);

const homePageSource = read('app/page.tsx');
const publishedSource = read('lib/events/publishedAtlasEvents.ts');
const atlasMapSource = read('components/AtlasMap.tsx');
const lazyRouteSource = read('app/api/events/[id]/homepage-media/route.ts');
assert(
  !homePageSource.includes('resolveEventFlyerMediaMapServer'),
  'The homepage must not resolve media separately for every event',
);
assert(
  homePageSource.includes('await connection()'),
  'Published discovery must stay request-time instead of becoming a stale prerender',
);
assert.equal(
  publishedSource.match(/\.rpc\(/g)?.length ?? 0,
  1,
  'Database-backed homepage discovery must use one RPC call',
);
assert(
  publishedSource.includes("rpc('atlas_get_published_event_discovery'"),
  'The homepage resolver must use the fixed batched discovery RPC',
);
assert(
  !publishedSource.includes('.from('),
  'The homepage resolver must not add separate table queries around the RPC',
);
assert(
  atlasMapSource.includes('/homepage-media')
    && lazyRouteSource.includes('resolveEventFlyerMediaServer(event)'),
  'Heavy flyer media must be deferred until an event is selected',
);

const migration = read(
  'supabase/migrations/022_batched_published_atlas_discovery.sql',
);
for (const fragment of [
  "package.status = 'published'",
  "version.status = 'published'",
  'version.manifest = package.page_manifest',
  "event.status = 'active'",
  "event.verification_status = 'verified'",
  'event.location_verified = true',
  "set search_path = ''",
  'from public, anon, authenticated',
  'to service_role',
]) {
  assert(migration.includes(fragment), `Migration 022 is missing: ${fragment}`);
}
assert(!/\bselect\s+\*/i.test(migration), 'Migration 022 must use explicit columns');

const db = new PGlite();
await db.exec(`
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;

  create or replace function public.atlas_assert_service_role()
  returns void
  language plpgsql
  stable
  security definer
  set search_path = ''
  as $$
  begin
    if session_user in ('postgres', 'service_role') then
      return;
    end if;
    raise exception 'service role required' using errcode = '42501';
  end;
  $$;

  create table public.events (
    id uuid primary key,
    slug text not null unique,
    name text not null,
    city text,
    state text not null,
    event_type text not null,
    category text,
    subcategory text,
    short_description text,
    official_website text,
    latitude double precision,
    longitude double precision,
    location_source text,
    status text not null,
    verification_status text not null,
    location_verified boolean not null
  );

  create table public.event_factory_packages (
    id uuid primary key,
    event_id uuid references public.events(id),
    event_key text not null,
    slug text not null,
    package_version integer not null,
    target_year integer not null,
    status text not null,
    published_at timestamptz,
    page_manifest jsonb not null,
    art_asset jsonb not null
  );

  create table public.event_pages (
    id uuid primary key,
    event_id uuid not null references public.events(id),
    event_key text not null,
    slug text not null,
    published_version_id uuid
  );

  create table public.event_page_versions (
    id uuid primary key,
    event_page_id uuid not null references public.event_pages(id),
    version_number integer not null,
    status text not null,
    manifest jsonb not null,
    is_valid boolean not null,
    published_at timestamptz
  );
`);
await db.exec(migration);

async function insertSqlFixture(
  suffix: number,
  options: {
    eventStatus?: string;
    packageStatus?: string;
    versionStatus?: string;
    withMedia?: boolean;
  } = {},
) {
  const digit = String(suffix).padStart(12, '0');
  const eventId = `10000000-0000-4000-8000-${digit}`;
  const packageId = `20000000-0000-4000-8000-${digit}`;
  const pageId = `30000000-0000-4000-8000-${digit}`;
  const versionId = `40000000-0000-4000-8000-${digit}`;
  const slug = `sql-fixture-${suffix}`;
  const pageManifest = {
    eventId: slug,
    slug,
    identity: {
      name: `SQL Fixture ${suffix}`,
      shortName: `Fixture ${suffix}`,
      location: 'Fixture, Michigan',
      startsOn: '2026-08-01',
      endsOn: '2026-08-02',
      timezone: 'America/Detroit',
    },
    hero: {
      imageSrc: options.withMedia === false ? '' : `https://example.com/${slug}.webp`,
      imageAlt: options.withMedia === false ? '' : `Fixture ${suffix} art`,
    },
  };
  const artAsset = options.withMedia === false
    ? {}
    : {
        publicUrl: `https://example.com/${slug}.webp`,
        alt: `Fixture ${suffix} art`,
      };

  await db.query(
    `insert into public.events (
      id, slug, name, city, state, event_type, category, subcategory,
      short_description, official_website, latitude, longitude, location_source,
      status, verification_status, location_verified
    ) values (
      $1::uuid, $2, $3, 'Fixture', 'Michigan', 'festival', 'festival', null,
      'SQL discovery fixture', 'https://example.com', 44, -85, null,
      $4, 'verified', true
    )`,
    [eventId, slug, `SQL Fixture ${suffix}`, options.eventStatus ?? 'active'],
  );
  await db.query(
    `insert into public.event_pages (
      id, event_id, event_key, slug, published_version_id
    ) values ($1::uuid, $2::uuid, $3, $3, $4::uuid)`,
    [pageId, eventId, slug, versionId],
  );
  await db.query(
    `insert into public.event_page_versions (
      id, event_page_id, version_number, status, manifest, is_valid, published_at
    ) values ($1::uuid, $2::uuid, 1, $3, $4::jsonb, true, now())`,
    [versionId, pageId, options.versionStatus ?? 'published', JSON.stringify(pageManifest)],
  );
  await db.query(
    `insert into public.event_factory_packages (
      id, event_id, event_key, slug, package_version, target_year, status,
      published_at, page_manifest, art_asset
    ) values (
      $1::uuid, $2::uuid, $3, $3, 1, 2026, $4, now(), $5::jsonb, $6::jsonb
    )`,
    [
      packageId,
      eventId,
      slug,
      options.packageStatus ?? 'published',
      JSON.stringify(pageManifest),
      JSON.stringify(artAsset),
    ],
  );
}

await insertSqlFixture(1);
await insertSqlFixture(2, { withMedia: false });
await insertSqlFixture(3, { packageStatus: 'approved' });
await insertSqlFixture(4, { eventStatus: 'draft' });
await insertSqlFixture(5, { versionStatus: 'approved' });

const sqlResult = await db.query<{ payload: PublishedAtlasDiscoveryPayload }>(
  `select public.atlas_get_published_event_discovery(
    array['MI', 'Michigan']::text[]
  ) as payload`,
);
const sqlPayload = sqlResult.rows[0]?.payload;
assert(sqlPayload, 'Migration 022 should return a discovery document');
assert.deepEqual(
  sqlPayload.items.map((item) => item.slug),
  ['sql-fixture-1', 'sql-fixture-2'],
  'The RPC must expose only valid public lifecycle/package/Event Hub rows',
);
assert.equal(
  sqlPayload.items[1]?.thumbnail_url,
  null,
  'A missing optional thumbnail must not remove an otherwise public event',
);

const privilegeResult = await db.query<{ anon_can_execute: boolean; authenticated_can_execute: boolean }>(`
  select
    has_function_privilege(
      'anon',
      'public.atlas_get_published_event_discovery(text[])',
      'EXECUTE'
    ) as anon_can_execute,
    has_function_privilege(
      'authenticated',
      'public.atlas_get_published_event_discovery(text[])',
      'EXECUTE'
    ) as authenticated_can_execute
`);
assert.equal(privilegeResult.rows[0]?.anon_can_execute, false);
assert.equal(privilegeResult.rows[0]?.authenticated_can_execute, false);

await db.close();

console.log(
  'Published Atlas discovery validation passed (single RPC, publication gate, field parity, fallbacks, search/discovery contracts, and lazy selected-event media).',
);
