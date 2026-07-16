import type { AtlasEvent } from './events.ts';
import type { EventProfile, EventSeason } from './eventProfileTypes.ts';
import { getEventRailStatus, type EventRailStatus } from './eventRail.ts';
import type { StateAtlasConfig } from './stateAtlasConfig.ts';

export type HomeAtlasValueRule = {
  id: string;
  phrases: readonly [string, ...string[]];
  values: readonly [string, ...string[]];
};

export type HomeAtlasRegionRule = {
  id: string;
  phrases: readonly [string, ...string[]];
  values?: readonly string[];
  eventIds?: readonly string[];
};

export type HomeAtlasMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type HomeAtlasMonthRule = {
  month: HomeAtlasMonth;
  phrases: readonly [string, ...string[]];
};

export type HomeAtlasSeasonRule = {
  season: EventSeason;
  phrases: readonly [string, ...string[]];
};

export type HomeAtlasStatusRule = {
  status: EventRailStatus;
  phrases: readonly [string, ...string[]];
};

export type HomeAtlasCuratedRule = {
  id: string;
  phrases: readonly [string, ...string[]];
  eventIds: readonly string[];
};

export type HomeAtlasSearchRules = {
  scopePhrases: readonly string[];
  conversationalPhrases: readonly string[];
  categoryRules: readonly HomeAtlasValueRule[];
  regionRules: readonly HomeAtlasRegionRule[];
  monthRules: readonly HomeAtlasMonthRule[];
  seasonRules: readonly HomeAtlasSeasonRule[];
  statusRules: readonly HomeAtlasStatusRule[];
  curatedRules: readonly HomeAtlasCuratedRule[];
};

export type HomeAtlasSearchReason =
  | 'exact-identity'
  | 'identity'
  | 'place'
  | 'category'
  | 'region'
  | 'month'
  | 'season'
  | 'status'
  | 'curated';

export type HomeAtlasSearchResult = {
  event: AtlasEvent;
  profile?: EventProfile;
  score: number;
  reasons: readonly HomeAtlasSearchReason[];
};

export type HomeAtlasSearchResponse = {
  normalizedQuery: string;
  queryTokens: readonly string[];
  freeTokens: readonly string[];
  exactMatch: {
    eventId: string;
    eventName: string;
  } | null;
  results: readonly HomeAtlasSearchResult[];
};

export type HomeAtlasSearchInput = {
  query: string;
  events: readonly AtlasEvent[];
  profiles: readonly EventProfile[];
  stateConfig: StateAtlasConfig;
  rules: HomeAtlasSearchRules;
  now?: Date;
};

type MatchedRule<T> = {
  rule: T;
  consumedIndexes: ReadonlySet<number>;
};

type CandidateSearchData = {
  identityValues: readonly string[];
  identityTokens: ReadonlySet<string>;
  placeTokens: ReadonlySet<string>;
  categoryValues: readonly string[];
  regionValues: readonly string[];
  months: ReadonlySet<number>;
  seasons: ReadonlySet<EventSeason>;
  status: EventRailStatus | null;
};

const SEASON_BY_MONTH: Readonly<Record<HomeAtlasMonth, EventSeason>> = {
  1: 'winter',
  2: 'winter',
  3: 'spring',
  4: 'spring',
  5: 'spring',
  6: 'summer',
  7: 'summer',
  8: 'summer',
  9: 'fall',
  10: 'fall',
  11: 'fall',
  12: 'winter',
};

const REASON_ORDER: readonly HomeAtlasSearchReason[] = [
  'exact-identity',
  'identity',
  'place',
  'category',
  'region',
  'month',
  'season',
  'status',
  'curated',
];

export function normalizeHomeAtlasSearchValue(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[\u2018\u2019\u201A\u201B']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalToken(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ies') && token.length > 4) return `${token.slice(0, -3)}y`;
  if (token.endsWith('sses')) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokenize(value: string): string[] {
  const normalized = normalizeHomeAtlasSearchValue(value);
  return normalized ? normalized.split(' ').map(canonicalToken) : [];
}

