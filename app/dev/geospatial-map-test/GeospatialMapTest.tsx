'use client';

import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';
import { ATLAS_EVENTS, type AtlasEvent } from '../../../data/events';
import { resolveExactEventIntent } from '../../../data/exactEventIntent';
import { deriveSafeAtlasEventCard } from '../../../data/safeEventCard';

type EventFeatureProperties = {
  eventId: string;
  name: string;
  category: AtlasEvent['category'];
  location: string;
};

type PointGeometry = { type: 'Point'; coordinates: [number, number] };
type EventFeature = { type: 'Feature'; id: string; geometry: PointGeometry; properties: EventFeatureProperties };
type EventFeatureCollection = { type: 'FeatureCollection'; features: EventFeature[] };
type DiagnosticState = { phase: string; detail: string; level?: 'info' | 'error' };
const MAPLIBRE_INSTALL_FAILURE = 'npm install maplibre-gl failed with 403 Forbidden from https://registry.npmjs.org/maplibre-gl in this environment.';
const MAPLIBRE_PRODUCTION_REQUIREMENT = 'Production use requires adding maplibre-gl to package.json and package-lock.json when registry access works, then importing maplibre-gl and maplibre-gl/dist/maplibre-gl.css instead of using a CDN runtime loader.';

const mapEvents = ATLAS_EVENTS.filter(
  (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
);

function toEventFeature(event: AtlasEvent): EventFeature {
  return {
    type: 'Feature',
    id: event.id,
    geometry: { type: 'Point', coordinates: [event.longitude, event.latitude] },
    properties: {
      eventId: event.id,
      name: event.name,
      category: event.category,
      location: event.location,
    },
  };
}

function buildEventFeatureCollection(events: AtlasEvent[]): EventFeatureCollection {
  return { type: 'FeatureCollection', features: events.map(toEventFeature) };
}

export default function GeospatialMapTest() {
  const [selectedId, setSelectedId] = useState<string | null>(mapEvents[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [mapError] = useState<string | null>(MAPLIBRE_INSTALL_FAILURE);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>({
    phase: 'dependency-unavailable',
    detail: `CDN script/style injection was removed; map constructor was not called. ${MAPLIBRE_PRODUCTION_REQUIREMENT}`,
    level: 'error',
  });
  const eventFeatures = useMemo(() => buildEventFeatureCollection(mapEvents), []);
  const [cameraReadout] = useState(`${eventFeatures.features.length} GeoJSON features are ready, but no MapLibre runtime was initialized.`);

  const selectedEvent = mapEvents.find((event) => event.id === selectedId) ?? null;
  const selectedCard = selectedEvent ? deriveSafeAtlasEventCard(selectedEvent) : null;

  const captureMapNode = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    setDiagnostic({
      phase: 'dependency-unavailable',
      detail: `Map container is present with ${Math.round(rect.width)}px × ${Math.round(rect.height)}px available. CDN script/style injection was removed; map constructor was not called. ${MAPLIBRE_PRODUCTION_REQUIREMENT}`,
      level: 'error',
    });
  }, []);

  const selectExactMatch = () => {
    const exactIntent = resolveExactEventIntent(query);
    if (!exactIntent) return;
    const event = mapEvents.find((candidate) => candidate.id === exactIntent.eventId);
    if (!event) return;
    setSelectedId(event.id);
  };


  return (
    <div className="geospatialTestShell" style={styles.pageShell}>
      <section className="geospatialTestAudit" style={styles.auditPanel} aria-label="MapLibre geospatial audit summary">
        <p style={styles.kicker}>Diagnostic audit result</p>
        <h1 className="geospatialTestTitle" style={styles.title}>Geospatial map test — MapLibre real-map prototype</h1>
        <ul className="geospatialTestAuditList" style={styles.auditList}>
          <li>Reuses ATLAS_EVENTS latitude/longitude as the GeoJSON source of truth.</li>
          <li>Reuses exact-event search resolution and safe event card derivation.</li>
          <li>Does not import or alter AtlasMap, MICHIGAN_MAP_ANCHORS, latLngToAtlasPosition, or illustrated-map calibration.</li>
          <li>Stops deterministic startup before any CDN loader path and reports the missing project dependency.</li>
        </ul>
      </section>

      <section className="geospatialTestMapPanel" style={styles.mapPanel} aria-label="Real MapLibre map prototype">
        <div className="geospatialTestToolbar" style={styles.toolbar}>
          <label style={styles.searchLabel}>Search exact event<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Romeo Peach Festival" style={styles.searchInput} /></label>
          <button type="button" onClick={selectExactMatch} style={styles.controlButton}>Open exact match</button>
        </div>
        <div className="geospatialTestMapWrap" style={styles.mapWrap}>
          <div ref={captureMapNode} className="geospatialTestMapCanvas" style={styles.mapCanvas} />
          <div style={mapError ? styles.diagnosticErrorPanel : styles.diagnosticReadout}>
            <p style={styles.diagnosticLine}>{mapError ?? cameraReadout}</p>
            <p style={styles.diagnosticLine}>Phase: {diagnostic.phase} · {diagnostic.detail}</p>
          </div>
        </div>
      </section>

      {selectedEvent && selectedCard ? (
        <aside className="geospatialTestSelectedCard" style={styles.card} aria-label="Selected event card">
          <p style={styles.kicker}>Selected event</p>
          <h2 style={styles.cardTitle}>{selectedCard.name}</h2>
          <p style={styles.cardMeta}>{selectedCard.location} · {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}</p>
          <p style={styles.cardBody}>{selectedCard.description}</p>
          <p style={styles.cardTrust}>{selectedCard.trustStatusCopy}</p>
          {selectedCard.detailAction ? <Link href={selectedCard.detailAction.href} style={styles.cardLink}>{selectedCard.detailAction.label}</Link> : null}
        </aside>
      ) : null}
      <style jsx global>{`
        .geospatialTestMapCanvas .maplibregl-canvas { outline: none; }
        @media (max-width: 720px) {
          .geospatialTestShell { padding: 14px !important; overflow-x: hidden; }
          .geospatialTestTitle { font-size: 25px !important; }
          .geospatialTestAudit { padding: 16px !important; }
          .geospatialTestAuditList { font-size: 13px !important; }
          .geospatialTestMapPanel { padding: 10px !important; border-radius: 20px !important; }
          .geospatialTestToolbar { display: grid !important; align-items: stretch !important; }
          .geospatialTestMapCanvas { height: 66vh !important; min-height: 390px !important; }
          .geospatialTestSelectedCard { max-width: none !important; }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageShell: { minHeight: '100vh', padding: '32px', color: '#f7e6c2', background: 'radial-gradient(circle at top, #1c2b3e 0, #080b12 62%)', display: 'grid', gap: 20, overflowX: 'hidden' },
  auditPanel: { maxWidth: 1100, border: '1px solid rgba(255,220,160,.22)', borderRadius: 24, padding: 24, background: 'rgba(9,13,22,.68)' },
  kicker: { margin: 0, color: 'rgba(255,213,149,.72)', fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase' },
  title: { margin: '8px 0 12px', fontSize: 34, lineHeight: 1.05 },
  auditList: { margin: 0, paddingLeft: 20, color: 'rgba(255,239,210,.8)', lineHeight: 1.6 },
  mapPanel: { border: '1px solid rgba(255,220,160,.18)', borderRadius: 28, padding: 18, background: 'rgba(5,8,14,.58)', overflow: 'hidden', maxWidth: '100%' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 14 },
  searchLabel: { display: 'grid', gap: 6, minWidth: 'min(260px, 100%)', color: 'rgba(255,236,202,.76)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em' },
  searchInput: { border: '1px solid rgba(255,220,160,.28)', borderRadius: 999, padding: '11px 14px', background: 'rgba(0,0,0,.28)', color: '#fff2d8' },
  controlButton: { border: '1px solid rgba(255,220,160,.28)', borderRadius: 999, padding: '11px 14px', background: 'rgba(255,205,120,.1)', color: '#ffe8bd', cursor: 'pointer' },
  mapWrap: { position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', overscrollBehavior: 'contain' },
  mapCanvas: { width: '100%', height: 'min(72vh, 760px)', minHeight: 540, background: '#090d14' },
  diagnosticReadout: { position: 'absolute', left: 12, right: 12, bottom: 8, margin: 0, padding: '5px 8px', borderRadius: 14, background: 'rgba(4,7,12,.62)', color: 'rgba(255,238,205,.72)', fontSize: 11, pointerEvents: 'none' },
  diagnosticErrorPanel: { position: 'absolute', left: 12, right: 12, bottom: 8, margin: 0, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,118,118,.45)', background: 'rgba(45,9,12,.86)', color: '#ffe1d6', fontSize: 12, pointerEvents: 'auto', boxShadow: '0 14px 34px rgba(0,0,0,.35)' },
  diagnosticLine: { margin: '0 0 4px' },
  card: { maxWidth: 560, border: '1px solid rgba(255,220,160,.24)', borderRadius: 24, padding: 22, background: 'rgba(8,11,18,.78)', boxShadow: '0 24px 50px rgba(0,0,0,.32)' },
  cardTitle: { margin: '8px 0 6px', fontSize: 26 },
  cardMeta: { margin: 0, color: 'rgba(255,230,190,.68)' },
  cardBody: { color: 'rgba(255,244,224,.84)', lineHeight: 1.55 },
  cardTrust: { color: 'rgba(255,214,152,.72)', fontSize: 13 },
  cardLink: { color: '#ffe0a3', fontWeight: 700 },
};
