import type { EventScheduleItem } from '../data/eventPageManifestTypes.ts';

export function getDateKeyInTimeZone(value: Date | string, timeZone: string): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function getScheduleItemDateKey(item: EventScheduleItem, timeZone: string): string {
  return getDateKeyInTimeZone(item.startsAt, timeZone);
}
