import type { SafeAtlasEventCard } from './safeEventCard';

export type FlyerEventPresentation = {
  isFlyerFirst: boolean;
  hasOfficialHotspot: boolean;
};

export function getFlyerEventPresentation(
  eventCard: Pick<SafeAtlasEventCard, 'media' | 'officialUrl'> | null | undefined,
  availableFlyerSrc: string | null | undefined = eventCard?.media?.flyerSrc,
): FlyerEventPresentation {
  const isFlyerFirst = Boolean(
    eventCard?.media?.flyerSrc && availableFlyerSrc,
  );

  return {
    isFlyerFirst,
    hasOfficialHotspot: Boolean(isFlyerFirst && eventCard?.officialUrl),
  };
}
