import type { AtlasConstellation } from './atlasConstellationTypes';

const CREATED_AT = '2026-06-12';
const UPDATED_AT = '2026-06-12';

export const ATLAS_CONSTELLATIONS: AtlasConstellation[] = [
  {
    id: 'county-fair-trail',
    title: 'County Fair Trail',
    description:
      'A starter discovery grouping for Michigan fairground celebrations with midway, youth, livestock, or regional fair energy already represented in the Atlas.',
    stateSlug: 'michigan',
    region: 'Michigan',
    theme: 'fairTrail',
    season: 'summer',
    category: 'Fairs',
    eventIds: ['armada-fair', 'goodells-fair', 'shiawassee-fair', 'upper-peninsula-state-fair'],
    relationshipType: 'category',
    visibilityMode: 'hiddenUntilDiscovered',
    lineStyle: 'faint',
    displayPriority: 20,
    confidenceScore: 0.72,
    sourceStatus: 'editorial',
    reviewStatus: 'reviewed',
    generatedBy: 'curated',
    sourceIds: [],
    starIntensityRules: [],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'great-lakes-fireworks',
    title: 'Great Lakes Fireworks',
    description:
      'An editorial discovery path for waterfront celebrations where fireworks or night-glow atmosphere can help future visitors compare lakeshore event moods.',
    stateSlug: 'michigan',
    region: 'Great Lakes shoreline',
    theme: 'fireworks',
    season: 'summer',
    category: 'Festivals',
    eventIds: ['west-michigan-coast-guard', 'cheboygan-4th-fireworks'],
    relationshipType: 'editorial',
    visibilityMode: 'hiddenUntilDiscovered',
    lineStyle: 'dotted',
    displayPriority: 30,
    confidenceScore: 0.66,
    sourceStatus: 'editorial',
    reviewStatus: 'suggested',
    generatedBy: 'curated',
    sourceIds: [],
    starIntensityRules: [],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
  {
    id: 'small-town-labor-day-traditions',
    title: 'Small-Town Labor Day Traditions',
    description:
      'A conservative review queue for late-summer and early-fall small-town celebrations that may support a future Labor Day-season discovery trail after additional verification.',
    stateSlug: 'michigan',
    region: 'Southeast Michigan',
    theme: 'laborDayTraditions',
    season: 'late summer',
    category: 'Festivals',
    eventIds: ['romeo-peach', 'armada-fair'],
    relationshipType: 'editorial',
    visibilityMode: 'hiddenUntilDiscovered',
    lineStyle: 'faint',
    displayPriority: 40,
    confidenceScore: 0.48,
    sourceStatus: 'unverified',
    reviewStatus: 'suggested',
    generatedBy: 'curated',
    sourceIds: [],
    starIntensityRules: [],
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
  },
];

export function getAtlasConstellationsForEvent(eventId: string): AtlasConstellation[] {
  return ATLAS_CONSTELLATIONS.filter((constellation) => constellation.eventIds.includes(eventId));
}

export function getAtlasConstellationsByState(stateSlug: string): AtlasConstellation[] {
  return ATLAS_CONSTELLATIONS.filter((constellation) => constellation.stateSlug === stateSlug);
}
