import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyAtlasSearchResultSet,
  createAtlasSearchResultSet,
  parseAtlasSearchResultSet,
} from '../data/atlasSearch.ts';
import {
  createAtlasSearchKnowledgeDocuments,
  deriveAtlasSearchMatchCues,
  searchAtlasKnowledgeDocuments,
} from '../data/atlasSearchKnowledge.ts';
import type { AtlasEvent } from '../data/events.ts';
import type { EventProfile } from '../data/eventProfileTypes.ts';
import type { HomeAtlasSearchResponse } from '../data/homeAtlasSearch.ts';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig.ts';

function fixtureEvent(id: string, name: string, longitude: number): AtlasEvent {
  return {
    id,
    name,
    location: 'Detroit, MI',
    latitude: 42.3314,
    longitude,
    atmosphereLabel: 'Fixture',
    blurb: 'Fixture event',
    category: 'Festivals',
    x: 50,
    y: 50,
  };
}

const bingo = {
  ...fixtureEvent('bingo-event', 'Community Summer Days', -83.04),
  emergingAtlasKnowledge: {
    participation: 'Visitors may join charitable bingo and prize raffles.',
  },
} as unknown as AtlasEvent;
const equipment = {
  ...fixtureEvent('equipment-event', 'Heritage Engine Weekend', -83.05),
  detailPage: {
    shortStory: 'Spectators can operate restored farm equipment with a guide.',
  },
} satisfies AtlasEvent;
const events = [bingo, equipment];
const profiles: EventProfile[] = events.map((event) => ({
  id: event.id,
  slug: event.id,
  name: event.name,
  eventTypes: [event.category],
  categories: [event.category],
  tags: [],
  city: 'Detroit',
  state: MICHIGAN_STATE_ATLAS_CONFIG.identity.name,
  stateSlug: MICHIGAN_STATE_ATLAS_CONFIG.identity.slug,
  locationName: event.location,
  dateRange: { startDate: 'Unknown', displayText: 'Unknown', isEstimated: true },
  coverageLevel: 'basicNationalCoverage',
  sources: [],
  trust: {
    sourceStatus: 'unverified',
    confidence: 'low',
    confidenceScore: 0.25,
  },
}));
const supplementalKnowledgeByEventId = new Map<string, unknown>([
  ['bingo-event', {
    sources: [{ url: 'https://example.org/community-summer-days' }],
    modules: [{
      title: 'Bingo and prize raffles',
      summary: 'Visitors may join charitable bingo and prize raffles.',
    }],
  }],
]);
const documents = createAtlasSearchKnowledgeDocuments({
  events,
  profiles,
  supplementalKnowledgeByEventId,
});

assert.deepEqual(
  searchAtlasKnowledgeDocuments('events with charitable bingo', documents).map(
    (match) => match.eventId,
  ),
  ['bingo-event'],
  'generalized Atlas knowledge search reads new nested values without a field-specific rule',
);
assert.deepEqual(
  documents.find((document) => document.eventId === 'bingo-event')?.officialSourceUrls,
  ['https://example.org/community-summer-days'],
  'published Event Hub source URLs remain attached as identity-bound research hints',
);
const bingoDocument = documents.find((document) => document.eventId === 'bingo-event');
assert(bingoDocument, 'bingo fixture produces an Atlas knowledge document');
const bingoKnowledgeMatch = searchAtlasKnowledgeDocuments(
  'events with charitable bingo',
  documents,
).find((match) => match.eventId === 'bingo-event');
assert(bingoKnowledgeMatch, 'bingo fixture produces a grounded knowledge match');
assert(
  bingoKnowledgeMatch.evidenceFactIds.length > 0,
  'generalized search retains evidence fact IDs instead of generated reasoning',
);
const bingoCueFact = bingoDocument.facts.find(
  (fact) => fact.label === 'Bingo and prize raffles',
);
assert(bingoCueFact, 'paired published facts retain their factual display label');
assert.deepEqual(
  deriveAtlasSearchMatchCues({
    query: 'events with charitable bingo',
    document: bingoDocument,
    evidenceFactIds: [bingoCueFact.id],
  }),
  ['Charitable Bingo'],
  'compact match cues are selected from retained facts rather than generated prose',
);
assert.deepEqual(
  deriveAtlasSearchMatchCues({
    query: 'fishing tournaments with live bands',
    document: {
      ...bingoDocument,
      facts: [{
        id: 'fact-live-bands',
        label: 'Event overview',
        value: 'Fishing tournaments with live Michigan bands on the waterfront.',
        text: 'Event overview: Fishing tournaments with live Michigan bands on the waterfront.',
      }],
      knowledge: [
        'Event overview: Fishing tournaments with live Michigan bands on the waterfront.',
      ],
    },
    evidenceFactIds: ['fact-live-bands'],
  }),
  ['Fishing Tournaments', 'Live Bands'],
  'query-phrase cues remain grounded when a harmless modifier separates the requested words',
);
assert.deepEqual(
  searchAtlasKnowledgeDocuments('operate restored equipment', documents).map(
    (match) => match.eventId,
  ),
  ['equipment-event'],
  'generalized Atlas knowledge search reads descriptive event content',
);

