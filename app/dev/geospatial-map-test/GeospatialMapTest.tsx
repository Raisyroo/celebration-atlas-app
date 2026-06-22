'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { ATLAS_EVENTS } from '../../../data/events';
import { deriveSafeAtlasEventCard } from '../../../data/safeEventCard';
import { searchEventProfiles } from '../../../data/eventProfiles';
import { resolveExactEventIntent } from '../../../data/exactEventIntent';

type ViewState = { centerLat: number; centerLng: number; zoom: number };

const INITIAL_VIEW: ViewState = { centerLat: 44.3, centerLng: -85.2, zoom: 1.1 };
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 7;
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 720;
const DEGREE_SCALE = 96;
const EVENT_LIMIT = 18;

const mapEvents = ATLAS_EVENTS.filter(
  (event) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude),
).slice(0, EVENT_LIMIT);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function projectLatLngToViewport(
  latitude: number,
  longitude: number,
  view: ViewState,
) {
  const latitudeScale = Math.cos((view.centerLat * Math.PI) / 180) || 1;
  const pixelsPerDegree = DEGREE_SCALE * view.zoom;

  return {
    x: MAP_WIDTH / 2 + (longitude - view.centerLng) * pixelsPerDegree * latitudeScale,
    y: MAP_HEIGHT / 2 - (latitude - view.centerLat) * pixelsPerDegree,
  };
}

