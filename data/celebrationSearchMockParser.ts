import { ATLAS_CONSTELLATIONS } from './atlasConstellations';
import type { AtlasConstellation } from './atlasConstellationTypes';
import { filterEventProfiles } from './eventDiscovery';
import { EVENT_PROFILES } from './eventProfiles';
import type { EventProfile, EventSourceStatus } from './eventProfileTypes';
import type {
  AtlasSearchCommand,
  AtlasSearchCommandInput,
  AtlasSearchConfidence,
  AtlasSearchResult,
  AtlasSearchSourceStatus,
  AtlasTimingIntent,
} from './celebrationSearchTypes';

const DATASET_LIMIT_WARNING = 'Current Atlas event data is partial and should not be treated as complete coverage.';
const NATIONAL_COVERAGE_WARNING = 'Current Atlas data is not nationally complete yet; results must not be presented as all U.S. events.';
const CURRENT_YEAR_TIMING_WARNING =
  'Current-year timing data is incomplete; this parser does not claim events are active or happening now.';
const NO_EXACT_DATES_WARNING = 'No current-year exact dates are inferred from typical months, blurbs, or annual recurrence.';
const MICHIGAN_STATE_SLUG = 'michigan';

const MONTHS: Array<{ name: string; aliases: string[]; month: number }> = [
  { name: 'january', aliases: ['january', 'jan'], month: 1 },
  { name: 'february', aliases: ['february', 'feb'], month: 2 },
  { name: 'march', aliases: ['march', 'mar'], month: 3 },
  { name: 'april', aliases: ['april', 'apr'], month: 4 },
  { name: 'may', aliases: ['may'], month: 5 },
  { name: 'june', aliases: ['june', 'jun'], month: 6 },
  { name: 'july', aliases: ['july', 'jul'], month: 7 },
  { name: 'august', aliases: ['august', 'aug'], month: 8 },
  { name: 'september', aliases: ['september', 'sept', 'sep'], month: 9 },
  { name: 'october', aliases: ['october', 'oct'], month: 10 },
  { name: 'november', aliases: ['november', 'nov'], month: 11 },
  { name: 'december', aliases: ['december', 'dec'], month: 12 },
];

const SEASONS = ['spring', 'summer', 'fall', 'autumn', 'winter'] as const;

type CategoryIntent = {
  category?: string;
  eventType?: string;
};

type TimingParse = {
  timingIntent: AtlasTimingIntent;
  month?: number;
  season?: EventProfile['season'];
  isTimingSensitive: boolean;
  warnings: string[];
};

type ConstellationMatch = {
  constellation: AtlasConstellation;
  confidence: AtlasSearchConfidence;
};

