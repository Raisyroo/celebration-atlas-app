// Future canonical AI-agent-ready event profile model. The existing AtlasEvent
// model remains the current UI compatibility model until migration occurs gradually.

export type EventCoverageLevel =
  | 'basicNationalCoverage'
  | 'stateDiscoveryCoverage'
  | 'practicalEventPage'
  | 'atlasExperiencePage'
  | 'livingCelebration';

export type EventSourceType =
  | 'officialWebsite'
  | 'officialSocial'
  | 'organizer'
  | 'municipal'
  | 'tourismBoard'
  | 'newsArticle'
  | 'archive'
  | 'fieldScout'
  | 'attendeeContribution'
  | 'partnerFeed'
  | 'generatedArtifact'
  | 'other';

export type ConfidenceLevel = 'unknown' | 'low' | 'medium' | 'high' | 'verified';

export type EventMediaSlot =
  | 'thumbnailImage'
  | 'heroImage'
  | 'introVideo'
  | 'atmosphereLoop'
  | 'posterArtwork'
  | 'galleryImage'
  | 'historicalImage'
  | 'artifactImage'
  | 'sourceDocument'
  | 'mapImage'
  | 'shortVideo'
  | 'threeDimensionalScene'
  | 'routeAnimation'
  | 'arObject'
  | 'audioMemory'
  | 'interviewClip';

export type EventSeason = 'spring' | 'summer' | 'fall' | 'winter' | 'yearRound';

export type EventIndoorOutdoor = 'indoor' | 'outdoor' | 'mixed' | 'unknown';

export type EventPriceType = 'free' | 'paid' | 'freeAndPaid' | 'unknown';

export type EventScheduleStatus =
  | 'currentPublished'
  | 'partialPublished'
  | 'notYetReleased'
  | 'estimatedFromPriorYear'
  | 'unknown';

export type EventSourceStatus =
  | 'unverified'
  | 'officialConfirmed'
  | 'sourceBacked'
  | 'communityReported'
  | 'estimated'
  | 'needsVerification';

export type EventImportanceLevel = 'minor' | 'standard' | 'major' | 'signature';

export type EventRecurrenceFrequency =
  | 'oneTime'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'annual'
  | 'seasonal'
  | 'varies';

export type EventMediaKind =
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'threeDimensional'
  | 'animation'
  | 'ar'
  | 'other';

export type EventCuriosityCategory =
  | 'origin'
  | 'tradition'
  | 'ritual'
  | 'artifact'
  | 'history'
  | 'legend'
  | 'localMemory'
  | 'timelineMoment'
  | 'hiddenDetail'
  | 'communityStory'
  | 'other';

export type EventPlanTipCategory =
  | 'arrival'
  | 'parking'
  | 'tickets'
  | 'accessibility'
  | 'weather'
  | 'family'
  | 'foodAndDrink'
  | 'rules'
  | 'whatToBring'
  | 'whatNotToBring'
  | 'alerts'
  | 'other';

export interface EventDateRange {
  startDate: string;
  endDate?: string;
  timezone?: string;
  displayText?: string;
  isEstimated?: boolean;
}

export interface EventRecurrencePattern {
  frequency: EventRecurrenceFrequency;
  description?: string;
  monthHint?: string;
  dayHint?: string;
}

export interface EventGeoPoint {
  latitude: number;
  longitude: number;
  precision?: 'exact' | 'approximate' | 'city' | 'county' | 'unknown';
}

export interface EventSource {
  id: string;
  type: EventSourceType;
  title: string;
  url?: string;
  publisher?: string;
  author?: string;
  accessedAt?: string;
  publishedAt?: string;
  lastVerifiedAt?: string;
  confidence: ConfidenceLevel;
  notes?: string;
}

export interface EventFieldProvenance {
  fieldPath: string;
  sourceIds: string[];
  confidence: ConfidenceLevel;
  confidenceScore?: number;
  lastVerifiedAt?: string;
  notes?: string;
}

export interface EventMediaItem {
  id: string;
  slot: EventMediaSlot;
  kind: EventMediaKind;
  src: string;
  alt?: string;
  title?: string;
  caption?: string;
  credit?: string;
  posterSrc?: string;
  sourceIds?: string[];
  capturedAt?: string;
  isPrimary?: boolean;
  confidence?: ConfidenceLevel;
}

