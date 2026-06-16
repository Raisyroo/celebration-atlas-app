'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import type { CSSProperties, PointerEvent, RefObject } from 'react';
import { ATLAS_EVENTS } from '../data/events';
import { deriveSafeAtlasEventCard } from '../data/safeEventCard';
import {
  getEventProfileById,
  searchEventProfiles,
} from '../data/eventProfiles';
import { getEventMarkerPresentation } from '../data/eventMarkerPresentation';
import { resolveExactEventIntent } from '../data/exactEventIntent';
import type { MarkerIntensity } from '../data/eventMarkerPresentation';
import {
  MICHIGAN_MAP_ANCHORS,
  latLngToAtlasPosition,
} from '../data/mapCalibration';
import type { MichiganMapAnchor } from '../data/mapCalibration';
import AtmosphereLayer from './AtmosphereLayer';
import { HomeDiscoveryLayer } from './HomeDiscoveryLayer';
import type { HomeDiscoveryResultRow } from './HomeDiscoveryLayer';

const ATMOSPHERIC_SUGGESTIONS = [
  'Ask for festivals, fireworks, fairs, or Romeo Peach Festival',
];
const MOBILE_ATLAS_COMMAND_PLACEHOLDER = 'Ask about Michigan celebrations';
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
const EXACT_EVENT_CARD_OPEN_DELAY_MS = 280;

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
const MAP_ZOOM_MIN_SCALE = 1;
const MAP_ZOOM_MAX_SCALE = 2.5;
const MAP_PAN_EDGE_FACTOR = 0.5;
const MAP_GESTURE_MOVE_THRESHOLD_PX = 8;
const MAP_DOUBLE_TAP_RESET_MS = 320;

