import type { ResolvedEventMedia } from './eventMedia';
import type { OfficialEventSourceRejectionReason } from './officialEventUrl';

export type EventFlyerResolution = ResolvedEventMedia & {
  canonicalSlug: string;
  deck?: ResolvedEventMedia[];
  officialUrl?: `https://${string}`;
  officialUrlSource?: 'events' | 'event_sources';
  officialUrlField?: string;
  officialUrlDebug?: {
    sourcePath: 'events' | 'event_sources' | 'none';
    rejectedReasons: OfficialEventSourceRejectionReason[];
  };
};

export type EventFlyerResolutionMap = Record<string, EventFlyerResolution>;
