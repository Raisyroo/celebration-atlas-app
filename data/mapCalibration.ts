export type MichiganMapAnchor = {
  name: string;
  latitude: number;
  longitude: number;
  mapX: number;
  mapY: number;
};

export type AtlasPosition = {
  x: number;
  y: number;
};

// Visible map = the existing painterly Michigan artwork in /public/maps.
// Invisible map = this geographic calibration layer, which translates real
// latitude/longitude coordinates into percentages on that unchanged artwork.
//
// Keep these anchors data-first so future GPS notifications, Atlas Scout,
// Gold Artifacts, nearby events, Cartographer routes, vendor locations, and
// entrance locations can all share the same lat/lng -> atlas positioning path.
export const MICHIGAN_MAP_ANCHORS: MichiganMapAnchor[] = [
  { name: 'Detroit', latitude: 42.3314, longitude: -83.0458, mapX: 83.78, mapY: 73.28 },
  { name: 'Port Huron', latitude: 42.9709, longitude: -82.4249, mapX: 94.7, mapY: 67.54 },
  { name: 'Romeo', latitude: 42.8028, longitude: -83.01299, mapX: 85.6, mapY: 65.66 },
  { name: 'Lansing', latitude: 42.7325, longitude: -84.5555, mapX: 50.91, mapY: 64.22 },
  { name: 'Grand Rapids', latitude: 42.9634, longitude: -85.6681, mapX: 38.77, mapY: 56.93 },
  { name: 'Traverse City', latitude: 44.7631, longitude: -85.6206, mapX: 48.79, mapY: 40.36 },
  { name: 'Mackinaw City', latitude: 45.7775, longitude: -84.7278, mapX: 64.66, mapY: 28.77 },
  { name: 'Sault Ste. Marie', latitude: 46.4953, longitude: -84.3453, mapX: 74.47, mapY: 20.55 },
  { name: 'Marquette', latitude: 46.5436, longitude: -87.3954, mapX: 38.67, mapY: 17.32 },
  { name: 'Escanaba', latitude: 45.7452, longitude: -87.0646, mapX: 40.09, mapY: 26.57 },
  { name: 'Alpena', latitude: 45.0617, longitude: -83.4328, mapX: 78.01, mapY: 34.72 },
];

const EXACT_ANCHOR_MATCH_EPSILON = 0.0001;
const IDW_POWER = 2;
const K_NEAREST_ANCHORS = 4;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const getDistanceSquared = (latitude: number, longitude: number, anchor: MichiganMapAnchor) => {
  const latitudeDelta = latitude - anchor.latitude;
  const longitudeDelta = longitude - anchor.longitude;
  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
};

export function latLngToAtlasPosition(latitude: number, longitude: number): AtlasPosition {
  const exactAnchor = MICHIGAN_MAP_ANCHORS.find(
    (anchor) => getDistanceSquared(latitude, longitude, anchor) <= EXACT_ANCHOR_MATCH_EPSILON,
  );

  if (exactAnchor) {
    return { x: exactAnchor.mapX, y: exactAnchor.mapY };
  }

  const nearestAnchors = MICHIGAN_MAP_ANCHORS
    .map((anchor) => ({ anchor, distanceSquared: getDistanceSquared(latitude, longitude, anchor) }))
    .sort((a, b) => a.distanceSquared - b.distanceSquared)
    .slice(0, K_NEAREST_ANCHORS);

  const weightedPosition = nearestAnchors.reduce(
    (accumulator, { anchor, distanceSquared }) => {
      const safeDistanceSquared = Math.max(distanceSquared, EXACT_ANCHOR_MATCH_EPSILON);
      const weight = 1 / safeDistanceSquared ** (IDW_POWER / 2);

      return {
        xTotal: accumulator.xTotal + anchor.mapX * weight,
        yTotal: accumulator.yTotal + anchor.mapY * weight,
        weightTotal: accumulator.weightTotal + weight,
      };
    },
    { xTotal: 0, yTotal: 0, weightTotal: 0 },
  );

  return {
    x: clampPercent(weightedPosition.xTotal / weightedPosition.weightTotal),
    y: clampPercent(weightedPosition.yTotal / weightedPosition.weightTotal),
  };
}

export function resolveMapPosition({
  latitude,
  longitude,
  x,
  y,
}: {
  latitude?: number;
  longitude?: number;
  x: number;
  y: number;
}): AtlasPosition {
  if (typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return latLngToAtlasPosition(latitude, longitude);
  }

  return { x, y };
}
