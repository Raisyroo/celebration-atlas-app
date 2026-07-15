import {
  getEventRailStatus,
  selectEventRailEvents,
  type EventRailStatus,
} from './eventRail.ts';
import {
  normalizeHomeAtlasSearchValue,
  type HomeAtlasMonth,
  type HomeAtlasRegionRule,
  type HomeAtlasSearchReason,
  type HomeAtlasSearchResponse,
  type HomeAtlasSearchRules,
} from './homeAtlasSearch.ts';
import { resolveReviewedAtlasEventTiming } from './stateAtlasEventProfile.ts';
import type { AtlasEvent } from './events.ts';
import type { EventProfile, EventTimingProfile } from './eventProfileTypes.ts';
import type { StateAtlasConfig } from './stateAtlasConfig.ts';

export type HomeAtlasDiscoveryDateFilter =
  | { kind: 'any' }
  | { kind: 'live-upcoming' }
  | { kind: 'month'; month: HomeAtlasMonth };

export type HomeAtlasDiscoveryFilters = {
  category?: string | null;
  regionRuleId?: string | null;
  city?: string | null;
  date?: HomeAtlasDiscoveryDateFilter | null;
};

export type ResolvedHomeAtlasDiscoveryFilters = {
  category: string | null;
  regionRuleId: string | null;
  city: string | null;
  date: HomeAtlasDiscoveryDateFilter;
};

export type HomeAtlasDiscoveryMode = 'idle' | 'exact' | 'results' | 'empty';

export type HomeAtlasDiscoveryResultRow = {
  event: AtlasEvent;
  profile?: EventProfile;
  score: number | null;
  reasons: readonly HomeAtlasSearchReason[];
  reviewedStartDate: string | null;
  railStatus: EventRailStatus | null;
};

export type HomeAtlasDiscoveryFacetOption<T> = {
  id: string;
  label: string;
  value: T;
  count: number;
  isSelected: boolean;
  isDisabled: boolean;
};

export type HomeAtlasDiscoveryFacets = {
  categories: readonly HomeAtlasDiscoveryFacetOption<string>[];
  regions: readonly HomeAtlasDiscoveryFacetOption<string>[];
  cities: readonly HomeAtlasDiscoveryFacetOption<string>[];
  dates: readonly HomeAtlasDiscoveryFacetOption<HomeAtlasDiscoveryDateFilter>[];
};

export type HomeAtlasDiscoveryInput = {
  events: readonly AtlasEvent[];
  profiles: readonly EventProfile[];
  stateConfig: StateAtlasConfig;
  searchRules: HomeAtlasSearchRules;
  searchResponse: HomeAtlasSearchResponse;
  filters?: HomeAtlasDiscoveryFilters;
  now: Date;
};

export type HomeAtlasDiscoveryResponse = {
  mode: HomeAtlasDiscoveryMode;
  resultRows: readonly HomeAtlasDiscoveryResultRow[];
  events: readonly AtlasEvent[];
  activeFilterCount: number;
  filters: ResolvedHomeAtlasDiscoveryFilters;
  facets: HomeAtlasDiscoveryFacets;
  exactMatch: HomeAtlasSearchResponse['exactMatch'];
  statusText: string | null;
};

export const EMPTY_HOME_ATLAS_DISCOVERY_FILTERS = {
  category: null,
  regionRuleId: null,
  city: null,
  date: { kind: 'any' },
} as const satisfies ResolvedHomeAtlasDiscoveryFilters;

type DiscoveryFacetKey = 'category' | 'region' | 'city' | 'date';

type DiscoveryCandidate = HomeAtlasDiscoveryResultRow & {
  city: string;
  reviewedTiming: EventTimingProfile | null;
  reviewedMonths: ReadonlySet<HomeAtlasMonth>;
};

type DiscoveryContext = {
  regionRuleById: ReadonlyMap<string, HomeAtlasRegionRule>;
  liveUpcomingIds: ReadonlySet<string>;
};

const MONTH_LABELS: Readonly<Record<HomeAtlasMonth, string>> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

function cleanFilterValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isHomeAtlasMonth(value: number): value is HomeAtlasMonth {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

function normalizeDateFilter(
  value: HomeAtlasDiscoveryDateFilter | null | undefined,
): HomeAtlasDiscoveryDateFilter {
  if (value?.kind === 'live-upcoming') return { kind: 'live-upcoming' };
  if (value?.kind === 'month' && isHomeAtlasMonth(value.month)) {
    return { kind: 'month', month: value.month };
  }
  return { kind: 'any' };
}

function normalizeFilters(
  filters: HomeAtlasDiscoveryFilters | undefined,
): ResolvedHomeAtlasDiscoveryFilters {
  return {
    category: cleanFilterValue(filters?.category),
    regionRuleId: cleanFilterValue(filters?.regionRuleId),
    city: cleanFilterValue(filters?.city),
    date: normalizeDateFilter(filters?.date),
  };
}

function getActiveFilterCount(filters: ResolvedHomeAtlasDiscoveryFilters): number {
  return Number(Boolean(filters.category)) +
    Number(Boolean(filters.regionRuleId)) +
    Number(Boolean(filters.city)) +
    Number(filters.date.kind !== 'any');
}

function getProfileByEventId(
  profiles: readonly EventProfile[],
): ReadonlyMap<string, EventProfile> {
  const profileByEventId = new Map<string, EventProfile>();
  for (const profile of profiles) {
    if (!profileByEventId.has(profile.id)) profileByEventId.set(profile.id, profile);
  }
  return profileByEventId;
}

function getReviewedTiming(
  event: AtlasEvent,
  profile: EventProfile | undefined,
  defaultTimeZone: string,
): EventTimingProfile | null {
  const eventTiming = resolveReviewedAtlasEventTiming(
    event.dateRange,
    defaultTimeZone,
  );
  if (eventTiming) return eventTiming;

  const profileDateRange = profile?.dateRange;
  if (!profileDateRange) return null;

  return resolveReviewedAtlasEventTiming(
    {
      startDate: profileDateRange.startDate,
      endDate: profileDateRange.endDate,
      timeZone: profileDateRange.timezone,
      isEstimated: profileDateRange.isEstimated,
    },
    defaultTimeZone,
  );
}

function getReviewedMonths(
  timing: EventTimingProfile | null,
): ReadonlySet<HomeAtlasMonth> {
  const startMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(timing?.dateStart ?? '');
  const endMatch = /^(\d{4})-(\d{2})-\d{2}$/.exec(
    timing?.dateEnd ?? timing?.dateStart ?? '',
  );
  if (!startMatch || !endMatch) return new Set<HomeAtlasMonth>();

  const startMonthIndex = Number(startMatch[1]) * 12 + Number(startMatch[2]) - 1;
  const endMonthIndex = Number(endMatch[1]) * 12 + Number(endMatch[2]) - 1;
  if (endMonthIndex < startMonthIndex) return new Set<HomeAtlasMonth>();

  const months = new Set<HomeAtlasMonth>();
  if (endMonthIndex - startMonthIndex >= 11) {
    for (let month = 1; month <= 12; month += 1) {
      if (isHomeAtlasMonth(month)) months.add(month);
    }
    return months;
  }

  for (let monthIndex = startMonthIndex; monthIndex <= endMonthIndex; monthIndex += 1) {
    const month = (monthIndex % 12) + 1;
    if (isHomeAtlasMonth(month)) months.add(month);
  }
  return months;
}

function getCity(event: AtlasEvent, profile: EventProfile | undefined): string {
  const profileCity = profile?.city.trim();
  if (profileCity) return profileCity;
  return event.location.split(',')[0]?.trim() || event.location.trim();
}

function createCatalogCandidates(
  events: readonly AtlasEvent[],
  profileByEventId: ReadonlyMap<string, EventProfile>,
  stateConfig: StateAtlasConfig,
  now: Date,
): readonly DiscoveryCandidate[] {
  const seenEventIds = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];

  for (const event of events) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);
    const profile = profileByEventId.get(event.id);
    const reviewedTiming = getReviewedTiming(
      event,
      profile,
      stateConfig.defaultTimeZone,
    );

    candidates.push({
      event,
      profile,
      score: null,
      reasons: [],
      reviewedStartDate: reviewedTiming?.dateStart ?? null,
      railStatus: getEventRailStatus(event, {
        now,
        timeZone: stateConfig.defaultTimeZone,
      }),
      city: getCity(event, profile),
      reviewedTiming,
      reviewedMonths: getReviewedMonths(reviewedTiming),
    });
  }

  return candidates;
}

function withSearchResult(
  candidate: DiscoveryCandidate,
  score: number,
  reasons: readonly HomeAtlasSearchReason[],
): DiscoveryCandidate {
  return { ...candidate, score, reasons };
}

