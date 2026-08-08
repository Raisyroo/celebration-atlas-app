import http, { type IncomingHttpHeaders } from 'node:http';
import https from 'node:https';
import { createHash } from 'node:crypto';
import {
  brotliDecompressSync,
  gunzipSync,
  inflateSync,
} from 'node:zlib';
import * as cheerio from 'cheerio';
import { resolvePublicSourceTarget } from './publicUrlPolicy.ts';
import type {
  EventSourceCandidate,
  EventSourceContentSegment,
  EventSourceEvidence,
  EventSourceLink,
  EventSourceLinkKind,
  InspectionConfidence,
  InspectionEvidenceMethod,
  OfficialEventSourceInspection,
} from './types.ts';

const MAX_DOWNLOAD_BYTES = 2_500_000;
const MAX_DECODED_BYTES = 5_000_000;
const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 12_000;
const MAX_JSON_LD_BYTES = 300_000;
const SPONSOR_LANGUAGE = /\b(?:sponsor(?:ed|ing|ship|s)?|presented by|presenting partner|title partner|powered by|funder)\b/i;
const MONTH_NUMBER: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

type JsonObject = Record<string, unknown>;

type DownloadedHtml = {
  requestedUrl: string;
  finalUrl: string;
  html: string;
  downloadedBytes: number;
  contentType: string;
  responseMetadata: {
    statusCode: number;
    redirectCount: number;
    etag: string | null;
    lastModified: string | null;
    cacheControl: string | null;
    contentLanguage: string | null;
    contentEncoding: string | null;
  };
};

export type OfficialEventSourceCapture = {
  inspection: OfficialEventSourceInspection;
  rawHtml: string;
  contentHash: string;
  contentType: string;
  downloadedBytes: number;
  fetchMetadata: {
    parserVersion: 2;
    requestedUrl: string;
    finalUrl: string;
    statusCode: number;
    redirectCount: number;
    etag: string | null;
    lastModified: string | null;
    cacheControl: string | null;
    contentLanguage: string | null;
    contentEncoding: string | null;
  };
};

type RawResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
};

export class OfficialSourceInspectionError extends Error {
  readonly code:
    | 'invalid_source'
    | 'source_unreachable'
    | 'source_rejected'
    | 'source_too_large'
    | 'source_not_html';
  readonly status: number;

  constructor(
    message: string,
    code:
      | 'invalid_source'
      | 'source_unreachable'
      | 'source_rejected'
      | 'source_too_large'
      | 'source_not_html',
    status: number,
  ) {
    super(message);
    this.name = 'OfficialSourceInspectionError';
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function plainString(value: unknown): string {
  if (typeof value === 'string') return cleanWhitespace(value);
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    for (const item of value) {
      const candidate = plainString(item);
      if (candidate) return candidate;
    }
  }
  if (isRecord(value)) {
    return plainString(value.name ?? value.value ?? value['@value']);
  }
  return '';
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function scrubSponsorReferences(value: string, sponsorNames: string[], maxLength = 2_000) {
  let cleaned = cleanWhitespace(value)
    .replace(/\s*(?:presented|sponsored|powered)\s+by\b.*$/i, '')
    .trim();
  cleaned = cleaned
    .split(/(?<=[.!?])\s+/)
    .filter((sentence) => !SPONSOR_LANGUAGE.test(sentence))
    .join(' ')
    .trim();
  for (const name of sponsorNames) {
    if (name.length < 3) continue;
    cleaned = cleaned.replace(new RegExp(`(?:^|\\s|[-|:])${escapeRegExp(name)}(?=\\s|[-|:]|$)`, 'gi'), ' ');
  }
  return cleanWhitespace(cleaned).replace(/^[|:\-\s]+|[|:\-\s]+$/g, '').slice(0, maxLength);
}

function normalizeDate(value: unknown) {
  const text = plainString(value);
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match || Number.isNaN(Date.parse(`${match[1]}T00:00:00Z`))) return '';
  return match[1];
}

function isoDate(year: string, month: string, day: string) {
  const value = `${year}-${month}-${day.padStart(2, '0')}`;
  return Number.isNaN(Date.parse(`${value}T00:00:00Z`)) ? '' : value;
}

function naturalDateRange(value: string) {
  const text = cleanWhitespace(value);
  const sameMonth = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(\d{1,2}),?\s+(20\d{2})\b/i);
  if (sameMonth) {
    const month = MONTH_NUMBER[sameMonth[1].toLowerCase()];
    return {
      startDate: isoDate(sameMonth[4], month, sameMonth[2]),
      endDate: isoDate(sameMonth[4], month, sameMonth[3]),
    };
  }