export default function GeospatialMapTest() {
  const [view, setView] = useState<ViewState>(INITIAL_VIEW);
  const [selectedId, setSelectedId] = useState<string | null>(mapEvents[0]?.id ?? null);
  const [query, setQuery] = useState('');

  const highlightedIds = useMemo(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return new Set<string>();

    const exactIntent = resolveExactEventIntent(trimmedQuery);
    if (exactIntent) return new Set([exactIntent.eventId]);

    return new Set(searchEventProfiles(trimmedQuery).map((profile) => profile.id));
  }, [query]);

  const selectedEvent = mapEvents.find((event) => event.id === selectedId) ?? null;
  const selectedCard = selectedEvent ? deriveSafeAtlasEventCard(selectedEvent) : null;

  const markers = mapEvents.map((event) => ({
    event,
    point: projectLatLngToViewport(event.latitude, event.longitude, view),
    isHighlighted: highlightedIds.has(event.id),
  }));

  const nudgeView = (deltaLat: number, deltaLng: number) => {
    setView((current) => ({
      ...current,
      centerLat: clamp(current.centerLat + deltaLat / current.zoom, 41.5, 47.8),
      centerLng: clamp(current.centerLng + deltaLng / current.zoom, -90.8, -81.4),
    }));
  };

  const setZoom = (nextZoom: number) => {
    setView((current) => ({ ...current, zoom: clamp(nextZoom, MIN_ZOOM, MAX_ZOOM) }));
  };

  const selectExactMatch = () => {
    const exactIntent = resolveExactEventIntent(query);
    if (!exactIntent || !mapEvents.some((event) => event.id === exactIntent.eventId)) return;
    const event = mapEvents.find((candidate) => candidate.id === exactIntent.eventId);
    if (!event) return;
    setSelectedId(event.id);
    setView((current) => ({ ...current, centerLat: event.latitude, centerLng: event.longitude, zoom: Math.max(current.zoom, 2.4) }));
  };

  return (
    <div style={styles.pageShell}>
      <section style={styles.auditPanel} aria-label="Coordinate and marker audit summary">
        <p style={styles.kicker}>Diagnostic audit result</p>
        <h1 style={styles.title}>Geospatial map test — isolated real-coordinate prototype</h1>
        <ul style={styles.auditList}>
          <li>Reuses ATLAS_EVENTS latitude/longitude as the geographic source of truth.</li>
          <li>Reuses exact-event search resolution and safe event card derivation.</li>
          <li>Does not import or alter the illustrated Michigan projection, marker calibration, clusters, or homepage card wiring.</li>
          <li>Provides simple API-key-free pan and zoom with true lat/lon placement for a small first event set.</li>
        </ul>
      </section>

      <section style={styles.mapPanel} aria-label="Real-coordinate map prototype">
        <div style={styles.toolbar}>
          <label style={styles.searchLabel}>
            Search exact event
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Try Romeo Peach Festival"
              style={styles.searchInput}
            />
          </label>
          <button type="button" onClick={selectExactMatch} style={styles.controlButton}>Open exact match</button>
          <button type="button" onClick={() => setZoom(view.zoom * 1.22)} style={styles.controlButton}>Zoom in</button>
          <button type="button" onClick={() => setZoom(view.zoom / 1.22)} style={styles.controlButton}>Zoom out</button>
        </div>

        <div style={styles.mapWrap}>
          <div style={styles.mapCanvas}>
            <div style={styles.grid} aria-hidden="true" />
            <div style={{ ...styles.stateHint, left: '49%', top: '49%' }} aria-hidden="true">Michigan</div>
            {markers.map(({ event, point, isHighlighted }) => {
              const isSelected = event.id === selectedId;
              const isOutside = point.x < -24 || point.x > MAP_WIDTH + 24 || point.y < -24 || point.y > MAP_HEIGHT + 24;
              return (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Open ${event.name}`}
                  onClick={() => setSelectedId(event.id)}
                  style={{
                    ...styles.marker,
                    left: point.x,
                    top: point.y,
                    opacity: isOutside ? 0 : highlightedIds.size > 0 && !isHighlighted ? 0.28 : 1,
                    transform: `translate(-50%, -50%) scale(${isSelected ? 1.35 : isHighlighted ? 1.18 : 1})`,
                    boxShadow: isSelected
                      ? '0 0 0 2px rgba(255,246,210,.9), 0 0 28px rgba(255,203,104,.85)'
                      : isHighlighted
                        ? '0 0 0 1px rgba(255,237,190,.75), 0 0 20px rgba(255,203,104,.7)'
                        : '0 0 0 1px rgba(255,231,180,.45), 0 0 15px rgba(255,180,80,.42)',
                  }}
                >
                  <span style={styles.markerDot} />
                </button>
              );
            })}
          </div>
          <div style={styles.panPad} aria-label="Pan controls">
            <button type="button" onClick={() => nudgeView(0.55, 0)} style={styles.panButton}>↑</button>
            <button type="button" onClick={() => nudgeView(0, -0.7)} style={styles.panButton}>←</button>
            <button type="button" onClick={() => setView(INITIAL_VIEW)} style={styles.panButton}>•</button>
            <button type="button" onClick={() => nudgeView(0, 0.7)} style={styles.panButton}>→</button>
            <button type="button" onClick={() => nudgeView(-0.55, 0)} style={styles.panButton}>↓</button>
          </div>
        </div>
      </section>

      {selectedEvent && selectedCard ? (
        <aside style={styles.card} aria-label="Selected event card">
          <p style={styles.kicker}>Selected event</p>
          <h2 style={styles.cardTitle}>{selectedCard.name}</h2>
          <p style={styles.cardMeta}>{selectedCard.location} · {selectedEvent.latitude.toFixed(4)}, {selectedEvent.longitude.toFixed(4)}</p>
          <p style={styles.cardBody}>{selectedCard.description}</p>
          <p style={styles.cardTrust}>{selectedCard.trustStatusCopy}</p>
          {selectedCard.detailAction ? <Link href={selectedCard.detailAction.href} style={styles.cardLink}>{selectedCard.detailAction.label}</Link> : null}
        </aside>
      ) : null}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  pageShell: { minHeight: '100vh', padding: '32px', color: '#f7e6c2', background: 'radial-gradient(circle at top, #1c2b3e 0, #080b12 62%)', display: 'grid', gap: 20 },
  auditPanel: { maxWidth: 1100, border: '1px solid rgba(255,220,160,.22)', borderRadius: 24, padding: 24, background: 'rgba(9,13,22,.68)' },
  kicker: { margin: 0, color: 'rgba(255,213,149,.72)', fontSize: 12, letterSpacing: '.18em', textTransform: 'uppercase' },
  title: { margin: '8px 0 12px', fontSize: 34, lineHeight: 1.05 },
  auditList: { margin: 0, paddingLeft: 20, color: 'rgba(255,239,210,.8)', lineHeight: 1.6 },
  mapPanel: { border: '1px solid rgba(255,220,160,.18)', borderRadius: 28, padding: 18, background: 'rgba(5,8,14,.58)', overflow: 'hidden' },
  toolbar: { display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end', marginBottom: 14 },
  searchLabel: { display: 'grid', gap: 6, minWidth: 260, color: 'rgba(255,236,202,.76)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.12em' },
  searchInput: { border: '1px solid rgba(255,220,160,.28)', borderRadius: 999, padding: '11px 14px', background: 'rgba(0,0,0,.28)', color: '#fff2d8' },
  controlButton: { border: '1px solid rgba(255,220,160,.28)', borderRadius: 999, padding: '11px 14px', background: 'rgba(255,205,120,.1)', color: '#ffe8bd', cursor: 'pointer' },
  mapWrap: { position: 'relative', width: '100%', overflow: 'auto', borderRadius: 24, border: '1px solid rgba(255,255,255,.08)' },
  mapCanvas: { position: 'relative', width: MAP_WIDTH, height: MAP_HEIGHT, background: 'linear-gradient(150deg, rgba(25,68,86,.9), rgba(32,67,45,.78) 45%, rgba(31,42,57,.92))' },
  grid: { position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.08) 1px, transparent 1px)', backgroundSize: '80px 80px' },
  stateHint: { position: 'absolute', transform: 'translate(-50%, -50%)', color: 'rgba(255,244,218,.14)', fontSize: 86, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' },
  marker: { position: 'absolute', width: 22, height: 22, borderRadius: 999, border: 0, background: 'rgba(255,206,114,.24)', display: 'grid', placeItems: 'center', cursor: 'pointer', transition: 'transform 180ms ease, opacity 180ms ease, box-shadow 180ms ease' },
  markerDot: { width: 8, height: 8, borderRadius: 999, background: '#fff1c9' },
  panPad: { position: 'absolute', right: 16, bottom: 16, display: 'grid', gridTemplateColumns: 'repeat(3, 38px)', gap: 6 },
  panButton: { width: 38, height: 38, borderRadius: 12, border: '1px solid rgba(255,236,202,.22)', background: 'rgba(5,8,14,.78)', color: '#ffe8bd', cursor: 'pointer' },
  card: { maxWidth: 520, border: '1px solid rgba(255,220,160,.24)', borderRadius: 24, padding: 22, background: 'rgba(8,11,18,.78)', boxShadow: '0 24px 50px rgba(0,0,0,.32)' },
  cardTitle: { margin: '8px 0 6px', fontSize: 26 },
  cardMeta: { margin: 0, color: 'rgba(255,230,190,.68)' },
  cardBody: { color: 'rgba(255,244,224,.84)', lineHeight: 1.55 },
  cardTrust: { color: 'rgba(255,214,152,.72)', fontSize: 13 },
  cardLink: { color: '#ffe0a3', fontWeight: 700 },
};
