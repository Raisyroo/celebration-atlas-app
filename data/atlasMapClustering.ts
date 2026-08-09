import type { AtlasEvent } from './events.ts';

const MIN_SCALE = 1;
const MAX_SCALE = 2.5;
const CLUSTER_RADIUS_PX = 54;
const MIN_VIRTUAL_ZOOM = 6;
const MAX_VIRTUAL_ZOOM = 9.6;
const LEAF_SCALE_THRESHOLD = 2.38;
const SCALE_STEPS = 8;

export type AtlasGeographicMarkerGroup = {
  id: string;
  events: AtlasEvent[];
  latitude: number;
  longitude: number;
  clusterScale: number;
};

type ProjectedPoint = {
  event: AtlasEvent;
  sourceIndex: number;
  x: number;
  y: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function quantizeAtlasClusterScale(scale: number): number {
  const normalized = (
    clamp(scale, MIN_SCALE, MAX_SCALE) - MIN_SCALE
  ) / (MAX_SCALE - MIN_SCALE);
  const stepped = Math.round(normalized * SCALE_STEPS) / SCALE_STEPS;
  return MIN_SCALE + stepped * (MAX_SCALE - MIN_SCALE);
}

function projectToWorldPixels(
  latitude: number,
  longitude: number,
  worldSize: number,
): { x: number; y: number } | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const clampedLatitude = clamp(latitude, -85.05112878, 85.05112878);
  const latitudeRadians = clampedLatitude * Math.PI / 180;
  return {
    x: ((longitude + 180) / 360) * worldSize,
    y: (
      0.5
      - Math.log((1 + Math.sin(latitudeRadians)) / (1 - Math.sin(latitudeRadians)))
        / (4 * Math.PI)
    ) * worldSize,
  };
}

function stableHash(values: readonly string[]): string {
  let hash = 0x811c9dc5;
  for (const character of values.join('|')) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function uniqueEvents(events: readonly AtlasEvent[]): AtlasEvent[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    if (seen.has(event.id)) return false;
    seen.add(event.id);
    return true;
  });
}

function createLeafGroup(
  event: AtlasEvent,
  clusterScale: number,
): AtlasGeographicMarkerGroup {
  return {
    id: `atlas-event-${event.id}`,
    events: [event],
    latitude: event.latitude,
    longitude: event.longitude,
    clusterScale,
  };
}

/**
 * Groups only the supplied event set, so a cluster count always represents the
 * current ASK result set. Membership uses real latitude/longitude in Web
 * Mercator space; illustrated-map positioning remains a separate presentation
 * concern owned by the existing calibrated resolver.
 */
export function resolveAtlasGeographicMarkerGroups(args: {
  events: readonly AtlasEvent[];
  mapScale: number;
  clusterRadiusPx?: number;
}): AtlasGeographicMarkerGroup[] {
  const events = uniqueEvents(args.events);
  const clusterScale = quantizeAtlasClusterScale(args.mapScale);
  if (events.length <= 1 || clusterScale >= LEAF_SCALE_THRESHOLD) {
    return events.map((event) => createLeafGroup(event, clusterScale));
  }

  const scaleProgress = (clusterScale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
  const virtualZoom = MIN_VIRTUAL_ZOOM
    + scaleProgress * (MAX_VIRTUAL_ZOOM - MIN_VIRTUAL_ZOOM);
  const worldSize = 256 * 2 ** virtualZoom;
  const clusterRadius = Math.max(24, args.clusterRadiusPx ?? CLUSTER_RADIUS_PX);
  const finitePoints: ProjectedPoint[] = [];
  const invalidEvents: AtlasEvent[] = [];

  events.forEach((event, sourceIndex) => {
    const point = projectToWorldPixels(event.latitude, event.longitude, worldSize);
    if (!point) {
      invalidEvents.push(event);
      return;
    }
    finitePoints.push({ event, sourceIndex, ...point });
  });

  const parents = finitePoints.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) {
      const next = parents[index]!;
      parents[index] = root;
      index = next;
    }
    return root;
  };
  const union = (left: number, right: number) => {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot;
  };

  const buckets = new Map<string, number[]>();
  finitePoints.forEach((point, pointIndex) => {
    const cellX = Math.floor(point.x / clusterRadius);
    const cellY = Math.floor(point.y / clusterRadius);
    for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        const neighbors = buckets.get(`${cellX + offsetX}:${cellY + offsetY}`) ?? [];
        neighbors.forEach((neighborIndex) => {
          const neighbor = finitePoints[neighborIndex]!;
          if (Math.hypot(point.x - neighbor.x, point.y - neighbor.y) <= clusterRadius) {
            union(pointIndex, neighborIndex);
          }
        });
      }
    }
    const bucketKey = `${cellX}:${cellY}`;
    buckets.set(bucketKey, [...(buckets.get(bucketKey) ?? []), pointIndex]);
  });

  const components = new Map<number, ProjectedPoint[]>();
  finitePoints.forEach((point, index) => {
    const root = find(index);
    components.set(root, [...(components.get(root) ?? []), point]);
  });

  const groups = [...components.values()].map((points): AtlasGeographicMarkerGroup => {
    const orderedPoints = [...points].sort(
      (left, right) => left.sourceIndex - right.sourceIndex,
    );
    const componentEvents = orderedPoints.map((point) => point.event);
    const latitude = componentEvents.reduce((sum, event) => sum + event.latitude, 0)
      / componentEvents.length;
    const longitude = componentEvents.reduce((sum, event) => sum + event.longitude, 0)
      / componentEvents.length;
    const sortedIds = componentEvents.map((event) => event.id).sort();

    return {
      id: componentEvents.length === 1
        ? `atlas-event-${componentEvents[0]!.id}`
        : `atlas-cluster-${stableHash(sortedIds)}-${componentEvents.length}`,
      events: componentEvents,
      latitude,
      longitude,
      clusterScale,
    };
  });

  const sourceIndexById = new Map(events.map((event, index) => [event.id, index]));
  return [
    ...groups,
    ...invalidEvents.map((event) => createLeafGroup(event, clusterScale)),
  ].sort((left, right) => {
    const leftIndex = Math.min(...left.events.map((event) => sourceIndexById.get(event.id) ?? 0));
    const rightIndex = Math.min(...right.events.map((event) => sourceIndexById.get(event.id) ?? 0));
    return leftIndex - rightIndex;
  });
}