  const crossMonth = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\s*[-\u2013\u2014]\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (crossMonth) {
    return {
      startDate: isoDate(crossMonth[5], MONTH_NUMBER[crossMonth[1].toLowerCase()], crossMonth[2]),
      endDate: isoDate(crossMonth[5], MONTH_NUMBER[crossMonth[3].toLowerCase()], crossMonth[4]),
    };
  }

  const singleDay = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(20\d{2})\b/i);
  if (!singleDay) return { startDate: '', endDate: '' };
  const date = isoDate(singleDay[3], MONTH_NUMBER[singleDay[1].toLowerCase()], singleDay[2]);
  return { startDate: date, endDate: date };
}

function naturalMichiganLocation(value: string) {
  const match = cleanWhitespace(value).match(
    /\b(?:in|at)\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})(?:,\s*|\s+)(Michigan|MI)\b/,
  );
  if (!match) return { city: '', state: '' };
  return { city: cleanWhitespace(match[1]), state: 'MI' };
}

function contentDateRange(segments: EventSourceContentSegment[]) {
  const ranges = new Map<string, { startDate: string; endDate: string }>();
  segments.forEach((segment) => {
    if (!['heading', 'paragraph', 'detail', 'time'].includes(segment.kind)) return;
    const range = naturalDateRange(segment.text);
    if (!range.startDate || !range.endDate) return;
    ranges.set(`${range.startDate}:${range.endDate}`, range);
  });
  return ranges.size === 1
    ? [...ranges.values()][0]
    : { startDate: '', endDate: '' };
}

function labeledEventDateRange(segments: EventSourceContentSegment[]) {
  for (const segment of segments) {
    if (!/\b(?:festival|event)\s+dates?\b/i.test(segment.text)) continue;
    const range = naturalDateRange(segment.text);
    if (range.startDate && range.endDate) return range;
  }
  return { startDate: '', endDate: '' };
}

