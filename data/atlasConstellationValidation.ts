import { ATLAS_EVENTS } from './events';
import type { AtlasConstellation } from './atlasConstellationTypes';

const ATLAS_EVENT_IDS = new Set(ATLAS_EVENTS.map((event) => event.id));

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function hasMissingArray(value: unknown): boolean {
  return !Array.isArray(value) || value.length === 0;
}

function hasUsableStringItem(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => !isBlank(item));
}

function isMissingNumber(value: unknown): boolean {
  return typeof value !== 'number' || Number.isNaN(value);
}

function getConstellationLabel(constellation: AtlasConstellation): string {
  if (!isBlank(constellation.id)) {
    return constellation.id;
  }

  if (!isBlank(constellation.title)) {
    return constellation.title;
  }

  return 'unknown constellation';
}

function incrementCount(counts: Record<string, number>, key: string): void {
  counts[key] = (counts[key] ?? 0) + 1;
}

export function getMissingConstellationEventIds(constellation: AtlasConstellation): string[] {
  if (!Array.isArray(constellation.eventIds)) {
    return [];
  }

  return constellation.eventIds.filter((eventId) => !ATLAS_EVENT_IDS.has(eventId));
}

export function validateAtlasConstellation(constellation: AtlasConstellation): string[] {
  const warnings: string[] = [];

  if (isBlank(constellation.id)) {
    warnings.push('Missing id.');
  }

  if (isBlank(constellation.title)) {
    warnings.push('Missing title.');
  }

  if (isBlank(constellation.description)) {
    warnings.push('Missing description.');
  }

  if (isBlank(constellation.stateSlug)) {
    warnings.push('Missing stateSlug.');
  }

  if (hasMissingArray(constellation.eventIds)) {
    warnings.push('Missing eventIds.');
  }

  if (!Array.isArray(constellation.eventIds) || constellation.eventIds.length < 2) {
    warnings.push('Constellation should reference at least 2 eventIds.');
  }

  for (const missingEventId of getMissingConstellationEventIds(constellation)) {
    warnings.push(`Referenced eventId does not exist in ATLAS_EVENTS: ${missingEventId}.`);
  }

  if (Array.isArray(constellation.eventIds)) {
    const seenEventIds = new Set<string>();
    const duplicateEventIds = new Set<string>();

    for (const eventId of constellation.eventIds) {
      if (seenEventIds.has(eventId)) {
        duplicateEventIds.add(eventId);
      }

      seenEventIds.add(eventId);
    }

    for (const duplicateEventId of duplicateEventIds) {
      warnings.push(`Duplicate eventId: ${duplicateEventId}.`);
    }
  }

  if (isBlank(constellation.relationshipType)) {
    warnings.push('Missing relationshipType.');
  }

  if (isBlank(constellation.visibilityMode)) {
    warnings.push('Missing visibilityMode.');
  }

  if (isBlank(constellation.lineStyle)) {
    warnings.push('Missing lineStyle.');
  }

  if (isBlank(constellation.sourceStatus)) {
    warnings.push('Missing sourceStatus.');
  }

  if (isBlank(constellation.reviewStatus)) {
    warnings.push('Missing reviewStatus.');
  }

  if (isMissingNumber(constellation.confidenceScore)) {
    warnings.push('Missing confidenceScore.');
  } else if (constellation.confidenceScore < 0 || constellation.confidenceScore > 1) {
    warnings.push('confidenceScore must be between 0 and 1.');
  }

  if (
    (constellation.sourceStatus === 'official' || constellation.sourceStatus === 'fieldVerified') &&
    !hasUsableStringItem(constellation.sourceIds)
  ) {
    warnings.push('sourceStatus official or fieldVerified requires sourceIds.');
  }

  if (constellation.reviewStatus === 'published' && constellation.sourceStatus === 'unverified') {
    warnings.push('reviewStatus published should not use sourceStatus unverified.');
  }

  if (isBlank(constellation.generatedBy)) {
    warnings.push('Missing generatedBy.');
  }

  if (isMissingNumber(constellation.displayPriority)) {
    warnings.push('Missing displayPriority.');
  }

  if (isBlank(constellation.createdAt)) {
    warnings.push('Missing createdAt.');
  }

  if (isBlank(constellation.updatedAt)) {
    warnings.push('Missing updatedAt.');
  }

  return warnings;
}

export function validateAtlasConstellations(constellations: AtlasConstellation[]): string[] {
  return constellations.flatMap((constellation) =>
    validateAtlasConstellation(constellation).map(
      (warning) => `${getConstellationLabel(constellation)}: ${warning}`,
    ),
  );
}

export function getConstellationCoverageSummary(constellations: AtlasConstellation[]): {
  totalConstellations: number;
  totalUniqueEvents: number;
  byState: Record<string, number>;
  byRelationshipType: Record<string, number>;
  byReviewStatus: Record<string, number>;
  bySourceStatus: Record<string, number>;
} {
  const uniqueEventIds = new Set<string>();
  const byState: Record<string, number> = {};
  const byRelationshipType: Record<string, number> = {};
  const byReviewStatus: Record<string, number> = {};
  const bySourceStatus: Record<string, number> = {};

  for (const constellation of constellations) {
    for (const eventId of constellation.eventIds) {
      uniqueEventIds.add(eventId);
    }

    incrementCount(byState, constellation.stateSlug);
    incrementCount(byRelationshipType, constellation.relationshipType);
    incrementCount(byReviewStatus, constellation.reviewStatus);
    incrementCount(bySourceStatus, constellation.sourceStatus);
  }

  return {
    totalConstellations: constellations.length,
    totalUniqueEvents: uniqueEventIds.size,
    byState,
    byRelationshipType,
    byReviewStatus,
    bySourceStatus,
  };
}
