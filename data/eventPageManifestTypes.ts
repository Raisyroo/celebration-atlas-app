import type { ConfidenceLevel, EventSource } from './eventProfileTypes';

export type EventPageRecipe =
  | 'simpleEvent'
  | 'multiDayFestival'
  | 'competitionFestival';

export type EventPageLifecycle = 'upcoming' | 'live' | 'completed' | 'cancelled';

export type EventPageModuleType =
  | 'whyGo'
  | 'schedule'
  | 'highlights'
  | 'traditions'
  | 'planVisit';

export type EventPageNavigationIcon =
  | 'sparkles'
  | 'schedule'
  | 'music'
  | 'artists'
  | 'crown'
  | 'plan';

export type EventPageActionType =
  | 'officialInfo'
  | 'registration'
  | 'tickets'
  | 'directions';

export type EventScheduleCategory =
  | 'registration'
  | 'fishing'
  | 'livestock'
  | 'exhibits'
  | 'grandstand'
  | 'midway'
  | 'family'
  | 'music'
  | 'community'
  | 'food'
  | 'awards';

export interface EventPagePrimaryAction {
  label: string;
  href: string;
  type: EventPageActionType;
  sourceId: string;
}

export interface EventPageNavigationItem {
  id: string;
  label: string;
  icon: EventPageNavigationIcon;
  targetModuleId: string;
}

export interface EventPageMetric {
  id: string;
  value: string;
  label: string;
  detail?: string;
  icon: 'trophy' | 'calendar' | 'fish' | 'music' | 'ticket';
  sourceIds: string[];
}

export interface EventPageAudienceGroup {
  id: string;
  title: string;
  tone: 'water' | 'sunset';
  items: string[];
  sourceIds: string[];
}

export type ScoutSpotlightPose = 'resting' | 'standing' | 'curious' | 'running';

export interface WhyGoModuleManifest {
  id: string;
  type: 'whyGo';
  title: string;
  eyebrow: string;
  headline: string;
  summary: string;
  metrics: EventPageMetric[];
  audienceGroups: EventPageAudienceGroup[];
  spotlight?: {
    title: string;
    body: string;
    scoutPose?: ScoutSpotlightPose;
    sourceIds: string[];
  };
}

export interface EventScheduleFilter {
  id: string;
  label: string;
  mode: 'all' | 'today' | 'tag' | 'dateRange';
  value?: string;
  startsOn?: string;
  endsOn?: string;
}

export interface EventScheduleItem {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  venue?: string;
  category: EventScheduleCategory;
  tags: string[];
  details?: string;
  sourceIds: string[];
  confidence: ConfidenceLevel;
}

export interface EventRecurringItem {
  id: string;
  title: string;
  typicalTiming?: string;
  venue?: string;
  details?: string;
  sourceIds: string[];
}

export interface EventRecurringCollection {
  title: string;
  summary: string;
  caveat: string;
  items: EventRecurringItem[];
}

export interface EventReferenceScheduleItem {
  id: string;
  title: string;
  timeText: string;
  venue?: string;
  details?: string;
  sourceIds: string[];
}

export interface EventReferenceScheduleGroup {
  id: string;
  label: string;
  title: string;
  items: EventReferenceScheduleItem[];
}

export interface EventReferenceSchedule {
  observedYear: number;
  title: string;
  summary: string;
  caveat: string;
  groups: EventReferenceScheduleGroup[];
}

export interface EventSchedulePresentationGroup {
  id: string;
  title: string;
  summary?: string;
  itemIds: string[];
  sourceIds: string[];
}

export interface ScheduleModuleManifest {
  id: string;
  type: 'schedule';
  title: string;
  eyebrow: string;
  subtitle: string;
  includedCategories?: EventScheduleCategory[];
  includedTags?: string[];
  filters: EventScheduleFilter[];
  presentationGroups?: EventSchedulePresentationGroup[];
  sourceIds?: string[];
  recurringEvents?: EventRecurringCollection;
  referenceSchedule?: EventReferenceSchedule;
  notes?: string[];
}

export type EventTraditionKind = 'pageantry' | 'parade' | 'heritage' | 'harvest' | 'community';

export interface EventTraditionItem {
  id: string;
  kind: EventTraditionKind;
  kicker: string;
  title: string;
  summary: string;
  latestObserved?: string;
  currentStatus?: string;
  sourceIds: string[];
}

export interface TraditionsModuleManifest {
  id: string;
  type: 'traditions';
  title: string;
  eyebrow: string;
  headline: string;
  summary: string;
  items: EventTraditionItem[];
}

export type EventHighlightKind =
  | 'artists'
  | 'contests'
  | 'liveArt'
  | 'entertainment'
  | 'marketplace'
  | 'heritage'
  | 'community';

export interface EventHighlightItem {
  id: string;
  kind: EventHighlightKind;
  kicker: string;
  title: string;
  summary: string;
  observedEdition?: string;
  sourceIds: string[];
}

export interface HighlightsModuleManifest {
  id: string;
  type: 'highlights';
  title: string;
  eyebrow: string;
  headline: string;
  summary: string;
  items: EventHighlightItem[];
  links?: PlanVisitLink[];
}

export interface PlanVisitDetail {
  id: string;
  label: string;
  value: string;
  icon: 'mapPin' | 'badge' | 'clock' | 'info';
  sourceIds: string[];
}

export interface PlanVisitLink {
  id: string;
  label: string;
  href: string;
  type: EventPageActionType;
  sourceId: string;
}

export interface PlanVisitModuleManifest {
  id: string;
  type: 'planVisit';
  title: string;
  eyebrow: string;
  subtitle: string;
  details: PlanVisitDetail[];
  links: PlanVisitLink[];
  advisory?: string;
}

export type EventPageModuleManifest =
  | WhyGoModuleManifest
  | ScheduleModuleManifest
  | HighlightsModuleManifest
  | TraditionsModuleManifest
  | PlanVisitModuleManifest;

export type ScoutCommand =
  | {
      type: 'openModule';
      moduleId: string;
    }
  | {
      type: 'filterSchedule';
      moduleId: string;
      filterId: string;
    }
  | {
      type: 'openExternal';
      href: string;
    };

export interface ScoutSuggestion {
  id: string;
  label: string;
  response: string;
  scopeModuleIds: string[];
  command: ScoutCommand;
  sourceIds: string[];
}

export interface EventPageManifest {
  schemaVersion: 1;
  id: string;
  eventId: string;
  slug: string;
  recipe: EventPageRecipe;
  lifecycle: EventPageLifecycle;
  identity: {
    name: string;
    shortName: string;
    edition?: string;
    location: string;
    venue?: string;
    dateText: string;
    startsOn: string;
    endsOn: string;
    timezone: string;
  };
  hero: {
    imageSrc: string;
    imageAlt: string;
    imagePosition?: string;
    eyebrow: string;
    tagline: string;
    credit?: string;
  };
  editionStatus?: {
    label: string;
    title: string;
    summary: string;
    sourceIds: string[];
  };
  primaryAction?: EventPagePrimaryAction;
  navigation: EventPageNavigationItem[];
  modules: EventPageModuleManifest[];
  scheduleItems: EventScheduleItem[];
  scoutSuggestions: ScoutSuggestion[];
  sources: EventSource[];
  publishedAt: string;
  reviewedAt: string;
}