function contentMichiganAddress(segments: EventSourceContentSegment[]) {
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const match = cleanWhitespace(segment.text).match(
      /\b(\d{1,6}\s+[A-Z0-9][A-Za-z0-9.' -]{2,80}?),?\s+([A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3})(?:,\s*|\s+)(Michigan|MI)\s+(\d{5})\b/,
    );
    if (!match) continue;
    const priorHeading = [...segments.slice(Math.max(0, index - 4), index)]
      .reverse()
      .find((candidate) => (
        candidate.kind === 'heading'
        && !/^(?:location|location information|event detail|hotel|lodging)$/i.test(candidate.text)
        && /\b(?:stadium|center|hall|park|fairgrounds?|plaza|arena|theat(?:er|re)|museum|pavilion|grounds)\b/i.test(candidate.text)
      ));
    return {
      locationName: priorHeading?.text ?? '',
      street: cleanWhitespace(match[1]),
      city: cleanWhitespace(match[2]),
      state: 'MI',
      postalCode: match[4],
    };
  }
  return { locationName: '', street: '', city: '', state: '', postalCode: '' };
}

function contentVenueName(segments: EventSourceContentSegment[]) {
  for (const segment of segments) {
    const match = cleanWhitespace(segment.text).match(
      /^(?:at|venue:)\s+(?:the\s+)?(.{2,100}\b(?:stadium|center|hall|park|fairgrounds?|plaza|arena|theat(?:er|re)|museum|pavilion|grounds))\.?$/i,
    );
    if (match) return cleanWhitespace(match[1]);
  }
  return '';
}

function normalizeState(value: string) {
  if (/^michigan$/i.test(value)) return 'MI';
  return value.length === 2 ? value.toUpperCase() : value;
}

function jsonLdTypes(value: unknown) {
  const types = Array.isArray(value) ? value : [value];
  return types
    .map(plainString)
    .filter(Boolean)
    .map((type) => type.split(/[\/#]/).pop() ?? type);
}

function isEventNode(value: JsonObject) {
  return jsonLdTypes(value['@type']).some((type) => /Event$/i.test(type) || /^Festival$/i.test(type));
}

function collectJsonObjects(value: unknown, output: JsonObject[], depth = 0) {
  if (depth > 10) return;
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonObjects(item, output, depth + 1));
    return;
  }
  if (!isRecord(value)) return;
  output.push(value);
  Object.values(value).forEach((child) => collectJsonObjects(child, output, depth + 1));
}

function collectSponsorNames(objects: JsonObject[]) {
  const names = new Set<string>();
  for (const object of objects) {
    for (const key of ['sponsor', 'funder']) {
      const values = Array.isArray(object[key]) ? object[key] as unknown[] : [object[key]];
      values.forEach((value) => {
        const name = plainString(value);
        if (name) names.add(name);
      });
    }
  }
  return [...names];
}

const GENERIC_PAGE_LABEL = /^(?:home|welcome|event detail|events?|all events|calendar|schedule|full schedule|tickets?|exhibitors?|vendors?|open class book|waterfront mainstage events)$/i;

function repeatedEventLogoIdentity($: cheerio.CheerioAPI) {
  const counts = new Map<string, { value: string; count: number }>();
  $('img[alt]').each((_, element) => {
    const value = cleanWhitespace($(element).attr('alt') ?? '')
      .replace(/\s+(?:official\s+)?logo$/i, '')
      .trim();
    if (value.length < 5 || value.length > 180) return;
    if (!/\b(?:festival|fair|convention|celebration|carnival|exposition|expo|rodeo)\b/i.test(value)) return;
    const key = value.toLowerCase();
    const existing = counts.get(key);
    counts.set(key, { value, count: (existing?.count ?? 0) + 1 });
  });
  return [...counts.values()]
    .filter((item) => item.count >= 2)
    .sort((left, right) => right.count - left.count || right.value.length - left.value.length)[0]?.value ?? '';
}

function scoreEventNode(node: JsonObject, pageTitle: string, heading: string) {
  const name = plainString(node.name);
  let score = 0;
  if (name) score += 4;
  if (node.startDate) score += 4;
  if (node.endDate) score += 2;
  if (node.location) score += 3;
  if (node.description) score += 1;
  const normalizedName = name.toLowerCase();
  if (normalizedName && pageTitle.toLowerCase().includes(normalizedName)) score += 4;
  if (normalizedName && heading.toLowerCase().includes(normalizedName)) score += 5;
  return score;
}

function locationFromJsonLd(value: unknown) {
  const location = Array.isArray(value) ? value.find((item) => isRecord(item) || typeof item === 'string') : value;
  if (typeof location === 'string') {
    return { locationName: cleanWhitespace(location), street: '', city: '', state: '', postalCode: '' };
  }
  if (!isRecord(location)) {
    return { locationName: '', street: '', city: '', state: '', postalCode: '' };
  }
  const address = Array.isArray(location.address) ? location.address[0] : location.address;
  const addressRecord = isRecord(address) ? address : {};
  const addressText = typeof address === 'string' ? cleanWhitespace(address) : '';
  const locationName = plainString(location.name);
  const street = plainString(addressRecord.streetAddress);
  const city = plainString(addressRecord.addressLocality);
  const state = normalizeState(plainString(addressRecord.addressRegion));
  const postalCode = plainString(addressRecord.postalCode);

  if ((!city || !state) && addressText) {
    const addressMatch = addressText.match(/(?:^|,)\s*([^,]+),\s*(MI|Michigan)(?:\s+\d{5})?\s*$/i);
    return {
      locationName,
      street: addressText,
      city: city || cleanWhitespace(addressMatch?.[1] ?? ''),
      state: state || normalizeState(addressMatch?.[2] ?? ''),
      postalCode,
    };
  }

  return { locationName, street, city, state, postalCode };
}

function locationDisplay(location: ReturnType<typeof locationFromJsonLd>) {
  return [...new Set([
    location.locationName,
    location.street,
    [location.city, location.state, location.postalCode].filter(Boolean).join(' '),
  ].filter(Boolean))].join(', ');
}

function sameOfficialSite(candidate: URL, source: URL) {
  const candidateHost = candidate.hostname.toLowerCase();
  const sourceHost = source.hostname.toLowerCase();
  return candidateHost === sourceHost
    || candidateHost.endsWith(`.${sourceHost}`)
    || sourceHost.endsWith(`.${candidateHost}`);
}

function absoluteOfficialUrl(value: string, sourceUrl: URL) {
  try {
    const url = new URL(value, sourceUrl);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return '';
    if (!sameOfficialSite(url, sourceUrl)) return '';
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function classifyLink(label: string, url: string): EventSourceLinkKind | null {
  const signal = `${label} ${url}`.toLowerCase();
  if (/sponsor|partner|advertis|donat|privacy|cookie|terms(?:-of|-and|\s)|legal/.test(signal)) return null;
  if (/about|history|heritage|our-story|tradition|personali|pageant|queen|court|grand-marshal|parade|gallery|photos?|images?|video/.test(signal)) return 'other';
  if (/lineup|performer|artist|entertainment|vendors?|exhibitors?|marketplace/.test(signal)) return 'lineup';
  if (/\bconcerts?\b/.test(label.toLowerCase())) return 'lineup';
  if (/schedule|calendar|(?:^|[\s/])events?(?:[\s/?#-]|$)|daily-program|contests?|competitions?/.test(signal)) return 'schedule';
  if (/ticket|pass|admission/.test(signal)) return 'tickets';
  if (/register|registration|entry-form/.test(signal)) return 'registration';
  if (/parking|direction|getting-there|plan|visit|travel|map/.test(signal)) return 'plan';
  if (/faq|frequently-asked/.test(signal)) return 'faq';
  if (/rule|policy|policies/.test(signal)) return 'rules';
  return null;
}

function confidenceFor(method: InspectionEvidenceMethod): InspectionConfidence {
  if (method === 'jsonLd') return 'high';
  if (method === 'metadata') return 'medium';
  return 'low';
}

function pushEvidence(
  evidence: EventSourceEvidence[],
  field: EventSourceEvidence['field'],
  value: string,
  method: InspectionEvidenceMethod,
) {
  if (!value) return;
  evidence.push({ field, value, method, confidence: confidenceFor(method) });
}

function metaContent($: cheerio.CheerioAPI, selectors: string[]) {
  for (const selector of selectors) {
    const value = cleanWhitespace($(selector).attr('content') ?? '');
    if (value) return value;
  }
  return '';
}

function parseJsonLd($: cheerio.CheerioAPI) {
  const objects: JsonObject[] = [];
  let invalidBlocks = 0;
  $('script[type="application/ld+json"]').each((_, element) => {
    const raw = ($(element).html() ?? '').trim();
    if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_JSON_LD_BYTES) {
      if (raw) invalidBlocks += 1;
      return;
    }
    try {
      const parsed = JSON.parse(raw.replace(/^\s*<!--|-->\s*$/g, ''));
      collectJsonObjects(parsed, objects);
    } catch {
      invalidBlocks += 1;
    }
  });
  return { objects, invalidBlocks };
}

function usefulOfficialLinks(
  $: cheerio.CheerioAPI,
  sourceUrl: URL,
  sponsorNames: string[],
): EventSourceLink[] {
  const links = new Map<string, EventSourceLink>();
  $('a[href]').each((_, element) => {
    const href = $(element).attr('href') ?? '';
    const url = absoluteOfficialUrl(href, sourceUrl);
    if (!url || url === sourceUrl.toString()) return;
    const rawLabel = cleanWhitespace($(element).text() || $(element).attr('aria-label') || '');
    let label = scrubSponsorReferences(rawLabel, sponsorNames, 100);
    const kind = classifyLink(label, url);
    if (!kind || !label || SPONSOR_LANGUAGE.test(rawLabel)) return;
    if (/^(?:read|view|learn) more\s*>?$|^view\s*>?$/i.test(label)) {
      const pathLabel = new URL(url).pathname
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
      label = pathLabel || `${kind[0].toUpperCase()}${kind.slice(1)}`;
    }
    const existing = links.get(url);
    if (!existing || existing.label.length > label.length) links.set(url, { label, url, kind });
  });

  const priority: Record<EventSourceLinkKind, number> = {
    schedule: 1,
    lineup: 2,
    tickets: 3,
    registration: 4,
    plan: 5,
    faq: 6,
    rules: 7,
    other: 8,
  };
  return [...links.values()]
    .sort((left, right) => priority[left.kind] - priority[right.kind] || left.label.localeCompare(right.label));
}

function contentSegments(
  $: cheerio.CheerioAPI,
  sponsorNames: string[],
): EventSourceContentSegment[] {
  const primaryRoot = $('main, [role="main"]').first();
  const articleRoots = $('article');
  const scope = primaryRoot.length
    ? primaryRoot
    : articleRoots.length === 1
      ? articleRoots.first()
      : $('body');
  const segments: EventSourceContentSegment[] = [];
  const seenCounts = new Map<string, number>();
  let characterCount = 0;

  scope.find('h1,h2,h3,h4,h5,h6,p,li,dt,dd,time').each((_, element) => {
    if (segments.length >= 240 || characterCount >= 60_000) return false;
    const node = $(element);
    // Some event CMS products wrap the entire page in an ASP.NET form.
    if (node.parents('nav,header,footer,[aria-hidden="true"]').length) return;
    const ancestrySignal = node.parents().addBack().map((__, ancestor) => {
      const current = $(ancestor);
      return `${current.attr('id') ?? ''} ${current.attr('class') ?? ''}`;
    }).get().join(' ');
    if (/sponsor|partner|advertis/i.test(ancestrySignal)) return;

    const tagName = element.tagName?.toLowerCase() ?? '';
    const kind: EventSourceContentSegment['kind'] = tagName.startsWith('h')
      ? 'heading'
      : tagName === 'li'
        ? 'listItem'
        : tagName === 'dt' || tagName === 'dd'
          ? 'detail'
          : tagName === 'time'
            ? 'time'
            : 'paragraph';
    const clone = node.clone();
    clone.find('br').replaceWith('\n');
    const rawTexts = clone.text().split(/\n+/).map(cleanWhitespace).filter(Boolean);

    for (const rawText of rawTexts) {
      const text = scrubSponsorReferences(rawText, sponsorNames, 1_000);
      if (text.length < 4) continue;
      const normalized = text.toLowerCase();
      const occurrenceLimit = kind === 'heading' || kind === 'time' ? 4 : 1;
      const occurrenceCount = seenCounts.get(normalized) ?? 0;
      if (occurrenceCount >= occurrenceLimit) continue;

      const remaining = 60_000 - characterCount;
      const bounded = text.slice(0, remaining);
      if (!bounded) return false;
      seenCounts.set(normalized, occurrenceCount + 1);
      segments.push({ kind, text: bounded });
      characterCount += bounded.length;
      if (segments.length >= 240 || characterCount >= 60_000) return false;
    }
  });

  return segments;
}

function candidateConfidence(candidate: EventSourceCandidate, evidence: EventSourceEvidence[]) {
  let score = 0.4;
  if (candidate.name) score += 0.15;
  if (candidate.startDate) score += 0.15;
  if (candidate.city) score += 0.1;
  if (candidate.locationName) score += 0.05;
  if (candidate.description) score += 0.05;
  if (evidence.some((item) => item.method === 'jsonLd')) score += 0.1;
  return Math.min(0.98, Number(score.toFixed(2)));
}

function meaningfulLeadDescription(segments: EventSourceContentSegment[]) {
  const candidates = segments.flatMap((segment, index) => {
    const value = cleanWhitespace(segment.text);
    if (segment.kind !== 'paragraph' || value.length < 45 || value.length > 500) return [];
    if (/https?:|\b(?:sponsor|deadline|required|cannot|rules?|policy|meeting|admission|purchase|register|sign up|book an|click here|phone|fax|email|address)\b/i.test(value)) return [];
    let score = 0;
    if (/\b(?:festival|fair|convention|celebration|carnival|event)\b/i.test(value)) score += 2;
    if (/\b(?:family|music|food|parade|livestock|exhibit|tradition|community|waterfront|arts?)\b/i.test(value)) score += 2;
    if (index < 40) score += 1;
    return score >= 3 ? [{ value, score, index }] : [];
  });
  return candidates
    .sort((left, right) => right.score - left.score || left.index - right.index)[0]?.value ?? '';
}

export function parseOfficialEventSourceHtml(args: {
  html: string;
  requestedUrl: string;
  finalUrl: string;
  fetchedAt?: string;
  downloadedBytes?: number;
}): OfficialEventSourceInspection {
  const $ = cheerio.load(args.html);
  const sourceUrl = new URL(args.finalUrl);
  const rawTitle = metaContent($, [
    'meta[property="og:title"]',
    'meta[name="twitter:title"]',
  ]) || cleanWhitespace($('title').text());
  const rawHeading = cleanWhitespace($('h1').first().text());
  const { objects, invalidBlocks } = parseJsonLd($);
  const sponsorNames = collectSponsorNames(objects);
  const eventNodes = objects.filter(isEventNode);
  const primaryEvent = [...eventNodes]
    .sort((left, right) => scoreEventNode(right, rawTitle, rawHeading) - scoreEventNode(left, rawTitle, rawHeading))[0];

  const sponsorLanguageMatches = args.html.match(/\b(?:sponsor(?:ed|ing|ship|s)?|presented by|powered by|funder)\b/gi)?.length ?? 0;
  const excludedSponsorReferenceCount = sponsorLanguageMatches + sponsorNames.length;
  const title = scrubSponsorReferences(rawTitle, sponsorNames, 180);
  const heading = scrubSponsorReferences(rawHeading, sponsorNames, 180);
  const logoIdentity = scrubSponsorReferences(repeatedEventLogoIdentity($), sponsorNames, 180);
  const metaDescription = scrubSponsorReferences(metaContent($, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]), sponsorNames, 1_200);
  const extractedContent = contentSegments($, sponsorNames);

  const evidence: EventSourceEvidence[] = [];
  const jsonName = scrubSponsorReferences(plainString(primaryEvent?.name), sponsorNames, 180);
  const usefulHeading = GENERIC_PAGE_LABEL.test(heading) ? '' : heading;
  const rawTitleName = title.split(/\s+[|\u2013\u2014]\s+/)[0].trim();
  const titleName = GENERIC_PAGE_LABEL.test(rawTitleName) ? '' : rawTitleName;
  const name = jsonName || usefulHeading || logoIdentity || titleName;
  pushEvidence(evidence, 'name', name, jsonName ? 'jsonLd' : usefulHeading || logoIdentity ? 'html' : 'metadata');

  const metadataDescription = metaContent($, [
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]',
  ]);
  const naturalDates = naturalDateRange(metadataDescription);
  const labeledDates = labeledEventDateRange(extractedContent);
  const boundedContentDates = contentDateRange(extractedContent);
  const jsonStart = normalizeDate(primaryEvent?.startDate);
  const metadataStart = normalizeDate(metaContent($, [
    'meta[property="event:start_time"]',
    'meta[property="og:event:start_time"]',
    'meta[itemprop="startDate"]',
  ]));
  const startDate = jsonStart || metadataStart || labeledDates.startDate || naturalDates.startDate || boundedContentDates.startDate;
  pushEvidence(
    evidence,
    'startDate',
    startDate,
    jsonStart
      ? 'jsonLd'
      : (!metadataStart && (labeledDates.startDate || (boundedContentDates.startDate && !naturalDates.startDate)))
        ? 'html'
        : 'metadata',
  );

  const jsonEnd = normalizeDate(primaryEvent?.endDate);
  const metadataEnd = normalizeDate(metaContent($, [
    'meta[property="event:end_time"]',
    'meta[property="og:event:end_time"]',
    'meta[itemprop="endDate"]',
  ]));
  const endDate = jsonEnd || metadataEnd || labeledDates.endDate || naturalDates.endDate || boundedContentDates.endDate;
  pushEvidence(
    evidence,
    'endDate',
    endDate,
    jsonEnd
      ? 'jsonLd'
      : (!metadataEnd && (labeledDates.endDate || (boundedContentDates.endDate && !naturalDates.endDate)))
        ? 'html'
        : 'metadata',
  );

  const location = locationFromJsonLd(primaryEvent?.location);
  const contentAddress = contentMichiganAddress(extractedContent);
  const contentVenue = contentVenueName(extractedContent);
  if (!location.locationName && contentAddress.locationName) location.locationName = contentAddress.locationName;
  if (!location.locationName && contentVenue) location.locationName = contentVenue;
  if (!location.street && contentAddress.street) location.street = contentAddress.street;
  if (!location.city && contentAddress.city) location.city = contentAddress.city;
  if (!location.state && contentAddress.state) location.state = contentAddress.state;
  if (!location.postalCode && contentAddress.postalCode) location.postalCode = contentAddress.postalCode;
  const naturalLocation = naturalMichiganLocation(metadataDescription);
  if (!location.city && naturalLocation.city) location.city = naturalLocation.city;
  if (!location.state && naturalLocation.state) location.state = naturalLocation.state;
  const locationText = scrubSponsorReferences(locationDisplay(location), sponsorNames, 300);
  pushEvidence(
    evidence,
    'location',
    locationText,
    primaryEvent?.location ? 'jsonLd' : contentAddress.city || contentVenue ? 'html' : 'metadata',
  );

  const jsonDescription = scrubSponsorReferences(plainString(primaryEvent?.description), sponsorNames, 1_200);
  const leadDescription = meaningfulLeadDescription(extractedContent);
  const description = jsonDescription || metaDescription || leadDescription;
  pushEvidence(evidence, 'description', description, jsonDescription ? 'jsonLd' : leadDescription && !metaDescription ? 'html' : 'metadata');

  const rawCanonical = $('link[rel="canonical"]').attr('href') ?? '';
  const canonicalUrl = absoluteOfficialUrl(rawCanonical, sourceUrl) || sourceUrl.toString();
  const sourceName = (GENERIC_PAGE_LABEL.test(title) ? logoIdentity : '') || title || heading || sourceUrl.hostname;
  const sourceExcerpt = (description || [name, startDate, locationText].filter(Boolean).join(' - ')).slice(0, 600);
  const candidate: EventSourceCandidate = {
    name,
    city: location.city,
    state: location.state,
    startDate,
    endDate,
    locationName: location.locationName || locationText,
    description,
    sourceName,
    sourceUrl: canonicalUrl,
    sourceExcerpt,
    confidence: 0,
  };
  candidate.confidence = candidateConfidence(candidate, evidence);
  const warnings: string[] = [];
  if (!candidate.name) warnings.push('No reliable event name was found.');
  if (!candidate.startDate) warnings.push('No reliable event start date was found.');
  if (!candidate.city) warnings.push('No reliable event city was found.');
  if (!candidate.state) warnings.push('No reliable state or region was found.');
  if (candidate.state && !['MI', 'Michigan'].includes(candidate.state)) {
    warnings.push('This source does not appear to describe a Michigan event.');
  }
  if (!eventNodes.length) warnings.push('The page has no Schema.org Event record; metadata fallbacks need closer review.');
  if (invalidBlocks) warnings.push(`${invalidBlocks} JSON-LD block${invalidBlocks === 1 ? '' : 's'} could not be parsed.`);
  if (excludedSponsorReferenceCount) {
    warnings.push(`${excludedSponsorReferenceCount} sponsor reference${excludedSponsorReferenceCount === 1 ? '' : 's'} excluded from the review candidate.`);
  }

  return {
    requestedUrl: args.requestedUrl,
    finalUrl: sourceUrl.toString(),
    canonicalUrl,
    fetchedAt: args.fetchedAt ?? new Date().toISOString(),
    candidate,
    evidence,
    contentSegments: extractedContent,
    usefulLinks: usefulOfficialLinks($, sourceUrl, sponsorNames),
    warnings,
    diagnostics: {
      jsonLdEventCount: eventNodes.length,
      invalidJsonLdBlocks: invalidBlocks,
      excludedSponsorReferenceCount,
      downloadedBytes: args.downloadedBytes ?? Buffer.byteLength(args.html, 'utf8'),
      contentCharacters: extractedContent.reduce((total, segment) => total + segment.text.length, 0),
    },
  };
}

function decodeBody(body: Buffer, encodingHeader: string | undefined) {
  const encoding = (encodingHeader ?? 'identity').split(',')[0].trim().toLowerCase();
  let decoded: Buffer;
  try {
    if (!encoding || encoding === 'identity') decoded = body;
    else if (encoding === 'gzip') decoded = gunzipSync(body, { maxOutputLength: MAX_DECODED_BYTES });
    else if (encoding === 'deflate') decoded = inflateSync(body, { maxOutputLength: MAX_DECODED_BYTES });
    else if (encoding === 'br') decoded = brotliDecompressSync(body, { maxOutputLength: MAX_DECODED_BYTES });
    else throw new Error('unsupported encoding');
  } catch {
    throw new OfficialSourceInspectionError('The source response could not be decoded safely.', 'source_rejected', 422);
  }
  if (decoded.byteLength > MAX_DECODED_BYTES) {
    throw new OfficialSourceInspectionError('The official source page is too large to inspect.', 'source_too_large', 413);
  }
  return decoded;
}

function decodeHtml(body: Buffer, contentType: string | undefined) {
  const charset = contentType?.match(/charset\s*=\s*["']?([^;"'\s]+)/i)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

function requestAddress(url: URL, address: string, family: 4 | 6): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request({
      protocol: url.protocol,
      hostname: address,
      family,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      servername: url.protocol === 'https:' ? url.hostname : undefined,
      rejectUnauthorized: true,
      headers: {
        Host: url.host,
        Accept: 'text/html,application/xhtml+xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.8',
        'Accept-Encoding': 'identity',
        'User-Agent': 'CelebrationAtlasSourceInspector/1.0',
      },
    }, (response) => {
      const status = response.statusCode ?? 0;
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume();
        resolve({ status, headers: response.headers, body: Buffer.alloc(0) });
        return;
      }

      const contentType = String(response.headers['content-type'] ?? '').toLowerCase();
      if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        response.resume();
        reject(new OfficialSourceInspectionError('The source URL did not return an HTML page.', 'source_not_html', 422));
        return;
      }
      const contentLength = Number(response.headers['content-length'] ?? 0);
      if (contentLength > MAX_DOWNLOAD_BYTES) {
        response.resume();
        reject(new OfficialSourceInspectionError('The official source page is too large to inspect.', 'source_too_large', 413));
        return;
      }

      const chunks: Buffer[] = [];
      let bytes = 0;
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.byteLength;
        if (bytes > MAX_DOWNLOAD_BYTES) {
          response.destroy(new OfficialSourceInspectionError('The official source page is too large to inspect.', 'source_too_large', 413));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ status, headers: response.headers, body: Buffer.concat(chunks) }));
      response.on('error', reject);
    });

    request.setTimeout(REQUEST_TIMEOUT_MS, () => request.destroy(new Error('source request timed out')));
    request.on('error', reject);
    request.end();
  });
}