export interface EventExperienceItem {
  id: string;
  title: string;
  shortDescription?: string;
  category: string;
  importance: EventImportanceLevel;
  scheduleItemIds?: string[];
  mapPointIds?: string[];
  mediaItemIds?: string[];
  sourceIds?: string[];
  tags?: string[];
}

export interface EventScheduleItem {
  id: string;
  title: string;
  startsAt?: string;
  endsAt?: string;
  dateText?: string;
  locationName?: string;
  experienceItemIds?: string[];
  mapPointIds?: string[];
  mediaItemIds?: string[];
  sourceIds?: string[];
  isHighlighted?: boolean;
  confidence?: ConfidenceLevel;
}

export interface EventMapPoint {
  id: string;
  title: string;
  pointType:
    | 'venue'
    | 'entrance'
    | 'parking'
    | 'restroom'
    | 'stage'
    | 'vendorArea'
    | 'rideArea'
    | 'seating'
    | 'route'
    | 'landmark'
    | 'other';
  coordinates?: EventGeoPoint;
  address?: string;
  description?: string;
  sourceIds?: string[];
  confidence?: ConfidenceLevel;
}

export interface EventCuriosityItem {
  id: string;
  title: string;
  summary: string;
  category: EventCuriosityCategory;
  body?: string;
  mediaItemIds?: string[];
  sourceIds?: string[];
  tags?: string[];
  confidence?: ConfidenceLevel;
}

export interface EventPlanTip {
  id: string;
  title: string;
  body: string;
  category: EventPlanTipCategory;
  importance?: EventImportanceLevel;
  sourceIds?: string[];
  lastVerifiedAt?: string;
}

export interface EventSocialLink {
  platform: string;
  url: string;
}

export interface EventPracticalAttendance {
  scheduleStatus?: EventScheduleStatus;
  ticketSummary?: string;
  parkingSummary?: string;
  entranceSummary?: string;
  accessibilitySummary?: string;
  restroomSummary?: string;
  weatherConsiderations?: string;
  bestArrivalTime?: string;
  familyTips?: string;
  foodAndDrinkSummary?: string;
  vendorSummary?: string;
  seatingSummary?: string;
  rulesSummary?: string;
  officialAlerts?: string[];
  planTips?: EventPlanTip[];
}

export interface EventTimingProfile {
  typicalMonth?: number;
  typicalMonthName?: string;
  typicalSeason?: EventSeason;
  dateStart?: string;
  dateEnd?: string;
  timezone?: string;
  recurrence?: EventRecurrencePattern;
  recurrenceText?: string;
  scheduleStatus?: EventScheduleStatus;
  timingConfidence?: ConfidenceLevel;
  timingSourceStatus?: EventSourceStatus;
  timingSourceIds?: string[];
  lastVerifiedAt?: string;
  notes?: string;
}

export interface EventTrustProfile {
  sourceStatus: EventSourceStatus;
  confidence: ConfidenceLevel;
  confidenceScore: number;
  lastVerifiedAt?: string;
  provenance?: EventFieldProvenance[];
}

export interface EventProfile {
  id: string;
  slug: string;
  name: string;
  alternateNames?: string[];
  historicalNames?: string[];
  localNickname?: string;
  slogan?: string;
  organizerName?: string;
  officialWebsite?: string;
  officialSocialLinks?: EventSocialLink[];
  shortDescription?: string;
  longDescription?: string;
  eventTypes: string[];
  categories: string[];
  tags: string[];
  communityIdentityTags?: string[];
  city: string;
  county?: string;
  region?: string;
  state: string;
  stateSlug: string;
  locationName?: string;
  address?: string;
  coordinates?: EventGeoPoint;
  dateRange: EventDateRange;
  recurrence?: EventRecurrencePattern;
  season?: EventSeason;
  familyFriendly?: boolean;
  indoorOutdoor?: EventIndoorOutdoor;
  priceType?: EventPriceType;
  featured?: boolean;
  hiddenGem?: boolean;
  anniversaryYear?: number;
  foundingYear?: number;
  coverageLevel: EventCoverageLevel;
  scheduleStatus?: EventScheduleStatus;
  timing?: EventTimingProfile;
  experiences?: EventExperienceItem[];
  schedule?: EventScheduleItem[];
  mapPoints?: EventMapPoint[];
  practicalAttendance?: EventPracticalAttendance;
  curiosityItems?: EventCuriosityItem[];
  media?: EventMediaItem[];
  sources: EventSource[];
  trust: EventTrustProfile;
  createdAt?: string;
  updatedAt?: string;
}
