'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { ATLAS_EVENTS, type AtlasCategory } from '../data/events';

const CHIP_CATEGORIES: AtlasCategory[] = ['Festivals', 'Music', 'Fairs'];

export default function AtlasMap() {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<AtlasCategory | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const enterFrameInnerRef = useRef<number | null>(null);
  const [renderedEvent, setRenderedEvent] = useState<(typeof ATLAS_EVENTS)[number] | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [cardEnterOffset, setCardEnterOffset] = useState(36);
  const q = query.trim().toLowerCase();

  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();

    if (q) {
      if (q.includes('romeo') || q.includes('peach')) ids.add('romeo-peach');
      if (q.includes('music')) {
        ids.add('electric-forest');
        ids.add('detroit-jazz');
      }
      if (q.includes('fair')) ids.add('armada-fair');
    }

    if (activeCategory) {
      ATLAS_EVENTS.forEach((event) => {
        if (event.category === activeCategory) ids.add(event.id);
      });
    }

    return ids;
  }, [activeCategory, q]);

  const selected = ATLAS_EVENTS.find((event) => event.id === selectedId) ?? null;
  const handleBackdropPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!selectedId) return;

    const target = event.target as Node;
    if (cardRef.current?.contains(target)) return;
    if (mapFrameRef.current?.contains(target)) {
      setSelectedId(null);
    }
  };

  useEffect(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    if (enterFrameRef.current) {
      cancelAnimationFrame(enterFrameRef.current);
      enterFrameRef.current = null;
    }

    if (enterFrameInnerRef.current) {
      cancelAnimationFrame(enterFrameInnerRef.current);
      enterFrameInnerRef.current = null;
    }

    if (selected) {
      setRenderedEvent(selected);
      setCardEnterOffset(48);
      setIsCardVisible(false);
      enterFrameRef.current = requestAnimationFrame(() => {
        enterFrameRef.current = null;
        enterFrameInnerRef.current = requestAnimationFrame(() => {
          setIsCardVisible(true);
          enterFrameInnerRef.current = null;
        });
      });
      return;
    }

    setCardEnterOffset(36);
    setIsCardVisible(false);
    closeTimerRef.current = setTimeout(() => {
      setRenderedEvent(null);
      closeTimerRef.current = null;
    }, 260);
  }, [selected]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      if (enterFrameInnerRef.current) cancelAnimationFrame(enterFrameInnerRef.current);
    };
  }, []);

  return (
    <section style={styles.hero} onPointerDown={handleBackdropPointerDown}>
      <div
        ref={mapFrameRef}
        style={{
          ...styles.mapFrame,
        }}
      >
        <img src="/maps/michigan-atlas-base.webp" alt="Michigan Atlas" style={styles.mapImage} />

        {ATLAS_EVENTS.map((event, index) => {
          const isHighlighted = highlightedIds.has(event.id);
          const isSelected = selectedId === event.id;
          const isDimmed = highlightedIds.size > 0 && !isHighlighted;
          const pulseDuration = 2.4 + (index % 3) * 0.35;
          const pulseDelay = index * 0.26;

          return (
            <button
              key={event.id}
              type="button"
              className="marker-pulse"
              aria-label={event.name}
              onClick={() => setSelectedId(event.id)}
              style={({
                ...styles.marker,
                left: `${event.x}%`,
                top: `${event.y}%`,
                opacity: isDimmed ? 0.28 : 1,
                '--marker-scale-base': isHighlighted ? 1.45 : isSelected ? 1.25 : 1,
                '--marker-shadow-idle': isHighlighted
                  ? '0 0 18px rgba(255,241,202,.98), 0 0 40px rgba(253,208,120,1)'
                  : isSelected
                    ? '0 0 12px rgba(255,228,170,.9), 0 0 28px rgba(253,208,120,.96)'
                    : '0 0 8px rgba(242,198,106,.82), 0 0 18px rgba(242,198,106,.72)',
                '--marker-shadow-peak': isHighlighted
                  ? '0 0 24px rgba(255,246,220,1), 0 0 54px rgba(253,208,120,1)'
                  : isSelected
                    ? '0 0 18px rgba(255,235,186,.98), 0 0 36px rgba(253,208,120,.99)'
                    : '0 0 14px rgba(255,228,170,.92), 0 0 30px rgba(253,208,120,.9)',
                animationDuration: `${pulseDuration}s`,
                animationDelay: `${pulseDelay}s`,
              } as CSSProperties)}
            />
          );
        })}

        <div style={styles.vignette} />
      </div>

      {renderedEvent ? (
        <article
          ref={cardRef}
          style={{
            ...styles.card,
            opacity: isCardVisible ? 1 : 0,
            transform: isCardVisible ? 'translateY(0)' : `translateY(${cardEnterOffset}px)`,
            pointerEvents: isCardVisible ? 'auto' : 'none',
            transition: isCardVisible ? 'opacity 360ms ease, transform 360ms ease' : 'opacity 260ms ease, transform 260ms ease',
          }}
        >
          <button type="button" aria-label="Close event card" onClick={() => setSelectedId(null)} style={styles.closeButton}>
            ×
          </button>
          <h3 style={styles.cardTitle}>{renderedEvent.name}</h3>
          <p style={styles.cardBody}>{renderedEvent.blurb}</p>
        </article>
      ) : null}

      <div style={styles.chipRail}>
        <div style={styles.chipRow}>
          {CHIP_CATEGORIES.map((category) => {
            const isActive = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(isActive ? null : category)}
                style={{
                  ...styles.chip,
                  ...(isActive ? styles.chipActive : null),
                }}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.searchDock}>
        <input
          style={styles.searchInput}
          placeholder="What would you like to discover?"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      <style jsx>{`
        .marker-pulse {
          animation-name: markerPulse;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          will-change: transform, box-shadow, filter;
          transform-origin: center;
        }

        @keyframes markerPulse {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(var(--marker-scale-base, 1));
            box-shadow: var(--marker-shadow-idle);
            filter: brightness(1) saturate(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(calc(var(--marker-scale-base, 1) * 1.18));
            box-shadow: var(--marker-shadow-peak);
            filter: brightness(1.07) saturate(1.08);
          }
        }
      `}</style>
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
    transition: 'filter 260ms ease, transform 280ms ease',
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
  chipRail: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 'calc(68px + env(safe-area-inset-bottom))',
    padding: '0 14px',
    zIndex: 20,
    pointerEvents: 'none',
  },
  searchDock: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'grid',
    gap: 10,
    padding: '10px 14px calc(12px + env(safe-area-inset-bottom))',
    backdropFilter: 'blur(12px)',
    background: 'linear-gradient(to top, rgba(7,9,13,.95), rgba(7,9,13,.55))',
    zIndex: 20,
    transition: 'bottom 240ms ease',
  },
  chipRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    scrollbarWidth: 'none',
    background: 'transparent',
    backdropFilter: 'none',
    boxShadow: 'none',
    pointerEvents: 'auto',
  },
  chip: {
    border: '1px solid rgba(255,227,176,.42)',
    borderRadius: 999,
    background: 'transparent',
    color: 'rgba(255,241,210,.94)',
    fontSize: 12,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
    padding: '9px 13px',
    whiteSpace: 'nowrap',
    textShadow: '0 0 8px rgba(255,238,198,.35)',
    boxShadow: '0 0 10px rgba(255,231,178,.2)',
    touchAction: 'manipulation',
  },
  chipActive: {
    border: '1px solid rgba(255,231,178,.78)',
    color: '#fff6d7',
    background: 'transparent',
    textShadow: '0 1px 3px rgba(10,7,2,.82)',
    boxShadow: 'inset 0 0 0 1px rgba(255,241,203,.2), 0 0 14px rgba(253,208,120,.34), 0 0 28px rgba(252,189,89,.2)',
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
    bottom: 120,
    padding: '14px 14px 16px',
    borderRadius: 18,
    background: 'rgba(9,12,17,.92)',
    border: '1px solid rgba(255,225,160,.28)',
    boxShadow: '0 18px 40px rgba(0,0,0,.45)',
    zIndex: 15,
    willChange: 'opacity, transform',
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
