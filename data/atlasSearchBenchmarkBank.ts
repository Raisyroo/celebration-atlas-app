import type { AtlasEvent } from './events.ts';
import type { EventProfile } from './eventProfileTypes.ts';

export const ATLAS_SEARCH_BENCHMARK_REFERENCE_DATE =
  '2026-08-08T12:00:00-04:00';

export type AtlasSearchBenchmark = {
  id: string;
  intent: string;
  query: string;
  evaluationMode: 'offline-grounding' | 'model-required';
  groundingProbeQuery: string;
  expectedEventIds: readonly string[];
  expectedCueFragmentsByEventId: Readonly<Record<string, readonly string[]>>;
};

function fixtureEvent(args: {
  id: string;
  name: string;
  location: string;
  longitude: number;
  category?: AtlasEvent['category'];
  startDate?: string;
  endDate?: string;
}): AtlasEvent {
  return {
    id: args.id,
    name: args.name,
    location: args.location,
    latitude: 42.8,
    longitude: args.longitude,
    atmosphereLabel: 'ASK benchmark fixture',
    blurb: 'Stable synthetic fixture used only by the ASK benchmark suite.',
    category: args.category ?? 'Festivals',
    dateRange: args.startDate
      ? {
          startDate: args.startDate,
          endDate: args.endDate,
          isEstimated: false,
        }
      : undefined,
    x: 50,
    y: 50,
  };
}

export const ATLAS_SEARCH_BENCHMARK_EVENTS: readonly AtlasEvent[] = [
  fixtureEvent({
    id: 'benchmark-harbor-lights',
    name: 'Harbor Lights Celebration',
    location: 'Bayview, MI',
    longitude: -83.01,
  }),
  fixtureEvent({
    id: 'benchmark-river-race',
    name: 'River Canoe Race',
    location: 'Riverton, MI',
    longitude: -83.02,
  }),
  fixtureEvent({
    id: 'benchmark-tattoo-expo',
    name: 'Lakeshore Tattoo Expo',
    location: 'Port Union, MI',
    longitude: -83.03,
    category: 'Arts & Culture',
  }),
  fixtureEvent({
    id: 'benchmark-lantern-parade',
    name: 'Old Town Lantern Festival',
    location: 'Heritage, MI',
    longitude: -83.04,
  }),
  fixtureEvent({
    id: 'benchmark-grand-hotel',
    name: 'Grand Hotel Heritage Weekend',
    location: 'Island Point, MI',
    longitude: -83.05,
  }),
  fixtureEvent({
    id: 'benchmark-maker-market',
    name: 'Community Maker Market',
    location: 'Artfield, MI',
    longitude: -83.06,
    category: 'Arts & Culture',
  }),
  fixtureEvent({
    id: 'benchmark-family-weekend',
    name: 'Kids Discovery Weekend',
    location: 'Midland, MI',
    longitude: -83.07,
    startDate: '2026-08-08',
    endDate: '2026-08-09',
  }),
  fixtureEvent({
    id: 'benchmark-free-jazz',
    name: 'Downtown Jazz Evening',
    location: 'Detroit, MI',
    longitude: -83.08,
    category: 'Music',
  }),
];

