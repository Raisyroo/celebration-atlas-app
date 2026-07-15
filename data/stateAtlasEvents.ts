import { ATLAS_EVENTS, type AtlasEvent } from './events.ts';

const STATE_ATLAS_EVENT_CATALOGS: Readonly<Record<string, readonly AtlasEvent[]>> = {
  michigan: ATLAS_EVENTS,
};

function normalizedName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function getStateAtlasEventCatalog(stateSlug: string): readonly AtlasEvent[] {
  return STATE_ATLAS_EVENT_CATALOGS[stateSlug.trim().toLowerCase()] ?? [];
}

export function reconcileStateAtlasEvents(
  localEvents: readonly AtlasEvent[],
  approvedEvents: readonly AtlasEvent[],
): AtlasEvent[] {
  const approvedById = new Map(approvedEvents.map((event) => [event.id, event]));
  const approvedAliasCounts = new Map<string, number>();
  const localNameCounts = new Map<string, number>();

  for (const event of approvedEvents) {
    const keys = new Set([event.name, ...(event.searchAliases ?? [])].map(normalizedName));
    for (const key of keys) {
      approvedAliasCounts.set(key, (approvedAliasCounts.get(key) ?? 0) + 1);
    }
  }

  for (const event of localEvents) {
    const key = normalizedName(event.name);
    localNameCounts.set(key, (localNameCounts.get(key) ?? 0) + 1);
  }

  const approvedByUniqueAlias = new Map<string, AtlasEvent>();
  for (const event of approvedEvents) {
    const keys = new Set([event.name, ...(event.searchAliases ?? [])].map(normalizedName));
    for (const key of keys) {
      if (approvedAliasCounts.get(key) === 1) approvedByUniqueAlias.set(key, event);
    }
  }

  const resolvedApprovedIds = new Set<string>();
  const reconciledLocalEvents = localEvents.map((event) => {
    const byId = approvedById.get(event.id);
    const nameKey = normalizedName(event.name);
    const byUniqueAlias = localNameCounts.get(nameKey) === 1
      ? approvedByUniqueAlias.get(nameKey)
      : undefined;
    const approved = byId ?? byUniqueAlias;
    if (approved) resolvedApprovedIds.add(approved.id);
    return approved ?? event;
  });

  return [
    ...reconciledLocalEvents,
    ...approvedEvents.filter((event) => !resolvedApprovedIds.has(event.id)),
  ];
}