// Layer order contract (low -> high): map art (1), decorative atmosphere
// (3-4 in effects), selected constellation lines (4.5), interactive
// markers (5), optional calibration anchors (6), event card (15),
// search + featured discovery dock (20).
const Z_INDEX = {
  mapImage: 1,
  atmosphere: 3,
  depthVeil: 4,
  particles: 4,
  constellationLines: 4.5,
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

const MARKER_BASE_SHADOWS_BY_INTENSITY: Record<
  MarkerIntensity,
  { idle: string; peak: string }
> = {
  dim: {
    idle:
      '0 0 3px rgba(255,233,184,.58), 0 0 9px rgba(242,178,78,.3), 0 0 18px rgba(177,103,39,.12)',
    peak:
      '0 0 4px rgba(255,238,197,.66), 0 0 12px rgba(248,190,88,.4), 0 0 22px rgba(177,103,39,.16)',
  },
  standard: {
    idle:
      '0 0 3px rgba(255,233,184,.7), 0 0 10px rgba(242,178,78,.38), 0 0 21px rgba(177,103,39,.16)',
    peak:
      '0 0 4px rgba(255,238,197,.78), 0 0 13px rgba(248,190,88,.48), 0 0 25px rgba(177,103,39,.2)',
  },
  bright: {
    idle:
      '0 0 4px rgba(255,237,194,.76), 0 0 12px rgba(246,188,86,.45), 0 0 24px rgba(186,111,40,.18)',
    peak:
      '0 0 5px rgba(255,242,207,.84), 0 0 15px rgba(251,197,96,.54), 0 0 28px rgba(190,114,41,.22)',
  },
  active: {
    idle:
      '0 0 4px rgba(255,239,202,.8), 0 0 13px rgba(250,196,94,.5), 0 0 25px rgba(196,120,42,.2)',
    peak:
      '0 0 5px rgba(255,244,214,.88), 0 0 16px rgba(253,201,100,.6), 0 0 29px rgba(196,120,42,.24)',
  },
  signature: {
    idle:
      '0 0 4px rgba(255,239,202,.82), 0 0 13px rgba(250,196,94,.54), 0 0 25px rgba(196,120,42,.22)',
    peak:
      '0 0 5px rgba(255,244,214,.9), 0 0 17px rgba(253,201,100,.64), 0 0 30px rgba(196,120,42,.26)',
  },
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
const DISPLAY_SPACING_RADIUS_PERCENT = CLUSTER_RADIUS_PERCENT;
const DISPLAY_CLUSTER_RADIUS_PERCENT = 0.35;
const DISPLAY_OFFSET_STEP_PERCENT = 1.12;
const DISPLAY_OFFSET_MAX_PERCENT = 2.35;
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
type MapTransform = { scale: number; translateX: number; translateY: number };
type ActiveMapPointer = { pointerId: number; clientX: number; clientY: number };

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

type AtlasMapProps = {
  constellationHighlightedIds?: readonly string[];
  celebrationSearchHighlightedIds?: readonly string[];
  activeConstellationTitle?: string | null;
  onSearchActivate?: () => void;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampMapTransform = (
  transform: MapTransform,
  frame: HTMLDivElement | null,
): MapTransform => {
  const scale = clamp(
    transform.scale,
    MAP_ZOOM_MIN_SCALE,
    MAP_ZOOM_MAX_SCALE,
  );

  if (!frame || scale <= MAP_ZOOM_MIN_SCALE) {
    return { scale, translateX: 0, translateY: 0 };
  }

  const rect = frame.getBoundingClientRect();
  const maxTranslateX = ((scale - 1) * rect.width * MAP_PAN_EDGE_FACTOR) / scale;
  const maxTranslateY = ((scale - 1) * rect.height * MAP_PAN_EDGE_FACTOR) / scale;

  return {
    scale,
    translateX: clamp(transform.translateX, -maxTranslateX, maxTranslateX),
    translateY: clamp(transform.translateY, -maxTranslateY, maxTranslateY),
  };
};

const getPointerDistance = (a: ActiveMapPointer, b: ActiveMapPointer) =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

const getPointerCenter = (a: ActiveMapPointer, b: ActiveMapPointer) => ({
  x: (a.clientX + b.clientX) / 2,
  y: (a.clientY + b.clientY) / 2,
});

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

const resolveAtlasDisplayMarkerLayouts = (
  layouts: AtlasMarkerLayout[],
): AtlasMarkerLayout[] => {
  const displayLayouts = layouts.map((layout) => ({
    ...layout,
    position: { ...layout.position },
  }));
  const consumed = new Set<string>();
  const orderedLayouts = [...displayLayouts].sort(
    (a, b) =>
      a.position.x - b.position.x ||
      a.position.y - b.position.y ||
      a.event.id.localeCompare(b.event.id),
  );

  for (const layout of orderedLayouts) {
    if (consumed.has(layout.event.id)) continue;

    const nearbyLayouts = orderedLayouts.filter(
      (candidate) =>
        !consumed.has(candidate.event.id) &&
        getMarkerDistance(layout.position, candidate.position) <=
          DISPLAY_SPACING_RADIUS_PERCENT,
    );

    nearbyLayouts.forEach((candidate) => consumed.add(candidate.event.id));

    if (nearbyLayouts.length <= 1) continue;

    const hasTrueOverlap = nearbyLayouts.some(
      (candidate) =>
        nearbyLayouts.some(
          (comparison) =>
            comparison.event.id !== candidate.event.id &&
            getMarkerDistance(candidate.position, comparison.position) <=
              DISPLAY_CLUSTER_RADIUS_PERCENT,
        ),
    );

    if (hasTrueOverlap) continue;

    const centroid = nearbyLayouts.reduce(
      (accumulator, candidate) => ({
        x: accumulator.x + candidate.position.x,
        y: accumulator.y + candidate.position.y,
      }),
      { x: 0, y: 0 },
    );
    const center = {
      x: centroid.x / nearbyLayouts.length,
      y: centroid.y / nearbyLayouts.length,
    };
    const ringStep = Math.min(
      DISPLAY_OFFSET_MAX_PERCENT,
      DISPLAY_OFFSET_STEP_PERCENT + nearbyLayouts.length * 0.12,
    );
    const angleOffset = ((nearbyLayouts[0]?.eventIndex ?? 0) % 6) * 0.38;

    nearbyLayouts
      .sort((a, b) => a.eventIndex - b.eventIndex)
      .forEach((candidate, index) => {
        const angle =
          angleOffset + (Math.PI * 2 * index) / nearbyLayouts.length;
        const distance =
          ringStep * (nearbyLayouts.length <= 3 ? 0.86 : index % 2 ? 1 : 0.72);

        candidate.position = {
          x: clampMarkerPercent(center.x + Math.cos(angle) * distance),
          y: clampMarkerPercent(center.y + Math.sin(angle) * distance),
        };
      });
  }

  return displayLayouts.sort((a, b) => a.eventIndex - b.eventIndex);
};

const resolveAtlasMarkerClusters = (
  layouts: AtlasMarkerLayout[],
  clusterRadiusPercent = CLUSTER_RADIUS_PERCENT,
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
          clusterRadiusPercent,
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

const isFiniteMarkerPosition = (position: MarkerPosition) =>
  Number.isFinite(position.x) && Number.isFinite(position.y);

const getConstellationPointKey = (
  position: MarkerPosition,
  cluster?: AtlasMarkerCluster,
) =>
  cluster && cluster.events.length > 1
    ? `cluster:${cluster.id}`
    : `point:${position.x.toFixed(3)}:${position.y.toFixed(3)}`;

const resolveConstellationLinePoints = ({
  eventIds,
  markerLayouts,
  markerClusters,
  isSearchActive,
}: {
  eventIds: readonly string[];
  markerLayouts: AtlasMarkerLayout[];
  markerClusters: AtlasMarkerCluster[];
  isSearchActive: boolean;
}): MarkerPosition[] => {
  if (isSearchActive || eventIds.length === 0) return [];

  const layoutByEventId = new Map(
    markerLayouts.map((layout) => [layout.event.id, layout]),
  );
  const clusterByEventId = new Map<string, AtlasMarkerCluster>();

  markerClusters.forEach((cluster) => {
    cluster.events.forEach((event) => {
      clusterByEventId.set(event.id, cluster);
    });
  });

  const usedPointKeys = new Set<string>();
  const points: MarkerPosition[] = [];

  eventIds.forEach((eventId) => {
    const cluster = clusterByEventId.get(eventId);
    const layout = layoutByEventId.get(eventId);
    const position =
      cluster && cluster.events.length > 1 ? cluster.position : layout?.position;

    if (!position || !isFiniteMarkerPosition(position)) return;

    const pointKey = getConstellationPointKey(position, cluster);
    if (usedPointKeys.has(pointKey)) return;

    usedPointKeys.add(pointKey);
    points.push(position);
  });

  return points;
};

function ConstellationLineLayer({ points }: { points: MarkerPosition[] }) {
  if (points.length < 2) return null;

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={styles.constellationLineLayer}
    >
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(' ')}
        fill="none"
        stroke="rgba(255, 229, 184, 0.48)"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

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

export default function AtlasMap({
  constellationHighlightedIds = [],
  celebrationSearchHighlightedIds = [],
  activeConstellationTitle = null,
  onSearchActivate,
}: AtlasMapProps) {
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
  const [mapTransform, setMapTransform] = useState<MapTransform>({
    scale: MAP_ZOOM_MIN_SCALE,
    translateX: 0,
    translateY: 0,
  });
  const activeMapPointersRef = useRef<Map<number, ActiveMapPointer>>(new Map());
  const panGestureRef = useRef<{
    startX: number;
    startY: number;
    startTranslateX: number;
    startTranslateY: number;
  } | null>(null);
  const pinchGestureRef = useRef<{
    startDistance: number;
    startCenterX: number;
    startCenterY: number;
    startScale: number;
    startTranslateX: number;
    startTranslateY: number;
  } | null>(null);
  const mapGestureMovedRef = useRef(false);
  const lastMapTapTimeRef = useRef(0);
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
  const exactEventOpenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const enterFrameRef = useRef<number | null>(null);
  const enterFrameInnerRef = useRef<number | null>(null);
  const [renderedEvent, setRenderedEvent] = useState<
    (typeof ATLAS_EVENTS)[number] | null
  >(null);
  const [isCardVisible, setIsCardVisible] = useState(false);
  const [cardEnterOffset, setCardEnterOffset] = useState(36);
  const [searchPulseTick, setSearchPulseTick] = useState(0);
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
  const exactEventIntent = useMemo(
    () => resolveExactEventIntent(submittedQuery),
    [submittedQuery],
  );
  const searchHighlightedIds = useMemo(() => {
    if (exactEventIntent) return new Set([exactEventIntent.eventId]);

    return getHighlightedIdsFromQuery(q);
  }, [exactEventIntent, q]);
  const celebrationSearchHighlightedIdSet = useMemo(
    () => new Set(celebrationSearchHighlightedIds),
    [celebrationSearchHighlightedIds],
  );
  const constellationHighlightedIdSet = useMemo(
    () => new Set(constellationHighlightedIds),
    [constellationHighlightedIds],
  );
  const isCelebrationSearchHighlightActive =
    celebrationSearchHighlightedIdSet.size > 0;
  const highlightedIds = q
    ? searchHighlightedIds
    : isCelebrationSearchHighlightActive
      ? celebrationSearchHighlightedIdSet
      : constellationHighlightedIdSet;
  const discoveryResultLimit = isPhoneLandscape ? 2 : isDesktop ? 4 : 3;
  const discoveryResultRows = useMemo<HomeDiscoveryResultRow[]>(() => {
    if (exactEventIntent || !q || highlightedIds.size === 0) return [];

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
  }, [discoveryResultLimit, exactEventIntent, highlightedIds, q]);
  const markerLayouts = useMemo(
    () => resolveAtlasMarkerLayouts(ATLAS_EVENTS),
    [],
  );
  const displayMarkerLayouts = useMemo(
    () => resolveAtlasDisplayMarkerLayouts(markerLayouts),
    [markerLayouts],
  );
  const markerClusters = useMemo(
    () =>
      resolveAtlasMarkerClusters(
        displayMarkerLayouts,
        DISPLAY_CLUSTER_RADIUS_PERCENT,
      ),
    [displayMarkerLayouts],
  );
  const isConstellationLineSearchActive = Boolean(
    q ||
      query.trim() ||
      displayedQuery.trim() ||
      isCelebrationSearchHighlightActive,
  );
  const constellationLinePoints = useMemo(
    () =>
      resolveConstellationLinePoints({
        eventIds: constellationHighlightedIds,
        markerLayouts: displayMarkerLayouts,
        markerClusters,
        isSearchActive: isConstellationLineSearchActive,
      }),
    [
      constellationHighlightedIds,
      isConstellationLineSearchActive,
      markerClusters,
      displayMarkerLayouts,
    ],
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
  const safeEventCard = renderedEvent
    ? deriveSafeAtlasEventCard(renderedEvent)
    : null;
  const selectedMedia = safeEventCard?.media;
  const hasCardMedia = Boolean(selectedMedia);
  const hasCardMediaSource = Boolean(
    selectedMedia?.mediaSrc || selectedMedia?.posterSrc,
  );
  const isVideoMedia =
    selectedMedia?.mediaType === 'video' && Boolean(selectedMedia?.mediaSrc);
  const mediaFadeDurationMs = selectedMedia?.mediaFadeDurationMs ?? 1300;
  const mediaDelayMs = selectedMedia?.mediaDelayMs ?? 0;
  const cardBaseTheme = safeEventCard
    ? CARD_THEME_BY_CATEGORY[safeEventCard.category]
    : CARD_THEME_BY_CATEGORY.Festivals;
  const cardTheme = blendCardTheme(
    cardBaseTheme,
    renderedEvent?.regionAtmosphere,
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

  const resetMapTransform = useCallback(() => {
    activeMapPointersRef.current.clear();
    panGestureRef.current = null;
    pinchGestureRef.current = null;
    mapGestureMovedRef.current = false;
    setMapTransform({
      scale: MAP_ZOOM_MIN_SCALE,
      translateX: 0,
      translateY: 0,
    });
  }, []);

  const handleMapGesturePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (shouldShowCalibration || isVerificationMode) return;
      if (event.pointerType !== 'touch') return;

      const nextPointers = activeMapPointersRef.current;
      nextPointers.set(event.pointerId, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      mapGestureMovedRef.current = false;

      if (nextPointers.size === 1) {
        panGestureRef.current = {
          startX: event.clientX,
          startY: event.clientY,
          startTranslateX: mapTransform.translateX,
          startTranslateY: mapTransform.translateY,
        };
        pinchGestureRef.current = null;
        return;
      }

      if (nextPointers.size === 2) {
        const [firstPointer, secondPointer] = [...nextPointers.values()];
        const center = getPointerCenter(firstPointer, secondPointer);
        pinchGestureRef.current = {
          startDistance: getPointerDistance(firstPointer, secondPointer),
          startCenterX: center.x,
          startCenterY: center.y,
          startScale: mapTransform.scale,
          startTranslateX: mapTransform.translateX,
          startTranslateY: mapTransform.translateY,
        };
        panGestureRef.current = null;
      }
    },
    [isVerificationMode, mapTransform, shouldShowCalibration],
  );

  const handleMapGesturePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'touch') return;
      const activePointer = activeMapPointersRef.current.get(event.pointerId);
      if (!activePointer) return;

      activeMapPointersRef.current.set(event.pointerId, {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      });

      const activePointers = [...activeMapPointersRef.current.values()];

      if (activePointers.length >= 2 && pinchGestureRef.current) {
        const [firstPointer, secondPointer] = activePointers;
        const pinch = pinchGestureRef.current;
        const nextDistance = getPointerDistance(firstPointer, secondPointer);
        if (pinch.startDistance <= 0) return;

        const center = getPointerCenter(firstPointer, secondPointer);
        const nextScale = clamp(
          pinch.startScale * (nextDistance / pinch.startDistance),
          MAP_ZOOM_MIN_SCALE,
          MAP_ZOOM_MAX_SCALE,
        );
        const nextTransform = clampMapTransform(
          {
            scale: nextScale,
            translateX:
              pinch.startTranslateX + (center.x - pinch.startCenterX) / nextScale,
            translateY:
              pinch.startTranslateY + (center.y - pinch.startCenterY) / nextScale,
          },
          mapFrameRef.current,
        );

        event.preventDefault();
        mapGestureMovedRef.current = true;
        setMapTransform(nextTransform);
        return;
      }

      if (activePointers.length === 1 && panGestureRef.current) {
        const pan = panGestureRef.current;
        const deltaX = event.clientX - pan.startX;
        const deltaY = event.clientY - pan.startY;
        const movedEnough =
          Math.hypot(deltaX, deltaY) >= MAP_GESTURE_MOVE_THRESHOLD_PX;

        if (!movedEnough && !mapGestureMovedRef.current) return;

        const nextTransform = clampMapTransform(
          {
            scale: mapTransform.scale,
            translateX: pan.startTranslateX + deltaX / mapTransform.scale,
            translateY: pan.startTranslateY + deltaY / mapTransform.scale,
          },
          mapFrameRef.current,
        );

        event.preventDefault();
        mapGestureMovedRef.current = true;
        setMapTransform(nextTransform);
      }
    },
    [mapTransform.scale],
  );

  const handleMapGesturePointerEnd = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'touch') return;
      activeMapPointersRef.current.delete(event.pointerId);

      if (activeMapPointersRef.current.size < 2) {
        pinchGestureRef.current = null;
      }

      if (activeMapPointersRef.current.size === 1) {
        const [remainingPointer] = [...activeMapPointersRef.current.values()];
        panGestureRef.current = {
          startX: remainingPointer.clientX,
          startY: remainingPointer.clientY,
          startTranslateX: mapTransform.translateX,
          startTranslateY: mapTransform.translateY,
        };
      } else if (activeMapPointersRef.current.size === 0) {
        panGestureRef.current = null;
      }
    },
    [mapTransform.translateX, mapTransform.translateY],
  );

  const handleMapGestureDoubleTap = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (event.pointerType !== 'touch') return;
      if (mapGestureMovedRef.current) return;

      const now = window.performance.now();
      if (now - lastMapTapTimeRef.current <= MAP_DOUBLE_TAP_RESET_MS) {
        event.preventDefault();
        resetMapTransform();
        lastMapTapTimeRef.current = 0;
        return;
      }

      lastMapTapTimeRef.current = now;
    },
    [resetMapTransform],
  );

  const shouldSuppressMarkerTap = useCallback(() => {
    if (!mapGestureMovedRef.current) return false;
    mapGestureMovedRef.current = false;
    return true;
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
    if (!hasCardMediaSource || !isCardVisible) return;
    cardMediaFadeTimerRef.current = setTimeout(() => {
      setIsCardMediaVisible(true);
      cardMediaFadeTimerRef.current = null;
    }, mediaDelayMs);
  }, [hasCardMediaSource, isCardVisible, mediaDelayMs]);

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

    onSearchActivate?.();

    const isResetCommand = isResetSearchCommand(trimmedQuery);

    setSubmittedQuery(isResetCommand ? '' : trimmedQuery);

    if (isResetCommand) {
      if (exactEventOpenTimerRef.current) {
        clearTimeout(exactEventOpenTimerRef.current);
        exactEventOpenTimerRef.current = null;
      }
      setSelectedId(null);
      setSelectedClusterId(null);
      setDiscoveryStatusText(null);
      setDisplayedQuery('');
      setQuery('');
      setIsSubmittedQueryFading(false);
      setSearchPulseTick((prev) => prev + 1);
      searchInputRef.current?.blur();
      return;
    }

    const exactMatch = resolveExactEventIntent(trimmedQuery);

    if (exactEventOpenTimerRef.current) {
      clearTimeout(exactEventOpenTimerRef.current);
      exactEventOpenTimerRef.current = null;
    }

    if (exactMatch) {
      setSelectedClusterId(null);
      setSelectedId(null);
      setDiscoveryStatusText(`Found ${exactMatch.eventName}`);
      exactEventOpenTimerRef.current = setTimeout(() => {
        setSelectedId(exactMatch.eventId);
        exactEventOpenTimerRef.current = null;
      }, EXACT_EVENT_CARD_OPEN_DELAY_MS);
    } else {
      const nextHighlightedIds = getHighlightedIdsFromQuery(trimmedQuery);
      setDiscoveryStatusText(
        nextHighlightedIds.size > 0
          ? `Showing ${nextHighlightedIds.size} ${nextHighlightedIds.size === 1 ? 'discovery' : 'discoveries'} for “${trimmedQuery}”`
          : `No discoveries found for “${trimmedQuery}”`,
      );
    }
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
  }, [onSearchActivate]);

  useEffect(() => {
    let isCurrentConstellationState = true;

    queueMicrotask(() => {
      if (!isCurrentConstellationState) return;

      if (constellationHighlightedIds.length === 0) {
        if (!q) setDiscoveryStatusText(null);
        return;
      }

      if (queryFadeTimerRef.current) {
        clearTimeout(queryFadeTimerRef.current);
        queryFadeTimerRef.current = null;
      }

      setSubmittedQuery('');
      setDisplayedQuery('');
      setQuery('');
      setIsSubmittedQueryFading(false);
      setDiscoveryStatusText(
        activeConstellationTitle
          ? `Trail active: “${activeConstellationTitle}” — ${
              constellationHighlightedIds.length
            } ${
              constellationHighlightedIds.length === 1 ? 'star' : 'stars'
            } highlighted. Search replaces this trail.`
          : null,
      );
    });

    return () => {
      isCurrentConstellationState = false;
    };
  }, [activeConstellationTitle, constellationHighlightedIds, q]);

  useEffect(() => {
    let isCurrentCelebrationSearchState = true;

    queueMicrotask(() => {
      if (!isCurrentCelebrationSearchState || q) return;

      if (celebrationSearchHighlightedIds.length === 0) {
        setDiscoveryStatusText(null);
        return;
      }

      setDiscoveryStatusText(
        `Celebration Search highlighted ${celebrationSearchHighlightedIds.length} ${
          celebrationSearchHighlightedIds.length === 1 ? 'star' : 'stars'
        }. AtlasMap search replaces this guidance.`,
      );
    });

    return () => {
      isCurrentCelebrationSearchState = false;
    };
  }, [celebrationSearchHighlightedIds, q]);

  const submitSearch = useCallback(() => {
    runDiscoverySearch(query);
  }, [query, runDiscoverySearch]);

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
      if (exactEventOpenTimerRef.current)
        clearTimeout(exactEventOpenTimerRef.current);
      if (calibrationCopyStatusTimerRef.current)
        clearTimeout(calibrationCopyStatusTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      if (enterFrameInnerRef.current)
        cancelAnimationFrame(enterFrameInnerRef.current);
    };
  }, []);

  const isAtlasPanelOpen = Boolean(renderedEvent || selectedCluster);
  const mapLayerTransform = `translate3d(${mapTransform.translateX + (prefersReducedMotion ? 0 : parallaxOffset.x * 0.55)}px, ${mapTransform.translateY + (prefersReducedMotion ? 0 : parallaxOffset.y * 0.55)}px, 0) scale(${BASE_SCALE * mapTransform.scale})`;

  return (
    <section
      className={[
        'atlas-hero',
        isPhoneLandscape ? 'atlas-hero--phone-landscape' : '',
        isAtlasPanelOpen ? 'atlas-hero--card-open' : '',
      ]
        .filter(Boolean)
        .join(' ')}
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
        onPointerDown={handleMapGesturePointerDown}
        onPointerMove={(event) => {
          handleDepthPointerMove(event);
          handleMapGesturePointerMove(event);
        }}
        onPointerUp={(event) => {
          handleMapGesturePointerEnd(event);
          handleMapGestureDoubleTap(event);
        }}
        onPointerCancel={handleMapGesturePointerEnd}
        onPointerLeave={(event) => {
          handleDepthPointerLeave();
          handleMapGesturePointerEnd(event);
        }}
      >
        <div
          style={{
            ...styles.atmosphereMapContent,
            transform: mapLayerTransform,
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
            transform: mapLayerTransform,
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

          {!shouldShowCalibration && !isVerificationMode ? (
            <ConstellationLineLayer points={constellationLinePoints} />
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
                const exactHighlightedEvent = exactEventIntent
                  ? events.find(
                      (event) => event.id === exactEventIntent.eventId,
                    )
                  : null;
                const clusterHighlightedCount = events.filter((event) =>
                  highlightedIds.has(event.id),
                ).length;
                const isHighlighted = clusterHighlightedCount > 0;
                const isSelected = selectedId
                  ? events.some((event) => event.id === selectedId)
                  : selectedClusterId === id;
                const isDimmed = highlightedIds.size > 0 && !isHighlighted;
                const primaryEventProfile = getEventProfileById(
                  primaryEvent.id,
                );
                const markerPresentation = primaryEventProfile
                  ? getEventMarkerPresentation(primaryEventProfile)
                  : null;
                const markerBaseShadows = markerPresentation
                  ? MARKER_BASE_SHADOWS_BY_INTENSITY[
                      markerPresentation.intensity
                    ]
                  : MARKER_BASE_SHADOWS_BY_INTENSITY.standard;
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
                      : 1;
                const markerLabelEvent = exactHighlightedEvent ??
                  (!isCluster ? primaryEvent : null);
                const shouldShowMarkerLabel = exactEventIntent
                  ? Boolean(exactHighlightedEvent)
                  : !isCluster && isHighlighted;
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
                              if (shouldSuppressMarkerTap()) return;
                              if (exactHighlightedEvent) {
                                setSelectedClusterId(null);
                                setSelectedId(exactHighlightedEvent.id);
                                return;
                              }

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
                                      ? '0 0 8px rgba(255,247,219,.82), 0 0 26px rgba(255,205,106,.56), 0 0 64px rgba(211,132,43,.28), 0 0 108px rgba(145,81,30,.14)'
                                      : isSelected
                                        ? '0 0 8px rgba(255,241,207,.78), 0 0 24px rgba(252,197,92,.52), 0 0 58px rgba(207,129,41,.26), 0 0 96px rgba(141,78,29,.13)'
                                        : '0 0 6px rgba(255,232,184,.54), 0 0 19px rgba(242,178,77,.36), 0 0 48px rgba(186,111,40,.2), 0 0 82px rgba(128,72,29,.11)'
                                    : isHighlighted
                                      ? '0 0 5px rgba(255,251,232,.96), 0 0 17px rgba(255,210,112,.72), 0 0 34px rgba(223,146,48,.3)'
                                      : isSelected
                                        ? '0 0 5px rgba(255,246,220,.9), 0 0 16px rgba(253,201,100,.68), 0 0 30px rgba(211,132,44,.28)'
                                        : markerBaseShadows.idle,
                                  '--marker-shadow-peak': isCluster
                                    ? isHighlighted
                                      ? '0 0 10px rgba(255,250,229,.9), 0 0 34px rgba(255,214,122,.66), 0 0 78px rgba(217,140,45,.34), 0 0 124px rgba(145,81,30,.16)'
                                      : isSelected
                                        ? '0 0 9px rgba(255,246,220,.84), 0 0 31px rgba(255,207,106,.6), 0 0 72px rgba(207,129,41,.31), 0 0 114px rgba(141,78,29,.15)'
                                        : '0 0 7px rgba(255,238,197,.62), 0 0 25px rgba(248,190,88,.45), 0 0 60px rgba(196,120,42,.24), 0 0 96px rgba(128,72,29,.13)'
                                    : isHighlighted
                                      ? '0 0 7px rgba(255,253,238,1), 0 0 22px rgba(255,218,130,.84), 0 0 40px rgba(223,146,48,.36)'
                                      : isSelected
                                        ? '0 0 6px rgba(255,250,232,.96), 0 0 20px rgba(255,210,112,.78), 0 0 36px rgba(211,132,44,.34)'
                                        : markerBaseShadows.peak,
                                  '--marker-glint-span': isCluster
                                    ? '21px'
                                    : '15px',
                                  '--marker-glint-thickness': isCluster
                                    ? '1.5px'
                                    : '1px',
                                  '--marker-glint-opacity': isCluster
                                    ? isHighlighted || isSelected
                                      ? 0.72
                                      : 0.18
                                    : isHighlighted || isSelected
                                      ? 0.78
                                      : 0.08,
                                  '--marker-glint-soft-opacity': isCluster
                                    ? isHighlighted || isSelected
                                      ? 0.36
                                      : 0.08
                                    : isHighlighted || isSelected
                                      ? 0.34
                                      : 0.04,
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
                              markerLabelEvent
                                ? `Open ${markerLabelEvent.name}`
                                : `Open ${events.length} nearby celebrations`
                            }
                            onClick={() => {
                              if (shouldSuppressMarkerTap()) return;
                              if (exactHighlightedEvent) {
                                setSelectedClusterId(null);
                                setSelectedId(exactHighlightedEvent.id);
                                return;
                              }

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
                              opacity: shouldShowMarkerLabel ? 1 : 0,
                              transform: shouldShowMarkerLabel
                                ? 'translate(-50%, -122%)'
                                : 'translate(-50%, -116%)',
                              pointerEvents: shouldShowMarkerLabel
                                ? 'auto'
                                : 'none',
                            }}
                          >
                            {markerLabelEvent?.name ??
                              `${events.length} celebrations`}
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

      {!shouldShowCalibration && !isVerificationMode && renderedEvent && safeEventCard ? (
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
          {hasCardMedia && hasCardMediaSource ? (
            <div
              style={{
                ...styles.cardMediaWrap,
                opacity: isCardMediaVisible ? 1 : 0,
                transitionDuration: `${mediaFadeDurationMs}ms`,
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
          <div style={styles.cardContent}>
            <div style={styles.cardHeaderRow}>
              <div style={styles.cardTitleGroup}>
                <p style={styles.cardLocation}>{safeEventCard.location}</p>
                <h3 style={styles.cardTitle}>{safeEventCard.name}</h3>
              </div>
              <p style={styles.cardCategoryTag}>
                {safeEventCard.cardTag ?? safeEventCard.category}
              </p>
            </div>
            <p style={styles.cardBody}>{safeEventCard.description}</p>
            {safeEventCard.atmosphereLabel ? (
              <p style={styles.cardAtmosphere}>
                <span aria-hidden="true" style={styles.cardAtmosphereGlyph}>
                  ✦
                </span>
                {safeEventCard.atmosphereLabel}
              </p>
            ) : null}
            <p style={styles.cardTrustLine}>{safeEventCard.trustStatusCopy}</p>
            {safeEventCard.detailAction ? (
              safeEventCard.id === 'electric-forest' ? (
                <button
                  type="button"
                  style={styles.enterEventButton}
                  onClick={() => startElectricForestTransition(safeEventCard.id)}
                >
                  {safeEventCard.detailAction.label}
                </button>
              ) : (
                <Link
                  href={safeEventCard.detailAction.href}
                  style={styles.enterEventLink}
                >
                  {safeEventCard.detailAction.label}
                </Link>
              )
            ) : null}
          </div>
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
            <HomeDiscoveryLayer
              query={submittedQuery}
              resultCount={highlightedIds.size}
              statusText={discoveryStatusText ?? undefined}
              results={discoveryResultRows}
              shortcutGroups={HOME_DISCOVERY_SHORTCUT_GROUPS}
              showShortcutGroups={false}
            />
            <div style={styles.searchInputWrap}>
              <span style={styles.searchPrefix}>Ask Celebration Atlas</span>
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
                aria-label="Ask Celebration Atlas"
                placeholder={
                  !query.trim() && !displayedQuery && !isSearchFocused
                    ? isDesktop
                      ? ATMOSPHERIC_SUGGESTIONS[suggestionIndex]
                      : MOBILE_ATLAS_COMMAND_PLACEHOLDER
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
                    if (exactEventOpenTimerRef.current) {
                      clearTimeout(exactEventOpenTimerRef.current);
                      exactEventOpenTimerRef.current = null;
                    }
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

            .marker-pulse {
              animation-name: markerPulse;
              animation-timing-function: ease-in-out;
              animation-iteration-count: infinite;
              animation-fill-mode: both;
              will-change: transform, box-shadow, filter;
              transform-origin: center;
            }

            .marker-pulse::before,
            .marker-pulse::after {
              content: '';
              position: absolute;
              left: 50%;
              top: 50%;
              width: var(--marker-glint-span, 15px);
              height: var(--marker-glint-thickness, 1px);
              border-radius: 999px;
              background: linear-gradient(
                90deg,
                rgba(255, 237, 177, 0),
                rgba(255, 249, 226, var(--marker-glint-opacity, 0.5)),
                rgba(255, 237, 177, 0)
              );
              box-shadow: 0 0 6px
                rgba(255, 214, 122, var(--marker-glint-soft-opacity, 0.2));
              pointer-events: none;
              transform: translate(-50%, -50%);
            }

            .marker-pulse::after {
              width: var(--marker-glint-thickness, 1px);
              height: var(--marker-glint-span, 15px);
              background: linear-gradient(
                180deg,
                rgba(255, 237, 177, 0),
                rgba(255, 249, 226, var(--marker-glint-soft-opacity, 0.2)),
                rgba(255, 237, 177, 0)
              );
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
    touchAction: 'none',
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
    touchAction: 'none',
    filter: 'saturate(0.74) brightness(0.62) contrast(1.08)',
  },
  atmosphereMapContent: {
    position: 'absolute',
    inset: '-6% -10%',
    transformOrigin: 'center center',
    filter: 'saturate(0.8) brightness(0.4) contrast(1.08)',
    transition: 'transform 520ms cubic-bezier(.22,.61,.36,1)',
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
  constellationLineLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: Z_INDEX.constellationLines,
    pointerEvents: 'none',
    opacity: 0.34,
    mixBlendMode: 'screen',
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
    width: 16,
    height: 16,
    borderRadius: 999,
    border: '1px solid rgba(255, 230, 178, 0.1)',
    background:
      'radial-gradient(circle at 50% 50%, rgba(255, 248, 212, 0.98) 0 4%, rgba(255, 225, 146, 0.92) 5% 9%, rgba(248, 189, 79, 0.44) 17%, rgba(226, 145, 48, 0.16) 34%, rgba(160, 87, 34, 0.04) 56%, rgba(160, 87, 34, 0) 86%)',
    zIndex: Z_INDEX.markers,
    pointerEvents: 'none',
  },
  clusterMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 26,
    height: 26,
    borderRadius: 999,
    border: '1px solid rgba(255, 226, 170, 0.09)',
    background:
      'radial-gradient(circle at 50% 50%, rgba(255, 247, 210, 0.98) 0 3.5%, rgba(255, 222, 142, 0.88) 5% 8%, rgba(247, 185, 77, 0.34) 18%, rgba(216, 130, 44, 0.12) 39%, rgba(128, 72, 29, 0.035) 63%, rgba(128, 72, 29, 0) 90%), radial-gradient(circle at 37% 34%, rgba(255, 239, 196, 0.66) 0 2%, rgba(241, 170, 68, 0.18) 5%, rgba(241, 170, 68, 0) 16%), radial-gradient(circle at 66% 58%, rgba(255, 228, 166, 0.42) 0 1.8%, rgba(226, 146, 54, 0.13) 5%, rgba(226, 146, 54, 0) 15%)',
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
  searchInputWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    minHeight: 58,
    width: '100%',
    borderRadius: 24,
    border: '1px solid rgba(255, 226, 170, 0.42)',
    background:
      'linear-gradient(180deg, rgba(15, 20, 30, 0.76), rgba(6, 9, 14, 0.64))',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 244, 214, 0.07), 0 18px 42px rgba(2, 5, 12, 0.32), 0 0 18px rgba(252, 201, 102, 0.2)',
    padding: '18px 17px 10px',
  },
  searchPrefix: {
    flexShrink: 0,
    position: 'absolute',
    top: 8,
    left: 17,
    color: 'rgba(255, 247, 222, 0.9)',
    opacity: 0.98,
    textShadow: '0 1px 3px rgba(2, 3, 6, 0.85)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.16,
    textTransform: 'uppercase',
  },
  searchQueryText: {
    marginLeft: 0,
    paddingTop: 12,
    color: 'rgba(255, 239, 206, 0.98)',
    fontSize: 16,
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
    maxWidth: '100%',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  searchInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    padding: '26px 17px 9px',
    borderRadius: 24,
    border: 'none',
    background: 'transparent',
    color: 'transparent',
    caretColor: 'rgba(255, 239, 206, 0.98)',
    fontSize: 16,
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
    padding: 0,
    borderRadius: 22,
    background:
      'linear-gradient(160deg, rgba(16,21,30,.34), rgba(9,12,18,.2) 58%, rgba(7,10,15,.3))',
    border: '1px solid rgba(255,225,160,.4)',
    boxShadow:
      'inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px rgba(252,201,102,.24), 0 16px 36px rgba(0,0,0,.32)',
    backdropFilter: 'blur(5px) saturate(1.08)',
    WebkitBackdropFilter: 'blur(5px) saturate(1.08)',
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
    position: 'relative',
    height: 104,
    margin: '0 0 2px',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    overflow: 'hidden',
    opacity: 0,
    transition: 'opacity 1300ms ease',
    maskImage:
      'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,.96) 66%, rgba(0,0,0,0) 100%)',
    WebkitMaskImage:
      'linear-gradient(180deg, rgba(0,0,0,1) 0%, rgba(0,0,0,.96) 66%, rgba(0,0,0,0) 100%)',
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
    zIndex: 3,
  },
  cardContent: {
    position: 'relative',
    zIndex: 1,
    padding: '14px 14px 16px',
  },
  cardHeaderRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 9,
  },
  cardTitleGroup: {
    minWidth: 0,
  },
  cardTitle: {
    margin: 0,
    fontSize: 22,
    lineHeight: 1.08,
    fontWeight: 760,
    letterSpacing: 0.1,
    color: '#ffebb9',
    textShadow: '0 1px 3px rgba(2,3,6,.9), 0 0 14px rgba(255,229,173,.28)',
  },
  cardLocation: {
    margin: '0 0 5px',
    fontSize: 11,
    letterSpacing: 1.15,
    textTransform: 'uppercase',
    color: 'rgba(255,238,203,.72)',
    textShadow: '0 1px 2px rgba(3,4,8,.8)',
  },
  cardCategoryTag: {
    display: 'inline-flex',
    flexShrink: 0,
    width: 'fit-content',
    margin: '1px 26px 0 0',
    padding: '4px 9px',
    borderRadius: 999,
    border: '1px solid rgba(235, 205, 255, 0.34)',
    background: 'rgba(88, 48, 130, 0.18)',
    color: 'rgba(248, 229, 255, 0.86)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    textShadow: '0 1px 2px rgba(3,4,8,.72)',
  },
  cardAtmosphere: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    margin: '10px 0 0',
    fontSize: 13,
    fontWeight: 650,
    color: 'rgba(255,233,191,.94)',
    letterSpacing: 0.24,
    textShadow: '0 1px 2px rgba(2,3,7,.7), 0 0 10px rgba(255,219,156,.22)',
  },
  cardAtmosphereGlyph: {
    color: 'rgba(255,215,150,.9)',
    fontSize: 12,
  },
  cardBody: {
    margin: 0,
    color: '#f0e2c3',
    fontSize: 14,
    lineHeight: 1.42,
    textShadow: '0 1px 3px rgba(2,3,6,.86)',
  },
  cardTrustLine: {
    margin: '9px 0 0',
    color: 'rgba(219,204,174,.54)',
    fontSize: 10,
    lineHeight: 1.2,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  enterEventLink: {
    display: 'inline-flex',
    marginTop: '0.62rem',
    color: 'rgba(255, 224, 162, 0.9)',
    fontSize: '0.76rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    textDecoration: 'none',
    borderBottom: '1px solid rgba(255, 214, 148, 0.45)',
    paddingBottom: '0.1rem',
    opacity: 0.9,
    transition: 'opacity 180ms ease, border-color 180ms ease',
  },
  enterEventButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '9px 14px',
    marginTop: 10,
    borderRadius: 999,
    border: '1px solid rgba(255,230,183,.56)',
    color: 'rgba(255,242,215,.96)',
    background:
      'linear-gradient(180deg, rgba(255,206,124,.26), rgba(255,192,90,.14))',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    fontSize: 10,
    fontWeight: 650,
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
