"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react";
import { ATLAS_EVENTS } from "../../../data/events";
import { latLngToAtlasPosition } from "../../../data/mapCalibration";
import {
  MICHIGAN_ARTWORK_CALIBRATIONS,
  MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION,
  MICHIGAN_MOBILE_UPPER_PENINSULA_ACTIVE_ANCHORS,
  interpolateMichiganArtworkAnchors,
  projectLatLngToCalibratedMichiganArtworkPosition,
} from "../../../data/michiganArtworkCalibration";
import {
  MICHIGAN_GEO_POLYGONS,
  MICHIGAN_REFERENCE_SVG,
  isPointInMichiganUpperPeninsula,
  latLngToMichiganSvgPosition,
  michiganGeoPolygonToSvgPath,
} from "../../../data/michiganGeoMap";

type CalibrationValues = {
  offsetX: number;
  offsetY: number;
  scale: number;
  opacity: number;
};

type ProjectionLabRegion =
  | "lower-peninsula"
  | "straits-transition"
  | "upper-peninsula";

type UpperPeninsulaAnchor = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  mapX: number;
  mapY: number;
  status: "active" | "future-slot";
};

type ArtworkVariant = {
  id: "desktop" | "mobile";
  label: string;
  imageSrc: string;
  frameAspectRatio: string;
  notes: string;
  initial: CalibrationValues;
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

const UPPER_PENINSULA_PROJECTION_LAB_ENABLED = true;

const REGION_CLASSIFICATION_RULES = {
  lowerPeninsula:
    "Default region, including all coordinates in the lower-peninsula polygon and northern Lower Peninsula locations south of the Straits band; Charlevoix (45.3181, -85.2584) stays here.",
  straitsTransition:
    "Coordinates in the Mackinac/Straits seam band: latitude 45.55–46.05 and longitude -85.35–-83.75, unless a point falls clearly inside the Upper Peninsula polygon.",
  upperPeninsula:
    "Coordinates clearly inside the existing upper-peninsula polygon only; no latitude/longitude fallback and no Straits blending is active in production.",
} as const;

const STRAITS_TRANSITION_SETTINGS = {
  minLatitude: 45.55,
  maxLatitude: 46.05,
  minLongitude: -85.35,
  maxLongitude: -83.75,
  blendWeight: 0.5,
} as const;

const INITIAL_UPPER_PENINSULA_ANCHORS: UpperPeninsulaAnchor[] = [
  ...MICHIGAN_MOBILE_UPPER_PENINSULA_ACTIVE_ANCHORS.map((anchor) => ({
    ...anchor,
    status: "active" as const,
  })),
  {
    id: "houghton-future-slot",
    name: "Houghton / future western U.P. slot",
    latitude: 47.1211,
    longitude: -88.5694,
    mapX: 21.6,
    mapY: 12.8,
    status: "future-slot",
  },
];

const UP_LAB_REFERENCE_LOCATIONS = [
  {
    id: "lab-escanaba",
    name: "Escanaba lab reference",
    latitude: 45.7453,
    longitude: -87.0646,
  },
  {
    id: "lab-marquette",
    name: "Marquette lab reference",
    latitude: 46.5436,
    longitude: -87.3954,
  },
  {
    id: "lab-sault-ste-marie",
    name: "Sault Ste. Marie lab reference",
    latitude: 46.4953,
    longitude: -84.3453,
  },
  {
    id: "lab-houghton",
    name: "Houghton future western U.P. reference",
    latitude: 47.1211,
    longitude: -88.5694,
  },
  {
    id: "lab-mackinac",
    name: "Mackinac / Straits seam reference",
    latitude: 45.8492,
    longitude: -84.6189,
  },
  {
    id: "lab-charlevoix",
    name: "Charlevoix Lower Peninsula reference",
    latitude: 45.3181,
    longitude: -85.2584,
  },
];

const classifyMichiganProjectionRegion = (
  latitude: number,
  longitude: number,
): ProjectionLabRegion => {
  if (isPointInMichiganUpperPeninsula(latitude, longitude))
    return "upper-peninsula";

  const inStraitsBand =
    latitude >= STRAITS_TRANSITION_SETTINGS.minLatitude &&
    latitude <= STRAITS_TRANSITION_SETTINGS.maxLatitude &&
    longitude >= STRAITS_TRANSITION_SETTINGS.minLongitude &&
    longitude <= STRAITS_TRANSITION_SETTINGS.maxLongitude;

  if (inStraitsBand) return "straits-transition";

  return "lower-peninsula";
};

const blendPositions = (
  baseline: { x: number; y: number },
  candidate: { x: number; y: number },
  weight: number,
) => ({
  x: baseline.x + (candidate.x - baseline.x) * weight,
  y: baseline.y + (candidate.y - baseline.y) * weight,
});

const sampleEvents = ATLAS_EVENTS.filter(
  (event) =>
    Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
).slice(0, 36);

const formatNumber = (value: number) => Number(value.toFixed(3));

const formatCorrectionLatitude = (value: number) => `${formatNumber(value)}°N`;

const formatCorrectionOffset = (value: number) => `${formatNumber(value)}%`;

const mobileCorrectionSummary = `Mobile-only north correction: starts at ${formatCorrectionLatitude(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.startLatitude)}, reaches max at ${formatCorrectionLatitude(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.endLatitude)}, max downward y offset ${formatCorrectionOffset(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.maxYOffsetPercent)}.`;

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
  const [upperPeninsulaAnchors, setUpperPeninsulaAnchors] = useState(
    INITIAL_UPPER_PENINSULA_ANCHORS,
  );
  const [activeAnchorId, setActiveAnchorId] = useState(
    INITIAL_UPPER_PENINSULA_ANCHORS[0].id,
  );

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

  const eventMarkers = useMemo(
    () =>
      [
        ...sampleEvents.map((event) => ({
          id: event.id,
          name: event.name,
          latitude: event.latitude,
          longitude: event.longitude,
        })),
        ...UP_LAB_REFERENCE_LOCATIONS,
      ].map((event) => {
        const atlasPosition = latLngToAtlasPosition(
          event.latitude,
          event.longitude,
        );
        const activeUpperPeninsulaAnchors = upperPeninsulaAnchors.filter(
          (anchor) => anchor.status === "active",
        );
        const upperPeninsulaCandidatePosition =
          interpolateMichiganArtworkAnchors(
            event.latitude,
            event.longitude,
            activeUpperPeninsulaAnchors,
          );
        const region = classifyMichiganProjectionRegion(
          event.latitude,
          event.longitude,
        );

        return {
          event,
          region,
          geoPosition: latLngToMichiganSvgPosition(
            event.latitude,
            event.longitude,
          ),
          atlasPosition,
          productionPosition: projectLatLngToCalibratedMichiganArtworkPosition(
            event.latitude,
            event.longitude,
            activeVariant.id,
          ),
          upperPeninsulaCandidatePosition,
          seamBlendPosition: blendPositions(
            atlasPosition,
            upperPeninsulaCandidatePosition,
            STRAITS_TRANSITION_SETTINGS.blendWeight,
          ),
        };
      }),
    [activeVariant.id, upperPeninsulaAnchors],
  );

  const exportPayload = useMemo(
    () => ({
      format: "celebration-atlas-michigan-artwork-calibration/v1",
      sourceOfTruth:
        "Event latitude/longitude remains unchanged; these values are display transforms for the illustrated artwork only.",
      reference: {
        name: MICHIGAN_REFERENCE_SVG.sourceName,
        bounds: MICHIGAN_REFERENCE_SVG.bounds,
        projection:
          "equirectangular percentage coordinates from data/michiganGeoMap.ts",
      },
      mobileLatitudeVerticalCorrection: {
        behavior:
          "Applied only by projectLatLngToCalibratedMichiganArtworkPosition(..., 'mobile') after the shared artwork calibration; desktop returns before this correction.",
        startLatitude:
          MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.startLatitude,
        endLatitude: MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.endLatitude,
        maxYOffsetPercent:
          MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.maxYOffsetPercent,
        interpolation:
          "smoothstep latitude ramp; zero at and south of startLatitude, capped at maxYOffsetPercent at and north of endLatitude",
      },
      separateRegionProjectionLab: {
        enabled: UPPER_PENINSULA_PROJECTION_LAB_ENABLED,
        productionStatus:
          "Mobile production uses this separate U.P. projection only for coordinates clearly inside the Upper Peninsula polygon after the Straits exclusion; Lower Peninsula, Charlevoix, and Mackinac/Straits coordinates stay on the restored baseline.",
        lowerPeninsulaBaseline: {
          status:
            "Preserved exactly through data/mapCalibration.ts latLngToAtlasPosition and MICHIGAN_MAP_ANCHORS.",
          comparisonMarkerColor: "gold ring",
        },
        regionClassificationRules: REGION_CLASSIFICATION_RULES,
        straitsTransitionSettings: STRAITS_TRANSITION_SETTINGS,
        upperPeninsulaAnchors: upperPeninsulaAnchors.map((anchor) => ({
          ...anchor,
          mapX: formatNumber(anchor.mapX),
          mapY: formatNumber(anchor.mapY),
        })),
        interpolationMethod: {
          name: "inverse-distance weighting",
          power: 2,
          source:
            "real event latitude/longitude matched against active named U.P. anchors only; Houghton future slot is excluded, with no event IDs and no per-event x/y overrides",
        },
      },
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
    [calibrations, upperPeninsulaAnchors],
  );

  const updateCalibration = (field: keyof CalibrationValues, value: number) => {
    setCalibrations((current) => ({
      ...current,
      [activeVariant.id]: { ...current[activeVariant.id], [field]: value },
    }));
  };

  const moveActiveAnchor = (event: PointerEvent<HTMLDivElement>) => {
    if (!activeAnchorId) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setUpperPeninsulaAnchors((current) =>
      current.map((anchor) =>
        anchor.id === activeAnchorId
          ? {
              ...anchor,
              mapX: formatNumber(Math.min(100, Math.max(0, x))),
              mapY: formatNumber(Math.min(100, Math.max(0, y))),
            }
          : anchor,
      ),
    );
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
          {mobileCorrectionSummary} Real event latitude/longitude remains
          unchanged, and there are no per-event marker overrides.
        </p>
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
            style={{
              ...styles.stage,
              aspectRatio: activeVariant.frameAspectRatio,
            }}
            onPointerDown={moveActiveAnchor}
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
                region,
                geoPosition,
                atlasPosition,
                productionPosition,
                upperPeninsulaCandidatePosition,
                seamBlendPosition,
              }) => (
                <div key={event.id}>
                  <span
                    title={`${event.name} geographic reference (${region})`}
                    style={{
                      ...styles.geoMarker,
                      left: `${geoPosition.x}%`,
                      top: `${geoPosition.y}%`,
                    }}
                  />
                  <span
                    title={`${event.name} Lower Peninsula baseline`}
                    style={{
                      ...styles.atlasMarker,
                      left: `${atlasPosition.x}%`,
                      top: `${atlasPosition.y}%`,
                    }}
                  />
                  <span
                    title={`${event.name} calibrated production comparison`}
                    style={{
                      ...styles.productionMarker,
                      left: `${productionPosition.x}%`,
                      top: `${productionPosition.y}%`,
                    }}
                  />
                  {region === "upper-peninsula" ||
                  region === "straits-transition" ? (
                    <span
                      title={`${event.name} Upper Peninsula candidate projection`}
                      style={{
                        ...styles.upCandidateMarker,
                        left: `${upperPeninsulaCandidatePosition.x}%`,
                        top: `${upperPeninsulaCandidatePosition.y}%`,
                      }}
                    />
                  ) : null}
                  {region === "straits-transition" ? (
                    <span
                      title={`${event.name} blended Straits seam candidate`}
                      style={{
                        ...styles.seamMarker,
                        left: `${seamBlendPosition.x}%`,
                        top: `${seamBlendPosition.y}%`,
                      }}
                    />
                  ) : null}
                </div>
              ),
            )}
            {upperPeninsulaAnchors.map((anchor) => (
              <button
                key={anchor.id}
                type="button"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setActiveAnchorId(anchor.id);
                }}
                title={`${anchor.name} U.P. artwork anchor`}
                style={{
                  ...styles.upAnchorMarker,
                  ...(anchor.id === activeAnchorId
                    ? styles.upAnchorMarkerActive
                    : null),
                  left: `${anchor.mapX}%`,
                  top: `${anchor.mapY}%`,
                }}
              >
                {anchor.name.slice(0, 1)}
              </button>
            ))}
          </div>
          <p style={styles.legend}>
            <b>Blue dots</b> = raw latitude/longitude on geographic reference.{" "}
            <b>Gold rings</b> = Lower Peninsula baseline / production comparison
            from the restored anchor projection. <b>Green dots</b> = calibrated
            artwork comparison. <b>Magenta diamonds</b> = Upper Peninsula
            candidate projection. <b>Cyan squares</b> = Straits blended seam
            candidate. Lettered orange controls are draggable U.P. anchors.
          </p>
        </section>

        <aside style={styles.controls} aria-label="Calibration controls">
          <h2 style={styles.panelTitle}>{activeVariant.label}</h2>
          <p style={styles.notes}>{activeVariant.notes}</p>
          <div style={styles.labPanel}>
            <h3 style={styles.labTitle}>Upper Peninsula projection lab</h3>
            <p style={styles.correctionHelp}>
              Developer-only separate-region preview. Select an anchor, then
              click the artwork to revise its placement. Lower Peninsula
              baseline stays untouched; Charlevoix classifies as Lower
              Peninsula, Mackinac/Straits as transition, and
              Escanaba/Marquette/Sault/Houghton as U.P.
            </p>
            {upperPeninsulaAnchors.map((anchor) => (
              <button
                key={anchor.id}
                type="button"
                onClick={() => setActiveAnchorId(anchor.id)}
                style={{
                  ...styles.anchorButton,
                  ...(anchor.id === activeAnchorId
                    ? styles.anchorButtonActive
                    : null),
                }}
              >
                {anchor.name}: {formatNumber(anchor.mapX)}%,{" "}
                {formatNumber(anchor.mapY)}%{" "}
                {anchor.status === "future-slot" ? "(future slot)" : ""}
              </button>
            ))}
            <p style={styles.regionLabels}>
              Lower Peninsula baseline · Straits transition · Upper Peninsula
              candidate projection
            </p>
          </div>
          {activeVariant.id === "mobile" ? (
            <div style={styles.correctionPanel}>
              <h3 style={styles.correctionTitle}>Mobile latitude correction</h3>
              <p style={styles.correctionHelp}>
                {mobileCorrectionSummary} Uses smoothstep interpolation after
                the shared mobile artwork transform. Southern Lower Peninsula
                locations south of the start latitude receive 0% additional y
                offset; desktop projection exits before this mobile-only
                correction.
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
  productionMarker: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#64e88f",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px rgba(1,13,29,.75), 0 0 13px rgba(100,232,143,.95)",
  },
  legend: { color: "rgba(248,239,217,.78)", lineHeight: 1.5 },
  upCandidateMarker: {
    position: "absolute",
    width: 13,
    height: 13,
    background: "#ff4fd8",
    transform: "translate(-50%, -50%) rotate(45deg)",
    boxShadow: "0 0 0 2px rgba(1,13,29,.75), 0 0 13px rgba(255,79,216,.95)",
  },
  seamMarker: {
    position: "absolute",
    width: 12,
    height: 12,
    background: "#61f3ff",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 0 2px rgba(1,13,29,.75), 0 0 13px rgba(97,243,255,.9)",
  },
  upAnchorMarker: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: "50%",
    border: "2px solid rgba(255,255,255,.9)",
    background: "#ff9d2e",
    color: "#140e08",
    fontWeight: 900,
    fontSize: 12,
    cursor: "grab",
    transform: "translate(-50%, -50%)",
    zIndex: 4,
  },
  upAnchorMarkerActive: {
    background: "#fff1a8",
    boxShadow: "0 0 0 4px rgba(255,157,46,.35), 0 0 18px rgba(255,241,168,.9)",
  },
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
  labPanel: {
    margin: "14px 0",
    padding: 12,
    borderRadius: 14,
    border: "1px solid rgba(255,79,216,.34)",
    background: "rgba(255,79,216,.08)",
  },
  labTitle: { margin: "0 0 8px", color: "#ffb8ef", fontSize: 15 },
  anchorButton: {
    display: "block",
    width: "100%",
    margin: "8px 0",
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,222,166,.24)",
    background: "rgba(255,255,255,.06)",
    color: "#ffe8b6",
    textAlign: "left",
    cursor: "pointer",
  },
  anchorButtonActive: {
    background: "#ff9d2e",
    color: "#140e08",
    fontWeight: 900,
  },
  regionLabels: {
    margin: "10px 0 0",
    color: "#ffe7b0",
    fontSize: 12,
    fontWeight: 800,
  },
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
