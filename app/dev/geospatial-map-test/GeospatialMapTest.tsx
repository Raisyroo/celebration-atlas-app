'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import Link from 'next/link';
import maplibregl from 'maplibre-gl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ATLAS_EVENTS, type AtlasEvent } from '../../../data/events';
import { searchEventProfiles } from '../../../data/eventProfiles';
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
type MapFeature = { geometry: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> | null };

type MapLibreSource = { getClusterExpansionZoom: (clusterId: number) => Promise<number> };
type MapLibreMap = {
  addControl: (control: unknown, position?: string) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  addSource: (sourceId: string, source: Record<string, unknown>) => void;
  dragRotate: { disable: () => void };
  easeTo: (options: Record<string, unknown>) => void;
  flyTo: (options: Record<string, unknown>) => void;
  getCanvas: () => HTMLCanvasElement;
  getCenter: () => { lat: number; lng: number };
  getLayer: (layerId: string) => unknown;
  getSource: (sourceId: string) => MapLibreSource;
  getZoom: () => number;
  isStyleLoaded: () => boolean;
  on: (eventName: string, layerOrListener: string | ((event?: MapLibreMapLayerMouseEvent | MapLibreErrorEvent) => void), listener?: (event: MapLibreMapLayerMouseEvent) => void) => void;
  remove: () => void;
  setFilter: (layerId: string, filter: unknown[]) => void;
  setPaintProperty: (layerId: string, property: string, value: unknown) => void;
  touchZoomRotate: { disableRotation: () => void };
};
type MapLibreMapLayerMouseEvent = {
  features?: MapFeature[];
};
type MapLibreErrorEvent = {
  error?: { message?: string; status?: number; statusText?: string; url?: string } | Error;
  sourceId?: string;
  tile?: { tileID?: { canonical?: { z?: number; x?: number; y?: number } } };
};
type DiagnosticState = { phase: string; detail: string; level?: 'info' | 'error' };

const DEVELOPMENT_BASEMAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';
const EVENT_SOURCE_ID = 'atlas-events';
const CLUSTER_LAYER_ID = 'atlas-event-clusters';
const CLUSTER_COUNT_LAYER_ID = 'atlas-event-cluster-counts';
const POINT_LAYER_ID = 'atlas-event-points';
const POINT_HALO_LAYER_ID = 'atlas-event-point-halos';
const SELECTED_LAYER_ID = 'atlas-event-selected-point';
const HIGHLIGHT_LAYER_ID = 'atlas-event-highlight-point';
const MICHIGAN_BOUNDS: [[number, number], [number, number]] = [[-91, 41.45], [-81.3, 48.4]];
const INITIAL_CENTER: [number, number] = [-85.2, 44.3];
const INITIAL_ZOOM = 5.55;

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

function describeMapLibreError(event?: MapLibreMapLayerMouseEvent | MapLibreErrorEvent) {
  const mapErrorEvent = event as MapLibreErrorEvent | undefined;
  const error = mapErrorEvent?.error;
  const message = error instanceof Error ? error.message : error?.message;
  const status = !(error instanceof Error) && error?.status ? ` (${error.status}${error.statusText ? ` ${error.statusText}` : ''})` : '';
  const url = !(error instanceof Error) && error?.url ? ` · ${error.url}` : '';
  const tile = mapErrorEvent?.tile?.tileID?.canonical;
  const tileLabel = tile ? ` · tile z${tile.z}/${tile.x}/${tile.y}` : '';
  const source = mapErrorEvent?.sourceId ? ` · source ${mapErrorEvent.sourceId}` : '';
  return `${message || 'MapLibre emitted an unknown map/style/tile error.'}${status}${source}${tileLabel}${url}`;
}

function getFeatureEventId(feature: MapFeature | undefined) {
  const eventId = feature?.properties?.eventId;
  return typeof eventId === 'string' ? eventId : null;
}

