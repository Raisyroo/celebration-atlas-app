import type { AtlasEvent } from './events.ts';
import type { EventProfile } from './eventProfileTypes.ts';
import { normalizeHomeAtlasSearchValue } from './homeAtlasSearch.ts';

const MAX_KNOWLEDGE_LINES_PER_EVENT = 96;
const MAX_KNOWLEDGE_CHARACTERS_PER_EVENT = 12_000;
const MAX_KNOWLEDGE_VALUE_CHARACTERS = 700;
const MAX_MATCH_CUES = 3;
const MAX_MATCH_CUE_CHARACTERS = 54;

const NON_KNOWLEDGE_KEYS = new Set([
  'x',
  'y',
  'src',
  'mediasrc',
  'postersrc',
  'thumbnailsrc',
  'thumbnailoverridesrc',
  'media',
  'cardmedia',
  'hero',
  'publishedDiscovery',
  'coordinatesource',
]);

const QUERY_STOP_WORDS = new Set([
  'a',
  'all',
  'an',
  'and',
  'as',
  'at',
  'can',
  'celebration',
  'celebrations',
  'event',
  'events',
  'festival',
  'festivals',
  'find',
  'for',
  'from',
  'i',
  'in',
  'is',
  'me',
  'near',
  'of',
  'please',
  'show',
  'that',
  'the',
  'to',
  'where',
  'which',
  'with',
]);

export type AtlasSearchKnowledgeDocument = {
  eventId: string;
  name: string;
  aliases: string[];
  location: string;
  latitude: number;
  longitude: number;
  dateRange: AtlasEvent['dateRange'] | EventProfile['dateRange'];
  officialSourceUrls: string[];
  knowledge: string[];
  facts: AtlasSearchKnowledgeFact[];
};

export type AtlasSearchKnowledgeFact = {
  id: string;
  label: string;
  value: string;
  text: string;
};

export type AtlasSearchKnowledgeMatch = {
  eventId: string;
  score: number;
  evidenceFactIds: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function labelPath(path: readonly string[]): string {
  return path
    .filter((part) => !/^\d+$/.test(part))
    .map((part) => part.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase())
    .join(' > ');
}

function shouldSkipKey(key: string): boolean {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  return NON_KNOWLEDGE_KEYS.has(key)
    || NON_KNOWLEDGE_KEYS.has(normalized)
    || normalized.endsWith('id')
    || normalized.endsWith('ids')
    || normalized.includes('sha256');
}

function collectKnowledgeFacts(value: unknown): AtlasSearchKnowledgeFact[] {
  const facts: AtlasSearchKnowledgeFact[] = [];
  const seen = new Set<string>();
  let characterCount = 0;

  const addFact = (
    path: readonly string[],
    rawValue: string | number | boolean,
    displayLabel?: string,
  ) => {
    if (facts.length >= MAX_KNOWLEDGE_LINES_PER_EVENT) return;
    const text = String(rawValue).replace(/\s+/g, ' ').trim();
    if (!text || isUrl(text)) return;
    const label = labelPath(path);
    const line = `${label ? `${label}: ` : ''}${text}`.slice(
      0,
      MAX_KNOWLEDGE_VALUE_CHARACTERS,
    );
    const normalized = normalizeHomeAtlasSearchValue(line);
    if (!normalized || seen.has(normalized)) return;
    if (characterCount + line.length > MAX_KNOWLEDGE_CHARACTERS_PER_EVENT) return;
    seen.add(normalized);
    facts.push({
      id: `fact-${facts.length + 1}`,
      label: displayLabel?.replace(/\s+/g, ' ').trim() || label,
      value: text.slice(0, MAX_KNOWLEDGE_VALUE_CHARACTERS),
      text: line,
    });
    characterCount += line.length;
  };

  const visit = (current: unknown, path: string[], depth: number) => {
    if (
      depth > 9
      || facts.length >= MAX_KNOWLEDGE_LINES_PER_EVENT
      || characterCount >= MAX_KNOWLEDGE_CHARACTERS_PER_EVENT
      || current === null
      || current === undefined
    ) {
      return;
    }

    if (
      typeof current === 'string'
      || typeof current === 'number'
      || typeof current === 'boolean'
    ) {
      addFact(path, current);
      return;
    }

    if (Array.isArray(current)) {
      current.forEach((item, index) => visit(item, [...path, String(index)], depth + 1));
      return;
    }

    if (!isRecord(current)) return;
    const pairedLabel = typeof current.label === 'string'
      ? current.label.trim()
      : typeof current.title === 'string'
        ? current.title.trim()
        : '';
    const pairedValue = typeof current.value === 'string'
      || typeof current.value === 'number'
      || typeof current.value === 'boolean'
      ? current.value
      : typeof current.summary === 'string'
        ? current.summary
        : typeof current.details === 'string'
          ? current.details
          : typeof current.body === 'string'
            ? current.body
            : null;
    if (pairedLabel && pairedValue !== null) {
      addFact([...path, pairedLabel], pairedValue, pairedLabel);
    }

    Object.entries(current).forEach(([key, child]) => {
      if (shouldSkipKey(key)) return;
      visit(child, [...path, key], depth + 1);
    });
  };

  visit(value, [], 0);
  return facts;
}

function getSupplementalSourceUrls(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.sources)) return [];
  return value.sources.flatMap((source) => {
    if (!isRecord(source) || typeof source.url !== 'string' || !isUrl(source.url)) {
      return [];
    }
    return [source.url];
  });
}

