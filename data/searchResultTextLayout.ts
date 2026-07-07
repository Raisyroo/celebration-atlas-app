import type { CSSProperties } from 'react';
import type { ATLAS_EVENTS } from './events';

export type SearchResultTextEvent = Pick<(typeof ATLAS_EVENTS)[number], 'id' | 'name' | 'location'>;

export type ProjectedResultLabelEvent = {
  event: SearchResultTextEvent;
  position: { x: number; y: number };
};

export type ResultLabelTier = 'hero' | 'strong' | 'supporting' | 'ambient' | 'compact' | 'micro';
export type ResultLabelViewport = 'desktop' | 'mobile';

type LabelRect = { left: number; right: number; top: number; bottom: number };

export type ResultLabelPlacement = {
  kind: 'label';
  event: SearchResultTextEvent;
  tier: ResultLabelTier;
  slot: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  zIndex: number;
  style: CSSProperties;
  rect: LabelRect;
};

export type ResultLabelClusterPlacement = {
  kind: 'cluster';
  id: string;
  events: SearchResultTextEvent[];
  label: string;
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
  zIndex: number;
  rect: LabelRect;
};

export type ResultLabelLayoutItem = ResultLabelPlacement | ResultLabelClusterPlacement;

const DESKTOP_LABEL_LIMIT = 18;
const MOBILE_LABEL_LIMIT = 12;
const MAX_LOCAL_OFFSET_PERCENT = { desktop: 7.2, mobile: 8.8 } as const;
const PROTECTED_TOP_PERCENT = { desktop: 12, mobile: 16 } as const;
const PROTECTED_BOTTOM_PERCENT = { desktop: 18, mobile: 26 } as const;
const LABEL_GAP_PERCENT = { desktop: 1.2, mobile: 1.8 } as const;

const DESKTOP_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { fontSize: 'clamp(25px, 2.02vw, 30px)', fontWeight: 500, color: 'rgba(255, 249, 228, 0.98)', opacity: 1, textShadow: '0 0 6px rgba(255, 232, 174, 0.28), 0 0 16px rgba(218, 151, 58, 0.16), 0 2px 6px rgba(0, 0, 0, 0.76)' },
  strong: { fontSize: 'clamp(20px, 1.58vw, 24px)', fontWeight: 500, color: 'rgba(248, 219, 160, 0.93)', opacity: 0.92, textShadow: '0 0 5px rgba(246, 203, 126, 0.2), 0 0 12px rgba(206, 132, 42, 0.11), 0 2px 5px rgba(0, 0, 0, 0.74)' },
  supporting: { fontSize: 'clamp(16px, 1.18vw, 19px)', fontWeight: 400, color: 'rgba(233, 198, 135, 0.84)', opacity: 0.78, textShadow: '0 0 4px rgba(227, 180, 104, 0.14), 0 1px 4px rgba(0, 0, 0, 0.72)' },
  ambient: { fontSize: 'clamp(12px, .98vw, 15px)', fontWeight: 400, color: 'rgba(208, 157, 88, 0.68)', opacity: 0.58, textShadow: '0 0 3px rgba(219, 169, 91, 0.1), 0 1px 4px rgba(0, 0, 0, 0.7)' },
  compact: { fontSize: 'clamp(11px, .84vw, 13px)', fontWeight: 400, color: 'rgba(206, 158, 92, 0.64)', opacity: 0.56, textShadow: '0 1px 4px rgba(0, 0, 0, 0.68)' },
  micro: { fontSize: 'clamp(10px, .74vw, 12px)', fontWeight: 400, color: 'rgba(204, 154, 88, 0.58)', opacity: 0.52, textShadow: '0 1px 3px rgba(0, 0, 0, 0.66)' },
};

const MOBILE_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { ...DESKTOP_TIER_STYLES.hero, fontSize: 'clamp(25px, 7vw, 30px)' },
  strong: { ...DESKTOP_TIER_STYLES.strong, fontSize: 'clamp(20px, 5.7vw, 24px)' },
  supporting: { ...DESKTOP_TIER_STYLES.supporting, fontSize: 'clamp(16px, 4.6vw, 19px)' },
  ambient: { ...DESKTOP_TIER_STYLES.ambient, fontSize: 'clamp(12px, 3.6vw, 15px)', opacity: 0.6 },
  compact: { ...DESKTOP_TIER_STYLES.compact, fontSize: 'clamp(11px, 3.2vw, 13px)' },
  micro: { ...DESKTOP_TIER_STYLES.micro, fontSize: 'clamp(10px, 2.9vw, 12px)' },
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

