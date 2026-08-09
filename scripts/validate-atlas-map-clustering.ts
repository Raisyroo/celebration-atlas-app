import assert from 'node:assert/strict';
import {
  quantizeAtlasClusterScale,
  resolveAtlasGeographicMarkerGroups,
} from '../data/atlasMapClustering.ts';
import type { AtlasEvent } from '../data/events.ts';

function event(id: string, latitude: number, longitude: number): AtlasEvent {
  return {
    id,
    name: id,
    location: 'Michigan',
    latitude,
    longitude,
    atmosphereLabel: 'Fixture',
    blurb: 'Fixture',
    category: 'Festivals',
    x: 50,
    y: 50,
  };
}

const detroitA = event('detroit-a', 42.3314, -83.0458);
const detroitB = event('detroit-b', 42.339, -83.052);
const traverseCity = event('traverse-city', 44.7631, -85.6206);
const allEvents = [detroitA, detroitB, traverseCity];

const statewide = resolveAtlasGeographicMarkerGroups({
  events: allEvents,
  mapScale: 1,
});
const detroitCluster = statewide.find((group) =>
  group.events.some((candidate) => candidate.id === detroitA.id),
);
assert.equal(detroitCluster?.events.length, 2, 'nearby real coordinates cluster statewide');
assert.equal(
  statewide.reduce((count, group) => count + group.events.length, 0),
  allEvents.length,
  'every supplied result appears in exactly one geographic group',
);

const scoped = resolveAtlasGeographicMarkerGroups({
  events: [detroitA, traverseCity],
  mapScale: 1,
});
assert.equal(
  scoped.reduce((count, group) => count + group.events.length, 0),
  2,
  'cluster counts contain only the current search result set',
);
assert(
  !scoped.some((group) => group.events.some((candidate) => candidate.id === detroitB.id)),
  'events outside the active result set never contribute to a cluster',
);

const close = resolveAtlasGeographicMarkerGroups({
  events: allEvents,
  mapScale: 2.5,
});
assert(close.every((group) => group.events.length === 1), 'maximum zoom resolves to leaves');

const reversed = resolveAtlasGeographicMarkerGroups({
  events: [...allEvents].reverse(),
  mapScale: 1,
});
const reversedDetroitCluster = reversed.find((group) => group.events.length === 2);
assert.equal(
  reversedDetroitCluster?.id,
  detroitCluster?.id,
  'cluster identity is stable when catalog order changes',
);
assert.equal(
  quantizeAtlasClusterScale(1.03),
  quantizeAtlasClusterScale(1.04),
  'small gesture updates share a stable cluster step',
);

console.log('Atlas geographic clustering validation passed.');