function fixtureProfile(event: AtlasEvent): EventProfile {
  return {
    id: event.id,
    slug: event.id,
    name: event.name,
    eventTypes: [event.category],
    categories: [event.category],
    tags: [],
    city: event.location.split(',')[0] ?? event.location,
    state: 'Michigan',
    stateSlug: 'michigan',
    locationName: event.location,
    dateRange: event.dateRange
      ? {
          startDate: event.dateRange.startDate,
          endDate: event.dateRange.endDate,
          displayText: event.dateRange.endDate
            ? `${event.dateRange.startDate} to ${event.dateRange.endDate}`
            : event.dateRange.startDate,
          isEstimated: false,
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

export const ATLAS_SEARCH_BENCHMARK_PROFILES: readonly EventProfile[] =
  ATLAS_SEARCH_BENCHMARK_EVENTS.map(fixtureProfile);

export const ATLAS_SEARCH_BENCHMARK_KNOWLEDGE = new Map<string, unknown>([
  ['benchmark-harbor-lights', {
    setting: 'Waterfront',
    finale: 'Fireworks',
  }],
  ['benchmark-river-race', {
    setting: 'Waterfront',
    activity: 'Canoe racing',
  }],
  ['benchmark-tattoo-expo', {
    artform: 'Tattoo art',
  }],
  ['benchmark-lantern-parade', {
    tradition: 'Lantern parade',
  }],
  ['benchmark-grand-hotel', {
    history: {
      established: '1887',
    },
  }],
  ['benchmark-maker-market', {
    participation: 'Participants can sell art',
  }],
  ['benchmark-family-weekend', {
    audience: 'Family friendly',
    timing: 'Weekend',
  }],
  ['benchmark-free-jazz', {
    benchmarkFit: 'Free jazz public transit',
    admission: 'Free',
    music: 'Jazz',
    access: 'Public transit',
  }],
]);

/**
 * The natural-language query is the durable product benchmark. A separate
 * grounding probe protects evidence extraction and cues during ordinary
 * builds without making the build depend on a live model or mutable catalog.
 */
export const ATLAS_SEARCH_BENCHMARKS = [
  {
    id: 'waterside-fireworks',
    intent: 'Combine an approximate setting with a specific spectacle.',
    query: 'Waterside events with fireworks',
    evaluationMode: 'model-required',
    groundingProbeQuery: 'waterfront fireworks',
    expectedEventIds: ['benchmark-harbor-lights'],
    expectedCueFragmentsByEventId: {
      'benchmark-harbor-lights': ['Fireworks', 'Waterfront'],
    },
  },
  {
    id: 'tattoo-events',
    intent: 'Find events by a distinctive activity or art form.',
    query: 'Tattoo events',
    evaluationMode: 'offline-grounding',
    groundingProbeQuery: 'tattoo',
    expectedEventIds: ['benchmark-tattoo-expo'],
    expectedCueFragmentsByEventId: {
      'benchmark-tattoo-expo': ['Tattoo'],
    },
  },
  {
    id: 'parade-events',
    intent: 'Find a recurring event tradition nested inside a broader festival.',
    query: 'Events with parades',
    evaluationMode: 'model-required',
    groundingProbeQuery: 'lantern parade',
    expectedEventIds: ['benchmark-lantern-parade'],
    expectedCueFragmentsByEventId: {
      'benchmark-lantern-parade': ['Lantern Parade'],
    },
  },
  {
    id: 'oldest-events',
    intent: 'Compare historical facts and infer a superlative.',
    query: 'Oldest events',
    evaluationMode: 'model-required',
    groundingProbeQuery: 'established 1887',
    expectedEventIds: ['benchmark-grand-hotel'],
    expectedCueFragmentsByEventId: {
      'benchmark-grand-hotel': ['Established 1887'],
    },
  },
  {
    id: 'participant-income',
    intent: 'Interpret a first-person participation and earning goal.',
    query: 'Events I can make money at as a participant',
    evaluationMode: 'model-required',
    groundingProbeQuery: 'participants sell art',
    expectedEventIds: ['benchmark-maker-market'],
    expectedCueFragmentsByEventId: {
      'benchmark-maker-market': ['Participants', 'Sell Art'],
    },
  },
  {
    id: 'family-this-weekend',
    intent: 'Combine audience suitability with a relative date.',
    query: 'Family friendly events this weekend',
    evaluationMode: 'model-required',
    groundingProbeQuery: 'family friendly weekend',
    expectedEventIds: ['benchmark-family-weekend'],
    expectedCueFragmentsByEventId: {
      'benchmark-family-weekend': ['Weekend', 'Family Friendly'],
    },
  },
  {
    id: 'free-jazz-transit',
    intent: 'Intersect price, music, and practical access requirements.',
    query: 'Free jazz events reachable by public transit',
    evaluationMode: 'offline-grounding',
    groundingProbeQuery: 'free jazz public transit',
    expectedEventIds: ['benchmark-free-jazz'],
    expectedCueFragmentsByEventId: {
      'benchmark-free-jazz': ['Free Jazz Public Transit'],
    },
  },
] as const satisfies readonly AtlasSearchBenchmark[];
