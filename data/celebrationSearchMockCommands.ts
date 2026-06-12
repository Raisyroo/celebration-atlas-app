import type { AtlasSearchCommand } from './celebrationSearchTypes';

// Safe Celebration Search example commands for architecture/testing only.
//
// These examples are not wired into the UI and do not execute any map behavior.
// They show the conservative structured output that a future AI or rule-based
// parser could produce before the app decides whether a command is safe to run.

export const CELEBRATION_SEARCH_MOCK_COMMANDS: AtlasSearchCommand[] = [
  {
    queryText: 'Show me all music festivals in the US',
    scope: 'national',
    action: 'showEvents',
    category: 'Music',
    eventType: 'musicFestival',
    timingIntent: 'unknown',
    highlightedEventIds: [],
    responseText:
      'I can prepare a national music festival view once the Atlas has broader national event coverage.',
    confidence: 'low',
    sourceStatus: 'needsVerification',
    needsClarification: false,
    warnings: [
      'National event coverage is not complete yet.',
      'This mock command does not verify current-year festival schedules or active dates.',
    ],
  },
  {
    queryText: 'What festivals are active in Michigan?',
    scope: 'state',
    action: 'showEvents',
    stateSlug: 'michigan',
    category: 'Festivals',
    timingIntent: 'activeNow',
    highlightedEventIds: [],
    responseText:
      'I can focus on Michigan festivals, but active-now status needs verified current schedule data before highlighting events.',
    confidence: 'low',
    sourceStatus: 'needsVerification',
    needsClarification: false,
    warnings: [
      'Active-now results require current schedule verification.',
      'No exact active dates are inferred by this mock command.',
    ],
  },
  {
    queryText: 'Show me county fairs near the Great Lakes',
    scope: 'region',
    action: 'showEvents',
    regionSlug: 'great-lakes',
    category: 'Fairs',
    eventType: 'countyFair',
    timingIntent: 'seasonal',
    highlightedEventIds: [],
    responseText:
      'I can prepare a Great Lakes county fair discovery command after regional fair coverage and locations are reviewed.',
    confidence: 'medium',
    sourceStatus: 'unverified',
    needsClarification: false,
    warnings: [
      'Great Lakes regional matching is architectural only in this mock command.',
      'County fair membership should be reviewed against source-backed event records before display.',
    ],
  },
  {
    queryText: 'Find hidden small-town festivals in September',
    scope: 'national',
    action: 'showEvents',
    category: 'Festivals',
    eventType: 'smallTownFestival',
    timingIntent: 'month',
    month: 9,
    highlightedEventIds: [],
    responseText:
      'I can look for September small-town festival candidates, but hidden-gem ranking needs editorial or source-backed review.',
    confidence: 'low',
    sourceStatus: 'estimated',
    needsClarification: false,
    warnings: [
      'Hidden-gem status is subjective and should not be presented as verified fact without review.',
      'September timing is a search intent only; this mock command does not invent exact event dates.',
    ],
  },
];
