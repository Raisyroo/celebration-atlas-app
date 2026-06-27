'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { ATLAS_EVENTS } from '../../../data/events';
import { MICHIGAN_MAP_ANCHORS, latLngToAtlasPosition } from '../../../data/mapCalibration';
import {
  MICHIGAN_ARTWORK_CALIBRATIONS,
  MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION,
  projectLatLngToCalibratedMichiganArtworkPosition,
} from '../../../data/michiganArtworkCalibration';
import {
  MICHIGAN_GEO_POLYGONS,
  MICHIGAN_REFERENCE_SVG,
  latLngToMichiganSvgPosition,
  michiganGeoPolygonToSvgPath,
} from '../../../data/michiganGeoMap';

type CalibrationValues = {
  offsetX: number;
  offsetY: number;
  scale: number;
  opacity: number;
};

type ArtworkVariant = {
  id: 'desktop' | 'mobile';
  label: string;
  imageSrc: string;
  frameAspectRatio: string;
  notes: string;
  initial: CalibrationValues;
};

const ARTWORK_VARIANTS: ArtworkVariant[] = [
  {
    id: 'desktop',
    label: 'Desktop artwork calibration',
    imageSrc: '/maps/michigan-atlas-base.webp',
    frameAspectRatio: '1 / 1',
    notes: 'Production desktop/tablet painterly Michigan artwork asset.',
    initial: { offsetX: MICHIGAN_ARTWORK_CALIBRATIONS.desktop.offsetXPercent, offsetY: MICHIGAN_ARTWORK_CALIBRATIONS.desktop.offsetYPercent, scale: MICHIGAN_ARTWORK_CALIBRATIONS.desktop.scale, opacity: 0.62 },
  },
  {
    id: 'mobile',
    label: 'Mobile artwork calibration',
    imageSrc: '/maps/michigan-atlas-base-tall.webp',
    frameAspectRatio: '9 / 16',
    notes: 'Tall mobile artwork variant; compressed sibling exists for delivery experiments.',
    initial: { offsetX: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.offsetXPercent, offsetY: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.offsetYPercent, scale: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.scale, opacity: 0.62 },
  },
];

const MICHIGAN_CALIBRATION_SCROLL_CLASS = 'dev-michigan-calibration-scroll';


type CalibrationAnchorKey =
  | 'detroit'
  | 'port-huron'
  | 'grand-rapids'
  | 'traverse-city'
  | 'charlevoix'
  | 'mackinac-straits'
  | 'alpena'
  | 'escanaba'
  | 'marquette'
  | 'sault-ste-marie'
  | 'houghton-future-slot';

type CalibrationAnchor = {
  key: CalibrationAnchorKey;
  name: string;
  latitude: number;
  longitude: number;
  labelDx: number;
  labelDy: number;
};

type ManualTarget = { x: number; y: number };

const CALIBRATION_ANCHORS: CalibrationAnchor[] = [
  { key: 'detroit', name: 'Detroit', latitude: 42.3314, longitude: -83.0458, labelDx: -122, labelDy: 10 },
  { key: 'port-huron', name: 'Port Huron', latitude: 42.9709, longitude: -82.4249, labelDx: -136, labelDy: -18 },
  { key: 'grand-rapids', name: 'Grand Rapids', latitude: 42.9634, longitude: -85.6681, labelDx: -118, labelDy: 12 },
  { key: 'traverse-city', name: 'Traverse City', latitude: 44.7631, longitude: -85.6206, labelDx: -136, labelDy: -26 },
  { key: 'charlevoix', name: 'Charlevoix', latitude: 45.3181, longitude: -85.2584, labelDx: -126, labelDy: -32 },
  { key: 'mackinac-straits', name: 'Mackinac / Straits', latitude: 45.7775, longitude: -84.7278, labelDx: 14, labelDy: -34 },
  { key: 'alpena', name: 'Alpena', latitude: 45.0617, longitude: -83.4328, labelDx: 14, labelDy: -18 },
  { key: 'escanaba', name: 'Escanaba', latitude: 45.7453, longitude: -87.0646, labelDx: -120, labelDy: 14 },
  { key: 'marquette', name: 'Marquette', latitude: 46.5436, longitude: -87.3954, labelDx: -116, labelDy: -28 },
  { key: 'sault-ste-marie', name: 'Sault Ste. Marie', latitude: 46.4953, longitude: -84.3453, labelDx: 14, labelDy: -28 },
  { key: 'houghton-future-slot', name: 'Houghton / future western U.P. slot', latitude: 47.1211, longitude: -88.5694, labelDx: 14, labelDy: -8 },
];

