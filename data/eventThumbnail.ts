import type { AtlasEvent } from './events';

export type EventThumbnailSourceType = 'override' | 'generated' | 'fallback';
export type EventThumbnailGenerationStatus = 'manualOverride' | 'generated' | 'fallbackReady' | 'needsGeneration' | 'failed';

export type EventThumbnailMetadata = {
  path: string;
  alt: string;
  mediaSourceType: EventThumbnailSourceType;
  generationStatus: EventThumbnailGenerationStatus;
};

const CATEGORY_FALLBACK_PATH: Record<AtlasEvent['category'], string> = {
  'Arts & Culture': '/event-media/fallback/arts-culture-thumb.webp',
  Fairs: '/event-media/fallback/fairs-thumb.webp',
  Festivals: '/event-media/fallback/festivals-thumb.webp',
  Music: '/event-media/fallback/music-thumb.webp',
};

export function getGeneratedEventThumbnailPath(event: Pick<AtlasEvent, 'id'>): string {
  return `/event-media/generated/${event.id}-thumb.webp`;
}

export function resolveExplicitEventThumbnail(
  event: AtlasEvent,
): EventThumbnailMetadata | null {
  if (event.cardMedia?.thumbnailOverrideSrc) {
    return {
      path: event.cardMedia.thumbnailOverrideSrc,
      alt: event.cardMedia.thumbnailAlt ?? `${event.name} selected Celebration Atlas thumbnail`,
      mediaSourceType: 'override',
      generationStatus: 'manualOverride',
    };
  }

  if (event.cardMedia?.thumbnailSrc) {
    return {
      path: event.cardMedia.thumbnailSrc,
      alt: event.cardMedia.thumbnailAlt ?? `${event.name} Celebration Atlas generated thumbnail`,
      mediaSourceType: event.cardMedia.thumbnailSourceType ?? 'generated',
      generationStatus: event.cardMedia.thumbnailGenerationStatus ?? 'generated',
    };
  }

  return null;
}

export function resolveEventThumbnail(event: AtlasEvent): EventThumbnailMetadata {
  const explicitThumbnail = resolveExplicitEventThumbnail(event);

  if (explicitThumbnail) return explicitThumbnail;

  return {
    path: getGeneratedEventThumbnailPath(event),
    alt: `${event.name} Celebration Atlas generated thumbnail`,
    mediaSourceType: 'generated',
    generationStatus: 'needsGeneration',
  };
}

export function resolveEventThumbnailFallback(event: AtlasEvent): EventThumbnailMetadata {
  return {
    path: CATEGORY_FALLBACK_PATH[event.category],
    alt: `${event.category} Celebration Atlas fallback thumbnail`,
    mediaSourceType: 'fallback',
    generationStatus: 'fallbackReady',
  };
}
