"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from "react";
import { ATLAS_EVENTS } from "../../../data/events";
import {
  MICHIGAN_ARTWORK_CALIBRATIONS,
  MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION,
  MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION,
  getMichiganRegionalCorrectionDebug,
  projectLatLngToLegacyCalibratedMichiganArtworkPosition,
} from "../../../data/michiganArtworkCalibration";
import {
  MICHIGAN_APPROVED_MOBILE_CONTROL_POINTS,
  MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION,
} from "../../../data/michiganProductionControlPoints";
import {
  MICHIGAN_GEO_POLYGONS,
  MICHIGAN_REFERENCE_SVG,
  latLngToMichiganSvgPosition,
  michiganGeoPolygonToSvgPath,
} from "../../../data/michiganGeoMap";

type CalibrationValues = {
  offsetX: number;
  offsetY: number;
  scale: number;
  opacity: number;
};

type ArtworkVariantId = "desktop" | "mobile";

type ControlPointArtworkPosition = {
  x: number;
  y: number;
};

type ControlPointDraft = Partial<
  Record<ArtworkVariantId, ControlPointArtworkPosition>
>;

type MichiganControlPoint = {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  defaultArtwork: Record<ArtworkVariantId, ControlPointArtworkPosition>;
};

type ArtworkVariant = {
  id: ArtworkVariantId;
  label: string;
  imageSrc: string;
  frameAspectRatio: string;
  notes: string;
  initial: CalibrationValues;
};

type ControlPointCalibrationExport = {
  format: "celebration-atlas-michigan-artwork-calibration/v1";
  generatedBy: string;
  sourceOfTruth: string;
  productionBehavior: string;
  audit: {
    mapAnchors: string;
    developerRoute: string;
    recentCorrections: string;
    temporaryCompatibility: string;
    retirementPath: string;
  };
  reference: {
    name: string;
    bounds: typeof MICHIGAN_REFERENCE_SVG.bounds;
    projection: string;
  };
  geographicRegions: Record<string, string>;
  upperPeninsulaStraitsCorrection: Record<string, unknown>;
  mobileLatitudeVerticalCorrection: Record<string, unknown>;
  controlPointInterpolation: {
    method: string;
    neighborCount: number;
    power: number;
    productionBehavior: string;
  };
  controlPoints: Array<{
    id: string;
    city: string;
    latitude: number;
    longitude: number;
    rawGeographicReference: ControlPointArtworkPosition;
    artwork: Record<ArtworkVariantId, ControlPointArtworkPosition | null>;
    savedCompatibilityArtwork: Record<ArtworkVariantId, ControlPointArtworkPosition>;
  }>;
};

const ARTWORK_VARIANTS: ArtworkVariant[] = [
  {
    id: "desktop",
    label: "Desktop artwork calibration",
    imageSrc: "/maps/michigan-atlas-base.webp",
    frameAspectRatio: "1 / 1",
    notes: "Production desktop/tablet painterly Michigan artwork asset.",
    initial: {
      offsetX: MICHIGAN_ARTWORK_CALIBRATIONS.desktop.offsetXPercent,
      offsetY: MICHIGAN_ARTWORK_CALIBRATIONS.desktop.offsetYPercent,
      scale: MICHIGAN_ARTWORK_CALIBRATIONS.desktop.scale,
      opacity: 0.62,
    },
  },
  {
    id: "mobile",
    label: "Mobile artwork calibration",
    imageSrc: "/maps/michigan-atlas-base-tall.webp",
    frameAspectRatio: "9 / 16",
    notes:
      "Tall mobile artwork variant; compressed sibling exists for delivery experiments.",
    initial: {
      offsetX: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.offsetXPercent,
      offsetY: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.offsetYPercent,
      scale: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.scale,
      opacity: 0.62,
    },
  },
];

const MICHIGAN_CALIBRATION_SCROLL_CLASS = "dev-michigan-calibration-scroll";

const MICHIGAN_CONTROL_POINTS: MichiganControlPoint[] =
  MICHIGAN_APPROVED_MOBILE_CONTROL_POINTS.map((point) => ({
    id: point.id,
    city: point.city,
    latitude: point.latitude,
    longitude: point.longitude,
    defaultArtwork: {
      desktop: projectLatLngToLegacyCalibratedMichiganArtworkPosition(
        point.latitude,
        point.longitude,
        "desktop",
      ),
      mobile: point.artwork.mobile,
    },
  }));