function createSearchCandidates(
  catalogCandidates: readonly DiscoveryCandidate[],
  searchResponse: HomeAtlasSearchResponse,
): readonly DiscoveryCandidate[] {
  const candidateByEventId = new Map(
    catalogCandidates.map((candidate) => [candidate.event.id, candidate]),
  );
  const seenEventIds = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];

  for (const result of searchResponse.results) {
    if (seenEventIds.has(result.event.id)) continue;
    const catalogCandidate = candidateByEventId.get(result.event.id);
    if (!catalogCandidate) continue;
    seenEventIds.add(result.event.id);
    candidates.push(withSearchResult(catalogCandidate, result.score, result.reasons));
  }

  return candidates;
}

function normalizeComparable(value: string): string {
  return normalizeHomeAtlasSearchValue(value);
}

function matchesExactValue(value: string, filter: string): boolean {
  return normalizeComparable(value) === normalizeComparable(filter);
}

function matchesRegionRule(
  candidate: DiscoveryCandidate,
  rule: HomeAtlasRegionRule,
): boolean {
  // Illustrated atmosphere labels are not geographic truth. Discovery regions
  // therefore fail closed to IDs explicitly curated by the state search rules.
  return Boolean(
    rule.eventIds?.some((eventId) => eventId === candidate.event.id),
  );
}

function matchesDateFilter(
  candidate: DiscoveryCandidate,
  filter: HomeAtlasDiscoveryDateFilter,
  context: DiscoveryContext,
): boolean {
  if (filter.kind === 'any') return true;
  if (filter.kind === 'live-upcoming') {
    return context.liveUpcomingIds.has(candidate.event.id);
  }
  return candidate.reviewedMonths.has(filter.month);
}

function matchesFilters(
  candidate: DiscoveryCandidate,
  filters: ResolvedHomeAtlasDiscoveryFilters,
  context: DiscoveryContext,
  omittedFacet?: DiscoveryFacetKey,
): boolean {
  if (
    omittedFacet !== 'category' &&
    filters.category &&
    !matchesExactValue(candidate.event.category, filters.category)
  ) {
    return false;
  }

  if (omittedFacet !== 'region' && filters.regionRuleId) {
    const rule = context.regionRuleById.get(filters.regionRuleId);
    if (!rule || !matchesRegionRule(candidate, rule)) return false;
  }

  if (
    omittedFacet !== 'city' &&
    filters.city &&
    !matchesExactValue(candidate.city, filters.city)
  ) {
    return false;
  }

  if (
    omittedFacet !== 'date' &&
    !matchesDateFilter(candidate, filters.date, context)
  ) {
    return false;
  }

  return true;
}

function compareNormalizedText(left: string, right: string): number {
  const normalizedLeft = normalizeComparable(left);
  const normalizedRight = normalizeComparable(right);
  if (normalizedLeft < normalizedRight) return -1;
  if (normalizedLeft > normalizedRight) return 1;
  return 0;
}

function compareFilterOnlyCandidates(
  left: DiscoveryCandidate,
  right: DiscoveryCandidate,
): number {
  if (left.reviewedStartDate && right.reviewedStartDate) {
    if (left.reviewedStartDate < right.reviewedStartDate) return -1;
    if (left.reviewedStartDate > right.reviewedStartDate) return 1;
  } else if (left.reviewedStartDate) {
    return -1;
  } else if (right.reviewedStartDate) {
    return 1;
  }

  const nameComparison = compareNormalizedText(left.event.name, right.event.name);
  if (nameComparison !== 0) return nameComparison;
  const normalizedIdComparison = compareNormalizedText(left.event.id, right.event.id);
  if (normalizedIdComparison !== 0) return normalizedIdComparison;
  if (left.event.id < right.event.id) return -1;
  if (left.event.id > right.event.id) return 1;
  return 0;
}

function sortFilterOnlyCandidates(
  candidates: readonly DiscoveryCandidate[],
  filters: ResolvedHomeAtlasDiscoveryFilters,
  stateConfig: StateAtlasConfig,
  now: Date,
): readonly DiscoveryCandidate[] {
  if (filters.date.kind === 'live-upcoming') {
    const candidateByEventId = new Map(
      candidates.map((candidate) => [candidate.event.id, candidate]),
    );
    return selectEventRailEvents(
      candidates.map((candidate) => candidate.event),
      { now, timeZone: stateConfig.defaultTimeZone },
    ).flatMap((event) => {
      const candidate = candidateByEventId.get(event.id);
      return candidate ? [candidate] : [];
    });
  }

  return [...candidates].sort(compareFilterOnlyCandidates);
}

function toRegionLabel(ruleId: string): string {
  return ruleId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join(' ');
}

function isDateFilterSelected(
  current: HomeAtlasDiscoveryDateFilter,
  option: HomeAtlasDiscoveryDateFilter,
): boolean {
  if (current.kind !== option.kind) return false;
  return current.kind !== 'month' ||
    (option.kind === 'month' && current.month === option.month);
}

