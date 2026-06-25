import type { AtlasEvent } from './events';

export const LOCAL_EVENT_FLYERS: Partial<
  Record<AtlasEvent['id'], `/event-media/flyers/${string}`>
> = {
  'romeo-peach': '/event-media/flyers/romeo-peach-festival.webp',
  'black-river-tattoo': '/event-media/flyers/black-river-tattoo-convention.webp',
  'alpena-brown-trout': '/event-media/flyers/brown-trout-festival.webp',
  'goodells-fair': '/event-media/flyers/goodells-fair.webp',
  'mackinac-lilac': '/event-media/flyers/mackinac-island-lilac-festival.webp',
  'upper-peninsula-state-fair': '/event-media/flyers/upper-peninsula-state-fair.webp',
};

export function getLocalEventFlyerSrc(
  eventId: AtlasEvent['id'],
): `/event-media/flyers/${string}` | undefined {
  return LOCAL_EVENT_FLYERS[eventId];
}
