export type MichiganMapAnchor = {
  name: string;
  latitude: number;
  longitude: number;
  xPercent: number;
  yPercent: number;
};

export type MapPosition = {
  x: number;
  y: number;
};

// Approximate calibration for the custom illustrated Michigan map.
// These anchors intentionally map real cities to hand-tuned percentages on the
// non-geographic artwork, so the interpolation favors visual alignment over
// survey-grade geographic precision.
export const MICHIGAN_MAP_ANCHORS: MichiganMapAnchor[] = [
  { name: 'Detroit', latitude: 42.3314, longitude: -83.0458, xPercent: 75, yPercent: 44 },
  { name: 'Port Huron', latitude: 42.9709, longitude: -82.4249, xPercent: 82, yPercent: 34 },
  { name: 'Lansing', latitude: 42.7325, longitude: -84.5555, xPercent: 47, yPercent: 50 },
  { name: 'Grand Rapids', latitude: 42.9634, longitude: -85.6681, xPercent: 34, yPercent: 48 },
  { name: 'Traverse City', latitude: 44.7631, longitude: -85.6206, xPercent: 30, yPercent: 28 },
  { name: 'Mackinaw City', latitude: 45.7775, longitude: -84.7278, xPercent: 49, yPercent: 14 },
  { name: 'Sault Ste. Marie', latitude: 46.4953, longitude: -84.3453, xPercent: 55, yPercent: 5 },
  { name: 'Marquette', latitude: 46.5436, longitude: -87.3954, xPercent: 23, yPercent: 5 },
  { name: 'Escanaba', latitude: 45.7452, longitude: -87.0646, xPercent: 34, yPercent: 8 },
  { name: 'Alpena', latitude: 45.0617, longitude: -83.4328, xPercent: 58, yPercent: 21 },
];

const EXACT_ANCHOR_MATCH_EPSILON = 0.0001;
const IDW_POWER = 2;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const getDistanceSquared = (latitude: number, longitude: number, anchor: MichiganMapAnchor) => {
  const latitudeDelta = latitude - anchor.latitude;
  const longitudeDelta = longitude - anchor.longitude;
  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
};

export function latLngToMapPosition(latitude: number, longitude: number): MapPosition {
  const exactAnchor = MICHIGAN_MAP_ANCHORS.find(
    (anchor) => getDistanceSquared(latitude, longitude, anchor) <= EXACT_ANCHOR_MATCH_EPSILON,
  );

  if (exactAnchor) {
    return { x: exactAnchor.xPercent, y: exactAnchor.yPercent };
  }

  const weightedPosition = MICHIGAN_MAP_ANCHORS.reduce(
    (accumulator, anchor) => {
      const distanceSquared = Math.max(getDistanceSquared(latitude, longitude, anchor), EXACT_ANCHOR_MATCH_EPSILON);
      const weight = 1 / distanceSquared ** (IDW_POWER / 2);

      return {
        xTotal: accumulator.xTotal + anchor.xPercent * weight,
        yTotal: accumulator.yTotal + anchor.yPercent * weight,
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
}): MapPosition {
  if (typeof latitude === 'number' && typeof longitude === 'number' && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return latLngToMapPosition(latitude, longitude);
  }

  return { x, y };
}
