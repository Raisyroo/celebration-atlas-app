import { latLngToMichiganSvgPosition } from './michiganGeoMap';

export type MichiganArtworkVariant = 'desktop' | 'mobile';

export type MichiganArtworkCalibration = {
  imageSrc: string;
  offsetXPercent: number;
  offsetYPercent: number;
  scale: number;
};

export type MichiganArtworkPosition = {
  x: number;
  y: number;
};

export const MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY = '(max-width: 767px)';

export const MICHIGAN_ARTWORK_CALIBRATIONS: Record<
  MichiganArtworkVariant,
  MichiganArtworkCalibration
> = {
  desktop: {
    imageSrc: '/maps/michigan-atlas-base.webp',
    offsetXPercent: 13.7,
    offsetYPercent: 9.8,
    scale: 1.11,
  },
  mobile: {
    imageSrc: '/maps/michigan-atlas-base-tall.webp',
    offsetXPercent: 18.6,
    offsetYPercent: 31.2,
    scale: 0.94,
  },
} as const;

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

  // The developer workbench moves the artwork over the static geographic
  // reference with: translate(-50%, -50%) translate(offsetX%, offsetY%) scale(s).
  // Production keeps the artwork static, so markers use the inverse of that
  // overlay transform to land in the equivalent artwork-relative position.
  return {
    x: clampPercent(
      invertArtworkOverlayAxis(
        geographicPosition.x,
        calibration.offsetXPercent,
        calibration.scale,
      ),
    ),
    y: clampPercent(
      invertArtworkOverlayAxis(
        geographicPosition.y,
        calibration.offsetYPercent,
        calibration.scale,
      ),
    ),
  };
}
