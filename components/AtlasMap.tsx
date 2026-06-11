'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import type { CSSProperties, PointerEvent, RefObject } from 'react';
import { ATLAS_EVENTS } from '../data/events';
import { searchEventProfiles } from '../data/eventProfiles';
import {
  MICHIGAN_MAP_ANCHORS,
  latLngToAtlasPosition,
} from '../data/mapCalibration';
import type { MichiganMapAnchor } from '../data/mapCalibration';
import AtmosphereLayer from './AtmosphereLayer';
import { HomeDiscoveryLayer } from './HomeDiscoveryLayer';
import type { HomeDiscoveryResultRow } from './HomeDiscoveryLayer';

const ATMOSPHERIC_SUGGESTIONS = [
  'music festivals',
  'county fairs',
  'waterfront festivals',
  'hidden gems',
];
const DISCOVERY_SHORTCUTS = [
  'Fairs',
  'Fireworks',
  'Food',
  'Music',
  'Parades',
  'Hidden Gems',
];
const REGIONAL_DISCOVERY_SHORTCUTS = [
  'Detroit Metro',
  'Thumb',
  'West Michigan',
  'Northern Michigan',
  'Upper Peninsula',
];
const HOME_DISCOVERY_SHORTCUT_GROUPS = [
  { label: 'Guide', shortcuts: DISCOVERY_SHORTCUTS },
  { label: 'Regions', shortcuts: REGIONAL_DISCOVERY_SHORTCUTS },
];
const DEFAULT_MEDIA_PLAY_START_OFFSET_MS = 180;
const MEDIA_MASKS: Record<'romeoPeach', string> = {
  romeoPeach:
    'radial-gradient(ellipse 96% 88% at 43% 46%, rgba(0,0,0,1) 0%, rgba(0,0,0,.98) 45%, rgba(0,0,0,.76) 61%, rgba(0,0,0,.34) 77%, rgba(0,0,0,0) 100%), radial-gradient(ellipse 72% 76% at 63% 39%, rgba(0,0,0,1) 0%, rgba(0,0,0,.92) 48%, rgba(0,0,0,.52) 70%, rgba(0,0,0,0) 100%), linear-gradient(90deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.06) 7%, rgba(0,0,0,.28) 17%, rgba(0,0,0,.64) 31%, rgba(0,0,0,.94) 44%, rgba(0,0,0,1) 54%, rgba(0,0,0,.93) 63%, rgba(0,0,0,.58) 76%, rgba(0,0,0,.18) 90%, rgba(0,0,0,0) 100%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,.3) 8%, rgba(0,0,0,.72) 18%, rgba(0,0,0,.96) 30%, rgba(0,0,0,1) 76%, rgba(0,0,0,.96) 88%, rgba(0,0,0,.7) 96%, rgba(0,0,0,.22) 100%)',
};

// Current interaction policy:
// - Keep the atlas at a fixed scale for now (no custom pinch/drag/gesture handlers).
// - This intentionally avoids mobile gesture edge-cases to preserve tap reliability.
//
// Active homepage marker path:
// app/page.tsx renders <AtlasMap />. Marker x/y is computed by
// projectEventToMichiganArtworkPosition below, which delegates latitude/longitude
// projection to the anchor-based latLngToAtlasPosition function in
// data/mapCalibration.ts. The painterly image remains the visible basemap.
const BASE_SCALE = 1.03;

// Layer order contract (low -> high): map art (1), decorative atmosphere
// (3-4 in effects), interactive markers (5), optional
// calibration anchors (6), event card (15), search + featured discovery dock (20).
const Z_INDEX = {
  mapImage: 1,
  atmosphere: 3,
  depthVeil: 4,
  particles: 4,
  markers: 5,
  card: 15,
  calibration: 6,
  searchDock: 20,
} as const;

// Legacy calibration debug mode. Homepage marker placement uses the fixed
// anchors in data/mapCalibration.ts; keep this off for production.
const showAtlasCalibration = false;
const CARD_THEME_BY_CATEGORY: Record<
  (typeof ATLAS_EVENTS)[number]['category'],
  { edge: string; glow: string; wash: string }
> = {
  Festivals: {
    edge: 'rgba(255,228,166,.52)',
    glow: 'rgba(255,202,102,.24)',
    wash: 'rgba(255,194,112,.14)',
  },
  Music: {
    edge: 'rgba(186,208,255,.55)',
    glow: 'rgba(120,175,255,.24)',
    wash: 'rgba(132,152,245,.14)',
  },
  Fairs: {
    edge: 'rgba(255,203,170,.54)',
    glow: 'rgba(255,151,106,.24)',
    wash: 'rgba(255,168,122,.14)',
  },
  'Arts & Culture': {
    edge: 'rgba(232,198,255,.55)',
    glow: 'rgba(181,118,255,.24)',
    wash: 'rgba(183,122,255,.14)',
  },
};

const CARD_THEME_BY_REGION: Record<
  NonNullable<(typeof ATLAS_EVENTS)[number]['regionAtmosphere']>,
  { edge: string; glow: string; wash: string }
> = {
  lakeshore: {
    edge: 'rgba(156,202,255,.24)',
    glow: 'rgba(108,168,246,.11)',
    wash: 'rgba(98,146,226,.06)',
  },
  northwoods: {
    edge: 'rgba(123,176,172,.23)',
    glow: 'rgba(66,128,144,.1)',
    wash: 'rgba(58,102,124,.065)',
  },
  urban: {
    edge: 'rgba(255,196,132,.24)',
    glow: 'rgba(231,152,84,.1)',
    wash: 'rgba(206,130,74,.06)',
  },
  harvest: {
    edge: 'rgba(255,199,132,.24)',
    glow: 'rgba(236,168,90,.1)',
    wash: 'rgba(224,150,74,.06)',
  },
  winter: {
    edge: 'rgba(170,210,255,.24)',
    glow: 'rgba(124,179,246,.1)',
    wash: 'rgba(104,144,226,.06)',
  },
};

const blendCardTheme = (
  base: { edge: string; glow: string; wash: string },
  regionAtmosphere?: (typeof ATLAS_EVENTS)[number]['regionAtmosphere'],
) => {
  if (!regionAtmosphere) return base;
  const region = CARD_THEME_BY_REGION[regionAtmosphere];
  return {
    edge: `color-mix(in srgb, ${base.edge} 84%, ${region.edge})`,
    glow: `color-mix(in srgb, ${base.glow} 80%, ${region.glow})`,
    wash: `color-mix(in srgb, ${base.wash} 78%, ${region.wash})`,
  };
};

const CARD_CUE_BY_ICON_TYPE: Record<
  NonNullable<(typeof ATLAS_EVENTS)[number]['iconType']>,
  { sigil: string; label: string }
> = {
  music: { sigil: '◦', label: 'Sound' },
  fair: { sigil: '◦', label: 'Midway' },
  food: { sigil: '◦', label: 'Seasonal' },
  fireworks: { sigil: '◦', label: 'Night sky' },
  flower: { sigil: '◦', label: 'Bloom' },
  harvest: { sigil: '◦', label: 'Harvest' },
  waterfront: { sigil: '◦', label: 'Waterfront' },
  winter: { sigil: '◦', label: 'Winter' },
  art: { sigil: '◦', label: 'Immersive' },
  heritage: { sigil: '◦', label: 'Heritage' },
};

const RESET_SEARCH_COMMANDS = new Set([
  'all',
  'everything',
  'show all',
  'reset',
  'clear',
]);

const REGIONAL_DISCOVERY_EVENT_IDS: Record<string, string[]> = {
  'detroit metro': ['detroit-jazz', 'romeo-peach', 'armada-fair'],
  thumb: ['black-river-tattoo', 'goodells-fair', 'armada-fair'],
  'west michigan': [
    'electric-forest',
    'west-michigan-coast-guard',
    'holland-tulip-time',
    'muskegon-summer-celebration',
    'allendale-balloon-fest',
  ],
  'northern michigan': [
    'traverse-city-cherry',
    'mackinac-lilac',
    'alpena-brown-trout',
    'charlevoix-venetian',
    'cheboygan-4th-fireworks',
  ],
  'upper peninsula': ['upper-peninsula-state-fair'],
};

const isResetSearchCommand = (queryText: string) =>
  RESET_SEARCH_COMMANDS.has(queryText.trim().toLowerCase());
