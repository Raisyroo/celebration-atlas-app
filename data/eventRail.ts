import type { AtlasEvent } from './events';

export const DEFAULT_EVENT_RAIL_TIME_ZONE = 'America/Detroit';

export type EventRailStatus = 'LIVE' | 'UPCOMING';

export type EventRailTimingOptions = {
  now?: Date;
  timeZone?: string;
};

type EventRailCandidate = Pick<AtlasEvent, 'id' | 'name' | 'dateRange'>;

type ValidDateRange = {
  startDate: string;
  endDate: string;
};

function parseDateOnly(value: string | undefined): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '');
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(0);
  parsed.setUTCHours(0, 0, 0, 0);
  parsed.setUTCFullYear(year, month - 1, day);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return value ?? null;
}

function getValidDateRange(event: Pick<AtlasEvent, 'dateRange'>): ValidDateRange | null {
  if (event.dateRange?.isEstimated !== false) return null;

  const startDate = parseDateOnly(event.dateRange?.startDate);
  if (!startDate) return null;

  const endDate = event.dateRange?.endDate
    ? parseDateOnly(event.dateRange.endDate)
    : startDate;
  if (!endDate || endDate < startDate) return null;

  return { startDate, endDate };
}

function getDateKeyInTimeZone(now: Date, timeZone: string): string | null {
  if (Number.isNaN(now.valueOf())) return null;

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return parseDateOnly(`${values.year}-${values.month}-${values.day}`);
  } catch {
    return null;
  }
}

function getEventDateKey(
  event: Pick<AtlasEvent, 'dateRange'>,
  options: EventRailTimingOptions,
): string | null {
  const timeZones = [
    event.dateRange?.timeZone,
    options.timeZone,
    DEFAULT_EVENT_RAIL_TIME_ZONE,
  ].filter((timeZone, index, values): timeZone is string => (
    Boolean(timeZone) && values.indexOf(timeZone) === index
  ));

  for (const timeZone of timeZones) {
    const dateKey = getDateKeyInTimeZone(options.now ?? new Date(), timeZone);
    if (dateKey) return dateKey;
  }

  return null;
}

function classifyEventForDate(
  event: Pick<AtlasEvent, 'dateRange'>,
  today: string,
): { status: EventRailStatus; range: ValidDateRange } | null {
  const range = getValidDateRange(event);
  if (!range || today > range.endDate) return null;

  return {
    status: today < range.startDate ? 'UPCOMING' : 'LIVE',
    range,
  };
}

export function getEventRailStatus(
  event: Pick<AtlasEvent, 'dateRange'>,
  options: EventRailTimingOptions = {},
): EventRailStatus | null {
  const today = getEventDateKey(event, options);
  if (!today) return null;

  return classifyEventForDate(event, today)?.status ?? null;
}

export function selectEventRailEvents<T extends EventRailCandidate>(
  events: readonly T[],
  options: EventRailTimingOptions = {},
): T[] {
  const eligibleEvents = events.flatMap((event) => {
    const today = getEventDateKey(event, options);
    if (!today) return [];
    const timing = classifyEventForDate(event, today);
    return timing ? [{ event, ...timing }] : [];
  });

  eligibleEvents.sort((left, right) => {
    if (left.status !== right.status) return left.status === 'LIVE' ? -1 : 1;
    if (left.range.startDate !== right.range.startDate) {
      return left.range.startDate < right.range.startDate ? -1 : 1;
    }
    if (left.event.name !== right.event.name) {
      return left.event.name < right.event.name ? -1 : 1;
    }
    if (left.event.id === right.event.id) return 0;
    return left.event.id < right.event.id ? -1 : 1;
  });

  return eligibleEvents.map(({ event }) => event);
}
