export const HOME_DISCOVERY_HISTORY_KEY = '__celebrationAtlasDiscovery';

export type HomeDiscoveryUrlState = {
  query: string;
};

export type HomeDiscoveryExactNavigationState =
  | 'idle'
  | 'pending'
  | 'suppressed';

export type HomeDiscoveryHistoryEntry = {
  version: 1;
  scrollY: number;
  railScrollLeft: number;
  openClusterId: string | null;
  selectedResultId: string | null;
  exactNavigation: HomeDiscoveryExactNavigationState;
};

const DEFAULT_HISTORY_ENTRY: HomeDiscoveryHistoryEntry = {
  version: 1,
  scrollY: 0,
  railScrollLeft: 0,
  openClusterId: null,
  selectedResultId: null,
  exactNavigation: 'idle',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const normalizeQuery = (value: string | null | undefined) =>
  value?.trim().replace(/\s+/g, ' ') ?? '';

const normalizePosition = (value: unknown) =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;

const normalizeOptionalId = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const normalizeExactNavigation = (
  value: unknown,
): HomeDiscoveryExactNavigationState =>
  value === 'pending' || value === 'suppressed' ? value : 'idle';

export function parseHomeDiscoveryUrlState(
  searchParams: Pick<URLSearchParams, 'get'>,
): HomeDiscoveryUrlState {
  return {
    query: normalizeQuery(searchParams.get('q')),
  };
}

export function serializeHomeDiscoveryUrlState(
  currentSearchParams: string,
  state: HomeDiscoveryUrlState,
): string {
  const searchParams = new URLSearchParams(currentSearchParams);
  const query = normalizeQuery(state.query);

  if (query) {
    searchParams.set('q', query);
  } else {
    searchParams.delete('q');
  }

  const serialized = searchParams.toString();
  return serialized ? `/?${serialized}` : '/';
}

export function readHomeDiscoveryHistoryEntry(
  historyState: unknown,
): HomeDiscoveryHistoryEntry | null {
  if (!isRecord(historyState)) return null;
  const candidate = historyState[HOME_DISCOVERY_HISTORY_KEY];
  if (!isRecord(candidate) || candidate.version !== 1) return null;

  return {
    version: 1,
    scrollY: normalizePosition(candidate.scrollY),
    railScrollLeft: normalizePosition(candidate.railScrollLeft),
    openClusterId: normalizeOptionalId(candidate.openClusterId),
    selectedResultId: normalizeOptionalId(candidate.selectedResultId),
    exactNavigation: normalizeExactNavigation(candidate.exactNavigation),
  };
}

export function mergeHomeDiscoveryHistoryEntry(
  historyState: unknown,
  patch: Partial<Omit<HomeDiscoveryHistoryEntry, 'version'>>,
): Record<string, unknown> {
  const baseState = isRecord(historyState) ? { ...historyState } : {};
  const currentEntry =
    readHomeDiscoveryHistoryEntry(historyState) ?? DEFAULT_HISTORY_ENTRY;
  const nextEntry: HomeDiscoveryHistoryEntry = {
    version: 1,
    scrollY: normalizePosition(patch.scrollY ?? currentEntry.scrollY),
    railScrollLeft: normalizePosition(
      patch.railScrollLeft ?? currentEntry.railScrollLeft,
    ),
    openClusterId:
      patch.openClusterId === undefined
        ? currentEntry.openClusterId
        : normalizeOptionalId(patch.openClusterId),
    selectedResultId:
      patch.selectedResultId === undefined
        ? currentEntry.selectedResultId
        : normalizeOptionalId(patch.selectedResultId),
    exactNavigation: normalizeExactNavigation(
      patch.exactNavigation ?? currentEntry.exactNavigation,
    ),
  };

  return {
    ...baseState,
    [HOME_DISCOVERY_HISTORY_KEY]: nextEntry,
  };
}
