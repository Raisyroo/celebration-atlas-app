import type { CSSProperties } from 'react';
import type { ATLAS_EVENTS } from './events';

export type SearchResultTextEvent = Pick<(typeof ATLAS_EVENTS)[number], 'id' | 'name' | 'location'>;

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

type Slot = { id: string; x: number; y: number };

const DESKTOP_SLOTS: Slot[] = [
  { id: 'upper-center-hero', x: 52, y: 34 },
  { id: 'upper-left-strong', x: 30, y: 27 },
  { id: 'mid-right-strong', x: 73, y: 43 },
  { id: 'left-middle-supporting', x: 24, y: 45 },
  { id: 'upper-right-supporting', x: 77, y: 28 },
  { id: 'middle-center-supporting', x: 52, y: 52 },
  { id: 'lower-left-supporting', x: 34, y: 62 },
  { id: 'far-left-ambient', x: 16, y: 34 },
  { id: 'far-right-ambient', x: 87, y: 36 },
  { id: 'upper-center-ambient', x: 50, y: 20 },
  { id: 'left-lower-ambient', x: 20, y: 63 },
  { id: 'right-lower-ambient', x: 79, y: 63 },
  { id: 'lower-center-ambient', x: 52, y: 71 },
  { id: 'bottom-left-ambient', x: 28, y: 74 },
  { id: 'bottom-right-ambient', x: 73, y: 74 },
  { id: 'mid-left-ambient', x: 38, y: 39 },
];

const MOBILE_SLOTS: Slot[] = [
  { id: 'mobile-upper-center-hero', x: 52, y: 31 },
  { id: 'mobile-upper-left-strong', x: 29, y: 23 },
  { id: 'mobile-upper-right-strong', x: 73, y: 26 },
  { id: 'mobile-left-supporting', x: 27, y: 42 },
  { id: 'mobile-right-supporting', x: 74, y: 44 },
  { id: 'mobile-center-supporting', x: 51, y: 52 },
  { id: 'mobile-lower-left-supporting', x: 30, y: 61 },
  { id: 'mobile-far-left-ambient', x: 18, y: 33 },
  { id: 'mobile-far-right-ambient', x: 84, y: 35 },
  { id: 'mobile-lower-right-ambient', x: 72, y: 63 },
  { id: 'mobile-bottom-left-ambient', x: 32, y: 72 },
  { id: 'mobile-bottom-center-ambient', x: 55, y: 74 },
];

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
  results: readonly SearchResultTextEvent[],
  viewport: ResultLabelViewport,
): ResultLabelPlacement[] {
  const slots = viewport === 'mobile' ? MOBILE_SLOTS : DESKTOP_SLOTS;
  const styles = viewport === 'mobile' ? MOBILE_TIER_STYLES : DESKTOP_TIER_STYLES;
  const cappedResults = results.slice(0, slots.length);

  return cappedResults.map((event, index) => {
    const tier = getResultLabelTier(index);
    const slot = slots[index];

    return {
      event,
      tier,
      slot: slot.id,
      x: slot.x,
      y: slot.y,
      zIndex: slots.length - index,
      style: styles[tier],
    };
  });
}
