import { EVENT_PROFILES } from './eventProfiles';
import { ATLAS_EVENTS, type AtlasEvent } from './events';
import type { EventProfile } from './eventProfileTypes';

export type ExactEventIntentMatch = {
  eventId: string;
  eventName: string;
};

export function normalizeExactEventIntentValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\band\b/g, ' and ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesBoundedPhrase(
  normalizedQuery: string,
  normalizedPhrase: string,
) {
  return ` ${normalizedQuery} `.includes(` ${normalizedPhrase} `);
}

function isLongIdentityPhrase(normalizedValue: string) {
  return normalizedValue.length >= 12 || normalizedValue.split(' ').length >= 3;
}

function uniqueIdentityValues(values: Array<string | undefined | null>) {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeExactEventIntentValue(value ?? ''))
        .filter(Boolean),
    ),
  );
}

export function resolveExactEventIntent(
  queryText: string,
  events: readonly AtlasEvent[] = ATLAS_EVENTS,
  profiles: readonly EventProfile[] = EVENT_PROFILES,
): ExactEventIntentMatch | null {
  const normalizedQuery = normalizeExactEventIntentValue(queryText);

  if (!normalizedQuery) return null;

  const profileById = new Map(
    profiles.map((profile) => [profile.id, profile]),
  );
  const matches = new Map<string, ExactEventIntentMatch>();

  for (const event of events) {
    const profile = profileById.get(event.id);
    const identityValues = uniqueIdentityValues([
      event.id,
      event.name,
      ...(event.searchAliases ?? []),
      profile?.id,
      profile?.slug,
      profile?.name,
      ...(profile?.alternateNames ?? []),
    ]);

    const hasExactIdentityMatch = identityValues.some(
      (identityValue) => normalizedQuery === identityValue,
    );
    const hasBoundedLongIdentityPhrase = identityValues.some(
      (identityValue) =>
        isLongIdentityPhrase(identityValue) &&
        includesBoundedPhrase(normalizedQuery, identityValue),
    );

    if (hasExactIdentityMatch || hasBoundedLongIdentityPhrase) {
      matches.set(event.id, { eventId: event.id, eventName: event.name });
    }
  }

  return matches.size === 1 ? Array.from(matches.values())[0] : null;
}
