import {
  normalizeHomeAtlasSearchValue,
  searchHomeAtlas,
} from '../data/homeAtlasSearch.ts';
import type { HomeAtlasSearchRules } from '../data/homeAtlasSearch.ts';
import { MICHIGAN_HOME_ATLAS_SEARCH_RULES } from '../data/stateAtlasSearchRules.ts';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig.ts';
import { ATLAS_EVENTS, type AtlasEvent } from '../data/events.ts';
import type { EventProfile } from '../data/eventProfileTypes.ts';

function fixtureEvent(
  id: string,
  name: string,
  location: string,
  category: AtlasEvent['category'],
  options: Pick<AtlasEvent, 'searchAliases' | 'iconType' | 'regionAtmosphere' | 'dateRange'> = {},
): AtlasEvent {
  return {
    id,
    name,
    location,
    category,
    latitude: 44,
    longitude: -85,
    x: 50,
    y: 50,
    atmosphereLabel: 'Fixture atmosphere',
    blurb: 'This prose must never participate in search matching.',
    ...options,
  };
}

const FIXTURE_EVENTS: readonly AtlasEvent[] = [
  fixtureEvent('romeo-peach', 'Romeo Peach Festival', 'Romeo, MI', 'Festivals', {
    iconType: 'harvest',
    regionAtmosphere: 'harvest',
    dateRange: { startDate: '2026-09-03', endDate: '2026-09-07', isEstimated: false },
  }),
  fixtureEvent(
    'traverse-city-cherry',
    'National Cherry Festival',
    'Traverse City, MI',
    'Festivals',
    { iconType: 'food', regionAtmosphere: 'lakeshore' },
  ),
  fixtureEvent(
    'mackinac-lilac',
    'Mackinac Island Lilac Festival',
    'Mackinac Island, MI',
    'Festivals',
    { iconType: 'flower', regionAtmosphere: 'lakeshore' },
  ),
  fixtureEvent(
    'holland-tulip-time',
    'Tulip Time Festival',
    'Holland, MI',
    'Festivals',
    { iconType: 'flower', regionAtmosphere: 'lakeshore' },
  ),
  fixtureEvent('armada-fair', 'Armada Fair', 'Armada, MI', 'Fairs', {
    iconType: 'fair',
    regionAtmosphere: 'harvest',
  }),
  fixtureEvent(
    'goodells-fair',
    'St. Clair County 4-H & Youth Fair',
    'Goodells, Michigan',
    'Fairs',
    {
      searchAliases: ['Goodells Fair', 'St. Clair County Fair', '4-H Fair', 'Youth Fair'],
      iconType: 'fair',
      regionAtmosphere: 'harvest',
    },
  ),
  fixtureEvent(
    'shiawassee-fair',
    'Shiawassee County Fair',
    'Corunna, MI',
    'Fairs',
    { iconType: 'fair', regionAtmosphere: 'harvest' },
  ),
  fixtureEvent(
    'upper-peninsula-state-fair',
    'Upper Peninsula State Fair',
    'Escanaba, MI',
    'Fairs',
    { iconType: 'fair', regionAtmosphere: 'northwoods' },
  ),
  fixtureEvent('detroit-jazz', 'Detroit Jazz Festival', 'Detroit, MI', 'Music', {
    iconType: 'music',
    regionAtmosphere: 'urban',
    dateRange: { startDate: '2026-09-04', endDate: '2026-09-07', isEstimated: false },
  }),
  fixtureEvent(
    'electric-forest',
    'Electric Forest Festival',
    'Rothbury, MI',
    'Music',
    { iconType: 'music', regionAtmosphere: 'northwoods' },
  ),
];

