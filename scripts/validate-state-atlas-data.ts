import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getEventRailStatus, selectEventRailEvents } from '../data/eventRail.ts';
import type { AtlasEvent } from '../data/events.ts';
import { groupPublishedAtlasPackagesByEvent } from '../data/publishedAtlasPackageSelection.ts';
import { EVENT_TIMING_METADATA } from '../data/eventTimingMetadata.ts';
import {
  resolveAtlasEventProfileDateRange,
  resolveReviewedAtlasEventSeason,
  resolveReviewedAtlasEventTiming,
} from '../data/stateAtlasEventProfile.ts';
import {
  getStateAtlasEventCatalog,
  reconcileStateAtlasEvents,
} from '../data/stateAtlasEvents.ts';
import {
  isStateAtlasDatabaseValue,
  isValidIanaTimeZone,
  MICHIGAN_STATE_ATLAS_CONFIG,
  resolveStateAtlasRegionAtmosphere,
} from '../data/stateAtlasConfig.ts';

const config = MICHIGAN_STATE_ATLAS_CONFIG;

assert.deepEqual(
  JSON.parse(JSON.stringify(config)),
  config,
  'state Atlas configuration must remain serializable across the server/client boundary',
);
assert(config.identity.databaseStateValues.length > 0, 'database state aliases must not be empty');
assert(config.presentation.copy.askSuggestions.length > 0, 'Atlas suggestions must not be empty');
assert(isStateAtlasDatabaseValue(config, 'MI'), 'Michigan postal state value is not accepted');
assert(isStateAtlasDatabaseValue(config, ' michigan '), 'Michigan full state value is not accepted case-insensitively');
assert(!isStateAtlasDatabaseValue(config, 'Ohio'), 'a different state is accepted by the Michigan configuration');
assert(isValidIanaTimeZone(config.defaultTimeZone), 'default state timezone is not a valid IANA timezone');

