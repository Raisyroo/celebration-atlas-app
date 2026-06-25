export type EventFlyerAssetMode = 'local' | 'hosted';

export type EventFlyerRecord = {
  src: `/event-media/flyers/${string}` | `https://${string}`;
  assetMode: EventFlyerAssetMode;
  ticketsUrl?: string;
};

export const EVENT_FLYERS = {
  'romeo-peach': {
    src: '/event-media/flyers/romeo-peach-festival.webp',
    assetMode: 'local',
  },
  'goodells-fair': {
    src: '/event-media/flyers/goodells-fair.webp',
    assetMode: 'local',
  },
  'black-river-tattoo': {
    src: '/event-media/flyers/black-river-tattoo-convention.webp',
    assetMode: 'local',
  },
  'alpena-brown-trout': {
    src: '/event-media/flyers/brown-trout-festival.webp',
    assetMode: 'local',
  },
  'mackinac-lilac': {
    src: '/event-media/flyers/mackinac-island-lilac-festival.webp',
    assetMode: 'local',
  },
  'upper-peninsula-state-fair': {
    src: '/event-media/flyers/upper-peninsula-state-fair.webp',
    assetMode: 'local',
  },
} as const satisfies Record<string, EventFlyerRecord>;

export type EventFlyerEventId = keyof typeof EVENT_FLYERS;

export function getEventFlyer(eventId: string): EventFlyerRecord | undefined {
  return EVENT_FLYERS[eventId as EventFlyerEventId];
}

export function resolveEventFlyerSrc(event: { id: string; flyerSrc?: AtlasEventFlyerSrc }): AtlasEventFlyerSrc | undefined {
  return getEventFlyer(event.id)?.src ?? event.flyerSrc;
}

type AtlasEventFlyerSrc = `/event-media/${string}` | `https://${string}`;