const CONTROL_POINT_IDW_POWER = MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION.power;
const CONTROL_POINT_NEIGHBOR_COUNT =
  MICHIGAN_MOBILE_CONTROL_POINT_INTERPOLATION.neighborCount;
const CONTROL_POINT_EPSILON = 0.0001;

const getControlPointPosition = (
  controlPoint: MichiganControlPoint,
  variantId: ArtworkVariantId,
  drafts: Record<string, ControlPointDraft>,
) =>
  drafts[controlPoint.id]?.[variantId] ?? controlPoint.defaultArtwork[variantId];

const projectWithControlPoints = (
  latitude: number,
  longitude: number,
  variantId: ArtworkVariantId,
  drafts: Record<string, ControlPointDraft>,
): ControlPointArtworkPosition => {
  const weightedControlPoints = MICHIGAN_CONTROL_POINTS.map((controlPoint) => {
    const latitudeDelta = latitude - controlPoint.latitude;
    const longitudeDelta = longitude - controlPoint.longitude;

    return {
      controlPoint,
      distanceSquared:
        latitudeDelta * latitudeDelta + longitudeDelta * longitudeDelta,
    };
  }).sort((a, b) => a.distanceSquared - b.distanceSquared);

  const exact = weightedControlPoints.find(
    ({ distanceSquared }) => distanceSquared <= CONTROL_POINT_EPSILON,
  );

  if (exact) {
    return getControlPointPosition(exact.controlPoint, variantId, drafts);
  }

  const totals = weightedControlPoints
    .slice(0, CONTROL_POINT_NEIGHBOR_COUNT)
    .reduce(
      (accumulator, { controlPoint, distanceSquared }) => {
        const position = getControlPointPosition(controlPoint, variantId, drafts);
        const weight =
          1 /
          Math.max(distanceSquared, CONTROL_POINT_EPSILON) **
            (CONTROL_POINT_IDW_POWER / 2);

        return {
          x: accumulator.x + position.x * weight,
          y: accumulator.y + position.y * weight,
          weight: accumulator.weight + weight,
        };
      },
      { x: 0, y: 0, weight: 0 },
    );

  return {
    x: Math.min(100, Math.max(0, totals.x / totals.weight)),
    y: Math.min(100, Math.max(0, totals.y / totals.weight)),
  };
};

const sampleEvents = ATLAS_EVENTS.filter(
  (event) =>
    Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
).slice(0, 36);

const formatNumber = (value: number) => Number(value.toFixed(3));

const formatCorrectionLatitude = (value: number) => `${formatNumber(value)}°N`;

const formatCorrectionOffset = (value: number) => `${formatNumber(value)}%`;

const lowerMichiganCalibrationSummary = `Lower Michigan base calibration: shared artwork offset ${formatCorrectionOffset(MICHIGAN_ARTWORK_CALIBRATIONS.mobile.offsetXPercent)} x / ${formatCorrectionOffset(MICHIGAN_ARTWORK_CALIBRATIONS.mobile.offsetYPercent)} y at ${formatNumber(MICHIGAN_ARTWORK_CALIBRATIONS.mobile.scale)} mobile scale; no regional x correction south of ${formatCorrectionLatitude(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.horizontalTransitionStartLatitude)}.`;

const mobileVerticalCorrectionSummary = `Northern vertical correction: starts at ${formatCorrectionLatitude(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.startLatitude)}, reaches max at ${formatCorrectionLatitude(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.endLatitude)}, max downward y offset ${formatCorrectionOffset(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.maxYOffsetPercent)}; U.P./Straits y layer can add ${formatCorrectionOffset(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.maxYOffsetPercent)} at full regional weight.`;

const regionalHorizontalCorrectionSummary = `Northern horizontal correction: mobile-only eastward x starts at ${formatCorrectionLatitude(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.horizontalTransitionStartLatitude)}, builds through the Straits band (${formatCorrectionLatitude(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.transitionStartLatitude)} to ${formatCorrectionLatitude(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.upperPeninsulaStartLatitude)}), and tunes northwest Lower Michigan ${formatCorrectionOffset(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.northernLowerXOffsetPercent)}, Straits ${formatCorrectionOffset(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.straitsXOffsetPercent)}, U.P. ${formatCorrectionOffset(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.upperPeninsulaXOffsetPercent)}, plus western U.P. boost ${formatCorrectionOffset(MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION.westernUpperPeninsulaXBoostPercent)}.`;

