'use client';

import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ATLAS_EVENTS } from '../data/events';

export default function AtlasMap() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = query.trim().toLowerCase();

  const highlightedIds = useMemo(() => {
    if (!q) return new Set<string>();
    if (q.includes('romeo') || q.includes('peach')) return new Set(['romeo-peach']);
    if (q.includes('music')) return new Set(['electric-forest', 'detroit-jazz']);
    if (q.includes('fair')) return new Set(['armada-fair']);
    return new Set<string>();
  }, [q]);

  const selected = ATLAS_EVENTS.find((event) => event.id === selectedId) ?? null;
  const focusedId = highlightedIds.size === 1 ? Array.from(highlightedIds)[0] : selectedId;

  const transformById: Record<string, string> = {
    'romeo-peach': 'scale(1.32) translate(-8%, -12%)',
    'armada-fair': 'scale(1.28) translate(-9%, -9%)',
    'electric-forest': 'scale(1.24) translate(6%, -2%)',
    'detroit-jazz': 'scale(1.24) translate(-11%, -18%)',
  };

  const mapTransform = focusedId
    ? transformById[focusedId] ?? 'scale(1) translate(0,0)'
    : 'scale(1) translate(0,0)';

  return (
    <section style={styles.hero}>
      <div style={{ ...styles.mapFrame, transform: mapTransform }}>
        <img src="/maps/michigan-atlas-base.webp" alt="Michigan Atlas" style={styles.mapImage} />

        {ATLAS_EVENTS.map((event) => {
          const isHighlighted = highlightedIds.has(event.id);
          const isActive = selectedId === event.id || isHighlighted;
          const isDimmed = highlightedIds.size > 0 && !isHighlighted;

          return (
            <button
              key={event.id}
              type="button"
              aria-label={event.name}
              onClick={() => setSelectedId(event.id)}
              style={{
                ...styles.marker,
                left: `${event.x}%`,
                top: `${event.y}%`,
                opacity: isDimmed ? 0.35 : 1,
                transform: isActive ? 'translate(-50%, -50%) scale(1.25)' : 'translate(-50%, -50%)',
                boxShadow: isActive
                  ? '0 0 10px #ffe4a6, 0 0 24px rgba(253,208,120,.98)'
                  : '0 0 6px #f2c66a, 0 0 16px rgba(242,198,106,.72)',
              }}
            />
          );
        })}

        <div style={styles.vignette} />
      </div>

      {selected ? (
        <article style={styles.card}>
          <button type="button" aria-label="Close event card" onClick={() => setSelectedId(null)} style={styles.closeButton}>
            ×
          </button>
          <h3 style={styles.cardTitle}>{selected.name}</h3>
          <p style={styles.cardBody}>{selected.blurb}</p>
        </article>
      ) : null}

      <div style={styles.searchDock}>
        <input
          style={styles.searchInput}
          placeholder="What would you like to discover?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: 'relative',
    height: '100vh',
    overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 15%, #172233, #05070c 70%)',
    color: '#f5e8c7',
  },
  mapFrame: {
    position: 'absolute',
    inset: 0,
    transformOrigin: 'center center',
    transition: 'transform 0.6s ease, filter 0.6s ease',
    filter: 'saturate(0.9) brightness(0.82)',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    opacity: 0.95,
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(3,4,7,.25), rgba(3,4,7,.6) 65%, rgba(3,4,7,.88))',
    pointerEvents: 'none',
  },
  marker: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 999,
    border: '1px solid rgba(255,228,170,.95)',
    background: 'radial-gradient(circle, #ffebba 8%, #f2c66a 55%, rgba(242,198,106,.15) 100%)',
    zIndex: 3,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  searchDock: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '12px 14px calc(12px + env(safe-area-inset-bottom))',
    backdropFilter: 'blur(12px)',
    background: 'linear-gradient(to top, rgba(7,9,13,.95), rgba(7,9,13,.55))',
    zIndex: 20,
  },
  searchInput: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,227,170,.35)',
    background: 'rgba(17,20,27,.85)',
    color: '#fff7de',
    fontSize: 16,
    outline: 'none',
  },
  card: {
    position: 'fixed',
    left: 12,
    right: 12,
    bottom: 86,
    padding: '14px 14px 16px',
    borderRadius: 18,
    background: 'rgba(9,12,17,.92)',
    border: '1px solid rgba(255,225,160,.28)',
    boxShadow: '0 18px 40px rgba(0,0,0,.45)',
    zIndex: 15,
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid rgba(255,225,160,.45)',
    background: 'rgba(22,26,35,.95)',
    color: '#ffebb9',
    fontSize: 22,
    lineHeight: 1,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  cardTitle: {
    margin: '0 40px 6px 0',
    fontSize: 18,
    color: '#ffebb9',
  },
  cardBody: {
    margin: 0,
    color: '#f0e2c3',
    fontSize: 14,
    lineHeight: 1.35,
  },
};