const getLegacyHighlightedIdsFromQuery = (queryText: string) => {
  const ids = new Set<string>();
  const normalizedQuery = queryText.trim().toLowerCase();

  if (!normalizedQuery) return ids;

  const addMusicFestivals = () => {
    ids.add('electric-forest');
    ids.add('detroit-jazz');
  };

  for (const [regionLabel, eventIds] of Object.entries(
    REGIONAL_DISCOVERY_EVENT_IDS,
  )) {
    if (normalizedQuery.includes(regionLabel)) {
      eventIds.forEach((eventId) => ids.add(eventId));
    }
  }

  if (
    normalizedQuery.includes('music festival') ||
    normalizedQuery.includes('music festivals')
  )
    addMusicFestivals();
  if (normalizedQuery.includes('music')) addMusicFestivals();

  if (
    normalizedQuery.includes('county fair') ||
    normalizedQuery.includes('county fairs') ||
    normalizedQuery.includes('fair') ||
    normalizedQuery.includes('fairs')
  ) {
    ids.add('armada-fair');
  }

  if (
    normalizedQuery.includes('peach festival') ||
    normalizedQuery.includes('romeo') ||
    normalizedQuery.includes('peach')
  ) {
    ids.add('romeo-peach');
  }
  if (normalizedQuery.includes('jazz')) ids.add('detroit-jazz');
  if (normalizedQuery.includes('forest')) ids.add('electric-forest');
  if (
    normalizedQuery.includes('hidden gem') ||
    normalizedQuery.includes('hidden gems')
  )
    ids.add('electric-forest');

  if (
    normalizedQuery.includes('cherry') ||
    normalizedQuery.includes('lilac') ||
    normalizedQuery.includes('tulip')
  ) {
    ids.add('romeo-peach');
  }

  for (const event of ATLAS_EVENTS) {
    const searchableTerms = [
      event.name,
      event.location,
      ...(event.searchAliases ?? []),
    ]
      .filter(Boolean)
      .map((term) => term.toLowerCase());
    if (
      searchableTerms.some(
        (term) =>
          normalizedQuery.includes(term) || term.includes(normalizedQuery),
      )
    ) {
      ids.add(event.id);
    }
  }

  return ids;
};

const getHighlightedIdsFromQuery = (queryText: string) => {
  const ids = getLegacyHighlightedIdsFromQuery(queryText);

  for (const profile of searchEventProfiles(queryText)) {
    ids.add(profile.id);
  }

  return ids;
};

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const MARKER_EDGE_INSET_PERCENT = 6;
const CLUSTER_RADIUS_PERCENT = 7.2;
const SHOW_CLUSTER_LABELS = false;
const PHONE_LANDSCAPE_QUERY =
  '(orientation: landscape) and (max-height: 520px) and (max-width: 932px)';
const HOME_DISCOVERY_SCROLL_CLASS = 'home-discovery-scroll';
const HOME_PHONE_LANDSCAPE_SCROLL_CLASS = 'home-phone-landscape-scroll';

// Central post-projection adjustment for the visible homepage marker/cluster
// layer. Keep event lat/lng, anchor data, clustering, and marker styling
// untouched; tune only translateX/translateY to shift the whole projected layer.
const ATLAS_MARKER_PROJECTION_TRANSFORM = {
  translateX: -7,
  translateY: 0,
} as const;

type AtlasEvent = (typeof ATLAS_EVENTS)[number];
type MarkerPosition = { x: number; y: number };

type AtlasMarkerLayout = {
  event: AtlasEvent;
  eventIndex: number;
  position: MarkerPosition;
};

type AtlasMarkerCluster = {
  id: string;
  events: AtlasEvent[];
  eventIndices: number[];
  position: MarkerPosition;
};

const clampMarkerPercent = (value: number, offset = 0) => {
  const lowerBound = MARKER_EDGE_INSET_PERCENT + offset;
  const upperBound = 100 - MARKER_EDGE_INSET_PERCENT - offset;
  return Math.min(upperBound, Math.max(lowerBound, value));
};

const projectEventToMichiganArtworkPosition = (
  event: AtlasEvent,
): MarkerPosition => {
  const artworkPosition = latLngToAtlasPosition(
    event.latitude,
    event.longitude,
  );

  return {
    x: clampMarkerPercent(
      artworkPosition.x + ATLAS_MARKER_PROJECTION_TRANSFORM.translateX,
    ),
    y: clampMarkerPercent(
      artworkPosition.y + ATLAS_MARKER_PROJECTION_TRANSFORM.translateY,
    ),
  };
};

const resolveAtlasMarkerLayouts = (
  events: typeof ATLAS_EVENTS,
): AtlasMarkerLayout[] =>
  events.map((event, eventIndex) => ({
    event,
    eventIndex,
    position: projectEventToMichiganArtworkPosition(event),
  }));

