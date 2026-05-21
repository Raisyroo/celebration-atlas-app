'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { ATLAS_EVENTS } from '../data/events';
import AtmosphereLayer from './AtmosphereLayer';

const ATMOSPHERIC_SUGGESTIONS = [
  'music festivals',
  'county fairs',
  'waterfront festivals',
  'hidden gems',
];
const MAP_BLEED_X = 0.12;
const MAP_BLEED_Y = 0.1;

// Current interaction policy:
// - Keep the atlas at a fixed scale for now (no custom pinch/drag/gesture handlers).
// - This intentionally avoids mobile gesture edge-cases to preserve tap reliability.
//
// Future zoom + clustering roadmap (documentation only, no behavior changes yet):
// 1) Far view    -> render regional glow clusters for broad geographic discovery.
// 2) Mid view    -> transition into grouped category lights per nearby region.
// 3) Close view  -> resolve to individual event markers/icons for precise selection.
//
// When this roadmap is implemented, keep the tier transitions data-driven so the
// clustering thresholds can be tuned without rewriting marker rendering logic.
const BASE_SCALE = 1.03;

// Layer order contract (low -> high): map art (1), decorative atmosphere (2-4 in effects),
// interactive markers (5), event card (15), search + featured discovery dock (20).
const Z_INDEX = {
  mapImage: 1,
  markers: 5,
  card: 15,
  searchDock: 20,
} as const;
const CARD_THEME_BY_CATEGORY: Record<(typeof ATLAS_EVENTS)[number]['category'], { edge: string; glow: string; wash: string }> = {
  Festivals: { edge: 'rgba(255,228,166,.52)', glow: 'rgba(255,202,102,.24)', wash: 'rgba(255,194,112,.14)' },
  Music: { edge: 'rgba(186,208,255,.55)', glow: 'rgba(120,175,255,.24)', wash: 'rgba(132,152,245,.14)' },
  Fairs: { edge: 'rgba(255,203,170,.54)', glow: 'rgba(255,151,106,.24)', wash: 'rgba(255,168,122,.14)' },
};

const RESET_SEARCH_COMMANDS = new Set(['all', 'everything', 'show all', 'reset', 'clear']);

const isResetSearchCommand = (queryText: string) => RESET_SEARCH_COMMANDS.has(queryText.trim().toLowerCase());
const getHighlightedIdsFromQuery = (queryText: string) => {
  const ids = new Set<string>();
  const normalizedQuery = queryText.trim().toLowerCase();

  if (!normalizedQuery) return ids;

  const addMusicFestivals = () => {
    ids.add('electric-forest');
    ids.add('detroit-jazz');
  };

  if (normalizedQuery.includes('music festival') || normalizedQuery.includes('music festivals')) addMusicFestivals();
  if (normalizedQuery.includes('music')) addMusicFestivals();

  if (
    normalizedQuery.includes('county fair') ||
    normalizedQuery.includes('county fairs') ||
    normalizedQuery.includes('fair') ||
    normalizedQuery.includes('fairs')
  ) {
    ids.add('armada-fair');
  }

  if (normalizedQuery.includes('peach festival') || normalizedQuery.includes('romeo') || normalizedQuery.includes('peach')) {
    ids.add('romeo-peach');
  }
  if (normalizedQuery.includes('jazz')) ids.add('detroit-jazz');
  if (normalizedQuery.includes('forest')) ids.add('electric-forest');

  if (normalizedQuery.includes('cherry') || normalizedQuery.includes('lilac') || normalizedQuery.includes('tulip')) {
    ids.add('romeo-peach');
  }

  return ids;
};

