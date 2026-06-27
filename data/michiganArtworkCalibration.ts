import { latLngToMichiganSvgPosition } from "./michiganGeoMap";
import {
  MICHIGAN_APPROVED_MOBILE_CONTROL_POINTS,
  MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION,
} from "./michiganProductionControlPoints";

export type MichiganArtworkVariant = "desktop" | "mobile";

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

export type MichiganRegionalCalibrationZone =
  | "lower-peninsula"
  | "straits-transition"
  | "upper-peninsula";

export type MichiganUpperPeninsulaStraitsCorrection = {
  /** Mobile-only debug/calibration setting; production markers do not consume this layer. */
  appliesTo: Extract<MichiganArtworkVariant, "mobile">;
  /** Northern Lower Peninsula latitude where the Straits transition begins blending in. */
  transitionStartLatitude: number;
  /** Latitude where U.P./Straits regional correction may be fully active. */
  upperPeninsulaStartLatitude: number;
  /** Longitude west of this line is treated as U.P. even where north-shore latitude overlaps the Straits band. */
  westernUpperPeninsulaLongitude: number;
  /** Longitude where the western U.P. geography signal is fully active. */
  westernUpperPeninsulaFullLongitude: number;
  /** Mackinac / eastern Straits longitude window for bridge/island blending. */
  straitsLongitudeRange: readonly [number, number];
  /** Northern Lower Peninsula latitude where eastward x correction begins blending in. */
  horizontalTransitionStartLatitude: number;
  /** Eastward x offset for northwest Lower Michigan / Charlevoix at full local weight. */
  northernLowerXOffsetPercent: number;
  /** Eastward x offset through the Mackinac / Straits band. */
  straitsXOffsetPercent: number;
  /** Eastward x offset for Upper Peninsula markers. */
  upperPeninsulaXOffsetPercent: number;
  /** Extra eastward x offset as U.P. targets move west toward Escanaba / Marquette. */
  westernUpperPeninsulaXBoostPercent: number;
  /** Extra mobile y offset at full regional weight, in artwork percentage points. */
  maxYOffsetPercent: number;
  /** Optional local horizontal expansion around the Straits center to counter the compressed illustrated U.P. */
  xScaleFromStraitsCenter: number;
  /** Center longitude for the optional local horizontal expansion. */
  scaleCenterLongitude: number;
};

export type MichiganRegionalCorrectionDebug = {
  zone: MichiganRegionalCalibrationZone;
  transitionWeight: number;
  straitsWeight: number;
  upperPeninsulaWeight: number;
  regionalWeight: number;
  horizontalWeight: number;
  westBoostWeight: number;
  xOffsetPercent: number;
  yOffsetPercent: number;
  xScaleOffsetPercent: number;
};

export const MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY = "(max-width: 767px)";

// The tall mobile artwork visually stretches northern Michigan more than the
// shared desktop/mobile calibrated projection expects. Keep real event
// latitude/longitude as the source of truth, then add this smooth mobile-only
// y-axis presentation correction after the shared calibration. Southern Lower
// Peninsula markers stay unchanged; Traverse City, the Straits, Alpena, and the
// U.P. ease progressively downward. Tune this one block when the mobile artwork
// changes or after future device testing.
export const MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION: MobileLatitudeVerticalCorrection =
  {
    startLatitude: 43.2,
    endLatitude: 46.2,
    maxYOffsetPercent: 12.5,
  } as const;

// U.P. / Straits artwork correction is intentionally geography-based and
// mobile-only. Lower Michigan remains locked by returning zero regional weight
// south of the northern transition bands; northwest Lower Michigan eases into a
// small eastward shift, Mackinac/bridge/island geography receives a stronger
// eastward shift, and the Upper Peninsula receives the strongest eastward shift.
// Vertical correction remains in the older Straits/U.P. band so the improved
// Lower Michigan placement is preserved.
export const MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION: MichiganUpperPeninsulaStraitsCorrection =
  {
    appliesTo: "mobile",
    horizontalTransitionStartLatitude: 44.85,
    transitionStartLatitude: 45.38,
    upperPeninsulaStartLatitude: 45.92,
    westernUpperPeninsulaLongitude: -85.85,
    westernUpperPeninsulaFullLongitude: -86.35,
    straitsLongitudeRange: [-85.75, -83.65],
    northernLowerXOffsetPercent: 1.15,
    straitsXOffsetPercent: 2.35,
    upperPeninsulaXOffsetPercent: 4.1,
    westernUpperPeninsulaXBoostPercent: 0.75,
    maxYOffsetPercent: -4.4,
    xScaleFromStraitsCenter: 0,
    scaleCenterLongitude: -84.85,
  } as const;

export const MICHIGAN_ARTWORK_CALIBRATIONS: Record<
  MichiganArtworkVariant,
  MichiganArtworkCalibration
> = {
  desktop: {
    imageSrc: "/maps/michigan-atlas-base.webp",
    offsetXPercent: 13.7,
    offsetYPercent: 9.8,
    scale: 1.11,
  },
  mobile: {
    imageSrc: "/maps/michigan-atlas-base-tall.webp",
    offsetXPercent: 18.6,
    offsetYPercent: 31.2,
    scale: 0.94,
  },
} as const;

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const clampUnit = (value: number) => Math.min(1, Math.max(0, value));

const smoothStep = (value: number) => value * value * (3 - 2 * value);

const smoothRange = (value: number, start: number, end: number) => {
  if (start === end) return value >= end ? 1 : 0;
  return smoothStep(clampUnit((value - start) / (end - start)));
};

const getMobileLatitudeYOffset = (latitude: number) => {
  const { startLatitude, endLatitude, maxYOffsetPercent } =
    MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION;

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
) => (geographicPercent - offsetPercent - 50) / scale + 50;