const getMarkerDistance = (a: MarkerPosition, b: MarkerPosition) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const resolveAtlasMarkerClusters = (
  layouts: AtlasMarkerLayout[],
): AtlasMarkerCluster[] => {
  const clusters: AtlasMarkerCluster[] = [];
  const consumed = new Set<string>();
  const orderedLayouts = [...layouts].sort(
    (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
  );

  for (const layout of orderedLayouts) {
    if (consumed.has(layout.event.id)) continue;

    const nearbyLayouts = orderedLayouts.filter(
      (candidate) =>
        !consumed.has(candidate.event.id) &&
        getMarkerDistance(layout.position, candidate.position) <=
          CLUSTER_RADIUS_PERCENT,
    );

    nearbyLayouts.forEach((candidate) => consumed.add(candidate.event.id));

    const centroid = nearbyLayouts.reduce(
      (accumulator, candidate) => ({
        x: accumulator.x + candidate.position.x,
        y: accumulator.y + candidate.position.y,
      }),
      { x: 0, y: 0 },
    );

    const count = nearbyLayouts.length;
    const events = nearbyLayouts.map((candidate) => candidate.event);

    clusters.push({
      id:
        count > 1
          ? `cluster-${events
              .map((event) => event.id)
              .sort()
              .join('-')}`
          : `event-${layout.event.id}`,
      events,
      eventIndices: nearbyLayouts.map((candidate) => candidate.eventIndex),
      position: {
        x: clampMarkerPercent(centroid.x / count),
        y: clampMarkerPercent(centroid.y / count),
      },
    });
  }

  return clusters;
};

function VerificationReferenceLayer() {
  return (
    <div
      aria-label="Michigan anchor city reference points"
      style={styles.verificationReferenceLayer}
    >
      {MICHIGAN_MAP_ANCHORS.map((anchor) => (
        <div
          key={anchor.name}
          style={{
            ...styles.verificationReferenceWrap,
            left: `${anchor.mapX}%`,
            top: `${anchor.mapY}%`,
          }}
        >
          <span aria-hidden="true" style={styles.verificationReferencePoint} />
          <span style={styles.verificationReferenceLabel}>
            {anchor.name}
            <br />
            anchor {anchor.mapX.toFixed(1)}, {anchor.mapY.toFixed(1)}
          </span>
        </div>
      ))}
    </div>
  );
}

const formatCalibrationCoordinate = (value: number) =>
  Number(value.toFixed(5)).toString();
const formatCalibrationPercent = (value: number) =>
  Number(value.toFixed(2)).toString();

const formatCalibrationJson = (
  anchors: MichiganMapAnchor[],
) => `export const MICHIGAN_MAP_ANCHORS: MichiganMapAnchor[] = [
${anchors
  .map(
    (anchor) =>
      `  { name: '${anchor.name}', latitude: ${formatCalibrationCoordinate(anchor.latitude)}, longitude: ${formatCalibrationCoordinate(anchor.longitude)}, mapX: ${formatCalibrationPercent(anchor.mapX)}, mapY: ${formatCalibrationPercent(anchor.mapY)} },`,
  )
  .join('\n')}
];`;

const copyTextToClipboard = async (text: string) => {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
};

const createCalibrationAnchors = () =>
  MICHIGAN_MAP_ANCHORS.map((anchor) => ({ ...anchor }));

function AtlasCalibrationLayer({
  anchors,
  draggingAnchorName,
  onAnchorDragStart,
  onAnchorDragMove,
  onAnchorDragEnd,
  layerRef,
}: {
  anchors: MichiganMapAnchor[];
  draggingAnchorName: string | null;
  onAnchorDragStart: (
    anchorName: string,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onAnchorDragMove: (
    anchorName: string,
    event: PointerEvent<HTMLButtonElement>,
  ) => void;
  onAnchorDragEnd: (event: PointerEvent<HTMLButtonElement>) => void;
  layerRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={layerRef}
      style={styles.calibrationLayer}
      aria-label="Atlas calibration anchors"
    >
      {/* Invisible map = geographic calibration overlay; visible map = artwork below. */}
      {anchors.map((anchor) => {
        const isDragging = draggingAnchorName === anchor.name;

        return (
          <span
            key={anchor.name}
            style={{
              ...styles.calibrationAnchor,
              left: `${anchor.mapX}%`,
              top: `${anchor.mapY}%`,
              zIndex: isDragging
                ? Z_INDEX.calibration + 2
                : Z_INDEX.calibration + 1,
            }}
          >
            <button
              type="button"
              aria-label={`Drag ${anchor.name} calibration anchor`}
              onPointerDown={(event) => onAnchorDragStart(anchor.name, event)}
              onPointerMove={(event) => onAnchorDragMove(anchor.name, event)}
              onPointerUp={onAnchorDragEnd}
              onPointerCancel={onAnchorDragEnd}
              style={{
                ...styles.calibrationAnchorDot,
                ...(isDragging ? styles.calibrationAnchorDotDragging : null),
              }}
            />
          </span>
        );
      })}
    </div>
  );
}

function AtlasCalibrationPanel({
  anchors,
  copyStatus,
  onCopy,
  onReset,
}: {
  anchors: MichiganMapAnchor[];
  copyStatus: string | null;
  onCopy: () => void;
  onReset: () => void;
}) {
  return (
    <details
      style={styles.calibrationPanel}
      aria-label="Atlas calibration tools"
    >
      <summary style={styles.calibrationPanelSummary}>
        <span style={styles.calibrationPanelKicker}>Calibration tools</span>
        <span style={styles.calibrationPanelSummaryHint}>
          {anchors.length} anchors
        </span>
      </summary>
      <p style={styles.calibrationPanelBody}>
        Drag anchors only. Event markers, event labels, and grid are hidden in
        calibration mode.
      </p>
      <div style={styles.calibrationPanelActions}>
        <button
          type="button"
          onClick={onReset}
          style={styles.calibrationResetButton}
        >
          Reset Anchors
        </button>
        <button
          type="button"
          onClick={onCopy}
          style={styles.calibrationCopyButton}
        >
          Copy Calibration JSON
        </button>
      </div>
      {copyStatus ? (
        <p style={styles.calibrationCopyStatus}>{copyStatus}</p>
      ) : null}
    </details>
  );
}

export default function AtlasMap() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [displayedQuery, setDisplayedQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(
    null,
  );
  const [isDesktop, setIsDesktop] = useState(false);
  const [isPhoneLandscape, setIsPhoneLandscape] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [parallaxOffset, setParallaxOffset] = useState({ x: 0, y: 0 });
  const [calibrationAnchors, setCalibrationAnchors] = useState<
    MichiganMapAnchor[]
  >(createCalibrationAnchors);
  const [draggingAnchorName, setDraggingAnchorName] = useState<string | null>(
    null,
  );
  const [calibrationCopyStatus, setCalibrationCopyStatus] = useState<
    string | null
  >(null);

  const searchParams = useSearchParams();
  const isVerificationMode = searchParams.get('verify') === '1';
  const shouldShowCalibration = showAtlasCalibration && !isVerificationMode;
  const initialEventParamHandledRef = useRef(false);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const queryFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = useRef<number | null>(null);
  const enterFrameInnerRef = useRef<number | null>(null);
  const [renderedEvent, setRenderedEvent] = useState<
    (typeof ATLAS_EVENTS)[number] | null
  >(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [cardEnterOffset, setCardEnterOffset] = useState(36);
  const [searchPulseTick, setSearchPulseTick] = useState(0);
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSubmittedQueryFading, setIsSubmittedQueryFading] = useState(false);
  const [discoveryStatusText, setDiscoveryStatusText] = useState<string | null>(
    null,
  );
  const [cardMediaVideoKey, setCardMediaVideoKey] = useState(0);
  const [showCardMediaVideoFallback, setShowCardMediaVideoFallback] =
    useState(false);
  const [isCardMediaVisible, setIsCardMediaVisible] = useState(false);
  const cardMediaVideoRef = useRef<HTMLVideoElement | null>(null);
  const cardMediaFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const calibrationLayerRef = useRef<HTMLDivElement | null>(null);
  const calibrationCopyStatusTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const q = submittedQuery.trim().toLowerCase();
  const featuredEvents = useMemo(() => ATLAS_EVENTS.slice(0, 4), []);
  const featuredEvent = featuredEvents[featuredIndex % featuredEvents.length];
  const highlightedIds = useMemo(() => getHighlightedIdsFromQuery(q), [q]);
  const discoveryResultLimit = isPhoneLandscape ? 2 : isDesktop ? 4 : 3;
  const discoveryResultRows = useMemo<HomeDiscoveryResultRow[]>(() => {
    if (!q || highlightedIds.size === 0) return [];

    return ATLAS_EVENTS.filter((event) => highlightedIds.has(event.id))
      .slice(0, discoveryResultLimit)
      .map((event) => ({
        id: event.id,
        name: event.name,
        location: event.location,
        category: event.category,
        atmosphereLabel: event.atmosphereLabel,
        blurb: event.blurb,
      }));
  }, [discoveryResultLimit, highlightedIds, q]);
  const markerLayouts = useMemo(
    () => resolveAtlasMarkerLayouts(ATLAS_EVENTS),
    [],
  );
  const markerClusters = useMemo(
    () => resolveAtlasMarkerClusters(markerLayouts),
    [markerLayouts],
  );
  const selectedCluster =
    markerClusters.find(
      (cluster) =>
        cluster.id === selectedClusterId && cluster.events.length > 1,
    ) ?? null;

  const selected = !isVerificationMode
    ? (ATLAS_EVENTS.find((event) => event.id === selectedId) ?? null)
    : null;
  const startElectricForestTransition = useCallback(
    (eventId: string) => {
      router.push(`/events/${eventId}?intro=cinematic`);
    },
    [router],
  );
  const selectedMedia = renderedEvent?.cardMedia;
  const hasCardMedia = Boolean(selectedMedia);
  const hasCardMediaSource = Boolean(
    selectedMedia?.mediaSrc || selectedMedia?.posterSrc,
  );
  const isVideoMedia =
    selectedMedia?.mediaType === 'video' && Boolean(selectedMedia?.mediaSrc);
  const mediaFadeDurationMs = selectedMedia?.mediaFadeDurationMs ?? 1300;
  const mediaDelayMs = selectedMedia?.mediaDelayMs ?? 0;
  const mediaMask = selectedMedia?.mediaMaskProfile
    ? MEDIA_MASKS[selectedMedia.mediaMaskProfile]
    : undefined;
  const cardBaseTheme = renderedEvent
    ? CARD_THEME_BY_CATEGORY[renderedEvent.category]
    : CARD_THEME_BY_CATEGORY.Festivals;
  const cardTheme = blendCardTheme(
    cardBaseTheme,
    renderedEvent?.regionAtmosphere,
  );
  const shouldSimplifyRomeoPeachCard = renderedEvent?.id === 'romeo-peach';
  const cardCue =
    !shouldSimplifyRomeoPeachCard && renderedEvent?.iconType
      ? CARD_CUE_BY_ICON_TYPE[renderedEvent.iconType]
      : null;
  const cardMemoryExcerpt = shouldSimplifyRomeoPeachCard
    ? undefined
    : renderedEvent?.atlasMemories?.[0]?.trim();
  const shouldShowEnterEvent = Boolean(
    renderedEvent?.id === 'romeo-peach' ||
    renderedEvent?.id === 'electric-forest' ||
    renderedEvent?.id === 'goodells-fair' ||
    renderedEvent?.id === 'black-river-tattoo',
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPrefersReducedMotion(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  const handleDepthPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!isDesktop || prefersReducedMotion) return;
      const frame = mapFrameRef.current;
      if (!frame) return;
      const rect = frame.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;
      const nextX = (px - 0.5) * 6;
      const nextY = (py - 0.5) * 4;
      setParallaxOffset({ x: nextX, y: nextY });
    },
    [isDesktop, prefersReducedMotion],
  );

  const handleDepthPointerLeave = useCallback(() => {
    setParallaxOffset({ x: 0, y: 0 });
  }, []);
  const updateCalibrationAnchorPosition = useCallback(
    (anchorName: string, event: PointerEvent<HTMLButtonElement>) => {
      const layer = calibrationLayerRef.current;
      if (!layer) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = layer.getBoundingClientRect();
      const nextMapX = clampPercent(
        ((event.clientX - rect.left) / rect.width) * 100,
      );
      const nextMapY = clampPercent(
        ((event.clientY - rect.top) / rect.height) * 100,
      );

      setCalibrationAnchors((currentAnchors) =>
        currentAnchors.map((anchor) =>
          anchor.name === anchorName
            ? {
                ...anchor,
                mapX: nextMapX,
                mapY: nextMapY,
              }
            : anchor,
        ),
      );
    },
    [],
  );

  const handleCalibrationAnchorDragStart = useCallback(
    (anchorName: string, event: PointerEvent<HTMLButtonElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraggingAnchorName(anchorName);
      setCalibrationCopyStatus(null);
      updateCalibrationAnchorPosition(anchorName, event);
    },
    [updateCalibrationAnchorPosition],
  );

  const handleCalibrationAnchorDragMove = useCallback(
    (anchorName: string, event: PointerEvent<HTMLButtonElement>) => {
      if (draggingAnchorName !== anchorName) return;
      updateCalibrationAnchorPosition(anchorName, event);
    },
    [draggingAnchorName, updateCalibrationAnchorPosition],
  );

  const handleCalibrationAnchorDragEnd = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      setDraggingAnchorName(null);
    },
    [],
  );

  const handleCopyCalibrationJson = useCallback(async () => {
    if (calibrationCopyStatusTimerRef.current) {
      clearTimeout(calibrationCopyStatusTimerRef.current);
      calibrationCopyStatusTimerRef.current = null;
    }

    const calibrationJson = formatCalibrationJson(calibrationAnchors);

    try {
      await copyTextToClipboard(calibrationJson);
      setCalibrationCopyStatus('Copied updated anchor array.');
    } catch {
      setCalibrationCopyStatus(
        'Copy failed. Select and copy from console fallback unavailable.',
      );
    }

    calibrationCopyStatusTimerRef.current = setTimeout(() => {
      setCalibrationCopyStatus(null);
      calibrationCopyStatusTimerRef.current = null;
    }, 2400);
  }, [calibrationAnchors]);

  const handleResetCalibrationAnchors = useCallback(() => {
    setDraggingAnchorName(null);
    setCalibrationAnchors(createCalibrationAnchors());
    setCalibrationCopyStatus('Anchors reset to saved defaults.');

    if (calibrationCopyStatusTimerRef.current) {
      clearTimeout(calibrationCopyStatusTimerRef.current);
    }

    calibrationCopyStatusTimerRef.current = setTimeout(() => {
      setCalibrationCopyStatus(null);
      calibrationCopyStatusTimerRef.current = null;
    }, 2400);
  }, []);

  const handleBackdropPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (!selectedId && !selectedClusterId) return;

    const target = event.target as Node;
    if (cardRef.current?.contains(target)) return;
    if (mapFrameRef.current?.contains(target)) {
      setSelectedId(null);
      setSelectedClusterId(null);
    }
  };

  useEffect(() => {
    let isCurrentSelection = true;

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
      queueMicrotask(() => {
        if (!isCurrentSelection) return;
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
      });
      return () => {
        isCurrentSelection = false;
      };
    }

    queueMicrotask(() => {
      if (!isCurrentSelection) return;
      setCardEnterOffset(36);
      setIsCardVisible(false);
      closeTimerRef.current = setTimeout(() => {
        setRenderedEvent(null);
        closeTimerRef.current = null;
      }, 260);
    });

    return () => {
      isCurrentSelection = false;
    };
  }, [selected]);

  useEffect(() => {
    let isCurrentMedia = true;

    if (cardMediaFadeTimerRef.current) {
      clearTimeout(cardMediaFadeTimerRef.current);
      cardMediaFadeTimerRef.current = null;
    }

    queueMicrotask(() => {
      if (!isCurrentMedia) return;
      setIsCardMediaVisible(false);
      const selectedEvent = ATLAS_EVENTS.find(
        (event) => event.id === selectedId,
      );
      if (!selectedEvent?.cardMedia?.mediaSrc) return;
      setCardMediaVideoKey((prev) => prev + 1);
      setShowCardMediaVideoFallback(false);
    });

    return () => {
      isCurrentMedia = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!hasCardMedia || !isCardVisible) return;
    cardMediaFadeTimerRef.current = setTimeout(() => {
      setIsCardMediaVisible(true);
      cardMediaFadeTimerRef.current = null;
    }, mediaDelayMs);
  }, [hasCardMedia, isCardVisible, mediaDelayMs]);

  useEffect(() => {
    if (!isVideoMedia || !isCardVisible || !isCardMediaVisible) return;
    const video = cardMediaVideoRef.current;
    if (!video) return;
    const playbackStartTimer = setTimeout(() => {
      video.currentTime = 0;
      video.play().catch(() => {
        setShowCardMediaVideoFallback(true);
      });
    }, DEFAULT_MEDIA_PLAY_START_OFFSET_MS);

    return () => {
      clearTimeout(playbackStartTimer);
    };
  }, [isVideoMedia, isCardVisible, isCardMediaVisible, cardMediaVideoKey]);

  const runDiscoverySearch = useCallback((searchText: string) => {
    const trimmedQuery = searchText.trim();
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
        ? `Showing ${nextHighlightedIds.size} ${nextHighlightedIds.size === 1 ? 'discovery' : 'discoveries'} for “${trimmedQuery}”`
        : `No discoveries found for “${trimmedQuery}”`,
    );
    setQuery(trimmedQuery);
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
  }, []);

  const submitSearch = useCallback(() => {
    runDiscoverySearch(query);
  }, [query, runDiscoverySearch]);

  const handleDiscoveryShortcutSelect = useCallback(
    (shortcut: string) => {
      runDiscoverySearch(shortcut);
    },
    [runDiscoverySearch],
  );

  useEffect(() => {
    if (initialEventParamHandledRef.current) return;
    const requestedEventId = searchParams.get('event');
    initialEventParamHandledRef.current = true;
    if (!requestedEventId) return;

    const matchingEvent = ATLAS_EVENTS.find(
      (event) => event.id === requestedEventId,
    );
    if (!matchingEvent) return;

    queueMicrotask(() => {
      setSelectedId(matchingEvent.id);
    });
  }, [searchParams]);

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
    const desktopQuery = window.matchMedia('(min-width: 1024px)');
    const syncDesktopState = () => setIsDesktop(desktopQuery.matches);
    syncDesktopState();
    desktopQuery.addEventListener('change', syncDesktopState);

    return () => {
      desktopQuery.removeEventListener('change', syncDesktopState);
    };
  }, []);

  useEffect(() => {
    const phoneLandscapeQuery = window.matchMedia(PHONE_LANDSCAPE_QUERY);
    const syncPhoneLandscapeState = () =>
      setIsPhoneLandscape(phoneLandscapeQuery.matches);
    syncPhoneLandscapeState();
    phoneLandscapeQuery.addEventListener('change', syncPhoneLandscapeState);

    return () => {
      phoneLandscapeQuery.removeEventListener(
        'change',
        syncPhoneLandscapeState,
      );
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.add(HOME_DISCOVERY_SCROLL_CLASS);
    document.body.classList.add(HOME_DISCOVERY_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(HOME_DISCOVERY_SCROLL_CLASS);
      document.body.classList.remove(HOME_DISCOVERY_SCROLL_CLASS);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle(
      HOME_PHONE_LANDSCAPE_SCROLL_CLASS,
      isPhoneLandscape,
    );
    document.body.classList.toggle(
      HOME_PHONE_LANDSCAPE_SCROLL_CLASS,
      isPhoneLandscape,
    );

    return () => {
      document.documentElement.classList.remove(
        HOME_PHONE_LANDSCAPE_SCROLL_CLASS,
      );
      document.body.classList.remove(HOME_PHONE_LANDSCAPE_SCROLL_CLASS);
    };
  }, [isPhoneLandscape]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      if (queryFadeTimerRef.current) clearTimeout(queryFadeTimerRef.current);
      if (cardMediaFadeTimerRef.current)
        clearTimeout(cardMediaFadeTimerRef.current);
      if (calibrationCopyStatusTimerRef.current)
        clearTimeout(calibrationCopyStatusTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      if (enterFrameInnerRef.current)
        cancelAnimationFrame(enterFrameInnerRef.current);
    };
  }, []);

  return (
    <section
      className={`atlas-hero ${
        isPhoneLandscape ? 'atlas-hero--phone-landscape' : ''
      }`}
      style={styles.hero}
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        ref={mapFrameRef}
        className={`atlas-map-frame ${
          isPhoneLandscape ? 'atlas-map-frame--phone-landscape' : ''
        }`}
        style={{
          ...styles.mapFrame,
          ...(isDesktop && !isVerificationMode ? styles.mapFrameDesktop : null),
        }}
        onPointerMove={handleDepthPointerMove}
        onPointerLeave={handleDepthPointerLeave}
      >
        <div
          style={{
            ...styles.atmosphereMapContent,
            transform: `translate3d(${prefersReducedMotion ? 0 : parallaxOffset.x * 0.55}px, ${prefersReducedMotion ? 0 : parallaxOffset.y * 0.55}px, 0) scale(${BASE_SCALE})`,
          }}
        >
          <img
            src="/maps/michigan-atlas-base.webp"
            alt=""
            aria-hidden
            draggable={false}
            style={styles.atmosphereMapImage}
          />
        </div>

        <div
          style={{
            ...styles.mapContent,
            transform: `translate3d(${prefersReducedMotion ? 0 : parallaxOffset.x * 0.55}px, ${prefersReducedMotion ? 0 : parallaxOffset.y * 0.55}px, 0) scale(${BASE_SCALE})`,
          }}
        >
          <img
            src="/maps/michigan-atlas-base.webp"
            alt="Michigan Atlas"
            draggable={false}
            style={styles.mapImage}
          />

          <div
            style={{
              ...styles.baseMapGrade,
              transform: `translate3d(${prefersReducedMotion ? 0 : parallaxOffset.x * 0.28}px, ${prefersReducedMotion ? 0 : parallaxOffset.y * 0.28}px, 0)`,
            }}
          />

          {!shouldShowCalibration && !isVerificationMode ? (
            <>
              <AtmosphereLayer
                events={ATLAS_EVENTS}
                selectedEvent={selected}
                depthOffsetX={parallaxOffset.x}
                depthOffsetY={parallaxOffset.y}
                prefersReducedMotion={prefersReducedMotion}
              />

              <div
                aria-hidden
                style={{
                  ...styles.particleDepthVeil,
                  transform: `translate3d(${prefersReducedMotion ? 0 : parallaxOffset.x * 0.9}px, ${prefersReducedMotion ? 0 : parallaxOffset.y * 0.9}px, 0)`,
                }}
              />
            </>
          ) : null}

          {shouldShowCalibration ? (
            <AtlasCalibrationLayer
              anchors={calibrationAnchors}
              draggingAnchorName={draggingAnchorName}
              onAnchorDragStart={handleCalibrationAnchorDragStart}
              onAnchorDragMove={handleCalibrationAnchorDragMove}
              onAnchorDragEnd={handleCalibrationAnchorDragEnd}
              layerRef={calibrationLayerRef}
            />
          ) : null}

          {!shouldShowCalibration ? (
            <div style={styles.markerOverlayLayer}>
              {(isVerificationMode
                ? markerLayouts.map((layout) => ({
                    id: `verification-${layout.event.id}`,
                    events: [layout.event],
                    eventIndices: [layout.eventIndex],
                    position: layout.position,
                  }))
                : markerClusters
              ).map(({ id, events, eventIndices, position }) => {
                const primaryEvent = events[0];
                const isCluster = events.length > 1;
                const clusterHighlightedCount = events.filter((event) =>
                  highlightedIds.has(event.id),
                ).length;
                const isHighlighted = clusterHighlightedCount > 0;
                const isSelected = selectedId
                  ? events.some((event) => event.id === selectedId)
                  : selectedClusterId === id;
                const isDimmed = highlightedIds.size > 0 && !isHighlighted;
                const isSearchActive = highlightedIds.size > 0;
                const isFeaturedMarker =
                  !isSearchActive &&
                  events.some((event) => featuredEvent.id === event.id);
                const firstEventIndex = Math.min(...eventIndices);
                const pulseDuration = 2.4 + (firstEventIndex % 3) * 0.35;
                const pulseDelay = firstEventIndex * 0.26;
                const markerLayerLift = isSelected
                  ? 30
                  : isHighlighted
                    ? 20
                    : isCluster
                      ? 10
                      : 0;
                const markerScaleBase = isCluster
                  ? Math.min(1.65, 1.16 + events.length * 0.09)
                  : isHighlighted
                    ? 1.45
                    : isSelected
                      ? 1.25
                      : isFeaturedMarker
                        ? 1.08
                        : 1;
                return (
                  <div
                    key={id}
                    style={{
                      ...styles.markerWrap,
                      left: `${position.x}%`,
                      top: `${position.y}%`,
                      zIndex:
                        Z_INDEX.markers + markerLayerLift + firstEventIndex,
                    }}
                  >
                    <div style={styles.markerScaleCompensation}>
                      {isVerificationMode ? (
                        <>
                          <span
                            aria-hidden="true"
                            style={styles.verificationMarker}
                          />
                          <span style={styles.verificationMarkerLabel}>
                            {primaryEvent.name}
                            <br />
                            projected {position.x.toFixed(1)}, {position.y.toFixed(1)}
                          </span>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label={
                              isCluster
                                ? `Open ${events.length} events near ${primaryEvent.location}`
                                : primaryEvent.name
                            }
                            onClick={() => {
                              if (isCluster) {
                                setSelectedId(null);
                                setSelectedClusterId(id);
                                return;
                              }

                              setSelectedClusterId(null);
                              setSelectedId(primaryEvent.id);
                            }}
                            style={{
                              ...styles.markerTapTarget,
                              ...(isCluster ? styles.clusterTapTarget : null),
                              opacity: isDimmed ? 0.28 : 1,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="marker-pulse"
                              style={
                                {
                                  ...(isCluster
                                    ? styles.clusterMarker
                                    : styles.marker),
                                  '--marker-scale-base': markerScaleBase,
                                  '--marker-shadow-idle': isCluster
                                    ? isHighlighted
                                      ? '0 0 16px rgba(255,242,204,.76), 0 0 38px rgba(250,196,91,.58), 0 0 76px rgba(205,128,39,.34), 0 0 112px rgba(143,79,29,.18)'
                                      : isSelected
                                        ? '0 0 15px rgba(255,236,190,.72), 0 0 36px rgba(248,186,79,.54), 0 0 70px rgba(199,122,36,.32), 0 0 104px rgba(139,76,29,.16)'
                                        : '0 0 12px rgba(255,224,166,.5), 0 0 30px rgba(235,165,63,.35), 0 0 62px rgba(180,103,36,.23), 0 0 92px rgba(122,68,28,.13)'
                                    : isHighlighted
                                      ? '0 0 10px rgba(255,247,218,.94), 0 0 24px rgba(251,200,96,.82), 0 0 36px rgba(213,134,45,.36)'
                                      : isSelected
                                        ? '0 0 9px rgba(255,239,196,.9), 0 0 22px rgba(248,190,88,.76), 0 0 32px rgba(202,122,40,.34)'
                                        : isFeaturedMarker
                                          ? '0 0 8px rgba(255,232,178,.82), 0 0 18px rgba(244,179,76,.58), 0 0 27px rgba(178,103,40,.24)'
                                          : '0 0 6px rgba(255,224,166,.66), 0 0 14px rgba(235,158,62,.42), 0 0 21px rgba(164,91,36,.18)',
                                  '--marker-shadow-peak': isCluster
                                    ? isHighlighted
                                      ? '0 0 20px rgba(255,247,219,.84), 0 0 48px rgba(255,207,106,.66), 0 0 92px rgba(217,140,45,.4), 0 0 132px rgba(145,81,30,.2)'
                                      : isSelected
                                        ? '0 0 19px rgba(255,241,207,.8), 0 0 46px rgba(252,197,92,.62), 0 0 86px rgba(207,129,41,.37), 0 0 124px rgba(141,78,29,.18)'
                                        : '0 0 15px rgba(255,232,184,.58), 0 0 38px rgba(242,178,77,.42), 0 0 74px rgba(186,111,40,.27), 0 0 108px rgba(128,72,29,.15)'
                                    : isHighlighted
                                      ? '0 0 13px rgba(255,251,232,.98), 0 0 30px rgba(255,210,112,.9), 0 0 44px rgba(223,146,48,.42)'
                                      : isSelected
                                        ? '0 0 12px rgba(255,246,220,.94), 0 0 28px rgba(253,201,100,.84), 0 0 40px rgba(211,132,44,.4)'
                                        : isFeaturedMarker
                                          ? '0 0 10px rgba(255,239,202,.9), 0 0 24px rgba(250,196,94,.72), 0 0 34px rgba(196,120,42,.3)'
                                          : '0 0 8px rgba(255,233,184,.76), 0 0 19px rgba(242,178,78,.52), 0 0 29px rgba(177,103,39,.22)',
                                  animationDuration: `${pulseDuration}s`,
                                  animationDelay: `${pulseDelay}s`,
                                } as CSSProperties
                              }
                            />
                            {SHOW_CLUSTER_LABELS && isCluster ? (
                              <span style={styles.clusterCount}>
                                {events.length}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            aria-label={
                              isCluster
                                ? `Open ${events.length} nearby celebrations`
                                : `Open ${primaryEvent.name}`
                            }
                            onClick={() => {
                              if (isCluster) {
                                setSelectedId(null);
                                setSelectedClusterId(id);
                                return;
                              }

                              setSelectedClusterId(null);
                              setSelectedId(primaryEvent.id);
                            }}
                            style={{
                              ...styles.markerLabel,
                              ...(isCluster ? styles.clusterLabel : null),
                              opacity: !isCluster && isHighlighted ? 1 : 0,
                              transform:
                                !isCluster && isHighlighted
                                  ? 'translate(-50%, -122%)'
                                  : 'translate(-50%, -116%)',
                              pointerEvents:
                                !isCluster && isHighlighted ? 'auto' : 'none',
                            }}
                          >
                            {isCluster
                              ? `${events.length} celebrations`
                              : primaryEvent.name}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          {isVerificationMode ? <VerificationReferenceLayer /> : null}

          <div style={styles.vignette} />
        </div>
      </div>

      {shouldShowCalibration ? (
        <AtlasCalibrationPanel
          anchors={calibrationAnchors}
          copyStatus={calibrationCopyStatus}
          onCopy={handleCopyCalibrationJson}
          onReset={handleResetCalibrationAnchors}
        />
      ) : null}

      {!shouldShowCalibration && !isVerificationMode && isDesktop ? (
        <aside
          style={styles.desktopIntroPanel}
          aria-label="Atlas desktop introduction"
        >
          <p style={styles.desktopKicker}>Atlas Preview</p>
          <h1 style={styles.desktopTitle}>
            A cinematic entry to Michigan&apos;s celebration atlas.
          </h1>
          <p style={styles.desktopBody}>
            Explore the map&apos;s pulse on mobile, and use this desktop landing
            view as a calm overview before diving into each event story.
          </p>
          <p style={styles.desktopHint}>
            Select a glowing marker, or open a constellation to choose nearby
            events.
          </p>
        </aside>
      ) : null}

      {!shouldShowCalibration && !isVerificationMode && selectedCluster ? (
        <aside
          className="atlas-cluster-panel"
          style={{
            ...styles.clusterPanel,
            ...(isDesktop ? styles.clusterPanelDesktop : null),
          }}
          aria-label="Nearby celebrations"
        >
          <button
            type="button"
            aria-label="Close event cluster"
            onClick={() => setSelectedClusterId(null)}
            style={styles.closeButton}
          >
            ×
          </button>
          <p style={styles.clusterPanelKicker}>Atlas constellation</p>
          <h2 style={styles.clusterPanelTitle}>
            {selectedCluster.events.length} celebrations nearby
          </h2>
          <div style={styles.clusterEventList}>
            {selectedCluster.events.map((event) => (
              <button
                key={event.id}
                type="button"
                style={styles.clusterEventButton}
                onClick={() => {
                  setSelectedClusterId(null);
                  setSelectedId(event.id);
                }}
              >
                <span style={styles.clusterEventName}>{event.name}</span>
                <span style={styles.clusterEventMeta}>
                  {event.location} · {event.category}
                </span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {!shouldShowCalibration && !isVerificationMode && renderedEvent ? (
        <article
          ref={cardRef}
          className="atlas-card"
          style={{
            ...styles.card,
            borderColor: cardTheme.edge,
            boxShadow: `inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px ${cardTheme.glow}, 0 16px 36px rgba(0,0,0,.32)`,
            background: `linear-gradient(160deg, rgba(16,21,30,.34), rgba(9,12,18,.2) 58%, rgba(7,10,15,.3)), radial-gradient(circle at 82% 12%, ${cardTheme.wash}, rgba(7,10,15,0) 52%)`,
            opacity: isCardVisible ? 1 : 0,
            transform: isCardVisible
              ? 'translateY(0)'
              : `translateY(${cardEnterOffset}px)`,
            pointerEvents: isCardVisible ? 'auto' : 'none',
            transition: isCardVisible
              ? 'opacity 360ms ease, transform 360ms ease'
              : 'opacity 260ms ease, transform 260ms ease',
          }}
        >
          <button
            type="button"
            aria-label="Close event card"
            onClick={() => setSelectedId(null)}
            style={styles.closeButton}
          >
            ×
          </button>
          <h3 style={styles.cardTitle}>{renderedEvent.name}</h3>
          {hasCardMedia && hasCardMediaSource ? (
            <div
              style={{
                ...styles.cardMediaWrap,
                opacity: isCardMediaVisible ? 1 : 0,
                transitionDuration: `${mediaFadeDurationMs}ms`,
                maskImage: mediaMask,
                WebkitMaskImage: mediaMask,
              }}
              aria-hidden="true"
            >
              {isVideoMedia ? (
                <video
                  key={cardMediaVideoKey}
                  ref={cardMediaVideoRef}
                  style={{
                    ...styles.cardMediaLayer,
                    opacity: showCardMediaVideoFallback ? 0 : 1,
                    objectPosition:
                      selectedMedia?.mediaPosition ??
                      styles.cardMediaLayer.objectPosition,
                    transform: `scale(${selectedMedia?.mediaScale ?? 1})`,
                  }}
                  src={selectedMedia?.mediaSrc}
                  poster={selectedMedia?.posterSrc || undefined}
                  muted
                  playsInline
                  controls={false}
                  preload="metadata"
                  onEnded={(event) => {
                    const element = event.currentTarget;
                    element.pause();
                    if (
                      Number.isFinite(element.duration) &&
                      element.duration > 0
                    ) {
                      element.currentTime = element.duration;
                    }
                  }}
                  onError={() => setShowCardMediaVideoFallback(true)}
                />
              ) : null}
              <img
                src={selectedMedia?.posterSrc ?? selectedMedia?.mediaSrc}
                alt=""
                style={{
                  ...styles.cardMediaLayer,
                  opacity: isVideoMedia
                    ? showCardMediaVideoFallback
                      ? 1
                      : 0
                    : 1,
                  objectPosition:
                    selectedMedia?.mediaPosition ??
                    styles.cardMediaLayer.objectPosition,
                  transform: `scale(${selectedMedia?.mediaScale ?? 1})`,
                }}
              />
            </div>
          ) : null}
          <p style={styles.cardLocation}>{renderedEvent.location}</p>
          {renderedEvent.cardTag ? (
            <p style={styles.cardCategoryTag}>{renderedEvent.cardTag}</p>
          ) : null}
          {cardCue ? (
            <p
              style={styles.cardIconCue}
            >{`${cardCue.sigil} ${cardCue.label}`}</p>
          ) : null}
          <p style={styles.cardAtmosphere}>
            {selectedMedia?.atmosphereTitle ?? renderedEvent.atmosphereLabel}
          </p>
          {cardMemoryExcerpt ? (
            <p style={styles.cardMemoryExcerpt}>
              Field note: {cardMemoryExcerpt}
            </p>
          ) : null}
          <p style={styles.cardBody}>{renderedEvent.blurb}</p>
          {shouldShowEnterEvent ? (
            renderedEvent.id === 'electric-forest' ? (
              <button
                type="button"
                style={styles.enterEventButton}
                onClick={() => startElectricForestTransition(renderedEvent.id)}
              >
                Enter Event
              </button>
            ) : (
              <Link
                href={`/events/${renderedEvent.id}`}
                style={styles.enterEventLink}
              >
                Enter Event
              </Link>
            )
          ) : null}
          <span
            style={{
              ...styles.cardAtmosphereOrb,
              boxShadow: `0 0 26px ${cardTheme.glow}, 0 0 50px ${cardTheme.wash}`,
            }}
            aria-hidden="true"
          />
        </article>
      ) : null}

      {!shouldShowCalibration && !isVerificationMode ? (
        <>
          <div
            className="atlas-search-dock"
            style={{
              ...styles.searchDock,
              ...(isDesktop ? styles.searchDockDesktop : null),
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedClusterId(null);
                setSelectedId(featuredEvent.id);
              }}
              style={styles.featuredDiscovery}
              aria-label={`Open featured discovery: ${featuredEvent.name}`}
            >
              <span key={featuredEvent.id} className="featured-discovery-text">
                Featured: {featuredEvent.name}
              </span>
            </button>
            <HomeDiscoveryLayer
              query={submittedQuery}
              resultCount={highlightedIds.size}
              statusText={discoveryStatusText ?? undefined}
              results={discoveryResultRows}
              shortcutGroups={HOME_DISCOVERY_SHORTCUT_GROUPS}
              onShortcutSelect={handleDiscoveryShortcutSelect}
            />
            <div style={styles.searchInputWrap}>
              <span style={styles.searchPrefix} aria-hidden="true">
                Search:
              </span>
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
                placeholder={
                  !query.trim() && !displayedQuery && !isSearchFocused
                    ? ATMOSPHERIC_SUGGESTIONS[suggestionIndex]
                    : ''
                }
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
              animation: featuredDiscoverySwap 1200ms
                cubic-bezier(0.22, 0.61, 0.36, 1);
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
                box-shadow:
                  inset 0 0 0 1px rgba(255, 244, 214, 0.06),
                  0 0 14px rgba(252, 201, 102, 0.28);
                filter: brightness(1);
              }
              45% {
                box-shadow:
                  inset 0 0 0 1px rgba(255, 246, 220, 0.16),
                  0 0 20px rgba(255, 220, 142, 0.44);
                filter: brightness(1.03);
              }
              100% {
                box-shadow:
                  inset 0 0 0 1px rgba(255, 244, 214, 0.06),
                  0 0 14px rgba(252, 201, 102, 0.28);
                filter: brightness(1);
              }
            }

            @media (prefers-reduced-motion: reduce) {
              .marker-pulse,
              .featured-discovery-text,
              .atlas-search-input--pulse,
              .atlas-search-query,
              .cinematic-intro-overlay,
              .cinematic-intro-video {
                animation: none !important;
                transition-duration: 1ms !important;
              }
            }

            @keyframes markerPulse {
              0%,
              100% {
                transform: translate(-50%, -50%)
                  scale(var(--marker-scale-base, 1));
                box-shadow: var(--marker-shadow-idle);
                filter: brightness(1) saturate(1);
              }
              50% {
                transform: translate(-50%, -50%)
                  scale(calc(var(--marker-scale-base, 1) * 1.18));
                box-shadow: var(--marker-shadow-peak);
                filter: brightness(1.07) saturate(1.08);
              }
            }
          `}</style>
        </>
      ) : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  hero: {
    position: 'relative',
    width: '100vw',
    minHeight: '100dvh',
    overflow: 'hidden',
    touchAction: 'pan-y pinch-zoom',
    overscrollBehavior: 'auto',
    background: 'radial-gradient(circle at 50% 15%, #172233, #05070c 70%)',
    color: '#f5e8c7',
  },
  mapFrame: {
    position: 'absolute',
    inset: 0,
    overflow: 'hidden',
    contain: 'layout paint size',
  },
  mapFrameDesktop: {
    inset: '8vh auto 13vh 6vw',
    width: 'min(62vw, 980px)',
    borderRadius: 30,
    border: '1px solid rgba(255, 227, 170, 0.24)',
    boxShadow:
      '0 24px 90px rgba(0, 0, 0, 0.56), inset 0 0 0 1px rgba(255, 241, 210, 0.06)',
  },
  mapContent: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    transformOrigin: 'center center',
    transition:
      'filter 260ms ease, transform 520ms cubic-bezier(.22,.61,.36,1)',
    touchAction: 'pan-y pinch-zoom',
    filter: 'saturate(0.74) brightness(0.62) contrast(1.08)',
  },
  atmosphereMapContent: {
    position: 'absolute',
    inset: '-6% -10%',
    transformOrigin: 'center center',
    filter: 'saturate(0.8) brightness(0.4) contrast(1.08)',
    pointerEvents: 'none',
  },
  atmosphereMapImage: {
    position: 'relative',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    opacity: 0.72,
    filter: 'blur(10px)',
    transform: 'scale(1.1)',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    pointerEvents: 'none',
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
    pointerEvents: 'none',
  },


  baseMapGrade: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX.depthVeil,
    pointerEvents: 'none',
    background:
      'linear-gradient(180deg, rgba(9,12,18,.05), rgba(9,12,18,.11) 68%, rgba(9,12,18,.19)), radial-gradient(circle at 52% 40%, rgba(255,232,186,.04), rgba(255,232,186,0) 58%)',
    mixBlendMode: 'screen',
    transition: 'transform 520ms cubic-bezier(.22,.61,.36,1)',
    willChange: 'transform',
  },
  particleDepthVeil: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX.particles,
    pointerEvents: 'none',
    background:
      'radial-gradient(circle at 18% 28%, rgba(255,248,228,.055), rgba(255,248,228,0) 36%), radial-gradient(circle at 74% 42%, rgba(236,221,188,.04), rgba(236,221,188,0) 30%), radial-gradient(circle at 45% 76%, rgba(255,236,188,.03), rgba(255,236,188,0) 34%)',
    filter: 'blur(.2px)',
    transition: 'transform 600ms cubic-bezier(.22,.61,.36,1)',
    willChange: 'transform',
  },
  vignette: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 42%, rgba(7,10,16,0) 34%, rgba(4,6,10,.44) 68%, rgba(3,5,8,.78) 100%), linear-gradient(to bottom, rgba(3,4,7,.44), rgba(3,4,7,.72) 64%, rgba(2,3,6,.94))',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  calibrationLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX.calibration,
    pointerEvents: 'none',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  calibrationAnchor: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
  },
  calibrationAnchorDot: {
    position: 'absolute',
    left: -8,
    top: -8,
    width: 16,
    height: 16,
    padding: 0,
    borderRadius: 999,
    background: '#67e8f9',
    border: '1px solid rgba(255, 255, 255, 0.86)',
    boxShadow: '0 0 12px rgba(103, 232, 249, 0.9)',
    pointerEvents: 'auto',
    cursor: 'grab',
    touchAction: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
  },
  calibrationAnchorDotDragging: {
    background: '#fef08a',
    boxShadow:
      '0 0 16px rgba(254, 240, 138, 0.95), 0 0 28px rgba(103, 232, 249, 0.72)',
    cursor: 'grabbing',
    transform: 'scale(1.18)',
  },
  calibrationPanel: {
    position: 'fixed',
    right: 12,
    bottom: 'calc(12px + env(safe-area-inset-bottom))',
    zIndex: 30,
    width: 'min(300px, calc(100vw - 24px))',
    padding: '8px 10px',
    borderRadius: 14,
    border: '1px solid rgba(103, 232, 249, 0.46)',
    background:
      'linear-gradient(180deg, rgba(7, 19, 28, 0.86), rgba(4, 10, 18, 0.76))',
    boxShadow:
      '0 10px 26px rgba(0, 0, 0, 0.34), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    fontFamily:
      'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  },
  calibrationPanelSummary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    cursor: 'pointer',
    listStyle: 'none',
  },
  calibrationPanelKicker: {
    color: '#dffbff',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  calibrationPanelSummaryHint: {
    color: '#a5f3fc',
    fontSize: 10,
    fontWeight: 800,
  },
  calibrationPanelBody: {
    margin: '8px 0 10px',
    color: '#a5f3fc',
    fontSize: 10,
    lineHeight: 1.35,
  },
  calibrationPanelActions: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 8,
  },
  calibrationCopyButton: {
    width: '100%',
    minHeight: 34,
    borderRadius: 10,
    border: '1px solid rgba(254, 240, 138, 0.62)',
    background:
      'linear-gradient(180deg, rgba(254, 240, 138, 0.22), rgba(103, 232, 249, 0.12))',
    color: '#fff7cc',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  calibrationResetButton: {
    width: '100%',
    minHeight: 34,
    borderRadius: 10,
    border: '1px solid rgba(103, 232, 249, 0.58)',
    background:
      'linear-gradient(180deg, rgba(103, 232, 249, 0.18), rgba(125, 211, 252, 0.08))',
    color: '#dffbff',
    fontSize: 12,
    fontWeight: 900,
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  calibrationCopyStatus: {
    margin: '8px 0 0',
    color: '#fef08a',
    fontSize: 10,
    lineHeight: 1.25,
  },
  clusterPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 120,
    padding: '14px 14px 16px',
    borderRadius: 18,
    border: '1px solid rgba(255,225,160,.4)',
    background:
      'linear-gradient(160deg, rgba(16,21,30,.58), rgba(9,12,18,.34) 58%, rgba(7,10,15,.46))',
    boxShadow:
      'inset 0 0 0 1px rgba(255,241,203,.08), 0 0 20px rgba(252,201,102,.22), 0 16px 36px rgba(0,0,0,.34)',
    backdropFilter: 'blur(5px) saturate(1.08)',
    WebkitBackdropFilter: 'blur(5px) saturate(1.08)',
    zIndex: Z_INDEX.card,
    overflow: 'hidden',
  },
  clusterPanelDesktop: {
    left: '6vw',
    right: 'auto',
    width: 'min(42vw, 580px)',
    bottom: '18vh',
  },
  clusterPanelKicker: {
    margin: '0 40px 6px 0',
    color: 'rgba(255,232,188,.68)',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  clusterPanelTitle: {
    margin: '0 40px 12px 0',
    color: '#ffebb9',
    fontSize: 21,
    lineHeight: 1.1,
    textShadow: '0 1px 3px rgba(2,3,6,.9), 0 0 14px rgba(255,229,173,.24)',
  },
  clusterEventList: {
    display: 'grid',
    gap: 8,
  },
  clusterEventButton: {
    display: 'grid',
    gap: 3,
    width: '100%',
    padding: '10px 12px',
    borderRadius: 14,
    border: '1px solid rgba(255, 227, 170, 0.22)',
    background:
      'linear-gradient(180deg, rgba(255,232,186,.09), rgba(7,10,15,.18))',
    color: '#f5e8c7',
    textAlign: 'left',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
  clusterEventName: {
    fontSize: 14,
    fontWeight: 800,
    color: '#ffebb9',
  },
  clusterEventMeta: {
    fontSize: 11,
    letterSpacing: 0.42,
    color: 'rgba(255,238,203,.7)',
    textTransform: 'uppercase',
  },
  markerOverlayLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX.markers,
    pointerEvents: 'none',
    transformOrigin: 'center center',
  },
  verificationReferenceLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX.calibration,
    pointerEvents: 'none',
  },
  verificationReferenceWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
    pointerEvents: 'none',
  },
  verificationReferencePoint: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 18,
    height: 18,
    borderRadius: 999,
    border: '2px solid rgba(67, 214, 255, 0.95)',
    transform: 'translate(-50%, -50%)',
    boxShadow: '0 0 0 2px rgba(2, 6, 12, 0.7), 0 0 14px rgba(67, 214, 255, 0.8)',
    background: 'rgba(67, 214, 255, 0.12)',
  },
  verificationReferenceLabel: {
    position: 'absolute',
    left: 12,
    top: 8,
    minWidth: 106,
    padding: '4px 7px',
    borderRadius: 8,
    border: '1px solid rgba(67, 214, 255, 0.5)',
    background: 'rgba(3, 10, 18, 0.72)',
    color: 'rgba(205, 246, 255, 0.96)',
    fontSize: 10,
    lineHeight: 1.22,
    fontWeight: 800,
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.8)',
    whiteSpace: 'nowrap',
  },
  markerScaleCompensation: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 1,
    height: 1,
    pointerEvents: 'none',
    transformOrigin: 'center center',
  },
  markerTapTarget: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 44,
    height: 44,
    padding: 0,
    border: 'none',
    borderRadius: 999,
    background: 'transparent',
    zIndex: Z_INDEX.markers,
    pointerEvents: 'auto',
    cursor: 'pointer',
    touchAction: 'manipulation',
    appearance: 'none',
    WebkitAppearance: 'none',
    transform: 'translate(-50%, -50%)',
  },
  clusterTapTarget: {
    width: 54,
    height: 54,
  },
  marker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 20,
    height: 20,
    borderRadius: 999,
    border: '1px solid rgba(255,231,178,.78)',
    background:
      'radial-gradient(circle at 42% 36%, rgba(255,253,226,.98) 0 9%, rgba(255,238,184,.96) 16%, rgba(244,190,82,.82) 46%, rgba(218,133,42,.34) 72%, rgba(142,76,31,.08) 100%)',
    zIndex: Z_INDEX.markers,
    pointerEvents: 'none',
  },
  clusterMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 28,
    height: 28,
    borderRadius: 999,
    border: '1px solid rgba(255,226,170,.62)',
    background:
      'radial-gradient(circle at 35% 32%, rgba(255,244,199,.96) 0 6%, rgba(255,217,139,.82) 13%, rgba(245,177,70,.48) 32%, rgba(214,126,43,.22) 56%, rgba(133,77,36,.08) 100%), radial-gradient(circle at 64% 42%, rgba(255,241,190,.74) 0 4%, rgba(241,170,68,.28) 9%, rgba(241,170,68,0) 18%), radial-gradient(circle at 48% 68%, rgba(255,226,161,.62) 0 3%, rgba(218,132,47,.22) 8%, rgba(218,132,47,0) 17%), radial-gradient(circle at 72% 68%, rgba(255,224,158,.5) 0 2.5%, rgba(226,146,54,.18) 7%, rgba(226,146,54,0) 15%)',
    zIndex: Z_INDEX.markers,
    pointerEvents: 'none',
  },
  clusterCount: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    color: '#141018',
    fontSize: 11,
    fontWeight: 900,
    lineHeight: 1,
    textShadow: '0 1px 0 rgba(255,255,255,.4)',
    zIndex: Z_INDEX.markers + 1,
    pointerEvents: 'none',
  },
  markerWrap: {
    position: 'absolute',
    width: 1,
    height: 1,
    zIndex: Z_INDEX.markers,
  },
  verificationMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 12,
    height: 12,
    transform: 'translate(-50%, -50%)',
    borderRadius: 999,
    border: '1px solid rgba(255, 250, 230, 0.98)',
    background: '#ff3b30',
    boxShadow:
      '0 0 0 2px rgba(5, 7, 12, 0.76), 0 0 10px rgba(255, 59, 48, 0.85)',
    zIndex: Z_INDEX.markers,
    pointerEvents: 'none',
  },
  verificationMarkerLabel: {
    position: 'absolute',
    left: 10,
    top: -6,
    minWidth: 128,
    padding: '4px 7px',
    borderRadius: 8,
    border: '1px solid rgba(255, 93, 80, 0.58)',
    background: 'rgba(12, 5, 5, 0.78)',
    color: 'rgba(255, 238, 226, 0.98)',
    fontSize: 10,
    lineHeight: 1.24,
    fontWeight: 850,
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.84)',
    whiteSpace: 'nowrap',
    zIndex: Z_INDEX.markers + 2,
    pointerEvents: 'none',
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
    background:
      'linear-gradient(180deg, rgba(18, 25, 37, 0.32), rgba(7, 10, 15, 0.22))',
    textShadow:
      '0 0 8px rgba(255, 224, 153, 0.2), 0 1px 3px rgba(2, 3, 7, 0.74)',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 239, 205, 0.05), 0 0 16px rgba(251, 203, 110, 0.2)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    transition:
      'opacity 380ms ease, transform 420ms cubic-bezier(.22,.61,.36,1)',
    willChange: 'opacity, transform',
    cursor: 'pointer',
    touchAction: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    outline: 'none',
    textAlign: 'center',
  },
  clusterLabel: {
    color: 'rgba(255, 245, 219, 0.94)',
    borderColor: 'rgba(255, 227, 170, 0.34)',
    background:
      'linear-gradient(180deg, rgba(31, 38, 54, 0.46), rgba(7, 10, 15, 0.28))',
  },
  searchDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '12px 14px calc(14px + env(safe-area-inset-bottom))',
    backdropFilter: 'none',
    background: 'transparent',
    zIndex: Z_INDEX.searchDock,
    transition: 'bottom 240ms ease',
  },
  searchDockDesktop: {
    left: '6vw',
    right: 'auto',
    width: 'min(62vw, 980px)',
    padding: '0 0 2.5vh',
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
    boxShadow:
      'inset 0 0 0 1px rgba(255, 240, 205, 0.04), 0 0 10px rgba(252, 201, 102, 0.12)',
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
    boxShadow:
      'inset 0 0 0 1px rgba(255, 244, 214, 0.06), 0 0 14px rgba(252, 201, 102, 0.28)',
    padding: '0 15px',
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
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
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
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 120,
    padding: '14px 14px 16px',
    borderRadius: 18,
    background:
      'linear-gradient(160deg, rgba(16,21,30,.34), rgba(9,12,18,.2) 58%, rgba(7,10,15,.3))',
    border: '1px solid rgba(255,225,160,.4)',
    boxShadow:
      'inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px rgba(252,201,102,.24), 0 16px 36px rgba(0,0,0,.32)',
    backdropFilter: 'blur(4px) saturate(1.05)',
    WebkitBackdropFilter: 'blur(4px) saturate(1.05)',
    zIndex: Z_INDEX.card,
    willChange: 'opacity, transform',
    overflow: 'hidden',
  },
  cardDesktop: {
    left: '6vw',
    right: 'auto',
    width: 'min(56vw, 820px)',
    bottom: '18vh',
  },
  cardMediaWrap: {
    position: 'absolute',
    right: 0,
    top: '6%',
    width: '57%',
    height: '90%',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    overflow: 'hidden',
    opacity: 0,
    transition: 'opacity 1300ms ease',
    maskImage: MEDIA_MASKS.romeoPeach,
    WebkitMaskImage: MEDIA_MASKS.romeoPeach,
    maskComposite: 'intersect',
    WebkitMaskComposite: 'source-in',
    zIndex: 0,
  },
  cardMediaLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: '43% 18%',
    transition: 'opacity 260ms ease',
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
  cardCategoryTag: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    width: 'fit-content',
    margin: '0 0 8px',
    padding: '4px 9px',
    borderRadius: 999,
    border: '1px solid rgba(235, 205, 255, 0.34)',
    background: 'rgba(88, 48, 130, 0.18)',
    color: 'rgba(248, 229, 255, 0.86)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    textShadow: '0 1px 2px rgba(3,4,8,.72)',
  },
  cardIconCue: {
    position: 'relative',
    zIndex: 1,
    margin: '0 0 8px',
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,236,200,.58)',
    textShadow: '0 1px 2px rgba(3,4,8,.72)',
    opacity: 0.82,
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
  cardMemoryExcerpt: {
    position: 'relative',
    zIndex: 1,
    margin: '0 0 8px',
    fontSize: 10,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: 'rgba(216,196,158,.72)',
    lineHeight: 1.45,
    textShadow: '0 1px 2px rgba(2,3,6,.6)',
  },
  enterEventLink: {
    display: 'inline-flex',
    marginTop: '0.55rem',
    color: 'rgba(255, 224, 162, 0.88)',
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(255, 214, 148, 0.45)',
    paddingBottom: '0.1rem',
    opacity: 0.86,
    transition: 'opacity 180ms ease, border-color 180ms ease',
  },
  enterEventButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '10px 16px',
    marginTop: 2,
    borderRadius: 999,
    border: '1px solid rgba(255,230,183,.56)',
    color: 'rgba(255,242,215,.96)',
    background:
      'linear-gradient(180deg, rgba(255,206,124,.26), rgba(255,192,90,.14))',
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: 600,
    textDecoration: 'none',
    boxShadow: '0 0 18px rgba(255,194,104,.24)',
  },

  desktopIntroPanel: {
    position: 'fixed',
    right: '5.4vw',
    top: '15vh',
    width: 'min(31vw, 440px)',
    padding: '22px 24px',
    borderRadius: 22,
    border: '1px solid rgba(255, 226, 171, 0.26)',
    background:
      'linear-gradient(160deg, rgba(18, 24, 34, 0.62), rgba(10, 14, 20, 0.32))',
    boxShadow: '0 20px 48px rgba(0,0,0,.36)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 14,
  },
  desktopKicker: {
    margin: '0 0 10px',
    fontSize: 11,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: 'rgba(255,232,188,.72)',
  },
  desktopTitle: {
    margin: '0 0 12px',
    fontSize: 30,
    lineHeight: 1.15,
    color: '#ffebb9',
  },
  desktopBody: {
    margin: '0 0 12px',
    fontSize: 15,
    lineHeight: 1.45,
    color: 'rgba(243,231,202,.9)',
  },
  desktopHint: {
    margin: 0,
    fontSize: 12,
    letterSpacing: 0.4,
    color: 'rgba(255,230,182,.68)',
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
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
};
