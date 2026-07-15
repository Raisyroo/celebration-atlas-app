import assert from 'node:assert/strict';
import {
  ATLAS_DESKTOP_MIN_HEIGHT,
  ATLAS_DESKTOP_MIN_WIDTH,
  ATLAS_VIEWPORT_CAPABILITIES,
  getAtlasViewportCapabilities,
  resolveAtlasViewportCapabilities,
  resolveAtlasViewportMode,
} from '../data/atlasViewportMode.ts';
import type {
  AtlasViewportCapabilities,
  AtlasViewportDimensions,
  AtlasViewportMode,
} from '../data/atlasViewportMode.ts';

type ViewportFixture = Readonly<{
  label: string;
  dimensions: AtlasViewportDimensions;
  expectedMode: AtlasViewportMode;
  expectedArtworkVariant: AtlasViewportCapabilities['artworkVariant'];
}>;

const fixtures: readonly ViewportFixture[] = [
  {
    label: 'phone portrait',
    dimensions: { width: 390, height: 844 },
    expectedMode: 'portrait',
    expectedArtworkVariant: 'mobile',
  },
  {
    label: 'phone landscape',
    dimensions: { width: 844, height: 390 },
    expectedMode: 'compact-landscape',
    expectedArtworkVariant: 'desktop',
  },
  {
    label: 'wide phone landscape',
    dimensions: { width: 960, height: 432 },
    expectedMode: 'compact-landscape',
    expectedArtworkVariant: 'desktop',
  },
  {
    label: 'short desktop-width landscape',
    dimensions: { width: 1024, height: 390 },
    expectedMode: 'compact-landscape',
    expectedArtworkVariant: 'desktop',
  },
  {
    label: 'tablet portrait',
    dimensions: { width: 768, height: 1024 },
    expectedMode: 'portrait',
    expectedArtworkVariant: 'mobile',
  },
  {
    label: 'desktop-width portrait',
    dimensions: { width: 1024, height: 1366 },
    expectedMode: 'portrait',
    expectedArtworkVariant: 'mobile',
  },
  {
    label: 'minimum supported desktop landscape',
    dimensions: { width: 1024, height: 768 },
    expectedMode: 'desktop',
    expectedArtworkVariant: 'desktop',
  },
  {
    label: 'large desktop landscape',
    dimensions: { width: 1440, height: 900 },
    expectedMode: 'desktop',
    expectedArtworkVariant: 'desktop',
  },
] as const;

for (const fixture of fixtures) {
  const firstMode = resolveAtlasViewportMode(fixture.dimensions);
  const secondMode = resolveAtlasViewportMode({ ...fixture.dimensions });
  assert.equal(firstMode, fixture.expectedMode, `${fixture.label} mode`);
  assert.equal(secondMode, firstMode, `${fixture.label} mode must be deterministic`);

  const capabilities = resolveAtlasViewportCapabilities(fixture.dimensions);
  assert.equal(capabilities.mode, fixture.expectedMode, `${fixture.label} capability mode`);
  assert.equal(
    capabilities.artworkVariant,
    fixture.expectedArtworkVariant,
    `${fixture.label} artwork variant`,
  );
  assert.deepEqual(
    capabilities,
    getAtlasViewportCapabilities(fixture.expectedMode),
    `${fixture.label} capabilities must derive only from its mode`,
  );
}

const invalidDimensions: readonly AtlasViewportDimensions[] = [
  { width: 0, height: 844 },
  { width: 390, height: 0 },
  { width: 0, height: 0 },
  { width: -390, height: 844 },
  { width: 390, height: -844 },
  { width: Number.NaN, height: 844 },
  { width: 390, height: Number.NaN },
  { width: Number.POSITIVE_INFINITY, height: 844 },
  { width: 390, height: Number.NEGATIVE_INFINITY },
] as const;

for (const dimensions of invalidDimensions) {
  assert.equal(
    resolveAtlasViewportMode(dimensions),
    'portrait',
    `invalid dimensions ${String(dimensions.width)}x${String(dimensions.height)} must fail closed`,
  );
}

assert.equal(
  resolveAtlasViewportMode({ width: 1024, height: 1024 }),
  'portrait',
  'orientation takes precedence over desktop-width dimensions',
);
assert.equal(
  resolveAtlasViewportMode({
    width: ATLAS_DESKTOP_MIN_WIDTH,
    height: ATLAS_DESKTOP_MIN_HEIGHT,
  }),
  'desktop',
  'desktop thresholds are inclusive',
);
assert.equal(
  resolveAtlasViewportMode({
    width: ATLAS_DESKTOP_MIN_WIDTH - 1,
    height: ATLAS_DESKTOP_MIN_HEIGHT,
  }),
  'compact-landscape',
  'desktop width threshold is enforced',
);
assert.equal(
  resolveAtlasViewportMode({
    width: ATLAS_DESKTOP_MIN_WIDTH,
    height: ATLAS_DESKTOP_MIN_HEIGHT - 1,
  }),
  'compact-landscape',
  'desktop height threshold is enforced',
);

assert.deepEqual(ATLAS_VIEWPORT_CAPABILITIES.portrait, {
  mode: 'portrait',
  artworkVariant: 'mobile',
  showsMobileChrome: true,
  usesCompactPanel: false,
  usesDesktopPanel: false,
  supportsRemoteCalloutConnectors: true,
});
assert.deepEqual(ATLAS_VIEWPORT_CAPABILITIES['compact-landscape'], {
  mode: 'compact-landscape',
  artworkVariant: 'desktop',
  showsMobileChrome: true,
  usesCompactPanel: true,
  usesDesktopPanel: false,
  supportsRemoteCalloutConnectors: true,
});
assert.deepEqual(ATLAS_VIEWPORT_CAPABILITIES.desktop, {
  mode: 'desktop',
  artworkVariant: 'desktop',
  showsMobileChrome: false,
  usesCompactPanel: false,
  usesDesktopPanel: true,
  supportsRemoteCalloutConnectors: false,
});

for (const mode of Object.keys(ATLAS_VIEWPORT_CAPABILITIES) as AtlasViewportMode[]) {
  const capabilities = getAtlasViewportCapabilities(mode);
  assert(Object.isFrozen(capabilities), `${mode} capabilities must be immutable`);
  assert.equal(
    capabilities.usesCompactPanel && capabilities.usesDesktopPanel,
    false,
    `${mode} cannot use compact and desktop panels together`,
  );

  const serialized = JSON.stringify(capabilities);
  assert.equal(typeof serialized, 'string', `${mode} capabilities must serialize`);
  assert.deepEqual(
    JSON.parse(serialized) as AtlasViewportCapabilities,
    capabilities,
    `${mode} capabilities must survive a JSON round trip`,
  );
}

assert(Object.isFrozen(ATLAS_VIEWPORT_CAPABILITIES), 'capability registry must be immutable');

console.log(`Validated ${fixtures.length} Atlas viewport fixtures and ${invalidDimensions.length} invalid-dimension fallbacks.`);
