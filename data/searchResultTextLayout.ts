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
const MAX_LOCAL_OFFSET_PERCENT = { desktop: 9.4, mobile: 10.8 } as const;
const PROTECTED_TOP_PERCENT = { desktop: 12, mobile: 16 } as const;
const PROTECTED_BOTTOM_PERCENT = { desktop: 18, mobile: 26 } as const;
const LABEL_GAP_PERCENT = { desktop: 1.2, mobile: 1.8 } as const;
const LOCAL_CLUSTER_DISTANCE_PERCENT = { desktop: 12, mobile: 14 } as const;

const DESKTOP_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { fontSize: 'clamp(22px, 2.05vw, 31px)', color: 'rgba(255, 246, 218, 0.98)', opacity: 1, textShadow: '0 0 8px rgba(255, 232, 174, 0.34), 0 0 22px rgba(220, 150, 56, 0.18), 0 2px 7px rgba(0, 0, 0, 0.76)' },
  strong: { fontSize: 'clamp(18px, 1.68vw, 25px)', color: 'rgba(246, 215, 154, 0.92)', opacity: 0.9, textShadow: '0 0 7px rgba(246, 203, 126, 0.24), 0 0 16px rgba(206, 132, 42, 0.13), 0 2px 6px rgba(0, 0, 0, 0.74)' },
  supporting: { fontSize: 'clamp(15px, 1.28vw, 20px)', color: 'rgba(232, 196, 132, 0.82)', opacity: 0.76, textShadow: '0 0 5px rgba(227, 180, 104, 0.18), 0 1px 5px rgba(0, 0, 0, 0.72)' },
  ambient: { fontSize: 'clamp(13px, 1.02vw, 16px)', color: 'rgba(218, 177, 112, 0.72)', opacity: 0.6, textShadow: '0 0 4px rgba(219, 169, 91, 0.12), 0 1px 4px rgba(0, 0, 0, 0.7)' },
  compact: { fontSize: 'clamp(12px, .88vw, 14px)', color: 'rgba(216, 175, 110, 0.68)', opacity: 0.58, textShadow: '0 1px 4px rgba(0, 0, 0, 0.68)' },
  micro: { fontSize: 'clamp(11px, .78vw, 12px)', color: 'rgba(214, 171, 105, 0.62)', opacity: 0.54, textShadow: '0 1px 3px rgba(0, 0, 0, 0.66)' },
};

const MOBILE_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { ...DESKTOP_TIER_STYLES.hero, fontSize: 'clamp(19px, 5.8vw, 23px)' },
  strong: { ...DESKTOP_TIER_STYLES.strong, fontSize: 'clamp(16px, 4.8vw, 19px)' },
  supporting: { ...DESKTOP_TIER_STYLES.supporting, fontSize: 'clamp(14px, 4.15vw, 17px)' },
  ambient: { ...DESKTOP_TIER_STYLES.ambient, fontSize: 'clamp(12px, 3.55vw, 14px)', opacity: 0.62 },
  compact: { ...DESKTOP_TIER_STYLES.compact, fontSize: 'clamp(11px, 3.18vw, 12px)' },
  micro: { ...DESKTOP_TIER_STYLES.micro, fontSize: 'clamp(10px, 2.85vw, 11px)' },
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

const intersects = (a: LabelRect, b: LabelRect) => a.left <= b.right && a.right >= b.left && a.top <= b.bottom && a.bottom >= b.top;

const localOffsets = (() => {
  const offsets: [number, number][] = [[0, 0]];
  const rings = [2.2, 3.8, 5.6, 7.4, 9.2, 10.6];
  const directions = [[0, -1], [0, 1], [-1, 0], [1, 0], [-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72], [-1, -0.38], [1, -0.38], [-1, 0.38], [1, 0.38], [-0.38, -1], [0.38, -1], [-0.38, 1], [0.38, 1]] as const;
  for (const radius of rings) {
    for (const [x, y] of directions) offsets.push([Number((x * radius).toFixed(2)), Number((y * radius).toFixed(2))]);
  }
  return offsets;
})();

const wrappedTitleLineCount = (title: string, tier: ResultLabelTier, viewport: ResultLabelViewport) => {
  const scale = tier === 'hero' ? 1.25 : tier === 'strong' ? 1.12 : tier === 'supporting' ? 1 : tier === 'ambient' ? 0.88 : tier === 'compact' ? 0.74 : 0.66;
  const charsPerLine = Math.floor((viewport === 'mobile' ? 15 : 23) / scale);
  const words = title.split(/\s+/).filter(Boolean);
  let lines = 1;
  let lineLength = 0;

  for (const word of words) {
    const nextLength = lineLength === 0 ? word.length : lineLength + 1 + word.length;
    if (nextLength > charsPerLine && lines === 1) {
      lines = 2;
      lineLength = word.length;
    } else {
      lineLength = nextLength;
    }
  }

  return lines;
};

