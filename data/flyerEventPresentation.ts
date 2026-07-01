import type { SafeAtlasEventCard } from './safeEventCard';

export type FlyerEventPresentation = {
  isFlyerFirst: boolean;
  hasOfficialHotspot: boolean;
};

export function getFlyerEventPresentation(
  eventCard: Pick<SafeAtlasEventCard, 'media' | 'officialUrl'> | null | undefined,
): FlyerEventPresentation {
  const isFlyerFirst = Boolean(eventCard?.media?.flyerSrc);

  return {
    isFlyerFirst,
    hasOfficialHotspot: Boolean(isFlyerFirst && eventCard?.officialUrl),
  };
}
