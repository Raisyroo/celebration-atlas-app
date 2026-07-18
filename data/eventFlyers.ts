export type EventFlyerAssetMode = 'local' | 'hosted';

export type EventFlyerRecord = {
  src: `/event-media/flyers/${string}` | `https://${string}`;
  assetMode: EventFlyerAssetMode;
  ticketsUrl?: string;
};

export const EVENT_FLYERS: Readonly<Record<string, EventFlyerRecord>> = {};

export function getEventFlyer(eventId: string): EventFlyerRecord | undefined {
  return EVENT_FLYERS[eventId];
}
