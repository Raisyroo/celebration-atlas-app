import type { CSSProperties } from 'react';
import type { ATLAS_EVENTS } from './events';

export type SearchResultTextEvent = Pick<(typeof ATLAS_EVENTS)[number], 'id' | 'name' | 'location'>;

export type ProjectedResultLabelEvent = {
  event: SearchResultTextEvent;
  position: { x: number; y: number };
};

export type ResultLabelTier = 'hero' | 'strong' | 'supporting' | 'ambient';
export type ResultLabelViewport = 'desktop' | 'mobile';

export type ResultLabelPlacement = {
  event: SearchResultTextEvent;
  tier: ResultLabelTier;
  slot: string;
  x: number;
  y: number;
  zIndex: number;
  style: CSSProperties;
};

const DESKTOP_LABEL_LIMIT = 18;
const MOBILE_LABEL_LIMIT = 12;

const DESKTOP_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { fontSize: 'clamp(22px, 2.05vw, 31px)', color: 'rgba(255, 246, 218, 0.98)', opacity: 1, textShadow: '0 0 8px rgba(255, 232, 174, 0.34), 0 0 22px rgba(220, 150, 56, 0.18), 0 2px 7px rgba(0, 0, 0, 0.76)' },
  strong: { fontSize: 'clamp(18px, 1.68vw, 25px)', color: 'rgba(246, 215, 154, 0.92)', opacity: 0.9, textShadow: '0 0 7px rgba(246, 203, 126, 0.24), 0 0 16px rgba(206, 132, 42, 0.13), 0 2px 6px rgba(0, 0, 0, 0.74)' },
  supporting: { fontSize: 'clamp(15px, 1.28vw, 20px)', color: 'rgba(232, 196, 132, 0.82)', opacity: 0.76, textShadow: '0 0 5px rgba(227, 180, 104, 0.18), 0 1px 5px rgba(0, 0, 0, 0.72)' },
  ambient: { fontSize: 'clamp(13px, 1.02vw, 16px)', color: 'rgba(218, 177, 112, 0.72)', opacity: 0.6, textShadow: '0 0 4px rgba(219, 169, 91, 0.12), 0 1px 4px rgba(0, 0, 0, 0.7)' },
};

const MOBILE_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { ...DESKTOP_TIER_STYLES.hero, fontSize: 'clamp(19px, 5.8vw, 23px)' },
  strong: { ...DESKTOP_TIER_STYLES.strong, fontSize: 'clamp(16px, 4.8vw, 19px)' },
  supporting: { ...DESKTOP_TIER_STYLES.supporting, fontSize: 'clamp(14px, 4.15vw, 17px)' },
  ambient: { ...DESKTOP_TIER_STYLES.ambient, fontSize: 'clamp(12px, 3.55vw, 14px)', opacity: 0.62 },
};

export function getResultLabelTier(index: number): ResultLabelTier {
  if (index === 0) return 'hero';
  if (index <= 2) return 'strong';
  if (index <= 6) return 'supporting';
  return 'ambient';
}

export function formatResultLabelLocation(location: string): string {
  const [city] = location.split(',').map((part) => part.trim()).filter(Boolean);
  return city ? `${city}, MI` : '';
}

export function resolveResultLabelPlacements(
  results: readonly ProjectedResultLabelEvent[],
  viewport: ResultLabelViewport,
): ResultLabelPlacement[] {
  const styles = viewport === 'mobile' ? MOBILE_TIER_STYLES : DESKTOP_TIER_STYLES;
  const labelLimit = viewport === 'mobile' ? MOBILE_LABEL_LIMIT : DESKTOP_LABEL_LIMIT;
  const projectedResults = results.filter(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y));
  const cappedResults = projectedResults.slice(0, labelLimit);

  return cappedResults.map(({ event, position }, index) => {
    const tier = getResultLabelTier(index);

    return {
      event,
      tier,
      slot: `projected-${event.id}`,
      x: position.x,
      y: position.y,
      zIndex: labelLimit - index,
      style: styles[tier],
    };
  });
}
