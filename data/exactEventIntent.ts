import {
  normalizeHomeAtlasSearchValue,
  searchHomeAtlas,
} from './homeAtlasSearch.ts';
import type { HomeAtlasSearchRules } from './homeAtlasSearch.ts';
import type { AtlasEvent } from './events.ts';
import type { EventProfile } from './eventProfileTypes.ts';
import type { StateAtlasConfig } from './stateAtlasConfig.ts';

export type ExactEventIntentMatch = {
  eventId: string;
  eventName: string;
};

export function normalizeExactEventIntentValue(value: string): string {
  return normalizeHomeAtlasSearchValue(value);
}

/**
 * Compatibility helper for consumers that only need the unique exact match.
 * Catalog, profile, state, and rule inputs are deliberately explicit so one
 * state's events can never leak into another state's Atlas search.
 */
export function resolveExactEventIntent(
  queryText: string,
  events: readonly AtlasEvent[],
  profiles: readonly EventProfile[],
  stateConfig: StateAtlasConfig,
  rules: HomeAtlasSearchRules,
): ExactEventIntentMatch | null {
  return searchHomeAtlas({
    query: queryText,
    events,
    profiles,
    stateConfig,
    rules,
  }).exactMatch;
}
