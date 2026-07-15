import type { EventDateRange } from './eventProfileTypes';
import type { AtlasEvent } from './events';

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
