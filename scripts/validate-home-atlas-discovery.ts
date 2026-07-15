import {
  EMPTY_HOME_ATLAS_DISCOVERY_FILTERS,
  resolveHomeAtlasDiscovery,
  type HomeAtlasDiscoveryFilters,
  type HomeAtlasDiscoveryResponse,
} from '../data/homeAtlasDiscovery.ts';
import { selectEventRailEvents } from '../data/eventRail.ts';
import {
  searchHomeAtlas,
  type HomeAtlasSearchResponse,
  type HomeAtlasSearchRules,
} from '../data/homeAtlasSearch.ts';
import { MICHIGAN_HOME_ATLAS_SEARCH_RULES } from '../data/stateAtlasSearchRules.ts';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig.ts';
import type { AtlasEvent } from '../data/events.ts';
import type { EventProfile } from '../data/eventProfileTypes.ts';

const NOW = new Date('2026-07-15T16:00:00.000Z');

function fixtureEvent(
  id: string,
  name: string,
  location: string,
  category: AtlasEvent['category'],
  dateRange?: AtlasEvent['dateRange'],
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
    blurb: 'Fixture discovery description.',
    dateRange,
  };
}

function fixtureProfile(event: AtlasEvent): EventProfile {
  return {
    id: event.id,
    slug: event.id,
    name: event.name,
    eventTypes: [event.category],
    categories: [event.category],
    tags: [],
    city: event.location.split(',')[0]?.trim() || event.location,
    state: 'Michigan',
    stateSlug: 'michigan',
    locationName: event.location,
    dateRange: event.dateRange
      ? {
          startDate: event.dateRange.startDate,
          endDate: event.dateRange.endDate,
          timezone: event.dateRange.timeZone ?? 'America/Detroit',
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
      sourceStatus: 'unverified',
      confidence: 'low',
      confidenceScore: 0.25,
    },
  };
}

