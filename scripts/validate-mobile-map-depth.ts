import assert from 'node:assert/strict';
import {
  MOBILE_MAP_DEPTH_LIMITS,
  normalizeDeviceOrientationToScreen,
  resolveMobileMapDepthOffsets,
  shortestAngleDelta,
} from '../data/mobileMapDepth.ts';

const magnitude = ({ x, y }: { x: number; y: number }) => Math.hypot(x, y);
const LIMIT_TOLERANCE = 1e-9;

const neutral = resolveMobileMapDepthOffsets(0.4, 0.3);
assert.deepEqual(neutral.shared, { x: 0, y: 0 }, 'sensor noise escaped the dead zone');
assert.deepEqual(neutral.artwork, { x: 0, y: 0 }, 'artwork moved inside the dead zone');

const extreme = resolveMobileMapDepthOffsets(90, -90);
assert.ok(
  magnitude(extreme.shared) <=
    MOBILE_MAP_DEPTH_LIMITS.sharedMaxPixels + LIMIT_TOLERANCE,
  'event-tag scene exceeded its four-pixel travel limit',
);
assert.ok(
  magnitude(extreme.artwork) <=
    MOBILE_MAP_DEPTH_LIMITS.sharedMaxPixels +
      MOBILE_MAP_DEPTH_LIMITS.artworkExtraMaxPixels +
      LIMIT_TOLERANCE,
  'artwork exceeded its six-pixel travel limit',
);
assert.ok(
  magnitude({
    x: extreme.artwork.x - extreme.shared.x,
    y: extreme.artwork.y - extreme.shared.y,
  }) <= MOBILE_MAP_DEPTH_LIMITS.artworkExtraMaxPixels + LIMIT_TOLERANCE,
  'relative artwork-to-tag drift exceeded two pixels',
);

assert.deepEqual(
  normalizeDeviceOrientationToScreen(12, 5, 0),
  { x: 5, y: 12 },
  'portrait axes were not normalized',
);
assert.deepEqual(
  normalizeDeviceOrientationToScreen(12, 5, 90),
  { x: 12, y: -5 },
  'clockwise landscape axes were not normalized',
);
assert.deepEqual(
  normalizeDeviceOrientationToScreen(12, 5, 270),
  { x: -12, y: 5 },
  'counter-clockwise landscape axes were not normalized',
);
assert.equal(shortestAngleDelta(-179, 179), 2, 'angle wrap introduced a large jump');

console.log('Mobile map depth math validation passed.');
