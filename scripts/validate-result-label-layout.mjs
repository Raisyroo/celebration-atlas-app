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

assert.equal(desktop.length, 14, 'desktop labels should be capped by deterministic slots');
assert.equal(mobile.length, 9, 'mobile labels should be capped by deterministic slots');
assert.equal(desktop[0].tier, 'hero');
assert.equal(desktop[1].tier, 'strong');
assert.equal(desktop[4].tier, 'supporting');
assert.equal(desktop[8].tier, 'ambient');
assert.equal(desktop[0].event.id, 'event-0', 'source relevance order should be preserved');
assert.equal(formatResultLabelLocation('Traverse City, MI'), 'Traverse City, MI');
assert.equal(formatResultLabelLocation('Holland'), 'Holland, MI');

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

console.log('Result label layout validation passed.');
