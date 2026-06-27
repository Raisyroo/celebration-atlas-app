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

export type MichiganMapRegionalCorrection = {
  label: string;
  matches: (input: { latitude: number; longitude: number }) => boolean;
  translateX: number;
  translateY: number;
};

export type MichiganSvgReferencePoint = {
  name: string;
  latitude: number;
  longitude: number;
  svgPosition: MichiganMapPosition;
  artworkPosition: MichiganMapPosition;
};

// Hidden reference layer source:
// Wikimedia Commons File:USA Michigan location map.svg by Alexrk2, CC BY 3.0 / GFDL.
// The source SVG is a real Michigan location map with these published map limits:
// N 48.5° / S 41.5° / W 90.6° / E 81.9°, using an equirectangular projection
// with a 140% north/south stretch. We keep the painterly artwork visible and use
// this SVG coordinate system only as the geographic projection scaffold.
export const MICHIGAN_REFERENCE_SVG = {
  sourceName: 'USA Michigan location map.svg',
  sourceUrl: 'https://commons.wikimedia.org/wiki/File:USA_Michigan_location_map.svg',
  viewBox: '0 0 1065.9613 1200.4784',
  width: 1065.9613,
  height: 1200.4784,
  bounds: {
    west: -90.6,
    east: -81.9,
    south: 41.5,
    north: 48.5,
  },
} as const;

export const MICHIGAN_GEO_BOUNDS = MICHIGAN_REFERENCE_SVG.bounds;

// A lightweight derived outline used for the hidden in-app reference SVG. Marker
// coordinates are not read from this hand-tuned list; both the path and markers
// are projected from longitude/latitude through MICHIGAN_REFERENCE_SVG.bounds.
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

// One centralized fit aligns the hidden SVG coordinate system to the painterly
// atlas. Tune only these values (and the regional corrections below) when using
// /?verify=1; event data and cluster/card interactions should stay untouched.
export const MICHIGAN_ARTWORK_OVERLAY_TRANSFORM = {
  overlayScaleX: 1.089,
  overlayScaleY: 0.715,
  overlayTranslateX: -21.16,
  overlayTranslateY: -27.92,
} as const;

// Small artwork-specific nudges for regions where the illustrated map bends away
// from the flat SVG reference. They are intentionally geography-based rather than
// event-based so future city markers inherit the same hidden overlay behavior.
export const MICHIGAN_ARTWORK_REGIONAL_CORRECTIONS: readonly MichiganMapRegionalCorrection[] = [
  {
    label: 'west-lower-peninsula-lakeshore',
    matches: ({ latitude, longitude }) =>
      latitude < 44.1 && longitude < -85.3 && longitude > -86.6,
    translateX: -9.4,
    translateY: 6.4,
  },
  {
    label: 'northwest-lower-peninsula',
    matches: ({ latitude, longitude }) =>
      latitude >= 44.1 && latitude < 45.55 && longitude < -84.9,
    translateX: -9.6,
    translateY: 6.8,
  },
  {
    label: 'northeast-lower-peninsula',
    matches: ({ latitude, longitude }) =>
      latitude >= 44.4 && latitude < 45.55 && longitude >= -84.9,
    translateX: -8.3,
    translateY: 4.8,
  },
  {
    label: 'straits-and-mackinac',
    matches: ({ latitude }) => latitude >= 45.55 && latitude < 46.0,
    translateX: -8.2,
    translateY: 5.9,
  },
  {
    label: 'southeast-thumb',
    matches: ({ latitude, longitude }) => latitude < 43.35 && longitude > -83.3,
    translateX: 1.4,
    translateY: -2.8,
  },
  {
    label: 'south-central-lower-peninsula',
    matches: ({ latitude, longitude }) =>
      latitude < 43.15 && longitude <= -83.3 && longitude > -85.1,
    translateX: -2.1,
    translateY: 5.0,
  },
  {
    label: 'upper-peninsula',
    matches: ({ latitude }) => latitude >= 46.0,
    translateX: 0.2,
    translateY: -0.8,
  },
] as const;

const getMichiganArtworkRegionalCorrection = (latitude: number, longitude: number) =>
  MICHIGAN_ARTWORK_REGIONAL_CORRECTIONS.find((correction) =>
    correction.matches({ latitude, longitude }),
  );

const applyMichiganSvgToArtworkFit = (
  position: MichiganMapPosition,
  latitude: number,
  longitude: number,
): MichiganMapPosition => {
  const correction = getMichiganArtworkRegionalCorrection(latitude, longitude);

  return {
    x: clampPercent(
      50 +
        (position.x - 50) * MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayScaleX +
        MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayTranslateX +
        (correction?.translateX ?? 0),
    ),
    y: clampPercent(
      50 +
        (position.y - 50) * MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayScaleY +
        MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayTranslateY +
        (correction?.translateY ?? 0),
    ),
  };
};

// The full visual overlay is no longer a single CSS transform because regional
// corrections are applied per point. This transform is still used to render the
// verification scaffold and keeps the global fit values visible in one place.
export const getMichiganSvgToArtworkCssTransform = () =>
  `translate(${MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayTranslateX}%, ${MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayTranslateY}%) scale(${MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayScaleX}, ${MICHIGAN_ARTWORK_OVERLAY_TRANSFORM.overlayScaleY})`;

export function latLngToMichiganSvgPosition(latitude: number, longitude: number): MichiganMapPosition {
  const x = ((longitude - MICHIGAN_GEO_BOUNDS.west) / (MICHIGAN_GEO_BOUNDS.east - MICHIGAN_GEO_BOUNDS.west)) * 100;
  const y = ((MICHIGAN_GEO_BOUNDS.north - latitude) / (MICHIGAN_GEO_BOUNDS.north - MICHIGAN_GEO_BOUNDS.south)) * 100;

  return {
    x: clampPercent(x),
    y: clampPercent(y),
  };
}

export function latLngToMichiganMapPosition(latitude: number, longitude: number): MichiganMapPosition {
  return applyMichiganSvgToArtworkFit(
    latLngToMichiganSvgPosition(latitude, longitude),
    latitude,
    longitude,
  );
}

export const MICHIGAN_SVG_REFERENCE_POINTS: readonly MichiganSvgReferencePoint[] = [
  { name: 'Detroit', latitude: 42.3314, longitude: -83.0458 },
  { name: 'Traverse City', latitude: 44.7631, longitude: -85.6206 },
  { name: 'Port Huron', latitude: 42.9709, longitude: -82.4249 },
  { name: 'Marquette', latitude: 46.5436, longitude: -87.3954 },
].map((point) => {
  const svgPosition = latLngToMichiganSvgPosition(point.latitude, point.longitude);

  return {
    ...point,
    svgPosition,
    artworkPosition: applyMichiganSvgToArtworkFit(
      svgPosition,
      point.latitude,
      point.longitude,
    ),
  };
});

export function michiganGeoPolygonToSvgPath(coordinates: readonly MichiganGeoPoint[]) {
  return coordinates
    .map(([longitude, latitude], index) => {
      const point = latLngToMichiganSvgPosition(latitude, longitude);
      const command = index === 0 ? 'M' : 'L';

      return `${command}${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ') + ' Z';
}
