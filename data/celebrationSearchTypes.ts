// Celebration Search command model only.
//
// This file defines the safe TypeScript shape that future Celebration Search
// parsers can emit when turning a user's conversational query into an Atlas
// map/action command.
//
// It does not call AI yet.
// It does not parse natural language yet.
// It does not change UI yet.
// It is intentionally not wired into routing, maps, markers, constellations,
// event data, or runtime behavior.
//
// Future AI or rule-based parsers should output this structure. The app should
// execute only safe structured commands from this model, not raw AI text.

export type AtlasSearchScope = 'national' | 'state' | 'region' | 'event' | 'constellation';

export type AtlasSearchAction =
  | 'showEvents'
  | 'zoomToState'
  | 'zoomToRegion'
  | 'openEvent'
  | 'showConstellation'
  | 'compareEvents'
  | 'explain'
  | 'askClarifyingQuestion'
  | 'noResults';

export type AtlasTimingIntent =
  | 'activeNow'
  | 'thisWeekend'
  | 'today'
  | 'tomorrow'
  | 'seasonal'
  | 'month'
  | 'dateRange'
  | 'yearRound'
  | 'unknown';

export type AtlasSearchConfidence = 'low' | 'medium' | 'high';

export type AtlasSearchSourceStatus =
  | 'unverified'
  | 'sourceBacked'
  | 'official'
  | 'estimated'
  | 'needsVerification';

export interface AtlasSearchCommand {
  queryText: string;
  scope: AtlasSearchScope;
  action: AtlasSearchAction;
  stateSlug?: string;
  regionSlug?: string;
  eventId?: string;
  constellationId?: string;
  category?: string;
  eventType?: string;
  timingIntent?: AtlasTimingIntent;
  month?: number;
  dateStart?: string;
  dateEnd?: string;
  highlightedEventIds: string[];
  responseText: string;
  confidence: AtlasSearchConfidence;
  sourceStatus: AtlasSearchSourceStatus;
  needsClarification: boolean;
  clarificationQuestion?: string;
  warnings?: string[];
}

export interface AtlasSearchResult {
  command: AtlasSearchCommand;
  matchedEventIds: string[];
  matchedConstellationIds: string[];
  visibleStateSlugs: string[];
  explanation: string;
  warnings: string[];
}

export interface AtlasSearchCommandInput {
  queryText: string;
  currentScope?: AtlasSearchScope;
  currentStateSlug?: string;
  currentRegionSlug?: string;
}