export function createAtlasSearchKnowledgeDocuments(args: {
  events: readonly AtlasEvent[];
  profiles: readonly EventProfile[];
  supplementalKnowledgeByEventId?: ReadonlyMap<string, unknown>;
}): AtlasSearchKnowledgeDocument[] {
  const profileById = new Map(args.profiles.map((profile) => [profile.id, profile]));

  return args.events.map((event) => {
    const profile = profileById.get(event.id);
    const supplementalKnowledge = args.supplementalKnowledgeByEventId?.get(event.id);
    const facts = collectKnowledgeFacts({ event, profile, supplementalKnowledge });
    const officialSourceUrls = Array.from(new Set([
      event.officialUrl,
      profile?.officialWebsite,
      ...(profile?.officialSocialLinks?.map((link) => link.url) ?? []),
      ...(profile?.sources.flatMap((source) => source.url ? [source.url] : []) ?? []),
      ...getSupplementalSourceUrls(supplementalKnowledge),
    ].filter((value): value is string => Boolean(value && isUrl(value)))));

    return {
      eventId: event.id,
      name: event.name,
      aliases: Array.from(new Set([
        ...(event.searchAliases ?? []),
        ...(profile?.alternateNames ?? []),
        ...(profile?.historicalNames ?? []),
      ])),
      location: event.location,
      latitude: event.latitude,
      longitude: event.longitude,
      dateRange: profile?.dateRange ?? event.dateRange ?? {
        startDate: 'Unknown',
        displayText: 'Unknown',
        isEstimated: true,
      },
      officialSourceUrls,
      knowledge: facts.map((fact) => fact.text),
      facts,
    };
  });
}

function queryTerms(query: string): string[] {
  return Array.from(new Set(
    normalizeHomeAtlasSearchValue(query)
      .split(' ')
      .filter((token) => token.length >= 3 && !QUERY_STOP_WORDS.has(token)),
  ));
}

function queryPhrases(query: string): string[] {
  const phrases: string[] = [];
  let current: string[] = [];
  for (const token of normalizeHomeAtlasSearchValue(query).split(' ')) {
    if (token.length < 3 || QUERY_STOP_WORDS.has(token)) {
      if (current.length > 0) phrases.push(current.join(' '));
      current = [];
      continue;
    }
    current.push(token);
  }
  if (current.length > 0) phrases.push(current.join(' '));
  return phrases;
}

function tokenRoots(token: string): string[] {
  const roots = new Set([token]);
  if (token.length > 5 && token.endsWith('ing')) roots.add(token.slice(0, -3));
  if (token.length > 4 && token.endsWith('ed')) roots.add(token.slice(0, -2));
  if (token.length > 4 && token.endsWith('es')) roots.add(token.slice(0, -2));
  if (token.length > 3 && token.endsWith('s')) roots.add(token.slice(0, -1));
  return [...roots].filter((root) => root.length >= 3);
}

function factMatchesRoot(fact: AtlasSearchKnowledgeFact, root: string): boolean {
  return normalizeHomeAtlasSearchValue(fact.text).includes(root);
}

function titleCaseIfLowercase(value: string): string {
  if (value !== value.toLowerCase()) return value;
  return value.replace(/\b[a-z]/g, (character) => character.toUpperCase());
}

function cleanCue(value: string): string | null {
  const cue = value
    .replace(/^[\s:;,\-\u2013\u2014]+|[\s:;,\.\-\u2013\u2014]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cue || cue.length > MAX_MATCH_CUE_CHARACTERS) return null;
  return titleCaseIfLowercase(cue);
}

