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
const MOBILE_LABEL_LIMIT = 20;
const MAX_LOCAL_OFFSET_PERCENT = { desktop: 9.4, mobile: 10.2 } as const;
const PROTECTED_TOP_PERCENT = { desktop: 12, mobile: 16 } as const;
const PROTECTED_BOTTOM_PERCENT = { desktop: 18, mobile: 26 } as const;
const LABEL_GAP_PERCENT = { desktop: 1.2, mobile: 2.35 } as const;
const LOCAL_CLUSTER_DISTANCE_PERCENT = { desktop: 12, mobile: 14 } as const;

const DESKTOP_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { fontSize: 'clamp(25px, 2.02vw, 30px)', fontWeight: 500, color: 'rgba(255, 249, 228, 0.98)', opacity: 1, textShadow: '0 0 6px rgba(255, 232, 174, 0.28), 0 0 16px rgba(218, 151, 58, 0.16), 0 2px 6px rgba(0, 0, 0, 0.76)' },
  strong: { fontSize: 'clamp(20px, 1.58vw, 24px)', fontWeight: 500, color: 'rgba(248, 219, 160, 0.93)', opacity: 0.92, textShadow: '0 0 5px rgba(246, 203, 126, 0.2), 0 0 12px rgba(206, 132, 42, 0.11), 0 2px 5px rgba(0, 0, 0, 0.74)' },
  supporting: { fontSize: 'clamp(16px, 1.18vw, 19px)', fontWeight: 400, color: 'rgba(233, 198, 135, 0.84)', opacity: 0.78, textShadow: '0 0 4px rgba(227, 180, 104, 0.14), 0 1px 4px rgba(0, 0, 0, 0.72)' },
  ambient: { fontSize: 'clamp(12px, .98vw, 15px)', fontWeight: 400, color: 'rgba(208, 157, 88, 0.68)', opacity: 0.58, textShadow: '0 0 3px rgba(219, 169, 91, 0.1), 0 1px 4px rgba(0, 0, 0, 0.7)' },
  compact: { fontSize: 'clamp(11px, .84vw, 13px)', fontWeight: 400, color: 'rgba(206, 158, 92, 0.64)', opacity: 0.56, textShadow: '0 1px 4px rgba(0, 0, 0, 0.68)' },
  micro: { fontSize: 'clamp(10px, .74vw, 12px)', fontWeight: 400, color: 'rgba(204, 154, 88, 0.58)', opacity: 0.52, textShadow: '0 1px 3px rgba(0, 0, 0, 0.66)' },
};

const MOBILE_TIER_STYLES: Record<ResultLabelTier, CSSProperties> = {
  hero: { ...DESKTOP_TIER_STYLES.hero, fontSize: 'clamp(19px, 5.15vw, 22px)', opacity: 0.96 },
  strong: { ...DESKTOP_TIER_STYLES.strong, fontSize: 'clamp(16px, 4.35vw, 19px)', opacity: 0.86 },
  supporting: { ...DESKTOP_TIER_STYLES.supporting, fontSize: 'clamp(13px, 3.5vw, 16px)', opacity: 0.72 },
  ambient: { ...DESKTOP_TIER_STYLES.ambient, fontSize: 'clamp(10.5px, 2.9vw, 13px)', opacity: 0.58 },
  compact: { ...DESKTOP_TIER_STYLES.compact, fontSize: 'clamp(9.5px, 2.55vw, 11.5px)', opacity: 0.54 },
  micro: { ...DESKTOP_TIER_STYLES.micro, fontSize: 'clamp(8.5px, 2.3vw, 10.5px)', opacity: 0.5 },
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
  const rings = [2.2, 3.8, 5.6, 7.4, 9.2, 10.6, 12.4, 14];
  const directions = [[0, -1], [0, 1], [-1, 0], [1, 0], [-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72], [-1, -0.38], [1, -0.38], [-1, 0.38], [1, 0.38], [-0.38, -1], [0.38, -1], [-0.38, 1], [0.38, 1]] as const;
  for (const radius of rings) {
    for (const [x, y] of directions) offsets.push([Number((x * radius).toFixed(2)), Number((y * radius).toFixed(2))]);
  }
  return offsets;
})();