function createFacets(
  catalogCandidates: readonly DiscoveryCandidate[],
  facetBaseCandidates: readonly DiscoveryCandidate[],
  filters: ResolvedHomeAtlasDiscoveryFilters,
  searchRules: HomeAtlasSearchRules,
  context: DiscoveryContext,
): HomeAtlasDiscoveryFacets {
  const categoryByNormalizedValue = new Map<string, string>();
  for (const candidate of catalogCandidates) {
    const category = candidate.event.category.trim();
    const normalizedCategory = normalizeComparable(category);
    if (category && !categoryByNormalizedValue.has(normalizedCategory)) {
      categoryByNormalizedValue.set(normalizedCategory, category);
    }
  }

  const categories = [...categoryByNormalizedValue.values()]
    .sort(compareNormalizedText)
    .map((category) => {
      const count = facetBaseCandidates.filter(
        (candidate) =>
          matchesFilters(candidate, filters, context, 'category') &&
          matchesExactValue(candidate.event.category, category),
      ).length;
      const isSelected = Boolean(
        filters.category && matchesExactValue(filters.category, category),
      );
      return {
        id: `category:${normalizeComparable(category).replaceAll(' ', '-')}`,
        label: category,
        value: category,
        count,
        isSelected,
        isDisabled: count === 0 && !isSelected,
      };
    });

  const regions = searchRules.regionRules
    .filter((rule) =>
      catalogCandidates.some((candidate) => matchesRegionRule(candidate, rule)),
    )
    .map((rule) => {
      const count = facetBaseCandidates.filter(
        (candidate) =>
          matchesFilters(candidate, filters, context, 'region') &&
          matchesRegionRule(candidate, rule),
      ).length;
      const isSelected = filters.regionRuleId === rule.id;
      return {
        id: `region:${rule.id}`,
        label: toRegionLabel(rule.id),
        value: rule.id,
        count,
        isSelected,
        isDisabled: count === 0 && !isSelected,
      };
    })
    .sort((left, right) => compareNormalizedText(left.label, right.label));

  const cityByNormalizedValue = new Map<string, string>();
  for (const candidate of catalogCandidates) {
    const city = candidate.city.trim();
    const normalizedCity = normalizeComparable(city);
    if (city && !cityByNormalizedValue.has(normalizedCity)) {
      cityByNormalizedValue.set(normalizedCity, city);
    }
  }

  const cities = [...cityByNormalizedValue.values()]
    .sort(compareNormalizedText)
    .map((city) => {
      const count = facetBaseCandidates.filter(
        (candidate) =>
          matchesFilters(candidate, filters, context, 'city') &&
          matchesExactValue(candidate.city, city),
      ).length;
      const isSelected = Boolean(filters.city && matchesExactValue(filters.city, city));
      return {
        id: `city:${normalizeComparable(city).replaceAll(' ', '-')}`,
        label: city,
        value: city,
        count,
        isSelected,
        isDisabled: count === 0 && !isSelected,
      };
    });

  const availableMonths = new Set<HomeAtlasMonth>();
  for (const candidate of catalogCandidates) {
    for (const month of candidate.reviewedMonths) availableMonths.add(month);
  }
  const dateOptions: HomeAtlasDiscoveryDateFilter[] = [
    { kind: 'any' },
    { kind: 'live-upcoming' },
    ...[...availableMonths]
      .sort((left, right) => left - right)
      .map((month): HomeAtlasDiscoveryDateFilter => ({ kind: 'month', month })),
  ];
  const dates = dateOptions.map((dateOption) => {
    const count = facetBaseCandidates.filter(
      (candidate) =>
        matchesFilters(candidate, filters, context, 'date') &&
        matchesDateFilter(candidate, dateOption, context),
    ).length;
    const isSelected = isDateFilterSelected(filters.date, dateOption);
    const id = dateOption.kind === 'month'
      ? `date:month:${dateOption.month}`
      : `date:${dateOption.kind}`;
    const label = dateOption.kind === 'any'
      ? 'Any date'
      : dateOption.kind === 'live-upcoming'
        ? 'Live & upcoming'
        : MONTH_LABELS[dateOption.month];

    return {
      id,
      label,
      value: dateOption,
      count,
      isSelected,
      isDisabled: count === 0 && !isSelected,
    };
  });

  return { categories, regions, cities, dates };
}

function toPublicResultRow(candidate: DiscoveryCandidate): HomeAtlasDiscoveryResultRow {
  return {
    event: candidate.event,
    profile: candidate.profile,
    score: candidate.score,
    reasons: candidate.reasons,
    reviewedStartDate: candidate.reviewedStartDate,
    railStatus: candidate.railStatus,
  };
}

