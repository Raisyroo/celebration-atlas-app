export type MichiganGeoPoint = readonly [longitude: number, latitude: number];

export type MichiganGeoPolygon = {
  id: string;
  label: string;
  coordinates: readonly MichiganGeoPoint[];
};

export type MichiganMapPosition = {
  x: number;
  y: number;
};

// Statewide longitude/latitude extent from public Michigan geography references.
// The homepage now treats this as the real map coordinate space and places all
// markers by latitude/longitude here, rather than by painterly-art anchors.
export const MICHIGAN_GEO_BOUNDS = {
  west: -90.42,
  east: -82.12,
  south: 41.69,
  north: 48.31,
} as const;

// Lightweight GeoJSON-style Michigan land geometry. It intentionally avoids
// roads, labels, and basemap UI: only the two peninsula outlines are needed as
// the accurate positioning layer over the atmospheric artwork.
export const MICHIGAN_GEO_POLYGONS: readonly MichiganGeoPolygon[] = [
  {
    id: 'upper-peninsula',
    label: 'Michigan Upper Peninsula outline',
    coordinates: [
      [-90.42, 46.56],
      [-89.98, 46.65],
      [-89.48, 46.79],
      [-88.98, 47.02],
      [-88.63, 47.47],
      [-88.24, 47.41],
      [-87.86, 46.95],
      [-87.4, 46.55],
      [-86.85, 46.5],
      [-86.25, 46.67],
      [-85.71, 46.75],
      [-85.04, 46.71],
      [-84.35, 46.5],
      [-83.92, 46.08],
      [-84.18, 45.87],
      [-84.72, 45.82],
      [-85.21, 45.72],
      [-85.78, 45.65],
      [-86.44, 45.72],
      [-87.06, 45.75],
      [-87.61, 45.11],
      [-88.12, 45.24],
      [-88.52, 45.58],
      [-89.04, 45.9],
      [-89.62, 46.07],
      [-90.16, 46.28],
      [-90.42, 46.56],
    ],
  },
  {
    id: 'lower-peninsula',
    label: 'Michigan Lower Peninsula outline',
    coordinates: [
      [-84.72, 45.82],
      [-84.23, 45.58],
      [-83.79, 45.28],
      [-83.42, 44.99],
      [-83.32, 44.66],
      [-83.39, 44.28],
      [-83.3, 43.87],
      [-82.72, 43.85],
      [-82.51, 43.58],
      [-82.54, 43.13],
      [-82.42, 42.97],
      [-82.47, 42.62],
      [-82.83, 42.35],
      [-83.12, 42.11],
      [-83.54, 41.77],
      [-84.12, 41.7],
      [-84.8, 41.76],
      [-85.43, 41.76],
      [-86.18, 41.76],
      [-86.54, 42.18],
      [-86.32, 42.78],
      [-86.35, 43.35],
      [-86.45, 43.78],
      [-86.43, 44.1],
      [-86.18, 44.46],
      [-85.82, 44.78],
      [-85.58, 45.0],
      [-85.61, 45.31],
      [-85.24, 45.47],
      [-84.95, 45.63],
      [-84.72, 45.82],
    ],
  },
];

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const mercatorLatitude = (latitude: number) => Math.log(Math.tan(Math.PI / 4 + toRadians(latitude) / 2));

const projectedNorth = mercatorLatitude(MICHIGAN_GEO_BOUNDS.north);
const projectedSouth = mercatorLatitude(MICHIGAN_GEO_BOUNDS.south);

export function latLngToMichiganMapPosition(latitude: number, longitude: number): MichiganMapPosition {
  const x = ((longitude - MICHIGAN_GEO_BOUNDS.west) / (MICHIGAN_GEO_BOUNDS.east - MICHIGAN_GEO_BOUNDS.west)) * 100;
  const projectedLatitude = mercatorLatitude(latitude);
  const y = ((projectedNorth - projectedLatitude) / (projectedNorth - projectedSouth)) * 100;

  return {
    x: clampPercent(x),
    y: clampPercent(y),
  };
}

export function michiganGeoPolygonToSvgPath(coordinates: readonly MichiganGeoPoint[]) {
  return coordinates
    .map(([longitude, latitude], index) => {
      const point = latLngToMichiganMapPosition(latitude, longitude);
      const command = index === 0 ? 'M' : 'L';

      return `${command}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ') + ' Z';
}
