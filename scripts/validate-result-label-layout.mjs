import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatResultLabelLocation, resolveResultLabelPlacements } from '../data/searchResultTextLayout.ts';

const results = Array.from({ length: 18 }, (_, index) => ({
  id: `event-${index}`,
  name: `Event ${index}`,
  location: index === 0 ? 'Romeo, MI' : 'Detroit, Michigan',
}));

const desktop = resolveResultLabelPlacements(results, 'desktop');
const mobile = resolveResultLabelPlacements(results, 'mobile');

assert.equal(desktop.length, 16, 'desktop labels should be capped by deterministic slots');
assert.equal(mobile.length, 12, 'mobile labels should be capped by deterministic slots');
assert.equal(desktop[0].tier, 'hero');
assert.equal(desktop[1].tier, 'strong');
assert.equal(desktop[2].tier, 'strong');
assert.equal(desktop[3].tier, 'supporting');
assert.equal(desktop[7].tier, 'ambient');
assert.equal(mobile.filter((placement) => placement.tier === 'hero').length, 1, 'mobile broad search should have no more than one Hero label');
assert.equal(mobile.filter((placement) => placement.tier === 'strong').length, 2, 'mobile broad search should have no more than two Strong labels');
assert.equal(desktop[0].event.id, 'event-0', 'source relevance order should be preserved');
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
