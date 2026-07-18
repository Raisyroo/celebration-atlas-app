export type DepthVector = Readonly<{ x: number; y: number }>;

export type MobileMapDepthOffsets = Readonly<{
  shared: DepthVector;
  artwork: DepthVector;
}>;

export const MOBILE_MAP_DEPTH_LIMITS = Object.freeze({
  deadZoneDegrees: 0.8,
  sharedPixelsPerDegree: 0.36,
  artworkExtraPixelsPerDegree: 0.18,
  sharedMaxPixels: 4,
  artworkExtraMaxPixels: 2,
});

const normalizeScreenAngle = (angle: number) =>
  ((Math.round(angle / 90) * 90) % 360 + 360) % 360;

const scaleVectorToMagnitude = (
  vector: DepthVector,
  magnitude: number,
): DepthVector => {
  const sourceMagnitude = Math.hypot(vector.x, vector.y);
  if (sourceMagnitude === 0 || magnitude === 0) return { x: 0, y: 0 };

  const scale = magnitude / sourceMagnitude;
  return { x: vector.x * scale, y: vector.y * scale };
};

export function normalizeDeviceOrientationToScreen(
  beta: number,
  gamma: number,
  screenAngle: number,
): DepthVector {
  switch (normalizeScreenAngle(screenAngle)) {
    case 90:
      return { x: beta, y: -gamma };
    case 180:
      return { x: -gamma, y: -beta };
    case 270:
      return { x: -beta, y: gamma };
    default:
      return { x: gamma, y: beta };
  }
}

export function shortestAngleDelta(current: number, baseline: number): number {
  return ((current - baseline + 540) % 360) - 180;
}

export function resolveMobileMapDepthOffsets(
  deltaXDegrees: number,
  deltaYDegrees: number,
): MobileMapDepthOffsets {
  const rawVector = { x: deltaXDegrees, y: deltaYDegrees };
  const rawMagnitude = Math.hypot(rawVector.x, rawVector.y);
  const filteredMagnitude = Math.max(
    0,
    rawMagnitude - MOBILE_MAP_DEPTH_LIMITS.deadZoneDegrees,
  );

  if (filteredMagnitude === 0) {
    return {
      shared: { x: 0, y: 0 },
      artwork: { x: 0, y: 0 },
    };
  }

  const sharedMagnitude = Math.min(
    MOBILE_MAP_DEPTH_LIMITS.sharedMaxPixels,
    filteredMagnitude * MOBILE_MAP_DEPTH_LIMITS.sharedPixelsPerDegree,
  );
  const artworkExtraMagnitude = Math.min(
    MOBILE_MAP_DEPTH_LIMITS.artworkExtraMaxPixels,
    filteredMagnitude * MOBILE_MAP_DEPTH_LIMITS.artworkExtraPixelsPerDegree,
  );

  return {
    shared: scaleVectorToMagnitude(rawVector, sharedMagnitude),
    artwork: scaleVectorToMagnitude(
      rawVector,
      sharedMagnitude + artworkExtraMagnitude,
    ),
  };
}