function createStatusText(
  mode: HomeAtlasDiscoveryMode,
  resultCount: number,
  stateName: string,
  normalizedQuery: string,
  activeFilterCount: number,
  exactEventName?: string,
): string | null {
  if (mode === 'idle') return null;
  if (mode === 'exact' && exactEventName) return `Opening ${exactEventName}.`;

  const queryScope = normalizedQuery ? ` “${normalizedQuery}”` : '';
  const filterScope = activeFilterCount > 0
    ? ` with ${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}`
    : '';
  if (resultCount === 0) {
    return `No ${stateName} celebrations match${queryScope}${filterScope}.`;
  }

  return `${resultCount} ${stateName} ${
    resultCount === 1 ? 'celebration matches' : 'celebrations match'
  }${queryScope}${filterScope}.`;
}

export function resolveHomeAtlasDiscovery(
  input: HomeAtlasDiscoveryInput,
): HomeAtlasDiscoveryResponse {
  const {
    events,
    profiles,
    stateConfig,
    searchRules,
    searchResponse,
  } = input;
  const now = input.now;
  const filters = normalizeFilters(input.filters);
  const activeFilterCount = getActiveFilterCount(filters);
  const hasQuery = Boolean(searchResponse.normalizedQuery.trim());
  const profileByEventId = getProfileByEventId(profiles);
  const catalogCandidates = createCatalogCandidates(
    events,
    profileByEventId,
    stateConfig,
    now,
  );
  const candidateByEventId = new Map(
    catalogCandidates.map((candidate) => [candidate.event.id, candidate]),
  );
  const liveUpcomingEvents = selectEventRailEvents(events, {
    now,
    timeZone: stateConfig.defaultTimeZone,
  });
  const context: DiscoveryContext = {
    regionRuleById: new Map(
      searchRules.regionRules.map((rule) => [rule.id, rule]),
    ),
    liveUpcomingIds: new Set(liveUpcomingEvents.map((event) => event.id)),
  };
  const searchCandidates = createSearchCandidates(
    catalogCandidates,
    searchResponse,
  );
  const facetBaseCandidates = hasQuery && !searchResponse.exactMatch
    ? searchCandidates
    : catalogCandidates;
  const facets = createFacets(
    catalogCandidates,
    facetBaseCandidates,
    filters,
    searchRules,
    context,
  );

  if (searchResponse.exactMatch) {
    const exactCandidate = candidateByEventId.get(searchResponse.exactMatch.eventId);
    if (exactCandidate) {
      const exactSearchResult = searchResponse.results.find(
        (result) => result.event.id === exactCandidate.event.id,
      );
      const exactRow = withSearchResult(
        exactCandidate,
        exactSearchResult?.score ?? 10_000,
        exactSearchResult?.reasons ?? ['exact-identity'],
      );
      const resultRows = [toPublicResultRow(exactRow)];
      return {
        mode: 'exact',
        resultRows,
        events: resultRows.map((row) => row.event),
        activeFilterCount,
        filters,
        facets,
        exactMatch: searchResponse.exactMatch,
        statusText: createStatusText(
          'exact',
          1,
          stateConfig.identity.name,
          searchResponse.normalizedQuery,
          activeFilterCount,
          exactCandidate.event.name,
        ),
      };
    }
  }

  if (!hasQuery && activeFilterCount === 0) {
    return {
      mode: 'idle',
      resultRows: [],
      events: [],
      activeFilterCount,
      filters,
      facets,
      exactMatch: null,
      statusText: null,
    };
  }

  const baseCandidates = hasQuery ? searchCandidates : catalogCandidates;
  const matchingCandidates = baseCandidates.filter((candidate) =>
    matchesFilters(candidate, filters, context),
  );
  const orderedCandidates = hasQuery
    ? matchingCandidates
    : sortFilterOnlyCandidates(
        matchingCandidates,
        filters,
        stateConfig,
        now,
      );
  const resultRows = orderedCandidates.map(toPublicResultRow);
  const mode: HomeAtlasDiscoveryMode = resultRows.length > 0 ? 'results' : 'empty';

  return {
    mode,
    resultRows,
    events: resultRows.map((row) => row.event),
    activeFilterCount,
    filters,
    facets,
    exactMatch: null,
    statusText: createStatusText(
      mode,
      resultRows.length,
      stateConfig.identity.name,
      searchResponse.normalizedQuery,
      activeFilterCount,
    ),
  };
}