for (const artwork of [
  config.presentation.desktopArtwork,
  config.presentation.mobileArtwork,
]) {
  const assetPath = resolve('public', artwork.src.replace(/^\//, ''));
  const hash = createHash('sha256').update(readFileSync(assetPath)).digest('hex').toUpperCase();
  assert.equal(hash, artwork.sha256, `${artwork.id} does not match its versioned SHA-256`);
  assert(artwork.width > 0 && artwork.height > 0, `${artwork.id} has invalid dimensions`);
}

assert.equal(
  resolveStateAtlasRegionAtmosphere(config, {
    latitude: 42.3314,
    longitude: -83.0458,
    categoryText: 'Music',
  }),
  'urban',
);
assert.equal(
  resolveStateAtlasRegionAtmosphere(config, {
    latitude: 46.5436,
    longitude: -87.3954,
    categoryText: 'Festival',
  }),
  'northwoods',
);
assert.equal(
  resolveStateAtlasRegionAtmosphere(config, {
    latitude: 44,
    longitude: -85,
    categoryText: 'County Fair',
  }),
  'harvest',
);
assert.equal(
  resolveStateAtlasRegionAtmosphere(config, {
    latitude: 44,
    longitude: -85,
    categoryText: 'Music',
  }),
  'lakeshore',
);

const michiganCatalog = getStateAtlasEventCatalog(' MICHIGAN ');
assert(michiganCatalog.length > 0, 'Michigan fallback catalog is empty');
assert.deepEqual(getStateAtlasEventCatalog('ohio'), [], 'an unregistered state inherits Michigan events');

const versionedPackages = groupPublishedAtlasPackagesByEvent([
  { id: 'old-edition', event_id: 'shared-event', target_year: 2025, published_at: '2025-06-01T00:00:00.000Z' },
  { id: 'current-earlier', event_id: 'shared-event', target_year: 2026, published_at: '2026-05-01T00:00:00.000Z' },
  { id: 'current-latest', event_id: 'shared-event', target_year: 2026, published_at: '2026-06-01T00:00:00.000Z' },
  { id: 'other-event', event_id: 'other-event', target_year: 2026, published_at: '2026-04-01T00:00:00.000Z' },
]);
assert.deepEqual(
  versionedPackages.get('shared-event')?.map((eventPackage) => eventPackage.id),
  ['current-latest', 'current-earlier', 'old-edition'],
  'published editions are not ordered newest-year and newest-publication first',
);
assert.equal(versionedPackages.get('other-event')?.[0]?.id, 'other-event');

const localFixture = {
  ...michiganCatalog[0],
  id: 'local-fixture',
  name: 'Shared Celebration',
} satisfies AtlasEvent;
const approvedFixture = {
  ...localFixture,
  id: 'approved-fixture',
  searchAliases: ['Shared Celebration'],
  blurb: 'Approved state-scoped fixture',
} satisfies AtlasEvent;
const appendedFixture = {
  ...localFixture,
  id: 'new-approved-fixture',
  name: 'New Approved Celebration',
  searchAliases: [],
} satisfies AtlasEvent;
const reconciled = reconcileStateAtlasEvents(
  [localFixture],
  [approvedFixture, appendedFixture],
);
assert.equal(reconciled[0]?.id, approvedFixture.id, 'a unique approved alias did not replace its local fixture');
assert.equal(reconciled[1]?.id, appendedFixture.id, 'a new approved state event was not appended');

const exactEvent = {
  ...localFixture,
  id: 'exact-date-fixture',
  location: 'Detroit, MI',
  dateRange: {
    startDate: '2026-09-04',
    endDate: '2026-09-07',
    timeZone: 'America/Detroit',
    isEstimated: false,
  },
} satisfies AtlasEvent;
const exactProfileDateRange = resolveAtlasEventProfileDateRange(
  exactEvent.dateRange,
  config.defaultTimeZone,
);
assert.equal(exactProfileDateRange?.startDate, '2026-09-04');
assert.equal(exactProfileDateRange?.endDate, '2026-09-07');
assert.equal(exactProfileDateRange?.timezone, 'America/Detroit');
assert.equal(exactProfileDateRange?.isEstimated, false);
assert.deepEqual(
  resolveReviewedAtlasEventTiming(exactEvent.dateRange, config.defaultTimeZone),
  {
    dateStart: '2026-09-04',
    dateEnd: '2026-09-07',
    timezone: 'America/Detroit',
  },
);
assert.equal(resolveReviewedAtlasEventSeason(exactEvent.dateRange), 'fall');
assert.equal(
  resolveReviewedAtlasEventTiming(
    { startDate: '2026-02-30', isEstimated: false },
    config.defaultTimeZone,
  ),
  null,
  'an invalid calendar date was projected into exact timing',
);
assert.equal(
  resolveReviewedAtlasEventTiming(
    { startDate: '2026-09-07', endDate: '2026-09-04', isEstimated: false },
    config.defaultTimeZone,
  ),
  null,
  'an inverted date range was projected into exact timing',
);
assert.equal(
  resolveReviewedAtlasEventTiming(
    { startDate: '2026-09-04', isEstimated: true },
    config.defaultTimeZone,
  ),
  null,
  'an estimated date was projected into exact timing',
);

const eventFor = (eventId: string) => {
  const event = michiganCatalog.find((candidate) => candidate.id === eventId);
  assert(event, `missing Michigan timing fixture: ${eventId}`);
  return event;
};
const detroitJazzEvent = eventFor('detroit-jazz');
assert.equal(resolveReviewedAtlasEventTiming(detroitJazzEvent.dateRange, config.defaultTimeZone)?.dateStart, '2026-09-04');
assert.equal(resolveReviewedAtlasEventTiming(detroitJazzEvent.dateRange, config.defaultTimeZone)?.dateEnd, '2026-09-07');
assert.equal(resolveReviewedAtlasEventTiming(detroitJazzEvent.dateRange, config.defaultTimeZone)?.timezone, config.defaultTimeZone);
assert.equal(resolveReviewedAtlasEventSeason(detroitJazzEvent.dateRange), 'fall');
const brownTroutEvent = eventFor('alpena-brown-trout');
assert.equal(resolveReviewedAtlasEventTiming(brownTroutEvent.dateRange, config.defaultTimeZone)?.dateStart, '2026-07-17');
assert.equal(resolveReviewedAtlasEventSeason(brownTroutEvent.dateRange), 'summer');
const romeoPeachEvent = eventFor('romeo-peach');
const romeoTiming = resolveReviewedAtlasEventTiming(romeoPeachEvent.dateRange, config.defaultTimeZone);
assert.equal(romeoTiming?.dateStart, '2026-09-03');
assert.equal(
  romeoTiming?.timingSourceStatus,
  undefined,
  'Romeo exact dates inherited its legacy estimated timing provenance',
);
assert.equal(EVENT_TIMING_METADATA['electric-forest']?.typicalMonth, 6);
assert.equal(EVENT_TIMING_METADATA['electric-forest']?.timingSourceStatus, 'estimated');
assert.equal(
  resolveAtlasEventProfileDateRange({ startDate: '2026-10-01' }, config.defaultTimeZone)?.isEstimated,
  true,
  'unreviewed date metadata is treated as verified',
);

const timezoneBoundary = new Date('2026-07-16T00:30:00.000Z');
const westernEvent = {
  ...localFixture,
  id: 'western-timezone-fixture',
  name: 'Western Timezone Fixture',
  dateRange: {
    startDate: '2026-07-16',
    timeZone: 'America/Los_Angeles',
    isEstimated: false,
  },
} satisfies AtlasEvent;
const easternEvent = {
  ...localFixture,
  id: 'eastern-timezone-fixture',
  name: 'Eastern Timezone Fixture',
  dateRange: {
    startDate: '2026-07-16',
    timeZone: 'Pacific/Kiritimati',
    isEstimated: false,
  },
} satisfies AtlasEvent;
assert.equal(getEventRailStatus(westernEvent, { now: timezoneBoundary }), 'UPCOMING');
assert.equal(getEventRailStatus(easternEvent, { now: timezoneBoundary }), 'LIVE');
assert.equal(
  getEventRailStatus(
    {
      ...westernEvent,
      dateRange: { ...westernEvent.dateRange, isEstimated: true },
    },
    { now: timezoneBoundary },
  ),
  null,
  'an estimated date appears in the live/upcoming rail',
);
assert.equal(
  getEventRailStatus(
    { ...easternEvent, dateRange: { ...easternEvent.dateRange, timeZone: 'Not/A_Timezone' } },
    { now: timezoneBoundary, timeZone: 'America/Detroit' },
  ),
  'UPCOMING',
  'an invalid event timezone does not fall back to the state timezone',
);
assert.deepEqual(
  selectEventRailEvents([westernEvent, easternEvent], { now: timezoneBoundary }).map((event) => event.id),
  [easternEvent.id, westernEvent.id],
  'rail ordering does not evaluate each event in its own timezone',
);

const publishedResolverSource = readFileSync(
  resolve('lib/events/publishedAtlasEvents.ts'),
  'utf8',
);
const profileAdapterSource = readFileSync(resolve('data/eventProfileAdapter.ts'), 'utf8');
assert(
  profileAdapterSource.includes('resolveReviewedAtlasEventTiming') &&
    profileAdapterSource.includes('?? EVENT_TIMING_METADATA[event.id]'),
  'event profiles do not prefer reviewed exact timing over estimated fallback metadata',
);
const eventQueryIndex = publishedResolverSource.indexOf('.from("events")');
const packageQueryIndex = publishedResolverSource.indexOf('.from("event_factory_packages")');
assert(eventQueryIndex >= 0 && packageQueryIndex > eventQueryIndex, 'published resolver does not scope canonical events before loading packages');
assert(
  publishedResolverSource.includes('.in("state", [...config.identity.databaseStateValues])'),
  'published resolver does not filter by explicit state database values',
);
assert.equal(
  publishedResolverSource.match(/\.range\(/g)?.length,
  2,
  'state events and published packages are not both loaded with pagination',
);
assert(
  publishedResolverSource.includes('target_year,published_at') &&
    publishedResolverSource.includes('groupPublishedAtlasPackagesByEvent'),
  'published editions are not selected with explicit version metadata',
);
assert(!publishedResolverSource.includes('.limit(2000)'), 'state event resolution still has a silent fixed row cap');
assert(!publishedResolverSource.includes('ATLAS_EVENTS'), 'published resolver still owns a global Michigan fallback');

console.log('State Atlas data validations passed.');