const EVENTS: readonly AtlasEvent[] = [
  fixtureEvent(
    'goodells-fair',
    'St. Clair County 4-H & Youth Fair',
    'Goodells, MI',
    'Fairs',
    {
      startDate: '2026-07-10',
      endDate: '2026-07-20',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
  ),
  fixtureEvent('armada-fair', 'Armada Fair', 'Armada, MI', 'Fairs', {
    startDate: '2026-07-17',
    endDate: '2026-07-19',
    timeZone: 'America/Detroit',
    isEstimated: false,
  }),
  fixtureEvent(
    'shiawassee-fair',
    'Shiawassee County Fair',
    'Corunna, MI',
    'Fairs',
    {
      startDate: '2026-07-01',
      endDate: '2026-07-02',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
  ),
  fixtureEvent(
    'detroit-jazz',
    'Detroit Jazz Festival',
    'Detroit, MI',
    'Music',
    {
      startDate: '2026-09-04',
      endDate: '2026-09-07',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
  ),
  fixtureEvent(
    'romeo-peach',
    'Romeo Peach Festival',
    'Romeo, MI',
    'Festivals',
    {
      startDate: '2026-09-03',
      endDate: '2026-09-07',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
  ),
  fixtureEvent(
    'cross-month-art',
    'Cross Month Art Fair',
    'Bay City, MI',
    'Arts & Culture',
    {
      startDate: '2026-07-31',
      endDate: '2026-08-02',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
  ),
  fixtureEvent('same-date-b', 'Same Date Celebration', 'Beta, MI', 'Arts & Culture', {
    startDate: '2026-08-01',
    timeZone: 'America/Detroit',
    isEstimated: false,
  }),
  fixtureEvent('same-date-a', 'Same Date Celebration', 'Alpha, MI', 'Arts & Culture', {
    startDate: '2026-08-01',
    timeZone: 'America/Detroit',
    isEstimated: false,
  }),
  fixtureEvent(
    'estimated-july',
    'Estimated July Event',
    'Lansing, MI',
    'Festivals',
    {
      startDate: '2026-07-18',
      timeZone: 'America/Detroit',
      isEstimated: true,
    },
  ),
  fixtureEvent(
    'invalid-july',
    'Invalid July Event',
    'Flint, MI',
    'Festivals',
    {
      startDate: '2026-07-35',
      timeZone: 'America/Detroit',
      isEstimated: false,
    },
  ),
  fixtureEvent(
    'undated-zulu',
    'Zulu Undated Festival',
    'Zeeland, MI',
    'Festivals',
  ),
  fixtureEvent(
    'profile-only-date',
    'Profile Date Music Festival',
    'Ann Arbor, MI',
    'Music',
  ),
];

const PROFILES: readonly EventProfile[] = EVENTS.map((event) => {
  const profile = fixtureProfile(event);
  if (event.id !== 'profile-only-date') return profile;
  return {
    ...profile,
    dateRange: {
      startDate: '2026-08-05',
      endDate: '2026-08-06',
      timezone: 'America/Detroit',
      isEstimated: false,
    },
  };
});

function getSearchResponse(
  query: string,
  events: readonly AtlasEvent[] = EVENTS,
  profiles: readonly EventProfile[] = PROFILES,
  rules: HomeAtlasSearchRules = MICHIGAN_HOME_ATLAS_SEARCH_RULES,
): HomeAtlasSearchResponse {
  return searchHomeAtlas({
    query,
    events,
    profiles,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    rules,
  });
}

function resolve(
  filters: HomeAtlasDiscoveryFilters = EMPTY_HOME_ATLAS_DISCOVERY_FILTERS,
  query = '',
  options: {
    events?: readonly AtlasEvent[];
    profiles?: readonly EventProfile[];
    rules?: HomeAtlasSearchRules;
    searchResponse?: HomeAtlasSearchResponse;
  } = {},
): HomeAtlasDiscoveryResponse {
  const events = options.events ?? EVENTS;
  const profiles = options.profiles ?? PROFILES;
  const rules = options.rules ?? MICHIGAN_HOME_ATLAS_SEARCH_RULES;
  return resolveHomeAtlasDiscovery({
    events,
    profiles,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    searchRules: rules,
    searchResponse:
      options.searchResponse ?? getSearchResponse(query, events, profiles, rules),
    filters,
    now: NOW,
  });
}

function ids(response: HomeAtlasDiscoveryResponse): string[] {
  return response.events.map((event) => event.id);
}

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(label);
}

function assertEqual<T>(actual: T, expected: T, label: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${label}: expected ${expectedJson}, received ${actualJson}`);
  }
}

const idle = resolve();
assertEqual(idle.mode, 'idle', 'no query and no filters remains idle');
assertEqual(ids(idle), [], 'idle discovery does not flood the homepage with all events');
assertEqual(idle.activeFilterCount, 0, 'idle discovery has no active filters');
assertEqual(idle.statusText, null, 'idle discovery has no announcement');
assertEqual(
  idle.filters,
  EMPTY_HOME_ATLAS_DISCOVERY_FILTERS,
  'default filters are normalized consistently',
);

assertEqual(
  ids(resolve({ category: 'Fairs' })),
  ['shiawassee-fair', 'goodells-fair', 'armada-fair'],
  'category filtering is exact and filter-only ordering is reviewed-date first',
);
assertEqual(
  ids(resolve({ category: 'fair' })),
  [],
  'category filtering cannot singularize or partially match a category',
);

assertEqual(
  ids(resolve({ regionRuleId: 'thumb' })),
  ['goodells-fair', 'armada-fair'],
  'state-owned region rules intersect their reviewed IDs with the supplied catalog',
);
assertEqual(
  ids(resolve({ city: '  GOODELLS ' })),
  ['goodells-fair'],
  'city filtering uses normalized exact values',
);

const liveUpcoming = resolve({ date: { kind: 'live-upcoming' } });
assertEqual(
  ids(liveUpcoming),
  [
    'goodells-fair',
    'armada-fair',
    'cross-month-art',
    'same-date-a',
    'same-date-b',
    'romeo-peach',
    'detroit-jazz',
  ],
  'live/upcoming discovery reuses rail eligibility and ordering',
);
assert(
  !ids(liveUpcoming).includes('estimated-july') &&
    !ids(liveUpcoming).includes('invalid-july') &&
    !ids(liveUpcoming).includes('shiawassee-fair') &&
    !ids(liveUpcoming).includes('profile-only-date'),
  'live/upcoming excludes estimated, invalid, completed, and profile-only dates',
);

assertEqual(
  ids(resolve({ date: { kind: 'month', month: 7 } })),
  [
    'shiawassee-fair',
    'goodells-fair',
    'armada-fair',
    'cross-month-art',
  ],
  'reviewed July filtering excludes estimated and invalid dates',
);
assertEqual(
  ids(resolve({ date: { kind: 'month', month: 8 } })),
  [
    'cross-month-art',
    'same-date-a',
    'same-date-b',
    'profile-only-date',
  ],
  'reviewed month filtering supports cross-month and explicit profile date ranges',
);

const combined = resolve({
  category: 'Fairs',
  regionRuleId: 'thumb',
  city: 'Goodells',
  date: { kind: 'month', month: 7 },
});
assertEqual(ids(combined), ['goodells-fair'], 'facets use AND semantics');
assertEqual(combined.activeFilterCount, 4, 'every active facet is counted once');
assertEqual(combined.mode, 'results', 'combined matching filters return result mode');

assertEqual(
  ids(resolve({ category: 'Arts & Culture' })),
  ['cross-month-art', 'same-date-a', 'same-date-b'],
  'filter-only ties fall back to normalized name and event ID',
);
assertEqual(
  ids(resolve({ category: 'Festivals' })),
  ['romeo-peach', 'estimated-july', 'invalid-july', 'undated-zulu'],
  'reviewed dates sort before estimated, invalid, and undated events',
);

const normalizedTieEvents = [
  fixtureEvent('same–id', 'Normalized Tie', 'Beta, MI', 'Music'),
  fixtureEvent('same-id', 'Normalized Tie', 'Alpha, MI', 'Music'),
];
const normalizedTieProfiles = normalizedTieEvents.map(fixtureProfile);
assertEqual(
  ids(resolve({ category: 'Music' }, '', {
    events: normalizedTieEvents,
    profiles: normalizedTieProfiles,
  })),
  ['same-id', 'same–id'],
  'raw event IDs provide a total order when normalized IDs are identical',
);
assertEqual(
  ids(resolve({ category: 'Music' }, '', {
    events: [...normalizedTieEvents].reverse(),
    profiles: [...normalizedTieProfiles].reverse(),
  })),
  ['same-id', 'same–id'],
  'normalized ordering ties remain independent of catalog order',
);

const exactSearch = getSearchResponse('Detroit Jazz Festival');
const exactWithIncompatibleFilters = resolve(
  {
    category: 'Fairs',
    regionRuleId: 'thumb',
    city: 'Goodells',
    date: { kind: 'month', month: 7 },
  },
  'Detroit Jazz Festival',
  { searchResponse: exactSearch },
);
assertEqual(exactWithIncompatibleFilters.mode, 'exact', 'exact identity keeps exact mode');
assertEqual(
  ids(exactWithIncompatibleFilters),
  ['detroit-jazz'],
  'exact identity bypasses incompatible discovery filters',
);
assertEqual(
  exactWithIncompatibleFilters.exactMatch?.eventId,
  'detroit-jazz',
  'exact navigation identity is retained for AtlasMap',
);

const missingExactResponse: HomeAtlasSearchResponse = {
  normalizedQuery: 'missing exact event',
  queryTokens: ['missing', 'exact', 'event'],
  freeTokens: [],
  exactMatch: {
    eventId: 'not-in-the-supplied-catalog',
    eventName: 'Missing Exact Event',
  },
  results: [],
};
const missingExactDiscovery = resolve({}, 'missing exact event', {
  searchResponse: missingExactResponse,
});
assertEqual(
  missingExactDiscovery.mode,
  'empty',
  'an exact identity missing from the supplied catalog fails closed',
);
assertEqual(
  missingExactDiscovery.exactMatch,
  null,
  'a missing exact identity cannot leak into navigation state',
);

const countyFairSearch = getSearchResponse('county fairs');
const broadDiscovery = resolve({}, 'county fairs', {
  searchResponse: countyFairSearch,
});
assertEqual(
  ids(broadDiscovery),
  countyFairSearch.results.map((result) => result.event.id),
  'broad discovery preserves deterministic search rank',
);
const reversedEvents = [...EVENTS].reverse();
const reversedProfiles = [...PROFILES].reverse();
const reversedCountyFairSearch = getSearchResponse(
  'county fairs',
  reversedEvents,
  reversedProfiles,
);
const reversedBroadDiscovery = resolve({}, 'county fairs', {
  events: reversedEvents,
  profiles: reversedProfiles,
  searchResponse: reversedCountyFairSearch,
});
assertEqual(
  ids(reversedBroadDiscovery),
  ids(broadDiscovery),
  'broad discovery stays stable when the supplied catalog order reverses',
);
assertEqual(
  ids(resolve({ city: 'Goodells' }, 'county fairs', { searchResponse: countyFairSearch })),
  ['goodells-fair'],
  'broad ranked results are intersected by structured filters',
);

const emptyBroad = resolve({}, 'fairy lights');
assertEqual(emptyBroad.mode, 'empty', 'recognized query with no result returns empty mode');
assert(
  emptyBroad.statusText?.startsWith('No Michigan celebrations match') === true,
  'empty results provide a concise status',
);

const rulesWithMissingRegion: HomeAtlasSearchRules = {
  ...MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  regionRules: [
    ...MICHIGAN_HOME_ATLAS_SEARCH_RULES.regionRules,
    {
      id: 'ghost-region',
      phrases: ['ghost region'],
      eventIds: ['not-in-the-supplied-catalog'],
    },
  ],
};
const missingRegionIdle = resolve({}, '', { rules: rulesWithMissingRegion });
assert(
  !missingRegionIdle.facets.regions.some((option) => option.value === 'ghost-region'),
  'region facet options exclude curated IDs missing from the supplied catalog',
);
assertEqual(
  resolve({ regionRuleId: 'ghost-region' }, '', { rules: rulesWithMissingRegion }).mode,
  'empty',
  'selecting a missing curated region fails closed',
);

const atmosphereOnlyRules: HomeAtlasSearchRules = {
  ...MICHIGAN_HOME_ATLAS_SEARCH_RULES,
  regionRules: [
    {
      id: 'atmosphere-only',
      phrases: ['atmosphere only'],
      values: ['lakeshore'],
    },
  ],
};
const atmosphereOnlyProfile: EventProfile = {
  ...PROFILES[0]!,
  region: 'lakeshore',
};
const atmosphereOnlyDiscovery = resolve({}, '', {
  events: [EVENTS[0]!],
  profiles: [atmosphereOnlyProfile],
  rules: atmosphereOnlyRules,
});
assert(
  !atmosphereOnlyDiscovery.facets.regions.some(
    (option) => option.value === 'atmosphere-only',
  ),
  'illustrated atmosphere values never become geographic region facets',
);
assertEqual(
  resolve({ regionRuleId: 'atmosphere-only' }, '', {
    events: [EVENTS[0]!],
    profiles: [atmosphereOnlyProfile],
    rules: atmosphereOnlyRules,
  }).mode,
  'empty',
  'region filtering fails closed without explicitly curated event IDs',
);

const fallbackGoodells = EVENTS.find((event) => event.id === 'goodells-fair')!;
const fallbackProfile = PROFILES.find((profile) => profile.id === 'goodells-fair')!;
assertEqual(
  ids(resolve({ regionRuleId: 'thumb' }, '', {
    events: [fallbackGoodells],
    profiles: [fallbackProfile],
  })),
  ['goodells-fair'],
  'region curation recognizes the checked-in fallback event ID',
);
const publishedGoodells: AtlasEvent = {
  ...fallbackGoodells,
  id: 'st-clair-county-4-h-youth-fair',
};
const publishedGoodellsProfile: EventProfile = {
  ...fallbackProfile,
  id: publishedGoodells.id,
  slug: publishedGoodells.id,
};
assertEqual(
  ids(resolve({ regionRuleId: 'thumb' }, '', {
    events: [publishedGoodells],
    profiles: [publishedGoodellsProfile],
  })),
  ['st-clair-county-4-h-youth-fair'],
  'region curation recognizes the reviewed published event ID',
);

const fairFacet = idle.facets.categories.find((option) => option.value === 'Fairs');
const thumbFacet = idle.facets.regions.find((option) => option.value === 'thumb');
const goodellsFacet = idle.facets.cities.find((option) => option.value === 'Goodells');
const liveFacet = idle.facets.dates.find(
  (option) => option.value.kind === 'live-upcoming',
);
const julyFacet = idle.facets.dates.find(
  (option) => option.value.kind === 'month' && option.value.month === 7,
);
const augustFacet = idle.facets.dates.find(
  (option) => option.value.kind === 'month' && option.value.month === 8,
);
assertEqual(fairFacet?.count, 3, 'category facets include deterministic counts');
assertEqual(thumbFacet?.count, 2, 'region facets count only supplied reviewed IDs');
assertEqual(goodellsFacet?.count, 1, 'city facets expose exact counts');
assertEqual(liveFacet?.count, 7, 'live/upcoming facet count matches rail eligibility');
assertEqual(julyFacet?.count, 4, 'reviewed July facet count excludes unsafe dates');
assertEqual(augustFacet?.count, 4, 'reviewed August facet count includes range overlap');

const categoryRefined = resolve({ category: 'Fairs' });
const categoryRefinedLiveFacet = categoryRefined.facets.dates.find(
  (option) => option.value.kind === 'live-upcoming',
);
assertEqual(
  categoryRefinedLiveFacet?.count,
  2,
  'facet counts respect the other active refinements',
);
assert(
  categoryRefined.facets.categories.find((option) => option.value === 'Fairs')
    ?.isSelected === true,
  'facet responses identify the selected option',
);

const beforeEventsJson = JSON.stringify(EVENTS);
const beforeProfilesJson = JSON.stringify(PROFILES);
const railBefore = selectEventRailEvents(EVENTS, {
  now: NOW,
  timeZone: MICHIGAN_STATE_ATLAS_CONFIG.defaultTimeZone,
}).map((event) => event.id);
resolve({
  category: 'Fairs',
  regionRuleId: 'thumb',
  date: { kind: 'live-upcoming' },
});
const railAfter = selectEventRailEvents(EVENTS, {
  now: NOW,
  timeZone: MICHIGAN_STATE_ATLAS_CONFIG.defaultTimeZone,
}).map((event) => event.id);
assertEqual(JSON.stringify(EVENTS), beforeEventsJson, 'discovery never mutates event input');
assertEqual(JSON.stringify(PROFILES), beforeProfilesJson, 'discovery never mutates profile input');
assertEqual(railAfter, railBefore, 'discovery never changes rail eligibility or order');

console.log('Home Atlas discovery validation passed.');
