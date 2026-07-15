import type { EventTimingProfile } from './eventProfileTypes';

export const EVENT_TIMING_METADATA: Partial<Record<string, EventTimingProfile>> = {
  'romeo-peach': {
    typicalMonth: 9,
    typicalMonthName: 'September',
    typicalSeason: 'fall',
    scheduleStatus: 'unknown',
    timingConfidence: 'low',
    timingSourceStatus: 'estimated',
    timingSourceIds: [],
    notes:
      'Based on existing structured typicalMonth metadata in the Atlas event snapshot, not current-year verified dates.',
  },
  'electric-forest': {
    typicalMonth: 6,
    typicalMonthName: 'June',
    typicalSeason: 'summer',
    scheduleStatus: 'unknown',
    timingConfidence: 'low',
    timingSourceStatus: 'estimated',
    timingSourceIds: [],
    notes:
      'Based on existing structured typicalMonth metadata in the Atlas event snapshot, not current-year verified dates.',
  },
};
