import type {
  EventDateRange,
  EventSeason,
  EventTimingProfile,
} from './eventProfileTypes';
import type { AtlasEvent } from './events';

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type ParsedDateOnly = {
  month: number;
  ordinal: number;
};

function parseDateOnly(value: string): ParsedDateOnly | null {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ordinal = Date.UTC(year, month - 1, day);
  const parsed = new Date(ordinal);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return { month, ordinal };
}

function seasonForMonth(month: number): EventSeason {
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

export function resolveAtlasEventProfileDateRange(
  dateRange: AtlasEvent['dateRange'],
  defaultTimeZone?: string,
): EventDateRange | null {
  if (!dateRange) return null;

  return {
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    timezone: dateRange.timeZone ?? defaultTimeZone,
    isEstimated: dateRange.isEstimated ?? true,
  };
}

export function resolveReviewedAtlasEventTiming(
  dateRange: AtlasEvent['dateRange'],
  defaultTimeZone?: string,
): EventTimingProfile | null {
  if (!dateRange || dateRange.isEstimated !== false) return null;

  const start = parseDateOnly(dateRange.startDate);
  const end = dateRange.endDate ? parseDateOnly(dateRange.endDate) : null;

  if (!start || (dateRange.endDate && !end) || (end && end.ordinal < start.ordinal)) {
    return null;
  }

  return {
    dateStart: dateRange.startDate,
    dateEnd: dateRange.endDate,
    timezone: dateRange.timeZone ?? defaultTimeZone,
  };
}

export function resolveReviewedAtlasEventSeason(
  dateRange: AtlasEvent['dateRange'],
): EventSeason | undefined {
  if (!dateRange || dateRange.isEstimated !== false) return undefined;
  const start = parseDateOnly(dateRange.startDate);
  return start ? seasonForMonth(start.month) : undefined;
}
