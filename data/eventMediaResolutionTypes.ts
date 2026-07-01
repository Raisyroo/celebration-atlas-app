import type { ResolvedEventMedia } from './eventMedia';

export type EventFlyerResolution = ResolvedEventMedia & {
  canonicalSlug: string;
  officialUrl?: `https://${string}`;
  officialUrlField?: string;
};

export type EventFlyerResolutionMap = Record<string, EventFlyerResolution>;
