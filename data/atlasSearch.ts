import type { AtlasEvent } from './events.ts';
import type { EventProfile } from './eventProfileTypes.ts';
import {
  normalizeHomeAtlasSearchValue,
  type HomeAtlasSearchResponse,
} from './homeAtlasSearch.ts';

export const ATLAS_SEARCH_RESULT_SCHEMA_VERSION = 2 as const;

export type AtlasSearchResultSource =
  | 'atlas-fast-path'
  | 'atlas-model'
  | 'atlas-fallback';

export type AtlasSearchRankingItem = {
  eventId: string;
  score: number;
  matchCues: string[];
};

const MAX_MATCH_CUES = 3;
const MAX_MATCH_CUE_LENGTH = 54;

/**
 * The public ASK contract deliberately contains no generated prose or model
 * reasoning. Ordered IDs drive the map, rail, and Experience Deck; compact
 * match cues are copied from retained Atlas facts selected by evidence ID.
 * Provider-specific interpretation stays behind the route boundary.
 */
export type AtlasSearchResultSet = {
  schemaVersion: typeof ATLAS_SEARCH_RESULT_SCHEMA_VERSION;
  query: string;
  normalizedQuery: string;
  stateSlug: string;
  source: AtlasSearchResultSource;
  eventIds: string[];
  resultCount: number;
  ranking: AtlasSearchRankingItem[];
};

type ParseAtlasSearchResultSetOptions = {
  query: string;
  stateSlug: string;
  candidateEventIds: ReadonlySet<string>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isResultSource(value: unknown): value is AtlasSearchResultSource {
  return value === 'atlas-fast-path'
    || value === 'atlas-model'
    || value === 'atlas-fallback';
}

function normalizeMatchCues(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_MATCH_CUES) return null;

  const cues: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string') return null;
    const cue = item.replace(/\s+/g, ' ').trim();
    const normalized = normalizeHomeAtlasSearchValue(cue);
    if (!cue || cue.length > MAX_MATCH_CUE_LENGTH || !normalized) return null;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    cues.push(cue);
  }

  return cues;
}

export function createAtlasSearchResultSet(args: {
  query: string;
  stateSlug: string;
  source: AtlasSearchResultSource;
  ranking: readonly AtlasSearchRankingItem[];
  candidateEventIds?: ReadonlySet<string>;
}): AtlasSearchResultSet {
  const seen = new Set<string>();
  const ranking = args.ranking.flatMap((item) => {
    const eventId = item.eventId.trim();
    if (
      !eventId
      || seen.has(eventId)
      || (args.candidateEventIds && !args.candidateEventIds.has(eventId))
      || !Number.isFinite(item.score)
    ) {
      return [];
    }

    seen.add(eventId);
    const matchCues = normalizeMatchCues(item.matchCues);
    if (!matchCues) return [];

    return [{
      eventId,
      score: Math.min(1, Math.max(0, item.score)),
      matchCues,
    }];
  });

  return {
    schemaVersion: ATLAS_SEARCH_RESULT_SCHEMA_VERSION,
    query: args.query.trim(),
    normalizedQuery: normalizeHomeAtlasSearchValue(args.query),
    stateSlug: args.stateSlug.trim().toLowerCase(),
    source: args.source,
    eventIds: ranking.map((item) => item.eventId),
    resultCount: ranking.length,
    ranking,
  };
}

export function parseAtlasSearchResultSet(
  value: unknown,
  options: ParseAtlasSearchResultSetOptions,
): AtlasSearchResultSet | null {
  if (!isRecord(value)) return null;

  const expectedNormalizedQuery = normalizeHomeAtlasSearchValue(options.query);
  const expectedStateSlug = options.stateSlug.trim().toLowerCase();
  if (
    value.schemaVersion !== ATLAS_SEARCH_RESULT_SCHEMA_VERSION
    || typeof value.query !== 'string'
    || typeof value.normalizedQuery !== 'string'
    || value.normalizedQuery !== expectedNormalizedQuery
    || typeof value.stateSlug !== 'string'
    || value.stateSlug.trim().toLowerCase() !== expectedStateSlug
    || !isResultSource(value.source)
    || !Array.isArray(value.eventIds)
    || !Array.isArray(value.ranking)
    || !Number.isInteger(value.resultCount)
  ) {
    return null;
  }

  const ranking: AtlasSearchRankingItem[] = [];
  const seen = new Set<string>();
  for (const item of value.ranking) {
    if (!isRecord(item)) return null;
    const eventId = typeof item.eventId === 'string' ? item.eventId.trim() : '';
    const score = typeof item.score === 'number' ? item.score : Number.NaN;
    const matchCues = normalizeMatchCues(item.matchCues);
    if (
      !eventId
      || seen.has(eventId)
      || !options.candidateEventIds.has(eventId)
      || !Number.isFinite(score)
      || score < 0
      || score > 1
      || !matchCues
    ) {
      return null;
    }
    seen.add(eventId);
    ranking.push({ eventId, score, matchCues });
  }

  const eventIds = value.eventIds;
  if (
    eventIds.length !== ranking.length
    || value.resultCount !== ranking.length
    || eventIds.some(
      (eventId, index) =>
        typeof eventId !== 'string' || eventId !== ranking[index]?.eventId,
    )
  ) {
    return null;
  }

  return {
    schemaVersion: ATLAS_SEARCH_RESULT_SCHEMA_VERSION,
    query: value.query.trim(),
    normalizedQuery: expectedNormalizedQuery,
    stateSlug: expectedStateSlug,
    source: value.source,
    eventIds: [...eventIds] as string[],
    resultCount: ranking.length,
    ranking,
  };
}

export function applyAtlasSearchResultSet(args: {
  resultSet: AtlasSearchResultSet | null;
  fallback: HomeAtlasSearchResponse;
  events: readonly AtlasEvent[];
  profiles: readonly EventProfile[];
}): HomeAtlasSearchResponse {
  const { resultSet, fallback, events, profiles } = args;
  if (
    !resultSet
    || resultSet.normalizedQuery !== fallback.normalizedQuery
    || fallback.exactMatch
  ) {
    return fallback;
  }

  const eventById = new Map(events.map((event) => [event.id, event]));
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));

  return {
    normalizedQuery: fallback.normalizedQuery,
    queryTokens: fallback.queryTokens,
    freeTokens: fallback.freeTokens,
    exactMatch: null,
    results: resultSet.ranking.flatMap((item) => {
      const event = eventById.get(item.eventId);
      if (!event) return [];
      return [{
        event,
        profile: profileById.get(event.id),
        score: 1_000 + Math.round(item.score * 1_000),
        reasons: ['semantic' as const],
        matchCues: item.matchCues,
      }];
    }),
  };
}
