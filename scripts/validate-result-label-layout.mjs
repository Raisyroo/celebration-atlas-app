import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatResultLabelLocation, resolveResultLabelPlacements } from '../data/searchResultTextLayout.ts';

const results = Array.from({ length: 20 }, (_, index) => ({
  event: { id: `event-${index}`, name: `Event ${index}`, location: index === 0 ? 'Romeo, MI' : 'Detroit, Michigan' },
  position: { x: 10 + index * 4, y: 22 + (index % 4) * 11 },
}));
const resultsWithInvalidProjection = [
  ...results,
  { event: { id: 'missing-coordinates', name: 'Missing Coordinates', location: 'Michigan' }, position: { x: Number.NaN, y: Number.NaN } },
];

const desktop = resolveResultLabelPlacements(resultsWithInvalidProjection, 'desktop');
const mobile = resolveResultLabelPlacements(resultsWithInvalidProjection, 'mobile');
const desktopLabels = desktop.filter((placement) => placement.kind === 'label');
const mobileLabels = mobile.filter((placement) => placement.kind === 'label');

assert(desktop.length <= 18, 'desktop labels and clusters should respect the broad-search representation limit');
assert(mobile.length <= 20, 'mobile labels and clusters should respect the broad-search representation limit');
assert.equal(desktopLabels[0].tier, 'hero');
assert.equal(desktopLabels[1].tier, 'strong');
assert.equal(desktopLabels[2].tier, 'strong');
assert.equal(desktopLabels[3].tier, 'supporting');
assert(mobileLabels.filter((placement) => placement.tier === 'hero').length <= 1, 'mobile broad search should have no more than one Hero label');
assert(mobileLabels.filter((placement) => placement.tier === 'strong').length <= 2, 'mobile broad search should have no more than two Strong labels');
assert.equal(desktopLabels[0].event.id, 'event-0', 'source relevance order should be preserved');
assert.equal(desktopLabels[0].anchorX, 10, 'label anchor x should come from the existing projected event position');
assert.equal(desktopLabels[0].anchorY, 22, 'label anchor y should come from the existing projected event position');
assert(!desktop.some((placement) => placement.kind === 'label' && placement.event.id === 'missing-coordinates'), 'events without valid projected positions should not be placed on the map text layer');
assert.equal(formatResultLabelLocation('Traverse City, MI'), 'Traverse City, MI');
assert.equal(formatResultLabelLocation('Holland'), 'Holland');
assert.equal(formatResultLabelLocation('Cleveland, OH'), 'Cleveland, OH');
assert.equal(formatResultLabelLocation(''), '');

const helperSource = readFileSync(resolve('data/searchResultTextLayout.ts'), 'utf8');
const crowded = resolveResultLabelPlacements(Array.from({ length: 16 }, (_, index) => ({
  event: { id: `crowded-${index}`, name: `Crowded Full Title ${index}`, location: 'Detroit, MI' },
  position: { x: 68 + (index % 4) * 2.3, y: 55 + Math.floor(index / 4) * 2.1 },
})), 'mobile');
const crowdedLabels = crowded.filter((placement) => placement.kind === 'label');
const crowdedClusters = crowded.filter((placement) => placement.kind === 'cluster');
assert(helperSource.indexOf("'compact'") < helperSource.indexOf("kind: 'cluster'"), 'emergency compact tiers should be attempted before cluster fallback');
assert(crowdedClusters.length > 0, 'crowded local regions should produce a visible cluster fallback');
assert.equal(crowdedClusters[0].events.length, Math.min(16, 20) - crowdedLabels.length, 'cluster exposes every unresolved capped member');
assert(Math.hypot(crowdedClusters[0].x - crowdedClusters[0].anchorX, crowdedClusters[0].y - crowdedClusters[0].anchorY) <= 14, 'cluster placement remains tied to the projected local region');

