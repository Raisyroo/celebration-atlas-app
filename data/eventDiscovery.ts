import { EVENT_PROFILES, searchEventProfiles } from './eventProfiles';
import type { EventProfile } from './eventProfileTypes';

export type EventDiscoveryFilters = {
  query?: string;
  category?: string;
  eventType?: string;
  tag?: string;
  city?: string;
  county?: string;
  region?: string;
  state?: string;
  season?: EventProfile['season'];
  familyFriendly?: EventProfile['familyFriendly'];
  indoorOutdoor?: EventProfile['indoorOutdoor'];
  freePaid?: EventProfile['priceType'];
  featured?: EventProfile['featured'];
  hiddenGem?: EventProfile['hiddenGem'];
  coverageLevel?: EventProfile['coverageLevel'];
};

function normalizeDiscoveryValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchesOptionalString(value: string | undefined, filter: string | undefined): boolean {
  if (filter === undefined) {
    return true;
  }

  const normalizedFilter = normalizeDiscoveryValue(filter);

  if (!normalizedFilter) {
    return true;
  }

  return value !== undefined && normalizeDiscoveryValue(value) === normalizedFilter;
}

function matchesOptionalStringList(values: string[], filter: string | undefined): boolean {
  if (filter === undefined) {
    return true;
  }

  const normalizedFilter = normalizeDiscoveryValue(filter);

  if (!normalizedFilter) {
    return true;
  }

  return values.some((value) => normalizeDiscoveryValue(value) === normalizedFilter);
}

function matchesOptionalValue<T>(value: T | undefined, filter: T | undefined): boolean {
  if (filter === undefined) {
    return true;
  }

  return value !== undefined && value === filter;
}

function uniqueDiscoveryStrings(values: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const trimmedValue = value?.trim();

    if (!trimmedValue) {
      continue;
    }

    const normalizedValue = normalizeDiscoveryValue(trimmedValue);

    if (seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    uniqueValues.push(trimmedValue);
  }

  return uniqueValues;
}

function uniqueDiscoveryStringLists(values: string[][]): string[] {
  return uniqueDiscoveryStrings(values.flat());
}

export function filterEventProfiles(filters: EventDiscoveryFilters): EventProfile[] {
  const query = filters.query?.trim();
  const queryProfileIds = query ? new Set(searchEventProfiles(query).map((profile) => profile.id)) : undefined;

  return EVENT_PROFILES.filter((profile) => {
    if (queryProfileIds && !queryProfileIds.has(profile.id)) {
      return false;
    }

    return (
      matchesOptionalStringList(profile.categories, filters.category) &&
      matchesOptionalStringList(profile.eventTypes, filters.eventType) &&
      matchesOptionalStringList(profile.tags, filters.tag) &&
      matchesOptionalString(profile.city, filters.city) &&
      matchesOptionalString(profile.county, filters.county) &&
      matchesOptionalString(profile.region, filters.region) &&
      matchesOptionalString(profile.state, filters.state) &&
      matchesOptionalValue(profile.season, filters.season) &&
      matchesOptionalValue(profile.familyFriendly, filters.familyFriendly) &&
      matchesOptionalValue(profile.indoorOutdoor, filters.indoorOutdoor) &&
      matchesOptionalValue(profile.priceType, filters.freePaid) &&
      matchesOptionalValue(profile.featured, filters.featured) &&
      matchesOptionalValue(profile.hiddenGem, filters.hiddenGem) &&
      matchesOptionalValue(profile.coverageLevel, filters.coverageLevel)
    );
  });
}

export function getDiscoveryCategories(): string[] {
  return uniqueDiscoveryStringLists(EVENT_PROFILES.map((profile) => profile.categories));
}

export function getDiscoveryEventTypes(): string[] {
  return uniqueDiscoveryStringLists(EVENT_PROFILES.map((profile) => profile.eventTypes));
}

export function getDiscoveryRegions(): string[] {
  return uniqueDiscoveryStrings(EVENT_PROFILES.map((profile) => profile.region));
}

export function getDiscoverySeasons(): string[] {
  return uniqueDiscoveryStrings(EVENT_PROFILES.map((profile) => profile.season));
}

export function getDiscoveryTags(): string[] {
  return uniqueDiscoveryStringLists(EVENT_PROFILES.map((profile) => profile.tags));
}
