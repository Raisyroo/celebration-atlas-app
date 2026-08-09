import { latLngToMichiganSvgPosition } from './michiganGeoMap.ts';

export type MichiganArtworkVariant = 'desktop' | 'mobile';

export type MichiganArtworkCalibration = {
  imageSrc: string;
  offsetXPercent: number;
  offsetYPercent: number;
  scaleX: number;
  scaleY: number;
  southernPerspectiveShiftXPercent: number;
};

export type MichiganArtworkPosition = {
  x: number;
  y: number;
};

export const MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY = '(max-width: 767px)';

// These values are scoped only to Ray's 2026-08 Michigan clouds artwork.
// The v2 southward perspective shear follows this asset's illustrated Lower
// Peninsula; it is not the former painterly-map or tall-mobile correction.
// Real latitude/longitude remains the source of truth.
export const MICHIGAN_ARTWORK_CALIBRATIONS: Record<
  MichiganArtworkVariant,
  MichiganArtworkCalibration
> = {
  desktop: {
    imageSrc: '/maps/michigan-atlas-clouds-desktop-2026-08.webp',
    offsetXPercent: 1.5,
    offsetYPercent: 17.2,
    scaleX: 0.95,
    scaleY: 1.43,
    southernPerspectiveShiftXPercent: 5.7,
  },
  mobile: {
    imageSrc: '/maps/michigan-atlas-clouds-mobile-2026-08.webp',
    offsetXPercent: 1.5,
    offsetYPercent: 48.9,
    scaleX: 1.125,
    scaleY: 2.066,
    southernPerspectiveShiftXPercent: 5.7,
  },
} as const;

const MICHIGAN_ARTWORK_PERSPECTIVE_NORTH_LATITUDE = 45.85;
const MICHIGAN_ARTWORK_PERSPECTIVE_SOUTH_LATITUDE = 42.3;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const invertArtworkOverlayAxis = (
  geographicPercent: number,
  offsetPercent: number,
  scale: number,
) => ((geographicPercent - offsetPercent - 50) / scale) + 50;

export function projectLatLngToCalibratedMichiganArtworkPosition(
  latitude: number,
  longitude: number,
  variant: MichiganArtworkVariant,
): MichiganArtworkPosition {
  const calibration = MICHIGAN_ARTWORK_CALIBRATIONS[variant];
  const geographicPosition = latLngToMichiganSvgPosition(latitude, longitude);
  const southernPerspectiveFactor = clampPercent(
    ((MICHIGAN_ARTWORK_PERSPECTIVE_NORTH_LATITUDE - latitude)
      / (MICHIGAN_ARTWORK_PERSPECTIVE_NORTH_LATITUDE
        - MICHIGAN_ARTWORK_PERSPECTIVE_SOUTH_LATITUDE))
      * 100,
  ) / 100;

  // The base inverse transform maps geographic scaffold percentages into this
  // asset's artwork plane. The latitude-weighted X shift then follows the
  // current illustration's perspective without changing canonical coordinates.
  return {
    x: clampPercent(
      invertArtworkOverlayAxis(
        geographicPosition.x,
        calibration.offsetXPercent,
        calibration.scaleX,
      )
        - southernPerspectiveFactor
          * calibration.southernPerspectiveShiftXPercent,
    ),
    y: clampPercent(
      invertArtworkOverlayAxis(
        geographicPosition.y,
        calibration.offsetYPercent,
        calibration.scaleY,
      ),
    ),
  };
}
