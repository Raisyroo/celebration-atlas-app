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

// Anchor projection for the unchanged painterly atlas artwork. The Pure Michigan
// reference map was used only as a geographic calibration guide; these mapX/mapY
// values target the visible /public/maps/michigan-atlas-base.webp artwork.
//
// Keep this as the single latitude/longitude -> atlas percentage projection path
// for homepage markers and event-tied visual effects.
export const MICHIGAN_MAP_ANCHORS: MichiganMapAnchor[] = [
  {
    name: 'Marquette',
    latitude: 46.5436,
    longitude: -87.3954,
    mapX: 38.67,
    mapY: 17.32,
  },
  {
    name: 'Sault Ste. Marie',
    latitude: 46.4953,
    longitude: -84.3453,
    mapX: 74.47,
    mapY: 20.55,
  },
  {
    name: 'Traverse City',
    latitude: 44.7631,
    longitude: -85.6206,
    mapX: 48.79,
    mapY: 40.36,
  },
  {
    name: 'Alpena',
    latitude: 45.0617,
    longitude: -83.4328,
    mapX: 78.01,
    mapY: 34.72,
  },
  {
    name: 'Grand Rapids',
    latitude: 42.9634,
    longitude: -85.6681,
    mapX: 38.77,
    mapY: 56.93,
  },
  {
    name: 'Lansing',
    latitude: 42.7325,
    longitude: -84.5555,
    mapX: 50.91,
    mapY: 64.22,
  },
  {
    name: 'Detroit',
    latitude: 42.3314,
    longitude: -83.0458,
    mapX: 83.78,
    mapY: 73.28,
  },
  {
    name: 'Port Huron',
    latitude: 42.9709,
    longitude: -82.4249,
    mapX: 94.7,
    mapY: 67.54,
  },
];

const EXACT_ANCHOR_MATCH_EPSILON = 0.0001;
const IDW_POWER = 2;
const K_NEAREST_ANCHORS = 4;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const getDistanceSquared = (
  latitude: number,
  longitude: number,
  anchor: MichiganMapAnchor,
) => {
  const latitudeDelta = latitude - anchor.latitude;
  const longitudeDelta = longitude - anchor.longitude;

  return latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta;
};

// Inverse-distance weighting interpolates each event between nearby anchor
// cities. Event latitude/longitude remains the source of truth; event x/y values
// are used only as a legacy fallback by resolveMapPosition below.
export function latLngToAtlasPosition(
  latitude: number,
  longitude: number,
): AtlasPosition {
  const exactAnchor = MICHIGAN_MAP_ANCHORS.find(
    (anchor) =>
      getDistanceSquared(latitude, longitude, anchor) <=
      EXACT_ANCHOR_MATCH_EPSILON,
  );

  if (exactAnchor) {
    return { x: exactAnchor.mapX, y: exactAnchor.mapY };
  }

  const nearestAnchors = MICHIGAN_MAP_ANCHORS.map((anchor) => ({
    anchor,
    distanceSquared: getDistanceSquared(latitude, longitude, anchor),
  }))
    .sort((a, b) => a.distanceSquared - b.distanceSquared)
    .slice(0, K_NEAREST_ANCHORS);

  const weightedPosition = nearestAnchors.reduce(
    (accumulator, { anchor, distanceSquared }) => {
      const safeDistanceSquared = Math.max(
        distanceSquared,
        EXACT_ANCHOR_MATCH_EPSILON,
      );
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
  if (
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
  ) {
    return latLngToAtlasPosition(latitude, longitude);
  }

  return { x, y };
}