export function getMichiganRegionalCorrectionDebug(
  latitude: number,
  longitude: number,
): MichiganRegionalCorrectionDebug {
  const correction = MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION;
  const horizontalWeight = smoothRange(
    latitude,
    correction.horizontalTransitionStartLatitude,
    correction.upperPeninsulaStartLatitude,
  );
  const transitionWeight = smoothRange(
    latitude,
    correction.transitionStartLatitude,
    correction.upperPeninsulaStartLatitude,
  );
  const westWeight =
    1 -
    smoothRange(
      longitude,
      correction.westernUpperPeninsulaFullLongitude,
      correction.westernUpperPeninsulaLongitude,
    );
  const upperPeninsulaWeight = Math.max(
    smoothRange(
      latitude,
      correction.upperPeninsulaStartLatitude,
      correction.upperPeninsulaStartLatitude + 0.28,
    ),
    Math.min(transitionWeight, westWeight),
  );
  const [straitsWestLongitude, straitsEastLongitude] =
    correction.straitsLongitudeRange;
  const straitsLongitudeWeight =
    smoothRange(longitude, straitsWestLongitude, straitsWestLongitude + 0.45) *
    (1 -
      smoothRange(
        longitude,
        straitsEastLongitude - 0.45,
        straitsEastLongitude,
      ));
  const straitsWeight = transitionWeight * straitsLongitudeWeight;
  const regionalWeight = Math.max(upperPeninsulaWeight, straitsWeight);
  const zone: MichiganRegionalCalibrationZone =
    upperPeninsulaWeight >= 0.8
      ? "upper-peninsula"
      : regionalWeight > 0
        ? "straits-transition"
        : "lower-peninsula";
  const northernLowerXOffsetPercent =
    correction.northernLowerXOffsetPercent * horizontalWeight;
  const straitsXOffsetPercent =
    correction.straitsXOffsetPercent * straitsWeight;
  const westBoostWeight = upperPeninsulaWeight * westWeight;
  const upperPeninsulaXOffsetPercent =
    correction.upperPeninsulaXOffsetPercent * upperPeninsulaWeight +
    correction.westernUpperPeninsulaXBoostPercent * westBoostWeight;
  const xOffsetPercent = Math.max(
    northernLowerXOffsetPercent,
    straitsXOffsetPercent,
    upperPeninsulaXOffsetPercent,
  );
  const xScaleOffsetPercent = Math.max(
    0,
    (longitude - correction.scaleCenterLongitude) *
      correction.xScaleFromStraitsCenter *
      regionalWeight,
  );

  return {
    zone,
    horizontalWeight,
    transitionWeight,
    straitsWeight,
    upperPeninsulaWeight,
    regionalWeight,
    westBoostWeight,
    xOffsetPercent,
    yOffsetPercent: correction.maxYOffsetPercent * regionalWeight,
    xScaleOffsetPercent,
  };
}

const CONTROL_POINT_EPSILON = 0.0001;

type ControlPointProjectionVariant = Extract<MichiganArtworkVariant, "mobile">;

export function projectLatLngWithMichiganControlPoints(
  latitude: number,
  longitude: number,
  variant: ControlPointProjectionVariant,
): MichiganArtworkPosition {
  const weightedControlPoints = MICHIGAN_APPROVED_MOBILE_CONTROL_POINTS.map(
    (controlPoint) => {
      const latitudeDelta = latitude - controlPoint.latitude;
      const longitudeDelta = longitude - controlPoint.longitude;

      return {
        controlPoint,
        distanceSquared:
          latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta,
      };
    },
  ).sort((a, b) => a.distanceSquared - b.distanceSquared);

  const exact = weightedControlPoints.find(
    ({ distanceSquared }) => distanceSquared <= CONTROL_POINT_EPSILON,
  );

  if (exact) return exact.controlPoint.artwork[variant];

  const totals = weightedControlPoints
    .slice(0, MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION.neighborCount)
    .reduce(
      (accumulator, { controlPoint, distanceSquared }) => {
        const position = controlPoint.artwork[variant];
        const weight =
          1 /
          Math.max(distanceSquared, CONTROL_POINT_EPSILON) **
            (MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION.power / 2);

        return {
          x: accumulator.x + position.x * weight,
          y: accumulator.y + position.y * weight,
          weight: accumulator.weight + weight,
        };
      },
      { x: 0, y: 0, weight: 0 },
    );

  return {
    x: clampPercent(totals.x / totals.weight),
    y: clampPercent(totals.y / totals.weight),
  };
}

export function projectLatLngToLegacyCalibratedMichiganArtworkPosition(
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

  if (variant !== "mobile") return calibratedPosition;

  const regionalCorrection = getMichiganRegionalCorrectionDebug(
    latitude,
    longitude,
  );

  return {
    x: clampPercent(
      calibratedPosition.x +
        regionalCorrection.xOffsetPercent +
        regionalCorrection.xScaleOffsetPercent,
    ),
    y: clampPercent(
      calibratedPosition.y +
        getMobileLatitudeYOffset(latitude) +
        regionalCorrection.yOffsetPercent,
    ),
  };
}

export function projectLatLngToCalibratedMichiganArtworkPosition(
  latitude: number,
  longitude: number,
  variant: MichiganArtworkVariant,
): MichiganArtworkPosition {
  if (variant === "mobile") {
    // Developer-only candidate projection for the calibration workbench.
    // Production homepage markers must not call this helper; they use
    // resolveMapPosition/latLngToAtlasPosition from mapCalibration.ts.
    return projectLatLngWithMichiganControlPoints(latitude, longitude, "mobile");
  }

  return projectLatLngToLegacyCalibratedMichiganArtworkPosition(
    latitude,
    longitude,
    variant,
  );
}
