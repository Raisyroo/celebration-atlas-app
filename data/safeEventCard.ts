import type { AtlasEvent } from './events';
import { resolveExplicitEventThumbnail } from './eventThumbnail';
import { resolveEventFlyerSrc } from './eventFlyers';
import type { EventFlyerResolutionMap } from './eventMediaResolutionTypes';
import type { ResolvedEventMedia } from './eventMedia';

export type SafeAtlasEventCard = {
  id: AtlasEvent['id'];
  name: AtlasEvent['name'];
  location: AtlasEvent['location'];
  category: AtlasEvent['category'];
  cardTag?: AtlasEvent['cardTag'];
  flyerSrc?: AtlasEvent['flyerSrc'];
  officialUrl?: `https://${string}`;
  description: AtlasEvent['blurb'];
  atmosphereLabel: string;
  media?: {
    mediaType?: NonNullable<AtlasEvent['cardMedia']>['mediaType'];
    flyerSrc?: NonNullable<AtlasEvent['flyerSrc']>;
    flyerFallbackSrc?: NonNullable<AtlasEvent['flyerSrc']>;
    flyerDeck?: ResolvedEventMedia[];
    mediaSrc?: NonNullable<AtlasEvent['cardMedia']>['mediaSrc'];
    posterSrc?: NonNullable<AtlasEvent['cardMedia']>['posterSrc'];
    atmosphereTitle?: NonNullable<AtlasEvent['cardMedia']>['atmosphereTitle'];
    mediaPosition?: NonNullable<AtlasEvent['cardMedia']>['mediaPosition'];
    mediaScale?: NonNullable<AtlasEvent['cardMedia']>['mediaScale'];
    mediaMaskProfile?: NonNullable<AtlasEvent['cardMedia']>['mediaMaskProfile'];
    mediaDelayMs?: NonNullable<AtlasEvent['cardMedia']>['mediaDelayMs'];
    mediaFadeDurationMs?: NonNullable<AtlasEvent['cardMedia']>['mediaFadeDurationMs'];
  };
  detailAction?: {
    label: 'Open full event';
    href: `/events/${string}`;
  };
  trustStatusCopy: 'Details not yet source-verified';
};

export function deriveSafeAtlasEventCard(
  event: AtlasEvent,
  flyerResolutions: EventFlyerResolutionMap = {},
): SafeAtlasEventCard {
  const explicitThumbnail = resolveExplicitEventThumbnail(event);
  const flyerSrc = (flyerResolutions[event.id]?.src
    ?? resolveEventFlyerSrc(event)) as AtlasEvent['flyerSrc'];
  const flyerFallbackSrc = flyerResolutions[event.id]?.fallback?.src as AtlasEvent['flyerSrc'] | undefined;
  const flyerDeck = flyerResolutions[event.id]?.deck;
  const media = flyerSrc
    ? {
        mediaType: 'image' as const,
        flyerSrc,
        flyerFallbackSrc,
        flyerDeck,
        mediaSrc: flyerSrc,
        mediaPosition: event.cardMedia?.mediaPosition,
        mediaScale: event.cardMedia?.mediaScale,
        mediaDelayMs: event.cardMedia?.mediaDelayMs,
        mediaFadeDurationMs: event.cardMedia?.mediaFadeDurationMs,
      }
    : explicitThumbnail
      ? {
        mediaType: 'image' as const,
        mediaSrc: explicitThumbnail.path,
        mediaPosition: event.cardMedia?.mediaPosition,
        mediaScale: event.cardMedia?.mediaScale,
        mediaDelayMs: event.cardMedia?.mediaDelayMs,
        mediaFadeDurationMs: event.cardMedia?.mediaFadeDurationMs,
      }
    : event.cardMedia?.mediaSrc || event.cardMedia?.posterSrc
      ? {
          mediaType: event.cardMedia.mediaType,
          mediaSrc: event.cardMedia.mediaSrc,
          posterSrc: event.cardMedia.posterSrc,
          atmosphereTitle: event.cardMedia.atmosphereTitle,
          mediaPosition: event.cardMedia.mediaPosition,
          mediaScale: event.cardMedia.mediaScale,
          mediaMaskProfile: event.cardMedia.mediaMaskProfile,
          mediaDelayMs: event.cardMedia.mediaDelayMs,
          mediaFadeDurationMs: event.cardMedia.mediaFadeDurationMs,
        }
      : undefined;

  return {
    id: event.id,
    name: event.name,
    location: event.location,
    category: event.category,
    cardTag: event.cardTag,
    flyerSrc,
    officialUrl: flyerResolutions[event.id]?.officialUrl,
    description: event.blurb,
    atmosphereLabel: event.cardMedia?.atmosphereTitle ?? event.atmosphereLabel,
    media,
    detailAction: event.detailPage || event.eventPageKind === 'manifest'
      ? {
          label: 'Open full event',
          href: `/events/${event.id}`,
        }
      : undefined,
    trustStatusCopy: 'Details not yet source-verified',
  };
}
