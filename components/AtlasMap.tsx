'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent, WheelEvent } from 'react';
import { ATLAS_EVENTS } from '../data/events';

const ATMOSPHERIC_SUGGESTIONS = [
  'Show me music festivals',
  'Find hidden gems',
  'What is happening this weekend?',
  'Show me county fairs',
  'Find waterfront festivals',
];

export default function AtlasMap() {
  const [query, setQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const enterFrameInnerRef = useRef<number | null>(null);
  const [renderedEvent, setRenderedEvent] = useState<(typeof ATLAS_EVENTS)[number] | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [cardEnterOffset, setCardEnterOffset] = useState(36);
  const [searchPulseTick, setSearchPulseTick] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const q = submittedQuery.trim().toLowerCase();
  const featuredEvents = useMemo(() => ATLAS_EVENTS.slice(0, 4), []);
  const featuredEvent = featuredEvents[featuredIndex % featuredEvents.length];

  const highlightedIds = useMemo(() => {
    const ids = new Set<string>();

    if (!q) return ids;

    const addMusicFestivals = () => {
      ids.add('electric-forest');
      ids.add('detroit-jazz');
    };

    if (q.includes('music festival') || q.includes('music festivals')) addMusicFestivals();
    if (q.includes('music')) addMusicFestivals();

    if (q.includes('county fair') || q.includes('county fairs') || q.includes('fair') || q.includes('fairs')) {
      ids.add('armada-fair');
    }

    if (q.includes('peach festival') || q.includes('romeo') || q.includes('peach')) ids.add('romeo-peach');
    if (q.includes('jazz')) ids.add('detroit-jazz');
    if (q.includes('forest')) ids.add('electric-forest');

    if (q.includes('cherry') || q.includes('lilac') || q.includes('tulip')) {
      ids.add('romeo-peach');
    }

    return ids;
  }, [q]);

  const selected = ATLAS_EVENTS.find((event) => event.id === selectedId) ?? null;
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);
  const touchPointsRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStateRef = useRef<{
    startDistance: number;
    startZoom: number;
    startCenterX: number;
    startCenterY: number;
    basePanX: number;
    basePanY: number;
  } | null>(null);

  const clampZoom = useCallback((nextZoom: number) => Math.max(1, Math.min(1.8, nextZoom)), []);

  const clampPan = useCallback((x: number, y: number, atZoom: number) => {
    const zoomPanFactor = Math.max(0, atZoom - 1);
    const maxX = 22 + zoomPanFactor * 90;
    const maxY = 16 + zoomPanFactor * 72;

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);
  const isViewDirty = selectedId !== null || zoom > 1.001 || Math.abs(panOffset.x) > 0.5 || Math.abs(panOffset.y) > 0.5;

  const mapFocusScale = selected ? 1.045 : 1;
  const mapFocusTransform = selected
    ? `translate(calc(${(50 - selected.x) * 0.12}% + ${panOffset.x}px), calc(${(50 - selected.y) * 0.12}% + ${panOffset.y}px)) scale(${(mapFocusScale * zoom).toFixed(4)})`
    : `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom.toFixed(4)})`;

  const handleMapPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    } else if (event.button !== 0 || !event.isPrimary) {
      return;
    }

    const target = event.target as HTMLElement;
    const isInteractive = Boolean(target.closest('button, input, textarea, a'));
    if (isInteractive && event.pointerType !== 'touch') return;

    if (event.pointerType === 'touch' && touchPointsRef.current.size >= 2) {
      const points = [...touchPointsRef.current.values()];
      const [pointA, pointB] = points;
      const centerX = (pointA.x + pointB.x) / 2;
      const centerY = (pointA.y + pointB.y) / 2;
      pinchStateRef.current = {
        startDistance: Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y),
        startZoom: zoom,
        startCenterX: centerX,
        startCenterY: centerY,
        basePanX: panOffset.x,
        basePanY: panOffset.y,
      };
      dragStateRef.current = null;
    } else if (!isInteractive) {
      dragStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        baseX: panOffset.x,
        baseY: panOffset.y,
        moved: false,
      };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleMapPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      if (touchPointsRef.current.has(event.pointerId)) {
        touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      const pinchState = pinchStateRef.current;
      if (pinchState && touchPointsRef.current.size >= 2) {
        const points = [...touchPointsRef.current.values()];
        const [pointA, pointB] = points;
        const distance = Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
        const centerX = (pointA.x + pointB.x) / 2;
        const centerY = (pointA.y + pointB.y) / 2;
        const nextZoom = clampZoom(pinchState.startZoom * (distance / Math.max(1, pinchState.startDistance)));
        const deltaCenterX = centerX - pinchState.startCenterX;
        const deltaCenterY = centerY - pinchState.startCenterY;
        setZoom(nextZoom);
        setPanOffset(clampPan(pinchState.basePanX + deltaCenterX * 0.2, pinchState.basePanY + deltaCenterY * 0.2, nextZoom));
        return;
      }
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    const constrained = clampPan(dragState.baseX + deltaX * 0.24, dragState.baseY + deltaY * 0.24, zoom);

    if (!dragState.moved && Math.hypot(deltaX, deltaY) > 4) {
      dragState.moved = true;
    }

    setPanOffset(constrained);
  };

  const handleMapPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      touchPointsRef.current.delete(event.pointerId);
      if (touchPointsRef.current.size < 2) pinchStateRef.current = null;
    }

    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    event.preventDefault();
    const zoomStep = -event.deltaY * 0.0012;
    const nextZoom = clampZoom(zoom + zoomStep);
    if (nextZoom === zoom) return;
    setZoom(nextZoom);
    setPanOffset((prev) => clampPan(prev.x, prev.y, nextZoom));
  };

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

  const submitSearch = useCallback(() => {
    setSubmittedQuery(query);
    setSearchPulseTick((prev) => prev + 1);
    searchInputRef.current?.blur();
  }, [query]);

  const resetView = useCallback(() => {
    setSelectedId(null);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    const rotateId = setInterval(() => {
      setSuggestionIndex((prev) => (prev + 1) % ATMOSPHERIC_SUGGESTIONS.length);
    }, 5400);
    return () => clearInterval(rotateId);
  }, []);

  useEffect(() => {
    const rotateFeaturedId = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredEvents.length);
    }, 8200);
    return () => clearInterval(rotateFeaturedId);
  }, [featuredEvents.length]);

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
        onPointerDown={handleMapPointerDown}
        onPointerMove={handleMapPointerMove}
        onPointerUp={handleMapPointerUp}
        onPointerCancel={handleMapPointerUp}
        onWheel={handleWheel}
        style={{
          ...styles.mapFrame,
          transform: mapFocusTransform,
        }}
      >
        <img src="/maps/michigan-atlas-base.webp" alt="Michigan Atlas" draggable={false} style={styles.mapImage} />

        {ATLAS_EVENTS.map((event, index) => {
          const isHighlighted = highlightedIds.has(event.id);
          const isSelected = selectedId === event.id;
          const isDimmed = highlightedIds.size > 0 && !isHighlighted;
          const isSearchActive = highlightedIds.size > 0;
          const isFeaturedMarker = !isSearchActive && featuredEvent.id === event.id;
          const pulseDuration = 2.4 + (index % 3) * 0.35;
          const pulseDelay = index * 0.26;

          return (
            <div key={event.id} style={{ ...styles.markerWrap, left: `${event.x}%`, top: `${event.y}%` }}>
              <button
                type="button"
                className="marker-pulse"
                aria-label={event.name}
                onClick={() => setSelectedId(event.id)}
                style={({
                  ...styles.marker,
                  opacity: isDimmed ? 0.28 : 1,
                  '--marker-scale-base': isHighlighted ? 1.45 : isSelected ? 1.25 : isFeaturedMarker ? 1.08 : 1,
                  '--marker-shadow-idle': isHighlighted
                    ? '0 0 18px rgba(255,241,202,.98), 0 0 40px rgba(253,208,120,1)'
                    : isSelected
                      ? '0 0 12px rgba(255,228,170,.9), 0 0 28px rgba(253,208,120,.96)'
                      : isFeaturedMarker
                        ? '0 0 10px rgba(248,209,124,.9), 0 0 22px rgba(248,209,124,.76)'
                        : '0 0 8px rgba(242,198,106,.82), 0 0 18px rgba(242,198,106,.72)',
                  '--marker-shadow-peak': isHighlighted
                    ? '0 0 24px rgba(255,246,220,1), 0 0 54px rgba(253,208,120,1)'
                    : isSelected
                      ? '0 0 18px rgba(255,235,186,.98), 0 0 36px rgba(253,208,120,.99)'
                      : isFeaturedMarker
                        ? '0 0 16px rgba(255,233,176,.95), 0 0 33px rgba(253,208,120,.93)'
                        : '0 0 14px rgba(255,228,170,.92), 0 0 30px rgba(253,208,120,.9)',
                  animationDuration: `${pulseDuration}s`,
                  animationDelay: `${pulseDelay}s`,
                } as CSSProperties)}
              />
              <div
                aria-hidden="true"
                style={{
                  ...styles.markerLabel,
                  opacity: isHighlighted ? 1 : 0,
                  transform: isHighlighted ? 'translate(-50%, -122%)' : 'translate(-50%, -116%)',
                  pointerEvents: 'none',
                }}
              >
                {event.name}
              </div>
            </div>
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

      {isViewDirty ? (
        <button type="button" onClick={resetView} style={styles.resetViewButton} aria-label="Reset map view">
          Reset View
        </button>
      ) : null}

      <div style={styles.searchDock}>
        <button
          type="button"
          onClick={() => setSelectedId(featuredEvent.id)}
          style={styles.featuredDiscovery}
          aria-label={`Open featured discovery: ${featuredEvent.name}`}
        >
          <span key={featuredEvent.id} className="featured-discovery-text">
            Featured: {featuredEvent.name}
          </span>
        </button>
        <input
          ref={searchInputRef}
          className={`atlas-search-input ${searchPulseTick > 0 ? 'atlas-search-input--pulse' : ''}`}
          style={styles.searchInput}
          placeholder={query ? '' : ATMOSPHERIC_SUGGESTIONS[suggestionIndex]}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onAnimationEnd={() => {
            setSearchPulseTick(0);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key !== 'Enter') return;
            event.preventDefault();
            submitSearch();
          }}
        />
      </div>

      <style jsx>{`
        .atlas-search-input::placeholder {
          color: rgba(255, 239, 206, 0.62);
        }

        .atlas-search-input--pulse {
          animation: searchAcceptPulse 360ms ease-out;
        }

        .featured-discovery-text {
          display: inline-block;
          animation: featuredDiscoverySwap 1200ms cubic-bezier(.22,.61,.36,1);
          will-change: opacity, transform;
        }

        .marker-pulse {
          animation-name: markerPulse;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          animation-fill-mode: both;
          will-change: transform, box-shadow, filter;
          transform-origin: center;
        }

        @keyframes featuredDiscoverySwap {
          0% {
            opacity: 0.42;
            transform: translateY(4px);
            filter: blur(1px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes searchAcceptPulse {
          0% {
            box-shadow: inset 0 0 0 1px rgba(255, 244, 214, 0.06), 0 0 14px rgba(252, 201, 102, 0.28);
            filter: brightness(1);
          }
          45% {
            box-shadow: inset 0 0 0 1px rgba(255, 246, 220, 0.16), 0 0 20px rgba(255, 220, 142, 0.44);
            filter: brightness(1.03);
          }
          100% {
            box-shadow: inset 0 0 0 1px rgba(255, 244, 214, 0.06), 0 0 14px rgba(252, 201, 102, 0.28);
            filter: brightness(1);
          }
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
    height: '100dvh',
    minHeight: '100dvh',
    overflow: 'hidden',
    background: 'radial-gradient(circle at 50% 15%, #172233, #05070c 70%)',
    color: '#f5e8c7',
  },
  mapFrame: {
    position: 'absolute',
    inset: 0,
    transformOrigin: 'center center',
    transition: 'filter 260ms ease, transform 520ms cubic-bezier(.22,.61,.36,1)',
    touchAction: 'none',
    filter: 'saturate(0.9) brightness(0.82)',
  },
  mapImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    opacity: 0.95,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(to bottom, rgba(3,4,7,.25), rgba(3,4,7,.6) 65%, rgba(3,4,7,.88))',
    pointerEvents: 'none',
  },
  marker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 20,
    height: 20,
    borderRadius: 999,
    border: '1px solid rgba(255,228,170,.95)',
    background: 'radial-gradient(circle, #ffebba 8%, #f2c66a 55%, rgba(242,198,106,.15) 100%)',
    zIndex: 3,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  markerWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
    zIndex: 3,
  },
  markerLabel: {
    position: 'absolute',
    left: '50%',
    top: '-18px',
    transform: 'translate(-50%, -116%)',
    padding: '5px 10px',
    borderRadius: 999,
    maxWidth: 180,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontSize: 11,
    letterSpacing: 0.28,
    lineHeight: 1,
    color: 'rgba(255, 241, 209, 0.86)',
    border: '1px solid rgba(255, 227, 170, 0.22)',
    background: 'linear-gradient(180deg, rgba(18, 25, 37, 0.32), rgba(7, 10, 15, 0.22))',
    textShadow: '0 0 8px rgba(255, 224, 153, 0.2), 0 1px 3px rgba(2, 3, 7, 0.74)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 239, 205, 0.05), 0 0 16px rgba(251, 203, 110, 0.2)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    transition: 'opacity 380ms ease, transform 420ms cubic-bezier(.22,.61,.36,1)',
    willChange: 'opacity, transform',
  },
  searchDock: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '10px 14px calc(12px + env(safe-area-inset-bottom))',
    backdropFilter: 'none',
    background: 'transparent',
    zIndex: 20,
    transition: 'bottom 240ms ease',
  },
  featuredDiscovery: {
    display: 'block',
    margin: '0 auto 8px',
    padding: '4px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255, 225, 160, 0.22)',
    background: 'rgba(7, 10, 15, 0.18)',
    color: 'rgba(255, 238, 205, 0.76)',
    fontSize: 11,
    letterSpacing: 0.24,
    lineHeight: 1.2,
    textShadow: '0 1px 3px rgba(2, 3, 7, 0.7)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 240, 205, 0.04), 0 0 10px rgba(252, 201, 102, 0.12)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  searchInput: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 999,
    border: '1px solid rgba(255, 226, 170, 0.56)',
    background: 'rgba(7, 10, 15, 0.16)',
    color: '#fff7de',
    fontSize: 16,
    outline: 'none',
    textShadow: '0 1px 3px rgba(2, 3, 6, 0.85)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 244, 214, 0.06), 0 0 14px rgba(252, 201, 102, 0.28)',
  },
  card: {
    position: 'fixed',
    left: 12,
    right: 12,
    bottom: 120,
    padding: '14px 14px 16px',
    borderRadius: 18,
    background: 'linear-gradient(160deg, rgba(16,21,30,.34), rgba(9,12,18,.2) 58%, rgba(7,10,15,.3))',
    border: '1px solid rgba(255,225,160,.4)',
    boxShadow: 'inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px rgba(252,201,102,.24), 0 16px 36px rgba(0,0,0,.32)',
    backdropFilter: 'blur(4px) saturate(1.05)',
    WebkitBackdropFilter: 'blur(4px) saturate(1.05)',
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
  resetViewButton: {
    position: 'fixed',
    top: 'max(14px, calc(8px + env(safe-area-inset-top)))',
    right: 12,
    padding: '6px 11px',
    borderRadius: 999,
    border: '1px solid rgba(255,225,160,.28)',
    background: 'rgba(8, 11, 16, 0.24)',
    color: 'rgba(255, 238, 205, 0.78)',
    fontSize: 11,
    letterSpacing: 0.26,
    lineHeight: 1.1,
    textShadow: '0 1px 3px rgba(2,3,7,.72)',
    boxShadow: 'inset 0 0 0 1px rgba(255,240,205,0.04), 0 0 10px rgba(252,201,102,0.1)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    cursor: 'pointer',
    touchAction: 'manipulation',
    zIndex: 18,
  },
  cardTitle: {
    margin: '0 40px 6px 0',
    fontSize: 18,
    color: '#ffebb9',
    textShadow: '0 1px 3px rgba(2,3,6,.9), 0 0 8px rgba(255,229,173,.24)',
  },
  cardBody: {
    margin: 0,
    color: '#f0e2c3',
    fontSize: 14,
    lineHeight: 1.35,
    textShadow: '0 1px 3px rgba(2,3,6,.86)',
  },
};