const controlPointAuditSummary = {
  mapAnchors:
    "Mobile homepage markers now use the approved artwork-specific control-point mesh; desktop/tablet remains on the legacy calibrated artwork projection.",
  developerRoute:
    "The dev route is the safe calibration surface: Ray selects one named anchor, clicks the illustrated artwork, then copies JSON without writing to the database.",
  recentCorrections:
    "Recent broad mobile northern layers are bypassed in production; gold legacy markers remain here only for reversible debug comparison against the approved mesh.",
  temporaryCompatibility:
    "Mobile production no longer stacks latitude, U.P., Straits, eastward, or regional broad corrections on top of the approved mesh.",
  retirementPath:
    "After Ray supplies desktop anchors, desktop can move from legacy preview to its own approved control-point mesh.",
} as const;

const validationTargets = [
  { name: "Detroit", latitude: 42.3314, longitude: -83.0458 },
  { name: "Romeo", latitude: 42.8028, longitude: -83.01299 },
  { name: "Port Huron", latitude: 42.9709, longitude: -82.4249 },
  { name: "Goodells", latitude: 42.9828, longitude: -82.6655 },
  { name: "Traverse City", latitude: 44.7631, longitude: -85.6206 },
  { name: "Charlevoix", latitude: 45.3181, longitude: -85.2584 },
  { name: "Alpena", latitude: 45.0617, longitude: -83.4328 },
  { name: "Mackinac Island / Straits", latitude: 45.8492, longitude: -84.6189 },
  { name: "Sault Ste. Marie", latitude: 46.4953, longitude: -84.3453 },
  { name: "Escanaba", latitude: 45.7452, longitude: -87.0646 },
  { name: "Marquette", latitude: 46.5436, longitude: -87.3954 },
] as const;

