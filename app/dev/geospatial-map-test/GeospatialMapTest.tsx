'use client';

import 'maplibre-gl/dist/maplibre-gl.css';

import Image from 'next/image';
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

function formatEventDate(event: AtlasEvent) {
  if (!event.dateRange?.startDate) return 'Date to be announced';
  const formatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const start = new Date(`${event.dateRange.startDate}T00:00:00Z`);
  if (!event.dateRange.endDate || event.dateRange.endDate === event.dateRange.startDate) return formatter.format(start);
  const end = new Date(`${event.dateRange.endDate}T00:00:00Z`);
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

export default function GeospatialMapTest() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [mapError, setMapError] = useState<string | null>(null);
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
  const selectedDate = selectedEvent ? formatEventDate(selectedEvent) : null;
  const visibleSearchResults = useMemo(() => Array.from(highlightedIds).map((id) => mapEvents.find((event) => event.id === id)).filter((event): event is AtlasEvent => Boolean(event)).slice(0, 6), [highlightedIds]);

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
      try {
        if (cancelled || mapRef.current) return;

        const container = mapNodeRef.current;
        if (!container) {
          frameId = window.requestAnimationFrame(initializeMap);
          return;
        }

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

        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
        map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
        map.dragRotate.disable();
        map.touchZoomRotate.disableRotation();

        map.on('error', (event: MapLibreMapLayerMouseEvent | MapLibreErrorEvent | undefined) => {
          const message = describeMapLibreError(event as MapLibreMapLayerMouseEvent | MapLibreErrorEvent | undefined);
          setMapError(`MapLibre style/tile network error: ${message}`);
        });

        map.on('load', () => {
          setMapError(null);
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

  const selectEvent = useCallback((event: AtlasEvent, shouldFly = false) => {
    setSelectedId(event.id);
    if (shouldFly) {
      mapRef.current?.flyTo({ center: [event.longitude, event.latitude], zoom: Math.max(mapRef.current.getZoom(), 9.2), duration: 1100, essential: true });
    }
  }, []);


  const handleSearchChange = (value: string) => {
    setQuery(value);
    const exactIntent = resolveExactEventIntent(value);
    const event = exactIntent ? mapEvents.find((candidate) => candidate.id === exactIntent.eventId) : null;
    if (event) selectEvent(event, true);
  };

  const selectExactMatch = () => {
    const exactIntent = resolveExactEventIntent(query);
    if (!exactIntent) return;
    const event = mapEvents.find((candidate) => candidate.id === exactIntent.eventId);
    if (!event) return;
    selectEvent(event, true);
  };

  return (
    <div className="geospatialTestShell" style={styles.pageShell}>
      <section className="geospatialTestIntro" style={styles.introPanel} aria-label="Celebration Atlas geospatial map test">
        <p style={styles.kicker}>Celebration Atlas map loop</p>
        <h1 className="geospatialTestTitle" style={styles.title}>Find a celebration on the map</h1>
        <p style={styles.introCopy}>Search, tap a marker, or choose a thumbnail to open the same flyer-card experience.</p>
      </section>

      <section className="geospatialTestMapPanel" style={styles.mapPanel} aria-label="Celebration Atlas geospatial map">
        <form className="geospatialTestToolbar" style={styles.toolbar} onSubmit={(event) => { event.preventDefault(); selectExactMatch(); }}>
          <label style={styles.searchLabel}>Event search<input value={query} onChange={(event) => handleSearchChange(event.target.value)} placeholder="Try Romeo Peach Festival" style={styles.searchInput} /></label>
        </form>
        {visibleSearchResults.length ? (
          <div className="geospatialTestResults" style={styles.resultStrip} aria-label="Matching event thumbnails">
            {visibleSearchResults.map((event) => {
              const card = deriveSafeAtlasEventCard(event);
              const imageSrc = card.media?.mediaSrc ?? card.media?.posterSrc;
              return (
                <button key={event.id} type="button" onClick={() => selectEvent(event, true)} style={event.id === selectedId ? { ...styles.resultCard, ...styles.resultCardActive } : styles.resultCard}>
                  {imageSrc ? <Image src={imageSrc} alt="" width={48} height={48} style={styles.resultImage} /> : <span style={styles.resultImageFallback}>{event.category}</span>}
                  <span style={styles.resultText}>{event.name}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="geospatialTestMapWrap" style={styles.mapWrap}>
          <div ref={mapNodeRef} className="geospatialTestMapCanvas" style={styles.mapCanvas} />
          {mapError ? (
            <div style={styles.mapErrorPanel} role="status">
              <p style={styles.mapErrorText}>Map tiles are temporarily unavailable. Search and selected-event cards remain available.</p>
            </div>
          ) : null}
        </div>
      </section>

      {selectedEvent && selectedCard ? (
        <aside className="geospatialTestSelectedCard" style={styles.card} aria-label={`${selectedCard.name} flyer card`}>
          {selectedCard.media?.mediaSrc || selectedCard.media?.posterSrc ? (
            <div style={styles.cardMediaFrame}>
              {selectedCard.media.mediaType === 'video' && selectedCard.media.mediaSrc ? (
                <video src={selectedCard.media.mediaSrc} poster={selectedCard.media.posterSrc} style={styles.cardMedia} muted playsInline loop autoPlay />
              ) : (
                <Image src={selectedCard.media.mediaSrc ?? selectedCard.media.posterSrc ?? '/event-media/fallback/festivals-thumb.webp'} alt="" width={960} height={600} style={styles.cardMedia} />
              )}
            </div>
          ) : null}
          <p style={styles.kicker}>{selectedCard.category}</p>
          <h2 style={styles.cardTitle}>{selectedCard.name}</h2>
          <p style={styles.cardMeta}>{selectedCard.location}</p>
          <p style={styles.cardDate}>{selectedDate}</p>
          <p style={styles.cardBody}>{selectedCard.description}</p>
          <button type="button" disabled style={styles.disabledTicketButton} aria-label="Tickets and information link is not available yet because no manually approved URL has been added for this event.">Tickets & Info</button>
          <p style={styles.ticketHelp}>No manually approved Tickets & Info URL has been added yet.</p>
        </aside>
      ) : null}
      <style jsx global>{`
        .geospatialTestMapCanvas .maplibregl-canvas { outline: none; }
        @media (max-width: 720px) {
          .geospatialTestShell { padding: 14px !important; overflow-x: hidden; }
          .geospatialTestTitle { font-size: 25px !important; }
          .geospatialTestIntro { padding: 16px !important; }
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
  introPanel: { maxWidth: 980, border: '1px solid rgba(255,220,160,.22)', borderRadius: 24, padding: 24, background: 'rgba(9,13,22,.68)' },
  kicker: { margin: 0, color: 'rgba(255,213,149,.72)', fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase' },
  title: { margin: '8px 0 12px', fontSize: 34, lineHeight: 1.05 },
  introCopy: { margin: 0, color: 'rgba(255,239,210,.82)', lineHeight: 1.55 },
  mapPanel: { border: '1px solid rgba(255,220,160,.18)', borderRadius: 28, padding: 18, background: 'rgba(5,8,14,.58)', overflow: 'hidden', maxWidth: '100%' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 14 },
  searchLabel: { display: 'grid', gap: 6, width: 'min(460px, 100%)', color: 'rgba(255,236,202,.76)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em' },
  searchInput: { border: '1px solid rgba(255,220,160,.28)', borderRadius: 999, padding: '12px 16px', background: 'rgba(0,0,0,.28)', color: '#fff2d8', fontSize: 16 },
  resultStrip: { display: 'flex', gap: 10, overflowX: 'auto', padding: '0 0 14px' },
  resultCard: { display: 'grid', gridTemplateColumns: '48px minmax(130px, 1fr)', alignItems: 'center', gap: 10, minWidth: 220, border: '1px solid rgba(255,220,160,.2)', borderRadius: 16, padding: 8, background: 'rgba(255,255,255,.06)', color: '#ffe8bd', textAlign: 'left', cursor: 'pointer' },
  resultCardActive: { borderColor: 'rgba(255,239,180,.72)', boxShadow: '0 0 0 2px rgba(255,226,142,.16)' },
  resultImage: { width: 48, height: 48, objectFit: 'cover', borderRadius: 12, background: '#20180c' },
  resultImageFallback: { width: 48, height: 48, display: 'grid', placeItems: 'center', borderRadius: 12, background: 'rgba(255,211,109,.14)', fontSize: 10 },
  resultText: { fontWeight: 700, lineHeight: 1.15 },
  mapWrap: { position: 'relative', width: '100%', overflow: 'hidden', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)', overscrollBehavior: 'contain' },
  mapCanvas: { width: '100%', height: 'min(72vh, 760px)', minHeight: 540, background: '#090d14' },
  mapErrorPanel: { position: 'absolute', left: 12, right: 12, bottom: 8, margin: 0, padding: '10px 12px', borderRadius: 14, border: '1px solid rgba(255,118,118,.35)', background: 'rgba(45,9,12,.82)', color: '#ffe1d6', fontSize: 12, pointerEvents: 'none', boxShadow: '0 14px 34px rgba(0,0,0,.35)' },
  mapErrorText: { margin: 0 },
  card: { maxWidth: 620, border: '1px solid rgba(255,220,160,.24)', borderRadius: 28, padding: 22, background: 'linear-gradient(180deg, rgba(37,23,15,.88), rgba(8,11,18,.88))', boxShadow: '0 24px 50px rgba(0,0,0,.32)' },
  cardMediaFrame: { overflow: 'hidden', borderRadius: 22, border: '1px solid rgba(255,235,190,.18)', marginBottom: 18, background: '#110d09', aspectRatio: '16 / 10' },
  cardMedia: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cardTitle: { margin: '8px 0 6px', fontSize: 30, lineHeight: 1.04 },
  cardMeta: { margin: 0, color: 'rgba(255,230,190,.78)', fontWeight: 700 },
  cardDate: { margin: '6px 0 0', color: 'rgba(255,213,149,.82)' },
  cardBody: { color: 'rgba(255,244,224,.86)', lineHeight: 1.55 },
  disabledTicketButton: { border: '1px solid rgba(255,220,160,.28)', borderRadius: 999, padding: '12px 18px', background: 'rgba(255,205,120,.12)', color: 'rgba(255,232,189,.62)', fontWeight: 800, cursor: 'not-allowed' },
  ticketHelp: { margin: '8px 0 0', color: 'rgba(255,230,190,.58)', fontSize: 12 },
};
