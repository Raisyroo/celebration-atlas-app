import { toEventProfiles } from './eventProfileAdapter';
import type { EventProfile } from './eventProfileTypes';
import { ATLAS_EVENTS } from './events';

export const EVENT_PROFILES: EventProfile[] = toEventProfiles(ATLAS_EVENTS);

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function getSearchableProfileValues(profile: EventProfile): string[] {
  return [
    profile.name,
    profile.shortDescription,
    profile.locationName,
    profile.city,
    profile.county,
    ...profile.categories,
    ...profile.eventTypes,
    ...profile.tags,
    ...(profile.alternateNames ?? []),
  ].filter((value): value is string => Boolean(value));
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

  if (!normalizedQuery) {
    return [];
  }

  return EVENT_PROFILES.filter((profile) =>
    getSearchableProfileValues(profile).some((value) =>
      normalizeSearchValue(value).includes(normalizedQuery)
    )
  );
}