const intersects = (a: LabelRect, b: LabelRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
const localOffsets = [
  [0, 0], [2.6, 0], [-2.6, 0], [0, 2.4], [0, -2.4], [4.4, 2.4], [-4.4, 2.4], [4.4, -2.4], [-4.4, -2.4], [6.4, 0], [-6.4, 0], [0, 5.2], [0, -5.2],
] as const;

const estimateRect = (event: SearchResultTextEvent, x: number, y: number, tier: ResultLabelTier, viewport: ResultLabelViewport): LabelRect => {
  const chars = event.name.length;
  const city = formatResultLabelLocation(event.location);
  const scale = tier === 'hero' ? 1.25 : tier === 'strong' ? 1.12 : tier === 'supporting' ? 1 : tier === 'ambient' ? 0.88 : tier === 'compact' ? 0.74 : 0.66;
  const baseWidth = viewport === 'mobile' ? 25 : 18;
  const width = Math.min(viewport === 'mobile' ? 42 : 30, Math.max(viewport === 'mobile' ? 17 : 10, (baseWidth + chars * (viewport === 'mobile' ? 0.34 : 0.2)) * scale));
  const titleLines = chars > (viewport === 'mobile' ? 18 : 26) ? 2 : 1;
  const height = ((titleLines * (viewport === 'mobile' ? 3.2 : 2.2)) + (city ? (viewport === 'mobile' ? 2.1 : 1.35) : 0)) * scale;
  const gap = LABEL_GAP_PERCENT[viewport];
  return { left: x - width / 2 - gap, right: x + width / 2 + gap, top: y - height / 2 - gap, bottom: y + height / 2 + gap };
};

const fits = (rect: LabelRect, occupied: readonly LabelRect[], viewport: ResultLabelViewport) => {
  if (rect.left < 2 || rect.right > 98 || rect.top < PROTECTED_TOP_PERCENT[viewport] || rect.bottom > 100 - PROTECTED_BOTTOM_PERCENT[viewport]) return false;
  return !occupied.some((other) => intersects(rect, other));
};

export function resolveResultLabelPlacements(
  results: readonly ProjectedResultLabelEvent[],
  viewport: ResultLabelViewport,
): ResultLabelLayoutItem[] {
  const styles = viewport === 'mobile' ? MOBILE_TIER_STYLES : DESKTOP_TIER_STYLES;
  const labelLimit = viewport === 'mobile' ? MOBILE_LABEL_LIMIT : DESKTOP_LABEL_LIMIT;
  const projectedResults = results.filter(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y));
  const occupied: LabelRect[] = [];
  const items: ResultLabelLayoutItem[] = [];
  const unresolved: ProjectedResultLabelEvent[] = [];

  projectedResults.slice(0, labelLimit).forEach(({ event, position }, index) => {
    const normalTier = getResultLabelTier(index);
    const tiers: ResultLabelTier[] = normalTier === 'hero' ? [normalTier] : [normalTier, 'compact', 'micro'];
    let placed: ResultLabelPlacement | null = null;

    for (const tier of tiers) {
      for (const [dx, dy] of localOffsets) {
        if (Math.hypot(dx, dy) > MAX_LOCAL_OFFSET_PERCENT[viewport]) continue;
        const x = Math.min(98, Math.max(2, position.x + dx));
        const y = Math.min(100 - PROTECTED_BOTTOM_PERCENT[viewport], Math.max(PROTECTED_TOP_PERCENT[viewport], position.y + dy));
        const rect = estimateRect(event, x, y, tier, viewport);
        if (!fits(rect, occupied, viewport)) continue;
        placed = { kind: 'label', event, tier, slot: `projected-${event.id}`, x, y, anchorX: position.x, anchorY: position.y, zIndex: labelLimit - index, style: styles[tier], rect };
        break;
      }
      if (placed) break;
    }

    if (placed) {
      occupied.push(placed.rect);
      items.push(placed);
    } else {
      unresolved.push({ event, position });
    }
  });

  if (unresolved.length > 0) {
    const anchor = unresolved.reduce((acc, item) => ({ x: acc.x + item.position.x / unresolved.length, y: acc.y + item.position.y / unresolved.length }), { x: 0, y: 0 });
    const x = Math.min(96, Math.max(4, anchor.x));
    const y = Math.min(100 - PROTECTED_BOTTOM_PERCENT[viewport], Math.max(PROTECTED_TOP_PERCENT[viewport], anchor.y));
    items.push({ kind: 'cluster', id: `result-label-cluster-${unresolved.map(({ event }) => event.id).join('-')}`, events: unresolved.map(({ event }) => event), label: `+${unresolved.length} events`, x, y, anchorX: anchor.x, anchorY: anchor.y, zIndex: 1, rect: { left: x - 7, right: x + 7, top: y - 2.5, bottom: y + 2.5 } });
  }

  return items;
}
