// Atlas Constellation types define future constellation and trail
// relationships between celebrations in the Atlas.
//
// They do not render anything yet, and this file is intentionally not imported
// by the UI until a later constellation presentation layer is designed.
//
// These types are intentionally separate from marker projection, map
// calibration, and event coordinate data. Constellations describe interpretive
// relationships, not geographic source truth or marker placement.
//
// eventIds connect future constellations back to EventProfile / AtlasEvent
// records while keeping constellation data independent from event data.

export type AtlasConstellationTheme =
  | 'fairTrail'
  | 'fireworks'
  | 'harvest'
  | 'winterLights'
  | 'haunted'
  | 'music'
  | 'waterfront'
  | 'historicParades'
  | 'pageantTraditions'
  | 'laborDayTraditions'
  | 'balloonGlow'
  | 'foodFestival'
  | 'artFair'
  | 'fairgroundMemory'
  | 'custom';

export type AtlasConstellationVisibilityMode =
  | 'alwaysVisible'
  | 'searchOnly'
  | 'seasonal'
  | 'featured'
  | 'zoomReveal'
  | 'hiddenUntilDiscovered';

export type AtlasConstellationLineStyle =
  | 'faint'
  | 'glowing'
  | 'dotted'
  | 'seasonal'
  | 'archival'
  | 'route'
  | 'ceremonial';

export type AtlasConstellationRelationshipType =
  | 'category'
  | 'seasonal'
  | 'geographic'
  | 'historical'
  | 'practicalTravel'
  | 'cultural'
  | 'editorial'
  | 'aiSuggested';

export type AtlasConstellationReviewStatus =
  | 'suggested'
  | 'reviewed'
  | 'published'
  | 'retired';

export type AtlasConstellationSourceStatus =
  | 'unverified'
  | 'editorial'
  | 'sourceBacked'
  | 'official'
  | 'fieldVerified';

export interface AtlasConstellationStarRule {
  id: string;
  description: string;
  eventIds?: string[];
  intensity: 'dim' | 'standard' | 'bright' | 'active' | 'signature';
  drivers: Array<
    | 'coverageLevel'
    | 'featuredStatus'
    | 'hiddenGemStatus'
    | 'confidenceScore'
    | 'sourceStatus'
    | 'seasonRelevance'
    | 'dateProximity'
    | 'mediaRichness'
    | 'currentActivity'
    | 'userSavedStatus'
    | 'userAttendanceHistory'
    | 'aiRecommendationScore'
  >;
  minimumConfidenceScore?: number;
  appliesWhenSeasonal?: boolean;
}

export interface AtlasConstellation {
  id: string;
  title: string;
  description: string;
  stateSlug: string;
  region: string;
  theme: AtlasConstellationTheme;
  season: string;
  category: string;
  eventIds: string[];
  relationshipType: AtlasConstellationRelationshipType;
  visibilityMode: AtlasConstellationVisibilityMode;
  lineStyle: AtlasConstellationLineStyle;
  displayPriority: number;
  confidenceScore: number;
  sourceStatus: AtlasConstellationSourceStatus;
  reviewStatus: AtlasConstellationReviewStatus;
  generatedBy: string;
  reviewedBy?: string;
  sourceIds: string[];
  starIntensityRules: AtlasConstellationStarRule[];
  createdAt: string;
  updatedAt: string;
}
