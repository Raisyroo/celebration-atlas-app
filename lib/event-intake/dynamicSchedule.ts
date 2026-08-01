import http from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import * as cheerio from 'cheerio';
import { resolvePublicSourceTarget } from './publicUrlPolicy.ts';
import type { OfficialEventSourceInspection } from './types.ts';

const MAX_JSON_BYTES = 6_000_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_SCHEDULE_DAYS = 31;
const MAX_SCHEDULE_ITEMS = 400;
const SPONSOR_LANGUAGE = /\b(?:sponsor(?:ed|ing|ship|s)?|presented by|presenting partner|title partner|powered by|funder)\b/i;

export type EventScheduleCandidatePayload = {
  dedupeKey: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  dateText: string | null;
  timezone: string | null;
  venue: string | null;
  category: string | null;
  tags: string[];
  details: string | null;
  confidence: 'verified';
  confidenceScore: number;
  sourceLocator: Record<string, unknown>;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function sameOrigin(left: URL, right: URL) {
  return left.protocol === right.protocol && left.host.toLowerCase() === right.host.toLowerCase();
}

async function postPublicJson(url: URL, body: Record<string, unknown>) {
  const payload = Buffer.from(JSON.stringify(body), 'utf8');
  const target = await resolvePublicSourceTarget(url);
  let lastError: unknown;

  for (const address of target.addresses) {
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transport = target.url.protocol === 'https:' ? https : http;
        const request = transport.request({
          protocol: target.url.protocol,
          hostname: address.address,
          family: address.family,
          port: target.url.port || (target.url.protocol === 'https:' ? 443 : 80),
          path: `${target.url.pathname}${target.url.search}`,
          method: 'POST',
          servername: target.url.protocol === 'https:' ? target.url.hostname : undefined,
          rejectUnauthorized: true,
          headers: {
            Host: target.url.host,
            Accept: 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': payload.byteLength,
            'Accept-Encoding': 'identity',
            'User-Agent': 'CelebrationAtlasSourceInspector/2.0',
          },
        }, (response) => {
          const status = response.statusCode ?? 0;
          const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
          if (status < 200 || status >= 300 || !contentType.includes('application/json')) {
            response.resume();
            reject(new Error(`Official schedule endpoint returned HTTP ${status}.`));
            return;
          }
          const contentLength = Number(response.headers['content-length'] ?? 0);
          if (contentLength > MAX_JSON_BYTES) {
            response.resume();
            reject(new Error('Official schedule response exceeded the collection limit.'));
            return;
          }

          const chunks: Buffer[] = [];
          let bytes = 0;
          response.on('data', (chunk: Buffer) => {
            bytes += chunk.byteLength;
            if (bytes > MAX_JSON_BYTES) {
              response.destroy(new Error('Official schedule response exceeded the collection limit.'));
              return;
            }
            chunks.push(chunk);
          });
          response.on('end', () => {
            try {
              resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
            } catch {
              reject(new Error('Official schedule endpoint returned invalid JSON.'));
            }
          });
          response.on('error', reject);
        });
        request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('Official schedule request timed out.')));
        request.on('error', reject);
        request.end(payload);
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Official schedule endpoint could not be reached.');
}

function dateList(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T12:00:00Z`);
  const end = Date.parse(`${endDate}T12:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor <= end && dates.length < MAX_SCHEDULE_DAYS; cursor += 86_400_000) {
    const date = new Date(cursor);
    dates.push(`${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCDate()).padStart(2, '0')}/${date.getUTCFullYear()}`);
  }
  return dates;
}

function localDateParts(dateText: string, timeValue: number) {
  const match = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match || !Number.isFinite(timeValue)) return null;
  const hours = Math.floor(timeValue / 100);
  const minutes = timeValue % 100;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return {
    year: Number(match[3]),
    month: Number(match[1]),
    day: Number(match[2]),
    hours,
    minutes,
  };
}

function zonedDateTime(parts: ReturnType<typeof localDateParts>, timeZone: string) {
  if (!parts) return null;
  const target = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hours, parts.minutes);
  let candidate = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
    );
    const displayed = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
    );
    const difference = displayed - target;
    if (!difference) break;
    candidate -= difference;
  }
  return new Date(candidate).toISOString();
}

