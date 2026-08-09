import {
  createAtlasSearchDiagnosticEvent,
  getAtlasSearchDiagnosticHeader,
  recordAtlasSearchDiagnostic,
} from '@/data/atlasSearchDiagnostics';
import { MICHIGAN_HOME_ATLAS_SEARCH_RULES } from '@/data/stateAtlasSearchRules';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '@/data/stateAtlasConfig';
import { resolvePublishedAtlasSearchCorpus } from '@/lib/atlas-search/publishedAtlasSearchCorpus';
import { searchAtlasCandidates } from '@/lib/atlas-search/searchAtlasCandidates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_QUERY_LENGTH = 360;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_REQUESTS = 18;

const requestWindows = new Map<string, { startedAt: number; count: number }>();

type SearchRequestBody = {
  query?: unknown;
  stateSlug?: unknown;
};

function noStoreJson(value: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { ...init, headers });
}

function requestKey(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')?.trim()
    || 'local';
}

function isRateLimited(request: Request): boolean {
  const now = Date.now();
  const key = requestKey(request);
  const current = requestWindows.get(key);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  requestWindows.set(key, current);
  return current.count > RATE_LIMIT_REQUESTS;
}

export async function POST(request: Request): Promise<Response> {
  if (isRateLimited(request)) {
    return noStoreJson(
      { error: 'Search is temporarily busy. Please try again shortly.' },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null) as SearchRequestBody | null;
  const query = typeof body?.query === 'string' ? body.query.trim() : '';
  const stateSlug = typeof body?.stateSlug === 'string'
    ? body.stateSlug.trim().toLowerCase()
    : '';

  if (
    !query
    || query.length > MAX_QUERY_LENGTH
    || stateSlug !== MICHIGAN_STATE_ATLAS_CONFIG.identity.slug
  ) {
    return noStoreJson({ error: 'Invalid Atlas search request.' }, { status: 400 });
  }

  const startedAt = Date.now();
  const corpus = await resolvePublishedAtlasSearchCorpus(
    MICHIGAN_STATE_ATLAS_CONFIG,
  );
  const resultSet = await searchAtlasCandidates({
    query,
    events: corpus.events,
    stateConfig: MICHIGAN_STATE_ATLAS_CONFIG,
    searchRules: MICHIGAN_HOME_ATLAS_SEARCH_RULES,
    supplementalKnowledgeByEventId: corpus.supplementalKnowledgeByEventId,
  });

  const durationMs = Date.now() - startedAt;
  const diagnostic = createAtlasSearchDiagnosticEvent({
    stateSlug: MICHIGAN_STATE_ATLAS_CONFIG.identity.slug,
    source: resultSet.source,
    queryTokenCount: resultSet.normalizedQuery.split(' ').filter(Boolean).length,
    candidateCount: corpus.events.length,
    ranking: resultSet.ranking,
    durationMs,
  });
  recordAtlasSearchDiagnostic(diagnostic);

  return noStoreJson(resultSet, {
    headers: {
      'Server-Timing': `atlas-search;dur=${durationMs}`,
      'X-Atlas-Search-Diagnostic': getAtlasSearchDiagnosticHeader(diagnostic),
    },
  });
}
