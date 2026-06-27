'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import {
  MICHIGAN_ARTWORK_CALIBRATIONS,
  MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION,
  projectLatLngToCalibratedMichiganArtworkPosition,
} from '../../../data/michiganArtworkCalibration';

const MARKER_EDGE_INSET_PERCENT = 6;
const PRODUCTION_MOBILE_BASE_SCALE = 1.03;
const PRODUCTION_MOBILE_MAP_TRANSLATE_Y = '0px';
const PRODUCTION_MOBILE_MAP_TRANSFORM = `translate3d(0px, calc(${PRODUCTION_MOBILE_MAP_TRANSLATE_Y} + 0px), 0) scale(${PRODUCTION_MOBILE_BASE_SCALE})`;
const MICHIGAN_MARKER_FRAME_SCROLL_CLASS = 'dev-michigan-calibration-scroll';

const clampMarkerPercent = (value: number) =>
  Math.min(100 - MARKER_EDGE_INSET_PERCENT, Math.max(MARKER_EDGE_INSET_PERCENT, value));

const productionMobilePositionFor = (latitude: number, longitude: number) => {
  const position = projectLatLngToCalibratedMichiganArtworkPosition(latitude, longitude, 'mobile');
  return {
    x: clampMarkerPercent(position.x),
    y: clampMarkerPercent(position.y),
  };
};

type AnchorKey = 'detroit' | 'port-huron' | 'grand-rapids' | 'traverse-city' | 'charlevoix' | 'mackinac-straits' | 'alpena' | 'escanaba' | 'marquette' | 'sault-ste-marie' | 'houghton-future-slot';

type AnchorDefinition = {
  key: AnchorKey;
  name: string;
  latitude: number;
  longitude: number;
  note: string;
};

type ManualTarget = {
  x: number;
  y: number;
};

const ANCHORS: AnchorDefinition[] = [
  { key: 'detroit', name: 'Detroit', latitude: 42.3314, longitude: -83.0458, note: 'Baseline Lower Peninsula anchor' },
  { key: 'port-huron', name: 'Port Huron', latitude: 42.9709, longitude: -82.4249, note: 'Baseline Lower Peninsula anchor' },
  { key: 'grand-rapids', name: 'Grand Rapids', latitude: 42.9634, longitude: -85.6681, note: 'Baseline Lower Peninsula anchor' },
  { key: 'traverse-city', name: 'Traverse City', latitude: 44.7631, longitude: -85.6206, note: 'Baseline northern Lower Peninsula anchor' },
  { key: 'charlevoix', name: 'Charlevoix', latitude: 45.3181, longitude: -85.2584, note: 'Reference-only city label' },
  { key: 'mackinac-straits', name: 'Mackinac / Straits', latitude: 45.7775, longitude: -84.7278, note: 'Reference-only straits label' },
  { key: 'alpena', name: 'Alpena', latitude: 45.0617, longitude: -83.4328, note: 'Baseline northeast anchor' },
  {
    key: 'escanaba',
    name: 'Escanaba',
    latitude: 45.7453,
    longitude: -87.0646,
    note: 'Not yet active',
  },
  {
    key: 'marquette',
    name: 'Marquette',
    latitude: 46.5436,
    longitude: -87.3954,
    note: 'Not yet active',
  },
  {
    key: 'sault-ste-marie',
    name: 'Sault Ste. Marie',
    latitude: 46.4953,
    longitude: -84.3453,
    note: 'Not yet active',
  },
  {
    key: 'houghton-future-slot',
    name: 'Houghton future slot',
    latitude: 47.1211,
    longitude: -88.5694,
    note: 'Not yet active',
  },
];

const roundPercent = (value: number) => Number(value.toFixed(2));

