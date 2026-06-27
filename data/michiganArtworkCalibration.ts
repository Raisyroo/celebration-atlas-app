import {
  isPointInMichiganUpperPeninsula,
  latLngToMichiganSvgPosition,
} from "./michiganGeoMap";

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

export type MichiganArtworkAnchor = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  mapX: number;
  mapY: number;
};

type MobileLatitudeVerticalCorrection = {
  /** Latitude where the mobile-only downward correction begins. */
  startLatitude: number;
  /** Latitude where the mobile-only downward correction reaches its maximum. */
  endLatitude: number;
  /** Maximum additional y-percentage applied at and north of endLatitude. */
  maxYOffsetPercent: number;
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

export const MICHIGAN_MOBILE_UPPER_PENINSULA_ACTIVE_ANCHORS: readonly MichiganArtworkAnchor[] =
  [
    {
      id: "escanaba",
      name: "Escanaba",
      latitude: 45.7453,
      longitude: -87.0646,
      mapX: 58.038,
      mapY: 56.152,
    },
    {
      id: "marquette",
      name: "Marquette",
      latitude: 46.5436,
      longitude: -87.3954,
      mapX: 55.973,
      mapY: 47.44,
    },
    {
      id: "sault-ste-marie",
      name: "Sault Ste. Marie",
      latitude: 46.4953,
      longitude: -84.3453,
      mapX: 82.08,
      mapY: 48.934,
    },
  ] as const;

const EXACT_ANCHOR_MATCH_EPSILON = 0.0001;

export const interpolateMichiganArtworkAnchors = (
  latitude: number,
  longitude: number,
  anchors: readonly MichiganArtworkAnchor[],
): MichiganArtworkPosition => {
  const exactAnchor = anchors.find((anchor) => {
    const latitudeDelta = latitude - anchor.latitude;
    const longitudeDelta = longitude - anchor.longitude;
    return (
      latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta <=
      EXACT_ANCHOR_MATCH_EPSILON
    );
  });

  if (exactAnchor) return { x: exactAnchor.mapX, y: exactAnchor.mapY };

  const weighted = anchors.reduce(
    (accumulator, anchor) => {
      const latitudeDelta = latitude - anchor.latitude;
      const longitudeDelta = longitude - anchor.longitude;
      const distanceSquared = Math.max(
        latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta,
        EXACT_ANCHOR_MATCH_EPSILON,
      );
      const weight = 1 / distanceSquared;

      return {
        xTotal: accumulator.xTotal + anchor.mapX * weight,
        yTotal: accumulator.yTotal + anchor.mapY * weight,
        weightTotal: accumulator.weightTotal + weight,
      };
    },
    { xTotal: 0, yTotal: 0, weightTotal: 0 },
  );

  return {
    x: clampPercent(weighted.xTotal / weighted.weightTotal),
    y: clampPercent(weighted.yTotal / weighted.weightTotal),
  };
};

export const shouldUseMobileUpperPeninsulaProjection = (
  latitude: number,
  longitude: number,
  variant: MichiganArtworkVariant,
) =>
  variant === "mobile" && isPointInMichiganUpperPeninsula(latitude, longitude);

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

const smoothStep = (value: number) => value * value * (3 - 2 * value);

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

  if (shouldUseMobileUpperPeninsulaProjection(latitude, longitude, variant)) {
    return interpolateMichiganArtworkAnchors(
      latitude,
      longitude,
      MICHIGAN_MOBILE_UPPER_PENINSULA_ACTIVE_ANCHORS,
    );
  }

  if (variant !== "mobile") return calibratedPosition;

  return {
    ...calibratedPosition,
    y: clampPercent(calibratedPosition.y + getMobileLatitudeYOffset(latitude)),
  };
}
