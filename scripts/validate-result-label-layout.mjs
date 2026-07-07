import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatResultLabelLocation, resolveResultLabelPlacements } from '../data/searchResultTextLayout.ts';

const results = Array.from({ length: 20 }, (_, index) => ({
  event: {
    id: `event-${index}`,
    name: `Event ${index}`,
    location: index === 0 ? 'Romeo, MI' : 'Detroit, Michigan',
  },
  position: { x: 10 + index, y: 20 + index },
}));
const resultsWithInvalidProjection = [
  ...results,
  { event: { id: 'missing-coordinates', name: 'Missing Coordinates', location: 'Michigan' }, position: { x: Number.NaN, y: Number.NaN } },
];

const desktop = resolveResultLabelPlacements(resultsWithInvalidProjection, 'desktop');
const mobile = resolveResultLabelPlacements(resultsWithInvalidProjection, 'mobile');

assert.equal(desktop.length, 18, 'desktop labels should be capped by the broad-search label limit');
assert.equal(mobile.length, 12, 'mobile labels should be capped by the broad-search label limit');
assert.equal(desktop[0].tier, 'hero');
assert.equal(desktop[1].tier, 'strong');
assert.equal(desktop[2].tier, 'strong');
assert.equal(desktop[3].tier, 'supporting');
assert.equal(desktop[7].tier, 'ambient');
assert.equal(mobile.filter((placement) => placement.tier === 'hero').length, 1, 'mobile broad search should have no more than one Hero label');
assert.equal(mobile.filter((placement) => placement.tier === 'strong').length, 2, 'mobile broad search should have no more than two Strong labels');
assert.equal(desktop[0].event.id, 'event-0', 'source relevance order should be preserved');
assert.equal(desktop[0].x, 10, 'label x should come from the existing projected event position');
assert.equal(desktop[0].y, 20, 'label y should come from the existing projected event position');
assert(!desktop.some((placement) => placement.event.id === 'missing-coordinates'), 'events without valid projected positions should not be placed on the map text layer');
assert.equal(formatResultLabelLocation('Traverse City, MI'), 'Traverse City, MI');
assert.equal(formatResultLabelLocation('Holland'), 'Holland, MI');
assert.equal(formatResultLabelLocation(''), '');

const atlasMapSource = readFileSync(resolve('components/AtlasMap.tsx'), 'utf8');
const helperSource = readFileSync(resolve('data/searchResultTextLayout.ts'), 'utf8');
const fieldBlock = atlasMapSource.slice(
  atlasMapSource.indexOf('function SearchResultTextField'),
  atlasMapSource.indexOf('function formatMobileEventDate'),
);
const styleBlock = atlasMapSource.slice(
  atlasMapSource.indexOf('resultTextField:'),
  atlasMapSource.indexOf('markerLabel:'),
);
assert(!/(rotate|skew|perspective|rotateX|rotateY|rotateZ)/i.test(`${fieldBlock}\n${styleBlock}\n${helperSource}`), 'result text field must not use rotate, skew, or perspective transforms');
assert(!/(textOverflow\s*:\s*['"]ellipsis|whiteSpace\s*:\s*['"]nowrap)/i.test(`${fieldBlock}\n${styleBlock}`), 'result label titles must not use ellipsis or nowrap');
assert(
  fieldBlock.includes('markerLayouts') &&
    fieldBlock.includes('isFiniteMarkerPosition(position)') &&
    helperSource.includes('position.x') &&
    helperSource.includes('position.y'),
  'floating search labels should use existing projected marker positions and omit invalid projections',
);
assert(
  !/(SLOTS|type Slot|const [A-Z_]*SLOTS)/.test(helperSource),
  'result label helper must not contain arbitrary composition slot coordinates',
);
assert(
  atlasMapSource.includes('rankedSubmittedSearchResults.length > 0 ?') &&
    atlasMapSource.includes('<SearchResultTextField') &&
    atlasMapSource.includes('if (exactEventIntent || !q || highlightedIds.size === 0) return [];'),
  'exact-event search should remain separate from broad result text field rendering',
);
assert(
  atlasMapSource.includes('aria-label="Michigan event rail"') &&
    atlasMapSource.includes('areMobileAmbientControlsVisible'),
  'bottom event rail should remain present in ambient/broad search UI',
);

console.log('Result label layout validation passed.');
