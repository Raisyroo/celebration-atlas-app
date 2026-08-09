import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ATLAS_SEARCH_DIAGNOSTIC_LOG_PREFIX,
  createAtlasSearchDiagnosticEvent,
  getAtlasSearchDiagnosticHeader,
  recordAtlasSearchDiagnostic,
} from '../data/atlasSearchDiagnostics.ts';

const privateQuery = 'quiet events near my home on Cedar Street';
const privateEventId = 'private-event-identity';
const privateCue = 'Sensitive match cue';
const event = createAtlasSearchDiagnosticEvent({
  stateSlug: 'Michigan',
  source: 'atlas-model',
  queryTokenCount: privateQuery.split(/\s+/).length,
  candidateCount: 487,
  ranking: [{
    eventId: privateEventId,
    score: 0.91,
    matchCues: [privateCue],
  }],
  durationMs: 814,
});

assert.deepEqual(event, {
  schemaVersion: 1,
  kind: 'atlas-search-outcome',
  stateSlug: 'michigan',
  source: 'atlas-model',
  queryTokenBucket: '8+',
  candidateCountBucket: '221-1000',
  resultCountBucket: '1',
  cueCoverage: 'full',
  latencyBucket: '750-1999ms',
});

let logMessage = '';
recordAtlasSearchDiagnostic(event, (message) => {
  logMessage = message;
});
assert(logMessage.startsWith(`${ATLAS_SEARCH_DIAGNOSTIC_LOG_PREFIX} {`));
assert.deepEqual(
  JSON.parse(logMessage.slice(ATLAS_SEARCH_DIAGNOSTIC_LOG_PREFIX.length + 1)),
  event,
  'the structured operational log is machine-readable',
);

const header = getAtlasSearchDiagnosticHeader(event);
assert.equal(
  header,
  'v=1;source=atlas-model;results=1;cues=full;latency=750-1999ms',
);

const emitted = `${logMessage}\n${header}`.toLowerCase();
for (const forbidden of [
  privateQuery,
  privateEventId,
  privateCue,
  'cedar street',
  'query":',
  'eventid',
  'ipaddress',
  'useragent',
  'userid',
  'deviceid',
  'sessionid',
  'timestamp',
]) {
  assert(
    !emitted.includes(forbidden.toLowerCase()),
    `diagnostic output must not contain ${forbidden}`,
  );
}

const zeroResult = createAtlasSearchDiagnosticEvent({
  stateSlug: 'michigan',
  source: 'atlas-fallback',
  queryTokenCount: 2,
  candidateCount: 0,
  ranking: [],
  durationMs: 5_200,
});
assert.equal(zeroResult.resultCountBucket, '0');
assert.equal(zeroResult.cueCoverage, 'not-applicable');
assert.equal(zeroResult.latencyBucket, '5000ms+');

const routeSource = readFileSync(
  new URL('../app/api/atlas-search/route.ts', import.meta.url),
  'utf8',
);
assert(
  routeSource.includes('createAtlasSearchDiagnosticEvent')
    && routeSource.includes('recordAtlasSearchDiagnostic')
    && routeSource.includes('X-Atlas-Search-Diagnostic'),
  'the public ASK route records the privacy-safe event and exposes its safe summary',
);

console.log('Atlas search diagnostics validation passed.');