const estimateRect = (event: SearchResultTextEvent, x: number, y: number, tier: ResultLabelTier, viewport: ResultLabelViewport): LabelRect => {
  const chars = event.name.length;
  const city = formatResultLabelLocation(event.location);
  const scale = tier === 'hero' ? 1.25 : tier === 'strong' ? 1.12 : tier === 'supporting' ? 1 : tier === 'ambient' ? 0.88 : tier === 'compact' ? 0.74 : 0.66;
  const titleLines = wrappedTitleLineCount(event.name, tier, viewport);
  const lineChars = Math.ceil(chars / titleLines);
  const width = Math.min(viewport === 'mobile' ? 39 : 28, Math.max(viewport === 'mobile' ? 14 : 9, (lineChars * (viewport === 'mobile' ? 0.74 : 0.48) + 7) * scale));
  const height = ((titleLines * (viewport === 'mobile' ? 3.05 : 2.12)) + (city ? (viewport === 'mobile' ? 2.05 : 1.32) : 0)) * scale;
  const gap = LABEL_GAP_PERCENT[viewport];
  return { left: x - width / 2 - gap, right: x + width / 2 + gap, top: y - height / 2 - gap, bottom: y + height / 2 + gap };
};

const fits = (rect: LabelRect, occupied: readonly LabelRect[], viewport: ResultLabelViewport) => {
  if (rect.left < 2 || rect.right > 98 || rect.top < PROTECTED_TOP_PERCENT[viewport] || rect.bottom > 100 - PROTECTED_BOTTOM_PERCENT[viewport]) return false;
  return !occupied.some((other) => intersects(rect, other));
};

function placeEvent(
  item: ProjectedResultLabelEvent,
  index: number,
  tier: ResultLabelTier,
  viewport: ResultLabelViewport,
  occupied: readonly LabelRect[],
  styles: Record<ResultLabelTier, CSSProperties>,
  labelLimit: number,
): ResultLabelPlacement | null {
  for (const [dx, dy] of localOffsets) {
    if (Math.hypot(dx, dy) > MAX_LOCAL_OFFSET_PERCENT[viewport]) continue;
    const x = Math.min(98, Math.max(2, item.position.x + dx));
    const y = Math.min(100 - PROTECTED_BOTTOM_PERCENT[viewport], Math.max(PROTECTED_TOP_PERCENT[viewport], item.position.y + dy));
    const rect = estimateRect(item.event, x, y, tier, viewport);
    if (!fits(rect, occupied, viewport)) continue;
    return { kind: 'label', event: item.event, tier, slot: `projected-${item.event.id}`, x, y, anchorX: item.position.x, anchorY: item.position.y, zIndex: labelLimit - index, style: styles[tier], rect };
  }

  return null;
}

function clusterUnresolved(unresolved: readonly ProjectedResultLabelEvent[], viewport: ResultLabelViewport): ResultLabelClusterPlacement[] {
  const groups: ProjectedResultLabelEvent[][] = [];
  for (const item of unresolved) {
    const group = groups.find((candidate) => candidate.some((other) => Math.hypot(other.position.x - item.position.x, other.position.y - item.position.y) <= LOCAL_CLUSTER_DISTANCE_PERCENT[viewport]));
    if (group) group.push(item);
    else groups.push([item]);
  }

  return groups.map((group) => {
    const anchor = group.reduce((acc, item) => ({ x: acc.x + item.position.x / group.length, y: acc.y + item.position.y / group.length }), { x: 0, y: 0 });
    const x = Math.min(96, Math.max(4, anchor.x));
    const y = Math.min(100 - PROTECTED_BOTTOM_PERCENT[viewport], Math.max(PROTECTED_TOP_PERCENT[viewport], anchor.y));
    return { kind: 'cluster' as const, id: `result-label-cluster-${group.map(({ event }) => event.id).join('-')}`, events: group.map(({ event }) => event), label: `+${group.length} events`, x, y, anchorX: anchor.x, anchorY: anchor.y, zIndex: 1, rect: { left: x - 7, right: x + 7, top: y - 2.5, bottom: y + 2.5 } };
  });
}

export function resolveResultLabelPlacements(
  results: readonly ProjectedResultLabelEvent[],
  viewport: ResultLabelViewport,
): ResultLabelLayoutItem[] {
  const styles = viewport === 'mobile' ? MOBILE_TIER_STYLES : DESKTOP_TIER_STYLES;
  const labelLimit = viewport === 'mobile' ? MOBILE_LABEL_LIMIT : DESKTOP_LABEL_LIMIT;
  const projectedResults = results.filter(({ position }) => Number.isFinite(position.x) && Number.isFinite(position.y)).slice(0, labelLimit);
  const occupied: LabelRect[] = [];
  const labels: ResultLabelPlacement[] = [];
  let unresolved = projectedResults;

  for (const item of projectedResults) {
    const index = projectedResults.indexOf(item);
    const placed = placeEvent(item, index, getResultLabelTier(index), viewport, occupied, styles, labelLimit);
    if (!placed) continue;
    occupied.push(placed.rect);
    labels.push(placed);
    unresolved = unresolved.filter((candidate) => candidate.event.id !== item.event.id);
  }

  for (const tier of ['compact', 'micro'] satisfies ResultLabelTier[]) {
    for (const item of [...unresolved]) {
      const index = projectedResults.indexOf(item);
      const placed = placeEvent(item, index, tier, viewport, occupied, styles, labelLimit);
      if (!placed) continue;
      occupied.push(placed.rect);
      labels.push(placed);
      unresolved = unresolved.filter((candidate) => candidate.event.id !== item.event.id);
    }
  }

  return [...labels.sort((a, b) => b.zIndex - a.zIndex), ...clusterUnresolved(unresolved, viewport)];
}
