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
  { id: 'center-hero', x: 53, y: 39 },
  { id: 'upper-left-strong', x: 31, y: 27 },
  { id: 'upper-right-strong', x: 72, y: 29 },
  { id: 'left-middle-strong', x: 24, y: 47 },
  { id: 'right-middle-supporting', x: 78, y: 48 },
  { id: 'lower-center-supporting', x: 55, y: 63 },
  { id: 'upper-center-supporting', x: 49, y: 20 },
  { id: 'lower-left-supporting', x: 33, y: 66 },
  { id: 'lower-right-ambient', x: 76, y: 68 },
  { id: 'far-left-ambient', x: 16, y: 35 },
  { id: 'far-right-ambient', x: 86, y: 36 },
  { id: 'bottom-left-ambient', x: 22, y: 77 },
  { id: 'bottom-center-ambient', x: 48, y: 78 },
  { id: 'bottom-right-ambient', x: 82, y: 79 },
];

const MOBILE_SLOTS: Slot[] = [
  { id: 'mobile-center-hero', x: 52, y: 33 },
  { id: 'mobile-upper-left-strong', x: 28, y: 23 },
  { id: 'mobile-upper-right-strong', x: 73, y: 25 },
  { id: 'mobile-left-supporting', x: 25, y: 43 },
  { id: 'mobile-right-supporting', x: 74, y: 45 },
  { id: 'mobile-lower-center-supporting', x: 52, y: 58 },
  { id: 'mobile-lower-left-ambient', x: 31, y: 68 },
  { id: 'mobile-lower-right-ambient', x: 72, y: 70 },
  { id: 'mobile-bottom-center-ambient', x: 52, y: 78 },
];

const DESKTOP_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { fontSize: 'clamp(28px, 3.2vw, 54px)', color: 'rgba(255, 246, 220, 0.98)', opacity: 1, textShadow: '0 0 10px rgba(255, 234, 180, 0.44), 0 0 30px rgba(220, 150, 56, 0.26), 0 2px 8px rgba(0, 0, 0, 0.78)' },
  strong: { fontSize: 'clamp(20px, 2.1vw, 36px)', color: 'rgba(246, 215, 154, 0.93)', opacity: 0.92, textShadow: '0 0 8px rgba(246, 203, 126, 0.32), 0 0 22px rgba(206, 132, 42, 0.18), 0 2px 7px rgba(0, 0, 0, 0.76)' },
  supporting: { fontSize: 'clamp(15px, 1.45vw, 25px)', color: 'rgba(231, 194, 128, 0.82)', opacity: 0.74, textShadow: '0 0 7px rgba(227, 180, 104, 0.22), 0 1px 6px rgba(0, 0, 0, 0.72)' },
  ambient: { fontSize: 'clamp(12px, 1.08vw, 18px)', color: 'rgba(218, 177, 112, 0.7)', opacity: 0.58, textShadow: '0 0 5px rgba(219, 169, 91, 0.16), 0 1px 5px rgba(0, 0, 0, 0.7)' },
};

const MOBILE_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { ...DESKTOP_TIER_STYLES.hero, fontSize: 'clamp(24px, 7.2vw, 36px)' },
  strong: { ...DESKTOP_TIER_STYLES.strong, fontSize: 'clamp(18px, 5.3vw, 26px)' },
  supporting: { ...DESKTOP_TIER_STYLES.supporting, fontSize: 'clamp(14px, 4vw, 20px)' },
  ambient: { ...DESKTOP_TIER_STYLES.ambient, fontSize: 'clamp(12px, 3.35vw, 16px)', opacity: 0.62 },
};

export function getResultLabelTier(index: number): ResultLabelTier {
  if (index === 0) return 'hero';
  if (index <= 3) return 'strong';
  if (index <= 7) return 'supporting';
  return 'ambient';
}

export function formatResultLabelLocation(location: string): string {
  const [city] = location.split(',').map((part) => part.trim()).filter(Boolean);
  return city ? `${city}, MI` : 'Michigan';
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
