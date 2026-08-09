import type {
  AtlasSearchRankingItem,
  AtlasSearchResultSource,
} from './atlasSearch.ts';

export const ATLAS_SEARCH_DIAGNOSTIC_SCHEMA_VERSION = 1 as const;
export const ATLAS_SEARCH_DIAGNOSTIC_LOG_PREFIX = '[atlas-search-diagnostic]';

export type AtlasSearchDiagnosticEvent = {
  schemaVersion: typeof ATLAS_SEARCH_DIAGNOSTIC_SCHEMA_VERSION;
  kind: 'atlas-search-outcome';
  stateSlug: string;
  source: AtlasSearchResultSource;
  queryTokenBucket: '1' | '2-3' | '4-7' | '8+';
  candidateCountBucket: '0' | '1-50' | '51-220' | '221-1000' | '1001+';
  resultCountBucket: '0' | '1' | '2-5' | '6-12' | '13+';
  cueCoverage: 'not-applicable' | 'none' | 'partial' | 'full';
  latencyBucket: '<250ms' | '250-749ms' | '750-1999ms' | '2000-4999ms' | '5000ms+';
};

export type AtlasSearchDiagnosticInput = {
  stateSlug: string;
  source: AtlasSearchResultSource;
  queryTokenCount: number;
  candidateCount: number;
  ranking: readonly AtlasSearchRankingItem[];
  durationMs: number;
};

function nonNegativeInteger(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function queryTokenBucket(count: number): AtlasSearchDiagnosticEvent['queryTokenBucket'] {
  const safeCount = nonNegativeInteger(count);
  if (safeCount <= 1) return '1';
  if (safeCount <= 3) return '2-3';
  if (safeCount <= 7) return '4-7';
  return '8+';
}

function candidateCountBucket(
  count: number,
): AtlasSearchDiagnosticEvent['candidateCountBucket'] {
  const safeCount = nonNegativeInteger(count);
  if (safeCount === 0) return '0';
  if (safeCount <= 50) return '1-50';
  if (safeCount <= 220) return '51-220';
  if (safeCount <= 1_000) return '221-1000';
  return '1001+';
}

function resultCountBucket(count: number): AtlasSearchDiagnosticEvent['resultCountBucket'] {
  const safeCount = nonNegativeInteger(count);
  if (safeCount === 0) return '0';
  if (safeCount === 1) return '1';
  if (safeCount <= 5) return '2-5';
  if (safeCount <= 12) return '6-12';
  return '13+';
}

function latencyBucket(durationMs: number): AtlasSearchDiagnosticEvent['latencyBucket'] {
  const safeDuration = Number.isFinite(durationMs) ? Math.max(0, durationMs) : 0;
  if (safeDuration < 250) return '<250ms';
  if (safeDuration < 750) return '250-749ms';
  if (safeDuration < 2_000) return '750-1999ms';
  if (safeDuration < 5_000) return '2000-4999ms';
  return '5000ms+';
}

function cueCoverage(
  ranking: readonly AtlasSearchRankingItem[],
): AtlasSearchDiagnosticEvent['cueCoverage'] {
  if (ranking.length === 0) return 'not-applicable';
  const withCues = ranking.filter((item) => item.matchCues.length > 0).length;
  if (withCues === 0) return 'none';
  if (withCues === ranking.length) return 'full';
  return 'partial';
}

export function createAtlasSearchDiagnosticEvent(
  input: AtlasSearchDiagnosticInput,
): AtlasSearchDiagnosticEvent {
  return {
    schemaVersion: ATLAS_SEARCH_DIAGNOSTIC_SCHEMA_VERSION,
    kind: 'atlas-search-outcome',
    stateSlug: input.stateSlug.trim().toLowerCase(),
    source: input.source,
    queryTokenBucket: queryTokenBucket(input.queryTokenCount),
    candidateCountBucket: candidateCountBucket(input.candidateCount),
    resultCountBucket: resultCountBucket(input.ranking.length),
    cueCoverage: cueCoverage(input.ranking),
    latencyBucket: latencyBucket(input.durationMs),
  };
}

export function recordAtlasSearchDiagnostic(
  event: AtlasSearchDiagnosticEvent,
  write: (message: string) => void = (message) => console.info(message),
): void {
  write(`${ATLAS_SEARCH_DIAGNOSTIC_LOG_PREFIX} ${JSON.stringify(event)}`);
}

export function getAtlasSearchDiagnosticHeader(
  event: AtlasSearchDiagnosticEvent,
): string {
  return [
    `v=${event.schemaVersion}`,
    `source=${event.source}`,
    `results=${event.resultCountBucket}`,
    `cues=${event.cueCoverage}`,
    `latency=${event.latencyBucket}`,
  ].join(';');
}