const getLegacyAnchorPosition = (anchor: CalibrationAnchor) => {
  const legacy = MICHIGAN_MAP_ANCHORS.find((mapAnchor) => mapAnchor.name === anchor.name);
  return legacy ? { x: legacy.mapX, y: legacy.mapY } : latLngToAtlasPosition(anchor.latitude, anchor.longitude);
};

const sampleEvents = ATLAS_EVENTS.filter(
  (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
).slice(0, 36);

const formatNumber = (value: number) => Number(value.toFixed(3));
const roundPercent = (value: number) => Number(Math.min(100, Math.max(0, value)).toFixed(2));

const formatCorrectionLatitude = (value: number) => `${formatNumber(value)}°N`;

const formatCorrectionOffset = (value: number) => `${formatNumber(value)}%`;

const mobileCorrectionSummary = `Mobile-only north correction: starts at ${formatCorrectionLatitude(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.startLatitude)}, reaches max at ${formatCorrectionLatitude(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.endLatitude)}, max downward y offset ${formatCorrectionOffset(MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.maxYOffsetPercent)}.`;

export default function MichiganArtworkCalibration() {
  const [activeVariantId, setActiveVariantId] = useState<ArtworkVariant['id']>('desktop');
  const [calibrations, setCalibrations] = useState<Record<ArtworkVariant['id'], CalibrationValues>>({
    desktop: ARTWORK_VARIANTS[0].initial,
    mobile: ARTWORK_VARIANTS[1].initial,
  });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [copyStatus, setCopyStatus] = useState('');
  const [selectedAnchorKey, setSelectedAnchorKey] = useState<CalibrationAnchorKey>('escanaba');
  const [manualTargets, setManualTargets] = useState<Partial<Record<CalibrationAnchorKey, ManualTarget>>>({});

  useEffect(() => {
    document.documentElement.classList.add(MICHIGAN_CALIBRATION_SCROLL_CLASS);
    document.body.classList.add(MICHIGAN_CALIBRATION_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(MICHIGAN_CALIBRATION_SCROLL_CLASS);
      document.body.classList.remove(MICHIGAN_CALIBRATION_SCROLL_CLASS);
    };
  }, []);

  const activeVariant = ARTWORK_VARIANTS.find((variant) => variant.id === activeVariantId) ?? ARTWORK_VARIANTS[0];
  const activeCalibration = calibrations[activeVariant.id];
  const selectedAnchor = CALIBRATION_ANCHORS.find((anchor) => anchor.key === selectedAnchorKey) ?? CALIBRATION_ANCHORS[0];
  const selectedTarget = manualTargets[selectedAnchor.key];

  const eventMarkers = useMemo(
    () => sampleEvents.map((event) => ({
      event,
      geoPosition: latLngToMichiganSvgPosition(event.latitude, event.longitude),
      atlasPosition: latLngToAtlasPosition(event.latitude, event.longitude),
      productionPosition: projectLatLngToCalibratedMichiganArtworkPosition(
        event.latitude,
        event.longitude,
        activeVariant.id,
      ),
    })),
    [activeVariant.id],
  );


  const anchorMarkers = useMemo(
    () => CALIBRATION_ANCHORS.map((anchor) => ({
      anchor,
      geoPosition: latLngToMichiganSvgPosition(anchor.latitude, anchor.longitude),
      legacyPosition: getLegacyAnchorPosition(anchor),
      productionPosition: projectLatLngToCalibratedMichiganArtworkPosition(anchor.latitude, anchor.longitude, activeVariant.id),
      clickedTarget: manualTargets[anchor.key],
    })),
    [activeVariant.id, manualTargets],
  );

  const exportPayload = useMemo(() => ({
    format: 'celebration-atlas-michigan-artwork-calibration/v1',
    sourceOfTruth: 'Event latitude/longitude remains unchanged; these values are display transforms for the illustrated artwork only.',
    reference: {
      name: MICHIGAN_REFERENCE_SVG.sourceName,
      bounds: MICHIGAN_REFERENCE_SVG.bounds,
      projection: 'equirectangular percentage coordinates from data/michiganGeoMap.ts',
    },
    mobileLatitudeVerticalCorrection: {
      behavior: 'Applied only by projectLatLngToCalibratedMichiganArtworkPosition(..., \'mobile\') after the shared artwork calibration; desktop returns before this correction.',
      startLatitude: MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.startLatitude,
      endLatitude: MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.endLatitude,
      maxYOffsetPercent: MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION.maxYOffsetPercent,
      interpolation: 'smoothstep latitude ramp; zero at and south of startLatitude, capped at maxYOffsetPercent at and north of endLatitude',
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
  }), [calibrations]);

  const updateCalibration = (field: keyof CalibrationValues, value: number) => {
    setCalibrations((current) => ({
      ...current,
      [activeVariant.id]: { ...current[activeVariant.id], [field]: value },
    }));
  };


  const handleStageClick = (event: MouseEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    setManualTargets((current) => ({
      ...current,
      [selectedAnchor.key]: {
        x: roundPercent(((event.clientX - rect.left) / rect.width) * 100),
        y: roundPercent(((event.clientY - rect.top) / rect.height) * 100),
      },
    }));
  };

  const clearSelectedTarget = () => setManualTargets((current) => {
    const next = { ...current };
    delete next[selectedAnchor.key];
    return next;
  });

  const copyExport = async () => {
    await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
    setCopyStatus('Copied calibration JSON.');
    window.setTimeout(() => setCopyStatus(''), 2200);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <p style={styles.kicker}>Developer-only calibration</p>
        <h1 style={styles.title}>Michigan artwork calibration workbench</h1>
        <p style={styles.intro}>Compare the real geographic Michigan reference outline, the illustrated artwork, and a sample of existing ATLAS_EVENTS latitude/longitude markers. Production AtlasMap behavior is not imported or changed by this route.</p>
        <p style={styles.correctionNote}>{mobileCorrectionSummary} Real event latitude/longitude remains unchanged, and there are no per-event marker overrides.</p>
      </header>

      <section style={styles.toolbar} aria-label="Artwork variant selection">
        {ARTWORK_VARIANTS.map((variant) => (
          <button
            key={variant.id}
            type="button"
            onClick={() => setActiveVariantId(variant.id)}
            style={{ ...styles.variantButton, ...(variant.id === activeVariant.id ? styles.variantButtonActive : null) }}
          >
            {variant.label}
          </button>
        ))}
      </section>

      <div style={styles.layout}>
        <section style={styles.stagePanel} aria-label={activeVariant.label}>
          <div ref={stageRef} onClick={handleStageClick} style={{ ...styles.stage, aspectRatio: activeVariant.frameAspectRatio }}>
            <ReferenceMichiganSvg />
            <div
              style={{
                ...styles.artworkLayer,
                opacity: activeCalibration.opacity,
                transform: `translate(-50%, -50%) translate(${activeCalibration.offsetX}%, ${activeCalibration.offsetY}%) scale(${activeCalibration.scale})`,
              }}
            >
              <Image src={activeVariant.imageSrc} alt={`${activeVariant.label} illustrated Michigan artwork`} fill sizes="(max-width: 900px) 100vw, 680px" style={styles.artworkImage} priority />
            </div>
            {anchorMarkers.map(({ anchor, geoPosition, legacyPosition, productionPosition, clickedTarget }) => (
              <AnchorOverlay key={anchor.key} anchor={anchor} geoPosition={geoPosition} legacyPosition={legacyPosition} productionPosition={productionPosition} clickedTarget={clickedTarget} selected={anchor.key === selectedAnchor.key} />
            ))}
            {eventMarkers.map(({ event, geoPosition, atlasPosition, productionPosition }) => (
              <div key={event.id}>
                <span title={`${event.name} geographic reference`} style={{ ...styles.geoMarker, left: `${geoPosition.x}%`, top: `${geoPosition.y}%` }} />
                <span title={`${event.name} legacy anchor projection`} style={{ ...styles.atlasMarker, left: `${atlasPosition.x}%`, top: `${atlasPosition.y}%` }} />
                <span title={`${event.name} calibrated production candidate`} style={{ ...styles.productionMarker, left: `${productionPosition.x}%`, top: `${productionPosition.y}%` }} />
              </div>
            ))}
          </div>
          <div style={styles.legend}><b>Legend:</b> <b>Blue dots</b> = geographic/reference marker. <b>Gold rings</b> = current legacy production marker. <b>Green dots</b> = current calibrated production marker. <b>Cyan halo/chip</b> = selected anchor. <b>Pink X</b> = clicked candidate target. Sample event dots remain unlabeled and muted behind city anchors.</div>
        </section>

        <aside style={styles.controls} aria-label="Calibration controls">
          <h2 style={styles.panelTitle}>{activeVariant.label}</h2>
          <div style={styles.selectionPanel}>
            <strong>Selected: {selectedAnchor.name}</strong>
            <span>Click where {selectedAnchor.name} belongs on the artwork.</span>
            <small>Real lat/lon: {selectedAnchor.latitude}, {selectedAnchor.longitude}</small>
            <small>Current production position: left {formatNumber(projectLatLngToCalibratedMichiganArtworkPosition(selectedAnchor.latitude, selectedAnchor.longitude, activeVariant.id).x)}% · top {formatNumber(projectLatLngToCalibratedMichiganArtworkPosition(selectedAnchor.latitude, selectedAnchor.longitude, activeVariant.id).y)}%</small>
            <small>Clicked target: {selectedTarget ? `left ${formatNumber(selectedTarget.x)}% · top ${formatNumber(selectedTarget.y)}%` : 'not placed yet'}</small>
            <button type="button" onClick={clearSelectedTarget} style={styles.miniButton}>Clear clicked target</button>
          </div>
          <div style={styles.anchorGrid}>{CALIBRATION_ANCHORS.map((anchor) => (
            <button key={anchor.key} type="button" onClick={() => setSelectedAnchorKey(anchor.key)} style={{ ...styles.anchorButton, ...(anchor.key === selectedAnchor.key ? styles.anchorButtonActive : null) }}>{anchor.name}</button>
          ))}</div>
          <p style={styles.notes}>{activeVariant.notes}</p>
          {activeVariant.id === 'mobile' ? (
            <div style={styles.correctionPanel}>
              <h3 style={styles.correctionTitle}>Mobile latitude correction</h3>
              <p style={styles.correctionHelp}>{mobileCorrectionSummary} Uses smoothstep interpolation after the shared mobile artwork transform. Southern Lower Peninsula locations south of the start latitude receive 0% additional y offset; desktop projection exits before this mobile-only correction.</p>
            </div>
          ) : null}
          <RangeControl label="Horizontal offset (%)" min={-60} max={60} step={0.1} value={activeCalibration.offsetX} onChange={(value) => updateCalibration('offsetX', value)} />
          <RangeControl label="Vertical offset (%)" min={-60} max={60} step={0.1} value={activeCalibration.offsetY} onChange={(value) => updateCalibration('offsetY', value)} />
          <RangeControl label="Scale" min={0.35} max={2.4} step={0.01} value={activeCalibration.scale} onChange={(value) => updateCalibration('scale', value)} />
          <RangeControl label="Artwork opacity" min={0.05} max={1} step={0.01} value={activeCalibration.opacity} onChange={(value) => updateCalibration('opacity', value)} />
          <p style={styles.noRotation}>Rotation is intentionally omitted because the existing artwork and reference helpers already use upright Michigan assets; add it only if a future audit proves it necessary.</p>
          <button type="button" onClick={copyExport} style={styles.copyButton}>Copy calibration JSON</button>
          {copyStatus ? <p style={styles.copyStatus}>{copyStatus}</p> : null}
          <pre style={styles.pre}>{JSON.stringify(exportPayload, null, 2)}</pre>
        </aside>
      </div>
    </div>
  );
}


function AnchorOverlay({ anchor, geoPosition, legacyPosition, productionPosition, clickedTarget, selected }: { anchor: CalibrationAnchor; geoPosition: ManualTarget; legacyPosition: ManualTarget; productionPosition: ManualTarget; clickedTarget?: ManualTarget; selected: boolean }) {
  const leaderWidth = Math.hypot(anchor.labelDx, anchor.labelDy);
  const leaderAngle = Math.atan2(anchor.labelDy, anchor.labelDx) * (180 / Math.PI);

  return (
    <div style={selected ? styles.selectedAnchorGroup : undefined}>
      <span title={`${anchor.name} geographic/reference marker`} style={{ ...styles.anchorGeoMarker, left: `${geoPosition.x}%`, top: `${geoPosition.y}%` }} />
      <span title={`${anchor.name} current legacy production marker`} style={{ ...styles.anchorAtlasMarker, left: `${legacyPosition.x}%`, top: `${legacyPosition.y}%` }} />
      <span title={`${anchor.name} current calibrated production marker`} style={{ ...styles.anchorProductionMarker, left: `${productionPosition.x}%`, top: `${productionPosition.y}%` }} />
      {clickedTarget ? <span title={`${anchor.name} clicked candidate target`} style={{ ...styles.targetMarker, left: `${clickedTarget.x}%`, top: `${clickedTarget.y}%` }}>×</span> : null}
      <span aria-hidden="true" style={{ ...styles.leaderLine, left: `${productionPosition.x}%`, top: `${productionPosition.y}%`, width: leaderWidth, transform: `rotate(${leaderAngle}deg)` }} />
      <span style={{ ...styles.anchorLabel, ...(selected ? styles.anchorLabelSelected : null), left: `calc(${productionPosition.x}% + ${anchor.labelDx}px)`, top: `calc(${productionPosition.y}% + ${anchor.labelDy}px)` }}>{anchor.name}</span>
    </div>
  );
}

function ReferenceMichiganSvg() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={styles.referenceSvg} aria-label="Geographic Michigan reference outline">
      <rect x="0" y="0" width="100" height="100" fill="#102238" />
      {[20, 40, 60, 80].map((line) => <path key={`grid-${line}`} d={`M${line} 0V100 M0 ${line}H100`} stroke="rgba(160,205,255,.18)" strokeWidth=".18" />)}
      {MICHIGAN_GEO_POLYGONS.map((polygon) => (
        <path key={polygon.id} d={michiganGeoPolygonToSvgPath(polygon.coordinates)} fill="rgba(78, 156, 219, .24)" stroke="#8ed0ff" strokeWidth=".45" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

function RangeControl({ label, min, max, step, value, onChange }: { label: string; min: number; max: number; step: number; value: number; onChange: (value: number) => void }) {
  return (
    <label style={styles.rangeLabel}>
      <span>{label}: <strong>{formatNumber(value)}</strong></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.currentTarget.value))} style={styles.rangeInput} />
    </label>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', padding: '32px', color: '#f8efd9', background: 'radial-gradient(circle at top, #23314a 0, #080b12 55%)', fontFamily: 'Arial, sans-serif' },
  header: { maxWidth: 1060, margin: '0 auto 20px' }, correctionNote: { maxWidth: 920, margin: '12px 0 0', padding: '12px 14px', border: '1px solid rgba(255,218,146,.22)', borderRadius: 14, background: 'rgba(255,218,146,.08)', color: 'rgba(255,235,190,.86)', lineHeight: 1.5 }, kicker: { margin: 0, color: '#e0b85b', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 800, fontSize: 12 }, title: { margin: '6px 0', fontSize: 38 }, intro: { maxWidth: 920, color: 'rgba(248,239,217,.78)', lineHeight: 1.6 },
  toolbar: { maxWidth: 1060, margin: '0 auto 18px', display: 'flex', gap: 10, flexWrap: 'wrap' }, variantButton: { border: '1px solid rgba(255,218,146,.35)', background: 'rgba(255,255,255,.06)', color: '#ffe8b6', padding: '10px 14px', borderRadius: 999, cursor: 'pointer', fontWeight: 800 }, variantButtonActive: { background: '#e0aa43', color: '#15100a' },
  layout: { maxWidth: 1060, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 22, alignItems: 'start' }, stagePanel: { flex: '1 1 520px', minWidth: 0 }, stage: { position: 'relative', overflow: 'hidden', cursor: 'crosshair', border: '1px solid rgba(255,222,166,.28)', borderRadius: 22, background: '#102238', boxShadow: '0 30px 90px rgba(0,0,0,.45)' }, referenceSvg: { position: 'absolute', inset: 0, width: '100%', height: '100%' }, artworkLayer: { position: 'absolute', left: '50%', top: '50%', width: '100%', height: '100%', transformOrigin: 'center', pointerEvents: 'none' }, artworkImage: { objectFit: 'contain' }, geoMarker: { position: 'absolute', width: 7, height: 7, borderRadius: '50%', background: '#62c7ff', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 2px rgba(1,13,29,.75), 0 0 10px #62c7ff' }, atlasMarker: { position: 'absolute', width: 14, height: 14, borderRadius: '50%', border: '2px solid #ffd36d', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 2px rgba(1,13,29,.65), 0 0 12px rgba(255,211,109,.9)' }, productionMarker: { position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: '#64e88f', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 2px rgba(1,13,29,.75), 0 0 13px rgba(100,232,143,.95)' }, legend: { marginTop: 12, padding: '12px 14px', borderRadius: 14, border: '1px solid rgba(255,222,166,.22)', background: 'rgba(0,0,0,.28)', color: 'rgba(248,239,217,.86)', lineHeight: 1.5 }, selectedAnchorGroup: { filter: 'drop-shadow(0 0 12px rgba(103,232,249,.9))' }, anchorGeoMarker: { position: 'absolute', zIndex: 12, width: 8, height: 8, borderRadius: '50%', background: '#62c7ff', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 2px rgba(1,13,29,.9)' }, anchorAtlasMarker: { position: 'absolute', zIndex: 13, width: 17, height: 17, borderRadius: '50%', border: '2px solid #ffd36d', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 2px rgba(1,13,29,.78)' }, anchorProductionMarker: { position: 'absolute', zIndex: 14, width: 12, height: 12, borderRadius: '50%', background: '#64e88f', transform: 'translate(-50%, -50%)', boxShadow: '0 0 0 2px rgba(1,13,29,.85), 0 0 13px rgba(100,232,143,.95)' }, targetMarker: { position: 'absolute', zIndex: 17, color: '#ff7ab6', fontSize: 28, lineHeight: 1, fontWeight: 1000, transform: 'translate(-50%, -50%)', textShadow: '0 0 5px #000, 0 0 12px rgba(255,122,182,.95)' }, leaderLine: { position: 'absolute', zIndex: 15, height: 1, transformOrigin: '0 0', borderTop: '1px solid rgba(255,255,255,.72)', pointerEvents: 'none' }, anchorLabel: { position: 'absolute', zIndex: 16, maxWidth: 150, padding: '4px 7px', borderRadius: 9, border: '1px solid rgba(255,255,255,.42)', background: 'rgba(4,8,13,.84)', color: '#fff7d6', fontSize: 'clamp(9px, 1.7vw, 11px)', fontWeight: 900, lineHeight: 1.15, textShadow: '0 1px 3px #000', transform: 'translateY(-50%)', pointerEvents: 'none' }, anchorLabelSelected: { borderColor: '#67e8f9', background: 'rgba(4,20,28,.94)', color: '#dffbff' },
  controls: { flex: '1 1 320px', maxWidth: 360, minWidth: 0, border: '1px solid rgba(255,222,166,.22)', borderRadius: 22, padding: 18, background: 'rgba(8,12,18,.76)' }, panelTitle: { margin: '0 0 8px' }, selectionPanel: { display: 'grid', gap: 5, margin: '0 0 12px', padding: 12, borderRadius: 14, border: '1px solid rgba(103,232,249,.42)', background: 'rgba(103,232,249,.1)', color: '#dffbff', lineHeight: 1.35 }, miniButton: { justifySelf: 'start', padding: '6px 9px', borderRadius: 9, border: '1px solid rgba(103,232,249,.55)', background: 'rgba(103,232,249,.12)', color: '#dffbff', fontWeight: 800, cursor: 'pointer' }, anchorGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(118px, 1fr))', gap: 6, marginBottom: 12 }, anchorButton: { padding: '8px 9px', borderRadius: 10, border: '1px solid rgba(255,222,166,.22)', background: 'rgba(255,255,255,.06)', color: '#ffe8b6', fontSize: 12, fontWeight: 900, cursor: 'pointer' }, anchorButtonActive: { borderColor: '#67e8f9', background: 'rgba(103,232,249,.18)', color: '#dffbff' }, notes: { color: 'rgba(248,239,217,.68)', lineHeight: 1.45 }, correctionPanel: { margin: '14px 0', padding: 12, borderRadius: 14, border: '1px solid rgba(100,232,143,.24)', background: 'rgba(100,232,143,.08)' }, correctionTitle: { margin: '0 0 8px', color: '#aef0bd', fontSize: 15 }, correctionHelp: { margin: 0, color: 'rgba(220,255,230,.72)', fontSize: 13, lineHeight: 1.45 }, rangeLabel: { display: 'grid', gap: 8, margin: '16px 0', color: '#ffe7b0', fontSize: 14 }, rangeInput: { width: '100%' }, noRotation: { color: 'rgba(248,239,217,.66)', fontSize: 13, lineHeight: 1.45 }, copyButton: { width: '100%', padding: '11px 14px', borderRadius: 12, border: 0, background: '#f0bd55', color: '#140e08', fontWeight: 900, cursor: 'pointer' }, copyStatus: { color: '#9df0b0', fontWeight: 800 }, pre: { maxHeight: 320, overflow: 'auto', padding: 12, borderRadius: 12, background: 'rgba(0,0,0,.38)', color: '#dcecff', fontSize: 12, whiteSpace: 'pre-wrap' },
};