const wrappedTitleLineCount = (title: string, tier: ResultLabelTier, viewport: ResultLabelViewport) => {
  const scale = tier === 'hero' ? 1.16 : tier === 'strong' ? 1.05 : tier === 'supporting' ? 0.94 : tier === 'ambient' ? 0.82 : tier === 'compact' ? 0.7 : 0.62;
  const charsPerLine = Math.floor((viewport === 'mobile' ? 21 : 23) / scale);
  const words = title.split(/\s+/).filter(Boolean);
  let lines = 1;
  let lineLength = 0;

  for (const word of words) {
    const nextLength = lineLength === 0 ? word.length : lineLength + 1 + word.length;
    if (nextLength > charsPerLine && lines < 3) {
      lines += 1;
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
  const scale = tier === 'hero' ? 1.16 : tier === 'strong' ? 1.05 : tier === 'supporting' ? 0.94 : tier === 'ambient' ? 0.82 : tier === 'compact' ? 0.7 : 0.62;
  const titleLines = wrappedTitleLineCount(event.name, tier, viewport);
  const lineChars = Math.ceil(chars / titleLines);
  const width = Math.min(viewport === 'mobile' ? 44 : 28, Math.max(viewport === 'mobile' ? 13 : 9, (lineChars * (viewport === 'mobile' ? 0.56 : 0.48) + 8) * scale));
  const height = ((titleLines * (viewport === 'mobile' ? 2.35 : 2.12)) + (city ? (viewport === 'mobile' ? 1.3 : 1.32) : 0)) * scale;
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

const estimateClusterRect = (x: number, y: number, viewport: ResultLabelViewport): LabelRect => {
  const gap = viewport === 'mobile' ? 0.9 : 0.7;
  return { left: x - 9.5 - gap, right: x + 9.5 + gap, top: y - 2.5 - gap, bottom: y + 2.5 + gap };
};

function clusterUnresolved(unresolved: readonly ProjectedResultLabelEvent[], viewport: ResultLabelViewport, occupied: LabelRect[]): ResultLabelClusterPlacement[] {
  const groups: ProjectedResultLabelEvent[][] = [];
  for (const item of unresolved) {
    const group = groups.find((candidate) => candidate.some((other) => Math.hypot(other.position.x - item.position.x, other.position.y - item.position.y) <= LOCAL_CLUSTER_DISTANCE_PERCENT[viewport]));
    if (group) group.push(item);
    else groups.push([item]);
  }

  const clusters: ResultLabelClusterPlacement[] = [];
  for (const group of groups) {
    const anchor = group.reduce((acc, item) => ({ x: acc.x + item.position.x / group.length, y: acc.y + item.position.y / group.length }), { x: 0, y: 0 });
    let placed: ResultLabelClusterPlacement | null = null;

    for (const [dx, dy] of localOffsets) {
      if (Math.hypot(dx, dy) > LOCAL_CLUSTER_DISTANCE_PERCENT[viewport]) continue;
      const x = Math.min(96, Math.max(4, anchor.x + dx));
      const y = Math.min(100 - PROTECTED_BOTTOM_PERCENT[viewport], Math.max(PROTECTED_TOP_PERCENT[viewport], anchor.y + dy));
      const rect = estimateClusterRect(x, y, viewport);
      if (!fits(rect, occupied, viewport)) continue;
      placed = { kind: 'cluster', id: `result-label-cluster-${group.map(({ event }) => event.id).join('-')}`, events: group.map(({ event }) => event), label: `+${group.length} events`, x, y, anchorX: anchor.x, anchorY: anchor.y, zIndex: 1, rect };
      break;
    }

    if (placed) {
      occupied.push(placed.rect);
      clusters.push(placed);
    }
  }

  return clusters;
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

  return [...labels.sort((a, b) => b.zIndex - a.zIndex), ...clusterUnresolved(unresolved, viewport, occupied)];
}