function fixtureProfile(event: AtlasEvent): EventProfile {
  const city = event.location.split(',')[0]?.trim() || event.location;
  return {
    id: event.id,
    slug: event.id,
    name: event.name,
    alternateNames: event.searchAliases,
    eventTypes: [event.iconType ?? event.category],
    categories: [event.category],
    tags: [],
    city,
    region: event.regionAtmosphere,
    state: 'Michigan',
    stateSlug: 'michigan',
    locationName: event.location,
    dateRange: event.dateRange
      ? {
          startDate: event.dateRange.startDate,
          endDate: event.dateRange.endDate,
          timezone: 'America/Detroit',
          isEstimated: event.dateRange.isEstimated,
        }
      : { startDate: 'Unknown', displayText: 'Unknown', isEstimated: true },
    coverageLevel: 'basicNationalCoverage',
    sources: [],
    trust: {
      sourceStatus: 'unverified',
      confidence: 'low',
      confidenceScore: 0.25,
    },
  };
}

const FIXTURE_PROFILES = FIXTURE_EVENTS.map(fixtureProfile);
const FIXED_NOW = new Date('2026-07-16T16:00:00.000Z');

function resultIds(
  query: string,
  events: readonly AtlasEvent[] = FIXTURE_EVENTS,
  profiles: readonly EventProfile[] = FIXTURE_PROFILES,
  rules: HomeAtlasSearchRules = MICHIGAN_HOME_ATLAS_SEARCH_RULES,
): string[] {
  return searchHomeAtlas({
    query,
    events,
    profiles,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules,
    now: FIXED_NOW,
  }).results.map((result) => result.event.id);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, received ${actualJson}`);
  }
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

assertEqual(
  normalizeHomeAtlasSearchValue('  St. Cláir—County’s  '),
  'st clair countys',
  'Unicode and punctuation normalization is deterministic',
);
assertEqual(resultIds('cherry'), ['traverse-city-cherry'], 'cherry resolves only National Cherry');
assertEqual(resultIds('lilac'), ['mackinac-lilac'], 'lilac resolves Mackinac');
assertEqual(resultIds('tulip'), ['holland-tulip-time'], 'tulip resolves Holland');

const exactRomeo = searchHomeAtlas({
  query: 'Please show me Romeo Peach Festival in Michigan',
  events: FIXTURE_EVENTS,
  profiles: FIXTURE_PROFILES,
  stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
  rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
});
assertEqual(exactRomeo.exactMatch?.eventId, 'romeo-peach', 'Romeo Peach is a unique exact identity');
assertEqual(
  exactRomeo.results.map((result) => result.event.id),
  ['romeo-peach'],
  'exact identity returns only Romeo Peach',
);
assertEqual(
  searchHomeAtlas({
    query: 'Take me to Romeo Peach Festival',
    events: FIXTURE_EVENTS,
    profiles: FIXTURE_PROFILES,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch?.eventId,
  'romeo-peach',
  'curated conversational words are removed before exact matching',
);
assertEqual(
  searchHomeAtlas({
    query: 'National Cherries Festival',
    events: FIXTURE_EVENTS,
    profiles: FIXTURE_PROFILES,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch,
  null,
  'broad-search singularization cannot manufacture an exact event identity',
);
assertEqual(
  searchHomeAtlas({
    query: 'Muskegon Summer',
    events: ATLAS_EVENTS,
    profiles: ATLAS_EVENTS.map(fixtureProfile),
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch,
  null,
  'a partial name cannot become an exact auto-navigation intent',
);

assertEqual(
  resultIds('cherry festivals in Michigan'),
  ['traverse-city-cherry'],
  'state and conversational scope words do not broaden cherry festivals',
);
assertEqual(resultIds('fairy lights'), [], 'fairy lights does not become a fair search');
assertEqual(
  searchHomeAtlas({
    query: 'fair',
    events: FIXTURE_EVENTS,
    profiles: FIXTURE_PROFILES,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch,
  null,
  'a category word is not promoted to the short 4-H Fair alias',
);
assertEqual(
  searchHomeAtlas({
    query: '4-H Fair',
    events: FIXTURE_EVENTS,
    profiles: FIXTURE_PROFILES,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch?.eventId,
  'goodells-fair',
  'meaningful short tokens remain part of exact identity matching',
);
assertEqual(
  searchHomeAtlas({
    query: 'show me St. Clair County 4-H & Youth Fair',
    events: FIXTURE_EVENTS,
    profiles: FIXTURE_PROFILES,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch?.eventId,
  'goodells-fair',
  'query framing cannot remove and from an exact event identity',
);
assertEqual(
  searchHomeAtlas({
    query: 'zz fair',
    events: FIXTURE_EVENTS,
    profiles: FIXTURE_PROFILES,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch,
  null,
  'unknown short tokens cannot manufacture an exact identity',
);
assertEqual(
  resultIds('county fairs'),
  ['shiawassee-fair', 'goodells-fair'],
  'county fairs intersects the structured category with state-owned county-fair IDs',
);
assertEqual(
  resultIds('state fairs'),
  ['upper-peninsula-state-fair'],
  'state fairs do not broaden to every fair',
);
assertEqual(resultIds('x'), [], 'an unrecognized one-character token returns no matches');
assertEqual(resultIds('Goodells'), ['goodells-fair'], 'city matching uses structured place data');
assertEqual(
  resultIds('music festivals'),
  ['detroit-jazz', 'electric-forest'],
  'the most-specific category phrase wins over its festival suffix',
);
assertEqual(
  resultIds('art fair'),
  [],
  'compound category intent cannot OR unrelated Arts and Fairs results together',
);
assertEqual(
  resultIds('September'),
  ['detroit-jazz', 'romeo-peach'],
  'month matching uses structured date ranges',
);
assertEqual(
  resultIds('events to see in September'),
  ['detroit-jazz', 'romeo-peach'],
  'natural Ask phrasing preserves structured month intent',
);
assertEqual(
  resultIds('what events are in September'),
  ['detroit-jazz', 'romeo-peach'],
  'question framing words do not become required identity tokens',
);
const estimatedSeptemberEvent = fixtureEvent(
  'estimated-september',
  'Estimated September Event',
  'Lansing, MI',
  'Festivals',
  { dateRange: { startDate: '2026-09-10', isEstimated: true } },
);
assertEqual(
  resultIds('September', [estimatedSeptemberEvent], [fixtureProfile(estimatedSeptemberEvent)]),
  [],
  'month matching excludes estimated edition dates',
);
assertEqual(
  resultIds('upcoming events', [estimatedSeptemberEvent], [fixtureProfile(estimatedSeptemberEvent)]),
  [],
  'status matching excludes estimated edition dates',
);
const completedReviewedEvent = fixtureEvent(
  'completed-reviewed',
  'Completed Reviewed Event',
  'Detroit, MI',
  'Music',
  { dateRange: { startDate: '2026-07-01', endDate: '2026-07-05', isEstimated: false } },
);
assertEqual(
  resultIds('upcoming events', [completedReviewedEvent], [fixtureProfile(completedReviewedEvent)]),
  [],
  'status matching excludes completed reviewed editions',
);
const invalidSeptemberEvent = fixtureEvent(
  'invalid-september',
  'Invalid September Event',
  'Lansing, MI',
  'Festivals',
  { dateRange: { startDate: '2026-09-31', isEstimated: false } },
);
assertEqual(
  resultIds('September', [invalidSeptemberEvent], [fixtureProfile(invalidSeptemberEvent)]),
  [],
  'month matching excludes invalid calendar dates',
);
const estimatedTimingProfile: EventProfile = {
  ...fixtureProfile(FIXTURE_EVENTS.find((event) => event.id === 'electric-forest')!),
  timing: {
    typicalMonth: 6,
    typicalMonthName: 'June',
    typicalSeason: 'summer',
    timingSourceStatus: 'estimated',
  },
};
assertEqual(
  resultIds(
    'June',
    [FIXTURE_EVENTS.find((event) => event.id === 'electric-forest')!],
    [estimatedTimingProfile],
  ),
  [],
  'estimated typical timing cannot enter reviewed month search',
);
assertEqual(
  resultIds('fall'),
  ['detroit-jazz', 'romeo-peach'],
  'season matching derives from structured date months',
);
assertEqual(
  resultIds('St. Clair County 4‑H & Youth Fair'),
  ['goodells-fair'],
  'Unicode punctuation preserves a unique event identity',
);

const forward = resultIds('county fairs');
const reversed = resultIds(
  'county fairs',
  [...FIXTURE_EVENTS].reverse(),
  [...FIXTURE_PROFILES].reverse(),
);
assertEqual(reversed, forward, 'result order is independent of catalog order');

const sharedAlias = 'Twin Lantern Festival';
const duplicateAliasEvents = [
  fixtureEvent('twin-b', 'Second Twin Festival', 'Beta, MI', 'Festivals', {
    searchAliases: [sharedAlias],
  }),
  fixtureEvent('twin-a', 'First Twin Festival', 'Alpha, MI', 'Festivals', {
    searchAliases: [sharedAlias],
  }),
];
const duplicateAliasProfiles = duplicateAliasEvents.map(fixtureProfile);
const ambiguousAlias = searchHomeAtlas({
  query: sharedAlias,
  events: duplicateAliasEvents,
  profiles: duplicateAliasProfiles,
  stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
  rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
});
assertEqual(ambiguousAlias.exactMatch, null, 'a duplicate alias is not treated as exact');
assertEqual(
  ambiguousAlias.results.map((result) => result.event.id),
  ['twin-a', 'twin-b'],
  'ambiguous aliases remain deterministic discovery results',
);

const missingCuratedRules: HomeAtlasSearchRules = {
  ...MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  curatedRules: [
    ...MICHIGAN_HOME_ATLAS_SEARCH_RULES.curatedRules,
    {
      id: 'missing-fixture',
      phrases: ['ghost trail'],
      eventIds: ['not-in-the-supplied-catalog'],
    },
  ],
};
assertEqual(
  resultIds('ghost trail', FIXTURE_EVENTS, FIXTURE_PROFILES, missingCuratedRules),
  [],
  'curated IDs are intersected with the supplied catalog',
);

const proseTrapEvent = fixtureEvent(
  'prose-trap',
  'Ordinary Gathering',
  'Plainfield, MI',
  'Festivals',
);
proseTrapEvent.blurb = 'Fairy lights fill every corner of this prose-only description.';
assertEqual(
  resultIds('fairy lights', [proseTrapEvent], [fixtureProfile(proseTrapEvent)]),
  [],
  'blurbs and atmospheric prose are not a fallback search index',
);

assert(
  resultIds('hidden gem').every((eventId) => eventId === 'electric-forest'),
  'curated hidden-gem search cannot leak non-curated events',
);

const actualProfiles = ATLAS_EVENTS.map(fixtureProfile);
const actualResultIds = (query: string) => resultIds(query, ATLAS_EVENTS, actualProfiles);

const exactDetroitJazz = searchHomeAtlas({
  query: 'Detroit Jazz Festival',
  events: ATLAS_EVENTS,
  profiles: actualProfiles,
  stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
  rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  now: FIXED_NOW,
});
assertEqual(
  exactDetroitJazz.exactMatch?.eventId,
  'detroit-jazz',
  'required exact-event query resolves Detroit Jazz Festival uniquely',
);
assertEqual(
  exactDetroitJazz.results.map((result) => result.event.id),
  ['detroit-jazz'],
  'required exact-event query contains no unrelated result',
);
assertEqual(
  actualResultIds('music festivals'),
  [
    'common-ground-lansing',
    'detroit-jazz',
    'electric-forest',
    'faster-horses',
    'muskegon-summer-celebration',
  ],
  'required category query returns only Music events',
);
assertEqual(
  actualResultIds('events in Detroit'),
  ['detroit-jazz'],
  'required city query returns only reviewed Detroit events',
);
assertEqual(
  actualResultIds('events in September'),
  ['detroit-jazz', 'romeo-peach'],
  'required month query returns only events with reviewed September dates',
);
assertEqual(
  actualResultIds('events in Detroit Metro'),
  ['armada-fair', 'detroit-jazz', 'romeo-peach'],
  'required configured-region query uses the curated Detroit Metro membership',
);
assertEqual(
  actualResultIds('upcoming events'),
  ['alpena-brown-trout', 'detroit-jazz', 'romeo-peach'],
  'required status query returns only reviewed upcoming editions',
);
const combinedRequiredQuery = searchHomeAtlas({
  query: 'music events in Detroit in September',
  events: ATLAS_EVENTS,
  profiles: actualProfiles,
  stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
  rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  now: FIXED_NOW,
});
assertEqual(
  combinedRequiredQuery.results.map((result) => result.event.id),
  ['detroit-jazz'],
  'required combined query intersects category, city, and reviewed month',
);
assertEqual(
  combinedRequiredQuery.results[0]?.reasons,
  ['identity', 'place', 'category', 'month'],
  'required combined query retains every structured match reason',
);
assertEqual(
  actualResultIds('events in Kalamazoo in February'),
  [],
  'required legitimate no-results query does not manufacture a match',
);

assertEqual(
  actualResultIds('fair'),
  ['armada-fair', 'shiawassee-fair', 'goodells-fair', 'upper-peninsula-state-fair'],
  'actual Michigan fair search uses semantic event categories only',
);
assertEqual(
  searchHomeAtlas({
    query: '4-H Fair',
    events: ATLAS_EVENTS,
    profiles: actualProfiles,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  }).exactMatch?.eventId,
  'goodells-fair',
  'actual Michigan 4-H alias remains exact',
);
assertEqual(actualResultIds('show up'), [], 'ambiguous lowercase up is not a region alias');
assertEqual(
  actualResultIds('fireworks'),
  ['cheboygan-4th-fireworks', 'coast-guard-festival'],
  'reviewed Michigan fireworks results include Cheboygan and Coast Guard',
);
assertEqual(
  actualResultIds('arts and culture'),
  ['black-river-tattoo'],
  'visual icon types cannot leak Music events into Arts & Culture',
);

const publishedIdByFallbackId: Readonly<Record<string, string>> = {
  'romeo-peach': 'romeo-peach-festival',
  'traverse-city-cherry': 'national-cherry-festival',
  'black-river-tattoo': 'black-river-tattoo-convention',
  'goodells-fair': 'st-clair-county-4-h-youth-fair',
};
const publishedIdFixtures = ATLAS_EVENTS.map((event) => ({
  ...event,
  id: publishedIdByFallbackId[event.id] ?? event.id,
}));
const publishedIdProfiles = publishedIdFixtures.map(fixtureProfile);
assertEqual(
  resultIds('county fairs', publishedIdFixtures, publishedIdProfiles),
  ['shiawassee-fair', 'st-clair-county-4-h-youth-fair'],
  'state curation recognizes reviewed published IDs as well as fallback IDs',
);
assert(
  resultIds('northern Michigan', publishedIdFixtures, publishedIdProfiles).includes(
    'national-cherry-festival',
  ),
  'published National Cherry ID is missing from northern Michigan curation',
);
assert(
  resultIds('the thumb', publishedIdFixtures, publishedIdProfiles).includes(
    'black-river-tattoo-convention',
  ),
  'published Black River ID is missing from Thumb curation',
);

const monthPhrases = new Map<string, number>();
for (const rule of MICHIGAN_HOME_ATLAS_SEARCH_RULES.monthRules) {
  assert(rule.month >= 1 && rule.month <= 12, `invalid month rule: ${rule.month}`);
  for (const phrase of rule.phrases) {
    const normalizedPhrase = normalizeHomeAtlasSearchValue(phrase);
    assert(!monthPhrases.has(normalizedPhrase), `duplicate month phrase: ${phrase}`);
    monthPhrases.set(normalizedPhrase, rule.month);
  }
}

console.log('Home Atlas search validation passed.');