function endTimeValue(value: string, startValue: number) {
  const match = value.match(/-\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/i);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === 'PM') hours += 12;
  const result = hours * 100 + Number(match[2] ?? 0);
  return result < startValue ? { value: result, nextDay: true } : { value: result, nextDay: false };
}

function addDay(dateText: string) {
  const match = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return dateText;
  const next = new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]) + 1, 12));
  return `${String(next.getUTCMonth() + 1).padStart(2, '0')}/${String(next.getUTCDate()).padStart(2, '0')}/${next.getUTCFullYear()}`;
}

function stripHtml(value: unknown) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw) return '';
  const $ = cheerio.load(`<div>${raw.replace(/<br\s*\/?>/gi, ' ')}</div>`);
  return text($('div').first().text());
}

function sponsorNamesFromDescription(value: unknown) {
  const description = stripHtml(value);
  const names = [...description.matchAll(/\b(?:sponsored|presented|powered)\s+by\s+([^.;]+)/gi)]
    .map((match) => text(match[1]))
    .filter((name) => name.length >= 3 && name.length <= 100);
  return [...new Set(names)];
}

function cleanScheduleTitle(value: unknown, description: unknown) {
  let title = stripHtml(value)
    .replace(/\s*-\s*(?:19|20)\d{2}\b/g, ' ')
    .replace(/\s+(?:19|20)\d{2}$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  const blockedTerms = sponsorNamesFromDescription(description);
  for (const sponsorName of sponsorNamesFromDescription(description)) {
    const escaped = sponsorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    title = title.replace(new RegExp(`^${escaped}\\s*[-:|]?\\s*`, 'i'), '');
  }
  const brandedCore = title.match(/^(.+?)\s+(Festival of Races(?:\s+Packet Pick\s*up)?|(?:Community|Cherry) Royale Parade|Cherry Farm Market|Festival Air Show|Festival Fireworks Finale)$/i);
  if (brandedCore) {
    blockedTerms.push(text(brandedCore[1]));
    title = brandedCore[2];
  }
  if (/^(?:[A-Z][\w&.'-]*\s+){1,3}Day$/i.test(title) && /\b(?:energy|bank|credit|insurance|health|motors?)\b/i.test(title)) {
    blockedTerms.push(title.replace(/\s+Day$/i, ''));
    title = 'Festival Community Day';
  }
  return {
    title: SPONSOR_LANGUAGE.test(title) ? '' : title,
    blockedTerms: [...new Set(blockedTerms.filter(Boolean))],
  };
}

function cleanVenue(value: unknown, blockedTerms: string[]) {
  let venue = stripHtml(value);
  const inlineSponsors = sponsorNamesFromDescription(venue);
  venue = venue.replace(/\s+(?:presented|sponsored|powered)\s+by\b.*$/i, '').trim();
  for (const blockedTerm of [...blockedTerms, ...inlineSponsors]) {
    const escaped = blockedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    venue = venue.replace(new RegExp(escaped, 'gi'), ' ');
  }
  venue = venue
    .replace(/^.+?\b(Bayside Music Stage)\b.*$/i, '$1')
    .replace(/^.+?\b(Cherry Blast Stage)\b/i, '$1')
    .replace(/\s+/g, ' ')
    .replace(/^[|,:\-\s]+|[|,:\-\s]+$/g, '')
    .trim();
  return venue && !SPONSOR_LANGUAGE.test(venue) ? venue.slice(0, 220) : null;
}

function cleanDetails(value: unknown, blockedTerms: string[], eventYear: number | null) {
  let details = stripHtml(value);
  for (const blockedTerm of blockedTerms) {
    const escaped = blockedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    details = details.replace(new RegExp(escaped, 'gi'), 'Festival');
  }
  details = details
    .replace(/\b(?:[A-Z][\w&.'-]*\s+){1,4}(Festival of Races(?:\s+Packet Pick\s*up)?|(?:Community|Cherry) Royale Parade|Cherry Farm Market|Festival Air Show|Festival Fireworks Finale)\b/g, '$1')
    .replace(/\b(?:[A-Z][\w&.'-]*\s+){1,3}(Bayside Music Stage|Cherry Blast Stage)\b/g, '$1')
    .replace(/\b(?:[A-Z][\w&.'-]*\s+){0,3}(?:Energy|Bank|Credit Union|Insurance|Motors?)\b/g, 'Festival');
  const editionRanges = [...details.matchAll(/\b(20\d{2})\s*\/\s*(20\d{2})\b/g)];
  if (eventYear && editionRanges.some((match) => Number(match[2]) <= eventYear)) return '';
  return details
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !SPONSOR_LANGUAGE.test(sentence))
    .join(' ')
    .trim()
    .slice(0, 600);
}

function categoryMapFromHtml(html: string) {
  const $ = cheerio.load(html);
  const categories = new Map<number, string>();
  $('[categoryid]').each((_, element) => {
    const id = Number($(element).attr('categoryid'));
    const label = text($(element).text());
    if (Number.isInteger(id) && id > 0 && label) categories.set(id, label);
  });
  return categories;
}

function normalizedCategory(item: JsonRecord, categories: Map<number, string>) {
  const mappings = Array.isArray(item.CategoryMaps) ? item.CategoryMaps.filter(isRecord) : [];
  const signal = mappings.map((mapping) => (
    categories.get(Number(mapping.CategoryID)) ?? categories.get(Number(mapping.ParentCategoryID)) ?? ''
  )).join(' ').toLowerCase();
  const title = stripHtml(item.SingleEventItemName || item.Name).toLowerCase();
  const combined = `${signal} ${title}`;
  if (/concert|music|stage|band|orchestra/.test(combined)) return 'music';
  if (/food|pie|market|culinary|dinner|breakfast|lunch/.test(combined)) return 'food';
  if (/kid|family|youth|child|junior/.test(combined)) return 'family';
  if (/race|run|wellness|fitness|golf/.test(combined)) return 'community';
  if (/award|queen|coronation|final|winner/.test(combined)) return 'awards';
  return 'community';
}

function staticScheduleCategory(title: string) {
  const signal = title.toLowerCase();
  if (/concert|music|stage|band|orchestra|singer/.test(signal)) return 'music';
  if (/food|pie|market|culinary|dinner|breakfast|lunch/.test(signal)) return 'food';
  if (/carnival|midway|ride|armband|mega pass/.test(signal)) return 'midway';
  if (/livestock|showmanship|beef|dairy cattle|goat|poultry|rabbit|sheep|swine|horse(?: and| &)? pony/.test(signal)) return 'livestock';
  if (/exhibit|home arts?|horticulture|needlework|photography|woodworking/.test(signal)) return 'exhibits';
  if (/rodeo|monster trucks?|demolition derby|truck|tractor|pull|bump|figure\s*8/.test(signal)) return 'grandstand';
  if (/kid|family|youth|child|museum|balloon/.test(signal)) return 'family';
  if (/competition|contest/.test(signal)) return 'competition';
  if (/award|queen|coronation|final|winner/.test(signal)) return 'awards';
  return 'community';
}

function scheduleDateByWeekday(startDate: string, endDate: string) {
  const output = new Map<string, string>();
  for (const dateText of dateList(startDate, endDate)) {
    const match = dateText.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) continue;
    const date = new Date(Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2]), 12));
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }).toLowerCase();
    output.set(weekday, dateText);
  }
  return output;
}

function clockValue(hoursValue: string, minutesValue: string | undefined, meridiemValue: string) {
  const rawHours = Number(hoursValue);
  const minutes = Number(minutesValue ?? 0);
  if (!Number.isInteger(rawHours) || rawHours < 1 || rawHours > 12 || minutes < 0 || minutes > 59) return null;
  let hours = rawHours % 12;
  if (meridiemValue.toUpperCase() === 'PM') hours += 12;
  return hours * 100 + minutes;
}

function parseStaticScheduleLine(value: string) {
  const normalized = text(value);
  const split = normalized.match(/^(.+?)\s+[-\u2013\u2014]\s+(.+)$/);
  const separatedTimeText = split?.[1].trim() ?? '';
  const separatedMatch = separatedTimeText.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?(?:\s*[-\u2013\u2014]\s*(?:(\d{1,2})(?::(\d{2}))?\s*(AM|PM)|close))?$/i);
  const compactMatch = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?(?:\s*[-\u2013\u2014]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM))?\s+(.+)$/i);
  const match = separatedMatch ?? compactMatch;
  if (!match) return null;

  let startMeridiem = match[3]?.toUpperCase() ?? '';
  const endMeridiem = match[6]?.toUpperCase() ?? '';
  if (!startMeridiem && endMeridiem) {
    const startHour = Number(match[1]);
    const endHour = Number(match[4]);
    startMeridiem = endMeridiem === 'PM' && startHour > endHour && startHour !== 12 ? 'AM' : endMeridiem;
  }
  if (!startMeridiem) return null;
  const startValue = clockValue(match[1], match[2], startMeridiem);
  const endValue = match[4] && endMeridiem ? clockValue(match[4], match[5], endMeridiem) : null;
  if (startValue === null) return null;
  const rawTitle = separatedMatch ? split![2].trim() : compactMatch![7].trim();
  const venuePrefix = rawTitle.match(
    /^(MAINSTAGE|(?:[A-Z][A-Z0-9&.'-]*\s+){0,2}(?:STAGE|GROVE|PAVILION|TENT|PLAZA|AREA))\s+(.+)$/,
  );
  const venue = venuePrefix ? readableScheduleTitle(venuePrefix[1]) : null;
  return {
    startValue,
    endValue,
    endNextDay: endValue !== null && endValue < startValue,
    timeText: separatedMatch
      ? separatedTimeText
      : normalized.slice(0, normalized.length - rawTitle.length).trim(),
    title: venuePrefix ? venuePrefix[2].trim() : rawTitle,
    venue,
  };
}

const MONTH_NUMBERS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

function readableScheduleTitle(value: string) {
  const normalized = text(value);
  if (!normalized || normalized !== normalized.toUpperCase() || !/[A-Z]/.test(normalized)) {
    return normalized;
  }
  return normalized
    .toLowerCase()
    .replace(/(^|[\s/&-])([a-z])/g, (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`);
}

function parseHeadingDateTime(
  value: string,
  editionYear: number,
  startDate: string,
  endDate: string,
) {
  const match = text(value).match(
    /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:,\s*(20\d{2}))?\s*@\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );
  if (!match) return null;
  const year = Number(match[4] ?? editionYear);
  const month = MONTH_NUMBERS[match[2].toLowerCase()];
  const day = Number(match[3]);
  const startValue = clockValue(match[5], match[6], match[7]);
  if (!month || !day || startValue === null) return null;
  const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (isoDate < startDate || isoDate > endDate) return null;
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  if (weekday.toLowerCase() !== match[1].toLowerCase()) return null;
  return {
    dateText: `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`,
    startValue,
    timeText: `${match[5]}${match[6] ? `:${match[6]}` : ''}${match[7].toUpperCase()}`,
  };
}

export function scheduleItemsFromHeadingDatePairs(
  inspection: OfficialEventSourceInspection,
  timeZone = 'America/Detroit',
) {
  const startDate = inspection.candidate.startDate;
  const endDate = inspection.candidate.endDate || startDate;
  const editionYear = Number(startDate.match(/^(20\d{2})/)?.[1] ?? '');
  if (!editionYear || !startDate || !endDate) return [];

  const output: EventScheduleCandidatePayload[] = [];
  for (let index = 0; index < inspection.contentSegments.length - 1; index += 1) {
    const heading = inspection.contentSegments[index];
    const timing = inspection.contentSegments[index + 1];
    if (heading.kind !== 'heading' || !['paragraph', 'detail', 'listItem'].includes(timing.kind)) continue;
    if (/^(?:schedule|disclaimer|admissions?|tickets?|information)$/i.test(text(heading.text))) continue;
    const parsed = parseHeadingDateTime(timing.text, editionYear, startDate, endDate);
    if (!parsed) continue;
    const cleanedTitle = cleanScheduleTitle(readableScheduleTitle(heading.text), '');
    if (!cleanedTitle.title) continue;
    const startsAt = zonedDateTime(localDateParts(parsed.dateText, parsed.startValue), timeZone);
    if (!startsAt) continue;
    const dedupeKey = createHash('sha256')
      .update(JSON.stringify([cleanedTitle.title.toLowerCase(), startsAt, null, '']))
      .digest('hex');
    output.push({
      dedupeKey,
      title: cleanedTitle.title,
      startsAt,
      endsAt: null,
      dateText: parsed.dateText,
      timezone: timeZone,
      venue: null,
      category: staticScheduleCategory(cleanedTitle.title),
      tags: ['main-event'],
      details: null,
      confidence: 'verified',
      confidenceScore: 0.95,
      sourceLocator: {
        adapter: 'heading-date-pair-v1',
        headingSegmentIndex: index,
        timingSegmentIndex: index + 1,
        date: parsed.dateText,
        time: parsed.timeText,
      },
    });
    if (output.length >= MAX_SCHEDULE_ITEMS) break;
  }
  return output;
}

export function scheduleItemsFromEventHoursSegments(
  inspection: OfficialEventSourceInspection,
  timeZone = 'America/Detroit',
) {
  const startDate = inspection.candidate.startDate;
  const endDate = inspection.candidate.endDate || startDate;
  if (!startDate || !endDate) return [];

  const output: EventScheduleCandidatePayload[] = [];
  for (let index = 0; index < inspection.contentSegments.length; index += 1) {
    const segment = inspection.contentSegments[index];
    const match = text(segment.text).match(
      /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s*[-\u2013\u2014]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+(\d{1,2}),?\s+(20\d{2})$/i,
    );
    if (!match) continue;
    const monthToken = match[8].toLowerCase().replace(/\.$/, '');
    const month = Object.entries(MONTH_NUMBERS).find(([name]) => (
      name.startsWith(monthToken) || monthToken.startsWith(name.slice(0, 3))
    ))?.[1];
    const day = Number(match[9]);
    const year = Number(match[10]);
    const startValue = clockValue(match[1], match[2], match[3]);
    const endValue = clockValue(match[4], match[5], match[6]);
    if (!month || !day || startValue === null || endValue === null) continue;
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    if (isoDate < startDate || isoDate > endDate) continue;
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    const weekday = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
    if (weekday.toLowerCase() !== match[7].toLowerCase()) continue;

    const dateText = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
    const startsAt = zonedDateTime(localDateParts(dateText, startValue), timeZone);
    const endsAt = zonedDateTime(localDateParts(dateText, endValue), timeZone);
    if (!startsAt || !endsAt || endsAt <= startsAt) continue;
    const eventName = text(inspection.candidate.name) || 'Event';
    const title = `${eventName} hours`.slice(0, 300);
    const dedupeKey = createHash('sha256')
      .update(JSON.stringify([title.toLowerCase(), startsAt, endsAt, inspection.candidate.locationName.toLowerCase()]))
      .digest('hex');
    output.push({
      dedupeKey,
      title,
      startsAt,
      endsAt,
      dateText,
      timezone: timeZone,
      venue: text(inspection.candidate.locationName) || null,
      category: 'community',
      tags: ['main-event', 'event-hours'],
      details: null,
      confidence: 'verified',
      confidenceScore: 1,
      sourceLocator: {
        adapter: 'event-hours-segment-v1',
        segmentIndex: index,
        date: dateText,
        startTime: `${match[1]}${match[2] ? `:${match[2]}` : ''} ${match[3].toUpperCase()}`,
        endTime: `${match[4]}${match[5] ? `:${match[5]}` : ''} ${match[6].toUpperCase()}`,
      },
    });
  }
  return output;
}

export function scheduleItemsFromStaticSegments(
  inspection: OfficialEventSourceInspection,
  timeZone = 'America/Detroit',
) {
  const weekdayDates = scheduleDateByWeekday(
    inspection.candidate.startDate,
    inspection.candidate.endDate || inspection.candidate.startDate,
  );
  if (!weekdayDates.size) return [];

  const output: EventScheduleCandidatePayload[] = [];
  let inSchedule = false;
  let currentDate = '';
  for (let index = 0; index < inspection.contentSegments.length; index += 1) {
    const segment = inspection.contentSegments[index];
    const segmentText = text(segment.text);
    if (/\b(?:full\s+)?event schedule\b/i.test(segmentText)) {
      inSchedule = true;
      continue;
    }
    if (inSchedule && /^(?:admissions?|tickets?|more information)$/i.test(segmentText)) break;

    const weekdayMatch = segmentText.match(/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)(?:\b|,)/i);
    if (weekdayMatch) {
      const matchedDate = weekdayDates.get(weekdayMatch[1].toLowerCase());
      if (matchedDate) {
        inSchedule = true;
        currentDate = matchedDate;
      }
      continue;
    }
    if (!inSchedule || !currentDate || !['listItem', 'paragraph', 'detail'].includes(segment.kind)) continue;

    const parsed = parseStaticScheduleLine(segmentText);
    if (!parsed) continue;
    const venueMatch = parsed.title.match(/\s*\(([^()]{2,120})\)\s*$/);
    const rawTitle = venueMatch ? parsed.title.slice(0, venueMatch.index).trim() : parsed.title;
    const cleanedTitle = cleanScheduleTitle(rawTitle, '');
    if (!cleanedTitle.title) continue;
    const startsAt = zonedDateTime(localDateParts(currentDate, parsed.startValue), timeZone);
    const endsAt = parsed.endValue === null
      ? null
      : zonedDateTime(localDateParts(parsed.endNextDay ? addDay(currentDate) : currentDate, parsed.endValue), timeZone);
    if (!startsAt) continue;
    const venue = cleanVenue(parsed.venue ?? venueMatch?.[1] ?? '', cleanedTitle.blockedTerms);
    const dedupeKey = createHash('sha256')
      .update(JSON.stringify([cleanedTitle.title.toLowerCase(), startsAt, endsAt, venue?.toLowerCase() ?? '']))
      .digest('hex');
    output.push({
      dedupeKey,
      title: cleanedTitle.title,
      startsAt,
      endsAt,
      dateText: currentDate,
      timezone: timeZone,
      venue,
      category: staticScheduleCategory(`${cleanedTitle.title} ${venue ?? ''}`),
      tags: [],
      details: null,
      confidence: 'verified',
      confidenceScore: 0.95,
      sourceLocator: {
        adapter: 'static-day-list-v1',
        segmentIndex: index,
        date: currentDate,
        time: parsed.timeText,
      },
    });
    if (output.length >= MAX_SCHEDULE_ITEMS) break;
  }
  return output;
}

export function scheduleItemsFromStaticHtml(
  rawHtml: string,
  inspection: OfficialEventSourceInspection,
  timeZone = 'America/Detroit',
) {
  const $ = cheerio.load(rawHtml);
  const main = $('main').first();
  const root = main.length ? main : $('body').first();
  const contentSegments: OfficialEventSourceInspection['contentSegments'] = [];
  root.find('h1,h2,h3,h4,h5,h6,p,li').each((_, element) => {
    const value = text($(element).text());
    if (!value) return;
    const tagName = String((element as { tagName?: string }).tagName ?? '').toLowerCase();
    contentSegments.push({
      kind: /^h[1-6]$/.test(tagName) ? 'heading' : tagName === 'li' ? 'listItem' : 'paragraph',
      text: value,
    });
  });
  return scheduleItemsFromStaticSegments({
    ...inspection,
    contentSegments,
  }, timeZone).map((item) => ({
    ...item,
    sourceLocator: {
      ...item.sourceLocator,
      adapter: 'static-html-day-list-v1',
    },
  }));
}

const FOOEVENTS_MONTH_NUMBER: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

function fooEventsClock(value: string) {
  const normalized = text(value)
    .replace(/\b([ap])\.?\s*m\.?/gi, (_, letter: string) => `${letter.toUpperCase()}M`)
    .replace(/\s+/g, ' ');
  const match = normalized.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)(?:\s*[-\u2013\u2014]\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM))?/i);
  if (!match) return null;
  const startValue = clockValue(match[1], match[2], match[3]);
  const endValue = match[4] && match[6] ? clockValue(match[4], match[5], match[6]) : null;
  if (startValue === null) return null;
  return {
    startValue,
    endValue,
    endNextDay: endValue !== null && endValue < startValue,
    timeText: normalized,
  };
}

export function scheduleItemsFromFooEventsListing(
  html: string,
  inspection: OfficialEventSourceInspection,
  timeZone = 'America/Detroit',
) {
  const $ = cheerio.load(html);
  const candidateYear = Number(
    inspection.candidate.startDate.match(/^(20\d{2})/)?.[1]
      ?? inspection.candidate.endDate.match(/^(20\d{2})/)?.[1]
      ?? $('th').text().match(/\b(20\d{2})\b/)?.[1]
      ?? '',
  );
  if (!candidateYear) return [];

  const output: EventScheduleCandidatePayload[] = [];
  $('.fooevents-event-listing-single').each((index, element) => {
    if (output.length >= MAX_SCHEDULE_ITEMS) return false;
    const row = $(element);
    const month = FOOEVENTS_MONTH_NUMBER[text(row.find('.fooevents-event-listing-date-month').first().text()).slice(0, 3).toLowerCase()];
    const day = Number(text(row.find('.fooevents-event-listing-date-day').first().text()));
    if (!month || !Number.isInteger(day) || day < 1 || day > 31) return;

    const link = row.find('h3 a[href]').first();
    const cleanedTitle = cleanScheduleTitle(link.text() || row.find('h3').first().text(), '');
    if (!cleanedTitle.title) return;
    const parsedTime = fooEventsClock(row.find('.event-time').first().text());
    if (!parsedTime) return;

    const dateText = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${candidateYear}`;
    const startsAt = zonedDateTime(localDateParts(dateText, parsedTime.startValue), timeZone);
    const endsAt = parsedTime.endValue === null
      ? null
      : zonedDateTime(
        localDateParts(parsedTime.endNextDay ? addDay(dateText) : dateText, parsedTime.endValue),
        timeZone,
      );
    if (!startsAt) return;

    const venue = cleanVenue(
      row.find('.fooevents-event-listing-compact-location strong').first().text(),
      cleanedTitle.blockedTerms,
    );
    const href = text(link.attr('href'));
    let detailUrl: string | null = null;
    try {
      detailUrl = href ? new URL(href, inspection.finalUrl).toString() : null;
    } catch {
      detailUrl = null;
    }
    const dedupeKey = createHash('sha256')
      .update(JSON.stringify([cleanedTitle.title.toLowerCase(), startsAt, endsAt, venue?.toLowerCase() ?? '']))
      .digest('hex');
    output.push({
      dedupeKey,
      title: cleanedTitle.title,
      startsAt,
      endsAt,
      dateText,
      timezone: timeZone,
      venue,
      category: staticScheduleCategory(cleanedTitle.title),
      tags: [],
      details: null,
      confidence: 'verified',
      confidenceScore: 0.98,
      sourceLocator: {
        adapter: 'fooevents-listing-v1',
        rowIndex: index,
        detailUrl,
        date: dateText,
        time: parsedTime.timeText,
      },
    });
  });
  return output;
}

export function scheduleItemsFromSaffireResponse(
  response: unknown,
  categories: Map<number, string>,
  timeZone: string,
) {
  if (!isRecord(response) || !isRecord(response.d) || !Array.isArray(response.d.Days)) return [];
  const output: EventScheduleCandidatePayload[] = [];

  for (const dayValue of response.d.Days) {
    if (!isRecord(dayValue)) continue;
    const dateText = text(dayValue.DateString);
    const times = Array.isArray(dayValue.Times) ? dayValue.Times.filter(isRecord) : [];
    for (const time of times) {
      const hasTime = time.HasSpecificTime === true && Number.isFinite(Number(time.Time));
      const startValue = hasTime ? Number(time.Time) : null;
      const items = Array.isArray(time.Items) ? time.Items.filter(isRecord) : [];
      for (const item of items) {
        if (output.length >= MAX_SCHEDULE_ITEMS) return output;
        const locations = Array.isArray(item.Locations) ? item.Locations.filter(isRecord) : [];
        const rawVenue = locations[0]?.DisplayName || locations[0]?.Name;
        const cleanedTitle = cleanScheduleTitle(
          item.SingleEventItemName || item.Name,
          `${stripHtml(item.LongDescription)} ${stripHtml(rawVenue)}`,
        );
        const title = cleanedTitle.title;
        if (!title) continue;
        const startsAt = startValue === null
          ? null
          : zonedDateTime(localDateParts(dateText, startValue), timeZone);
        const end = startValue === null ? null : endTimeValue(text(item.EventTimeRangeString), startValue);
        const endsAt = end
          ? zonedDateTime(localDateParts(end.nextDay ? addDay(dateText) : dateText, end.value), timeZone)
          : null;
        const venue = cleanVenue(rawVenue, cleanedTitle.blockedTerms);
        const eventYear = Number(dateText.match(/(20\d{2})$/)?.[1] ?? 0) || null;
        const details = cleanDetails(item.ShortDescription, cleanedTitle.blockedTerms, eventYear) || null;
        const sourceLocator = {
          adapter: 'saffire-events-service-v1',
          eventId: item.EventID ?? null,
          detailUrl: text(item.DetailURL) || null,
          date: dateText,
          time: text(time.TimeDisplay) || null,
        };
        const dedupeKey = createHash('sha256')
          .update(JSON.stringify([title.toLowerCase(), startsAt, endsAt, venue?.toLowerCase() ?? '']))
          .digest('hex');
        output.push({
          dedupeKey,
          title,
          startsAt,
          endsAt,
          dateText: dateText || null,
          timezone: timeZone,
          venue,
          category: normalizedCategory(item, categories),
          tags: [],
          details,
          confidence: 'verified',
          confidenceScore: 1,
          sourceLocator,
        });
      }
    }
  }
  return output;
}

export async function collectDynamicSchedule(args: {
  inspection: OfficialEventSourceInspection;
  rawHtml: string;
  sourceKind: string;
  timezone?: string;
}): Promise<EventScheduleCandidatePayload[]> {
  const timeZone = args.timezone ?? 'America/Detroit';
  const eventHours = scheduleItemsFromEventHoursSegments(
    args.inspection,
    timeZone,
  );
  if (args.sourceKind !== 'schedule') return eventHours;
  if (/fooevents-event-listing-single/i.test(args.rawHtml)) {
    const items = [
      ...eventHours,
      ...scheduleItemsFromFooEventsListing(
      args.rawHtml,
      args.inspection,
      timeZone,
      ),
    ];
    return [...new Map(items.map((item) => [item.dedupeKey, item])).values()]
      .slice(0, MAX_SCHEDULE_ITEMS);
  }
  if (!/Events\/JS\/EventSchedule\.js|services\/eventsservice\.asmx/i.test(args.rawHtml)) {
    const items = [
      ...eventHours,
      ...scheduleItemsFromHeadingDatePairs(args.inspection, timeZone),
      ...scheduleItemsFromStaticSegments(args.inspection, timeZone),
      ...scheduleItemsFromStaticHtml(args.rawHtml, args.inspection, timeZone),
    ];
    return [...new Map(items.map((item) => [item.dedupeKey, item])).values()]
      .slice(0, MAX_SCHEDULE_ITEMS);
  }
  const dates = dateList(args.inspection.candidate.startDate, args.inspection.candidate.endDate);
  if (!dates.length) return eventHours;

  const sourceUrl = new URL(args.inspection.finalUrl);
  const endpoint = new URL('/services/eventsservice.asmx/GetEventDaysByList', sourceUrl);
  if (!sameOrigin(sourceUrl, endpoint)) return eventHours;
  const categories = categoryMapFromHtml(args.rawHtml);
  const items: EventScheduleCandidatePayload[] = [...eventHours];

  for (let index = 0; index < dates.length; index += 5) {
    const response = await postPublicJson(endpoint, {
      dates: dates.slice(index, index + 5).join(','),
      day: '',
      categoryID: 0,
      tagID: 0,
      keywords: '%25%25',
      isFeatured: false,
      fanPicks: false,
      pastEvents: true,
      allEvents: false,
      memberEvents: false,
      memberOnly: false,
      showCategoryExceptionID: 0,
      isolatedSchedule: 0,
      customFieldFilters: [],
      searchInDescription: true,
    });
    items.push(...scheduleItemsFromSaffireResponse(response, categories, timeZone));
    if (items.length >= MAX_SCHEDULE_ITEMS) break;
  }

  const unique = new Map(items.map((item) => [item.dedupeKey, item]));
  return [...unique.values()].slice(0, MAX_SCHEDULE_ITEMS);
}
