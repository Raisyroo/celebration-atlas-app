import type { ResolvedEventMedia } from './eventMedia';

export type EventFlyerResolution = ResolvedEventMedia & {
  canonicalSlug: string;
};

export type EventFlyerResolutionMap = Record<string, EventFlyerResolution>;
