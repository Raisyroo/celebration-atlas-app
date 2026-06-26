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

type MobileLatitudeVerticalCorrection = {
  /** Latitude where the mobile-only downward correction begins. */
  startLatitude: number;
  /** Latitude where the mobile-only downward correction reaches its maximum. */
  endLatitude: number;
  /** Maximum additional y-percentage applied at and north of endLatitude. */
  maxYOffsetPercent: number;
};

export const MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY = '(max-width: 767px)';

// The tall mobile artwork visually stretches northern Michigan more than the
// shared desktop/mobile calibrated projection expects. Keep real event
// latitude/longitude as the source of truth, then add this smooth mobile-only
// y-axis presentation correction after the shared calibration. Southern Lower
// Peninsula markers stay unchanged; Traverse City, the Straits, Alpena, and the
// U.P. ease progressively downward. Tune this one block when the mobile artwork
// changes or after future device testing.
export const MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION: MobileLatitudeVerticalCorrection = {
  startLatitude: 43.4,
  endLatitude: 46.6,
  maxYOffsetPercent: 7.5,
} as const;

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

const smoothStep = (value: number) => value * value * (3 - (2 * value));

const getMobileLatitudeYOffset = (latitude: number) => {
  const {
    startLatitude,
    endLatitude,
    maxYOffsetPercent,
  } = MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION;

  if (latitude <= startLatitude) return 0;

  const latitudeProgress = Math.min(
    1,
    (latitude - startLatitude) / (endLatitude - startLatitude),
  );

  return smoothStep(latitudeProgress) * maxYOffsetPercent;
};

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
  const calibratedPosition = {
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

  if (variant !== 'mobile') return calibratedPosition;

  return {
    ...calibratedPosition,
    y: clampPercent(calibratedPosition.y + getMobileLatitudeYOffset(latitude)),
  };
}