function normalize(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesPhrase(normalizedQuery: string, phrase: string): boolean {
  const normalizedPhrase = normalize(phrase);

  return normalizedPhrase.length > 0 && ` ${normalizedQuery} `.includes(` ${normalizedPhrase} `);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function addWarnings(...warningGroups: Array<string[] | undefined>): string[] {
  return uniqueStrings(warningGroups.flatMap((warnings) => warnings ?? []));
}

function toResult(command: AtlasSearchCommand, matchedConstellationIds: string[] = []): AtlasSearchResult {
  return {
    command,
    matchedEventIds: command.highlightedEventIds,
    matchedConstellationIds,
    visibleStateSlugs: command.stateSlug ? [command.stateSlug] : [],
    explanation: command.responseText,
    warnings: command.warnings ?? [],
  };
}

function mapEventSourceStatus(status: EventSourceStatus | undefined): AtlasSearchSourceStatus {
  switch (status) {
    case 'officialConfirmed':
      return 'official';
    case 'sourceBacked':
      return 'sourceBacked';
    case 'estimated':
      return 'estimated';
    case 'needsVerification':
      return 'needsVerification';
    case 'communityReported':
    case 'unverified':
    default:
      return 'unverified';
  }
}

function mapConstellationSourceStatus(status: AtlasConstellation['sourceStatus']): AtlasSearchSourceStatus {
  switch (status) {
    case 'official':
      return 'official';
    case 'sourceBacked':
    case 'fieldVerified':
      return 'sourceBacked';
    case 'editorial':
    case 'unverified':
    default:
      return 'unverified';
  }
}

function parseTimingIntent(normalizedQuery: string): TimingParse {
  if (includesPhrase(normalizedQuery, 'this weekend')) {
    return {
      timingIntent: 'thisWeekend',
      isTimingSensitive: true,
      warnings: [CURRENT_YEAR_TIMING_WARNING, NO_EXACT_DATES_WARNING],
    };
  }

  if (includesPhrase(normalizedQuery, 'happening now') || includesPhrase(normalizedQuery, 'active now')) {
    return {
      timingIntent: 'activeNow',
      isTimingSensitive: true,
      warnings: [CURRENT_YEAR_TIMING_WARNING, NO_EXACT_DATES_WARNING],
    };
  }

  if (includesPhrase(normalizedQuery, 'today')) {
    return {
      timingIntent: 'today',
      isTimingSensitive: true,
      warnings: [CURRENT_YEAR_TIMING_WARNING, NO_EXACT_DATES_WARNING],
    };
  }

  if (includesPhrase(normalizedQuery, 'tomorrow')) {
    return {
      timingIntent: 'tomorrow',
      isTimingSensitive: true,
      warnings: [CURRENT_YEAR_TIMING_WARNING, NO_EXACT_DATES_WARNING],
    };
  }

  if (
    includesPhrase(normalizedQuery, 'active') ||
    includesPhrase(normalizedQuery, 'current year') ||
    includesPhrase(normalizedQuery, 'live')
  ) {
    return {
      timingIntent: 'activeNow',
      isTimingSensitive: true,
      warnings: [CURRENT_YEAR_TIMING_WARNING, NO_EXACT_DATES_WARNING],
    };
  }

  for (const monthDefinition of MONTHS) {
    if (monthDefinition.aliases.some((alias) => includesPhrase(normalizedQuery, alias))) {
      return {
        timingIntent: 'month',
        month: monthDefinition.month,
        season: monthToSeason(monthDefinition.month),
        isTimingSensitive: false,
        warnings: [NO_EXACT_DATES_WARNING],
      };
    }
  }

  for (const season of SEASONS) {
    if (includesPhrase(normalizedQuery, season)) {
      return {
        timingIntent: 'seasonal',
        season: season === 'autumn' ? 'fall' : season,
        isTimingSensitive: false,
        warnings: [NO_EXACT_DATES_WARNING],
      };
    }
  }

  return {
    timingIntent: 'unknown',
    isTimingSensitive: false,
    warnings: [],
  };
}

function monthToSeason(month: number): EventProfile['season'] {
  if (month >= 3 && month <= 5) {
    return 'spring';
  }

  if (month >= 6 && month <= 8) {
    return 'summer';
  }

  if (month >= 9 && month <= 11) {
    return 'fall';
  }

  return 'winter';
}

function parseCategoryIntent(normalizedQuery: string): CategoryIntent {
  if (includesPhrase(normalizedQuery, 'county fair') || includesPhrase(normalizedQuery, 'county fairs')) {
    return { category: 'Fairs', eventType: 'countyFair' };
  }

  if (includesPhrase(normalizedQuery, 'fair') || includesPhrase(normalizedQuery, 'fairs')) {
    return { category: 'Fairs', eventType: 'fair' };
  }

  if (includesPhrase(normalizedQuery, 'music festival') || includesPhrase(normalizedQuery, 'music festivals')) {
    return { category: 'Music', eventType: 'musicFestival' };
  }

  if (includesPhrase(normalizedQuery, 'music') || includesPhrase(normalizedQuery, 'concert')) {
    return { category: 'Music', eventType: 'music' };
  }

  if (includesPhrase(normalizedQuery, 'firework') || includesPhrase(normalizedQuery, 'fireworks')) {
    return { category: 'Festivals', eventType: 'fireworks' };
  }

  if (includesPhrase(normalizedQuery, 'food festival') || includesPhrase(normalizedQuery, 'food festivals')) {
    return { category: 'Festivals', eventType: 'foodFestival' };
  }

  if (includesPhrase(normalizedQuery, 'food')) {
    return { category: 'Festivals', eventType: 'food' };
  }

  if (
    includesPhrase(normalizedQuery, 'arts culture') ||
    includesPhrase(normalizedQuery, 'arts and culture') ||
    includesPhrase(normalizedQuery, 'art fair') ||
    includesPhrase(normalizedQuery, 'art') ||
    includesPhrase(normalizedQuery, 'arts') ||
    includesPhrase(normalizedQuery, 'culture')
  ) {
    return { category: 'Arts & Culture', eventType: 'art' };
  }

  if (includesPhrase(normalizedQuery, 'festival') || includesPhrase(normalizedQuery, 'festivals')) {
    return { category: 'Festivals', eventType: 'festival' };
  }

  return {};
}

function isMichiganQuery(normalizedQuery: string, input: AtlasSearchCommandInput): boolean {
  return (
    input.currentStateSlug === MICHIGAN_STATE_SLUG ||
    includesPhrase(normalizedQuery, 'michigan') ||
    includesPhrase(normalizedQuery, 'mi')
  );
}

function isNationalQuery(normalizedQuery: string, input: AtlasSearchCommandInput): boolean {
  return (
    input.currentScope === 'national' ||
    includesPhrase(normalizedQuery, 'united states') ||
    includesPhrase(normalizedQuery, 'u s') ||
    includesPhrase(normalizedQuery, 'us') ||
    includesPhrase(normalizedQuery, 'usa') ||
    includesPhrase(normalizedQuery, 'national') ||
    includesPhrase(normalizedQuery, 'all')
  );
}

function getStrongEventMatch(normalizedQuery: string): EventProfile | undefined {
  const matches = EVENT_PROFILES.filter((profile) => {
    const names = [profile.name, ...(profile.alternateNames ?? []), profile.slug, profile.id];

    return names.some((name) => {
      const normalizedName = normalize(name);

      return normalizedName === normalizedQuery || (normalizedName.length >= 8 && includesPhrase(normalizedQuery, normalizedName));
    });
  });

  return matches.sort((a, b) => normalize(b.name).length - normalize(a.name).length)[0];
}

function getConstellationMatch(normalizedQuery: string): ConstellationMatch | undefined {
  const exactMatch = ATLAS_CONSTELLATIONS.find(
    (constellation) => normalize(constellation.title) === normalizedQuery || normalize(constellation.id) === normalizedQuery
  );

  if (exactMatch) {
    return { constellation: exactMatch, confidence: 'high' };
  }

  const strongMatch = ATLAS_CONSTELLATIONS.find((constellation) => {
    const title = normalize(constellation.title);
    const id = normalize(constellation.id);
    const theme = normalize(constellation.theme);
    const titleWords = title.split(' ').filter(Boolean);
    const hasTrailLanguage = includesPhrase(normalizedQuery, 'trail') || includesPhrase(normalizedQuery, 'constellation');
    const titleIncluded = title.length >= 8 && includesPhrase(normalizedQuery, title);
    const idIncluded = id.length >= 8 && includesPhrase(normalizedQuery, id);
    const allTitleWordsIncluded = titleWords.length >= 2 && titleWords.every((word) => includesPhrase(normalizedQuery, word));
    const strongThemeIncluded = theme.length >= 8 && includesPhrase(normalizedQuery, theme) && hasTrailLanguage;

    return titleIncluded || idIncluded || (allTitleWordsIncluded && hasTrailLanguage) || strongThemeIncluded;
  });

  return strongMatch ? { constellation: strongMatch, confidence: 'medium' } : undefined;
}

function profileMatchesCategory(profile: EventProfile, categoryIntent: CategoryIntent): boolean {
  const category = normalize(categoryIntent.category ?? '');
  const eventType = normalize(categoryIntent.eventType ?? '');
  const values = [...profile.categories, ...profile.eventTypes, ...profile.tags].map(normalize);

  if (category && values.includes(category)) {
    return true;
  }

  if (!eventType) {
    return false;
  }

  if (eventType === 'countyfair') {
    return values.includes('fairs') || values.some((value) => value.includes('fair'));
  }

  if (eventType === 'musicfestival') {
    return values.includes('music');
  }

  if (eventType === 'foodfestival') {
    return values.includes('food') || values.includes('harvest');
  }

  return values.some((value) => value.includes(eventType));
}

function getMichiganMatches(categoryIntent: CategoryIntent, timing: TimingParse): EventProfile[] {
  let matches = filterEventProfiles({ state: 'Michigan' });

  if (categoryIntent.category || categoryIntent.eventType) {
    matches = matches.filter((profile) => profileMatchesCategory(profile, categoryIntent));
  }

  if (timing.timingIntent === 'month' || timing.timingIntent === 'seasonal') {
    matches = matches.filter((profile) => {
      if (timing.season && profile.season === timing.season) {
        return true;
      }

      return timing.month !== undefined && profile.timing?.typicalMonth === timing.month;
    });
  }

  return matches;
}

function createBaseCommand(input: AtlasSearchCommandInput, overrides: Partial<AtlasSearchCommand>): AtlasSearchCommand {
  return {
    queryText: input.queryText,
    scope: 'national',
    action: 'explain',
    timingIntent: 'unknown',
    highlightedEventIds: [],
    responseText: '',
    confidence: 'low',
    sourceStatus: 'unverified',
    needsClarification: false,
    ...overrides,
  };
}

function createNoResultsResult(
  input: AtlasSearchCommandInput,
  scope: AtlasSearchCommand['scope'],
  categoryIntent: CategoryIntent,
  timing: TimingParse,
  stateSlug?: string
): AtlasSearchResult {
  const warnings = addWarnings(timing.warnings, [DATASET_LIMIT_WARNING]);
  const command = createBaseCommand(input, {
    scope,
    action: 'noResults',
    stateSlug,
    category: categoryIntent.category,
    eventType: categoryIntent.eventType,
    timingIntent: timing.timingIntent,
    month: timing.month,
    highlightedEventIds: [],
    responseText: stateSlug
      ? 'No known Atlas results were found for that Michigan query in the current dataset.'
      : 'No known Atlas results were found for that query in the current dataset.',
    confidence: 'low',
    sourceStatus: 'needsVerification',
    warnings,
  });

  return toResult(command);
}

export function parseCelebrationSearchMock(input: AtlasSearchCommandInput): AtlasSearchResult {
  const normalizedQuery = normalize(input.queryText);

  if (!normalizedQuery) {
    const command = createBaseCommand(input, {
      scope: input.currentStateSlug === MICHIGAN_STATE_SLUG ? 'state' : 'national',
      action: 'askClarifyingQuestion',
      stateSlug: input.currentStateSlug,
      needsClarification: true,
      clarificationQuestion: 'What state, region, category, or timeframe should the Atlas search first?',
      responseText: 'Tell me a state, region, category, event name, or timeframe to search the current Atlas data.',
      warnings: [DATASET_LIMIT_WARNING],
    });

    return toResult(command);
  }

  const timing = parseTimingIntent(normalizedQuery);
  const categoryIntent = parseCategoryIntent(normalizedQuery);
  const constellationMatch = getConstellationMatch(normalizedQuery);

  if (constellationMatch) {
    const { constellation, confidence } = constellationMatch;
    const sourceStatus = mapConstellationSourceStatus(constellation.sourceStatus);
    const warnings = addWarnings(
      timing.warnings,
      sourceStatus === 'official'
        ? []
        : [
            `The ${constellation.title} constellation source status is ${constellation.sourceStatus} and review status is ${constellation.reviewStatus}.`,
            DATASET_LIMIT_WARNING,
          ]
    );
    const command = createBaseCommand(input, {
      scope: 'constellation',
      action: 'showConstellation',
      stateSlug: constellation.stateSlug,
      constellationId: constellation.id,
      category: constellation.category,
      timingIntent: timing.timingIntent,
      month: timing.month,
      highlightedEventIds: constellation.eventIds,
      responseText: `Found the existing Atlas constellation “${constellation.title}.”`,
      confidence,
      sourceStatus,
      warnings,
    });

    return toResult(command, [constellation.id]);
  }

  const eventMatch = getStrongEventMatch(normalizedQuery);

  if (eventMatch) {
    const warnings = addWarnings(timing.warnings, [DATASET_LIMIT_WARNING]);
    const command = createBaseCommand(input, {
      scope: 'event',
      action: 'openEvent',
      stateSlug: eventMatch.stateSlug,
      eventId: eventMatch.id,
      category: eventMatch.categories[0],
      eventType: eventMatch.eventTypes[0],
      timingIntent: timing.timingIntent,
      month: timing.month,
      highlightedEventIds: [eventMatch.id],
      responseText: `Found a strong Atlas event match for ${eventMatch.name}.`,
      confidence: 'high',
      sourceStatus: mapEventSourceStatus(eventMatch.trust.sourceStatus),
      warnings,
    });

    return toResult(command);
  }

  const hasCategoryIntent = Boolean(categoryIntent.category || categoryIntent.eventType);
  const hasMichiganScope = isMichiganQuery(normalizedQuery, input);
  const hasNationalScope = isNationalQuery(normalizedQuery, input);

  if (timing.isTimingSensitive && !hasMichiganScope && !hasNationalScope && !hasCategoryIntent) {
    const command = createBaseCommand(input, {
      scope: input.currentStateSlug === MICHIGAN_STATE_SLUG ? 'state' : 'national',
      action: 'askClarifyingQuestion',
      stateSlug: input.currentStateSlug,
      timingIntent: timing.timingIntent,
      highlightedEventIds: [],
      responseText: 'That timing-sensitive search needs a safer scope before the Atlas can respond.',
      confidence: 'low',
      sourceStatus: 'needsVerification',
      needsClarification: true,
      clarificationQuestion: 'Which state, region, category, or timeframe should I use for this timing-sensitive search?',
      warnings: addWarnings(timing.warnings, [DATASET_LIMIT_WARNING]),
    });

    return toResult(command);
  }

  if (hasMichiganScope) {
    const matches = timing.isTimingSensitive ? [] : getMichiganMatches(categoryIntent, timing);

    if (!timing.isTimingSensitive && (hasCategoryIntent || timing.timingIntent !== 'unknown') && matches.length === 0) {
      return createNoResultsResult(input, 'state', categoryIntent, timing, MICHIGAN_STATE_SLUG);
    }

    const warnings = addWarnings(timing.warnings, [DATASET_LIMIT_WARNING]);
    const command = createBaseCommand(input, {
      scope: 'state',
      action: 'showEvents',
      stateSlug: MICHIGAN_STATE_SLUG,
      category: categoryIntent.category,
      eventType: categoryIntent.eventType,
      timingIntent: timing.timingIntent,
      month: timing.month,
      highlightedEventIds: matches.map((profile) => profile.id),
      responseText: timing.isTimingSensitive
        ? 'I can focus on Michigan, but active/current timing needs verified current-year schedule data before highlighting events.'
        : 'Showing known Michigan Atlas results that match this safe mock search intent.',
      confidence: hasCategoryIntent || timing.timingIntent !== 'unknown' ? 'medium' : 'low',
      sourceStatus: timing.isTimingSensitive ? 'needsVerification' : 'unverified',
      warnings,
    });

    return toResult(command);
  }

  if (hasNationalScope || hasCategoryIntent) {
    const command = createBaseCommand(input, {
      scope: 'national',
      action: 'showEvents',
      category: categoryIntent.category,
      eventType: categoryIntent.eventType,
      timingIntent: timing.timingIntent,
      month: timing.month,
      highlightedEventIds: [],
      responseText: hasCategoryIntent
        ? 'I can prepare a broad national category search command, but the current Atlas is not nationally complete.'
        : 'I can prepare a broad national search command, but the current Atlas is not nationally complete.',
      confidence: hasCategoryIntent ? 'medium' : 'low',
      sourceStatus: 'needsVerification',
      warnings: addWarnings(timing.warnings, [NATIONAL_COVERAGE_WARNING]),
    });

    return toResult(command);
  }

  const command = createBaseCommand(input, {
    scope: input.currentStateSlug === MICHIGAN_STATE_SLUG ? 'state' : 'national',
    action: 'askClarifyingQuestion',
    stateSlug: input.currentStateSlug,
    timingIntent: timing.timingIntent,
    responseText: 'I need a little more detail before turning that into a safe Atlas search command.',
    confidence: 'low',
    sourceStatus: 'needsVerification',
    needsClarification: true,
    clarificationQuestion: 'Should I search by state, region, timeframe, event category, or a known event name?',
    warnings: addWarnings(timing.warnings, [DATASET_LIMIT_WARNING]),
  });

  return toResult(command);
}

export function getCelebrationSearchMockExamples(): AtlasSearchResult[] {
  return [
    parseCelebrationSearchMock({ queryText: 'Show me all music festivals in the US' }),
    parseCelebrationSearchMock({ queryText: 'What festivals are active in Michigan?' }),
    parseCelebrationSearchMock({ queryText: 'Show me county fairs in Michigan' }),
    parseCelebrationSearchMock({ queryText: 'Find Michigan fireworks in summer' }),
    parseCelebrationSearchMock({ queryText: 'Romeo Peach Festival' }),
    parseCelebrationSearchMock({ queryText: 'County Fair Trail' }),
    parseCelebrationSearchMock({ queryText: 'Find hidden small-town festivals in September' }),
  ];
}
