import assert from 'node:assert/strict';
import {
  isMapArtworkSourceReady,
  resolveLoadedMapArtworkSource,
} from '../data/mapArtworkReadiness.ts';

const mobileSource = '/maps/michigan-mobile.webp';
const desktopSource = '/maps/michigan-desktop.webp';

assert.equal(
  resolveLoadedMapArtworkSource(mobileSource, {
    source: mobileSource,
    complete: true,
    naturalWidth: 972,
  }),
  mobileSource,
  'a cached complete image confirms its active source',
);
assert.equal(
  resolveLoadedMapArtworkSource(mobileSource, {
    source: mobileSource,
    complete: false,
    naturalWidth: 0,
  }),
  null,
  'an incomplete image is not ready',
);
assert.equal(
  resolveLoadedMapArtworkSource(mobileSource, {
    source: desktopSource,
    complete: true,
    naturalWidth: 1200,
  }),
  null,
  'a previously loaded source cannot satisfy a new active source',
);
assert.equal(
  isMapArtworkSourceReady({
    activeSource: mobileSource,
    loadedSource: desktopSource,
    isCelestialFallback: false,
  }),
  false,
  'readiness is tied to the active source identity',
);
assert.equal(
  isMapArtworkSourceReady({
    activeSource: desktopSource,
    loadedSource: desktopSource,
    isCelestialFallback: false,
  }),
  true,
  'the confirmed desktop fallback source is ready when active',
);
assert.equal(
  isMapArtworkSourceReady({
    activeSource: mobileSource,
    loadedSource: null,
    isCelestialFallback: true,
  }),
  true,
  'the intentional celestial fallback releases the artwork gate',
);

console.log('Map artwork readiness validation passed.');
