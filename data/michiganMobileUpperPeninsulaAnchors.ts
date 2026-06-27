export type MichiganMobileUpperPeninsulaAnchorKey =
  | 'escanaba'
  | 'marquette'
  | 'sault-ste-marie';

export type MichiganMobileUpperPeninsulaAnchor = {
  key: MichiganMobileUpperPeninsulaAnchorKey;
  name: string;
  latitude: number;
  longitude: number;
  mobileProductionTarget: {
    x: number;
    y: number;
  };
};

// Exact approved U.P. anchor targets for the mobile production marker frame.
// These direct CSS marker-frame percentages intentionally do not define a
// U.P.-wide interpolation or regional transform.
export const MICHIGAN_MOBILE_UPPER_PENINSULA_ANCHORS: readonly MichiganMobileUpperPeninsulaAnchor[] = [
  {
    key: 'escanaba',
    name: 'Escanaba',
    latitude: 45.7453,
    longitude: -87.0646,
    mobileProductionTarget: { x: 35.36, y: 21.22 },
  },
  {
    key: 'marquette',
    name: 'Marquette',
    latitude: 46.5436,
    longitude: -87.3954,
    mobileProductionTarget: { x: 32.86, y: 11.19 },
  },
  {
    key: 'sault-ste-marie',
    name: 'Sault Ste. Marie',
    latitude: 46.4953,
    longitude: -84.3453,
    mobileProductionTarget: { x: 69.64, y: 13.03 },
  },
] as const;

const GEOGRAPHIC_ANCHOR_MATCH_EPSILON_DEGREES = 0.0002;

export function resolveExactMichiganMobileUpperPeninsulaAnchorPosition(
  latitude: number,
  longitude: number,
) {
  const matchingAnchor = MICHIGAN_MOBILE_UPPER_PENINSULA_ANCHORS.find(
    (anchor) =>
      Math.abs(anchor.latitude - latitude) <= GEOGRAPHIC_ANCHOR_MATCH_EPSILON_DEGREES &&
      Math.abs(anchor.longitude - longitude) <= GEOGRAPHIC_ANCHOR_MATCH_EPSILON_DEGREES,
  );

  return matchingAnchor?.mobileProductionTarget ?? null;
}