function tokenizeExactIdentity(value: string): string[] {
  const normalized = normalizeHomeAtlasSearchValue(value);
  return normalized ? normalized.split(' ') : [];
}

function uniqueValues(values: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeHomeAtlasSearchValue(value ?? '');
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function findPhraseIndexes(tokens: readonly string[], phrase: string): Set<number> {
  const phraseTokens = tokenize(phrase);
  const indexes = new Set<number>();
  if (phraseTokens.length === 0 || phraseTokens.length > tokens.length) return indexes;

  for (let start = 0; start <= tokens.length - phraseTokens.length; start += 1) {
    if (phraseTokens.every((token, offset) => tokens[start + offset] === token)) {
      phraseTokens.forEach((_, offset) => indexes.add(start + offset));
    }
  }

  return indexes;
}

function matchRules<T extends { phrases: readonly string[] }>(
  tokens: readonly string[],
  rules: readonly T[],
): MatchedRule<T>[] {
  const matches: MatchedRule<T>[] = [];

  for (const rule of rules) {
    const consumedIndexes = new Set<number>();
    for (const phrase of rule.phrases) {
      for (const index of findPhraseIndexes(tokens, phrase)) consumedIndexes.add(index);
    }
    if (consumedIndexes.size > 0) matches.push({ rule, consumedIndexes });
  }

  return matches;
}

function preferMostSpecificMatches<T>(matches: readonly MatchedRule<T>[]): MatchedRule<T>[] {
  const mostConsumedIndexes = Math.max(
    0,
    ...matches.map((match) => match.consumedIndexes.size),
  );
  return matches.filter((match) => match.consumedIndexes.size === mostConsumedIndexes);
}

function collectPhraseIndexes(tokens: readonly string[], phrases: readonly string[]): Set<number> {
  const indexes = new Set<number>();
  for (const phrase of phrases) {
    for (const index of findPhraseIndexes(tokens, phrase)) indexes.add(index);
  }
  return indexes;
}

function collectRecognizedShortTokens(
  stateConfig: StateAtlasConfig,
  rules: HomeAtlasSearchRules,
): Set<string> {
  const phrases = [
    stateConfig.identity.name,
    stateConfig.identity.slug,
    stateConfig.identity.postalCode,
    ...stateConfig.identity.databaseStateValues,
    ...rules.scopePhrases,
    ...rules.conversationalPhrases,
    ...rules.categoryRules.flatMap((rule) => rule.phrases),
    ...rules.regionRules.flatMap((rule) => rule.phrases),
    ...rules.monthRules.flatMap((rule) => rule.phrases),
    ...rules.seasonRules.flatMap((rule) => rule.phrases),
    ...rules.statusRules.flatMap((rule) => rule.phrases),
    ...rules.curatedRules.flatMap((rule) => rule.phrases),
  ];

  return new Set(phrases.flatMap(tokenize).filter((token) => token.length < 3));
}

function getProfileByEventId(profiles: readonly EventProfile[]): Map<string, EventProfile> {
  const profileById = new Map<string, EventProfile>();
  for (const profile of profiles) {
    if (!profileById.has(profile.id)) profileById.set(profile.id, profile);
  }
  return profileById;
}

function getIdentityValues(event: AtlasEvent, profile?: EventProfile): string[] {
  return uniqueValues([
    event.id,
    event.name,
    ...(event.searchAliases ?? []),
    profile?.id,
    profile?.slug,
    profile?.name,
    ...(profile?.alternateNames ?? []),
    ...(profile?.historicalNames ?? []),
    profile?.localNickname,
  ]);
}

function withoutIndexes(tokens: readonly string[], indexes: ReadonlySet<number>): string[] {
  return tokens.filter((_, index) => !indexes.has(index));
}

function startsWithTokens(tokens: readonly string[], phraseTokens: readonly string[]) {
  return phraseTokens.length <= tokens.length &&
    phraseTokens.every((token, index) => tokens[index] === token);
}

function endsWithTokens(tokens: readonly string[], phraseTokens: readonly string[]) {
  if (phraseTokens.length > tokens.length) return false;
  const offset = tokens.length - phraseTokens.length;
  return phraseTokens.every((token, index) => tokens[offset + index] === token);
}

function buildBoundaryTrimmedIdentityQueries(
  queryTokens: readonly string[],
  framingPhrases: readonly string[],
): Set<string> {
  const phraseTokenLists = uniqueValues(framingPhrases)
    .map(tokenizeExactIdentity)
    .filter((tokens) => tokens.length > 0);
  const queued: string[][] = [[...queryTokens]];
  const seen = new Set<string>();

  for (let index = 0; index < queued.length; index += 1) {
    const tokens = queued[index];
    const key = tokens.join(' ');
    if (!key || seen.has(key)) continue;
    seen.add(key);

    for (const phraseTokens of phraseTokenLists) {
      if (startsWithTokens(tokens, phraseTokens)) {
        queued.push(tokens.slice(phraseTokens.length));
      }
      if (endsWithTokens(tokens, phraseTokens)) {
        queued.push(tokens.slice(0, -phraseTokens.length));
      }
    }
  }

  return seen;
}

function identityKey(value: string): string {
  return tokenizeExactIdentity(value).join(' ');
}

function resolveExactMatch(
  identityQueries: ReadonlySet<string>,
  events: readonly AtlasEvent[],
  profileById: ReadonlyMap<string, EventProfile>,
): { eventId: string; eventName: string } | null {
  if (identityQueries.size === 0) return null;
  const matches = new Map<string, { eventId: string; eventName: string }>();

  for (const event of events) {
    const identityValues = getIdentityValues(event, profileById.get(event.id));
    if (
      identityValues.some((value) => identityQueries.has(identityKey(value)))
    ) {
      matches.set(event.id, { eventId: event.id, eventName: event.name });
    }
  }

  return matches.size === 1 ? [...matches.values()][0] : null;
}

function parseReviewedSearchDate(value: string | undefined) {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ordinal = Date.UTC(year, month - 1, day);
  const parsed = new Date(ordinal);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, ordinal };
}

