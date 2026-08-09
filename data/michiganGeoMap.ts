export type MichiganMapPosition = {
  x: number;
  y: number;
};

// Geographic scaffold for the illustrated Michigan presentation. These are
// the published limits of USA Michigan location map.svg; the source artwork is
// not rendered and none of the former painterly-map corrections live here.
export const MICHIGAN_GEO_BOUNDS = {
  west: -90.6,
  east: -81.9,
  south: 41.5,
  north: 48.5,
} as const;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export function latLngToMichiganSvgPosition(
  latitude: number,
  longitude: number,
): MichiganMapPosition {
  const x =
    ((longitude - MICHIGAN_GEO_BOUNDS.west)
      / (MICHIGAN_GEO_BOUNDS.east - MICHIGAN_GEO_BOUNDS.west))
    * 100;
  const y =
    ((MICHIGAN_GEO_BOUNDS.north - latitude)
      / (MICHIGAN_GEO_BOUNDS.north - MICHIGAN_GEO_BOUNDS.south))
    * 100;

  return {
    x: clampPercent(x),
    y: clampPercent(y),
  };
}