export default function MichiganMobileMarkerFrameLab() {
  const mapContentRef = useRef<HTMLDivElement | null>(null);
  const [selectedAnchorKey, setSelectedAnchorKey] = useState<AnchorKey>('escanaba');
  const [manualTargets, setManualTargets] = useState<Partial<Record<AnchorKey, ManualTarget>>>({});
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    document.documentElement.classList.add(MICHIGAN_MARKER_FRAME_SCROLL_CLASS);
    document.body.classList.add(MICHIGAN_MARKER_FRAME_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(MICHIGAN_MARKER_FRAME_SCROLL_CLASS);
      document.body.classList.remove(MICHIGAN_MARKER_FRAME_SCROLL_CLASS);
    };
  }, []);

  const selectedAnchor = ANCHORS.find((anchor) => anchor.key === selectedAnchorKey) ?? ANCHORS[0];
  const selectedTarget = manualTargets[selectedAnchor.key];

  const baselinePositions = useMemo(
    () =>
      Object.fromEntries(
        ANCHORS.map((anchor) => [
          anchor.key,
          productionMobilePositionFor(anchor.latitude, anchor.longitude),
        ]),
      ) as Record<AnchorKey, ManualTarget>,
    [],
  );

  const exportPayload = useMemo(
    () => ({
      coordinateFrameStatement:
        'These are final production mobile marker-frame coordinates. Apply x/y directly as CSS left/top percentages inside the production mobile marker overlay layer; they are not old developer artwork-overlay coordinates.',
      productionCssContract: 'style.left = `${position.x}%`; style.top = `${position.y}%`',
      mobileArtworkAsset: MICHIGAN_ARTWORK_CALIBRATIONS.mobile.imageSrc,
      frameMetadata: {
        mapFrame: 'production mobile AtlasMap map frame: absolute inset 0, overflow hidden',
        mapContentTransform: PRODUCTION_MOBILE_MAP_TRANSFORM,
        imageObjectFit: 'cover',
        imageObjectPosition: 'center',
        markerOverlayLayer: 'absolute inset 0 inside the transformed mapContent element',
        markerEdgeInsetPercent: MARKER_EDGE_INSET_PERCENT,
        mobileProjectionCalibration: MICHIGAN_ARTWORK_CALIBRATIONS.mobile,
        mobileLatitudeVerticalCorrection: MICHIGAN_MOBILE_LATITUDE_VERTICAL_CORRECTION,
      },
      anchors: ANCHORS.map((anchor) => {
        const manualTarget = manualTargets[anchor.key];

        return {
          name: anchor.name,
          status: anchor.note,
          realLatitude: anchor.latitude,
          realLongitude: anchor.longitude,
          currentProductionMarker: {
            xPercent: roundPercent(baselinePositions[anchor.key].x),
            yPercent: roundPercent(baselinePositions[anchor.key].y),
          },
          finalProductionFrameTarget: manualTarget
            ? {
                xPercent: roundPercent(manualTarget.x),
                yPercent: roundPercent(manualTarget.y),
              }
            : null,
        };
      }),
    }),
    [baselinePositions, manualTargets],
  );

  const handleFrameClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target instanceof HTMLImageElement)) return;

    const frame = mapContentRef.current;
    if (!frame) return;

    const rect = frame.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setManualTargets((current) => ({
      ...current,
      [selectedAnchor.key]: {
        x: roundPercent(Math.min(100, Math.max(0, x))),
        y: roundPercent(Math.min(100, Math.max(0, y))),
      },
    }));
  };

  const resetSelected = () => {
    setManualTargets((current) => {
      const next = { ...current };
      delete next[selectedAnchor.key];
      return next;
    });
  };

  const resetAll = () => setManualTargets({});

  const copyExport = async () => {
    setCopyStatus('');

    try {
      await navigator.clipboard.writeText(JSON.stringify(exportPayload, null, 2));
      setCopyStatus('Copied typed JSON export.');
    } catch {
      setCopyStatus('Copy failed. Select and copy the JSON manually.');
    }
  };

  return (
    <main style={styles.pageShell}>
      <section style={styles.labHeader}>
        <p style={styles.kicker}>Developer-only · mobile marker calibration</p>
        <h1 style={styles.title}>Michigan mobile production marker frame</h1>
        <p style={styles.intro}>
          Click the same transformed mobile map frame that production markers use. The exported x/y values are final CSS left/top percentages for the production marker overlay, not the prior 9:16 artwork-stage coordinates.
        </p>
      </section>

      <section style={styles.workspace}>
        <div style={styles.phonePanel}>
          <div style={styles.productionFrameLabel}>Exact production-frame preview before the Ask Celebration Atlas panel</div>
          <div style={styles.heroFrame}>
            <div style={styles.mapFrame}>
              <div style={{ ...styles.atmosphereMapContent, transform: PRODUCTION_MOBILE_MAP_TRANSFORM }}>
                <img src="/maps/michigan-atlas-base-tall.webp" alt="" aria-hidden="true" draggable={false} style={styles.atmosphereMapImage} />
              </div>
              <div ref={mapContentRef} style={{ ...styles.mapContent, transform: PRODUCTION_MOBILE_MAP_TRANSFORM }} onClick={handleFrameClick}>
                <img src="/maps/michigan-atlas-base-tall.webp" alt="Michigan Atlas mobile production artwork" draggable={false} style={styles.mapImage} />
                <div style={styles.baseMapGrade} />
                <div style={styles.markerOverlayLayer}>
                  {ANCHORS.map((anchor) => {
                    const baseline = baselinePositions[anchor.key];
                    const target = manualTargets[anchor.key];
                    const isSelected = anchor.key === selectedAnchor.key;
                    return (
                      <div key={anchor.key}>
                        <Marker x={baseline.x} y={baseline.y} label={`${anchor.name}: Current production marker`} tone="baseline" muted={!isSelected} />
                        {target ? <Marker x={target.x} y={target.y} label={`${anchor.name}: Clicked production-frame target · Not yet active`} tone="target" muted={!isSelected} /> : null}
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={styles.vignette} />
            </div>
          </div>
        </div>

        <aside style={styles.controlPanel}>
          <p style={styles.panelKicker}>Anchor placement mode</p>
          <div style={styles.anchorList}>
            {ANCHORS.map((anchor) => (
              <button key={anchor.key} type="button" onClick={() => setSelectedAnchorKey(anchor.key)} style={{ ...styles.anchorButton, ...(anchor.key === selectedAnchor.key ? styles.anchorButtonActive : null) }}>
                <span>{anchor.name}</span>
                <small>{anchor.note}</small>
              </button>
            ))}
          </div>

          <div style={styles.instructionCard}>Selected: {selectedAnchor.name} — click where {selectedAnchor.name} belongs on the artwork.</div>

          <div style={styles.legendCard}>
            <strong>Legend</strong>
            <span><b style={styles.redSwatch}>■</b> Current production marker</span>
            <span><b style={styles.cyanSwatch}>■</b> Clicked candidate target</span>
            <span><b style={styles.selectedSwatch}>■</b> Selected anchor label/marker is fully bright</span>
            <span><b style={styles.previewSwatch}>■</b> Developer-only preview marker labels are shown on this route only</span>
          </div>

          <div style={styles.readoutCard}>
            <h2 style={styles.readoutTitle}>{selectedAnchor.name}</h2>
            <p style={styles.readoutMeta}>Secondary real lat/lon: {selectedAnchor.latitude}, {selectedAnchor.longitude}</p>
            <p style={styles.readoutMeta}>Current production marker: left {roundPercent(baselinePositions[selectedAnchor.key].x)}% · top {roundPercent(baselinePositions[selectedAnchor.key].y)}%</p>
            <p style={styles.targetReadout}>Clicked production-frame target: {selectedTarget ? `left ${roundPercent(selectedTarget.x)}% · top ${roundPercent(selectedTarget.y)}%` : 'not placed yet'}</p>
            <div style={styles.actions}>
              <button type="button" onClick={resetSelected} style={styles.secondaryButton}>Reset selected</button>
              <button type="button" onClick={resetAll} style={styles.secondaryButton}>Reset all</button>
            </div>
          </div>

          <div style={styles.exportCard}>
            <h2 style={styles.readoutTitle}>Typed JSON export</h2>
            <button type="button" onClick={copyExport} style={styles.copyButton}>Copy typed JSON export</button>
            {copyStatus ? <p style={styles.copyStatus}>{copyStatus}</p> : null}
            <pre style={styles.exportPre}>{JSON.stringify(exportPayload, null, 2)}</pre>
          </div>
        </aside>
      </section>
    </main>
  );
}

function Marker({ x, y, label, tone, muted }: { x: number; y: number; label: string; tone: 'baseline' | 'target'; muted?: boolean }) {
  return (
    <div style={{ ...styles.markerWrap, left: `${x}%`, top: `${y}%`, opacity: muted ? 0.42 : 1 }}>
      <span aria-hidden="true" style={{ ...styles.markerDot, ...(tone === 'target' ? styles.targetDot : styles.baselineDot) }} />
      <span style={{ ...styles.markerLabel, ...(x > 68 ? styles.markerLabelLeft : null), ...(tone === 'target' ? styles.targetLabel : styles.baselineLabel) }}>{label}</span>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  pageShell: { minHeight: '100dvh', padding: '24px', background: 'radial-gradient(circle at 50% 15%, #172233, #05070c 70%)', color: '#f5e8c7', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif' },
  labHeader: { maxWidth: 1080, margin: '0 auto 18px' },
  kicker: { margin: 0, color: '#67e8f9', fontSize: 12, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { margin: '6px 0', fontSize: 'clamp(28px, 4vw, 48px)', lineHeight: 1 },
  intro: { maxWidth: 860, margin: 0, color: 'rgba(245,232,199,.78)', lineHeight: 1.55 },
  workspace: { maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(320px, 430px) minmax(320px, 1fr)', gap: 22, alignItems: 'start' },
  phonePanel: { display: 'grid', gap: 10 },
  productionFrameLabel: { color: '#fef08a', fontSize: 12, fontWeight: 900 },
  heroFrame: { position: 'relative', width: 'min(100%, 390px)', aspectRatio: '390 / 844', overflow: 'hidden', borderRadius: 34, border: '1px solid rgba(255, 227, 170, 0.24)', boxShadow: '0 24px 90px rgba(0, 0, 0, 0.56)' },
  mapFrame: { position: 'absolute', inset: 0, overflow: 'hidden', contain: 'layout paint size' },
  mapContent: { position: 'absolute', inset: 0, width: '100%', height: '100%', transformOrigin: 'center center', filter: 'saturate(0.74) brightness(0.62) contrast(1.08)', cursor: 'crosshair' },
  atmosphereMapContent: { position: 'absolute', inset: '-6% -10%', transformOrigin: 'center center', filter: 'saturate(0.8) brightness(0.4) contrast(1.08)', pointerEvents: 'none' },
  atmosphereMapImage: { position: 'relative', width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.72, filter: 'blur(10px)', transform: 'scale(1.1)', pointerEvents: 'none', userSelect: 'none' },
  mapImage: { position: 'relative', zIndex: 1, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: 0.88, pointerEvents: 'none', userSelect: 'none' },
  baseMapGrade: { position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(9,12,18,.05), rgba(9,12,18,.11) 68%, rgba(9,12,18,.19)), radial-gradient(circle at 52% 40%, rgba(255,232,186,.04), rgba(255,232,186,0) 58%)', mixBlendMode: 'screen' },
  markerOverlayLayer: { position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none', transformOrigin: 'center center' },
  vignette: { position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 42%, rgba(7,10,16,0) 34%, rgba(4,6,10,.44) 68%, rgba(3,5,8,.78) 100%), linear-gradient(to bottom, rgba(3,4,7,.44), rgba(3,4,7,.72) 64%, rgba(2,3,6,.94))', pointerEvents: 'none' },
  markerWrap: { position: 'absolute', width: 1, height: 1, zIndex: 5 },
  markerDot: { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', borderRadius: 999, boxShadow: '0 0 0 2px rgba(2,6,12,.76), 0 0 14px currentColor' },
  baselineDot: { width: 14, height: 14, color: '#ff5d50', border: '2px solid rgba(255,238,226,.98)', background: '#ff3b30' },
  targetDot: { width: 18, height: 18, color: '#67e8f9', border: '2px solid rgba(223,251,255,.98)', background: 'rgba(103,232,249,.34)' },
  markerLabel: { position: 'absolute', left: 12, top: -9, minWidth: 132, maxWidth: 166, padding: '4px 7px', borderRadius: 8, fontSize: 10, lineHeight: 1.2, fontWeight: 900, textShadow: '0 1px 3px rgba(0,0,0,.9)' },
  markerLabelLeft: { left: 'auto', right: 12 }, baselineLabel: { border: '1px solid rgba(255,93,80,.58)', background: 'rgba(12,5,5,.78)', color: 'rgba(255,238,226,.98)' },
  targetLabel: { border: '1px solid rgba(103,232,249,.66)', background: 'rgba(3,10,18,.82)', color: '#dffbff' },
  controlPanel: { display: 'grid', gap: 14 },
  panelKicker: { margin: 0, color: '#fef08a', fontSize: 12, fontWeight: 900, letterSpacing: 1.2, textTransform: 'uppercase' },
  anchorList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 8 },
  anchorButton: { display: 'grid', gap: 3, padding: '12px', borderRadius: 14, border: '1px solid rgba(255,227,170,.2)', background: 'rgba(255,232,186,.06)', color: '#f5e8c7', textAlign: 'left', cursor: 'pointer', fontWeight: 900 },
  anchorButtonActive: { borderColor: 'rgba(103,232,249,.78)', boxShadow: '0 0 20px rgba(103,232,249,.18)' },
  instructionCard: { padding: 14, borderRadius: 16, border: '1px solid rgba(103,232,249,.58)', background: 'rgba(103,232,249,.14)', color: '#dffbff', fontWeight: 1000, lineHeight: 1.35 }, legendCard: { display: 'grid', gap: 6, padding: 14, borderRadius: 16, border: '1px solid rgba(255,227,170,.22)', background: 'rgba(7,10,15,.72)', color: 'rgba(245,232,199,.84)', fontSize: 13, lineHeight: 1.35 }, redSwatch: { color: '#ff3b30' }, cyanSwatch: { color: '#67e8f9' }, selectedSwatch: { color: '#fef08a' }, previewSwatch: { color: '#dffbff' }, readoutCard: { padding: 16, borderRadius: 18, border: '1px solid rgba(255,227,170,.22)', background: 'rgba(7,10,15,.72)' },
  readoutTitle: { margin: '0 0 8px', fontSize: 18 },
  readoutMeta: { margin: '6px 0', color: 'rgba(245,232,199,.78)', fontSize: 13 },
  targetReadout: { margin: '10px 0', color: '#dffbff', fontWeight: 900 },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  secondaryButton: { minHeight: 36, padding: '0 12px', borderRadius: 10, border: '1px solid rgba(103,232,249,.58)', background: 'rgba(103,232,249,.12)', color: '#dffbff', fontWeight: 900, cursor: 'pointer' },
  copyButton: { minHeight: 40, width: '100%', marginBottom: 8, padding: '0 12px', borderRadius: 12, border: 0, background: '#67e8f9', color: '#031018', fontWeight: 1000, cursor: 'pointer' },
  copyStatus: { margin: '0 0 8px', color: '#9df0b0', fontSize: 13, fontWeight: 900 },
  exportCard: { padding: 16, borderRadius: 18, border: '1px solid rgba(103,232,249,.24)', background: 'rgba(3,10,18,.82)' },
  exportPre: { maxHeight: 420, overflow: 'auto', margin: 0, padding: 12, borderRadius: 12, background: 'rgba(0,0,0,.34)', color: '#dffbff', fontSize: 11, lineHeight: 1.45 },
};