const GENERIC_FACT_LABELS = new Set([
  'body',
  'blurb',
  'description',
  'details',
  'event types',
  'headline',
  'intro',
  'item',
  'items',
  'notes',
  'categories',
  'response',
  'short description',
  'summary',
  'value',
  'why go',
  'plan visit',
]);

function cueFromFact(fact: AtlasSearchKnowledgeFact): string | null {
  const value = fact.value.trim();
  const wordCount = value.split(/\s+/).length;
  if (value.length <= 42 && wordCount <= 6 && !/^https?:/i.test(value)) {
    return cleanCue(value);
  }

  const labelParts = fact.label.split('>').map((part) => part.trim()).filter(Boolean);
  const label = labelParts.at(-1) ?? '';
  if (
    label
    && label.length <= 42
    && !GENERIC_FACT_LABELS.has(normalizeHomeAtlasSearchValue(label))
  ) {
    return cleanCue(label);
  }

  return null;
}

export function deriveAtlasSearchMatchCues(args: {
  query: string;
  document: AtlasSearchKnowledgeDocument;
  evidenceFactIds?: readonly string[];
}): string[] {
  const terms = queryTerms(args.query);
  const evidenceIdSet = new Set(args.evidenceFactIds ?? []);
  const evidenceFacts = evidenceIdSet.size > 0
    ? args.document.facts.filter((fact) => evidenceIdSet.has(fact.id))
    : args.document.facts.filter((fact) =>
        terms.some((term) => tokenRoots(term).some((root) => factMatchesRoot(fact, root))),
      );
  const cues: string[] = [];
  const seen = new Set<string>();
  for (const phrase of queryPhrases(args.query)) {
    const phraseTokens = phrase.split(' ');
    const isSupported = evidenceFacts.some((fact) => {
      const factText = normalizeHomeAtlasSearchValue(fact.text);
      return phraseTokens.every((token) => factText.includes(token));
    });
    if (!isSupported) continue;
    const cue = cleanCue(phrase);
    const normalized = cue ? normalizeHomeAtlasSearchValue(cue) : '';
    if (!cue || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    cues.push(cue);
    if (cues.length >= MAX_MATCH_CUES) return cues;
  }
  if (cues.length > 0) return cues;
  for (const fact of evidenceFacts) {
    const cue = cueFromFact(fact);
    const normalized = cue ? normalizeHomeAtlasSearchValue(cue) : '';
    if (!cue || !normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    cues.push(cue);
    if (cues.length >= MAX_MATCH_CUES) break;
  }
  return cues;
}

/**
 * A generalized no-model fallback. It searches every indexed textual value in
 * the knowledge document instead of a fixed list of event attributes.
 */
export function searchAtlasKnowledgeDocuments(
  query: string,
  documents: readonly AtlasSearchKnowledgeDocument[],
): AtlasSearchKnowledgeMatch[] {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];

  return documents.flatMap((document) => {
    const normalizedDocument = normalizeHomeAtlasSearchValue([
      document.name,
      ...document.aliases,
      document.location,
      ...document.knowledge,
    ].join(' '));
    const matchedRoots = terms.map((term) =>
      tokenRoots(term).find((root) => normalizedDocument.includes(root)),
    );
    if (matchedRoots.some((root) => !root)) return [];

    const nameText = normalizeHomeAtlasSearchValue([
      document.name,
      ...document.aliases,
    ].join(' '));
    const identityMatches = matchedRoots.filter(
      (root) => root && nameText.includes(root),
    ).length;
    const specificity = Math.min(0.24, terms.length * 0.04);
    const score = Math.min(0.98, 0.58 + specificity + identityMatches * 0.08);
    const evidenceFactIds = document.facts
      .map((fact, index) => ({
        fact,
        index,
        matchCount: matchedRoots.filter(
          (root) => root && factMatchesRoot(fact, root),
        ).length,
      }))
      .filter((candidate) => candidate.matchCount > 0)
      .sort(
        (left, right) =>
          right.matchCount - left.matchCount
          || left.fact.value.length - right.fact.value.length
          || left.index - right.index,
      )
      .slice(0, 6)
      .map((candidate) => candidate.fact.id);
    return [{ eventId: document.eventId, score, evidenceFactIds }];
  }).sort((left, right) => right.score - left.score || left.eventId.localeCompare(right.eventId));
}
