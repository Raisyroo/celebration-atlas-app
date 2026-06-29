'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import type { CSSProperties, PointerEvent, RefObject, SyntheticEvent } from 'react';
import { ATLAS_EVENTS } from '../data/events';
import { deriveSafeAtlasEventCard } from '../data/safeEventCard';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes';
import {
  getEventProfileById,
  searchEventProfiles,
} from '../data/eventProfiles';
import { getEventMarkerPresentation } from '../data/eventMarkerPresentation';
import { resolveExplicitEventThumbnail } from '../data/eventThumbnail';
import { resolveExactEventIntent } from '../data/exactEventIntent';
import type { MarkerIntensity } from '../data/eventMarkerPresentation';
import type { MapPresentationPlan } from '../data/mapPresentationPlan';
import { MICHIGAN_MAP_ANCHORS } from '../data/mapCalibration';
import { resolveExactMichiganMobileUpperPeninsulaAnchorPosition } from '../data/michiganMobileUpperPeninsulaAnchors';
import type { MichiganMapAnchor } from '../data/mapCalibration';
import {
  MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY,
  projectLatLngToCalibratedMichiganArtworkPosition,
} from '../data/michiganArtworkCalibration';
import type { MichiganArtworkVariant } from '../data/michiganArtworkCalibration';
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
const EXACT_EVENT_CARD_OPEN_DELAY_MS = 2400;
const MOBILE_FAVORITE_STORAGE_KEY = 'celebration-atlas:michigan:favorite';
const MOBILE_LANDING_TITLE_SESSION_KEY = 'celebration-atlas:michigan-title-dismissed';
const MICHIGAN_TITLE_ARTWORK_SRC = '/brand/michigan-landing-lockup.png';
const MOBILE_MENU_ITEMS = [
  'Explore Michigan',
  'Saved Celebrations',
  'Calendar',
  'Submit a Celebration',
  'Settings',
  'Sign in / Create account',
] as const;
const MOBILE_FILTER_FIELDS = ['Date', 'Category', 'Location / nearby'] as const;

// Current interaction policy:
// - Keep the atlas at a fixed scale for now (no custom pinch/drag/gesture handlers).
// - This intentionally avoids mobile gesture edge-cases to preserve tap reliability.
//
// Active homepage marker path:
// app/page.tsx renders <AtlasMap />. Marker x/y is computed by
// projectEventToMichiganArtworkPosition below, which delegates real
// latitude/longitude projection to the shared calibrated Michigan artwork helper
// in data/michiganArtworkCalibration.ts. The painterly image remains the visible
// basemap; only markers move into artwork-relative positions.
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
      '0 0 0 1px rgba(255,236,194,.12), 0 0 8px rgba(255,220,148,.36), 0 0 22px rgba(221,142,48,.16), 0 0 42px rgba(120,70,28,.08)',
    peak:
      '0 0 0 1px rgba(255,239,202,.16), 0 0 11px rgba(255,224,156,.44), 0 0 28px rgba(226,150,52,.2), 0 0 50px rgba(120,70,28,.1)',
  },
  standard: {
    idle:
      '0 0 0 1px rgba(255,238,202,.14), 0 0 9px rgba(255,222,152,.42), 0 0 24px rgba(224,145,50,.18), 0 0 46px rgba(120,70,28,.09)',
    peak:
      '0 0 0 1px rgba(255,242,210,.18), 0 0 13px rgba(255,228,164,.5), 0 0 31px rgba(229,153,54,.23), 0 0 56px rgba(120,70,28,.11)',
  },
  bright: {
    idle:
      '0 0 0 1px rgba(255,242,210,.16), 0 0 11px rgba(255,226,158,.48), 0 0 28px rgba(230,151,52,.22), 0 0 54px rgba(126,72,28,.1)',
    peak:
      '0 0 0 1px rgba(255,246,220,.22), 0 0 15px rgba(255,232,172,.58), 0 0 36px rgba(235,158,56,.28), 0 0 64px rgba(126,72,28,.13)',
  },
  active: {
    idle:
      '0 0 0 1px rgba(255,246,220,.22), 0 0 14px rgba(255,232,174,.58), 0 0 34px rgba(238,160,58,.28), 0 0 68px rgba(130,74,28,.13)',
    peak:
      '0 0 0 1px rgba(255,249,228,.28), 0 0 18px rgba(255,237,188,.68), 0 0 44px rgba(242,167,62,.35), 0 0 78px rgba(130,74,28,.16)',
  },
  signature: {
    idle:
      '0 0 0 1px rgba(255,248,226,.24), 0 0 15px rgba(255,235,182,.62), 0 0 38px rgba(241,165,60,.3), 0 0 72px rgba(132,76,30,.14)',
    peak:
      '0 0 0 1px rgba(255,250,232,.32), 0 0 20px rgba(255,240,196,.74), 0 0 50px rgba(246,174,68,.38), 0 0 88px rgba(132,76,30,.18)',
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
const PHONE_LANDSCAPE_QUERY =
  '(orientation: landscape) and (max-height: 520px) and (max-width: 932px)';
const HOME_DISCOVERY_SCROLL_CLASS = 'home-discovery-scroll';
const HOME_PHONE_LANDSCAPE_SCROLL_CLASS = 'home-phone-landscape-scroll';
const MOBILE_LANDING_MAP_LOWERING = '3dvh';

// The previous global -7% marker translate is intentionally replaced by the
// inverse workbench calibration in data/michiganArtworkCalibration.ts. Keeping a
// second global shift here would double-apply calibration and hide future tuning.

type AtlasEvent = (typeof ATLAS_EVENTS)[number];

const FALLBACK_THUMBNAIL_BY_ICON: Record<
  NonNullable<AtlasEvent['iconType']>,
  string
> = {
  music: '♪',
  fair: '🎡',
  food: '🍒',
  fireworks: '✦',
  flower: '✿',
  harvest: '🍑',
  waterfront: '≈',
  winter: '❄',
  art: '◆',
  heritage: '◈',
};


type EventStatusBadge = 'LIVE' | 'UPCOMING';

function parseReliableEventDate(dateText: string | undefined): Date | null {
  if (!dateText) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateText);
  if (!match) return null;

  const [, year, month, day] = match;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function getEventStatusBadge(event: AtlasEvent, now = new Date()): EventStatusBadge | null {
  const start = parseReliableEventDate(event.dateRange?.startDate);
  const end = parseReliableEventDate(event.dateRange?.endDate ?? event.dateRange?.startDate);

  if (!start || !end) return null;

  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  if (today >= start && today <= end) return 'LIVE';
  if (today < start) return 'UPCOMING';

  return null;
}



function formatEventDateRange(event: AtlasEvent): string | null {
  const start = parseReliableEventDate(event.dateRange?.startDate);
  const end = parseReliableEventDate(event.dateRange?.endDate);

  if (!start) return null;

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (!end || start.getTime() === end.getTime()) {
    return formatter.format(start);
  }

  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    return `${new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${start.getUTCFullYear()}`;
  }

  return sameYear
    ? `${new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }).format(start)} – ${formatter.format(end)}`
    : `${formatter.format(start)} – ${formatter.format(end)}`;
}

function getEventStoryDetails(event: AtlasEvent): { title: string; body: string }[] {
  const details: { title: string; body: string }[] = [];

  if (event.detailPage?.atmosphereLine) {
    details.push({ title: 'Field note', body: event.detailPage.atmosphereLine });
  }

  event.detailPage?.storySections?.forEach((section, index) => {
    details.push({ title: index === 0 ? 'Highlights' : 'Story note', body: section });
  });

  if (event.detailPage?.eventSnapshot) {
    const snapshot = event.detailPage.eventSnapshot;
    const snapshotLines = [
      snapshot.typicalMonth ? `Typical month: ${snapshot.typicalMonth}` : null,
      snapshot.setting ? `Setting: ${snapshot.setting}` : null,
      snapshot.bestFor ? `Best for: ${snapshot.bestFor}` : null,
      snapshot.signatureMoment ? `Signature moment: ${snapshot.signatureMoment}` : null,
    ].filter(Boolean);

    if (snapshotLines.length > 0) {
      details.push({ title: 'Planning snapshot', body: snapshotLines.join(' · ') });
    }
  }

  if (event.atlasNotes?.length) {
    details.push({ title: 'Atlas notes', body: event.atlasNotes.join(' ') });
  }

  if (event.localFlavor?.length) {
    details.push({ title: 'Food and local flavor', body: event.localFlavor.join(' ') });
  }

  if (event.atlasMemories?.length) {
    details.push({ title: 'Memory layer', body: event.atlasMemories.join(' ') });
  }

  if (event.detailPage?.archivalNote) {
    details.push({ title: 'Source note', body: event.detailPage.archivalNote });
  }

  return details;
}

function formatMobileEventDate(event: AtlasEvent): string {
  const start = parseReliableEventDate(event.dateRange?.startDate);
  const end = parseReliableEventDate(event.dateRange?.endDate);

  if (!start) return 'Date TBA';

  const month = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(start);
  const startDay = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(start);

  if (!end || start.getTime() === end.getTime()) {
    return `${month} ${startDay}`;
  }

  const endMonth = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    timeZone: 'UTC',
  }).format(end);
  const endDay = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    timeZone: 'UTC',
  }).format(end);

  if (month === endMonth) {
    return `${month} ${startDay}–${endDay}`;
  }

  return `${month} ${startDay}–${endMonth} ${endDay}`;
}

function getEventThumbnail(event: AtlasEvent):
  | { kind: 'image'; src: string; alt: string; sourceType: 'override' | 'generated' }
  | { kind: 'fallback'; glyph: string; label: string } {
  const explicitThumbnail = resolveExplicitEventThumbnail(event);

  if (explicitThumbnail) {
    return {
      kind: 'image',
      src: explicitThumbnail.path,
      alt: explicitThumbnail.alt,
      sourceType:
        explicitThumbnail.mediaSourceType === 'override'
          ? 'override'
          : 'generated',
    };
  }

  return {
    kind: 'fallback',
    glyph: event.iconType ? FALLBACK_THUMBNAIL_BY_ICON[event.iconType] : '✦',
    label: `${event.category} fallback visual`,
  };
}


function EventThumbnail({
  event,
  variant,
}: {
  event: AtlasEvent;
  variant: 'floating' | 'live' | 'tag';
}) {
  const thumbnail = getEventThumbnail(event);
  const wrapStyle =
    variant === 'live'
      ? styles.eventThumbnailLive
      : variant === 'tag'
        ? styles.eventThumbnailTag
        : styles.eventThumbnailFloating;

  if (thumbnail.kind === 'image') {
    return (
      <span style={{ ...styles.eventThumbnail, ...wrapStyle }} data-thumbnail-source={thumbnail.sourceType}>
        <img
          src={thumbnail.src}
          alt={thumbnail.alt}
          style={styles.eventThumbnailImage}
          loading="lazy"
        />
      </span>
    );
  }

  return (
    <span
      style={{ ...styles.eventThumbnail, ...wrapStyle }}
      role="img"
      aria-label={thumbnail.label}
    >
      <span style={styles.eventThumbnailFallbackGlyph}>{thumbnail.glyph}</span>
    </span>
  );
}

function MapEventCallout({
  event,
}: {
  event: AtlasEvent;
}) {
  const city = event.location.split(',')[0]?.trim() || event.location;

  return (
    <>
      <span style={styles.mapCalloutCopy}>
        <span style={styles.mapCalloutName}>{event.name}</span>
        <span style={styles.mapCalloutCity}>{city}, MI</span>
      </span>
    </>
  );
}

type MarkerPosition = { x: number; y: number };
type MapTransform = { scale: number; translateX: number; translateY: number };
type ActiveMapPointer = { pointerId: number; clientX: number; clientY: number };

type AtlasMarkerLayout = {
  event: AtlasEvent;
  eventIndex: number;
  position: MarkerPosition;
};


const MOBILE_TAG_SAFE_AREA_PERCENT = { left: 5, right: 5, top: 13, bottom: 32 };
const MOBILE_TAG_HEIGHT_PX = 34;
const MOBILE_TAG_MAX_WIDTH_PX = 236;
const MOBILE_TAG_MIN_WIDTH_PX = 118;
const MOBILE_TAG_MEAN_GLYPH_WIDTH_PX = 6.2;
const MOBILE_TAG_MEANINGFUL_MOVE_PX = 12;
const MOBILE_TAG_TAP_BUFFER_PX = 4;
const MOBILE_TAG_SHORT_CONNECTOR_MAX_DX_PX = 96;
const MOBILE_TAG_SHORT_CONNECTOR_MAX_DY_PX = 58;

type MapViewportSize = { width: number; height: number };
type MobileTagPlacementName =
  | 'west-water'
  | 'east-water'
  | 'north-water'
  | 'southwest-margin'
  | 'southeast-column'
  | 'northwest-margin'
  | 'northeast-margin'
  | 'local-left'
  | 'local-right';
type MobileTagPlacement = {
  eventId: string;
  dx: number;
  dy: number;
  moved: boolean;
  placement: MobileTagPlacementName;
  width: number;
  height: number;
  zIndex: number;
};
type MobileTagRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

type MapPresentationMode = MapPresentationPlan['mode'];
type MapCalloutClusterIndicator = {
  id: string;
  hiddenCount: number;
  position: MarkerPosition;
  eventIds: string[];
};
type MapCalloutPlan = {
  eventIds: Set<string>;
  clusterIndicators: MapCalloutClusterIndicator[];
};

const estimateMobileTagWidth = (label: string) =>
  Math.min(
    MOBILE_TAG_MAX_WIDTH_PX,
    Math.max(
      MOBILE_TAG_MIN_WIDTH_PX,
      Math.ceil(label.length * MOBILE_TAG_MEAN_GLYPH_WIDTH_PX) + 58,
    ),
  );

const getMobileTagRect = ({
  marker,
  dx,
  dy,
  width,
  height,
}: {
  marker: { x: number; y: number };
  dx: number;
  dy: number;
  width: number;
  height: number;
}): MobileTagRect => ({
  left: marker.x + dx - width / 2,
  right: marker.x + dx + width / 2,
  top: marker.y + dy - height / 2,
  bottom: marker.y + dy + height / 2,
});

const getMobileTagOverlapArea = (a: MobileTagRect, b: MobileTagRect) => {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
};

const inflateMobileTagRect = (rect: MobileTagRect, buffer: number): MobileTagRect => ({
  left: rect.left - buffer,
  right: rect.right + buffer,
  top: rect.top - buffer,
  bottom: rect.bottom + buffer,
});

const getMobileTagSafeAreaBounds = (viewport: MapViewportSize) => ({
  left: (viewport.width * MOBILE_TAG_SAFE_AREA_PERCENT.left) / 100,
  right: viewport.width - (viewport.width * MOBILE_TAG_SAFE_AREA_PERCENT.right) / 100,
  top: (viewport.height * MOBILE_TAG_SAFE_AREA_PERCENT.top) / 100,
  bottom: viewport.height - (viewport.height * MOBILE_TAG_SAFE_AREA_PERCENT.bottom) / 100,
});

const clampMobileTagToSafeArea = ({
  marker,
  dx,
  dy,
  width,
  height,
  viewport,
}: {
  marker: { x: number; y: number };
  dx: number;
  dy: number;
  width: number;
  height: number;
  viewport: MapViewportSize;
}) => {
  const safeBounds = getMobileTagSafeAreaBounds(viewport);
  const centerX = clamp(marker.x + dx, safeBounds.left + width / 2, safeBounds.right - width / 2);
  const centerY = clamp(marker.y + dy, safeBounds.top + height / 2, safeBounds.bottom - height / 2);

  return {
    dx: centerX - marker.x,
    dy: centerY - marker.y,
  };
};

