import type { AtlasEvent } from './events';
import type { StateAtlasConfig } from './stateAtlasConfig';
import { EVENT_TIMING_METADATA } from './eventTimingMetadata';
import { resolveExplicitEventThumbnail } from './eventThumbnail';
import {
  resolveAtlasEventProfileDateRange,
  resolveReviewedAtlasEventSeason,
  resolveReviewedAtlasEventTiming,
} from './stateAtlasEventProfile';
import type {
  EventCoverageLevel,
  EventIndoorOutdoor,
  EventExperienceItem,
  EventMediaItem,
  EventProfile,
  EventSeason,
} from './eventProfileTypes';

// This adapter is a compatibility bridge from the current AtlasEvent catalog
// to the richer EventProfile model consumed by homepage discovery and search.

type ParsedLocation = {
  city: string;
  state: string;
  stateSlug: string;
  locationName?: string;
};

const UNKNOWN_DATE_TEXT = 'Unknown';
const DEFAULT_CONFIDENCE_SCORE = 0.35;

function compactStrings(values: Array<string | undefined | null>): string[] {
  return values
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function uniqueStrings(values: Array<string | undefined | null>): string[] {
  return Array.from(new Set(compactStrings(values)));
}

function parseLocationLabel(
  location: string,
  stateConfig?: StateAtlasConfig,
): ParsedLocation {
  const [rawCity, rawState, ...remainingParts] = location
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (stateConfig) {
    return {
      city: rawCity || location,
      state: stateConfig.identity.name,
      stateSlug: stateConfig.identity.slug,
      locationName: location,
    };
  }

  if (rawCity && rawState && remainingParts.length === 0) {
    const normalizedState = rawState === 'MI' ? 'Michigan' : rawState;
    const stateSlug = normalizedState.toLowerCase().replace(/\s+/g, '-');

    return {
      city: rawCity,
      state: normalizedState,
      stateSlug,
      locationName: location,
    };
  }

  return {
    city: location,
    state: 'Unknown',
    stateSlug: 'unknown',
    locationName: location,
  };
}

function mapCoverageLevel(event: AtlasEvent): EventCoverageLevel {
  if (event.detailPage?.eventSnapshot) {
    return 'practicalEventPage';
  }

  if (event.detailPage) {
    return 'stateDiscoveryCoverage';
  }

  return 'basicNationalCoverage';
}

function mapSeason(event: AtlasEvent): EventSeason | undefined {
  const reviewedSeason = resolveReviewedAtlasEventSeason(event.dateRange);
  if (reviewedSeason) return reviewedSeason;

  const monthHint = event.detailPage?.eventSnapshot?.typicalMonth?.toLowerCase();

  if (!monthHint) {
    return undefined;
  }

  if (['march', 'april', 'may'].some((month) => monthHint.includes(month))) {
    return 'spring';
  }

  if (['june', 'july', 'august'].some((month) => monthHint.includes(month))) {
    return 'summer';
  }

  if (['september', 'october', 'november'].some((month) => monthHint.includes(month))) {
    return 'fall';
  }

  if (['december', 'january', 'february'].some((month) => monthHint.includes(month))) {
    return 'winter';
  }

  return undefined;
}

function mapIndoorOutdoor(event: AtlasEvent): EventIndoorOutdoor | undefined {
  const setting = event.detailPage?.eventSnapshot?.setting?.toLowerCase();

  if (!setting) {
    return undefined;
  }

  if (setting.includes('indoor')) {
    return 'indoor';
  }

  if (
    setting.includes('outdoor') ||
    setting.includes('downtown') ||
    setting.includes('waterfront') ||
    setting.includes('harbor') ||
    setting.includes('streets')
  ) {
    return 'outdoor';
  }

  return undefined;
}

function createExperienceItems(event: AtlasEvent): EventExperienceItem[] | undefined {
  const experiences: EventExperienceItem[] = [
    ...event.atlasNotes?.map((note, index) => ({
      id: `${event.id}-atlas-note-${index + 1}`,
      title: `Atlas note ${index + 1}`,
      shortDescription: note,
      category: 'atlasNote',
      importance: 'standard' as const,
      tags: ['atlas-note'],
    })) ?? [],
    ...event.atlasMemories?.map((memory, index) => ({
      id: `${event.id}-atlas-memory-${index + 1}`,
      title: `Atlas memory ${index + 1}`,
      shortDescription: memory,
      category: 'atlasMemory',
      importance: 'standard' as const,
      tags: ['memory'],
    })) ?? [],
    ...event.localFlavor?.map((flavor, index) => ({
      id: `${event.id}-local-flavor-${index + 1}`,
      title: `Local flavor ${index + 1}`,
      shortDescription: flavor,
      category: 'localFlavor',
      importance: 'standard' as const,
      tags: ['local-flavor'],
    })) ?? [],
  ];

  const snapshot = event.detailPage?.eventSnapshot;

  if (snapshot?.signatureMoment) {
    experiences.push({
      id: `${event.id}-signature-moment`,
      title: 'Signature moment',
      shortDescription: snapshot.signatureMoment,
      category: 'signatureMoment',
      importance: 'major',
      tags: ['signature-moment'],
    });
  }

  return experiences.length > 0 ? experiences : undefined;
}

function createMediaItems(event: AtlasEvent): EventMediaItem[] | undefined {
  const mediaItems: EventMediaItem[] = [];
  const seen = new Set<string>();

  function addMediaItem(item: EventMediaItem) {
    const key = `${item.slot}:${item.src}`;

    if (!seen.has(key)) {
      mediaItems.push(item);
      seen.add(key);
    }
  }

  const thumbnail = resolveExplicitEventThumbnail(event);

  if (thumbnail) {
    addMediaItem({
      id: `${event.id}-thumbnail`,
      slot: 'thumbnailImage',
      kind: 'image',
      src: thumbnail.path,
      title: `${event.name} thumbnail`,
      alt: thumbnail.alt,
      isPrimary: true,
      confidence: thumbnail.mediaSourceType === 'override' ? 'medium' : 'low',
    });
  }

  if (event.cardMedia?.mediaSrc) {
    addMediaItem({
      id: `${event.id}-card-media`,
      slot: event.cardMedia.mediaType === 'video' ? 'atmosphereLoop' : 'heroImage',
      kind: event.cardMedia.mediaType === 'video' ? 'video' : 'image',
      src: event.cardMedia.mediaSrc,
      title: event.cardMedia.atmosphereTitle ?? event.atmosphereLabel,
      alt: `${event.name} media`,
      posterSrc: event.cardMedia.posterSrc,
      isPrimary: mediaItems.length === 0,
      confidence: 'low',
    });
  }

  if (event.detailPage?.mediaSrc) {
    addMediaItem({
      id: `${event.id}-detail-media`,
      slot: event.detailPage.mediaType === 'video' ? 'atmosphereLoop' : 'heroImage',
      kind: event.detailPage.mediaType === 'video' ? 'video' : 'image',
      src: event.detailPage.mediaSrc,
      title: event.detailPage.atmosphereLine ?? event.atmosphereLabel,
      alt: `${event.name} detail media`,
      posterSrc: event.detailPage.posterSrc,
      isPrimary: mediaItems.length === 0,
      confidence: 'low',
    });
  }

  if (event.detailPage?.introVideoSrc) {
    addMediaItem({
      id: `${event.id}-intro-video`,
      slot: 'introVideo',
      kind: 'video',
      src: event.detailPage.introVideoSrc,
      title: `${event.name} intro video`,
      alt: `${event.name} intro video`,
      posterSrc: event.detailPage.posterSrc,
      confidence: 'low',
    });
  }

  if (event.detailPage?.posterSrc) {
    addMediaItem({
      id: `${event.id}-poster`,
      slot: 'posterArtwork',
      kind: 'image',
      src: event.detailPage.posterSrc,
      title: `${event.name} poster artwork`,
      alt: `${event.name} poster artwork`,
      confidence: 'low',
    });
  }

  return mediaItems.length > 0 ? mediaItems : undefined;
}

function createTags(event: AtlasEvent): string[] {
  return uniqueStrings([
    event.category,
    event.cardTag,
    event.iconType,
    event.atmosphereLabel,
    event.regionAtmosphere,
    event.detailPage?.atmosphereLine,
    event.detailPage?.visitorMood,
    ...(event.atmosphere?.effects ?? []),
  ]);
}

export function toEventProfile(
  event: AtlasEvent,
  stateConfig?: StateAtlasConfig,
): EventProfile {
  const location = parseLocationLabel(event.location, stateConfig);
  const categories = uniqueStrings([event.category, event.cardTag]);
  const eventTypes = uniqueStrings([event.category, event.iconType]);
  const snapshot = event.detailPage?.eventSnapshot;
  const timing =
    resolveReviewedAtlasEventTiming(
      event.dateRange,
      stateConfig?.defaultTimeZone ??
        (location.stateSlug === 'michigan' ? 'America/Detroit' : undefined),
    ) ?? EVENT_TIMING_METADATA[event.id];
  const exactDateRange = resolveAtlasEventProfileDateRange(
    event.dateRange,
    stateConfig?.defaultTimeZone ??
      (location.stateSlug === 'michigan' ? 'America/Detroit' : undefined),
  );

  return {
    id: event.id,
    slug: event.id,
    name: event.name,
    alternateNames: event.searchAliases,
    shortDescription: event.blurb,
    longDescription: event.detailPage?.shortStory ?? event.detailPage?.detailIntro,
    eventTypes,
    categories,
    tags: createTags(event),
    communityIdentityTags: uniqueStrings([event.regionAtmosphere, event.atmosphereLabel]),
    city: location.city,
    region: event.regionAtmosphere,
    state: location.state,
    stateSlug: location.stateSlug,
    locationName: location.locationName,
    coordinates: {
      latitude: event.latitude,
      longitude: event.longitude,
      precision: 'approximate',
    },
    dateRange: exactDateRange
      ? exactDateRange
      : {
          startDate: UNKNOWN_DATE_TEXT,
          displayText: snapshot?.typicalMonth ?? UNKNOWN_DATE_TEXT,
          isEstimated: true,
        },
    recurrence: snapshot?.typicalMonth
      ? {
          frequency: 'annual',
          monthHint: snapshot.typicalMonth,
        }
      : undefined,
    season: mapSeason(event),
    indoorOutdoor: mapIndoorOutdoor(event),
    coverageLevel: mapCoverageLevel(event),
    scheduleStatus: 'unknown',
    timing,
    experiences: createExperienceItems(event),
    practicalAttendance: snapshot
      ? {
          scheduleStatus: 'unknown',
          weatherConsiderations: snapshot.setting,
          familyTips: snapshot.bestFor,
          planTips: compactStrings([
            snapshot.setting,
            snapshot.bestFor,
            snapshot.signatureMoment,
          ]).map((body, index) => ({
            id: `${event.id}-snapshot-tip-${index + 1}`,
            title: ['Setting', 'Best for', 'Signature moment'][index] ?? `Snapshot ${index + 1}`,
            body,
            category: index === 1 ? 'family' : 'other',
            importance: index === 2 ? 'major' : 'standard',
          })),
        }
      : undefined,
    curiosityItems: event.detailPage?.archivalNote
      ? [
          {
            id: `${event.id}-archival-note`,
            title: 'Archival note',
            summary: event.detailPage.archivalNote,
            category: 'history',
            confidence: 'low',
          },
        ]
      : undefined,
    media: createMediaItems(event),
    sources: [],
    trust: {
      sourceStatus: 'unverified',
      confidence: 'low',
      confidenceScore: DEFAULT_CONFIDENCE_SCORE,
    },
  };
}

export function toEventProfiles(
  events: readonly AtlasEvent[],
  stateConfig?: StateAtlasConfig,
): EventProfile[] {
  return events.map((event) => toEventProfile(event, stateConfig));
}