async function downloadOfficialHtml(input: string): Promise<DownloadedHtml> {
  const requestedUrl = input;
  let currentUrl = input;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    let target;
    try {
      target = await resolvePublicSourceTarget(currentUrl);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The source URL is not allowed.';
      throw new OfficialSourceInspectionError(message, 'invalid_source', 400);
    }

    let response: RawResponse | null = null;
    let lastNetworkError: unknown;
    for (const address of target.addresses) {
      try {
        response = await requestAddress(target.url, address.address, address.family);
        break;
      } catch (error) {
        if (error instanceof OfficialSourceInspectionError) throw error;
        lastNetworkError = error;
      }
    }
    if (!response) {
      void lastNetworkError;
      throw new OfficialSourceInspectionError('The official source could not be reached.', 'source_unreachable', 502);
    }

    if (response.status >= 300 && response.status < 400 && response.headers.location) {
      if (redirectCount === MAX_REDIRECTS) {
        throw new OfficialSourceInspectionError('The official source redirected too many times.', 'source_rejected', 422);
      }
      const redirected = new URL(response.headers.location, target.url);
      if (target.url.protocol === 'https:' && redirected.protocol !== 'https:') {
        throw new OfficialSourceInspectionError('An HTTPS source attempted to redirect to an insecure URL.', 'source_rejected', 422);
      }
      currentUrl = redirected.toString();
      continue;
    }

    if (response.status < 200 || response.status >= 300) {
      throw new OfficialSourceInspectionError(`The official source returned HTTP ${response.status}.`, 'source_unreachable', 502);
    }

    const decodedBody = decodeBody(response.body, String(response.headers['content-encoding'] ?? ''));
    return {
      requestedUrl,
      finalUrl: target.url.toString(),
      html: decodeHtml(decodedBody, String(response.headers['content-type'] ?? '')),
      downloadedBytes: response.body.byteLength,
      contentType: String(response.headers['content-type'] ?? 'text/html'),
      responseMetadata: {
        statusCode: response.status,
        redirectCount,
        etag: typeof response.headers.etag === 'string' ? response.headers.etag : null,
        lastModified: typeof response.headers['last-modified'] === 'string' ? response.headers['last-modified'] : null,
        cacheControl: typeof response.headers['cache-control'] === 'string' ? response.headers['cache-control'] : null,
        contentLanguage: typeof response.headers['content-language'] === 'string' ? response.headers['content-language'] : null,
        contentEncoding: typeof response.headers['content-encoding'] === 'string' ? response.headers['content-encoding'] : null,
      },
    };
  }

  throw new OfficialSourceInspectionError('The source could not be inspected.', 'source_rejected', 422);
}

export async function captureOfficialEventSource(url: string): Promise<OfficialEventSourceCapture> {
  const downloaded = await downloadOfficialHtml(url);
  const fetchedAt = new Date().toISOString();
  const inspection = parseOfficialEventSourceHtml({
    ...downloaded,
    fetchedAt,
  });
  return {
    inspection,
    rawHtml: downloaded.html,
    contentHash: createHash('sha256').update(downloaded.html, 'utf8').digest('hex'),
    contentType: downloaded.contentType,
    downloadedBytes: downloaded.downloadedBytes,
    fetchMetadata: {
      parserVersion: 2,
      requestedUrl: downloaded.requestedUrl,
      finalUrl: downloaded.finalUrl,
      ...downloaded.responseMetadata,
    },
  };
}

export async function inspectOfficialEventSource(url: string) {
  return (await captureOfficialEventSource(url)).inspection;
}