const getMobileWaterFriendlyCandidates = ({
  marker,
  viewport,
  visibleIndex,
}: {
  marker: { x: number; y: number };
  viewport: MapViewportSize;
  visibleIndex: number;
}): { placement: MobileTagPlacementName; dx: number; dy: number; priority: number }[] => {
  const safeBounds = getMobileTagSafeAreaBounds(viewport);
  const safeWidth = safeBounds.right - safeBounds.left;
  const safeHeight = safeBounds.bottom - safeBounds.top;
  const lane = visibleIndex % 4;
  const staggerY = (lane - 1.5) * 14;
  const rowStaggerX = ((visibleIndex % 3) - 1) * 18;
  const westWaterEdge = safeBounds.left + safeWidth * 0.18;
  const eastWaterEdge = safeBounds.left + safeWidth * 0.82;
  const northWaterY = safeBounds.top + safeHeight * 0.16;
  const quietMidY = safeBounds.top + safeHeight * 0.44 + staggerY;
  const candidates: { placement: MobileTagPlacementName; x: number; y: number; priority: number }[] = [];
  const shortWaterX = (targetX: number) =>
    marker.x + clamp(targetX - marker.x, -MOBILE_TAG_SHORT_CONNECTOR_MAX_DX_PX, MOBILE_TAG_SHORT_CONNECTOR_MAX_DX_PX);
  const shortWaterY = (targetY: number) =>
    marker.y + clamp(targetY - marker.y, -MOBILE_TAG_SHORT_CONNECTOR_MAX_DY_PX, MOBILE_TAG_SHORT_CONNECTOR_MAX_DY_PX);

  if (marker.x < viewport.width * 0.42) {
    candidates.push(
      { placement: 'west-water', x: shortWaterX(westWaterEdge), y: shortWaterY(quietMidY), priority: 0 },
      { placement: 'local-left', x: marker.x - 68, y: marker.y + staggerY, priority: 0.8 },
      { placement: 'northwest-margin', x: shortWaterX(westWaterEdge), y: shortWaterY(northWaterY + lane * 14), priority: 1.4 },
    );
  } else if (marker.x > viewport.width * 0.62) {
    candidates.push(
      { placement: 'east-water', x: shortWaterX(eastWaterEdge), y: shortWaterY(quietMidY), priority: 0 },
      { placement: 'local-right', x: marker.x + 68, y: marker.y + staggerY, priority: 0.8 },
      { placement: 'northeast-margin', x: shortWaterX(eastWaterEdge), y: shortWaterY(northWaterY + lane * 14), priority: 1.4 },
      { placement: 'southeast-column', x: shortWaterX(eastWaterEdge), y: shortWaterY(safeBounds.bottom - 52 - lane * 12), priority: 2.2 },
    );
  } else if (marker.y < viewport.height * 0.36) {
    const sideX = marker.x < viewport.width / 2 ? westWaterEdge : eastWaterEdge;
    candidates.push(
      { placement: 'north-water', x: marker.x + rowStaggerX, y: shortWaterY(northWaterY + lane * 12), priority: 0 },
      { placement: marker.x < viewport.width / 2 ? 'west-water' : 'east-water', x: shortWaterX(sideX), y: marker.y + staggerY, priority: 0.9 },
    );
  } else {
    const primarySideX = visibleIndex % 2 ? eastWaterEdge : westWaterEdge;
    const secondarySideX = visibleIndex % 2 ? westWaterEdge : eastWaterEdge;
    candidates.push(
      { placement: visibleIndex % 2 ? 'east-water' : 'west-water', x: shortWaterX(primarySideX), y: marker.y + staggerY, priority: 0 },
      { placement: visibleIndex % 2 ? 'west-water' : 'east-water', x: shortWaterX(secondarySideX), y: marker.y - staggerY, priority: 1 },
      { placement: 'southwest-margin', x: shortWaterX(westWaterEdge), y: shortWaterY(safeBounds.bottom - 44 - lane * 12), priority: 2.4 },
    );
  }

  return candidates.map((candidate) => ({
    placement: candidate.placement,
    dx: candidate.x - marker.x,
    dy: candidate.y - marker.y,
    priority: candidate.priority,
  }));
};

const resolveMobileSearchTagPlacements = ({
  markerLayouts,
  calloutEventIds,
  viewport,
}: {
  markerLayouts: AtlasMarkerLayout[];
  calloutEventIds: ReadonlySet<string>;
  viewport: MapViewportSize | null;
}): Map<string, MobileTagPlacement> => {
  const placements = new Map<string, MobileTagPlacement>();
  if (!viewport || viewport.width <= 0 || viewport.height <= 0) return placements;

  const placedRects: MobileTagRect[] = [];
  const markerPx = (position: MarkerPosition) => ({
    x: (position.x / 100) * viewport.width,
    y: (position.y / 100) * viewport.height,
  });

  markerLayouts
    .filter((layout) => calloutEventIds.has(layout.event.id))
    .sort((a, b) => a.eventIndex - b.eventIndex)
    .forEach((layout, visibleIndex) => {
      const width = estimateMobileTagWidth(layout.event.name);
      const height = MOBILE_TAG_HEIGHT_PX;
      const marker = markerPx(layout.position);
      const candidates = getMobileWaterFriendlyCandidates({ marker, viewport, visibleIndex });

      const ranked = candidates
        .map((candidate, order) => {
          const clampedCandidate = clampMobileTagToSafeArea({
            marker,
            ...candidate,
            width,
            height,
            viewport,
          });
          const rect = getMobileTagRect({ marker, ...clampedCandidate, width, height });
          const overlap = placedRects.reduce(
            (total, placedRect) => total + getMobileTagOverlapArea(rect, placedRect),
            0,
          );
          const tapOverlap = placedRects.reduce(
            (total, placedRect) =>
              total +
              getMobileTagOverlapArea(
                inflateMobileTagRect(rect, MOBILE_TAG_TAP_BUFFER_PX),
                inflateMobileTagRect(placedRect, MOBILE_TAG_TAP_BUFFER_PX),
              ),
            0,
          );
          const relocation = Math.hypot(clampedCandidate.dx, clampedCandidate.dy);
          const clampPenalty = Math.hypot(
            clampedCandidate.dx - candidate.dx,
            clampedCandidate.dy - candidate.dy,
          );

          return {
            ...candidate,
            ...clampedCandidate,
            rect,
            order,
            score:
              overlap * 14 +
              tapOverlap * 6 +
              clampPenalty * 7 +
              relocation * 1.15 +
              candidate.priority * 95 +
              order,
          };
        })
        .sort((a, b) => a.score - b.score || a.order - b.order);

      const best = ranked[0];
      if (!best) return;

      placedRects.push(best.rect);
      placements.set(layout.event.id, {
        eventId: layout.event.id,
        dx: best.dx,
        dy: best.dy,
        moved: Math.hypot(best.dx, best.dy) > MOBILE_TAG_MEANINGFUL_MOVE_PX,
        placement: best.placement,
        width,
        height,
        zIndex: visibleIndex,
      });
    });

  return placements;
};

const MAX_RESULTS_CALLOUTS = 8;
const MAX_DENSE_AREA_CALLOUTS = 3;
const DENSE_AREA_RADIUS_PERCENT = 8.5;

const getMapPresentationMode = ({
  selectedId,
  exactEventIntent,
  hasSubmittedSearchMatches,
}: {
  selectedId: string | null;
  exactEventIntent: { eventId: string } | null;
  hasSubmittedSearchMatches: boolean;
}): MapPresentationMode => {
  if (selectedId) return 'selected';
  if (exactEventIntent && hasSubmittedSearchMatches) return 'single';
  if (hasSubmittedSearchMatches) return 'results';
  return 'idle';
};

const distanceBetweenMarkerPositions = (a: MarkerPosition, b: MarkerPosition) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const resolveMapCalloutPlan = ({
  mode,
  markerLayouts,
  highlightedIds,
  selectedId,
  exactEventId,
}: {
  mode: MapPresentationMode;
  markerLayouts: AtlasMarkerLayout[];
  highlightedIds: ReadonlySet<string>;
  selectedId: string | null;
  exactEventId: string | null;
}): MapCalloutPlan => {
  if (mode === 'idle') return { eventIds: new Set(), clusterIndicators: [] };

  if (mode === 'selected' && selectedId) {
    return { eventIds: new Set([selectedId]), clusterIndicators: [] };
  }

  if (mode === 'single' && exactEventId) {
    return { eventIds: new Set([exactEventId]), clusterIndicators: [] };
  }

  const candidates = markerLayouts
    .filter((layout) => highlightedIds.has(layout.event.id))
    .sort((a, b) => a.eventIndex - b.eventIndex)
    .slice(0, MAX_RESULTS_CALLOUTS);
  const shownIds = new Set<string>();
  const clusterIndicators: MapCalloutClusterIndicator[] = [];
  const consumedIds = new Set<string>();

  candidates.forEach((candidate) => {
    if (consumedIds.has(candidate.event.id)) return;

    const denseGroup = candidates.filter(
      (layout) =>
        !consumedIds.has(layout.event.id) &&
        distanceBetweenMarkerPositions(layout.position, candidate.position) <= DENSE_AREA_RADIUS_PERCENT,
    );
    const visibleGroup = denseGroup.slice(0, MAX_DENSE_AREA_CALLOUTS);
    const hiddenGroup = denseGroup.slice(MAX_DENSE_AREA_CALLOUTS);

    visibleGroup.forEach((layout) => {
      shownIds.add(layout.event.id);
      consumedIds.add(layout.event.id);
    });

    hiddenGroup.forEach((layout) => consumedIds.add(layout.event.id));

    if (hiddenGroup.length > 0) {
      const anchor = visibleGroup[visibleGroup.length - 1] ?? candidate;
      clusterIndicators.push({
        id: `callout-cluster-${candidate.event.id}`,
        hiddenCount: hiddenGroup.length,
        position: {
          x: clampMarkerPercent(anchor.position.x + 2.4),
          y: clampMarkerPercent(anchor.position.y + 1.8),
        },
        eventIds: hiddenGroup.map((layout) => layout.event.id),
      });
    }
  });

  return { eventIds: shownIds, clusterIndicators };
};



type EventDetailToolCard = {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  featured?: boolean;
};

const ROMEO_EVENT_DETAIL_TOOL_CARDS: readonly EventDetailToolCard[] = [
  { id: 'event-card', title: 'Event Card', subtitle: 'Collect & Save', icon: '✦', featured: true },
  { id: 'festival-schedule', title: 'Festival Schedule', subtitle: 'Full schedule', icon: '▣' },
  { id: 'music-schedule', title: 'Music Schedule', subtitle: 'Lineup & times', icon: '♪' },
  { id: 'watch-live', title: 'Watch Live', subtitle: 'Live moments', icon: '▶' },
  { id: 'participate', title: 'Participate', subtitle: 'Contests & more', icon: '♕' },
  { id: 'tickets-info', title: 'Tickets & Info', subtitle: 'Hours & parking', icon: '◈' },
];

type FlyerMediaDebugSnapshot = {
  intendedSrc?: string;
  attemptedSrc?: string;
  currentSrc?: string;
  loaded: boolean;
  errored: boolean;
};

type AtlasMapProps = {
  constellationHighlightedIds?: readonly string[];
  celebrationSearchHighlightedIds?: readonly string[];
  activeConstellationTitle?: string | null;
  onSearchActivate?: () => void;
  presentationPlan?: MapPresentationPlan;
  flyerResolutions?: EventFlyerResolutionMap;
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
  artworkVariant: MichiganArtworkVariant,
): MarkerPosition => {
  const artworkPosition = projectLatLngToCalibratedMichiganArtworkPosition(
    event.latitude,
    event.longitude,
    artworkVariant,
  );

  const baselinePosition = {
    x: clampMarkerPercent(artworkPosition.x),
    y: clampMarkerPercent(artworkPosition.y),
  };

  if (artworkVariant !== 'mobile') return baselinePosition;

  const upperPeninsulaAnchorPosition =
    resolveExactMichiganMobileUpperPeninsulaAnchorPosition(
      event.latitude,
      event.longitude,
    );

  if (!upperPeninsulaAnchorPosition) return baselinePosition;

  return {
    x: clampMarkerPercent(upperPeninsulaAnchorPosition.x),
    y: clampMarkerPercent(upperPeninsulaAnchorPosition.y),
  };
};

const resolveAtlasMarkerLayouts = (
  events: typeof ATLAS_EVENTS,
  artworkVariant: MichiganArtworkVariant,
): AtlasMarkerLayout[] =>
  events.map((event, eventIndex) => ({
    event,
    eventIndex,
    position: projectEventToMichiganArtworkPosition(event, artworkVariant),
  }));

const isFiniteMarkerPosition = (position: MarkerPosition) =>
  Number.isFinite(position.x) && Number.isFinite(position.y);

const getConstellationPointKey = (position: MarkerPosition) =>
  `point:${position.x.toFixed(3)}:${position.y.toFixed(3)}`;

