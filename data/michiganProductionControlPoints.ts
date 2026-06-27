export type MichiganProductionControlPoint = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  artwork: {
    mobile: {
      x: number;
      y: number;
    };
  };
};

export const MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION = {
  method: 'inverse-distance',
  neighborCount: 4,
  power: 2,
} as const;

// Ray-approved mobile anchor mesh for /public/maps/michigan-atlas-base-tall.webp.
// These production control points intentionally include mobile artwork positions
// only. Desktop artwork placements remain uncalibrated/null and continue on the
// legacy calibrated artwork projection until Ray approves a desktop mesh.
export const MICHIGAN_APPROVED_MOBILE_CONTROL_POINTS: MichiganProductionControlPoint[] = [
  {
    id: 'detroit',
    city: 'Detroit',
    latitude: 42.3314,
    longitude: -83.0458,
    artwork: { mobile: { x: 71.558, y: 59.774 } },
  },
  {
    id: 'port-huron',
    city: 'Port Huron',
    latitude: 42.9709,
    longitude: -82.4249,
    artwork: { mobile: { x: 79.52, y: 49.481 } },
  },
  {
    id: 'grand-rapids',
    city: 'Grand Rapids',
    latitude: 42.9634,
    longitude: -85.6681,
    artwork: { mobile: { x: 37.931, y: 49.602 } },
  },
  {
    id: 'traverse-city',
    city: 'Traverse City',
    latitude: 44.7631,
    longitude: -85.6206,
    artwork: { mobile: { x: 38.54, y: 27.281 } },
  },
  {
    id: 'charlevoix',
    city: 'Charlevoix',
    latitude: 45.3181,
    longitude: -85.2584,
    artwork: { mobile: { x: 43.653, y: 21.599 } },
  },
  {
    id: 'mackinac-straits',
    city: 'Mackinac / Straits',
    latitude: 45.8492,
    longitude: -84.6189,
    artwork: { mobile: { x: 53.625, y: 10.992 } },
  },
  {
    id: 'alpena',
    city: 'Alpena',
    latitude: 45.0617,
    longitude: -83.4328,
    artwork: { mobile: { x: 66.713, y: 24.298 } },
  },
  {
    id: 'sault-ste-marie',
    city: 'Sault Ste. Marie',
    latitude: 46.4953,
    longitude: -84.3453,
    artwork: { mobile: { x: 58.994, y: 8.1 } },
  },
  {
    id: 'escanaba',
    city: 'Escanaba',
    latitude: 45.7452,
    longitude: -87.0646,
    artwork: { mobile: { x: 23.678, y: 13.241 } },
  },
  {
    id: 'marquette',
    city: 'Marquette',
    latitude: 46.5436,
    longitude: -87.3954,
    artwork: { mobile: { x: 20.631, y: 8.1 } },
  },
] as const;