export default function MichiganArtworkCalibration() {
  const [activeVariantId, setActiveVariantId] =
    useState<ArtworkVariant["id"]>("desktop");
  const [calibrations, setCalibrations] = useState<
    Record<ArtworkVariant["id"], CalibrationValues>
  >({
    desktop: ARTWORK_VARIANTS[0].initial,
    mobile: ARTWORK_VARIANTS[1].initial,
  });
  const [copyStatus, setCopyStatus] = useState("");
  const [selectedControlPointId, setSelectedControlPointId] = useState(
    MICHIGAN_CONTROL_POINTS[0].id,
  );
  const [controlPointDrafts, setControlPointDrafts] = useState<
    Record<string, ControlPointDraft>
  >({});

  useEffect(() => {
    document.documentElement.classList.add(MICHIGAN_CALIBRATION_SCROLL_CLASS);
    document.body.classList.add(MICHIGAN_CALIBRATION_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(
        MICHIGAN_CALIBRATION_SCROLL_CLASS,
      );
      document.body.classList.remove(MICHIGAN_CALIBRATION_SCROLL_CLASS);
    };
  }, []);

  const activeVariant =
    ARTWORK_VARIANTS.find((variant) => variant.id === activeVariantId) ??
    ARTWORK_VARIANTS[0];
  const activeCalibration = calibrations[activeVariant.id];
  const selectedControlPoint =
    MICHIGAN_CONTROL_POINTS.find((point) => point.id === selectedControlPointId) ??
    MICHIGAN_CONTROL_POINTS[0];
  const selectedGeoPosition = latLngToMichiganSvgPosition(
    selectedControlPoint.latitude,
    selectedControlPoint.longitude,
  );
  const selectedSavedArtworkPosition =
    selectedControlPoint.defaultArtwork[activeVariant.id];
  const selectedDraftArtworkPosition =
    controlPointDrafts[selectedControlPoint.id]?.[activeVariant.id];

  const eventMarkers = useMemo(
    () =>
      sampleEvents.map((event) => ({
        event,
        geoPosition: latLngToMichiganSvgPosition(
          event.latitude,
          event.longitude,
        ),
        productionPosition: projectLatLngToLegacyCalibratedMichiganArtworkPosition(
          event.latitude,
          event.longitude,
          activeVariant.id,
        ),
        candidatePosition: projectWithControlPoints(
          event.latitude,
          event.longitude,
          activeVariant.id,
          controlPointDrafts,
        ),
      })),
    [activeVariant.id, controlPointDrafts],
  );

  const exportPayload = useMemo<ControlPointCalibrationExport>(
    () => ({
      format: "celebration-atlas-michigan-artwork-calibration/v1",
      generatedBy: "/dev/michigan-artwork-calibration",
      sourceOfTruth:
        "Event latitude/longitude remains unchanged; these values are display transforms for the illustrated artwork only.",
      productionBehavior:
        "Mobile production uses Ray's approved control-point mesh; desktop remains on the existing legacy projection until desktop anchors are calibrated.",
      audit: controlPointAuditSummary,
      reference: {
        name: MICHIGAN_REFERENCE_SVG.sourceName,
        bounds: MICHIGAN_REFERENCE_SVG.bounds,
        projection:
          "equirectangular percentage coordinates from data/michiganGeoMap.ts",
      },
      geographicRegions: {
        lowerPeninsula:
          "Base artwork calibration is preserved; horizontal correction is 0 south of horizontalTransitionStartLatitude.",
        northwestLowerMichigan:
          "Smoothstep eastward x blend begins at horizontalTransitionStartLatitude for Charlevoix / northwest Lower Michigan review without event IDs.",
        straitsTransitionBand:
          "Latitude smoothstep from transitionStartLatitude to upperPeninsulaStartLatitude, with Mackinac / Straits longitude gating.",
        upperPeninsula:
          "Full eastward correction north of upperPeninsulaStartLatitude, plus west-longitude U.P. boost for Escanaba / Marquette style targets.",
      },
      upperPeninsulaStraitsCorrection: {
        ...MICHIGAN_UPPER_PENINSULA_STRAITS_CORRECTION,
        interpolation:
          "geography-based smoothstep weights; no event IDs or manual marker overrides",
      },
      mobileLatitudeVerticalCorrection: {
        behavior:
          "Bypassed by mobile production after Ray approval; still available through the legacy helper for debug comparison only.",
        startLatitude:
          MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.startLatitude,
        endLatitude: MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.endLatitude,
        maxYOffsetPercent:
          MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.maxYOffsetPercent,
        interpolation:
          "smoothstep latitude ramp; zero at and south of startLatitude, capped at maxYOffsetPercent at and north of endLatitude",
      },
      controlPointInterpolation: {
        method:
          "inverse-distance weighting over the nearest named geographic control points",
        neighborCount: CONTROL_POINT_NEIGHBOR_COUNT,
        power: CONTROL_POINT_IDW_POWER,
        productionBehavior:
          "Used by the mobile homepage map with Ray's approved mobile artwork anchors; desktop remains preview-only / legacy.",
      },
      controlPoints: MICHIGAN_CONTROL_POINTS.map((point) => ({
        id: point.id,
        city: point.city,
        latitude: point.latitude,
        longitude: point.longitude,
        rawGeographicReference: latLngToMichiganSvgPosition(
          point.latitude,
          point.longitude,
        ),
        artwork: {
          desktop: controlPointDrafts[point.id]?.desktop ?? null,
          mobile: controlPointDrafts[point.id]?.mobile ?? null,
        },
        savedCompatibilityArtwork: point.defaultArtwork,
      })),
      variants: Object.fromEntries(
        ARTWORK_VARIANTS.map((variant) => [
          variant.id,
          {
            imageSrc: variant.imageSrc,
            offsetXPercent: formatNumber(calibrations[variant.id].offsetX),
            offsetYPercent: formatNumber(calibrations[variant.id].offsetY),
            scale: formatNumber(calibrations[variant.id].scale),
            opacity: formatNumber(calibrations[variant.id].opacity),
            rotationDegrees: 0,
          },
        ]),
      ),
    }),
    [calibrations, controlPointDrafts],
  );

  const updateCalibration = (field: keyof CalibrationValues, value: number) => {
    setCalibrations((current) => ({
      ...current,
      [activeVariant.id]: { ...current[activeVariant.id], [field]: value },
    }));
  };

  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setControlPointDrafts((current) => ({
      ...current,
      [selectedControlPoint.id]: {
        ...current[selectedControlPoint.id],
        [activeVariant.id]: { x: formatNumber(x), y: formatNumber(y) },
      },
    }));
  };

  const resetSelectedControlPoint = () => {
    setControlPointDrafts((current) => {
      const nextPointDraft = { ...current[selectedControlPoint.id] };
      delete nextPointDraft[activeVariant.id];

      return { ...current, [selectedControlPoint.id]: nextPointDraft };
    });
  };

  const copyExport = async () => {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
    setCopyStatus("Copied calibration JSON.");
    window.setTimeout(() => setCopyStatus(""), 2200);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.kicker}>Developer-only calibration</p>
        <h1 style={styles.title}>Michigan artwork calibration workbench</h1>
        <p style={styles.intro}>
          Compare the real geographic Michigan reference outline, the
          illustrated artwork, and a sample of existing ATLAS_EVENTS
          latitude/longitude markers. Production AtlasMap behavior is not
          imported or changed by this route.
        </p>
        <p style={styles.correctionNote}>
          {lowerMichiganCalibrationSummary}{" "}
          {regionalHorizontalCorrectionSummary}{" "}
          {mobileVerticalCorrectionSummary} Real event latitude/longitude
          remains unchanged, and there are no per-event marker overrides.
        </p>
        <section style={styles.auditPanel} aria-label="Calibration audit summary">
          <h2 style={styles.auditTitle}>Audit outcome before production changes</h2>
          <ul style={styles.auditList}>
            {Object.values(controlPointAuditSummary).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </header>

      <section style={styles.toolbar} aria-label="Artwork variant selection">
        {ARTWORK_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => setActiveVariantId(variant.id)}
            style={{
              ...styles.variantButton,
              ...(variant.id === activeVariant.id
                ? styles.variantButtonActive
                : null),
            }}
          >
            {variant.label}
          </button>
        ))}
      </section>

      <div style={styles.layout}>
        <section style={styles.stagePanel} aria-label={activeVariant.label}>
          <div
            onClick={handleStageClick}
            style={{
              ...styles.stage,
              aspectRatio: activeVariant.frameAspectRatio,
            }}
          >
            <ReferenceMichiganSvg />
            <div
              style={{
                ...styles.artworkLayer,
                opacity: activeCalibration.opacity,
                transform: `translate(-50%, -50%) translate(${activeCalibration.offsetX}%, ${activeCalibration.offsetY}%) scale(${activeCalibration.scale})`,
              }}
            >
              <Image
                src={activeVariant.imageSrc}
                alt={`${activeVariant.label} illustrated Michigan artwork`}
                fill
                sizes="(max-width: 900px) 100vw, 680px"
                style={styles.artworkImage}
                priority
              />
            </div>
            {eventMarkers.map(
              ({
                event,
                geoPosition,
                productionPosition,
                candidatePosition,
              }) => (
                <div key={event.id}>
                  <span
                    title={`${event.name} geographic reference`}
                    style={{
                      ...styles.geoMarker,
                      left: `${geoPosition.x}%`,
                      top: `${geoPosition.y}%`,
                    }}
                  />
                  <span
                    title={`${event.name} current legacy artwork projection`}
                    style={{
                      ...styles.atlasMarker,
                      left: `${productionPosition.x}%`,
                      top: `${productionPosition.y}%`,
                    }}
                  />
                  <span
                    title={`${event.name} approved mobile production mesh projection`}
                    style={{
                      ...styles.candidateMarker,
                      left: `${candidatePosition.x}%`,
                      top: `${candidatePosition.y}%`,
                    }}
                  />
                </div>
              ),
            )}

            <span
              title={`${selectedControlPoint.city} raw geographic reference`}
              style={{
                ...styles.selectedGeoMarker,
                left: `${selectedGeoPosition.x}%`,
                top: `${selectedGeoPosition.y}%`,
              }}
            />
            <span
              title={`${selectedControlPoint.city} saved artwork location`}
              style={{
                ...styles.selectedSavedMarker,
                left: `${selectedSavedArtworkPosition.x}%`,
                top: `${selectedSavedArtworkPosition.y}%`,
              }}
            />
            {selectedDraftArtworkPosition ? (
              <span
                title={`${selectedControlPoint.city} newly selected artwork location`}
                style={{
                  ...styles.selectedDraftMarker,
                  left: `${selectedDraftArtworkPosition.x}%`,
                  top: `${selectedDraftArtworkPosition.y}%`,
                }}
              />
            ) : null}
          </div>
          <p style={styles.legend}>
            <b>Blue dots</b> = raw latitude/longitude on geographic reference.{" "}
            <b>Gold rings</b> = current legacy projection. <b>Green dots</b> =
            approved mobile production control-point interpolation. Desktop green dots
            remain preview-only until Ray calibrates desktop anchors. The larger
            selected-anchor markers show raw reference, saved artwork, and newly
            clicked artwork locations.
          </p>
        </section>

        <aside style={styles.controls} aria-label="Calibration controls">
          <h2 style={styles.panelTitle}>{activeVariant.label}</h2>
          <p style={styles.notes}>{activeVariant.notes}</p>

          <section style={styles.controlPointPanel}>
            <h3 style={styles.correctionTitle}>Control-point placement mode</h3>
            <p style={styles.correctionHelp}>
              Click the illustrated artwork to assign one named geographic anchor
              for the active {activeVariant.id} variant. This calibrates shared
              artwork anchors only, never individual events.
            </p>
            <label style={styles.selectLabel}>
              Anchor
              <select
                value={selectedControlPoint.id}
                onChange={(event) =>
                  setSelectedControlPointId(event.currentTarget.value)
                }
                style={styles.selectInput}
              >
                {MICHIGAN_CONTROL_POINTS.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.city}
                  </option>
                ))}
              </select>
            </label>
            <dl style={styles.coordinateList}>
              <div>
                <dt>Real lat/lon</dt>
                <dd>
                  {selectedControlPoint.latitude}, {selectedControlPoint.longitude}
                </dd>
              </div>
              <div>
                <dt>Raw geographic reference</dt>
                <dd>
                  x {formatNumber(selectedGeoPosition.x)}%, y{" "}
                  {formatNumber(selectedGeoPosition.y)}%
                </dd>
              </div>
              <div>
                <dt>Existing saved artwork</dt>
                <dd>
                  x {formatNumber(selectedSavedArtworkPosition.x)}%, y{" "}
                  {formatNumber(selectedSavedArtworkPosition.y)}%
                </dd>
              </div>
              <div>
                <dt>New artwork click</dt>
                <dd>
                  {selectedDraftArtworkPosition
                    ? `x ${formatNumber(selectedDraftArtworkPosition.x)}%, y ${formatNumber(selectedDraftArtworkPosition.y)}%`
                    : "Not assigned for this variant yet."}
                </dd>
              </div>
            </dl>
            <button type="button" onClick={resetSelectedControlPoint} style={styles.secondaryButton}>
              Reset this {activeVariant.id} anchor
            </button>
          </section>
          {activeVariant.id === "mobile" ? (
            <div style={styles.correctionPanel}>
              <h3 style={styles.correctionTitle}>
                Lower Michigan base calibration
              </h3>
              <p style={styles.correctionHelp}>
                {lowerMichiganCalibrationSummary} Detroit, Romeo, Port Huron,
                Goodells, and most Lower Michigan markers continue to use the
                shared mobile artwork calibration.
              </p>
              <h3 style={styles.correctionTitle}>
                Northern / Straits / U.P. horizontal correction
              </h3>
              <p style={styles.correctionHelp}>
                {regionalHorizontalCorrectionSummary} Smoothstep transition
                bands keep this geographic and inspectable, not manual marker
                editing.
              </p>
              <h3 style={styles.correctionTitle}>
                Northern / Straits / U.P. vertical correction
              </h3>
              <p style={styles.correctionHelp}>
                {mobileVerticalCorrectionSummary} Uses smoothstep interpolation
                after the shared mobile artwork transform; desktop projection
                exits before this mobile-only correction.
              </p>
            </div>
          ) : null}
          <RangeControl
            label="Horizontal offset (%)"
            min={-60}
            max={60}
            step={0.1}
            value={activeCalibration.offsetX}
            onChange={(value) => updateCalibration("offsetX", value)}
          />
          <RangeControl
            label="Vertical offset (%)"
            min={-60}
            max={60}
            step={0.1}
            value={activeCalibration.offsetY}
            onChange={(value) => updateCalibration("offsetY", value)}
          />
          <RangeControl
            label="Scale"
            min={0.35}
            max={2.4}
            step={0.01}
            value={activeCalibration.scale}
            onChange={(value) => updateCalibration("scale", value)}
          />
          <RangeControl
            label="Artwork opacity"
            min={0.05}
            max={1}
            step={0.01}
            value={activeCalibration.opacity}
            onChange={(value) => updateCalibration("opacity", value)}
          />
          <p style={styles.noRotation}>
            Rotation is intentionally omitted because the existing artwork and
            reference helpers already use upright Michigan assets; add it only
            if a future audit proves it necessary.
          </p>
          <section
            style={styles.validationPanel}
            aria-label="Geographic validation targets"
          >
            <h3 style={styles.correctionTitle}>
              Validation target regional weights
            </h3>
            {validationTargets.map((target) => {
              const debug = getMichiganRegionalCorrectionDebug(
                target.latitude,
                target.longitude,
              );
              return (
                <p key={target.name} style={styles.validationRow}>
                  <strong>{target.name}</strong>: {debug.zone}, horizontal
                  weight {formatNumber(debug.horizontalWeight)}, regional y
                  weight {formatNumber(debug.regionalWeight)}, x{" "}
                  {formatCorrectionOffset(
                    debug.xOffsetPercent + debug.xScaleOffsetPercent,
                  )}
                  , y {formatCorrectionOffset(debug.yOffsetPercent)}
                </p>
              );
            })}
          </section>
          <button type="button" onClick={copyExport} style={styles.copyButton}>
            Copy calibration JSON
          </button>
          {copyStatus ? <p style={styles.copyStatus}>{copyStatus}</p> : null}
          <pre style={styles.pre}>{JSON.stringify(exportPayload, null, 2)}</pre>
        </aside>
      </div>
    </div>
  );
}