const resultSet = createAtlasSearchResultSet({
  query: '  Charitable bingo  ',
  stateSlug: 'Michigan',
  source: 'atlas-model',
  ranking: [
    { eventId: 'bingo-event', score: 0.93, matchCues: ['Charitable bingo'] },
    { eventId: 'bingo-event', score: 0.4, matchCues: ['Duplicate'] },
    { eventId: 'not-a-candidate', score: 0.99, matchCues: ['Outside Atlas'] },
  ],
  candidateEventIds: new Set(events.map((event) => event.id)),
});

assert.deepEqual(resultSet.eventIds, ['bingo-event']);
assert.equal(resultSet.resultCount, 1);
assert.equal(resultSet.query, 'Charitable bingo');
assert.equal(resultSet.normalizedQuery, 'charitable bingo');
assert.equal(resultSet.stateSlug, 'michigan');
assert(!('explanation' in resultSet), 'public ASK result contract contains no prose field');

assert.deepEqual(
  parseAtlasSearchResultSet(resultSet, {
    query: 'charitable bingo',
    stateSlug: 'michigan',
    candidateEventIds: new Set(events.map((event) => event.id)),
  }),
  resultSet,
  'valid structured result sets survive the client boundary',
);
assert.equal(
  parseAtlasSearchResultSet({
    ...resultSet,
    eventIds: ['not-a-candidate'],
    ranking: [{ eventId: 'not-a-candidate', score: 1, matchCues: ['Outside Atlas'] }],
  }, {
    query: 'charitable bingo',
    stateSlug: 'michigan',
    candidateEventIds: new Set(events.map((event) => event.id)),
  }),
  null,
  'the client rejects IDs outside its Celebration Atlas candidate universe',
);

const fallback: HomeAtlasSearchResponse = {
  normalizedQuery: 'charitable bingo',
  queryTokens: ['charitable', 'bingo'],
  freeTokens: ['charitable', 'bingo'],
  exactMatch: null,
  results: [],
};
const applied = applyAtlasSearchResultSet({
  resultSet,
  fallback,
  events,
  profiles,
});
assert.deepEqual(applied.results.map((result) => result.event.id), ['bingo-event']);
assert.deepEqual(applied.results[0]?.reasons, ['semantic']);
assert.deepEqual(applied.results[0]?.matchCues, ['Charitable bingo']);

const routeSource = readFileSync(
  new URL('../app/api/atlas-search/route.ts', import.meta.url),
  'utf8',
);
const corpusSource = readFileSync(
  new URL('../lib/atlas-search/publishedAtlasSearchCorpus.ts', import.meta.url),
  'utf8',
);
assert(
  !routeSource.includes('candidateEventIds'),
  'the public browser cannot narrow or expand the authoritative Atlas candidate universe',
);
assert(
  routeSource.includes('resolvePublishedAtlasSearchCorpus'),
  'ASK resolves its candidate universe from the publication-gated server corpus',
);
assert(
  corpusSource.includes(".eq('status', 'published')")
    && corpusSource.includes('publishedDiscovery?.packageId')
    && corpusSource.includes('row.package_version !== publication.packageVersion'),
  'supplemental ASK knowledge is tied to the exact published package and version',
);

console.log('Atlas smart search validation passed.');
