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
assert(
  atlasMapSource.includes('resolveAtlasGeographicMarkerGroups({') &&
    atlasMapSource.includes('mapScale: mapTransform.scale') &&
    atlasMapSource.includes('groupLayouts.reduce((sum, layout) => sum + layout.position.x'),
  'production search markers should use zoom-aware geographic membership and the existing projected artwork positions',
);
assert(!/(SLOTS|type Slot|const [A-Z_]*SLOTS)/.test(helperSource), 'result label helper must not contain arbitrary composition slot coordinates');
assert(
  atlasMapSource.includes("fetch('/api/atlas-search'") &&
    atlasMapSource.includes('applyAtlasSearchResultSet({') &&
    atlasMapSource.includes('parseAtlasSearchResultSet(body'),
  'AtlasMap should consume one structured ASK result set with a safe immediate fallback',
);
assert(
  atlasMapSource.includes('data-atlas-cluster-count={isCluster ? events.length : undefined}') &&
    atlasMapSource.includes('<span style={styles.clusterCount}>{events.length}</span>') &&
    atlasMapSource.includes('handleOpenSearchCluster(id);'),
  'production geographic clusters should expose the scoped count and open the existing deck',
);
assert(atlasMapSource.includes('data-search-mode={submittedSearchMode}') && atlasMapSource.includes('data-search-result-count={isSubmittedSearchActive ? homeAtlasDiscovery.events.length : 0}'), 'homepage search state should expose stable mode and result-count diagnostics');
assert(
  atlasMapSource.includes('displayedRailEvents = isSubmittedSearchActive') &&
    atlasMapSource.includes('data-event-rail-scope={isSubmittedSearchActive ? \'atlas-search\' : \'live-upcoming\'}'),
  'the mobile card rail should switch to the exact structured ASK result set',
);
assert(
  atlasMapSource.includes("data-atlas-experience-deck-host=\"search-result-cluster\"") &&
    atlasMapSource.includes('adaptSearchClusterEventToDeckItem') &&
    atlasMapSource.includes('router.push(item.href)'),
  'geographic clusters should reuse the shared Experience Deck and existing Event Hub hrefs',
);
assert(
  atlasMapSource.includes("process.env.NODE_ENV === 'development'") &&
    atlasMapSource.includes("searchParams.get('atlasDeckFixture') === 'multi'") &&
    atlasMapSource.includes('development-multi-event-experience-deck-fixture'),
  'the multi-event Experience Deck validation fixture must remain development-only and explicitly query-gated',
);
console.log('Legacy result-label helper and production cluster integration validation passed.');
