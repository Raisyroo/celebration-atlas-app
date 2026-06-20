import type { AtlasEvent } from './events';
import { resolveExplicitEventThumbnail } from './eventThumbnail';

export type SafeAtlasEventCard = {
  id: AtlasEvent['id'];
  name: AtlasEvent['name'];
  location: AtlasEvent['location'];
  category: AtlasEvent['category'];
  cardTag?: AtlasEvent['cardTag'];
  description: AtlasEvent['blurb'];
  atmosphereLabel: string;
  media?: {
    mediaType?: NonNullable<AtlasEvent['cardMedia']>['mediaType'];
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

export function deriveSafeAtlasEventCard(event: AtlasEvent): SafeAtlasEventCard {
  const explicitThumbnail = resolveExplicitEventThumbnail(event);
  const media = explicitThumbnail
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
    description: event.blurb,
    atmosphereLabel: event.cardMedia?.atmosphereTitle ?? event.atmosphereLabel,
    media,
    detailAction: event.detailPage
      ? {
          label: 'Open full event',
          href: `/events/${event.id}`,
        }
      : undefined,
    trustStatusCopy: 'Details not yet source-verified',
  };
}