function ReferenceMichiganSvg() {
  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.referenceSvg}
      aria-label="Geographic Michigan reference outline"
    >
      <rect x="0" y="0" width="100" height="100" fill="#102238" />
      {[20, 40, 60, 80].map((line) => (
        <path
          key={`grid-${line}`}
          d={`M${line} 0V100 M0 ${line}H100`}
          stroke="rgba(160,205,255,.18)"
          strokeWidth=".18"
        />
      ))}
      {MICHIGAN_GEO_POLYGONS.map((polygon) => (
        <path
          key={polygon.id}
          d={michiganGeoPolygonToSvgPath(polygon.coordinates)}
          fill="rgba(78, 156, 219, .24)"
          stroke="#8ed0ff"
          strokeWidth=".45"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={styles.rangeLabel}>
      <span>
        {label}: <strong>{formatNumber(value)}</strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        style={styles.rangeInput}
      />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    color: "#f8efd9",
    background: "radial-gradient(circle at top, #23314a 0, #080b12 55%)",
    fontFamily: "Arial, sans-serif",
  },
  header: { maxWidth: 1060, margin: "0 auto 20px" },
  auditPanel: {
    maxWidth: 920,
    margin: "12px 0 0",
    padding: "12px 14px",
    border: "1px solid rgba(98,199,255,.22)",
    borderRadius: 14,
    background: "rgba(98,199,255,.08)",
  },
  auditTitle: { margin: "0 0 8px", color: "#9dd9ff", fontSize: 16 },
  auditList: {
    margin: 0,
    paddingLeft: 18,
    color: "rgba(220,238,255,.78)",
    lineHeight: 1.5,
  },
  correctionNote: {
    maxWidth: 920,
    margin: "12px 0 0",
    padding: "12px 14px",
    border: "1px solid rgba(255,218,146,.22)",
    borderRadius: 14,
    background: "rgba(255,218,146,.08)",
    color: "rgba(255,235,190,.86)",
    lineHeight: 1.5,
  },
  kicker: {
    margin: 0,
    color: "#e0b85b",
    textTransform: "uppercase",
    letterSpacing: 2,
    fontWeight: 800,
    fontSize: 12,
  },
  title: { margin: "6px 0", fontSize: 38 },
  intro: { maxWidth: 920, color: "rgba(248,239,217,.78)", lineHeight: 1.6 },
  toolbar: {
    maxWidth: 1060,
    margin: "0 auto 18px",
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  variantButton: {
    border: "1px solid rgba(255,218,146,.35)",
    background: "rgba(255,255,255,.06)",
    color: "#ffe8b6",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 800,
  },
  variantButtonActive: { background: "#e0aa43", color: "#15100a" },
  layout: {
    maxWidth: 1060,
    margin: "0 auto",
    display: "flex",
    flexWrap: "wrap",
    gap: 22,
    alignItems: "start",
  },
  stagePanel: { flex: "1 1 520px", minWidth: 0 },
  stage: {
    position: "relative",
    overflow: "hidden",
    border: "1px solid rgba(255,222,166,.28)",
    borderRadius: 22,
    background: "#102238",
    boxShadow: "0 30px 90px rgba(0,0,0,.45)",
    cursor: "crosshair",
  },
  referenceSvg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
  },
  artworkLayer: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: "100%",
    height: "100%",
    transformOrigin: "center",
    pointerEvents: "none",
  },
  artworkImage: { objectFit: "contain" },
  geoMarker: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#62c7ff",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px rgba(1,13,29,.75), 0 0 10px #62c7ff",
  },
  atlasMarker: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: "50%",
    border: "2px solid #ffd36d",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px rgba(1,13,29,.65), 0 0 12px rgba(255,211,109,.9)",
  },
  candidateMarker: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#31ff75",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px rgba(1,13,29,.75), 0 0 14px rgba(49,255,117,.98)",
  },
  legend: { color: "rgba(248,239,217,.78)", lineHeight: 1.5 },

  selectedGeoMarker: {
    position: "absolute", width: 18, height: 18, borderRadius: "50%", border: "3px solid #62c7ff", transform: "translate(-50%, -50%)", boxShadow: "0 0 0 3px rgba(1,13,29,.8)", pointerEvents: "none",
  },
  selectedSavedMarker: {
    position: "absolute", width: 24, height: 24, borderRadius: "50%", border: "3px dashed #ffd36d", transform: "translate(-50%, -50%)", boxShadow: "0 0 0 3px rgba(1,13,29,.72)", pointerEvents: "none",
  },
  selectedDraftMarker: {
    position: "absolute", width: 26, height: 26, borderRadius: "50%", border: "4px solid #31ff75", transform: "translate(-50%, -50%)", boxShadow: "0 0 0 3px rgba(1,13,29,.8), 0 0 18px rgba(49,255,117,.95)", pointerEvents: "none",
  },
  controlPointPanel: {
    margin: "14px 0", padding: 12, borderRadius: 14, border: "1px solid rgba(49,255,117,.28)", background: "rgba(49,255,117,.08)",
  },
  selectLabel: { display: "grid", gap: 7, margin: "12px 0", color: "#ffe7b0", fontSize: 13, fontWeight: 800 },
  selectInput: { width: "100%", borderRadius: 10, border: "1px solid rgba(255,218,146,.35)", background: "#121923", color: "#ffe8b6", padding: "9px 10px" },
  coordinateList: { display: "grid", gap: 8, margin: "10px 0", color: "rgba(248,239,217,.76)", fontSize: 12, lineHeight: 1.35 },
  secondaryButton: { width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid rgba(255,218,146,.32)", background: "rgba(255,255,255,.07)", color: "#ffe8b6", fontWeight: 800, cursor: "pointer" },

  controls: {
    flex: "1 1 320px",
    maxWidth: 360,
    minWidth: 0,
    border: "1px solid rgba(255,222,166,.22)",
    borderRadius: 22,
    padding: 18,
    background: "rgba(8,12,18,.76)",
  },
  panelTitle: { margin: "0 0 8px" },
  notes: { color: "rgba(248,239,217,.68)", lineHeight: 1.45 },
  correctionPanel: {
    margin: "14px 0",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(100,232,143,.24)",
    background: "rgba(100,232,143,.08)",
  },
  correctionTitle: { margin: "0 0 8px", color: "#aef0bd", fontSize: 15 },
  correctionHelp: {
    margin: 0,
    color: "rgba(220,255,230,.72)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  rangeLabel: {
    display: "grid",
    gap: 8,
    margin: "16px 0",
    color: "#ffe7b0",
    fontSize: 14,
  },
  rangeInput: { width: "100%" },
  noRotation: {
    color: "rgba(248,239,217,.66)",
    fontSize: 13,
    lineHeight: 1.45,
  },
  copyButton: {
    width: "100%",
    padding: "11px 14px",
    borderRadius: 12,
    border: 0,
    background: "#f0bd55",
    color: "#140e08",
    fontWeight: 900,
    cursor: "pointer",
  },
  copyStatus: { color: "#9df0b0", fontWeight: 800 },
  validationPanel: {
    margin: "14px 0",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(98,199,255,.24)",
    background: "rgba(98,199,255,.07)",
  },
  validationRow: {
    margin: "6px 0",
    color: "rgba(220,238,255,.76)",
    fontSize: 12,
    lineHeight: 1.35,
  },
  pre: {
    maxHeight: 320,
    overflow: "auto",
    padding: 12,
    borderRadius: 12,
    background: "rgba(0,0,0,.38)",
    color: "#dcecff",
    fontSize: 12,
    whiteSpace: "pre-wrap",
  },
};
