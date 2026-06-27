import { ATLAS_EVENTS } from './events';
import { EVENT_PROFILES, getEventProfileSearchText } from './eventProfiles';
import { projectLatLngToCalibratedMichiganArtworkPosition } from './michiganArtworkCalibration';
import { resolveExactMichiganMobileUpperPeninsulaAnchorPosition } from './michiganMobileUpperPeninsulaAnchors';
import type { AtlasEvent } from './events';
import type { MichiganArtworkVariant } from './michiganArtworkCalibration';

export type AuditMarkerPosition = { x: number; y: number };
export type AuditEventRecord = {
  event: AtlasEvent;
  eventIndex: number;
  position: AuditMarkerPosition;
  duplicateId: boolean;
  renderedCount: number;
  overlapGroupId?: string;
};

const MARKER_EDGE_INSET_PERCENT = 6;
const EXACT_OVERLAP_EPSILON_PERCENT = 0.001;

const clampMarkerPercent = (value: number, offset = 0) => {
  const lowerBound = MARKER_EDGE_INSET_PERCENT + offset;
  const upperBound = 100 - MARKER_EDGE_INSET_PERCENT - offset;
  return Math.min(upperBound, Math.max(lowerBound, value));
};

export function projectAuditEventToMichiganArtworkPosition(
  event: AtlasEvent,
  artworkVariant: MichiganArtworkVariant,
): AuditMarkerPosition {
  const artworkPosition = projectLatLngToCalibratedMichiganArtworkPosition(
    event.latitude,
    event.longitude,
    artworkVariant,
  );

  const baselinePosition = {
    x: clampMarkerPercent(artworkPosition.x),
    y: clampMarkerPercent(artworkPosition.y),
  };

  if (artworkVariant !== 'mobile') return baselinePosition;

  const upperPeninsulaAnchorPosition =
    resolveExactMichiganMobileUpperPeninsulaAnchorPosition(
      event.latitude,
      event.longitude,
    );

  if (!upperPeninsulaAnchorPosition) return baselinePosition;

  return {
    x: clampMarkerPercent(upperPeninsulaAnchorPosition.x),
    y: clampMarkerPercent(upperPeninsulaAnchorPosition.y),
  };
}

const getPositionKey = (position: AuditMarkerPosition) =>
  `${position.x.toFixed(3)}:${position.y.toFixed(3)}`;

const isExactOverlap = (a: AuditMarkerPosition, b: AuditMarkerPosition) =>
  Math.abs(a.x - b.x) <= EXACT_OVERLAP_EPSILON_PERCENT &&
  Math.abs(a.y - b.y) <= EXACT_OVERLAP_EPSILON_PERCENT;

export function getMichiganMarkerAudit(artworkVariant: MichiganArtworkVariant) {
  const idCounts = new Map<string, number>();
  ATLAS_EVENTS.forEach((event) => {
    idCounts.set(event.id, (idCounts.get(event.id) ?? 0) + 1);
  });

  const baseRecords = ATLAS_EVENTS.map((event, eventIndex) => ({
    event,
    eventIndex,
    position: projectAuditEventToMichiganArtworkPosition(event, artworkVariant),
  }));

  const overlapGroups = new Map<string, typeof baseRecords>();
  baseRecords.forEach((record) => {
    const key = getPositionKey(record.position);
    const group = overlapGroups.get(key) ?? [];
    group.push(record);
    overlapGroups.set(key, group);
  });

  const records: AuditEventRecord[] = baseRecords.map((record) => {
    const overlapGroup = Array.from(overlapGroups.entries()).find(([, group]) =>
      group.some((candidate) =>
        isExactOverlap(candidate.position, record.position),
      ),
    );
    const isOverlapped = Boolean(overlapGroup && overlapGroup[1].length > 1);

    return {
      ...record,
      duplicateId: (idCounts.get(record.event.id) ?? 0) > 1,
      renderedCount: 1,
      overlapGroupId: isOverlapped ? overlapGroup?.[0] : undefined,
    };
  });

  const renderedIds = records.map((record) => record.event.id);
  const renderedCounts = new Map<string, number>();
  renderedIds.forEach((id) => {
    renderedCounts.set(id, (renderedCounts.get(id) ?? 0) + 1);
  });

  const sourceIds = ATLAS_EVENTS.map((event) => event.id);
  const duplicateEventIds = Array.from(idCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
  const missingEvents = ATLAS_EVENTS.filter(
    (event) => !records.some((record) => record.event === event),
  );
  const renderedMoreThanOnce = Array.from(renderedCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ id, count }));
  const exactOverlapGroups = Array.from(overlapGroups.entries())
    .filter(([, group]) => group.length > 1)
    .map(([id, group]) => ({ id, events: group.map((record) => record.event) }));

  const profileById = new Map(EVENT_PROFILES.map((profile) => [profile.id, profile]));
  const landingMatches = ATLAS_EVENTS.filter((event) => {
    const profile = profileById.get(event.id);
    const searchable = [
      event.id,
      event.name,
      event.location,
      ...(event.searchAliases ?? []),
      ...(event.atlasNotes ?? []),
      ...(event.atlasMemories ?? []),
      ...(event.localFlavor ?? []),
      profile ? getEventProfileSearchText(profile) : '',
    ]
      .join(' ')
      .toLowerCase();

    return searchable.includes('landing');
  });

  const detroitJazzMatches = ATLAS_EVENTS.filter(
    (event) => event.id === 'detroit-jazz' || event.name.toLowerCase().includes('detroit jazz festival'),
  );

  return {
    sourceEventCount: ATLAS_EVENTS.length,
    renderedMarkerCount: records.length,
    uniqueEventIdCount: new Set(sourceIds).size,
    duplicateEventIds,
    missingEvents,
    renderedMoreThanOnce,
    exactOverlapGroups,
    records,
    detroitJazzMatches,
    landingMatches,
  };
}