const resolveConstellationLinePoints = ({
  eventIds,
  markerLayouts,
  isSearchActive,
}: {
  eventIds: readonly string[];
  markerLayouts: AtlasMarkerLayout[];
  isSearchActive: boolean;
}): MarkerPosition[] => {
  if (isSearchActive || eventIds.length === 0) return [];

  const layoutByEventId = new Map(
    markerLayouts.map((layout) => [layout.event.id, layout]),
  );
  const usedPointKeys = new Set<string>();
  const points: MarkerPosition[] = [];

  eventIds.forEach((eventId) => {
    const layout = layoutByEventId.get(eventId);
    const position = layout?.position;

    if (!position || !isFiniteMarkerPosition(position)) return;

    const pointKey = getConstellationPointKey(position);
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
  presentationPlan,
  flyerResolutions = {},
}: AtlasMapProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [displayedQuery, setDisplayedQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [suggestionIndex, setSuggestionIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pressedEventDetailToolId, setPressedEventDetailToolId] = useState<string | null>(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [artworkVariant, setArtworkVariant] =
    useState<MichiganArtworkVariant>('desktop');
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
  const [failedDisplayedFlyerSrcs, setFailedDisplayedFlyerSrcs] = useState<
    Set<string>
  >(new Set());
  const [flyerMediaDebugSnapshot, setFlyerMediaDebugSnapshot] =
    useState<FlyerMediaDebugSnapshot>({ loaded: false, errored: false });
  const largeCardImageRef = useRef<HTMLImageElement | null>(null);

  const searchParams = useSearchParams();
  const isVerificationMode = searchParams.get('verify') === '1';
  const isMediaDebugMode = searchParams.get('mediaDebug') === '1';
  const shouldShowCalibration = showAtlasCalibration && !isVerificationMode;
  const initialEventParamHandledRef = useRef(false);
  const mapFrameRef = useRef<HTMLDivElement | null>(null);
  const [mapViewportSize, setMapViewportSize] = useState<MapViewportSize | null>(null);
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [isMobileFavoriteSaved, setIsMobileFavoriteSaved] = useState(false);
  const [isMobileLandingTitleDismissed, setIsMobileLandingTitleDismissed] = useState(false);
  const [shouldRenderMobileLandingTitle, setShouldRenderMobileLandingTitle] = useState(true);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isSubmittedQueryFading, setIsSubmittedQueryFading] = useState(false);
  const [discoveryStatusText, setDiscoveryStatusText] = useState<string | null>(
    null,
  );
  const [isCardMediaVisible, setIsCardMediaVisible] = useState(false);
  const [failedRemoteFlyerSrcs, setFailedRemoteFlyerSrcs] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const hasLoadedMobileFavoriteRef = useRef(false);
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
  const isSubmittedSearchActive = Boolean(q);
  const hasSubmittedSearchMatches =
    isSubmittedSearchActive && highlightedIds.size > 0;
  const hasSubmittedSearchNoResults =
    isSubmittedSearchActive && highlightedIds.size === 0;
  const discoveryResultRows = useMemo<HomeDiscoveryResultRow[]>(() => {
    if (exactEventIntent || !q || highlightedIds.size === 0) return [];

    return ATLAS_EVENTS.filter((event) => highlightedIds.has(event.id))
      .map((event) => ({
        id: event.id,
        name: event.name,
        location: event.location,
        category: event.category,
        atmosphereLabel: event.atmosphereLabel,
        blurb: event.blurb,
      }));
  }, [exactEventIntent, highlightedIds, q]);
  const markerLayouts = useMemo(
    () => resolveAtlasMarkerLayouts(ATLAS_EVENTS, artworkVariant),
    [artworkVariant],
  );
  const displayMarkerLayouts = markerLayouts;
  const activePresentationPlan = presentationPlan ?? null;
  const fallbackMapPresentationMode = getMapPresentationMode({
    selectedId,
    exactEventIntent,
    hasSubmittedSearchMatches,
  });
  const mapPresentationMode = activePresentationPlan?.mode ?? fallbackMapPresentationMode;
  const mapCalloutPlan = useMemo(() => {
    if (activePresentationPlan) {
      return {
        eventIds: new Set(activePresentationPlan.callouts?.map((callout) => callout.eventId) ?? []),
        clusterIndicators:
          activePresentationPlan.overflowGroups?.map((cluster) => ({
            id: cluster.id,
            hiddenCount: cluster.eventIds.length,
            position: { x: cluster.labelXPercent ?? 50, y: cluster.labelYPercent ?? 50 },
            eventIds: [...cluster.eventIds],
          })) ?? [],
      };
    }

    return resolveMapCalloutPlan({
      mode: mapPresentationMode,
      markerLayouts: displayMarkerLayouts,
      highlightedIds,
      selectedId,
      exactEventId: exactEventIntent?.eventId ?? null,
    });
  }, [
    displayMarkerLayouts,
    exactEventIntent,
    highlightedIds,
    mapPresentationMode,
    activePresentationPlan,
    selectedId,
  ]);
  const isActiveMapResultCalloutVisible =
    (mapPresentationMode === 'results' || mapPresentationMode === 'single') &&
    mapCalloutPlan.eventIds.size > 0;
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
        isSearchActive: isConstellationLineSearchActive,
      }),
    [
      constellationHighlightedIds,
      isConstellationLineSearchActive,
      displayMarkerLayouts,
    ],
  );
  const ambientMobileEvents = ATLAS_EVENTS;
  const isMobileAmbientRailLayoutReady = Boolean(
    mapViewportSize &&
      mapViewportSize.width > 0 &&
      mapViewportSize.height > 0 &&
      ambientMobileEvents.length > 0,
  );
  const mobileSearchTagPlacements = useMemo(() => {
    if (isDesktop || mapPresentationMode === 'idle') return new Map<string, MobileTagPlacement>();

    const calloutsNeedingRemoteLabels = new Set(
      activePresentationPlan?.callouts?.map((callout) => callout.eventId) ?? [],
    );
    const placements = resolveMobileSearchTagPlacements({
      markerLayouts: displayMarkerLayouts,
      calloutEventIds: calloutsNeedingRemoteLabels,
      viewport: mapViewportSize,
    });

    if (!activePresentationPlan || !mapViewportSize) return placements;

    const layoutByEventId = new Map(displayMarkerLayouts.map((layout) => [layout.event.id, layout]));
    activePresentationPlan.callouts?.forEach((callout, index) => {
      if (callout.labelXPercent === undefined || callout.labelYPercent === undefined) return;
      const layout = layoutByEventId.get(callout.eventId);
      if (!layout) return;

      const width = estimateMobileTagWidth(layout.event.name);
      const anchorX = (layout.position.x / 100) * mapViewportSize.width;
      const anchorY = (layout.position.y / 100) * mapViewportSize.height;
      placements.set(callout.eventId, {
        eventId: callout.eventId,
        dx: (callout.labelXPercent / 100) * mapViewportSize.width - anchorX,
        dy: (callout.labelYPercent / 100) * mapViewportSize.height - anchorY,
        moved: true,
        placement: callout.placementZone.startsWith('east') ? 'east-water' : callout.placementZone.startsWith('west') ? 'west-water' : 'north-water',
        width,
        height: MOBILE_TAG_HEIGHT_PX,
        zIndex: index,
      });
    });

    return placements;
  }, [
    displayMarkerLayouts,
    isDesktop,
    mapPresentationMode,
    mapViewportSize,
    activePresentationPlan,
  ]);
  const mobileSearchConnectors = useMemo(() => {
    if (isDesktop || !mapViewportSize || !activePresentationPlan) return [];

    const layoutByEventId = new Map(
      displayMarkerLayouts.map((layout) => [layout.event.id, layout]),
    );

    const connectorEventIds = new Set(
      activePresentationPlan.callouts
        ?.filter((callout) => callout.connector === 'short-elbow')
        .map((callout) => callout.eventId) ?? [],
    );

    return Array.from(mobileSearchTagPlacements.values()).flatMap((placement) => {
      if (!connectorEventIds.has(placement.eventId)) return [];
      const layout = layoutByEventId.get(placement.eventId);
      if (!layout) return [];

      const anchorX = (layout.position.x / 100) * mapViewportSize.width;
      const anchorY = (layout.position.y / 100) * mapViewportSize.height;
      const labelX = anchorX + placement.dx;
      const labelY = anchorY + placement.dy;
      const side = placement.dx >= 0 ? 1 : -1;
      const attachX = labelX - side * (placement.width / 2 - 5);
      const attachY = labelY;
      const horizontalRun = clamp(Math.abs(attachX - anchorX) * 0.55, 16, 38) * side;
      const bendX = anchorX + horizontalRun;
      const bendY = Math.abs(attachY - anchorY) < 8 ? anchorY : attachY;
      const path = Math.abs(attachY - anchorY) < 8
        ? `M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)} L ${attachX.toFixed(1)} ${anchorY.toFixed(1)}`
        : `M ${anchorX.toFixed(1)} ${anchorY.toFixed(1)} L ${bendX.toFixed(1)} ${anchorY.toFixed(1)} L ${attachX.toFixed(1)} ${bendY.toFixed(1)}`;

      return [{
        eventId: placement.eventId,
        anchorX,
        anchorY,
        path,
        zIndex: placement.zIndex,
      }];
    });
  }, [displayMarkerLayouts, isDesktop, mapViewportSize, mobileSearchTagPlacements, activePresentationPlan]);
  const visibleMarkerGroups = displayMarkerLayouts
    .filter((layout) => {
      if (mapPresentationMode === 'single' && exactEventIntent) return layout.event.id === exactEventIntent.eventId;
      if (activePresentationPlan) return activePresentationPlan.visibleEventIds.includes(layout.event.id);
      if (mapPresentationMode === 'results') return highlightedIds.has(layout.event.id);

      return true;
    })
    .map((layout) => ({
      id: mapPresentationMode === 'single' ? `exact-${layout.event.id}` : `event-${layout.event.id}`,
      events: [layout.event],
      eventIndices: [layout.eventIndex],
      position: layout.position,
    }));

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
    ? deriveSafeAtlasEventCard(renderedEvent, flyerResolutions)
    : null;
  const selectedMedia = safeEventCard?.media;
  const largeCardThumbnail = renderedEvent
    ? getEventThumbnail(renderedEvent)
    : null;
  const resolvedLargeCardImageSrc =
    selectedMedia?.flyerSrc ??
    selectedMedia?.posterSrc ??
    selectedMedia?.mediaSrc ??
    (largeCardThumbnail?.kind === 'image' ? largeCardThumbnail.src : undefined);
  const shouldUseFlyerFallback =
    Boolean(
      selectedMedia?.flyerSrc &&
        selectedMedia.flyerFallbackSrc &&
        selectedMedia.flyerFallbackSrc !== selectedMedia.flyerSrc &&
        failedRemoteFlyerSrcs.has(selectedMedia.flyerSrc),
    );
  const largeCardBackgroundImageSrc =
    shouldUseFlyerFallback && selectedMedia?.flyerFallbackSrc
      ? selectedMedia.flyerFallbackSrc
      : resolvedLargeCardImageSrc;
  const displayedLargeCardImageSrc =
    largeCardBackgroundImageSrc &&
    !failedDisplayedFlyerSrcs.has(largeCardBackgroundImageSrc)
      ? largeCardBackgroundImageSrc
      : undefined;
  const hasCardMedia = Boolean(selectedMedia || displayedLargeCardImageSrc);
  const hasCardMediaSource = Boolean(displayedLargeCardImageSrc);
  const isFlyerCard = Boolean(selectedMedia?.flyerSrc);
  const largeCardDateRange = renderedEvent ? formatEventDateRange(renderedEvent) : null;
  const largeCardStoryDetails = renderedEvent ? getEventStoryDetails(renderedEvent) : [];
  const fullCardBriefing = renderedEvent?.fullCardBriefing;
  const mediaFadeDurationMs = selectedMedia?.mediaFadeDurationMs ?? 1300;
  const mediaDelayMs = selectedMedia?.mediaDelayMs ?? 0;
  const selectedFlyerSrc = selectedMedia?.flyerSrc;
  const selectedFlyerFallbackSrc = selectedMedia?.flyerFallbackSrc;
  const displayedFlyerSourceKind = displayedLargeCardImageSrc?.startsWith('https://')
    ? 'Supabase'
    : displayedLargeCardImageSrc?.startsWith('/')
      ? 'local'
      : 'none';
  const isRomeoFlyerMediaDebug = Boolean(
    isMediaDebugMode && safeEventCard?.id === 'romeo-peach' && isFlyerCard,
  );
  const handleLargeCardImageLoad = (event: SyntheticEvent<HTMLImageElement>) => {
    setFlyerMediaDebugSnapshot({
      intendedSrc: selectedFlyerSrc,
      attemptedSrc: largeCardBackgroundImageSrc,
      currentSrc: event.currentTarget.currentSrc,
      loaded: true,
      errored: false,
    });
  };
  const handleLargeCardImageError = (event: SyntheticEvent<HTMLImageElement>) => {
    setFlyerMediaDebugSnapshot({
      intendedSrc: selectedFlyerSrc,
      attemptedSrc: largeCardBackgroundImageSrc,
      currentSrc: event.currentTarget.currentSrc,
      loaded: false,
      errored: true,
    });
    if (
      !selectedFlyerSrc ||
      !selectedFlyerFallbackSrc ||
      selectedFlyerFallbackSrc === selectedFlyerSrc ||
      largeCardBackgroundImageSrc !== selectedFlyerSrc
    ) {
      if (largeCardBackgroundImageSrc) {
        setFailedDisplayedFlyerSrcs((current) => {
          if (current.has(largeCardBackgroundImageSrc)) return current;
          const next = new Set(current);
          next.add(largeCardBackgroundImageSrc);
          return next;
        });
      }
      return;
    }

    setFailedRemoteFlyerSrcs((current) => {
      if (current.has(selectedFlyerSrc as string)) return current;
      const next = new Set(current);
      next.add(selectedFlyerSrc as string);
      return next;
    });
  };

  useEffect(() => {
    if (!isRomeoFlyerMediaDebug) return;

    setFlyerMediaDebugSnapshot({
      intendedSrc: selectedFlyerSrc,
      attemptedSrc: largeCardBackgroundImageSrc,
      currentSrc: largeCardImageRef.current?.currentSrc,
      loaded: false,
      errored: false,
    });

    const animationFrame = window.requestAnimationFrame(() => {
      setFlyerMediaDebugSnapshot((current) => ({
        ...current,
        currentSrc: largeCardImageRef.current?.currentSrc ?? current.currentSrc,
      }));
    });

    return () => window.cancelAnimationFrame(animationFrame);
  }, [
    isRomeoFlyerMediaDebug,
    largeCardBackgroundImageSrc,
    selectedFlyerSrc,
  ]);

  const cardBaseTheme = safeEventCard
    ? CARD_THEME_BY_CATEGORY[safeEventCard.category]
    : CARD_THEME_BY_CATEGORY.Festivals;
  const cardTheme = blendCardTheme(
    cardBaseTheme,
    renderedEvent?.regionAtmosphere,
  );

  useEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return;

    const syncMapViewportSize = () => {
      const rect = frame.getBoundingClientRect();
      setMapViewportSize({ width: rect.width, height: rect.height });
    };

    syncMapViewportSize();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncMapViewportSize);
      return () => window.removeEventListener('resize', syncMapViewportSize);
    }

    const observer = new ResizeObserver(syncMapViewportSize);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

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
        const shouldLetPhoneLandscapeScroll =
          isPhoneLandscape && mapTransform.scale <= MAP_ZOOM_MIN_SCALE;
        if (shouldLetPhoneLandscapeScroll) return;

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
    [isPhoneLandscape, mapTransform.scale],
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
    if (!selectedId) return;

    const target = event.target as Node;
    if (cardRef.current?.contains(target)) return;
    if (mapFrameRef.current?.contains(target)) {
      setSelectedId(null);
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
      if (!selectedEvent) return;
      const selectedThumbnail = getEventThumbnail(selectedEvent);
      if (
        selectedThumbnail.kind !== 'image' &&
        !selectedEvent.cardMedia?.mediaSrc &&
        !selectedEvent.cardMedia?.posterSrc
      ) {
        return;
      }
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
    const landingTitleLoadTimer = window.setTimeout(() => {
      try {
        const wasDismissed =
          window.sessionStorage.getItem(MOBILE_LANDING_TITLE_SESSION_KEY) === 'true';
        setIsMobileLandingTitleDismissed(wasDismissed);
        setShouldRenderMobileLandingTitle(!wasDismissed);
      } catch {
        setIsMobileLandingTitleDismissed(false);
        setShouldRenderMobileLandingTitle(true);
      }
    }, 0);

    return () => window.clearTimeout(landingTitleLoadTimer);
  }, []);

  const dismissMobileLandingTitle = useCallback(() => {
    setIsMobileLandingTitleDismissed((wasDismissed) => {
      if (wasDismissed) return wasDismissed;
      try {
        window.sessionStorage.setItem(MOBILE_LANDING_TITLE_SESSION_KEY, 'true');
      } catch {
        // The title still dismisses for this mounted visit if session storage is unavailable.
      }
      return true;
    });

    if (prefersReducedMotion) {
      setShouldRenderMobileLandingTitle(false);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!isActiveMapResultCalloutVisible) return;
    const dismissalTimer = window.setTimeout(dismissMobileLandingTitle, 0);
    return () => window.clearTimeout(dismissalTimer);
  }, [dismissMobileLandingTitle, isActiveMapResultCalloutVisible]);

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
      setSelectedId(null);
      setDiscoveryStatusText(null);
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
    const mobileArtworkQuery = window.matchMedia(
      MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY,
    );
    const syncArtworkVariant = () =>
      setArtworkVariant(mobileArtworkQuery.matches ? 'mobile' : 'desktop');
    syncArtworkVariant();
    mobileArtworkQuery.addEventListener('change', syncArtworkVariant);

    return () => {
      mobileArtworkQuery.removeEventListener('change', syncArtworkVariant);
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
    const favoriteLoadTimer = window.setTimeout(() => {
      try {
        setIsMobileFavoriteSaved(
          window.localStorage.getItem(MOBILE_FAVORITE_STORAGE_KEY) === 'true',
        );
      } catch {
        setIsMobileFavoriteSaved(false);
      } finally {
        hasLoadedMobileFavoriteRef.current = true;
      }
    }, 0);

    return () => window.clearTimeout(favoriteLoadTimer);
  }, []);

  useEffect(() => {
    if (!hasLoadedMobileFavoriteRef.current) return;
    try {
      window.localStorage.setItem(
        MOBILE_FAVORITE_STORAGE_KEY,
        isMobileFavoriteSaved ? 'true' : 'false',
      );
    } catch {
      // Favorites still provide a polished visual toggle if storage is unavailable.
    }
  }, [isMobileFavoriteSaved]);

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
    const shouldLockStoryCardScroll = Boolean(renderedEvent);
    document.documentElement.classList.toggle('atlas-story-card-open', shouldLockStoryCardScroll);
    document.body.classList.toggle('atlas-story-card-open', shouldLockStoryCardScroll);

    return () => {
      document.documentElement.classList.remove('atlas-story-card-open');
      document.body.classList.remove('atlas-story-card-open');
    };
  }, [renderedEvent]);

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

  const isAtlasPanelOpen = Boolean(renderedEvent);
  const isStoryCardOpen = Boolean(renderedEvent);
  const hasSelectedEventCardOpen = Boolean(renderedEvent);
  const shouldShowMobileChromeControls =
    !isDesktop && !isPhoneLandscape && !exactEventIntent && !isAtlasPanelOpen;
  // Keep exact-search state separate from selected-card state so the mobile
  // event rail stays available for active exact searches until a flyer/card is
  // actually opened.
  const shouldShowMobileAmbientAtlas =
    !isDesktop && !isPhoneLandscape && !isAtlasPanelOpen && !hasSelectedEventCardOpen;
  const shouldShowMobileLandingTitle =
    !isDesktop &&
    !isPhoneLandscape &&
    shouldRenderMobileLandingTitle;
  const mobileLandingTitleState = isMobileLandingTitleDismissed ? 'dismissed' : 'idle';

  const isMapAtMinimumZoom = mapTransform.scale <= MAP_ZOOM_MIN_SCALE;
  const shouldAllowPhoneLandscapeNativeScroll =
    isPhoneLandscape && isMapAtMinimumZoom;
  const mobileAmbientMapScale = 1;
  const mobileAmbientMapLift = shouldShowMobileAmbientAtlas ? -22 : 0;
  const mobileLandingMapLowering = shouldShowMobileAmbientAtlas
    ? MOBILE_LANDING_MAP_LOWERING
    : '0px';
  const mapLayerScale =
    (isPhoneLandscape ? 1 : BASE_SCALE) * mapTransform.scale * mobileAmbientMapScale;
  const mapLayerTranslateX =
    mapTransform.translateX + (prefersReducedMotion ? 0 : parallaxOffset.x * 0.55);
  const mapLayerTranslateY =
    mapTransform.translateY +
    (prefersReducedMotion ? 0 : parallaxOffset.y * 0.55) +
    mobileAmbientMapLift;
  const mapLayerTransform = `translate3d(${mapLayerTranslateX}px, calc(${mapLayerTranslateY}px + ${mobileLandingMapLowering}), 0) scale(${mapLayerScale})`;

  return (
    <section
      className={[
        'atlas-hero',
        isPhoneLandscape ? 'atlas-hero--phone-landscape' : '',
        isAtlasPanelOpen ? 'atlas-hero--card-open' : '',
        isStoryCardOpen ? 'atlas-hero--story-card-open' : '',
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
          touchAction: shouldAllowPhoneLandscapeNativeScroll ? 'pan-y' : 'none',
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
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/maps/michigan-atlas-base-tall.webp"
            />
            <img
              className="atlas-map-image atlas-map-image--atmosphere"
              src="/maps/michigan-atlas-base.webp"
              alt=""
              aria-hidden
              draggable={false}
              style={styles.atmosphereMapImage}
            />
          </picture>
        </div>

        <div
          style={{
            ...styles.mapContent,
            touchAction: shouldAllowPhoneLandscapeNativeScroll ? 'pan-y' : 'none',
            transform: mapLayerTransform,
          }}
        >
          <picture>
            <source
              media="(max-width: 767px)"
              srcSet="/maps/michigan-atlas-base-tall.webp"
            />
            <img
              className="atlas-map-image"
              src="/maps/michigan-atlas-base.webp"
              alt="Michigan Atlas"
              draggable={false}
              style={styles.mapImage}
            />
          </picture>

          <div
            style={{
              ...styles.baseMapGrade,
              transform: `translate3d(${prefersReducedMotion ? 0 : parallaxOffset.x * 0.28}px, ${prefersReducedMotion ? 0 : parallaxOffset.y * 0.28}px, 0)`,
            }}
          />

          {!shouldShowCalibration && !isVerificationMode && isDesktop ? (
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

          {!shouldShowCalibration && !isVerificationMode && isDesktop ? (
            <ConstellationLineLayer points={constellationLinePoints} />
          ) : null}

          {isVerificationMode ? <VerificationReferenceLayer /> : null}

          <div style={styles.vignette} />
        </div>

        {!shouldShowCalibration ? (
          <div
            style={{
              ...styles.markerOverlayLayer,
              touchAction: shouldAllowPhoneLandscapeNativeScroll
                ? 'pan-y'
                : 'none',
              transform: mapLayerTransform,
            }}
          >
            {isDesktop && mobileSearchConnectors.length > 0 && mapViewportSize ? (
              <svg
                aria-hidden="true"
                style={styles.mobileCalloutConnectorLayer}
                viewBox={`0 0 ${mapViewportSize.width} ${mapViewportSize.height}`}
                preserveAspectRatio="none"
              >
                {mobileSearchConnectors.map((connector) => (
                  <g key={connector.eventId} style={{ opacity: 0.72 }}>
                    <path
                      d={connector.path}
                      fill="none"
                      stroke="rgba(255, 213, 128, 0.12)"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d={connector.path}
                      fill="none"
                      stroke="rgba(255, 235, 190, 0.58)"
                      strokeWidth="0.85"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                ))}
              </svg>
            ) : null}
            {(isVerificationMode
              ? markerLayouts.map((layout) => ({
                    id: `verification-${layout.event.id}`,
                    events: [layout.event],
                    eventIndices: [layout.eventIndex],
                    position: layout.position,
                  }))
                : visibleMarkerGroups
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
                  : false;
                const isDimmed = highlightedIds.size > 0 && !isHighlighted;
                const isExactEventMarker = Boolean(exactHighlightedEvent);
                const isExactRevealMarker = isExactEventMarker;
                const isSelectedMarker = Boolean(isSelected);
                const isStrongActiveMarker = Boolean(
                  isSelectedMarker || isExactRevealMarker,
                );
                const shouldRenderStarburstMarker = Boolean(
                  isDesktop &&
                    !isCluster &&
                    (isHighlighted || isSelectedMarker || isExactRevealMarker),
                );
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
                const markerStateClass = isCluster
                  ? 'marker-pulse--cluster'
                  : isExactRevealMarker
                    ? 'marker-pulse--exact-reveal'
                    : isSelectedMarker
                      ? 'marker-pulse--selected'
                      : isHighlighted
                        ? 'marker-pulse--broad-highlighted'
                        : 'marker-pulse--inactive';
                const pulseDuration = isExactRevealMarker
                  ? 1.9
                  : isSelectedMarker
                    ? 3.4
                    : isHighlighted
                      ? 2.65
                      : 3.15 + (firstEventIndex % 3) * 0.32;
                const pulseDelay = firstEventIndex * 0.26;
                const markerLayerLift = isStrongActiveMarker
                  ? 34
                  : isHighlighted
                    ? 20
                    : isCluster
                      ? 10
                      : 0;
                const markerScaleBase = isCluster
                  ? Math.min(
                      isStrongActiveMarker ? 1.76 : 1.58,
                      1.16 +
                        events.length * 0.09 +
                        (isStrongActiveMarker ? 0.18 : isHighlighted ? 0.08 : 0),
                    )
                  : isExactRevealMarker
                    ? 1.86
                    : isSelectedMarker
                      ? 1.76
                    : isHighlighted
                      ? 1.36
                      : 1;
                const markerLabelEvent = exactHighlightedEvent ??
                  (!isCluster ? primaryEvent : null);
                const shouldShowMarkerLabel = !isCluster && markerLabelEvent
                  ? mapCalloutPlan.eventIds.has(markerLabelEvent.id)
                  : false;
                const mobileTagPlacement = markerLabelEvent
                  ? mobileSearchTagPlacements.get(markerLabelEvent.id)
                  : null;
                const shouldUseMobileTagPlacement = Boolean(
                  shouldShowMarkerLabel && mobileTagPlacement && !isDesktop,
                );
                const mobileTagDx = mobileTagPlacement?.dx ?? 0;
                const mobileTagDy = mobileTagPlacement?.dy ?? 0;
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
                              if (exactEventOpenTimerRef.current) {
                                clearTimeout(exactEventOpenTimerRef.current);
                                exactEventOpenTimerRef.current = null;
                              }
                              if (exactHighlightedEvent) {
                                setSelectedId(exactHighlightedEvent.id);
                                return;
                              }

                              setSelectedId(primaryEvent.id);
                            }}
                            style={{
                              ...styles.markerTapTarget,
                              ...(isCluster ? styles.clusterTapTarget : null),
                              opacity: isDimmed && isDesktop ? (exactEventIntent ? 0.08 : 0.28) : 1,
                            }}
                          >
                            {isDesktop ? (
                            <span
                              aria-hidden="true"
                              className={`marker-pulse atlas-marker ${markerStateClass}${
                                isHighlighted ? ' marker-pulse--highlighted' : ''
                              }${
                                isStrongActiveMarker
                                  ? ' marker-pulse--strong-active'
                                  : ''
                              }${
                                isExactRevealMarker ? ' atlas-marker--exact' : ''
                              }`}
                              data-atlas-marker-state={
                                isExactRevealMarker
                                  ? 'exact-event'
                                  : isSelectedMarker
                                    ? 'selected'
                                    : isHighlighted
                                      ? 'broad-highlighted'
                                      : isCluster
                                        ? 'cluster'
                                        : 'inactive'
                              }
                              data-atlas-exact-event={
                                isExactRevealMarker ? primaryEvent.id : undefined
                              }
                              style={
                                {
                                  ...(isCluster
                                    ? styles.clusterMarker
                                    : styles.marker),
                                  '--marker-scale-base': markerScaleBase,
                                  '--marker-shadow-idle': isCluster
                                    ? isStrongActiveMarker
                                      ? '0 0 0 2px rgba(255,250,226,.26), 0 0 18px rgba(255,248,220,.88), 0 0 48px rgba(255,216,122,.66), 0 0 96px rgba(220,145,48,.34), 0 0 142px rgba(145,81,30,.18)'
                                      : isHighlighted
                                        ? '0 0 12px rgba(255,244,214,.76), 0 0 34px rgba(255,205,106,.52), 0 0 72px rgba(211,132,43,.26), 0 0 112px rgba(145,81,30,.13)'
                                        : '0 0 9px rgba(255,232,184,.5), 0 0 26px rgba(242,178,77,.34), 0 0 56px rgba(186,111,40,.19), 0 0 86px rgba(128,72,29,.1)'
                                    : isExactRevealMarker
                                      ? '0 0 8px rgba(255,255,244,.54), 0 0 18px rgba(255,226,142,.32), 0 0 30px rgba(255,187,76,.14)'
                                      : isStrongActiveMarker
                                        ? '0 0 7px rgba(255,254,242,.48), 0 0 16px rgba(255,224,138,.3), 0 0 26px rgba(223,146,48,.12)'
                                        : isHighlighted
                                        ? '0 0 6px rgba(255,249,226,.44), 0 0 14px rgba(255,210,112,.24), 0 0 22px rgba(223,146,48,.1)'
                                        : markerBaseShadows.idle,
                                  '--marker-shadow-peak': isCluster
                                    ? isStrongActiveMarker
                                      ? '0 0 0 3px rgba(255,252,235,.34), 0 0 22px rgba(255,254,242,.96), 0 0 60px rgba(255,226,142,.82), 0 0 112px rgba(225,151,52,.42), 0 0 160px rgba(145,81,30,.22)'
                                      : isHighlighted
                                        ? '0 0 14px rgba(255,248,224,.84), 0 0 42px rgba(255,214,122,.62), 0 0 86px rgba(217,140,45,.32), 0 0 130px rgba(145,81,30,.15)'
                                        : '0 0 11px rgba(255,238,197,.58), 0 0 32px rgba(248,190,88,.42), 0 0 66px rgba(196,120,42,.23), 0 0 100px rgba(128,72,29,.12)'
                                    : isExactRevealMarker
                                      ? '0 0 10px rgba(255,255,248,.68), 0 0 24px rgba(255,232,152,.42), 0 0 38px rgba(255,194,86,.18)'
                                      : isStrongActiveMarker
                                        ? '0 0 9px rgba(255,254,242,.6), 0 0 22px rgba(255,228,146,.38), 0 0 34px rgba(223,146,48,.16)'
                                        : isHighlighted
                                        ? '0 0 8px rgba(255,252,234,.52), 0 0 18px rgba(255,218,130,.3), 0 0 28px rgba(223,146,48,.12)'
                                        : markerBaseShadows.peak,
                                  animationDuration: `${pulseDuration}s`,
                                  animationDelay: `${pulseDelay}s`,
                                  '--marker-star-pulse-duration': `${pulseDuration}s`,
                                } as CSSProperties
                              }
                            >
                              {shouldRenderStarburstMarker ? (
                                <svg
                                  aria-hidden="true"
                                  className="atlas-marker-starburst"
                                  viewBox="0 0 100 100"
                                  focusable="false"
                                >
                                  <defs>
                                    <radialGradient
                                      id={`marker-starburst-core-${id}`}
                                      cx="50%"
                                      cy="50%"
                                      r="50%"
                                    >
                                      <stop offset="0%" stopColor="#fff" />
                                      <stop offset="28%" stopColor="#fffdf0" />
                                      <stop
                                        offset="56%"
                                        stopColor="#ffe28a"
                                        stopOpacity="0.9"
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#ffb84c"
                                        stopOpacity="0"
                                      />
                                    </radialGradient>
                                    <radialGradient
                                      id={`marker-starburst-bloom-${id}`}
                                      cx="50%"
                                      cy="50%"
                                      r="50%"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="#fffdf4"
                                        stopOpacity="0.72"
                                      />
                                      <stop
                                        offset="44%"
                                        stopColor="#ffd46f"
                                        stopOpacity="0.24"
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#ffad3f"
                                        stopOpacity="0"
                                      />
                                    </radialGradient>
                                  </defs>
                                  <circle
                                    className="atlas-marker-starburst__bloom"
                                    cx="50"
                                    cy="50"
                                    r="23"
                                    fill={`url(#marker-starburst-bloom-${id})`}
                                  />
                                  <g className="atlas-marker-starburst__rays atlas-marker-starburst__rays--diagonal">
                                    <path d="M32 30 53 47 68 70 47 53Z" />
                                    <path d="M68 30 53 47 32 70 47 53Z" />
                                  </g>
                                  <g className="atlas-marker-starburst__rays atlas-marker-starburst__rays--primary">
                                    <path d="M50 3 55.6 43.4 50 50 44.4 43.4Z" />
                                    <path d="M97 50 56.6 55.6 50 50 56.6 44.4Z" />
                                    <path d="M50 97 44.4 56.6 50 50 55.6 56.6Z" />
                                    <path d="M3 50 43.4 44.4 50 50 43.4 55.6Z" />
                                  </g>
                                  <circle
                                    className="atlas-marker-starburst__center"
                                    cx="50"
                                    cy="50"
                                    r="11"
                                    fill={`url(#marker-starburst-core-${id})`}
                                  />
                                  <circle
                                    className="atlas-marker-starburst__point"
                                    cx="50"
                                    cy="50"
                                    r="3.8"
                                  />
                                </svg>
                              ) : null}
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
                              if (exactEventOpenTimerRef.current) {
                                clearTimeout(exactEventOpenTimerRef.current);
                                exactEventOpenTimerRef.current = null;
                              }
                              if (exactHighlightedEvent) {
                                setSelectedId(exactHighlightedEvent.id);
                                return;
                              }

                              setSelectedId(primaryEvent.id);
                            }}
                            style={{
                              ...styles.markerLabel,
                              ...(isCluster ? styles.clusterLabel : null),
                              zIndex: shouldUseMobileTagPlacement
                                ? Z_INDEX.markers + 22 + (mobileTagPlacement?.zIndex ?? 0)
                                : undefined,
                              top: shouldUseMobileTagPlacement ? '50%' : undefined,
                              width: shouldUseMobileTagPlacement
                                ? mobileTagPlacement?.width
                                : undefined,
                              opacity: shouldShowMarkerLabel ? 1 : 0,
                              transform: shouldUseMobileTagPlacement
                                ? `translate(calc(-50% + ${mobileTagDx}px), calc(-50% + ${mobileTagDy}px))`
                                : shouldShowMarkerLabel
                                  ? 'translate(-50%, -122%)'
                                  : 'translate(-50%, -116%)',
                              pointerEvents: shouldShowMarkerLabel
                                ? 'auto'
                                : 'none',
                            }}
                          >
                            {markerLabelEvent ? (
                              <MapEventCallout event={markerLabelEvent} />
                            ) : (
                              `${events.length} celebrations`
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            {isDesktop ? mapCalloutPlan.clusterIndicators.map((cluster) => (
              <button
                key={cluster.id}
                type="button"
                aria-label={`Show ${cluster.hiddenCount} more nearby celebrations`}
                style={{
                  ...styles.calloutClusterIndicator,
                  left: `${cluster.position.x}%`,
                  top: `${cluster.position.y}%`,
                }}
                data-cluster-event-ids={cluster.eventIds.join(',')}
              >
                +{cluster.hiddenCount}
              </button>
            )) : null}
          </div>
        ) : null}
      </div>

      {shouldShowCalibration ? (
        <AtlasCalibrationPanel
          anchors={calibrationAnchors}
          copyStatus={calibrationCopyStatus}
          onCopy={handleCopyCalibrationJson}
          onReset={handleResetCalibrationAnchors}
        />
      ) : null}

      {shouldShowMobileChromeControls ? (
        <>
          <div style={styles.mobileChromeControls} aria-label="Mobile atlas controls">
            <button type="button" aria-label="Open Michigan atlas menu" aria-expanded={isMobileMenuOpen} className="mobile-chrome-button" style={styles.mobileChromeButton} onClick={() => setIsMobileMenuOpen(true)}>
              <span aria-hidden="true" style={styles.mobileHamburgerIcon}>☰</span>
            </button>
            <button type="button" aria-label={isMobileFavoriteSaved ? 'Remove Michigan from favorites' : 'Save Michigan to favorites'} aria-pressed={isMobileFavoriteSaved} className="mobile-chrome-button" style={{ ...styles.mobileChromeButton, ...styles.mobileFavoriteButton, ...(isMobileFavoriteSaved ? styles.mobileFavoriteButtonActive : null) }} onClick={() => setIsMobileFavoriteSaved((isSaved) => !isSaved)}>
              <span aria-hidden="true">{isMobileFavoriteSaved ? '♥' : '♡'}</span>
            </button>
          </div>
          <div style={styles.mobileSideControls} aria-label="Mobile map tools">
            <button type="button" aria-label="Open atlas filters" aria-expanded={isMobileFilterOpen} className="mobile-tool-button" style={styles.mobileToolButton} onClick={() => setIsMobileFilterOpen(true)}>
              <span aria-hidden="true">☷</span>
              <span style={styles.mobileToolLabel}>Filters</span>
            </button>
          </div>
        </>
      ) : null}

      {shouldShowMobileLandingTitle ? (
        <header
          className={`mobile-atlas-identity mobile-atlas-identity--${mobileLandingTitleState}`}
          style={styles.mobileAtlasIdentity}
          aria-label="Celebration Atlas Michigan"
          onTransitionEnd={(event) => {
            if (event.currentTarget !== event.target) return;
            if (!isMobileLandingTitleDismissed) return;
            setShouldRenderMobileLandingTitle(false);
          }}
        >
          <span
            className="mobile-atlas-identity-scrim"
            aria-hidden="true"
            style={styles.mobileAtlasIdentityScrim}
          />
          {/* eslint-disable-next-line @next/next/no-img-element -- Title artwork must render as the approved transparent brand asset without layout-driven image optimization wrappers. */}
          <img
            className="mobile-atlas-title-artwork"
            src={MICHIGAN_TITLE_ARTWORK_SRC}
            alt="Celebration Atlas Michigan"
            draggable={false}
            style={styles.mobileAtlasTitleArtwork}
          />
        </header>
      ) : null}

      {shouldShowMobileChromeControls && isMobileMenuOpen ? (
        <div style={styles.mobileSheetOverlay} onClick={() => setIsMobileMenuOpen(false)}>
          <nav aria-label="Michigan atlas menu" style={styles.mobileMenuSheet} onClick={(event) => event.stopPropagation()}>
            <div style={styles.mobileSheetHandle} />
            <p style={styles.mobileSheetKicker}>Celebration Atlas</p>
            {MOBILE_MENU_ITEMS.map((item) => (
              <button key={item} type="button" style={styles.mobileMenuItem} onClick={() => setIsMobileMenuOpen(false)}>{item}</button>
            ))}
          </nav>
        </div>
      ) : null}

      {shouldShowMobileChromeControls && isMobileFilterOpen ? (
        <div style={styles.mobileSheetOverlay} onClick={() => setIsMobileFilterOpen(false)}>
          <section aria-label="Michigan atlas filters" style={styles.mobileFilterSheet} onClick={(event) => event.stopPropagation()}>
            <div style={styles.mobileSheetHandle} />
            <div style={styles.mobileFilterHeader}>
              <div>
                <p style={styles.mobileSheetKicker}>Refine Michigan</p>
                <h2 style={styles.mobileSheetTitle}>Filters</h2>
              </div>
              <button type="button" style={styles.mobileSheetCloseButton} onClick={() => setIsMobileFilterOpen(false)} aria-label="Close filters">×</button>
            </div>
            {MOBILE_FILTER_FIELDS.map((field) => (
              <button key={field} type="button" style={styles.mobileFilterRow}>
                <span>{field}</span>
                <span style={styles.mobileFilterRowMeta}>Coming soon</span>
              </button>
            ))}
          </section>
        </div>
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

      {!shouldShowCalibration && !isVerificationMode && renderedEvent && safeEventCard ? (
        <div className="atlas-card-backdrop" aria-hidden="true" />
      ) : null}

      {!shouldShowCalibration && !isVerificationMode && renderedEvent && safeEventCard ? (
        <article
          ref={cardRef}
          className={`atlas-card${isFlyerCard ? ' atlas-card--flyer' : ''}`}
          style={{
            ...styles.card,
            ...(isFlyerCard ? styles.flyerCard : null),
            borderColor: cardTheme.edge,
            boxShadow: isFlyerCard
              ? 'none'
              : `inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px ${cardTheme.glow}, 0 16px 36px rgba(0,0,0,.32)`,
            background: isFlyerCard ? 'transparent' : 'rgba(7,10,15,.24)',
            opacity: isCardVisible ? 1 : 0,
            transform: isCardVisible
              ? 'translateY(var(--atlas-card-open-y, 0px))'
              : `translateY(calc(var(--atlas-card-open-y, 0px) + ${cardEnterOffset}px))`,
            pointerEvents: isCardVisible ? 'auto' : 'none',
            transition: isCardVisible
              ? 'opacity 360ms ease, transform 360ms ease'
              : 'opacity 260ms ease, transform 260ms ease',
            ...(isFlyerCard ? styles.flyerCardChromeReset : null),
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
          {isFlyerCard ? (
            <div style={styles.eventDetailSheet}>
              {hasCardMedia && hasCardMediaSource ? (
                <figure style={styles.eventDetailFlyerHero}>
                  <img
                    ref={largeCardImageRef}
                    src={displayedLargeCardImageSrc}
                    alt={`${safeEventCard.name} flyer`}
                    onLoad={handleLargeCardImageLoad}
                    onError={handleLargeCardImageError}
                    style={{
                      ...styles.eventDetailFlyerImage,
                      opacity: isCardMediaVisible ? 1 : 0,
                      transitionDuration: `${mediaFadeDurationMs}ms`,
                    }}
                  />
                </figure>
              ) : (
                <div style={styles.flyerUnavailableState} role="status">
                  <strong>{safeEventCard.name} flyer unavailable</strong>
                  <span>The flyer image could not be loaded right now.</span>
                </div>
              )}
              {isRomeoFlyerMediaDebug ? (
                <div style={styles.flyerMediaDebugPanel} aria-label="Romeo flyer media debug">
                  <div>intended flyer src: {selectedFlyerSrc ?? 'none'}</div>
                  <div>actual currentSrc: {flyerMediaDebugSnapshot.currentSrc ?? 'not rendered yet'}</div>
                  <div>load fired: {flyerMediaDebugSnapshot.loaded ? 'yes' : 'no'}</div>
                  <div>error fired: {flyerMediaDebugSnapshot.errored ? 'yes' : 'no'}</div>
                  <div>fallback src: {selectedFlyerFallbackSrc ?? 'none'}</div>
                  <div>displayed source kind: {displayedFlyerSourceKind}</div>
                  <div>attempted src: {flyerMediaDebugSnapshot.attemptedSrc ?? 'none'}</div>
                </div>
              ) : null}
              <div style={styles.eventDetailToolDock} aria-label={`${safeEventCard.name} event tools`}>
                {ROMEO_EVENT_DETAIL_TOOL_CARDS.map((toolCard) => {
                  const isToolPressed = pressedEventDetailToolId === toolCard.id;

                  return (
                    <button
                      key={toolCard.id}
                      type="button"
                      aria-label={`${toolCard.title}: ${toolCard.subtitle}`}
                      onPointerDown={() => setPressedEventDetailToolId(toolCard.id)}
                      onPointerUp={() => setPressedEventDetailToolId(null)}
                      onPointerCancel={() => setPressedEventDetailToolId(null)}
                      onPointerLeave={() => setPressedEventDetailToolId(null)}
                      onBlur={() => setPressedEventDetailToolId(null)}
                      style={{
                        ...styles.eventDetailToolTile,
                        ...(toolCard.featured ? styles.eventDetailToolTileFeatured : null),
                        ...(isToolPressed ? styles.eventDetailToolTilePressed : null),
                      }}
                    >
                      <span
                        style={{
                          ...styles.eventDetailToolIcon,
                          ...(toolCard.featured ? styles.eventDetailToolIconFeatured : null),
                        }}
                        aria-hidden="true"
                      >
                        {toolCard.icon}
                      </span>
                      <span style={styles.eventDetailToolTitle}>{toolCard.title}</span>
                      <span style={styles.eventDetailToolSubtitle}>{toolCard.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : hasCardMedia && hasCardMediaSource ? (
            <div
              className="atlas-card-media"
              style={{
                ...styles.cardMediaWrap,
                backgroundImage: `url(${displayedLargeCardImageSrc})`,
                backgroundPosition: selectedMedia?.mediaPosition ??
                    styles.cardMediaLayer.objectPosition,
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
                opacity: isCardMediaVisible ? 1 : 0,
                transitionDuration: `${mediaFadeDurationMs}ms`,
              }}
              aria-hidden="true"
            >
              <img
                ref={largeCardImageRef}
                src={displayedLargeCardImageSrc}
                alt=""
                onLoad={handleLargeCardImageLoad}
                onError={handleLargeCardImageError}
                style={{
                  ...styles.cardMediaLayer,
                  objectPosition: selectedMedia?.mediaPosition ??
                      styles.cardMediaLayer.objectPosition,
                  transform: `scale(${selectedMedia?.mediaScale ?? 1})`,
                }}
              />
              <span style={styles.cardMediaOverlay} aria-hidden="true" />
            </div>
          ) : null}
          {isFlyerCard ? null : (
            <div
              className={`atlas-card-content atlas-card-content--full-event${fullCardBriefing ? ' atlas-card-content--briefing' : ''}`}
              style={fullCardBriefing ? styles.briefingCardContent : styles.cardContent}
            >
              <div
                className={`atlas-card-copy atlas-card-copy--full-event${fullCardBriefing ? ' atlas-card-copy--briefing' : ''}`}
                style={fullCardBriefing ? styles.briefingCardCopy : undefined}
              >
              <div
                className="atlas-full-event-readability-scrim"
                style={styles.fullEventReadabilityScrim}
                aria-hidden="true"
              />
              <div style={fullCardBriefing ? styles.briefingHeader : styles.cardHeaderRow}>
                <div style={styles.cardTitleGroup}>
                  <p style={styles.cardLocation}>{safeEventCard.location}</p>
                  <h3 style={fullCardBriefing ? styles.briefingTitle : styles.cardTitle}>{safeEventCard.name}</h3>
                  {fullCardBriefing ? (
                    <>
                      <p style={styles.cardDateLine}>{fullCardBriefing.date}</p>
                      <p style={styles.briefingVenue}>{fullCardBriefing.venue}</p>
                    </>
                  ) : largeCardDateRange ? (
                    <p style={styles.cardDateLine}>{largeCardDateRange}</p>
                  ) : null}
                </div>
                <p style={styles.cardCategoryTag}>
                  {safeEventCard.cardTag ?? safeEventCard.category}
                </p>
              </div>
              {fullCardBriefing ? (
                <>
                  <p style={styles.briefingIntro}>{fullCardBriefing.intro}</p>
                  <div style={styles.briefingSectionList}>
                    {fullCardBriefing.sections.map((section) => (
                      <section key={section.title} style={styles.briefingSection}>
                        <h4 style={styles.cardStoryDetailTitle}>{section.title}</h4>
                        {section.body ? <p style={styles.cardStoryDetailBody}>{section.body}</p> : null}
                        {section.items ? (
                          <ul style={styles.briefingList}>
                            {section.items.map((item) => (
                              <li key={item} style={styles.briefingListItem}>{item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </section>
                    ))}
                  </div>
                  <p style={styles.cardTrustLine}>{safeEventCard.trustStatusCopy}</p>
                  <p style={styles.briefingSource}>Source: {fullCardBriefing.source}</p>
                  <a href={fullCardBriefing.officialSite} target="_blank" rel="noreferrer" style={styles.officialSiteButton}>
                    Open Official Site
                  </a>
                </>
              ) : (
                <>
                  <p style={styles.cardBody}>{safeEventCard.description}</p>
                  {safeEventCard.atmosphereLabel ? (
                    <p style={styles.cardAtmosphere}>
                      <span aria-hidden="true" style={styles.cardAtmosphereGlyph}>✦</span>
                      {safeEventCard.atmosphereLabel}
                    </p>
                  ) : null}
                  {largeCardStoryDetails.length > 0 ? (
                    <div style={styles.cardStoryDetailList}>
                      {largeCardStoryDetails.map((detail, index) => (
                        <section key={`${detail.title}-${index}`} style={styles.cardStoryDetail}>
                          <h4 style={styles.cardStoryDetailTitle}>{detail.title}</h4>
                          <p style={styles.cardStoryDetailBody}>{detail.body}</p>
                        </section>
                      ))}
                    </div>
                  ) : null}
                  <p style={styles.cardTrustLine}>{safeEventCard.trustStatusCopy}</p>
                  {safeEventCard.detailAction ? (
                    safeEventCard.id === 'electric-forest' ? (
                      <button type="button" style={styles.enterEventButton} onClick={() => startElectricForestTransition(safeEventCard.id)}>
                        {safeEventCard.detailAction.label}
                      </button>
                    ) : (
                      <Link href={safeEventCard.detailAction.href} style={styles.enterEventLink}>
                        {safeEventCard.detailAction.label}
                      </Link>
                    )
                  ) : null}
                </>
              )}
            </div>
          </div>
          )}
          {isFlyerCard ? null : (
            <span
              style={{
                ...styles.cardAtmosphereOrb,
                boxShadow: `0 0 26px ${cardTheme.glow}, 0 0 50px ${cardTheme.wash}`,
              }}
              aria-hidden="true"
            />
          )}
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
              query={hasSubmittedSearchMatches ? '' : submittedQuery}
              resultCount={hasSubmittedSearchMatches ? 0 : highlightedIds.size}
              statusText={
                hasSubmittedSearchMatches
                  ? undefined
                  : hasSubmittedSearchNoResults
                    ? 'No matching celebrations found.'
                    : discoveryStatusText ?? undefined
              }
              results={hasSubmittedSearchMatches ? [] : discoveryResultRows}
              shortcutGroups={HOME_DISCOVERY_SHORTCUT_GROUPS}
              showShortcutGroups={false}
            />
            <form
              style={styles.searchInputWrap}
              onSubmit={(event) => {
                event.preventDefault();
                submitSearch();
              }}
            >
              <span style={styles.searchPrefix}>Ask Celebration Atlas</span>
              <span className="atlas-search-helper" style={styles.searchHelperText}>Tell me what to find in Michigan</span>
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
              <button
                type="submit"
                aria-label="Submit Atlas question"
                className="atlas-search-submit"
                style={styles.searchSubmitButton}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  focusable="false"
                  style={styles.searchSubmitIcon}
                >
                  <path
                    d="M5 12h12.2M13 7.8 17.2 12 13 16.2"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                  />
                </svg>
              </button>
            </form>
            {shouldShowMobileAmbientAtlas ? (
              <section
                className={`mobile-live-sheet${isMobileAmbientRailLayoutReady ? ' mobile-live-sheet--ready' : ''}`}
                style={{
                  ...styles.mobileLiveStrip,
                  ...(isMobileAmbientRailLayoutReady
                    ? styles.mobileLiveStripReady
                    : styles.mobileLiveStripHidden),
                }}
                aria-label="Michigan event rail"
                aria-hidden={isMobileAmbientRailLayoutReady ? undefined : true}
                data-layout-ready={isMobileAmbientRailLayoutReady ? 'true' : 'false'}
              >
                <div className="mobile-live-sheet-scroller" style={styles.mobileLiveStripScroller}>
                  {ambientMobileEvents.map((event) => {
                    const statusBadge = getEventStatusBadge(event);
                    const eventDate = formatMobileEventDate(event);

                    return (
                      <button
                        key={event.id}
                        type="button"
                        aria-label={`Open ${event.name}`}
                        onClick={() => setSelectedId(event.id)}
                        className="mobile-live-card"
                        style={styles.mobileLiveCard}
                      >
                        <span style={styles.mobileLiveCardMedia}>
                          <EventThumbnail event={event} variant="live" />
                          <span style={styles.mobileLiveCardGradient} aria-hidden="true" />
                          {statusBadge ? (
                            <span
                              style={{
                                ...styles.mobileLiveStatusBadge,
                                ...(statusBadge === 'LIVE'
                                  ? styles.mobileLiveStatusBadgeLive
                                  : styles.mobileLiveStatusBadgeUpcoming),
                              }}
                            >
                              {statusBadge}
                            </span>
                          ) : null}
                        </span>
                        <span style={styles.mobileLiveCardCopy}>
                          <span style={styles.mobileLiveCardTitle}>{event.name}</span>
                          <span style={styles.mobileLiveCardMeta}>{event.location}</span>
                          <span style={styles.mobileLiveCardDate}>{eventDate}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}
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

            .atlas-search-submit {
              transition:
                transform 180ms ease,
                border-color 180ms ease,
                box-shadow 180ms ease,
                color 180ms ease;
            }

            .atlas-search-submit:hover,
            .atlas-search-submit:focus-visible {
              border-color: rgba(255, 235, 184, 0.66);
              color: rgba(255, 250, 232, 0.98);
              box-shadow:
                inset 0 0 0 1px rgba(255, 250, 226, 0.12),
                0 0 18px rgba(255, 207, 116, 0.32),
                0 7px 18px rgba(2, 5, 12, 0.24);
              transform: translateY(-50%) scale(1.03);
            }

            .atlas-search-submit:active {
              transform: translateY(-50%) scale(0.97);
            }


            .mobile-live-sheet-toggle {
              width: 100%;
              border: 0;
              background: transparent;
              cursor: pointer;
              touch-action: manipulation;
              appearance: none;
              -webkit-appearance: none;
            }

            .mobile-live-sheet-scroller {
              max-height: 94px;
              opacity: 1;
              overflow-x: auto !important;
              overflow-y: visible !important;
              scroll-snap-type: x proximity;
              pointer-events: auto;
              transform: translateY(0);
              transition:
                max-height 260ms ease,
                opacity 220ms ease,
                transform 260ms ease;
            }

            @media (max-width: 767px) {
              .atlas-map-image {
                object-fit: cover !important;
                object-position: center 26% !important;
              }

              .atlas-map-image--atmosphere {
                object-fit: cover !important;
                object-position: center 24% !important;
              }

              .atlas-search-dock {
                padding: 8px 12px calc(10px + env(safe-area-inset-bottom)) !important;
              }

              .atlas-search-dock form {
                min-height: 64px !important;
                border-radius: 22px !important;
                padding: 18px 14px 10px !important;
              }

              .atlas-search-dock input {
                padding: 36px 58px 9px 14px !important;
                border-radius: 22px !important;
              }

              .atlas-search-dock form > span:first-child {
                top: 8px !important;
                left: 14px !important;
                font-size: 10.5px !important;
              }

              .atlas-search-helper {
                display: block !important;
                top: 23px !important;
                left: 14px !important;
                right: 58px !important;
                font-size: 10px !important;
              }

              .atlas-search-query {
                padding-top: 27px !important;
              }

              .atlas-search-submit {
                right: 8px !important;
                width: 38px !important;
                height: 38px !important;
                min-width: 38px !important;
                min-height: 38px !important;
              }

              .mobile-live-sheet {
                margin-top: 6px !important;
                padding: 0 !important;
                border-radius: 0 !important;
              }

              .mobile-live-card {
                flex: 0 0 clamp(88px, 24vw, 98px) !important;
                min-height: 82px !important;
                max-height: 82px !important;
                scroll-snap-align: start;
              }
            }

            @media (max-width: 767px) and (max-height: 720px) {
              .mobile-atlas-brand {
                font-size: 9px !important;
                letter-spacing: 1.5px !important;
              }

              .mobile-atlas-title {
                font-size: clamp(27px, 8.4vw, 34px) !important;
                letter-spacing: 0.105em !important;
              }

              .mobile-atlas-subtitle {
                display: none !important;
              }

              .mobile-floating-card {
                width: fit-content !important;
                min-width: 0 !important;
                max-width: min(184px, calc(100vw - 28px)) !important;
                min-height: 52px !important;
                padding: 6px 8px 6px 54px !important;
                border-radius: 13px !important;
              }

              .mobile-floating-card--3 {
                display: none !important;
              }

              .mobile-live-sheet-scroller {
                max-height: 94px;
              }
            }

            @media (max-width: 767px) and (max-height: 640px) {
              .mobile-floating-card--2 {
                display: none !important;
              }

              .mobile-live-sheet-scroller {
                max-height: 94px;
              }
            }

            @media (max-width: 480px) {
              .mobile-atlas-identity {
                top: calc(env(safe-area-inset-top) + 0px) !important;
              }

              .mobile-atlas-title {
                font-size: clamp(38px, 13vw, 56px) !important;
                letter-spacing: 0.09em !important;
              }

              .mobile-atlas-identity--dismissed .mobile-atlas-title {
                font-size: 18px !important;
                letter-spacing: 0.18em !important;
              }
            }

            @media (max-width: 767px) {
              .mobile-atlas-identity {
                padding-top: 10px !important;
              }

              .mobile-atlas-title {
                font-size: 48px !important;
                line-height: 0.95 !important;
                letter-spacing: 0.04em !important;
              }
            }


            .mobile-atlas-identity--dismissed .mobile-atlas-identity-scrim {
              opacity: 0 !important;
              transform: translate3d(-50%, -54%, 0) scale(0.94) !important;
            }

            .mobile-atlas-identity--dismissed {
              opacity: 0 !important;
              transform: translate3d(0, -16px, 0) scale(0.94) !important;
            }

            .mobile-atlas-identity--dismissed .mobile-atlas-title {
              font-size: 18px !important;
              letter-spacing: 0.18em !important;
              line-height: 1 !important;
            }

            .mobile-atlas-identity--dismissed .mobile-atlas-emblem,
            .mobile-atlas-identity--dismissed .mobile-atlas-brand,
            .mobile-atlas-identity--dismissed .mobile-atlas-subtitle {
              opacity: 0 !important;
              transform: translate3d(0, -4px, 0) scale(0.94) !important;
              max-height: 0 !important;
              margin: 0 !important;
              overflow: hidden !important;
            }

            @media (prefers-reduced-motion: reduce) {
              .mobile-atlas-identity,
              .mobile-atlas-identity *,
              .atlas-search-input--pulse,
              .atlas-search-query,
              .atlas-search-query--fade,
              .atlas-search-suggestion,
              .atlas-search-suggestion--fade,
              .atlas-search-submit,
              .marker-pulse,
              .marker-pulse--selected,
              .atlas-marker-starburst {
                animation-duration: 1ms !important;
                transition-duration: 1ms !important;
              }
            }

            .marker-pulse {
              animation-name: markerPulse;
              animation-timing-function: ease-in-out;
              animation-iteration-count: infinite;
              animation-fill-mode: both;
              will-change: transform, box-shadow, filter, outline-offset, opacity;
              transform-origin: center;
              isolation: isolate;
              --marker-brightness-idle: 1;
              --marker-brightness-peak: 1.07;
              --marker-saturation-idle: 1;
              --marker-saturation-peak: 1.08;
              --marker-ring-opacity: 0.1;
              --marker-bloom-opacity: 0.2;
              --marker-bloom-size: 190%;
              --marker-star-size: 88%;
              --marker-star-opacity: 0.92;
              --marker-core-size: 18%;
              --marker-halo-size: 58%;
              --marker-flare-length: 100%;
              --marker-flare-thickness: 10%;
              --marker-diagonal-opacity: 0.34;
              --marker-starburst-size: 250%;
              --marker-starburst-opacity: 0.98;
              --marker-starburst-primary-width: 4.8;
              --marker-starburst-diagonal-width: 2.4;
              --marker-starburst-diagonal-opacity: 0.42;
              --marker-star-filter-idle: drop-shadow(0 0 6px rgba(255, 231, 164, 0.42));
              --marker-star-filter-peak: drop-shadow(0 0 9px rgba(255, 240, 196, 0.52));
            }

            .marker-pulse--inactive {
              animation-name: markerIdleGlow;
              opacity: 0.68;
              --marker-ring-opacity: 0.035;
              --marker-bloom-opacity: 0.055;
              --marker-bloom-size: 145%;
              --marker-star-size: 62%;
              --marker-star-opacity: 0.46;
              --marker-core-size: 24%;
              --marker-halo-size: 56%;
              --marker-flare-length: 70%;
              --marker-flare-thickness: 7%;
              --marker-diagonal-opacity: 0.08;
              --marker-star-filter-idle: drop-shadow(0 0 4px rgba(255, 225, 146, 0.22));
              --marker-star-filter-peak: drop-shadow(0 0 5px rgba(255, 231, 164, 0.28));
            }

            .marker-pulse--broad-highlighted {
              border-color: transparent !important;
              background: transparent !important;
              --marker-brightness-idle: 1.13;
              --marker-brightness-peak: 1.25;
              --marker-saturation-idle: 1.1;
              --marker-saturation-peak: 1.18;
              --marker-ring-opacity: 0.08;
              --marker-bloom-opacity: 0.16;
              --marker-bloom-size: 185%;
              --marker-star-size: 128%;
              --marker-star-opacity: 0.98;
              --marker-core-size: 18%;
              --marker-halo-size: 68%;
              --marker-flare-length: 118%;
              --marker-flare-thickness: 9%;
              --marker-diagonal-opacity: 0.38;
              --marker-starburst-size: 260%;
              --marker-starburst-primary-width: 4.6;
              --marker-starburst-diagonal-width: 2.2;
              --marker-starburst-diagonal-opacity: 0.5;
              --marker-star-filter-idle: drop-shadow(0 0 8px rgba(255, 246, 220, 0.72))
                drop-shadow(0 0 20px rgba(255, 204, 104, 0.42));
              --marker-star-filter-peak: drop-shadow(0 0 12px rgba(255, 252, 236, 0.88))
                drop-shadow(0 0 28px rgba(255, 216, 126, 0.58));
            }

            /* Temporary reliable exact-event pulse restored. Global U.S./state marker language should be designed later as a shared marker system, not tuned here as a Romeo-only fix. */
            .marker-pulse--exact-reveal,
            .atlas-marker--exact,
            .marker-pulse[data-atlas-marker-state='exact-event'] {
              border-color: transparent !important;
              outline: none;
              outline-offset: 0;
              opacity: 1 !important;
              background: transparent !important;
              --marker-brightness-idle: 1.72;
              --marker-brightness-peak: 1.95;
              --marker-saturation-idle: 1.32;
              --marker-saturation-peak: 1.45;
              --marker-ring-opacity: 0.12;
              --marker-bloom-opacity: 0.24;
              --marker-bloom-size: 220%;
              --marker-star-size: 168%;
              --marker-star-opacity: 1;
              --marker-core-size: 17%;
              --marker-halo-size: 76%;
              --marker-flare-length: 134%;
              --marker-flare-thickness: 8%;
              --marker-diagonal-opacity: 0.58;
              --marker-starburst-size: 330%;
              --marker-starburst-primary-width: 5.4;
              --marker-starburst-diagonal-width: 2.8;
              --marker-starburst-diagonal-opacity: 0.68;
              --marker-star-filter-idle: drop-shadow(0 0 10px rgba(255, 255, 248, 0.96))
                drop-shadow(0 0 24px rgba(255, 228, 142, 0.82))
                drop-shadow(0 0 42px rgba(255, 187, 76, 0.42));
              --marker-star-filter-peak: drop-shadow(0 0 16px rgba(255, 255, 250, 1))
                drop-shadow(0 0 34px rgba(255, 236, 166, 0.96))
                drop-shadow(0 0 58px rgba(255, 194, 86, 0.56));
            }

            .marker-pulse--selected {
              border-color: transparent !important;
              background: transparent !important;
              outline: none;
              outline-offset: 0;
              --marker-brightness-idle: 1.25;
              --marker-brightness-peak: 1.4;
              --marker-saturation-idle: 1.14;
              --marker-saturation-peak: 1.22;
              --marker-ring-opacity: 0.1;
              --marker-bloom-opacity: 0.2;
              --marker-bloom-size: 205%;
              --marker-star-size: 146%;
              --marker-star-opacity: 1;
              --marker-core-size: 18%;
              --marker-halo-size: 72%;
              --marker-flare-length: 124%;
              --marker-flare-thickness: 8.5%;
              --marker-diagonal-opacity: 0.46;
              --marker-starburst-size: 292%;
              --marker-starburst-primary-width: 5;
              --marker-starburst-diagonal-width: 2.5;
              --marker-starburst-diagonal-opacity: 0.58;
              --marker-star-filter-idle: drop-shadow(0 0 9px rgba(255, 254, 242, 0.84))
                drop-shadow(0 0 23px rgba(255, 224, 138, 0.66));
              --marker-star-filter-peak: drop-shadow(0 0 14px rgba(255, 255, 248, 0.96))
                drop-shadow(0 0 32px rgba(255, 228, 146, 0.78));
            }

            .marker-pulse--cluster {
              --marker-ring-opacity: 0.18;
              --marker-bloom-opacity: 0.34;
              --marker-bloom-size: 245%;
            }

            .marker-pulse--highlighted {
              border-color: transparent !important;
            }

            .marker-pulse--strong-active {
              border-color: transparent !important;
            }

            @media (max-width: 767px) {
              .marker-pulse {
                width: 1px !important;
                height: 1px !important;
                opacity: 0 !important;
                background: transparent !important;
                border-color: transparent !important;
                box-shadow: none !important;
                filter: none !important;
                animation: none !important;
              }

              .marker-pulse::before,
              .marker-pulse::after,
              .atlas-marker-starburst {
                display: none !important;
              }

              .marker-pulse--inactive {
                width: 1px !important;
                height: 1px !important;
              }

              .marker-pulse--broad-highlighted {
                width: 22px !important;
                height: 22px !important;
                --marker-brightness-idle: 1.42;
                --marker-brightness-peak: 1.62;
                --marker-saturation-idle: 1.2;
                --marker-saturation-peak: 1.34;
                --marker-ring-opacity: 0.1;
                --marker-bloom-opacity: 0.2;
                --marker-bloom-size: 210%;
                --marker-star-size: 210%;
                --marker-star-opacity: 1;
                --marker-core-size: 16%;
                --marker-halo-size: 84%;
                --marker-flare-length: 160%;
                --marker-flare-thickness: 7%;
                --marker-diagonal-opacity: 0.58;
                --marker-starburst-size: 315%;
                --marker-starburst-primary-width: 5.2;
                --marker-starburst-diagonal-width: 2.5;
                --marker-starburst-diagonal-opacity: 0.62;
                --marker-star-filter-idle: brightness(1.22)
                  drop-shadow(0 0 10px rgba(255, 255, 238, 0.94))
                  drop-shadow(0 0 24px rgba(255, 216, 122, 0.72))
                  drop-shadow(0 0 42px rgba(255, 174, 66, 0.32));
                --marker-star-filter-peak: brightness(1.38)
                  drop-shadow(0 0 16px rgba(255, 255, 246, 1))
                  drop-shadow(0 0 34px rgba(255, 226, 142, 0.9))
                  drop-shadow(0 0 58px rgba(255, 184, 72, 0.44));
              }

              .marker-pulse--exact-reveal,
              .atlas-marker--exact,
              .marker-pulse[data-atlas-marker-state='exact-event'] {
                width: 34px !important;
                height: 34px !important;
                outline-width: 0;
                outline-offset: 0;
                --marker-brightness-idle: 2.12;
                --marker-brightness-peak: 2.42;
                --marker-saturation-idle: 1.44;
                --marker-saturation-peak: 1.62;
                --marker-ring-opacity: 0.14;
                --marker-bloom-opacity: 0.26;
                --marker-bloom-size: 235%;
                --marker-star-size: 245%;
                --marker-core-size: 18%;
                --marker-halo-size: 96%;
                --marker-flare-length: 184%;
                --marker-flare-thickness: 6.5%;
                --marker-diagonal-opacity: 0.72;
                --marker-exact-halo-size: 104px;
                --marker-starburst-size: 375%;
                --marker-starburst-primary-width: 6.2;
                --marker-starburst-diagonal-width: 3.1;
                --marker-starburst-diagonal-opacity: 0.78;
                --marker-star-filter-idle: brightness(1.34)
                  drop-shadow(0 0 14px rgba(255, 255, 252, 1))
                  drop-shadow(0 0 34px rgba(255, 236, 166, 0.98))
                  drop-shadow(0 0 68px rgba(255, 194, 86, 0.62));
                --marker-star-filter-peak: brightness(1.58)
                  drop-shadow(0 0 22px rgba(255, 255, 255, 1))
                  drop-shadow(0 0 48px rgba(255, 244, 194, 1))
                  drop-shadow(0 0 88px rgba(255, 202, 96, 0.76));
              }

              .marker-pulse--selected {
                width: 32px !important;
                height: 32px !important;
                outline-width: 0;
                outline-offset: 0;
                --marker-brightness-idle: 1.68;
                --marker-brightness-peak: 1.92;
                --marker-saturation-idle: 1.28;
                --marker-saturation-peak: 1.42;
                --marker-ring-opacity: 0.12;
                --marker-bloom-opacity: 0.23;
                --marker-bloom-size: 225%;
                --marker-star-size: 225%;
                --marker-core-size: 17%;
                --marker-halo-size: 88%;
                --marker-flare-length: 170%;
                --marker-flare-thickness: 6.8%;
                --marker-diagonal-opacity: 0.64;
                --marker-starburst-size: 345%;
                --marker-starburst-primary-width: 5.8;
                --marker-starburst-diagonal-width: 2.9;
                --marker-starburst-diagonal-opacity: 0.7;
                --marker-star-filter-idle: brightness(1.26)
                  drop-shadow(0 0 12px rgba(255, 255, 248, 0.98))
                  drop-shadow(0 0 30px rgba(255, 228, 146, 0.84))
                  drop-shadow(0 0 54px rgba(255, 184, 72, 0.42));
                --marker-star-filter-peak: brightness(1.46)
                  drop-shadow(0 0 18px rgba(255, 255, 252, 1))
                  drop-shadow(0 0 40px rgba(255, 236, 166, 0.96))
                  drop-shadow(0 0 72px rgba(255, 194, 86, 0.58));
              }

              .marker-pulse--cluster {
                width: 32px !important;
                height: 32px !important;
              }
            }

            .marker-pulse::before,
            .marker-pulse::after {
              content: '';
              position: absolute;
              left: 50%;
              top: 50%;
              width: var(--marker-bloom-size, 190%);
              height: var(--marker-bloom-size, 190%);
              border-radius: 999px;
              background: radial-gradient(
                circle,
                rgba(255, 250, 226, var(--marker-ring-opacity, 0.12)) 0 16%,
                rgba(255, 214, 122, var(--marker-bloom-opacity, 0.2)) 24%,
                rgba(226, 146, 54, calc(var(--marker-bloom-opacity, 0.2) * 0.42)) 46%,
                rgba(120, 70, 28, 0) 72%
              );
              pointer-events: none;
              transform: translate(-50%, -50%);
              z-index: 0;
            }

            .marker-pulse::after {
              width: calc(var(--marker-bloom-size, 190%) * 0.66);
              height: calc(var(--marker-bloom-size, 190%) * 0.66);
              background: radial-gradient(
                circle,
                rgba(255, 255, 242, calc(var(--marker-ring-opacity, 0.12) * 0.78)) 0 18%,
                rgba(255, 225, 146, calc(var(--marker-bloom-opacity, 0.2) * 0.42)) 36%,
                rgba(255, 225, 146, 0) 66%
              );
            }

            .atlas-marker-starburst {
              position: absolute;
              left: 50%;
              top: 50%;
              width: var(--marker-starburst-size, 250%);
              height: var(--marker-starburst-size, 250%);
              filter: var(--marker-star-filter-idle);
              opacity: var(--marker-starburst-opacity, 0.98);
              overflow: visible;
              pointer-events: none;
              transform: translate(-50%, -50%);
              transform-origin: center;
              z-index: 2;
            }

            .atlas-marker-starburst__bloom {
              opacity: 0.48;
              mix-blend-mode: screen;
            }

            .atlas-marker-starburst__rays {
              fill: rgba(255, 252, 232, 0.96);
              mix-blend-mode: screen;
            }

            .atlas-marker-starburst__rays--primary {
              filter: drop-shadow(0 0 3px rgba(255, 255, 248, 0.95))
                drop-shadow(0 0 9px rgba(255, 219, 112, 0.78));
            }

            .atlas-marker-starburst__rays--diagonal {
              opacity: var(--marker-starburst-diagonal-opacity, 0.42);
              fill: rgba(255, 232, 154, 0.88);
              filter: drop-shadow(0 0 5px rgba(255, 213, 112, 0.5));
            }

            .atlas-marker-starburst__center {
              mix-blend-mode: screen;
              filter: drop-shadow(0 0 4px rgba(255, 255, 252, 1))
                drop-shadow(0 0 12px rgba(255, 225, 132, 0.78));
            }

            .atlas-marker-starburst__point {
              fill: #fff;
              filter: drop-shadow(0 0 5px rgba(255, 255, 255, 1));
            }

            .marker-pulse--broad-highlighted .atlas-marker-starburst,
            .marker-pulse--selected .atlas-marker-starburst,
            .marker-pulse[data-atlas-marker-state='exact-event'] .atlas-marker-starburst {
              animation: markerStarPulse var(--marker-star-pulse-duration, inherit)
                ease-in-out infinite both;
            }


            .atlas-marker--exact::before,
            .marker-pulse[data-atlas-marker-state='exact-event']::before {
              width: var(--marker-exact-halo-size, 88px);
              height: var(--marker-exact-halo-size, 88px);
              background: radial-gradient(
                circle,
                rgba(255, 255, 248, 0.16) 0 8%,
                rgba(255, 238, 178, 0.14) 20%,
                rgba(255, 202, 96, 0.08) 42%,
                rgba(255, 178, 72, 0.04) 62%,
                rgba(255, 178, 72, 0) 82%
              );
              animation: none;
            }

            .atlas-marker--exact::after,
            .marker-pulse[data-atlas-marker-state='exact-event']::after {
              width: 38px;
              height: 38px;
              background: radial-gradient(
                circle,
                rgba(255, 255, 250, 0.18) 0 14%,
                rgba(255, 240, 184, 0.14) 32%,
                rgba(255, 214, 116, 0.06) 56%,
                rgba(255, 214, 116, 0) 76%
              );
            }

            @media (min-width: 768px) {
              .atlas-marker--exact,
              .marker-pulse[data-atlas-marker-state='exact-event'] {
                width: 28px !important;
                height: 28px !important;
                --marker-exact-halo-size: 76px;
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
              .atlas-marker-starburst,
              .atlas-search-input--pulse,
              .atlas-search-query,
              .cinematic-intro-overlay,
              .cinematic-intro-video {
                animation: none !important;
                transition-duration: 1ms !important;
              }
            }

            @keyframes exactMarkerHaloPulse {
              0%,
              100% {
                opacity: 0.82;
                transform: translate(-50%, -50%) scale(0.9);
              }
              50% {
                opacity: 1;
                transform: translate(-50%, -50%) scale(1.08);
              }
            }

            @keyframes markerPulse {
              0%,
              100% {
                transform: translate(-50%, -50%)
                  scale(var(--marker-scale-base, 1));
                box-shadow: var(--marker-shadow-idle);
                filter: brightness(var(--marker-brightness-idle, 1))
                  saturate(var(--marker-saturation-idle, 1));
              }
              50% {
                transform: translate(-50%, -50%)
                  scale(calc(var(--marker-scale-base, 1) * 1.18));
                box-shadow: var(--marker-shadow-peak);
                filter: brightness(var(--marker-brightness-peak, 1.07))
                  saturate(var(--marker-saturation-peak, 1.08));
              }
            }

            @keyframes markerIdleGlow {
              0%,
              100% {
                transform: translate(-50%, -50%)
                  scale(var(--marker-scale-base, 1));
                box-shadow: var(--marker-shadow-idle);
                filter: brightness(0.96) saturate(0.92);
              }
              50% {
                transform: translate(-50%, -50%)
                  scale(calc(var(--marker-scale-base, 1) * 1.025));
                box-shadow: var(--marker-shadow-idle);
                filter: brightness(1) saturate(0.96);
              }
            }

            @keyframes markerStarPulse {
              0%,
              100% {
                filter: var(--marker-star-filter-idle);
                transform: translate(-50%, -50%) scale(0.98);
              }
              50% {
                filter: var(--marker-star-filter-peak);
                transform: translate(-50%, -50%) scale(1.12);
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
    transition: 'transform 520ms cubic-bezier(.22,.61,.36,1)',
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
  mobileCalloutConnectorLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    zIndex: Z_INDEX.markers + 18,
    overflow: 'visible',
    pointerEvents: 'none',
  },
  markerLabel: {
    position: 'absolute',
    left: '50%',
    top: '-18px',
    transform: 'translate(-50%, -116%)',
    padding: 0,
    borderRadius: 0,
    minWidth: 126,
    maxWidth: 172,
    whiteSpace: 'normal',
    overflow: 'visible',
    textOverflow: 'clip',
    fontSize: 11,
    letterSpacing: 0.18,
    lineHeight: 1.05,
    color: 'rgba(255, 241, 209, 0.86)',
    border: '0',
    background: 'transparent',
    textShadow:
      '0 0 8px rgba(255, 224, 153, 0.2), 0 1px 3px rgba(2, 3, 7, 0.74)',
    boxShadow: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
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

  mapCalloutCopy: {
    display: 'grid',
    gap: 2,
    justifyItems: 'center',
    padding: '2px 5px',
    background: 'transparent',
    borderRadius: 0,
  },
  mapCalloutName: {
    maxWidth: 164,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: 'rgba(255, 244, 216, 0.96)',
    fontWeight: 850,
  },
  mapCalloutCity: {
    color: 'rgba(238, 206, 150, 0.78)',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 0.24,
  },
  clusterLabel: {
    color: 'rgba(255, 245, 219, 0.94)',
    borderColor: 'rgba(255, 227, 170, 0.34)',
    background:
      'linear-gradient(180deg, rgba(31, 38, 54, 0.46), rgba(7, 10, 15, 0.28))',
  },
  mobileSearchMarkerLabel: {
    top: '50%',
    minWidth: MOBILE_TAG_MIN_WIDTH_PX,
    maxWidth: MOBILE_TAG_MAX_WIDTH_PX,
    minHeight: MOBILE_TAG_HEIGHT_PX,
    height: 'auto',
    padding: '4px 7px 4px 5px',
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    borderRadius: 13,
    whiteSpace: 'normal',
    background:
      'linear-gradient(180deg, rgba(30, 34, 44, 0.84), rgba(8, 10, 15, 0.76))',
    borderColor: 'rgba(232, 181, 92, 0.58)',
    boxShadow:
      'inset 0 1px 0 rgba(255, 245, 218, 0.14), inset 0 0 0 1px rgba(255, 198, 98, 0.08), 0 8px 20px rgba(2, 5, 12, 0.38), 0 0 14px rgba(211, 143, 52, 0.18)',
    touchAction: 'manipulation',
    textAlign: 'left',
  },
  mobileSearchMarkerLabelText: {
    flex: '1 1 auto',
    minWidth: 0,
    display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'rgba(255, 242, 205, 0.94)',
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: 0.12,
    lineHeight: 1.14,
  },
  mobileSearchMarkerLabelChevron: {
    flex: '0 0 auto',
    color: 'rgba(245, 200, 124, 0.72)',
    fontSize: 16,
    lineHeight: 1,
    marginLeft: 1,
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.72)',
  },

  calloutClusterIndicator: {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    zIndex: Z_INDEX.markers + 58,
    width: 31,
    height: 24,
    borderRadius: 999,
    border: '1px solid rgba(255, 222, 154, 0.48)',
    background: 'rgba(9, 12, 18, 0.58)',
    color: 'rgba(255, 239, 204, 0.94)',
    fontSize: 11,
    fontWeight: 900,
    boxShadow: '0 0 14px rgba(223, 153, 58, 0.24), inset 0 1px 0 rgba(255,255,255,.12)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    cursor: 'pointer',
  },
  searchDock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '12px 14px calc(20px + env(safe-area-inset-bottom))',
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
    border: '1px solid rgba(255, 231, 184, 0.58)',
    background:
      'linear-gradient(180deg, rgba(22, 28, 40, 0.84), rgba(7, 10, 16, 0.72))',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 248, 224, 0.11), 0 20px 48px rgba(2, 5, 12, 0.42), 0 0 26px rgba(252, 201, 102, 0.28)',
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
  searchHelperText: {
    position: 'absolute',
    top: 23,
    left: 17,
    right: 66,
    color: 'rgba(255, 230, 181, 0.68)',
    fontSize: 10.5,
    fontWeight: 500,
    letterSpacing: 0.08,
    lineHeight: 1.1,
    display: 'none',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
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
    maxWidth: 'calc(100% - 58px)',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  searchInput: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    padding: '26px 66px 9px 17px',
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
  searchSubmitButton: {
    position: 'absolute',
    right: 9,
    top: '50%',
    zIndex: 2,
    display: 'grid',
    placeItems: 'center',
    width: 42,
    height: 42,
    minWidth: 42,
    minHeight: 42,
    padding: 0,
    borderRadius: 999,
    border: '1px solid rgba(255, 226, 170, 0.44)',
    background:
      'radial-gradient(circle at 32% 24%, rgba(255, 247, 218, 0.24), rgba(255, 205, 112, 0.12) 38%, rgba(11, 15, 22, 0.56) 100%)',
    color: 'rgba(255, 235, 190, 0.9)',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 250, 226, 0.08), 0 0 14px rgba(255, 207, 116, 0.22), 0 6px 16px rgba(2, 5, 12, 0.22)',
    cursor: 'pointer',
    touchAction: 'manipulation',
    appearance: 'none',
    WebkitAppearance: 'none',
    transform: 'translateY(-50%)',
  },
  searchSubmitIcon: {
    width: 21,
    height: 21,
    filter: 'drop-shadow(0 1px 3px rgba(2, 3, 7, 0.66))',
  },
  card: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 120,
    padding: 0,
    borderRadius: 22,
    background: 'rgba(7,10,15,.24)',
    border: '1px solid rgba(255,225,160,.4)',
    boxShadow:
      'inset 0 0 0 1px rgba(255,241,203,.08), 0 0 18px rgba(252,201,102,.24), 0 16px 36px rgba(0,0,0,.32)',
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
  flyerCard: {
    left: 'max(8px, env(safe-area-inset-left))',
    right: 'max(8px, env(safe-area-inset-right))',
    bottom: 'max(18px, env(safe-area-inset-bottom))',
    width: 'auto',
    height: 'min(88vh, 760px)',
  },
  flyerCardChromeReset: {
    border: '0 solid transparent',
    borderRadius: 0,
    boxShadow: 'none',
    background: 'transparent',
    overflow: 'visible',
  },
  eventDetailSheet: {
    position: 'relative',
    height: '100%',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    overscrollBehaviorX: 'none',
    overscrollBehaviorY: 'contain',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
    scrollbarWidth: 'none',
    padding: '42px 8px 46px',
    maskImage:
      'linear-gradient(to bottom, transparent 0, black 58px, black calc(100% - 74px), transparent 100%)',
    WebkitMaskImage:
      'linear-gradient(to bottom, transparent 0, black 58px, black calc(100% - 74px), transparent 100%)',
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
  },
  eventDetailFlyerHero: {
    position: 'relative',
    margin: 0,
    overflow: 'hidden',
    borderRadius: 22,
    background:
      'radial-gradient(circle at 50% 0%, rgba(255,221,146,.18), transparent 45%), rgba(9,12,22,.42)',
    boxShadow: '0 18px 42px rgba(0,0,0,.28)',
  },
  eventDetailFlyerImage: {
    display: 'block',
    width: '100%',
    height: 'auto',
    objectFit: 'contain',
    objectPosition: 'center center',
    transition: 'opacity 1300ms ease',
  },
  eventDetailToolDock: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: 8,
    padding: '12px 2px 2px',
  },
  eventDetailToolTile: {
    appearance: 'none',
    WebkitAppearance: 'none',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    minWidth: 0,
    minHeight: 86,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
    gap: 4,
    borderRadius: 18,
    border: '1px solid rgba(255,225,160,.18)',
    padding: '10px 5px 9px',
    background:
      'radial-gradient(circle at 50% 0%, rgba(255,226,170,.14), transparent 50%), linear-gradient(150deg, rgba(24,31,58,.68), rgba(10,13,27,.78))',
    boxShadow:
      'inset 0 0 0 1px rgba(255,255,255,.045), 0 10px 24px rgba(0,0,0,.24)',
    color: '#fff1ce',
    cursor: 'pointer',
    font: 'inherit',
    textAlign: 'center',
    touchAction: 'manipulation',
    transform: 'translateY(0) scale(1)',
    transition: 'transform 140ms ease, border-color 140ms ease, box-shadow 140ms ease, background 140ms ease',
  },
  eventDetailToolTileFeatured: {
    borderColor: 'rgba(255,211,122,.5)',
    background:
      'radial-gradient(circle at 50% 0%, rgba(255,212,116,.34), transparent 54%), linear-gradient(150deg, rgba(72,45,18,.74), rgba(16,15,32,.78))',
    boxShadow:
      'inset 0 0 0 1px rgba(255,246,211,.12), 0 0 20px rgba(255,199,89,.24), 0 10px 24px rgba(0,0,0,.24)',
  },
  eventDetailToolTilePressed: {
    transform: 'translateY(1px) scale(.965)',
    borderColor: 'rgba(255,238,190,.58)',
    boxShadow:
      'inset 0 0 18px rgba(255,214,128,.12), 0 6px 16px rgba(0,0,0,.26)',
  },
  eventDetailToolIcon: {
    display: 'grid',
    width: 26,
    height: 26,
    placeItems: 'center',
    borderRadius: 10,
    background: 'rgba(255,231,179,.12)',
    color: '#ffd98a',
    fontSize: 15,
    lineHeight: 1,
    boxShadow: 'inset 0 0 0 1px rgba(255,226,166,.15)',
  },
  eventDetailToolIconFeatured: {
    background: 'rgba(255,211,122,.22)',
    color: '#fff2bd',
    boxShadow: 'inset 0 0 0 1px rgba(255,236,183,.28), 0 0 16px rgba(255,202,91,.32)',
  },
  eventDetailToolTitle: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    color: '#fff4d8',
    fontSize: 11,
    fontWeight: 850,
    letterSpacing: '-.02em',
    lineHeight: 1.08,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  eventDetailToolSubtitle: {
    display: 'block',
    maxWidth: '100%',
    overflow: 'hidden',
    color: 'rgba(255,235,196,.66)',
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: '.01em',
    lineHeight: 1.1,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  cardMediaWrap: {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    overflow: 'hidden',
    opacity: 0,
    transition: 'opacity 1300ms ease',
    zIndex: 0,
  },
  cardMediaLayer: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: '43% 18%',
  },
  flyerCardMediaWrap: {
    display: 'grid',
    placeItems: 'center',
    padding: 0,
  },
  flyerCardMediaLayer: {
    position: 'relative',
    objectFit: 'contain',
    objectPosition: 'center center',
  },
  flyerMediaDebugPanel: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    zIndex: 2,
    padding: 8,
    border: '1px solid rgba(255,255,255,.28)',
    borderRadius: 8,
    background: 'rgba(0,0,0,.78)',
    color: '#ffffff',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 10,
    lineHeight: 1.35,
    overflowWrap: 'anywhere',
    textAlign: 'left',
  },
  flyerUnavailableState: {
    position: 'absolute',
    inset: 16,
    display: 'grid',
    placeContent: 'center',
    gap: 8,
    border: '1px solid rgba(255,225,160,.28)',
    borderRadius: 18,
    color: '#ffebb9',
    textAlign: 'center',
    background: 'rgba(13,18,27,.72)',
    zIndex: 0,
  },
  cardMediaOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'transparent',
  },
  closeButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: '1px solid rgba(255,225,160,.45)',
    background: 'rgba(13,18,27,.78)',
    color: '#ffebb9',
    fontSize: 22,
    lineHeight: 1,
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    touchAction: 'none',
    zIndex: 4,
    backdropFilter: 'blur(10px) saturate(1.12)',
    WebkitBackdropFilter: 'blur(10px) saturate(1.12)',
  },
  cardContent: {
    position: 'relative',
    zIndex: 1,
    minHeight: '100%',
    maxHeight: 'inherit',
    padding: '112px 18px 18px',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    overscrollBehaviorX: 'none',
    overscrollBehaviorY: 'contain',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
    scrollbarWidth: 'none',
    background: 'transparent',
  },

  briefingCardContent: {
    position: 'relative',
    zIndex: 1,
    minHeight: '100%',
    maxHeight: 'inherit',
    padding: 'clamp(330px, 52vh, 430px) 16px 18px',
    overflowX: 'hidden',
    overflowY: 'auto',
    overscrollBehavior: 'contain',
    overscrollBehaviorX: 'none',
    overscrollBehaviorY: 'contain',
    WebkitOverflowScrolling: 'touch',
    touchAction: 'pan-y',
    scrollbarWidth: 'none',
    background: 'transparent',
  },
  briefingCardCopy: {
    position: 'relative',
    display: 'grid',
    gap: 15,
    width: '100%',
    maxWidth: 680,
    margin: '0 auto',
    padding: '22px 8px 18px',
    isolation: 'isolate',
  },
  fullEventReadabilityScrim: {
    position: 'absolute',
    zIndex: 0,
    left: '-16px',
    top: '-180px',
    width: 'calc(100% + 32px)',
    height: 'calc(100% + 216px)',
    pointerEvents: 'none',
    display: 'block',
  },
  briefingHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: 0,
    borderRadius: 0,
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
  briefingTitle: {
    margin: 0,
    fontSize: 30,
    lineHeight: 1.02,
    fontWeight: 780,
    letterSpacing: 0.1,
    color: '#ffebb9',
    textShadow: '0 1px 3px rgba(2,3,6,.9), 0 0 16px rgba(255,229,173,.3)',
    overflowWrap: 'anywhere',
  },
  briefingVenue: {
    margin: '5px 0 0',
    color: 'rgba(246, 232, 203, 0.86)',
    fontSize: 14,
    lineHeight: 1.28,
    fontWeight: 650,
  },
  briefingIntro: {
    margin: 0,
    padding: 0,
    borderRadius: 0,
    border: 'none',
    background: 'transparent',
    color: '#f0e2c3',
    fontSize: 16,
    lineHeight: 1.5,
    textShadow: '0 1px 3px rgba(2,3,6,.86)',
    overflowWrap: 'break-word',
  },
  briefingSectionList: {
    display: 'grid',
    gap: 10,
  },
  briefingSection: {
    padding: 0,
    borderRadius: 0,
    border: 'none',
    background: 'transparent',
    boxShadow: 'none',
  },
  briefingList: {
    display: 'grid',
    gap: 6,
    margin: '8px 0 0',
    paddingLeft: 18,
    color: 'rgba(246, 232, 203, 0.92)',
    fontSize: 15,
    lineHeight: 1.42,
  },
  briefingListItem: {
    paddingLeft: 2,
  },
  briefingSource: {
    margin: 0,
    color: 'rgba(255, 226, 174, 0.72)',
    fontSize: 11,
    lineHeight: 1.25,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  officialSiteButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    padding: '0 16px',
    borderRadius: 999,
    border: '1px solid rgba(255,230,183,.62)',
    color: 'rgba(24, 18, 9, 0.96)',
    background: 'linear-gradient(180deg, rgba(255,232,180,.96), rgba(230,170,80,.9))',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    fontSize: 11,
    fontWeight: 850,
    textDecoration: 'none',
    boxShadow: '0 0 22px rgba(255,194,104,.28), 0 10px 22px rgba(0,0,0,.28)',
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
    maxWidth: '100%',
  },
  cardTitle: {
    margin: 0,
    fontSize: 28,
    lineHeight: 1.08,
    fontWeight: 760,
    letterSpacing: 0.1,
    color: '#ffebb9',
    textShadow: '0 1px 3px rgba(2,3,6,.9), 0 0 14px rgba(255,229,173,.28)',
    overflowWrap: 'anywhere',
  },
  cardLocation: {
    margin: '0 0 5px',
    fontSize: 13,
    letterSpacing: 1.05,
    textTransform: 'uppercase',
    color: 'rgba(255,238,203,.72)',
    textShadow: '0 1px 2px rgba(3,4,8,.8)',
  },
  cardDateLine: {
    margin: '7px 0 0',
    color: 'rgba(255, 226, 174, 0.82)',
    fontSize: 14,
    fontWeight: 740,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    textShadow: '0 1px 2px rgba(2,3,7,.78)',
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
    fontSize: 16,
    lineHeight: 1.5,
    textShadow: '0 1px 3px rgba(2,3,6,.86)',
    overflowWrap: 'break-word',
  },
  cardStoryDetailList: {
    display: 'grid',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTop: '1px solid rgba(255, 229, 184, 0.14)',
  },
  cardStoryDetail: {
    margin: 0,
  },
  cardStoryDetailTitle: {
    margin: '0 0 4px',
    color: 'rgba(255, 226, 170, 0.88)',
    fontSize: 12,
    fontWeight: 850,
    letterSpacing: 1.25,
    textTransform: 'uppercase',
  },
  cardStoryDetailBody: {
    margin: 0,
    color: 'rgba(246, 232, 203, 0.9)',
    fontSize: 15,
    lineHeight: 1.5,
    textShadow: '0 1px 3px rgba(2,3,6,.86)',
    overflowWrap: 'break-word',
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


  mobileChromeControls: { position: 'absolute', top: 'calc(14px + env(safe-area-inset-top))', left: 'max(6px, env(safe-area-inset-left))', right: 'max(6px, env(safe-area-inset-right))', zIndex: Z_INDEX.searchDock + 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pointerEvents: 'none' },
  mobileChromeButton: { width: 44, height: 44, borderRadius: 0, border: 0, background: 'transparent', color: 'rgba(255, 224, 158, 0.94)', boxShadow: 'none', display: 'grid', placeItems: 'center', padding: 0, fontSize: 18, lineHeight: 1, textShadow: '0 1px 7px rgba(0, 0, 0, 0.72)', cursor: 'pointer', touchAction: 'manipulation', pointerEvents: 'auto', appearance: 'none', WebkitAppearance: 'none' },
  mobileHamburgerIcon: { transform: 'translateY(-1px)' },
  mobileFavoriteButton: { fontSize: 22 },
  mobileFavoriteButtonActive: { color: 'rgba(255, 244, 214, 0.98)', textShadow: '0 1px 8px rgba(0, 0, 0, 0.78), 0 0 10px rgba(255, 193, 88, 0.24)' },
  mobileSideControls: { position: 'absolute', right: 'max(6px, env(safe-area-inset-right))', bottom: 'calc(212px + env(safe-area-inset-bottom))', zIndex: Z_INDEX.searchDock + 1, display: 'grid', gap: 6, justifyItems: 'center', pointerEvents: 'none' },
  mobileToolButton: { position: 'relative', width: 46, minHeight: 46, height: 46, borderRadius: 0, border: 0, background: 'transparent', color: 'rgba(255, 232, 184, 0.9)', boxShadow: 'none', display: 'grid', placeItems: 'center', gap: 2, padding: 0, fontSize: 17, textShadow: '0 1px 7px rgba(0, 0, 0, 0.76)', cursor: 'pointer', touchAction: 'manipulation', pointerEvents: 'auto', appearance: 'none', WebkitAppearance: 'none' },
  mobileToolLabel: { position: 'absolute', top: 'calc(100% - 5px)', left: '50%', transform: 'translateX(-50%)', width: 'max-content', marginTop: 0, color: 'rgba(255, 244, 221, 0.78)', fontSize: 9, fontWeight: 700, textShadow: '0 1px 6px rgba(0, 0, 0, 0.86)' },
  mobileSheetOverlay: { position: 'fixed', inset: 0, zIndex: Z_INDEX.searchDock + 10, background: 'rgba(0, 0, 0, 0.22)', display: 'grid', alignItems: 'end' },
  mobileMenuSheet: { margin: '0 12px calc(12px + env(safe-area-inset-bottom))', padding: '10px 12px 14px', borderRadius: 24, border: '1px solid rgba(255, 226, 170, 0.24)', background: 'linear-gradient(180deg, rgba(13, 19, 29, 0.94), rgba(5, 9, 15, 0.92))', boxShadow: '0 22px 70px rgba(0,0,0,.56), inset 0 0 0 1px rgba(255, 245, 214, 0.05)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' },
  mobileSheetHandle: { width: 38, height: 4, margin: '0 auto 12px', borderRadius: 999, background: 'rgba(255, 226, 170, 0.34)' },
  mobileSheetKicker: { margin: '0 0 10px', color: 'rgba(255, 211, 134, 0.78)', fontSize: 11, fontWeight: 850, letterSpacing: 1.5, textTransform: 'uppercase' },
  mobileMenuItem: { width: '100%', padding: '12px 10px', border: 0, borderTop: '1px solid rgba(255, 226, 170, 0.1)', background: 'transparent', color: 'rgba(255, 242, 216, 0.94)', fontSize: 15, fontWeight: 700, textAlign: 'left' },
  mobileFilterSheet: { margin: '0 12px calc(12px + env(safe-area-inset-bottom))', padding: '10px 14px 14px', borderRadius: 24, border: '1px solid rgba(255, 226, 170, 0.24)', background: 'linear-gradient(180deg, rgba(13, 19, 29, 0.95), rgba(5, 9, 15, 0.93))' },
  mobileFilterHeader: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  mobileSheetTitle: { margin: '0 0 12px', color: 'rgba(255, 246, 226, 0.98)', fontSize: 22 },
  mobileSheetCloseButton: { position: 'static', width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,225,160,.45)', background: 'rgba(22,26,35,.95)', color: '#ffebb9', fontSize: 22, lineHeight: 1, display: 'grid', placeItems: 'center' },
  mobileFilterRow: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', border: 0, borderTop: '1px solid rgba(255, 226, 170, 0.12)', background: 'transparent', color: 'rgba(255, 242, 216, 0.94)', fontSize: 14, fontWeight: 750 },
  mobileFilterRowMeta: { color: 'rgba(255, 211, 134, 0.62)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },

  mobileAtlasIdentity: {
    position: 'absolute',
    left: 'max(0px, env(safe-area-inset-left))',
    right: 'max(0px, env(safe-area-inset-right))',
    top: 'calc(env(safe-area-inset-top) + 0px)',
    zIndex: Z_INDEX.searchDock - 1,
    display: 'grid',
    justifyItems: 'center',
    gap: 3,
    pointerEvents: 'none',
    textAlign: 'center',
    opacity: 1,
    transform: 'translate3d(0, 0, 0) scale(1)',
    transformOrigin: 'top center',
    transition: 'opacity 360ms ease, transform 360ms ease',
    textShadow: '0 2px 14px rgba(2, 4, 8, 0.92), 0 0 26px rgba(255, 207, 116, 0.22)',
  },
  mobileAtlasIdentityScrim: {
    position: 'absolute',
    left: '50%',
    top: '52%',
    width: 'min(112vw, 660px)',
    height: 'min(54vw, 310px)',
    borderRadius: '50%',
    background:
      'radial-gradient(ellipse at center, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.28) 38%, rgba(0,0,0,0.12) 62%, rgba(0,0,0,0) 100%), linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0.18) 45%, rgba(0,0,0,0.00) 100%)',
    filter: 'blur(7px)',
    transform: 'translate3d(-50%, -50%, 0)',
    pointerEvents: 'none',
    zIndex: -1,
  },
  mobileAtlasTitleArtwork: {
    position: 'relative',
    zIndex: 1,
    display: 'block',
    width: 'clamp(264px, 72vw, 440px)',
    height: 'auto',
    aspectRatio: '2400 / 1400',
    objectFit: 'contain',
    filter: 'drop-shadow(0 9px 18px rgba(25, 8, 0, 0.46)) drop-shadow(0 0 18px rgba(255, 198, 90, 0.28))',
    userSelect: 'none',
  },
  mobileAtlasEmblem: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    border: '1px solid rgba(255, 218, 142, 0.72)',
    display: 'grid',
    placeItems: 'center',
    color: 'rgba(255, 231, 180, 0.96)',
    background: 'radial-gradient(circle, rgba(255, 210, 120, 0.16), rgba(18, 24, 34, 0.06) 68%, transparent)',
    boxShadow: '0 0 22px rgba(255, 193, 88, 0.22), inset 0 0 10px rgba(255, 233, 184, 0.08)',
    transition: 'opacity 300ms ease, transform 300ms ease, max-height 300ms ease',
  },
  mobileAtlasEmblemNeedle: {
    fontSize: 14,
    lineHeight: 1,
  },
  mobileBrand: {
    margin: 0,
    color: 'rgba(255, 226, 170, 0.94)',
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: 1.9,
    textTransform: 'uppercase',
    lineHeight: 1.05,
    transition: 'opacity 300ms ease, transform 300ms ease, max-height 300ms ease, margin 300ms ease',
  },
  mobileStateTitle: {
    margin: 0,
    color: 'rgba(255, 246, 226, 0.98)',
    fontFamily: 'Georgia, Times New Roman, serif',
    fontSize: 'clamp(30px, 9.2vw, 44px)',
    fontWeight: 400,
    lineHeight: 0.84,
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    transition: 'font-size 300ms ease, letter-spacing 300ms ease, line-height 300ms ease',
  },
  mobileStateSubtitle: {
    margin: 0,
    color: 'rgba(255, 245, 226, 0.86)',
    fontSize: 11.5,
    letterSpacing: 0.18,
    lineHeight: 1.05,
    transition: 'opacity 300ms ease, transform 300ms ease, max-height 300ms ease, margin 300ms ease',
  },
  mobileFloatingCards: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX.markers + 24,
    pointerEvents: 'none',
  },
  mobileFloatingCard: {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    width: 'fit-content',
    minWidth: 0,
    maxWidth: 'min(188px, calc(100vw - 28px))',
    minHeight: 52,
    padding: '6px 8px 6px 54px',
    borderRadius: 14,
    border: '1px solid rgba(255, 220, 150, 0.34)',
    backgroundColor: 'rgba(9, 13, 20, 0.36)',
    backdropFilter: 'blur(15px) saturate(1.18)',
    WebkitBackdropFilter: 'blur(15px) saturate(1.18)',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    color: '#f9edcf',
    boxShadow: 'inset 0 0 0 1px rgba(255, 244, 214, 0.06), inset 22px 0 34px rgba(255, 238, 200, 0.035), 0 12px 26px rgba(0, 0, 0, 0.3), 0 0 18px rgba(255, 198, 96, 0.14)',
    pointerEvents: 'auto',
    textAlign: 'left',
    cursor: 'pointer',
    touchAction: 'manipulation',
    overflow: 'hidden',
  },
  mobileFloatingCardImageWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 62,
    overflow: 'hidden',
    borderRadius: '13px 20px 20px 13px',
    boxShadow: 'inset -16px 0 24px rgba(6, 9, 15, 0.24)',
    maskImage: 'linear-gradient(90deg, #000 0%, #000 62%, rgba(0, 0, 0, 0.76) 78%, rgba(0, 0, 0, 0.3) 92%, rgba(0, 0, 0, 0.06) 100%)',
    WebkitMaskImage: 'linear-gradient(90deg, #000 0%, #000 62%, rgba(0, 0, 0, 0.76) 78%, rgba(0, 0, 0, 0.3) 92%, rgba(0, 0, 0, 0.06) 100%)',
    backgroundPosition: 'center',
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
  },
  mobileFloatingCardOne: {
    left: '7%',
    top: '27%',
  },
  mobileFloatingCardTwo: {
    right: '6%',
    top: '39%',
  },
  mobileFloatingCardThree: {
    left: '10%',
    top: '51%',
  },
  mobileFloatingCardText: {
    position: 'relative',
    zIndex: 1,
    display: 'grid',
    gap: 2,
    minWidth: 0,
    width: 'max-content',
    maxWidth: 116,
  },
  mobileFloatingCardTitle: {
    display: '-webkit-box',
    maxWidth: 112,
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    fontSize: 11.5,
    fontWeight: 800,
    lineHeight: 1.08,
    textShadow: '0 1px 6px rgba(0, 0, 0, 0.85)',
  },
  mobileFloatingCardMeta: {
    display: 'block',
    maxWidth: 112,
    color: 'rgba(255, 239, 205, 0.86)',
    fontSize: 10.5,
    lineHeight: 1.12,
    textShadow: '0 1px 5px rgba(0, 0, 0, 0.86)',
  },
  mobileFloatingCardFallbackGlyph: {
    position: 'absolute',
    right: 10,
    top: 8,
    color: 'rgba(255, 226, 170, 0.28)',
    fontSize: 38,
    lineHeight: 1,
    filter: 'drop-shadow(0 1px 8px rgba(2, 3, 7, 0.7))',
  },
  eventThumbnail: {
    position: 'relative',
    flexShrink: 0,
    display: 'grid',
    placeItems: 'center',
    overflow: 'hidden',
    border: '1px solid rgba(255, 226, 170, 0.26)',
    background:
      'radial-gradient(circle at 34% 22%, rgba(255, 239, 196, 0.22), rgba(255, 191, 95, 0.1) 36%, rgba(9, 13, 20, 0.74) 100%)',
    color: 'rgba(255, 226, 170, 0.92)',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 244, 214, 0.06), 0 0 12px rgba(255, 198, 96, 0.14)',
  },
  eventThumbnailFloating: {
    width: 34,
    height: 34,
    borderRadius: 11,
  },
  eventThumbnailTag: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderColor: 'rgba(247, 207, 137, 0.36)',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 244, 214, 0.08), 0 0 8px rgba(255, 198, 96, 0.12)',
  },
  eventThumbnailLive: {
    width: '100%',
    height: '100%',
    minHeight: 0,
    position: 'absolute',
    inset: 0,
    alignSelf: 'stretch',
    border: 0,
    borderRadius: 0,
    boxShadow: 'none',
  },
  eventThumbnailImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  eventThumbnailFallbackGlyph: {
    fontSize: 18,
    lineHeight: 1,
    filter: 'drop-shadow(0 1px 4px rgba(2, 3, 7, 0.8))',
  },
  mobileLiveStrip: {
    marginTop: 6,
    minHeight: 91,
    overflow: 'visible',
    transition: 'opacity 120ms ease',
  },
  mobileLiveStripHidden: {
    opacity: 0,
    pointerEvents: 'none',
    visibility: 'hidden',
  },
  mobileLiveStripReady: {
    opacity: 1,
    visibility: 'visible',
  },
  mobileLiveStripScroller: {
    display: 'flex',
    gap: 6,
    overflowX: 'auto',
    overflowY: 'visible',
    minHeight: 91,
    padding: '1px 0 8px',
    WebkitOverflowScrolling: 'touch',
    scrollbarWidth: 'none',
    scrollSnapType: 'x proximity',
  },
  mobileLiveCard: {
    flex: '0 0 clamp(88px, 24vw, 98px)',
    display: 'grid',
    gridTemplateRows: '1fr',
    alignItems: 'stretch',
    gap: 0,
    minHeight: 82,
    maxHeight: 82,
    padding: 0,
    overflow: 'hidden',
    borderRadius: 12,
    border: '1px solid rgba(255, 220, 150, 0.2)',
    background: 'rgba(5, 8, 13, 0.48)',
    color: '#f7e9c8',
    textAlign: 'left',
    cursor: 'pointer',
    touchAction: 'manipulation',
    scrollSnapAlign: 'start',
    boxShadow: 'inset 0 0 0 1px rgba(255, 244, 214, 0.03), 0 6px 15px rgba(0, 0, 0, 0.26)',
  },
  mobileLiveCardMedia: {
    position: 'relative',
    gridArea: '1 / 1',
    display: 'grid',
    minWidth: 0,
    minHeight: 0,
  },
  mobileLiveCardGradient: {
    position: 'absolute',
    inset: 0,
    zIndex: 1,
    background:
      'linear-gradient(180deg, rgba(4, 6, 10, 0.3) 0%, rgba(4, 6, 10, 0.08) 36%, rgba(4, 6, 10, 0.54) 66%, rgba(3, 4, 8, 0.88) 100%), radial-gradient(circle at 18% 8%, rgba(255, 222, 155, 0.18), rgba(255, 222, 155, 0) 34%)',
    pointerEvents: 'none',
  },
  mobileLiveStatusBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    zIndex: 2,
    padding: '2px 5px',
    borderRadius: 999,
    fontSize: 6.6,
    fontWeight: 900,
    letterSpacing: 0.65,
    lineHeight: 1,
    textTransform: 'uppercase',
    boxShadow: '0 3px 10px rgba(0, 0, 0, 0.32)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  mobileLiveStatusBadgeLive: {
    border: '1px solid rgba(255, 185, 150, 0.5)',
    background: 'linear-gradient(180deg, rgba(206, 76, 68, 0.92), rgba(122, 36, 36, 0.82))',
    color: 'rgba(255, 246, 232, 0.96)',
  },
  mobileLiveStatusBadgeUpcoming: {
    border: '1px solid rgba(129, 181, 214, 0.5)',
    background: 'linear-gradient(180deg, rgba(62, 102, 132, 0.9), rgba(26, 48, 71, 0.82))',
    color: 'rgba(232, 244, 255, 0.94)',
  },
  mobileLiveCardCopy: {
    display: 'grid',
    gridTemplateRows: 'auto auto auto',
    gridArea: '1 / 1',
    alignSelf: 'end',
    position: 'relative',
    zIndex: 2,
    alignContent: 'end',
    gap: 2,
    minWidth: 0,
    padding: '25px 6px 7px',
    pointerEvents: 'none',
  },
  mobileLiveCardTitle: {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: 2,
    color: 'rgba(255, 246, 226, 0.98)',
    fontSize: 8.8,
    fontWeight: 800,
    lineHeight: 1.08,
    marginBottom: 1,
    textShadow: '0 1px 5px rgba(0, 0, 0, 0.92), 0 0 14px rgba(255, 206, 122, 0.2)',
  },
  mobileLiveCardMeta: {
    overflow: 'hidden',
    color: 'rgba(255, 239, 205, 0.82)',
    fontSize: 7.4,
    lineHeight: 1.08,
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.9)',
  },
  mobileLiveCardDate: {
    alignSelf: 'end',
    color: 'rgba(255, 218, 145, 0.94)',
    fontSize: 6.8,
    fontWeight: 900,
    letterSpacing: 0.75,
    textTransform: 'uppercase',
    textShadow: '0 1px 4px rgba(0, 0, 0, 0.92)',
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