export default function AtlasMap() {
  const [query, setQuery] = useState('');
  const [displayedQuery, setDisplayedQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const enterFrameInnerRef = useRef<number | null>(null);
  const [renderedEvent, setRenderedEvent] = useState<(typeof ATLAS_EVENTS)[number] | null>(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [cardEnterOffset, setCardEnterOffset] = useState(36);
  const [searchPulseTick, setSearchPulseTick] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSubmittedQueryFading, setIsSubmittedQueryFading] = useState(false);
  const [discoveryStatusText, setDiscoveryStatusText] = useState<string | null>(null);
  const [romeoVideoKey, setRomeoVideoKey] = useState(0);
  const [showRomeoVideoFallback, setShowRomeoVideoFallback] = useState(false);
  const romeoVideoRef = useRef<HTMLVideoElement | null>(null);
  const q = submittedQuery.trim().toLowerCase();
  const featuredEvents = useMemo(() => ATLAS_EVENTS.slice(0, 4), []);
  const featuredEvent = featuredEvents[featuredIndex % featuredEvents.length];
  const highlightedIds = useMemo(() => getHighlightedIdsFromQuery(q), [q]);

  const selected = ATLAS_EVENTS.find((event) => event.id === selectedId) ?? null;
  const isRomeoCard = renderedEvent?.id === 'romeo-peach';
  const cardTheme = renderedEvent ? CARD_THEME_BY_CATEGORY[renderedEvent.category] : CARD_THEME_BY_CATEGORY.Festivals;
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
    if (selectedId !== 'romeo-peach') return;
    setRomeoVideoKey((prev) => prev + 1);
    setShowRomeoVideoFallback(false);
  }, [selectedId]);

  useEffect(() => {
    if (!isRomeoCard || !isCardVisible) return;
    const video = romeoVideoRef.current;
    if (!video) return;
    video.currentTime = 0;
    video.play().catch(() => {
      setShowRomeoVideoFallback(true);
    });
  }, [isRomeoCard, isCardVisible, romeoVideoKey]);

  const submitSearch = useCallback(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    if (queryFadeTimerRef.current) {
      clearTimeout(queryFadeTimerRef.current);
      queryFadeTimerRef.current = null;
    }

    const isResetCommand = isResetSearchCommand(trimmedQuery);

    setSubmittedQuery(isResetCommand ? '' : trimmedQuery);

    if (isResetCommand) {
      setDiscoveryStatusText(null);
      setDisplayedQuery('');
      setQuery('');
      setIsSubmittedQueryFading(false);
      setSearchPulseTick((prev) => prev + 1);
      searchInputRef.current?.blur();
      return;
    }

    const nextHighlightedIds = getHighlightedIdsFromQuery(trimmedQuery);
    setDiscoveryStatusText(
      nextHighlightedIds.size > 0
        ? `${nextHighlightedIds.size} ${nextHighlightedIds.size === 1 ? 'discovery' : 'discoveries'} found`
        : 'No discoveries found',
    );
    setDisplayedQuery(trimmedQuery);
    setIsSubmittedQueryFading(true);
    setSearchPulseTick((prev) => prev + 1);
    searchInputRef.current?.blur();
    queryFadeTimerRef.current = setTimeout(() => {
      setDisplayedQuery('');
      setQuery('');
      setIsSubmittedQueryFading(false);
      queryFadeTimerRef.current = null;
    }, 680);
  }, [query]);

  useEffect(() => {
    const rotateId = setInterval(() => {
      if (isSearchFocused || query.trim()) return;
      setSuggestionIndex((prev) => (prev + 1) % ATMOSPHERIC_SUGGESTIONS.length);
    }, 5400);
    return () => clearInterval(rotateId);
  }, [isSearchFocused, query]);

  useEffect(() => {
    const rotateFeaturedId = setInterval(() => {
      setFeaturedIndex((prev) => (prev + 1) % featuredEvents.length);
    }, 8200);
    return () => clearInterval(rotateFeaturedId);
  }, [featuredEvents.length]);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (queryFadeTimerRef.current) clearTimeout(queryFadeTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      if (enterFrameInnerRef.current) cancelAnimationFrame(enterFrameInnerRef.current);
    };
  }, []);

  return (
    <section style={styles.hero} onPointerDown={handleBackdropPointerDown}>
      <div
        ref={mapFrameRef}
        style={styles.mapFrame}
      >
        <div
          style={{
            ...styles.mapContent,
            transform: `translate3d(0, 0, 0) scale(${BASE_SCALE})`,
          }}
        >
          <img src="/maps/michigan-atlas-base.webp" alt="Michigan Atlas" draggable={false} style={styles.mapImage} />

          <AtmosphereLayer events={ATLAS_EVENTS} />

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
                <button
                  type="button"
                  aria-label={`Open ${event.name}`}
                  onClick={() => setSelectedId(event.id)}
                  style={{
                    ...styles.markerLabel,
                    opacity: isHighlighted ? 1 : 0,
                    transform: isHighlighted ? 'translate(-50%, -122%)' : 'translate(-50%, -116%)',
                    pointerEvents: isHighlighted ? 'auto' : 'none',
                  }}
                >
                  {event.name}
                </button>
              </div>
            );
          })}

          <div style={styles.vignette} />
        </div>
      </div>

      {renderedEvent ? (
        <article
          ref={cardRef}
          style={{
            ...styles.card,
            borderColor: cardTheme.edge,
            boxShadow: `inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px ${cardTheme.glow}, 0 16px 36px rgba(0,0,0,.32)`,
            background: `linear-gradient(160deg, rgba(16,21,30,.34), rgba(9,12,18,.2) 58%, rgba(7,10,15,.3)), radial-gradient(circle at 82% 12%, ${cardTheme.wash}, rgba(7,10,15,0) 52%)`,
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
          {isRomeoCard ? (
            <div style={styles.romeoMediaWrap} aria-hidden="true">
              <video
                key={romeoVideoKey}
                ref={romeoVideoRef}
                style={{ ...styles.romeoMediaLayer, opacity: showRomeoVideoFallback ? 0 : 1 }}
                src="/event-media/romeo-peach-loop.mp4"
                poster="/event-media/romeo-peach-poster.jpg"
                muted
                autoPlay
                playsInline
                controls={false}
                preload="metadata"
                onCanPlay={(event) => {
                  event.currentTarget.play().catch(() => {
                    setShowRomeoVideoFallback(true);
                  });
                }}
                onEnded={(event) => {
                  const element = event.currentTarget;
                  element.pause();
                  if (Number.isFinite(element.duration) && element.duration > 0) {
                    element.currentTime = element.duration;
                  }
                }}
                onError={() => setShowRomeoVideoFallback(true)}
              />
              <img
                src="/event-media/romeo-peach-poster.jpg"
                alt=""
                style={{ ...styles.romeoMediaLayer, opacity: showRomeoVideoFallback ? 1 : 0 }}
              />
            </div>
          ) : null}
          <p style={styles.cardLocation}>{renderedEvent.location}</p>
          <p style={styles.cardAtmosphere}>{renderedEvent.atmosphereLabel}</p>
          <p style={styles.cardBody}>{renderedEvent.blurb}</p>
          <span style={{ ...styles.cardAtmosphereOrb, boxShadow: `0 0 26px ${cardTheme.glow}, 0 0 50px ${cardTheme.wash}` }} aria-hidden="true" />
        </article>
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
        {discoveryStatusText ? (
          <p style={styles.discoveryStatus} aria-live="polite">
            {discoveryStatusText}
          </p>
        ) : null}
        <div style={styles.searchInputWrap}>
          <span style={styles.searchPrefix} aria-hidden="true">Search:</span>
          <span
            aria-hidden="true"
            className={`atlas-search-query ${isSubmittedQueryFading ? 'atlas-search-query--fade' : ''}`}
            style={styles.searchQueryText}
          >
            {query || displayedQuery}
          </span>
          <input
            ref={searchInputRef}
            className={`atlas-search-input ${searchPulseTick > 0 ? 'atlas-search-input--pulse' : ''}`}
            style={styles.searchInput}
            value={query}
            placeholder={!query.trim() && !displayedQuery && !isSearchFocused ? ATMOSPHERIC_SUGGESTIONS[suggestionIndex] : ''}
            onChange={(event) => {
              const nextQuery = event.target.value;
              setQuery(nextQuery);

              if (nextQuery.trim().length === 0) {
                if (queryFadeTimerRef.current) {
                  clearTimeout(queryFadeTimerRef.current);
                  queryFadeTimerRef.current = null;
                }
                setDisplayedQuery('');
                setSubmittedQuery('');
                setIsSubmittedQueryFading(false);
                setDiscoveryStatusText(null);
              }
            }}
            onAnimationEnd={() => {
              setSearchPulseTick(0);
            }}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            onKeyDown={(event) => {
              if (event.nativeEvent.isComposing) return;
              if (event.key !== 'Enter') return;
              event.preventDefault();
              submitSearch();
            }}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
        </div>
      </div>

      <style jsx>{`
        .atlas-search-input--pulse {
          animation: searchAcceptPulse 360ms ease-out;
        }

        .atlas-search-suggestion {
          display: inline-block;
          opacity: 0.86;
          transition: opacity 700ms ease;
        }

        .atlas-search-suggestion--fade {
          opacity: 0;
          transition: opacity 2s ease;
        }

        .atlas-search-query {
          opacity: 1;
          transition: opacity 640ms ease;
        }

        .atlas-search-query--fade {
          opacity: 0;
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
    overflow: 'hidden',
    contain: 'layout paint size',
  },
  mapContent: {
    position: 'absolute',
    inset: `-${MAP_BLEED_Y * 50}% -${MAP_BLEED_X * 50}%`,
    transformOrigin: 'center center',
    transition: 'filter 260ms ease, transform 520ms cubic-bezier(.22,.61,.36,1)',
    touchAction: 'none',
    filter: 'saturate(0.74) brightness(0.62) contrast(1.08)',
  },
  mapImage: {
    position: 'relative',
    zIndex: Z_INDEX.mapImage,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    opacity: 0.88,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 42%, rgba(7,10,16,0) 34%, rgba(4,6,10,.44) 68%, rgba(3,5,8,.78) 100%), linear-gradient(to bottom, rgba(3,4,7,.44), rgba(3,4,7,.72) 64%, rgba(2,3,6,.94))',
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
    zIndex: Z_INDEX.markers,
    cursor: 'pointer',
    touchAction: 'none',
  },
  markerWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
    zIndex: Z_INDEX.markers,
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
    cursor: 'pointer',
    touchAction: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    outline: 'none',
    textAlign: 'center',
  },
  searchDock: {
    position: 'fixed',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '12px 14px calc(14px + env(safe-area-inset-bottom))',
    backdropFilter: 'none',
    background: 'transparent',
    zIndex: Z_INDEX.searchDock,
    transition: 'bottom 240ms ease',
  },
  featuredDiscovery: {
    display: 'block',
    margin: '0 auto 10px',
    padding: '5px 12px',
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
    touchAction: 'none',
  },
  searchInputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minHeight: 52,
    width: '100%',
    borderRadius: 999,
    border: '1px solid rgba(255, 226, 170, 0.56)',
    background: 'rgba(7, 10, 15, 0.16)',
    boxShadow: 'inset 0 0 0 1px rgba(255, 244, 214, 0.06), 0 0 14px rgba(252, 201, 102, 0.28)',
    padding: '0 15px',
  },
  discoveryStatus: {
    margin: '0 auto 8px',
    width: 'fit-content',
    color: 'rgba(255, 232, 188, 0.62)',
    fontSize: 11,
    letterSpacing: 0.28,
    lineHeight: 1.2,
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.55), 0 0 8px rgba(247, 199, 98, 0.16)',
    opacity: 0.86,
    pointerEvents: 'none',
  },
  searchPrefix: {
    flexShrink: 0,
    color: '#fff7de',
    opacity: 0.96,
    textShadow: '0 1px 3px rgba(2, 3, 6, 0.85)',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 0.1,
  },
  searchQueryText: {
    marginLeft: 8,
    color: 'rgba(255, 239, 206, 0.98)',
    fontSize: 17,
    textShadow: 'none',
    filter: 'none',
    letterSpacing: 0,
    fontWeight: 600,
    lineHeight: 1.15,
    WebkitFontSmoothing: 'antialiased',
    MozOsxFontSmoothing: 'grayscale',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: 'calc(100% - 92px)',
    pointerEvents: 'none',
  },
  searchInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    padding: '14px 15px 14px 84px',
    borderRadius: 999,
    border: 'none',
    background: 'transparent',
    color: 'transparent',
    caretColor: 'rgba(255, 239, 206, 0.98)',
    fontSize: 17,
    fontWeight: 600,
    lineHeight: 1.15,
    outline: 'none',
    textShadow: 'none',
    filter: 'none',
    boxShadow: 'none',
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
    zIndex: Z_INDEX.card,
    willChange: 'opacity, transform',
    overflow: 'hidden',
  },
  romeoMediaWrap: {
    position: 'absolute',
    right: 0,
    top: '18%',
    width: '48%',
    height: '78%',
    pointerEvents: 'none',
    overflow: 'hidden',
    maskImage:
      'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.42) 22%, rgba(0,0,0,.84) 42%, rgba(0,0,0,.98) 60%, rgba(0,0,0,1) 100%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.52) 8%, rgba(0,0,0,.9) 16%, rgba(0,0,0,1) 26%, rgba(0,0,0,1) 100%), linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.5) 14%, rgba(0,0,0,.9) 30%, rgba(0,0,0,1) 44%, rgba(0,0,0,1) 100%), linear-gradient(270deg, rgba(0,0,0,.88) 0%, rgba(0,0,0,.96) 6%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 100%)',
    WebkitMaskImage:
      'linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.42) 22%, rgba(0,0,0,.84) 42%, rgba(0,0,0,.98) 60%, rgba(0,0,0,1) 100%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.52) 8%, rgba(0,0,0,.9) 16%, rgba(0,0,0,1) 26%, rgba(0,0,0,1) 100%), linear-gradient(0deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.5) 14%, rgba(0,0,0,.9) 30%, rgba(0,0,0,1) 44%, rgba(0,0,0,1) 100%), linear-gradient(270deg, rgba(0,0,0,.88) 0%, rgba(0,0,0,.96) 6%, rgba(0,0,0,1) 14%, rgba(0,0,0,1) 100%)',
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
    zIndex: 0,
  },
  romeoMediaLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center center',
    transition: 'opacity 200ms ease',
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
    touchAction: 'none',
  },
  cardTitle: {
    position: 'relative',
    zIndex: 1,
    margin: '0 40px 4px 0',
    fontSize: 22,
    lineHeight: 1.12,
    fontWeight: 700,
    letterSpacing: 0.2,
    color: '#ffebb9',
    textShadow: '0 1px 3px rgba(2,3,6,.9), 0 0 14px rgba(255,229,173,.28)',
  },
  cardLocation: {
    position: 'relative',
    zIndex: 1,
    margin: '0 0 8px',
    fontSize: 12,
    letterSpacing: 0.9,
    textTransform: 'uppercase',
    color: 'rgba(255,238,203,.88)',
    textShadow: '0 1px 2px rgba(3,4,8,.8)',
  },
  cardAtmosphere: {
    position: 'relative',
    zIndex: 1,
    margin: '0 0 10px',
    fontSize: 14,
    fontWeight: 600,
    color: 'rgba(255,233,191,.95)',
    letterSpacing: 0.28,
    textShadow: '0 1px 2px rgba(2,3,7,.7), 0 0 10px rgba(255,219,156,.22)',
  },
  cardBody: {
    position: 'relative',
    zIndex: 1,
    margin: 0,
    color: '#f0e2c3',
    fontSize: 14,
    lineHeight: 1.35,
    textShadow: '0 1px 3px rgba(2,3,6,.86)',
  },
  cardAtmosphereOrb: {
    position: 'absolute',
    right: 18,
    top: 52,
    width: 7,
    height: 7,
    borderRadius: 999,
    background: 'rgba(255,232,188,.84)',
    opacity: 0.9,
    pointerEvents: 'none',
  },
};
