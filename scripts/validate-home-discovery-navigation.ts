import assert from 'node:assert/strict';
import {
  HOME_DISCOVERY_HISTORY_KEY,
  mergeHomeDiscoveryHistoryEntry,
  parseHomeDiscoveryUrlState,
  readHomeDiscoveryHistoryEntry,
  serializeHomeDiscoveryUrlState,
} from '../data/homeDiscoveryNavigation.ts';

const reconstructed = parseHomeDiscoveryUrlState(
  new URL('https://example.test/?q=music%20festivals').searchParams,
);
assert.deepEqual(reconstructed, { query: 'music festivals' });

assert.equal(
  serializeHomeDiscoveryUrlState('verify=1', {
    query: '  music   festivals  ',
  }),
  '/?verify=1&q=music+festivals',
);
assert.equal(
  serializeHomeDiscoveryUrlState('verify=1&q=music+festivals', {
    query: '',
  }),
  '/?verify=1',
);

const nextInternalState = mergeHomeDiscoveryHistoryEntry(
  { __NA: true, tree: ['next-router-state'] },
  {
    scrollY: 742.5,
    railScrollLeft: 188,
    openClusterId: 'cluster-lakeshore-1',
    selectedResultId: 'detroit-jazz',
    exactNavigation: 'suppressed',
  },
);

assert.equal(nextInternalState.__NA, true);
assert.deepEqual(nextInternalState.tree, ['next-router-state']);
assert.deepEqual(nextInternalState[HOME_DISCOVERY_HISTORY_KEY], {
  version: 1,
  scrollY: 742.5,
  railScrollLeft: 188,
  openClusterId: 'cluster-lakeshore-1',
  selectedResultId: 'detroit-jazz',
  exactNavigation: 'suppressed',
});

assert.deepEqual(readHomeDiscoveryHistoryEntry(nextInternalState), {
  version: 1,
  scrollY: 742.5,
  railScrollLeft: 188,
  openClusterId: 'cluster-lakeshore-1',
  selectedResultId: 'detroit-jazz',
  exactNavigation: 'suppressed',
});

assert.deepEqual(
  readHomeDiscoveryHistoryEntry({
    [HOME_DISCOVERY_HISTORY_KEY]: {
      version: 1,
      scrollY: -10,
      railScrollLeft: Number.NaN,
      openClusterId: ' ',
      selectedResultId: 42,
      exactNavigation: 'unknown',
    },
  }),
  {
    version: 1,
    scrollY: 0,
    railScrollLeft: 0,
    openClusterId: null,
    selectedResultId: null,
    exactNavigation: 'idle',
  },
);

assert.equal(
  readHomeDiscoveryHistoryEntry({
    [HOME_DISCOVERY_HISTORY_KEY]: { version: 2 },
  }),
  null,
);

console.log('Home discovery URL and history validation passed.');