function addReviewedDateRangeMonths(
  months: Set<number>,
  startDate: string | undefined,
  endDate: string | undefined,
  isEstimated: boolean | undefined,
) {
  if (isEstimated !== false) return;
  const start = parseReviewedSearchDate(startDate);
  if (!start) return;

  const end = endDate ? parseReviewedSearchDate(endDate) : null;
  if (endDate && (!end || end.ordinal < start.ordinal)) return;

  const startYear = start.year;
  const startMonth = start.month;
  months.add(startMonth);

  if (!end) return;
  const endYear = end.year;
  const endMonth = end.month;

  const startIndex = startYear * 12 + startMonth - 1;
  const endIndex = endYear * 12 + endMonth - 1;
  if (endIndex < startIndex || endIndex - startIndex > 24) return;
  for (let index = startIndex; index <= endIndex; index += 1) months.add((index % 12) + 1);
}

function isCalendarMonth(value: number): value is HomeAtlasMonth {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function getCandidateSearchData(
  event: AtlasEvent,
  profile: EventProfile | undefined,
  now: Date,
  defaultTimeZone: string,
): CandidateSearchData {
  const identityValues = getIdentityValues(event, profile);
  const identityTokens = new Set(identityValues.flatMap(tokenize));
  const cityFromLocation = event.location.split(',')[0]?.trim();
  const placeTokens = new Set(
    uniqueValues([
      cityFromLocation,
      profile?.city,
      profile?.county,
      profile?.locationName,
    ]).flatMap(tokenize),
  );
  const categoryValues = uniqueValues([
    event.category,
  ]);
  const regionValues = uniqueValues([
    event.regionAtmosphere,
    profile?.region,
  ]);
  const months = new Set<number>();
  addReviewedDateRangeMonths(
    months,
    event.dateRange?.startDate,
    event.dateRange?.endDate,
    event.dateRange?.isEstimated,
  );
  addReviewedDateRangeMonths(
    months,
    profile?.dateRange?.startDate,
    profile?.dateRange?.endDate,
    profile?.dateRange?.isEstimated,
  );
  const seasons = new Set<EventSeason>();
  for (const month of months) {
    if (isCalendarMonth(month)) seasons.add(SEASON_BY_MONTH[month]);
  }
  const eventStatus = getEventRailStatus(event, {
    now,
    timeZone: defaultTimeZone,
  });
  const profileDateRange = profile?.dateRange;
  const profileStatus = !eventStatus && profileDateRange?.isEstimated === false
    ? getEventRailStatus(
        {
          dateRange: {
            startDate: profileDateRange.startDate,
            endDate: profileDateRange.endDate,
            timeZone: profileDateRange.timezone,
            isEstimated: false,
          },
        },
        { now, timeZone: defaultTimeZone },
      )
    : null;

  return {
    identityValues,
    identityTokens,
    placeTokens,
    categoryValues,
    regionValues,
    months,
    seasons,
    status: eventStatus ?? profileStatus,
  };
}

function valueMatches(candidateValues: readonly string[], targetValue: string): boolean {
  const targetTokens = tokenize(targetValue);
  if (targetTokens.length === 0) return false;
  return candidateValues.some((candidateValue) => {
    const candidateTokens = new Set(tokenize(candidateValue));
    return targetTokens.every((token) => candidateTokens.has(token));
  });
}

function compareStable(left: HomeAtlasSearchResult, right: HomeAtlasSearchResult): number {
  if (left.score !== right.score) return right.score - left.score;
  const leftName = normalizeHomeAtlasSearchValue(left.event.name);
  const rightName = normalizeHomeAtlasSearchValue(right.event.name);
  if (leftName < rightName) return -1;
  if (leftName > rightName) return 1;
  const leftId = normalizeHomeAtlasSearchValue(left.event.id);
  const rightId = normalizeHomeAtlasSearchValue(right.event.id);
  return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
}

export function searchHomeAtlas(input: HomeAtlasSearchInput): HomeAtlasSearchResponse {
  const { query, events, profiles, stateConfig, rules } = input;
  const now = input.now ?? new Date();
  const normalizedQuery = normalizeHomeAtlasSearchValue(query);
  const queryTokens = tokenize(normalizedQuery);
  const emptyResponse = (): HomeAtlasSearchResponse => ({
    normalizedQuery,
    queryTokens,
    freeTokens: [],
    exactMatch: null,
    results: [],
  });
  if (queryTokens.length === 0 || events.length === 0) return emptyResponse();

  const categoryMatches = preferMostSpecificMatches(
    matchRules(queryTokens, rules.categoryRules),
  );
  const regionMatches = matchRules(queryTokens, rules.regionRules);
  const monthMatches = matchRules(queryTokens, rules.monthRules);
  const seasonMatches = matchRules(queryTokens, rules.seasonRules);
  const statusMatches = matchRules(queryTokens, rules.statusRules);
  const curatedMatches = matchRules(queryTokens, rules.curatedRules);
  const stateScopePhrases = uniqueValues([
    stateConfig.identity.name,
    stateConfig.identity.slug,
    stateConfig.identity.postalCode,
    ...stateConfig.identity.databaseStateValues,
  ]);
  const scopePhrases = [...stateScopePhrases, ...rules.scopePhrases];
  const recognizedShortTokens = collectRecognizedShortTokens(stateConfig, rules);
  const removedPhraseIndexesFor = (tokens: readonly string[]) => {
    const indexes = collectPhraseIndexes(tokens, [
      ...scopePhrases,
      ...rules.conversationalPhrases,
    ]);
    return indexes;
  };
  const nonIdentityIndexes = removedPhraseIndexesFor(queryTokens);
  const exactQueryTokens = tokenizeExactIdentity(normalizedQuery);
  const identityQueries = buildBoundaryTrimmedIdentityQueries(
    exactQueryTokens,
    [
      ...scopePhrases,
      ...rules.conversationalPhrases,
    ],
  );
  const profileById = getProfileByEventId(profiles);
  const exactMatch = resolveExactMatch(
    identityQueries,
    events,
    profileById,
  );

  if (exactMatch) {
    const event = events.find((candidate) => candidate.id === exactMatch.eventId);
    if (!event) return emptyResponse();
    return {
      normalizedQuery,
      queryTokens,
      freeTokens: [],
      exactMatch,
      results: [{
        event,
        profile: profileById.get(event.id),
        score: 10_000,
        reasons: ['exact-identity'],
      }],
    };
  }

  const consumedIndexes = new Set(nonIdentityIndexes);
  for (const match of [
    ...categoryMatches,
    ...regionMatches,
    ...monthMatches,
    ...seasonMatches,
    ...statusMatches,
    ...curatedMatches,
  ]) {
    for (const index of match.consumedIndexes) consumedIndexes.add(index);
  }
  const freeTokens = Array.from(
    new Set(
      withoutIndexes(queryTokens, consumedIndexes).filter(
        (token) => token.length >= 3 || recognizedShortTokens.has(token),
      ),
    ),
  );
  const hasStructuredIntent =
    categoryMatches.length > 0 ||
    regionMatches.length > 0 ||
    monthMatches.length > 0 ||
    seasonMatches.length > 0 ||
    statusMatches.length > 0 ||
    curatedMatches.length > 0;
  if (!hasStructuredIntent && freeTokens.length === 0) {
    return { ...emptyResponse(), queryTokens, freeTokens };
  }

  const catalogIds = new Set(events.map((event) => event.id));
  const results: HomeAtlasSearchResult[] = [];

  for (const event of events) {
    const profile = profileById.get(event.id);
    const data = getCandidateSearchData(
      event,
      profile,
      now,
      stateConfig.defaultTimeZone,
    );
    const reasons = new Set<HomeAtlasSearchReason>();
    let score = 0;

    if (categoryMatches.length > 0) {
      const matchesCategory = categoryMatches.every(({ rule }) =>
        rule.values.some((value) => valueMatches(data.categoryValues, value)),
      );
      if (!matchesCategory) continue;
      reasons.add('category');
      score += 120;
    }

    if (regionMatches.length > 0) {
      const matchesRegion = regionMatches.some(({ rule }) =>
        (rule.eventIds ?? []).some((eventId) => catalogIds.has(eventId) && eventId === event.id) ||
        (rule.values ?? []).some((value) => valueMatches(data.regionValues, value)),
      );
      if (!matchesRegion) continue;
      reasons.add('region');
      score += 140;
    }

    if (monthMatches.length > 0) {
      if (!monthMatches.some(({ rule }) => data.months.has(rule.month))) continue;
      reasons.add('month');
      score += 100;
    }

    if (seasonMatches.length > 0) {
      if (!seasonMatches.some(({ rule }) => data.seasons.has(rule.season))) continue;
      reasons.add('season');
      score += 100;
    }

    if (statusMatches.length > 0) {
      if (!statusMatches.some(({ rule }) => data.status === rule.status)) continue;
      reasons.add('status');
      score += 110;
    }

    if (curatedMatches.length > 0) {
      const matchesCurated = curatedMatches.some(({ rule }) =>
        rule.eventIds.some((eventId) => catalogIds.has(eventId) && eventId === event.id),
      );
      if (!matchesCurated) continue;
      reasons.add('curated');
      score += 200;
    }

    if (freeTokens.length > 0) {
      const matchesFreeTokens = freeTokens.every(
        (token) => data.identityTokens.has(token) || data.placeTokens.has(token),
      );
      if (!matchesFreeTokens) continue;
      const identityMatches = freeTokens.filter((token) => data.identityTokens.has(token)).length;
      const placeMatches = freeTokens.filter((token) => data.placeTokens.has(token)).length;
      if (identityMatches > 0) reasons.add('identity');
      if (placeMatches > 0) reasons.add('place');
      score += 280 + identityMatches * 35 + placeMatches * 25;
    }

    results.push({
      event,
      profile,
      score,
      reasons: REASON_ORDER.filter((reason) => reasons.has(reason)),
    });
  }

  return {
    normalizedQuery,
    queryTokens,
    freeTokens,
    exactMatch: null,
    results: results.sort(compareStable),
  };
}
