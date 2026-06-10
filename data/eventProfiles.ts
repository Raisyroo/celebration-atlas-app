import { toEventProfiles } from './eventProfileAdapter';
import type { EventProfile } from './eventProfileTypes';
import { ATLAS_EVENTS } from './events';

export const EVENT_PROFILES: EventProfile[] = toEventProfiles(ATLAS_EVENTS);

type SearchableProfileShape = EventProfile & {
  geography?: {
    locationLabel?: string;
    city?: string;
    county?: string;
    region?: string;
    state?: string;
  };
  discovery?: {
    categories?: string[];
    eventTypes?: string[];
    tags?: string[];
  };
  timing?: {
    season?: string;
  };
};

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function getSearchTokens(query: string): string[] {
  return normalizeSearchValue(query).split(' ').filter(Boolean);
}

function uniqueSearchValues(values: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const normalizedValue = normalizeSearchValue(value ?? '');

    if (!normalizedValue || seen.has(normalizedValue)) {
      continue;
    }

    seen.add(normalizedValue);
    uniqueValues.push(normalizedValue);
  }

  return uniqueValues;
}

function getSearchableProfileValues(profile: EventProfile): string[] {
  const searchableProfile = profile as SearchableProfileShape;

  return uniqueSearchValues([
    profile.name,
    ...(profile.alternateNames ?? []),
    profile.shortDescription,
    profile.locationName,
    searchableProfile.geography?.locationLabel,
    profile.city,
    searchableProfile.geography?.city,
    profile.county,
    searchableProfile.geography?.county,
    profile.region,
    searchableProfile.geography?.region,
    profile.state,
    searchableProfile.geography?.state,
    ...profile.categories,
    ...(searchableProfile.discovery?.categories ?? []),
    ...profile.eventTypes,
    ...(searchableProfile.discovery?.eventTypes ?? []),
    ...profile.tags,
    ...(searchableProfile.discovery?.tags ?? []),
    profile.season,
    searchableProfile.timing?.season,
  ]);
}

export function getEventProfileSearchText(profile: EventProfile): string {
  return getSearchableProfileValues(profile).join(' ');
}

export function getEventProfileById(id: string): EventProfile | undefined {
  return EVENT_PROFILES.find((profile) => profile.id === id);
}

export function getEventProfileBySlug(slug: string): EventProfile | undefined {
  return EVENT_PROFILES.find((profile) => profile.slug === slug);
}

export function getFeaturedEventProfiles(): EventProfile[] {
  return EVENT_PROFILES.filter((profile) => profile.featured === true);
}

export function getEventProfilesByCategory(category: string): EventProfile[] {
  const normalizedCategory = normalizeSearchValue(category);

  if (!normalizedCategory) {
    return [];
  }

  return EVENT_PROFILES.filter((profile) =>
    profile.categories.some((profileCategory) => normalizeSearchValue(profileCategory) === normalizedCategory)
  );
}

export function searchEventProfiles(query: string): EventProfile[] {
  const normalizedQuery = normalizeSearchValue(query);
  const queryTokens = getSearchTokens(normalizedQuery);

  if (!normalizedQuery || queryTokens.length === 0) {
    return [];
  }

  const matchingProfiles = new Map<string, EventProfile>();

  for (const profile of EVENT_PROFILES) {
    const searchText = getEventProfileSearchText(profile);
    const profileTokens = getSearchTokens(searchText);
    const matchesFullQuery = searchText.includes(normalizedQuery);
    const matchesEveryQueryToken = queryTokens.every((token) =>
      profileTokens.some((profileToken) => profileToken.includes(token))
    );
    const matchesAnyQueryToken = queryTokens.some((token) =>
      profileTokens.some((profileToken) => profileToken.includes(token))
    );

    if (matchesFullQuery || matchesEveryQueryToken || matchesAnyQueryToken) {
      matchingProfiles.set(profile.id, profile);
    }
  }

  return Array.from(matchingProfiles.values());
}