export default function GeospatialMapTest() {
  const [selectedId, setSelectedId] = useState<string | null>(mapEvents[0]?.id ?? null);
  const [query, setQuery] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DiagnosticState>({ phase: 'startup', detail: 'Preparing MapLibre initialization.' });
  const [cameraReadout, setCameraReadout] = useState('loading MapLibre camera…');
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const eventFeatures = useMemo(() => buildEventFeatureCollection(mapEvents), []);

  const highlightedIds = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return new Set<string>();
    const exactIntent = resolveExactEventIntent(trimmedQuery);
    if (exactIntent) return new Set([exactIntent.eventId]);
    return new Set(searchEventProfiles(trimmedQuery).map((profile) => profile.id));
  }, [query]);

  const exactHighlightedId = useMemo(() => {
    const exactIntent = resolveExactEventIntent(query);
    return exactIntent && mapEvents.some((event) => event.id === exactIntent.eventId) ? exactIntent.eventId : null;
  }, [query]);

  const selectedEvent = mapEvents.find((event) => event.id === selectedId) ?? null;
  const selectedCard = selectedEvent ? deriveSafeAtlasEventCard(selectedEvent) : null;

  const updateFeatureFilters = useCallback(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    const selectedFilter: unknown[] = selectedId ? ['==', ['get', 'eventId'], selectedId] : ['==', ['get', 'eventId'], ''];
    const highlightFilter: unknown[] = exactHighlightedId ? ['==', ['get', 'eventId'], exactHighlightedId] : ['==', ['get', 'eventId'], ''];
    if (map.getLayer(SELECTED_LAYER_ID)) map.setFilter(SELECTED_LAYER_ID, selectedFilter);
    if (map.getLayer(HIGHLIGHT_LAYER_ID)) map.setFilter(HIGHLIGHT_LAYER_ID, highlightFilter);
    if (map.getLayer(POINT_LAYER_ID)) {
      map.setPaintProperty(POINT_LAYER_ID, 'circle-opacity', highlightedIds.size ? ['case', ['in', ['get', 'eventId'], ['literal', Array.from(highlightedIds)]], 1, 0.25] : 0.95);
    }
  }, [exactHighlightedId, highlightedIds, selectedId]);

  useEffect(() => {
    let cancelled = false;
    let frameId: number | null = null;

    const initializeMap = () => {
      setMapError(null);
      setDiagnostic({ phase: 'assets', detail: 'Using installed MapLibre package and stylesheet.' });
      try {
        if (cancelled || mapRef.current) return;

        const container = mapNodeRef.current;
        if (!container) {
          setDiagnostic({ phase: 'container', detail: 'Map container ref was not ready; waiting for the next frame.' });
          frameId = window.requestAnimationFrame(initializeMap);
          return;
        }

        setDiagnostic({ phase: 'constructor', detail: 'Creating MapLibre map.' });
        const map = new maplibregl.Map({
          container,
          style: DEVELOPMENT_BASEMAP_STYLE,
          center: INITIAL_CENTER,
          zoom: INITIAL_ZOOM,
          minZoom: 4,
          maxZoom: 13,
          maxBounds: MICHIGAN_BOUNDS,
          attributionControl: false,
        });

        setDiagnostic({ phase: 'style', detail: `Map created; requesting CARTO basemap style ${DEVELOPMENT_BASEMAP_STYLE}.` });

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        map.on('error', (event) => {
          const message = describeMapLibreError(event as MapLibreMapLayerMouseEvent | MapLibreErrorEvent | undefined);
          setMapError(`MapLibre style/tile network error: ${message}`);
          setDiagnostic({ phase: 'map-error', detail: message, level: 'error' });
        });

        map.on('load', () => {
          setMapError(null);
          setDiagnostic({ phase: 'loaded', detail: 'CARTO basemap style loaded; adding Celebration Atlas GeoJSON layers.' });
          map.addSource(EVENT_SOURCE_ID, {
            type: 'geojson',
            data: eventFeatures,
            cluster: true,
            clusterRadius: 46,
            clusterMaxZoom: 8,
            promoteId: 'eventId',
          });

          map.addLayer({ id: CLUSTER_LAYER_ID, type: 'circle', source: EVENT_SOURCE_ID, filter: ['has', 'point_count'], paint: { 'circle-color': '#d8a847', 'circle-radius': ['step', ['get', 'point_count'], 18, 8, 24, 18, 31], 'circle-opacity': 0.78, 'circle-stroke-color': '#fff0bf', 'circle-stroke-width': 1.2, 'circle-stroke-opacity': 0.72 } });
          map.addLayer({ id: CLUSTER_COUNT_LAYER_ID, type: 'symbol', source: EVENT_SOURCE_ID, filter: ['has', 'point_count'], layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 12, 'text-font': ['Open Sans Semibold', 'Arial Unicode MS Bold'] }, paint: { 'text-color': '#120c05' } });
          map.addLayer({ id: POINT_HALO_LAYER_ID, type: 'circle', source: EVENT_SOURCE_ID, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#ffd36d', 'circle-radius': 11, 'circle-opacity': 0.16, 'circle-blur': 0.6 } });
          map.addLayer({ id: POINT_LAYER_ID, type: 'circle', source: EVENT_SOURCE_ID, filter: ['!', ['has', 'point_count']], paint: { 'circle-color': '#f4bd4f', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 5, 9, 8, 12, 11], 'circle-stroke-color': '#fff1c8', 'circle-stroke-width': 1.4, 'circle-opacity': 0.95 } });
          map.addLayer({ id: SELECTED_LAYER_ID, type: 'circle', source: EVENT_SOURCE_ID, filter: ['==', ['get', 'eventId'], ''], paint: { 'circle-color': '#fff2bd', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 12, 10, 18], 'circle-opacity': 0.32, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.9 } });
          map.addLayer({ id: HIGHLIGHT_LAYER_ID, type: 'circle', source: EVENT_SOURCE_ID, filter: ['==', ['get', 'eventId'], ''], paint: { 'circle-color': '#ffe08a', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 18, 10, 30], 'circle-opacity': 0.18, 'circle-stroke-color': '#ffefb4', 'circle-stroke-width': 2.4, 'circle-stroke-opacity': 0.9 } });
        });

        const updateReadout = () => {
          const center = map.getCenter();
          setCameraReadout(`center ${center.lat.toFixed(3)}, ${center.lng.toFixed(3)} · z${map.getZoom().toFixed(2)} · ${eventFeatures.features.length} GeoJSON features`);
        };
        map.on('moveend', updateReadout);
        map.on('zoomend', updateReadout);
        map.on('load', updateReadout);

        map.on('click', CLUSTER_LAYER_ID, (event: MapLibreMapLayerMouseEvent) => {
          const feature = event.features?.[0];
          const clusterId = feature?.properties?.cluster_id;
          if (typeof clusterId !== 'number' || !feature) return;
          const source = map.getSource(EVENT_SOURCE_ID) as MapLibreSource;
          source.getClusterExpansionZoom(clusterId).then((zoom) => {
            const coordinates = feature.geometry.coordinates as [number, number];
            map.easeTo({ center: coordinates, zoom: Math.min(zoom + 0.25, 12), duration: 650 });
          });
        });

        map.on('click', POINT_LAYER_ID, (event: MapLibreMapLayerMouseEvent) => {
          const eventId = getFeatureEventId(event.features?.[0]);
          if (!eventId) return;
          setSelectedId(eventId);
        });

        [CLUSTER_LAYER_ID, POINT_LAYER_ID].forEach((layerId) => {
          map.on('mouseenter', layerId, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', layerId, () => { map.getCanvas().style.cursor = ''; });
        });

        mapRef.current = map as MapLibreMap;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'MapLibre failed to initialize.';
        setMapError(message);
        setDiagnostic({ phase: 'failed', detail: message, level: 'error' });
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [eventFeatures]);

  useEffect(() => { updateFeatureFilters(); }, [updateFeatureFilters]);

  const selectExactMatch = () => {
    const exactIntent = resolveExactEventIntent(query);
    if (!exactIntent) return;
    const event = mapEvents.find((candidate) => candidate.id === exactIntent.eventId);
    if (!event) return;
    setSelectedId(event.id);
    mapRef.current?.flyTo({ center: [event.longitude, event.latitude], zoom: Math.max(mapRef.current.getZoom(), 9.2), duration: 1100, essential: true });
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
          <li>Uses the installed maplibre-gl package and stylesheet without CDN runtime loading.</li>
        </ul>
      </section>

      <section className="geospatialTestMapPanel" style={styles.mapPanel} aria-label="Real MapLibre map prototype">
        <div className="geospatialTestToolbar" style={styles.toolbar}>
          <label style={styles.searchLabel}>Search exact event<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try Romeo Peach Festival" style={styles.searchInput} /></label>
          <button type="button" onClick={selectExactMatch} style={styles.controlButton}>Open exact match</button>
        </div>
        <div className="geospatialTestMapWrap" style={styles.mapWrap}>
          <div ref={mapNodeRef} className="geospatialTestMapCanvas" style={styles.mapCanvas} />
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