const rectsIntersect = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
for (let i = 0; i < crowdedLabels.length; i += 1) {
  for (let j = i + 1; j < crowdedLabels.length; j += 1) {
    assert(!rectsIntersect(crowdedLabels[i].rect, crowdedLabels[j].rect), 'accepted label rectangles should not intersect');
  }
}
for (const cluster of crowdedClusters) {
  for (const label of crowdedLabels) {
    assert(!rectsIntersect(cluster.rect, label.rect), 'cluster rectangles should not intersect accepted label rectangles');
  }
}
assert(crowdedLabels[0].tier === 'hero', 'lower-ranked labels yield before higher-ranked labels move down-tier');

const atlasMapSource = readFileSync(resolve('components/AtlasMap.tsx'), 'utf8');
const fieldBlock = atlasMapSource.slice(atlasMapSource.indexOf('function SearchResultTextField'), atlasMapSource.indexOf('function formatMobileEventDate'));
const styleBlock = atlasMapSource.slice(atlasMapSource.indexOf('resultTextField:'), atlasMapSource.indexOf('markerLabel:'));
assert(!/(rotate|skew|perspective|rotateX|rotateY|rotateZ)/i.test(`${fieldBlock}\n${styleBlock}\n${helperSource}`), 'result text field must not use rotate, skew, or perspective transforms');
assert(!/(textOverflow\s*:\s*['"]ellipsis|whiteSpace\s*:\s*['"]nowrap)/i.test(`${fieldBlock}\n${styleBlock}`), 'result label titles must not use ellipsis or nowrap');
assert(fieldBlock.includes('markerLayouts') && fieldBlock.includes('isFiniteMarkerPosition(position)') && helperSource.includes('position.x') && helperSource.includes('position.y'), 'floating search labels should use existing projected marker positions and omit invalid projections');
assert(!/(SLOTS|type Slot|const [A-Z_]*SLOTS)/.test(helperSource), 'result label helper must not contain arbitrary composition slot coordinates');
assert(helperSource.includes("export type ResultLabelAlign") && fieldBlock.includes('data-result-label-align') && fieldBlock.includes('placement.align'), 'floating result labels should expose and render adaptive side alignment');
assert(fieldBlock.includes('resultTextLabelHalo') && styleBlock.includes('radial-gradient(ellipse at center'), 'floating result labels should include a subtle text-bound readability halo');
assert(atlasMapSource.includes('rankedSubmittedSearchResults.length > 0 ?') && atlasMapSource.includes('<SearchResultTextField') && atlasMapSource.includes('if (exactEventIntent || !shouldUseMapSearchTitleTags) return [];'), 'exact-event and filtered-list discovery should remain separate from query-only map title tags');
assert(atlasMapSource.includes('searchHomeAtlas({') && !atlasMapSource.includes('getLegacyHighlightedIdsFromQuery') && !atlasMapSource.includes('searchEventProfiles'), 'AtlasMap search should use only the deterministic state-scoped resolver');
assert(fieldBlock.includes('data-search-event-id') && fieldBlock.includes('data-search-mode="results"') && fieldBlock.includes('data-search-result-count'), 'broad result fields should expose stable deterministic smoke selectors');
assert(fieldBlock.includes('<button') && fieldBlock.includes('onClick={() => onEventSelect(placement.event.id)}') && fieldBlock.includes('aria-label="Search result title tags"'), 'query-only map title tags must remain interactive accessible controls');
assert(atlasMapSource.includes('data-search-mode={submittedSearchMode}') && atlasMapSource.includes('data-search-result-count={isSubmittedSearchActive ? homeAtlasDiscovery.events.length : 0}'), 'homepage search state should expose stable mode and result-count diagnostics');
assert(atlasMapSource.includes('!isQueryOnlyDiscovery &&') && atlasMapSource.includes('shouldUseMapSearchTitleTags'), 'query-only mobile search must not open the discovery/filter panel over map title tags');
assert(atlasMapSource.includes('data-testid="event-rail"') && atlasMapSource.includes('areMobileAmbientControlsVisible'), 'bottom event rail should remain present in ambient/broad search UI');
console.log('Result label layout validation passed.');
