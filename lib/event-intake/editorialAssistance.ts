import { createHash } from 'node:crypto';
import type {
  EventPageAudienceGroup,
  EventPageManifest,
  EventPageModuleManifest,
  ScoutSpotlightPose,
} from '../../data/eventPageManifestTypes.ts';
import {
  evaluateEventPageEditorialQuality,
} from '../../data/eventPageEditorialQuality.ts';
import {
  stableStringifyEventPageManifest,
  validateEventPageManifest,
} from '../../data/eventPageManifestValidation.ts';
import type {
  EditorialPlan,
  EventSourceSynthesisInput,
  ModelEditorialReviewSummary,
} from './synthesisTypes.ts';

export const EDITORIAL_PROMPT_VERSION = 'celebration-atlas-editor-v7-full-manifest';
const SPONSOR_LANGUAGE = /\b(?:sponsor(?:ed|ing|ship|s)?|presented by|presenting partner|title partner|powered by|funder)\b/i;
const PERSONAL_CONTACT = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:email|call|text)\s+(?:me|us|the|to)\b/i;
const SPECULATIVE_LANGUAGE = /\b(?:probably|presumably|apparently|we think|likely to|expected to return)\b/i;
const RESEARCH_NARRATION = /\b(?:the\s+(?:[a-z][a-z'-]*\s+){0,3}(?:page|website|site|media kit|source)\s+(?:lists|names|describes|highlights|identifies|shows|frames|notes|says)|official history\b|latest observed(?: site)? evidence\b)/i;

export type EditorialRewriteTarget = {
  id: string;
  purpose: string;
  currentText: string;
  maxLength: number;
};

export type EditorialModelRewrite = {
  target: string;
  text: string;
  sourceSnapshotIds: string[];
};

export type EditorialModelAudienceGroup = {
  id: string;
  title: string;
  tone: 'water' | 'sunset';
  items: string[];
  sourceSnapshotIds: string[];
};

export type EditorialModelSpotlight = {
  title: string;
  body: string;
  scoutPose: ScoutSpotlightPose;
  sourceSnapshotIds: string[];
};

export type EditorialModelOutput = {
  rewrites: EditorialModelRewrite[];
  audienceGroups: EditorialModelAudienceGroup[];
  spotlight: EditorialModelSpotlight | null;
};

export type FullManifestEditorialCitation = {
  path: string;
  sourceSnapshotIds: string[];
};

export type FullManifestEditorialOutput = {
  manifest: EventPageManifest;
  citations: FullManifestEditorialCitation[];
};

export type AnyEditorialModelOutput =
  | EditorialModelOutput
  | FullManifestEditorialOutput;

export type EditorialEvidencePackage = {
  event: {
    name: string;
    location: string;
    dates: string;
    lifecycle: string;
  };
  editorialPlan: {
    mode: string;
    scheduleStatus: string;
    currentEditionYear: number | null;
    referenceYear: number | null;
  };
  sources: Array<{
    snapshotId: string;
    role: string;
    title: string;
    url: string;
    excerpts: string[];
  }>;
  currentProgram: Array<{
    title: string;
    startsAt: string;
    venue: string | null;
    category: string;
    sourceSnapshotId: string;
  }>;
  verifiedClaims: Array<{
    fieldPath: string;
    value: unknown;
    confidence: string;
    sourceSnapshotId: string;
  }>;
  protectedManifest: {
    schemaVersion: EventPageManifest['schemaVersion'];
    id: string;
    eventId: string;
    slug: string;
    lifecycle: EventPageManifest['lifecycle'];
    identity: EventPageManifest['identity'];
    heroAsset: Pick<EventPageManifest['hero'], 'imageSrc' | 'imageAlt' | 'imagePosition' | 'credit'>;
    scheduleItems: EventPageManifest['scheduleItems'];
    sources: EventPageManifest['sources'];
    publishedAt: string;
    reviewedAt: string;
  };
  currentVisitorManifest: EventPageManifest;
};

type RejectedRewrite = {
  target: string;
  reason: string;
};

type ApplyEditorialResult = {
  manifest: EventPageManifest;
  report: ModelEditorialReviewSummary;
  rejected: RejectedRewrite[];
};

const FULL_MANIFEST_CITATION_PATH = /^(?:hero\.tagline|module\.[a-z0-9]+(?:-[a-z0-9]+)*\.(?:headline|summary|subtitle|advisory|notes))$/;
const FACT_SENSITIVE_TERMS = new Set([
  'accessible',
  'accessibility',
  'admission',
  'alcohol',
  'cash',
  'chair',
  'chairs',
  'cooler',
  'coolers',
  'free',
  'hours',
  'parking',
  'pets',
  'restroom',
  'restrooms',
  'shuttle',
  'shuttles',
  'ticket',
  'tickets',
  'wheelchair',
]);

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  const result = value.replace(/\s+/g, ' ').trim();
  return result.length <= maxLength ? result : '';
}

function moduleTarget(moduleId: string, field: string) {
  return `module.${moduleId}.${field}`;
}

export function buildEditorialRewriteTargets(manifest: EventPageManifest): EditorialRewriteTarget[] {
  const targets: EditorialRewriteTarget[] = [{
    id: 'hero.tagline',
    purpose: 'One concrete defining scene or decision hook. Do not repeat the Why Go headline or its experience list.',
    currentText: manifest.hero.tagline,
    maxLength: 190,
  }];

  for (const pageModule of manifest.modules) {
    if (pageModule.type === 'whyGo') {
      targets.push(
        { id: moduleTarget(pageModule.id, 'headline'), purpose: 'A graceful, specific Why Go headline.', currentText: pageModule.headline, maxLength: 180 },
        { id: moduleTarget(pageModule.id, 'summary'), purpose: 'A concise practical overview that adds useful facts instead of restating the hero or headline.', currentText: pageModule.summary, maxLength: 360 },
      );
      if (pageModule.spotlight) {
        targets.push(
          { id: moduleTarget(pageModule.id, 'spotlight.title'), purpose: 'A short Scout Spotlight title.', currentText: pageModule.spotlight.title, maxLength: 100 },
          { id: moduleTarget(pageModule.id, 'spotlight.body'), purpose: 'A memorable source-backed event fact for Scout Spotlight.', currentText: pageModule.spotlight.body, maxLength: 380 },
        );
      }
    }
    if (pageModule.type === 'schedule') {
      targets.push({ id: moduleTarget(pageModule.id, 'subtitle'), purpose: 'A plain-language guide to what the schedule contains.', currentText: pageModule.subtitle, maxLength: 220 });
      if (pageModule.referenceSchedule) {
        targets.push({
          id: moduleTarget(pageModule.id, 'referenceSchedule.summary'),
          purpose: 'A concise explanation of what the historical reference program reveals, without treating it as current.',
          currentText: pageModule.referenceSchedule.summary,
          maxLength: 280,
        });
      }
    }
    if (pageModule.type === 'traditions') {
      targets.push(
        { id: moduleTarget(pageModule.id, 'headline'), purpose: 'A specific headline for the event traditions.', currentText: pageModule.headline, maxLength: 180 },
        { id: moduleTarget(pageModule.id, 'summary'), purpose: 'A concise introduction to the traditions and their evidence status.', currentText: pageModule.summary, maxLength: 320 },
      );
      for (const item of pageModule.items) {
        targets.push(
          { id: moduleTarget(pageModule.id, `item.${item.id}.kicker`), purpose: 'A short category-like kicker.', currentText: item.kicker, maxLength: 50 },
          { id: moduleTarget(pageModule.id, `item.${item.id}.title`), purpose: 'A clear tradition title.', currentText: item.title, maxLength: 100 },
          { id: moduleTarget(pageModule.id, `item.${item.id}.summary`), purpose: 'A source-backed account of this tradition without implying unconfirmed current logistics.', currentText: item.summary, maxLength: 300 },
        );
      }
    }
    if (pageModule.type === 'highlights') {
      targets.push(
        { id: moduleTarget(pageModule.id, 'headline'), purpose: 'A specific headline for the event highlights.', currentText: pageModule.headline, maxLength: 180 },
        { id: moduleTarget(pageModule.id, 'summary'), purpose: 'A concise introduction to the source-backed participant and experience highlights.', currentText: pageModule.summary, maxLength: 320 },
      );
      for (const item of pageModule.items) {
        targets.push(
          { id: moduleTarget(pageModule.id, `item.${item.id}.kicker`), purpose: 'A short category-like kicker.', currentText: item.kicker, maxLength: 50 },
          { id: moduleTarget(pageModule.id, `item.${item.id}.title`), purpose: 'A clear highlight title.', currentText: item.title, maxLength: 100 },
          { id: moduleTarget(pageModule.id, `item.${item.id}.summary`), purpose: 'A concrete source-backed visitor detail that is distinct from the other highlights and keeps the observed edition explicit.', currentText: item.summary, maxLength: 300 },
        );
      }
    }
    if (pageModule.type === 'planVisit') {
      targets.push({ id: moduleTarget(pageModule.id, 'subtitle'), purpose: 'A concise planning introduction without adding logistics.', currentText: pageModule.subtitle, maxLength: 180 });
    }
  }

  for (const suggestion of manifest.scoutSuggestions) {
    targets.push(
      { id: `scout.${suggestion.id}.label`, purpose: 'A natural visitor question.', currentText: suggestion.label, maxLength: 90 },
      { id: `scout.${suggestion.id}.response`, purpose: 'A concise source-backed Scout answer.', currentText: suggestion.response, maxLength: 340 },
    );
  }
  return targets;
}

export function buildBoundedEditorialRewriteTargets(
  manifest: EventPageManifest,
) {
  const targets = buildEditorialRewriteTargets(manifest);
  const quality = evaluateEventPageEditorialQuality(manifest);
  if (quality.ok) return { targets, quality };
  const whyGoId = manifest.modules.find(
    (module) => module.type === 'whyGo',
  )?.id;
  const experienceId = manifest.modules.find(
    (module) => module.type === 'highlights' || module.type === 'traditions',
  )?.id;
  const boundedTargets = targets.filter((target) =>
    target.id === 'hero.tagline'
    || (whyGoId
      && [
        moduleTarget(whyGoId, 'headline'),
        moduleTarget(whyGoId, 'summary'),
      ].includes(target.id))
    || (experienceId
      && (
        [
          moduleTarget(experienceId, 'headline'),
          moduleTarget(experienceId, 'summary'),
        ].includes(target.id)
        || target.id.startsWith(moduleTarget(experienceId, 'item.'))
          && target.id.endsWith('.summary')
      ))
  );
  return {
    targets: boundedTargets.length ? boundedTargets : targets,
    quality,
  };
}

function sourceRoleMap(plan: EditorialPlan) {
  return new Map(plan.sourceRoles.map((source) => [source.snapshotId, source.role]));
}

function usefulSegment(text: string) {
  if (text.length < 12 || SPONSOR_LANGUAGE.test(text) || PERSONAL_CONTACT.test(text)) return false;
  if (/^(?:events?|all upcoming|all events|our picks|fan picks|past events|all categories|log in|read more)$/i.test(text)) return false;
  return true;
}

export function buildEditorialEvidencePackage(
  input: EventSourceSynthesisInput,
  manifest: EventPageManifest,
  plan: EditorialPlan,
): EditorialEvidencePackage {
  const roles = sourceRoleMap(plan);
  const perSourceCharacterBudget = Math.max(
    500,
    Math.min(4_000, Math.floor(30_000 / Math.max(1, input.snapshots.length))),
  );
  const sources = input.snapshots.map((snapshot) => {
    const excerpts: string[] = [];
    let remainingCharacters = perSourceCharacterBudget;
    for (const segment of snapshot.contentSegments ?? []) {
      if (remainingCharacters <= 0 || excerpts.length >= 50) break;
      const value = cleanText(segment.text, 1_000);
      if (!value || !usefulSegment(value)) continue;
      const bounded = value.slice(0, Math.min(remainingCharacters, 700));
      excerpts.push(bounded);
      remainingCharacters -= bounded.length;
    }
    return {
      snapshotId: snapshot.id,
      role: roles.get(snapshot.id) ?? 'other',
      title: snapshot.pageTitle ?? `Official source ${snapshot.sequenceNumber}`,
      url: snapshot.canonicalUrl,
      excerpts,
    };
  });

  const snapshotById = new Map(input.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const currentProgram = input.scheduleCandidates
    .filter((candidate) => candidate.startsAt && candidate.reviewStatus !== 'rejected' && candidate.reviewStatus !== 'superseded')
    .sort((left, right) => `${left.startsAt}:${left.title}`.localeCompare(`${right.startsAt}:${right.title}`))
    .slice(0, 100)
    .flatMap((candidate) => snapshotById.has(candidate.sourceSnapshotId) ? [{
      title: candidate.title,
      startsAt: candidate.startsAt as string,
      venue: candidate.venue,
      category: candidate.category ?? 'community',
      sourceSnapshotId: candidate.sourceSnapshotId,
    }] : []);

  const verifiedClaims = input.claims
    .filter((claim) => claim.reviewStatus !== 'rejected' && claim.reviewStatus !== 'superseded')
    .map((claim) => ({
      fieldPath: claim.fieldPath,
      value: claim.value,
      confidence: claim.confidence,
      sourceSnapshotId: claim.sourceSnapshotId,
    }));

  return {
    event: {
      name: manifest.identity.name,
      location: manifest.identity.location,
      dates: manifest.identity.dateText,
      lifecycle: manifest.lifecycle,
    },
    editorialPlan: {
      mode: plan.mode,
      scheduleStatus: plan.scheduleStatus,
      currentEditionYear: plan.currentEditionYear,
      referenceYear: plan.referenceSchedule?.observedYear ?? null,
    },
    sources,
    currentProgram,
    verifiedClaims,
    protectedManifest: {
      schemaVersion: manifest.schemaVersion,
      id: manifest.id,
      eventId: manifest.eventId,
      slug: manifest.slug,
      lifecycle: manifest.lifecycle,
      identity: structuredClone(manifest.identity),
      heroAsset: {
        imageSrc: manifest.hero.imageSrc,
        imageAlt: manifest.hero.imageAlt,
        ...(manifest.hero.imagePosition ? { imagePosition: manifest.hero.imagePosition } : {}),
        ...(manifest.hero.credit ? { credit: manifest.hero.credit } : {}),
      },
      scheduleItems: structuredClone(manifest.scheduleItems),
      sources: structuredClone(manifest.sources),
      publishedAt: manifest.publishedAt,
      reviewedAt: manifest.reviewedAt,
    },
    currentVisitorManifest: structuredClone(manifest),
  };
}

export function fullManifestEditorialModelJsonSchema(snapshotIds: string[]) {
  return {
    name: 'celebration_atlas_full_manifest_editorial_draft',
    strict: false,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        manifest: { type: 'object' },
        citations: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              path: { type: 'string' },
              sourceSnapshotIds: {
                type: 'array',
                minItems: 1,
                maxItems: 6,
                items: { type: 'string', enum: snapshotIds },
              },
            },
            required: ['path', 'sourceSnapshotIds'],
          },
        },
      },
      required: ['manifest', 'citations'],
    },
  };
}

export function isFullManifestEditorialOutput(
  value: AnyEditorialModelOutput,
): value is FullManifestEditorialOutput {
  return Boolean(
    value
      && typeof value === 'object'
      && 'manifest' in value
      && 'citations' in value,
  );
}

export function editorialModelJsonSchema(targets: EditorialRewriteTarget[], snapshotIds: string[]) {
  return {
    name: 'celebration_atlas_editorial_draft',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        rewrites: {
          type: 'array',
          maxItems: targets.length,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              target: { type: 'string', enum: targets.map((target) => target.id) },
              text: { type: 'string', minLength: 1, maxLength: 600 },
              sourceSnapshotIds: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: { type: 'string', enum: snapshotIds },
              },
            },
            required: ['target', 'text', 'sourceSnapshotIds'],
          },
        },
        audienceGroups: {
          type: 'array',
          maxItems: 2,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              id: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
              title: { type: 'string', minLength: 1, maxLength: 70 },
              tone: { type: 'string', enum: ['water', 'sunset'] },
              items: {
                type: 'array',
                minItems: 2,
                maxItems: 4,
                items: { type: 'string', minLength: 1, maxLength: 150 },
              },
              sourceSnapshotIds: {
                type: 'array',
                minItems: 1,
                maxItems: 4,
                items: { type: 'string', enum: snapshotIds },
              },
            },
            required: ['id', 'title', 'tone', 'items', 'sourceSnapshotIds'],
          },
        },
        spotlight: {
          anyOf: [
            { type: 'null' },
            {
              type: 'object',
              additionalProperties: false,
              properties: {
                title: { type: 'string', minLength: 1, maxLength: 100 },
                body: { type: 'string', minLength: 1, maxLength: 380 },
                scoutPose: { type: 'string', enum: ['resting', 'standing', 'curious', 'running'] },
                sourceSnapshotIds: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 4,
                  items: { type: 'string', enum: snapshotIds },
                },
              },
              required: ['title', 'body', 'scoutPose', 'sourceSnapshotIds'],
            },
          ],
        },
      },
      required: ['rewrites', 'audienceGroups', 'spotlight'],
    },
  };
}

function numericTokens(value: string) {
  return [...value.matchAll(/\b\d[\d,.]*(?:st|nd|rd|th|%|\+)?\b/gi)].map((match) => match[0].toLowerCase());
}

function evidenceTextBySnapshot(input: EventSourceSynthesisInput) {
  const evidence = new Map<string, string[]>();
  const push = (snapshotId: string, value: unknown) => {
    const normalized = typeof value === 'string' ? value : JSON.stringify(value);
    if (!normalized) return;
    const current = evidence.get(snapshotId) ?? [];
    current.push(normalized.toLowerCase());
    evidence.set(snapshotId, current);
  };
  input.snapshots.forEach((snapshot) => {
    push(snapshot.id, snapshot.pageTitle ?? '');
    push(snapshot.id, snapshot.canonicalUrl);
    (snapshot.contentSegments ?? []).forEach((segment) => push(snapshot.id, segment.text));
  });
  input.claims.forEach((claim) => push(claim.sourceSnapshotId, claim.value));
  input.scheduleCandidates.forEach((candidate) => {
    push(candidate.sourceSnapshotId, candidate.title);
    push(candidate.sourceSnapshotId, candidate.startsAt ?? '');
    push(candidate.sourceSnapshotId, candidate.endsAt ?? '');
    push(candidate.sourceSnapshotId, candidate.dateText ?? '');
    push(candidate.sourceSnapshotId, candidate.venue ?? '');
    push(candidate.sourceSnapshotId, candidate.details ?? '');
  });
  return new Map([...evidence].map(([id, values]) => [id, values.join(' ')]));
}

function copyIsGrounded(value: string, sourceSnapshotIds: string[], evidence: Map<string, string>) {
  if (!sourceSnapshotIds.length || sourceSnapshotIds.some((id) => !evidence.has(id))) {
    return { ok: false, reason: 'Unknown or missing source snapshot.' };
  }
  if (SPONSOR_LANGUAGE.test(value)) return { ok: false, reason: 'Sponsor language is not permitted.' };
  if (PERSONAL_CONTACT.test(value)) return { ok: false, reason: 'Personal contact details are not permitted in visitor-facing editorial copy.' };
  if (SPECULATIVE_LANGUAGE.test(value)) return { ok: false, reason: 'Speculative language is not permitted.' };
  if (RESEARCH_NARRATION.test(value)) return { ok: false, reason: 'Research narration belongs in provenance, not visitor-facing copy.' };
  const sourceText = sourceSnapshotIds.map((id) => evidence.get(id) ?? '').join(' ');
  const unsupportedNumber = numericTokens(value).find((token) => !sourceText.includes(token));
  if (unsupportedNumber) return { ok: false, reason: `Numeric claim ${unsupportedNumber} is not present in its cited evidence.` };
  return { ok: true, reason: '' };
}

function normalizedWords(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function copyIsFullyGrounded(
  value: string,
  sourceSnapshotIds: string[],
  evidence: Map<string, string>,
) {
  const grounded = copyIsGrounded(value, sourceSnapshotIds, evidence);
  if (!grounded.ok) return grounded;
  const sourceWords = new Set(normalizedWords(
    sourceSnapshotIds.map((id) => evidence.get(id) ?? '').join(' '),
  ));
  const unsupportedSensitiveTerm = normalizedWords(value).find(
    (word) => FACT_SENSITIVE_TERMS.has(word) && !sourceWords.has(word),
  );
  if (unsupportedSensitiveTerm) {
    return {
      ok: false,
      reason: `Fact-sensitive term ${unsupportedSensitiveTerm} is not present in its cited evidence.`,
    };
  }
  return grounded;
}

function normalizeSourceUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return value.trim().replace(/\/$/, '').toLowerCase();
  }
}

function protectedFullManifestProjection(manifest: EventPageManifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    eventId: manifest.eventId,
    slug: manifest.slug,
    lifecycle: manifest.lifecycle,
    identity: manifest.identity,
    heroAsset: {
      imageSrc: manifest.hero.imageSrc,
      imageAlt: manifest.hero.imageAlt,
      imagePosition: manifest.hero.imagePosition ?? null,
      credit: manifest.hero.credit ?? null,
    },
    scheduleItems: manifest.scheduleItems,
    sources: manifest.sources,
    publishedAt: manifest.publishedAt,
    reviewedAt: manifest.reviewedAt,
  };
}

function protectedScheduleCollections(manifest: EventPageManifest) {
  return manifest.modules
    .filter((module) => module.type === 'schedule')
    .map((module) => ({
      recurringEvents: module.type === 'schedule' ? module.recurringEvents ?? null : null,
      referenceSchedule: module.type === 'schedule' ? module.referenceSchedule ?? null : null,
    }));
}

function publicSourceSnapshotIds(
  sourceIds: string[],
  input: EventSourceSynthesisInput,
  manifest: EventPageManifest,
) {
  const snapshotsByUrl = new Map(
    input.snapshots.map((snapshot) => [
      normalizeSourceUrl(snapshot.canonicalUrl),
      snapshot.id,
    ]),
  );
  const sourcesById = new Map(manifest.sources.map((source) => [source.id, source]));
  const snapshotIds: string[] = [];
  for (const sourceId of sourceIds) {
    const source = sourcesById.get(sourceId);
    if (!source?.url) return [];
    const snapshotId = snapshotsByUrl.get(normalizeSourceUrl(source.url));
    if (!snapshotId) return [];
    snapshotIds.push(snapshotId);
  }
  return [...new Set(snapshotIds)];
}

function validateFullManifestSchedulePresentation(manifest: EventPageManifest) {
  const errors: string[] = [];
  const scheduleTags = new Set(manifest.scheduleItems.flatMap((item) => item.tags));
  const scheduleCategories = new Set(manifest.scheduleItems.map((item) => item.category));
  const scheduleDates = new Set(
    manifest.scheduleItems.map((item) => item.startsAt.slice(0, 10)),
  );
  for (const module of manifest.modules) {
    if (module.type !== 'schedule') continue;
    if (module.includedTags?.some((tag) => !scheduleTags.has(tag))) {
      errors.push(`Schedule module ${module.id} includes an unknown protected schedule tag.`);
    }
    if (module.includedCategories?.some((category) => !scheduleCategories.has(category))) {
      errors.push(`Schedule module ${module.id} includes an unknown protected schedule category.`);
    }
    for (const filter of module.filters) {
      if (filter.mode === 'tag' && (!filter.value || !scheduleTags.has(filter.value))) {
        errors.push(`Schedule filter ${filter.id} does not match a protected schedule tag.`);
      }
      if (
        filter.mode === 'dateRange'
        && (
          !filter.startsOn
          || !filter.endsOn
          || ![...scheduleDates].some(
            (date) => date >= filter.startsOn! && date <= filter.endsOn!,
          )
        )
      ) {
        errors.push(`Schedule filter ${filter.id} does not contain a protected schedule date.`);
      }
    }
  }
  return errors;
}

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function applyFullManifestEditorialOutput(args: {
  parentSynthesisId: string;
  provider: string;
  model: string;
  input: EventSourceSynthesisInput;
  manifest: EventPageManifest;
  output: FullManifestEditorialOutput;
}): ApplyEditorialResult {
  if (!isJsonRecord(args.output.manifest)) {
    throw new Error('The editorial model did not return a complete manifest object.');
  }
  const proposedValidation = validateEventPageManifest(args.output.manifest);
  if (!proposedValidation.ok) {
    throw new Error(`The editorial model did not return a complete valid manifest: ${proposedValidation.errors.join(' ')}`);
  }
  const proposed = structuredClone(proposedValidation.value);
  if (
    stableStringifyEventPageManifest(protectedFullManifestProjection(proposed))
    !== stableStringifyEventPageManifest(protectedFullManifestProjection(args.manifest))
  ) {
    throw new Error('Full-manifest editorial authorship attempted to change protected event facts.');
  }
  if (
    stableStringifyEventPageManifest(protectedScheduleCollections(proposed))
    !== stableStringifyEventPageManifest(protectedScheduleCollections(args.manifest))
  ) {
    throw new Error('Full-manifest editorial authorship attempted to change protected schedule collections.');
  }

  const manifest = structuredClone(proposed);
  const protectedManifest = args.manifest;
  manifest.schemaVersion = protectedManifest.schemaVersion;
  manifest.id = protectedManifest.id;
  manifest.eventId = protectedManifest.eventId;
  manifest.slug = protectedManifest.slug;
  manifest.lifecycle = protectedManifest.lifecycle;
  manifest.identity = structuredClone(protectedManifest.identity);
  manifest.hero.imageSrc = protectedManifest.hero.imageSrc;
  manifest.hero.imageAlt = protectedManifest.hero.imageAlt;
  if (protectedManifest.hero.imagePosition) {
    manifest.hero.imagePosition = protectedManifest.hero.imagePosition;
  } else {
    delete manifest.hero.imagePosition;
  }
  if (protectedManifest.hero.credit) {
    manifest.hero.credit = protectedManifest.hero.credit;
  } else {
    delete manifest.hero.credit;
  }
  manifest.scheduleItems = structuredClone(protectedManifest.scheduleItems);
  manifest.sources = structuredClone(protectedManifest.sources);
  manifest.publishedAt = protectedManifest.publishedAt;
  manifest.reviewedAt = protectedManifest.reviewedAt;

  const validation = validateEventPageManifest(manifest);
  if (!validation.ok) {
    throw new Error(`The full editorial manifest is invalid: ${validation.errors.join(' ')}`);
  }
  const scheduleErrors = validateFullManifestSchedulePresentation(validation.value);
  if (scheduleErrors.length) {
    throw new Error(`The full editorial schedule presentation is invalid: ${scheduleErrors.join(' ')}`);
  }

  const evidence = evidenceTextBySnapshot(args.input);
  const citationMap = new Map<string, string[]>();
  for (const citation of Array.isArray(args.output.citations) ? args.output.citations : []) {
    if (
      !FULL_MANIFEST_CITATION_PATH.test(citation.path)
      || citationMap.has(citation.path)
      || !Array.isArray(citation.sourceSnapshotIds)
      || !citation.sourceSnapshotIds.length
      || citation.sourceSnapshotIds.some((id) => !evidence.has(id))
    ) {
      throw new Error(`Full-manifest editorial citation ${citation.path || '(missing path)'} is invalid.`);
    }
    citationMap.set(citation.path, [...new Set(citation.sourceSnapshotIds)]);
  }

  const groundingErrors: string[] = [];
  const groundSnapshots = (path: string, text: string, snapshotIds: string[]) => {
    const result = copyIsFullyGrounded(text, snapshotIds, evidence);
    if (!result.ok) groundingErrors.push(`${path}: ${result.reason}`);
  };
  const groundPublicSources = (path: string, text: string, sourceIds: string[]) => {
    const snapshotIds = publicSourceSnapshotIds(sourceIds, args.input, manifest);
    if (!snapshotIds.length) {
      groundingErrors.push(`${path}: public source IDs do not resolve to retained snapshots.`);
      return;
    }
    groundSnapshots(path, text, snapshotIds);
  };
  const groundCited = (path: string, text: string) => {
    const snapshotIds = citationMap.get(path) ?? [];
    if (!snapshotIds.length) {
      groundingErrors.push(`${path}: a retained-snapshot citation is required.`);
      return;
    }
    groundSnapshots(path, text, snapshotIds);
  };

  groundCited('hero.tagline', manifest.hero.tagline);
  if (manifest.editionStatus) {
    groundPublicSources(
      'editionStatus',
      `${manifest.editionStatus.label} ${manifest.editionStatus.title} ${manifest.editionStatus.summary}`,
      manifest.editionStatus.sourceIds,
    );
  }
  for (const module of manifest.modules) {
    if (module.type === 'whyGo') {
      groundCited(`module.${module.id}.headline`, module.headline);
      groundCited(`module.${module.id}.summary`, module.summary);
      module.metrics.forEach((metric) => groundPublicSources(
        `module.${module.id}.metric.${metric.id}`,
        `${metric.value} ${metric.label} ${metric.detail ?? ''}`,
        metric.sourceIds,
      ));
      module.audienceGroups.forEach((group) => groundPublicSources(
        `module.${module.id}.audience.${group.id}`,
        `${group.title} ${group.items.join(' ')}`,
        group.sourceIds,
      ));
      if (module.spotlight) {
        groundPublicSources(
          `module.${module.id}.spotlight`,
          `${module.spotlight.title} ${module.spotlight.body}`,
          module.spotlight.sourceIds,
        );
      }
    } else if (module.type === 'schedule') {
      groundCited(`module.${module.id}.subtitle`, module.subtitle);
      if (module.notes?.length) {
        groundCited(`module.${module.id}.notes`, module.notes.join(' '));
      }
    } else if (module.type === 'highlights' || module.type === 'traditions') {
      groundCited(`module.${module.id}.headline`, module.headline);
      groundCited(`module.${module.id}.summary`, module.summary);
      module.items.forEach((item) => groundPublicSources(
        `module.${module.id}.item.${item.id}`,
        `${item.kicker} ${item.title} ${item.summary}`,
        item.sourceIds,
      ));
      if (module.type === 'highlights') {
        module.links?.forEach((link) => {
          const source = manifest.sources.find((item) => item.id === link.sourceId);
          if (
            !source?.url
            || !link.href
            || normalizeSourceUrl(source.url) !== normalizeSourceUrl(link.href)
          ) {
            groundingErrors.push(`module.${module.id}.link.${link.id}: link does not match its retained source.`);
          }
        });
      }
    } else {
      groundCited(`module.${module.id}.subtitle`, module.subtitle);
      if (module.advisory) groundCited(`module.${module.id}.advisory`, module.advisory);
      module.details.forEach((detail) => groundPublicSources(
        `module.${module.id}.detail.${detail.id}`,
        `${detail.label} ${detail.value}`,
        detail.sourceIds,
      ));
      module.links.forEach((link) => {
        const source = manifest.sources.find((item) => item.id === link.sourceId);
        if (!source?.url || !link.href || normalizeSourceUrl(source.url) !== normalizeSourceUrl(link.href)) {
          groundingErrors.push(`module.${module.id}.link.${link.id}: link does not match its retained source.`);
        }
      });
    }
  }
  manifest.scoutSuggestions.forEach((suggestion) => groundPublicSources(
    `scout.${suggestion.id}`,
    `${suggestion.label} ${suggestion.response}`,
    suggestion.sourceIds,
  ));
  manifest.scoutSuggestions.forEach((suggestion) => {
    if (suggestion.command.type !== 'openExternal') return;
    const citedUrls = suggestion.sourceIds.flatMap((sourceId) => {
      const source = manifest.sources.find((item) => item.id === sourceId);
      return source?.url ? [normalizeSourceUrl(source.url)] : [];
    });
    if (!citedUrls.includes(normalizeSourceUrl(suggestion.command.href))) {
      groundingErrors.push(`scout.${suggestion.id}: external action does not match a cited retained source.`);
    }
  });
  if (manifest.primaryAction) {
    const source = manifest.sources.find((item) => item.id === manifest.primaryAction?.sourceId);
    if (
      !source?.url
      || !manifest.primaryAction.href
      || normalizeSourceUrl(source.url) !== normalizeSourceUrl(manifest.primaryAction.href)
    ) {
      groundingErrors.push('primaryAction: link does not match its retained source.');
    }
  }
  if (groundingErrors.length) {
    throw new Error(`Unsupported full-manifest editorial claims were rejected: ${groundingErrors.join(' ')}`);
  }

  const editorialQuality = evaluateEventPageEditorialQuality(validation.value);
  const authoredModules = validation.value.modules.map((module: EventPageModuleManifest) => module.id);
  const whyGo = validation.value.modules.find((module) => module.type === 'whyGo');
  const report: ModelEditorialReviewSummary = {
    parentSynthesisId: args.parentSynthesisId,
    provider: args.provider,
    model: args.model,
    promptVersion: EDITORIAL_PROMPT_VERSION,
    proposedRewriteCount: 1,
    appliedRewriteCount: 1 + authoredModules.length + validation.value.scoutSuggestions.length,
    rejectedRewriteCount: 0,
    changedTargets: [
      'hero',
      'navigation',
      ...authoredModules.map((id) => `module.${id}`),
      ...validation.value.scoutSuggestions.map((item) => `scout.${item.id}`),
    ],
    addedAudienceGroupCount: whyGo?.type === 'whyGo' ? whyGo.audienceGroups.length : 0,
    addedSpotlight: validation.value.modules.some(
      (module) => module.type === 'whyGo' && Boolean(module.spotlight),
    ),
    authoringMode: 'full_manifest',
    authoredModuleIds: authoredModules,
    authoredNavigationIds: validation.value.navigation.map((item) => item.id),
    authoredScoutSuggestionIds: validation.value.scoutSuggestions.map((item) => item.id),
    rejectedClaimCount: 0,
    qualityChecks: {
      immutableFactsLocked: true,
      sourceIdsVerified: true,
      numericClaimsGrounded: true,
      sponsorLanguageExcluded: true,
      researchNarrationExcluded: true,
      spotlightNarrativeSourceRequired: true,
      editorialQualityPassed: editorialQuality.ok,
      manifestValid: validation.ok,
      fullManifestAuthored: true,
      scheduleFactsLocked: true,
      sourceRegistryLocked: true,
      imageReferencesLocked: true,
      allVisitorClaimsGrounded: true,
    },
  };
  return { manifest: validation.value, report, rejected: [] };
}

function hasNarrativeSpotlightSource(sourceSnapshotIds: string[], input: EventSourceSynthesisInput) {
  return sourceSnapshotIds.some((sourceId) => {
    const snapshot = input.snapshots.find((candidate) => candidate.id === sourceId);
    if (!snapshot) return false;
    const sourceIdentity = `${snapshot.sourceKind} ${snapshot.canonicalUrl}`.toLowerCase();
    return !/(?:\bschedule\b|\bcalendar\b|\/events(?:\/|$)|\/concerts(?:\/|$))/.test(sourceIdentity);
  });
}

function applyTarget(manifest: EventPageManifest, target: string, value: string, sourceIds: string[]) {
  if (target === 'hero.tagline') {
    manifest.hero.tagline = value;
    return true;
  }
  const scoutMatch = target.match(/^scout\.([^.]+)\.(label|response)$/);
  if (scoutMatch) {
    const suggestion = manifest.scoutSuggestions.find((item) => item.id === scoutMatch[1]);
    if (!suggestion) return false;
    suggestion[scoutMatch[2] as 'label' | 'response'] = value;
    suggestion.sourceIds = sourceIds;
    return true;
  }
  const moduleMatch = target.match(/^module\.([^.]+)\.(.+)$/);
  if (!moduleMatch) return false;
  const pageModule = manifest.modules.find((item) => item.id === moduleMatch[1]);
  if (!pageModule) return false;
  const field = moduleMatch[2];
  if (field === 'headline' && (pageModule.type === 'whyGo' || pageModule.type === 'traditions' || pageModule.type === 'highlights')) {
    pageModule.headline = value;
    return true;
  }
  if (field === 'summary' && (pageModule.type === 'whyGo' || pageModule.type === 'traditions' || pageModule.type === 'highlights')) {
    pageModule.summary = value;
    return true;
  }
  if (field === 'subtitle' && (pageModule.type === 'schedule' || pageModule.type === 'planVisit')) {
    pageModule.subtitle = value;
    if (pageModule.type === 'schedule') pageModule.sourceIds = sourceIds;
    return true;
  }
  if (field === 'referenceSchedule.summary' && pageModule.type === 'schedule' && pageModule.referenceSchedule) {
    pageModule.referenceSchedule.summary = value;
    pageModule.sourceIds = sourceIds;
    return true;
  }
  if (field === 'spotlight.title' && pageModule.type === 'whyGo' && pageModule.spotlight) {
    pageModule.spotlight.title = value;
    pageModule.spotlight.sourceIds = sourceIds;
    return true;
  }
  if (field === 'spotlight.body' && pageModule.type === 'whyGo' && pageModule.spotlight) {
    pageModule.spotlight.body = value;
    pageModule.spotlight.sourceIds = sourceIds;
    return true;
  }
  const itemMatch = field.match(/^item\.([^.]+)\.(kicker|title|summary)$/);
  if (itemMatch && (pageModule.type === 'traditions' || pageModule.type === 'highlights')) {
    const item = pageModule.items.find((candidate) => candidate.id === itemMatch[1]);
    if (!item) return false;
    item[itemMatch[2] as 'kicker' | 'title' | 'summary'] = value;
    item.sourceIds = sourceIds;
    return true;
  }
  return false;
}

function sourceIdsForSnapshots(
  snapshotIds: string[],
  input: EventSourceSynthesisInput,
  manifest: EventPageManifest,
) {
  const snapshots = new Map(input.snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return [...new Set(snapshotIds.flatMap((snapshotId) => {
    const snapshot = snapshots.get(snapshotId);
    if (!snapshot) return [];
    const source = manifest.sources.find((candidate) => candidate.url === snapshot.canonicalUrl);
    return source ? [source.id] : [];
  }))];
}

function immutableManifestProjection(manifest: EventPageManifest) {
  return {
    schemaVersion: manifest.schemaVersion,
    id: manifest.id,
    eventId: manifest.eventId,
    slug: manifest.slug,
    recipe: manifest.recipe,
    lifecycle: manifest.lifecycle,
    identity: manifest.identity,
    hero: {
      imageSrc: manifest.hero.imageSrc,
      imageAlt: manifest.hero.imageAlt,
      imagePosition: manifest.hero.imagePosition ?? null,
      eyebrow: manifest.hero.eyebrow,
      credit: manifest.hero.credit ?? null,
    },
    editionStatus: manifest.editionStatus ?? null,
    primaryAction: manifest.primaryAction ?? null,
    navigation: manifest.navigation,
    scheduleItems: manifest.scheduleItems,
    sources: manifest.sources,
    publishedAt: manifest.publishedAt,
    reviewedAt: manifest.reviewedAt,
    modules: manifest.modules.map((module) => {
      if (module.type === 'whyGo') return { id: module.id, type: module.type, title: module.title, eyebrow: module.eyebrow, metrics: module.metrics };
      if (module.type === 'schedule') return {
        id: module.id,
        type: module.type,
        title: module.title,
        eyebrow: module.eyebrow,
        includedCategories: module.includedCategories ?? null,
        includedTags: module.includedTags ?? null,
        filters: module.filters,
        recurringEvents: module.recurringEvents ?? null,
        referenceSchedule: module.referenceSchedule ? {
          observedYear: module.referenceSchedule.observedYear,
          title: module.referenceSchedule.title,
          caveat: module.referenceSchedule.caveat,
          groups: module.referenceSchedule.groups,
        } : null,
        notes: module.notes ?? null,
      };
      if (module.type === 'traditions') return {
        id: module.id,
        type: module.type,
        title: module.title,
        eyebrow: module.eyebrow,
        items: module.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          latestObserved: item.latestObserved ?? null,
          currentStatus: item.currentStatus ?? null,
        })),
      };
      if (module.type === 'highlights') return {
        id: module.id,
        type: module.type,
        title: module.title,
        eyebrow: module.eyebrow,
        items: module.items.map((item) => ({
          id: item.id,
          kind: item.kind,
          observedEdition: item.observedEdition ?? null,
        })),
        links: module.links ?? null,
      };
      return { id: module.id, type: module.type, title: module.title, eyebrow: module.eyebrow, details: module.details, links: module.links, advisory: module.advisory ?? null };
    }),
    scoutSuggestions: manifest.scoutSuggestions.map((suggestion) => ({
      id: suggestion.id,
      scopeModuleIds: suggestion.scopeModuleIds,
      command: suggestion.command,
    })),
  };
}

function projectionHash(manifest: EventPageManifest) {
  return createHash('sha256')
    .update(stableStringifyEventPageManifest(immutableManifestProjection(manifest)))
    .digest('hex');
}

export function applyEditorialModelOutput(args: {
  parentSynthesisId: string;
  provider: string;
  model: string;
  input: EventSourceSynthesisInput;
  manifest: EventPageManifest;
  output: EditorialModelOutput;
}): ApplyEditorialResult {
  const manifest = structuredClone(args.manifest);
  const beforeHash = projectionHash(manifest);
  const targets = new Map(buildEditorialRewriteTargets(manifest).map((target) => [target.id, target]));
  const evidence = evidenceTextBySnapshot(args.input);
  const rejected: RejectedRewrite[] = [];
  const changedTargets: string[] = [];
  const seenTargets = new Set<string>();

  for (const rewrite of Array.isArray(args.output.rewrites) ? args.output.rewrites : []) {
    const target = targets.get(rewrite.target);
    if (!target || seenTargets.has(rewrite.target)) {
      rejected.push({ target: rewrite.target, reason: 'Target is unknown or duplicated.' });
      continue;
    }
    seenTargets.add(rewrite.target);
    const value = cleanText(rewrite.text, target.maxLength);
    if (!value) {
      rejected.push({ target: rewrite.target, reason: `Copy is empty or exceeds ${target.maxLength} characters.` });
      continue;
    }
    const grounding = copyIsGrounded(value, rewrite.sourceSnapshotIds, evidence);
    if (!grounding.ok) {
      rejected.push({ target: rewrite.target, reason: grounding.reason });
      continue;
    }
    const sourceIds = sourceIdsForSnapshots(rewrite.sourceSnapshotIds, args.input, manifest);
    if (!sourceIds.length) {
      rejected.push({ target: rewrite.target, reason: 'Cited source snapshots are not available in the public source registry.' });
      continue;
    }
    if (!applyTarget(manifest, rewrite.target, value, sourceIds)) {
      rejected.push({ target: rewrite.target, reason: 'Target could not be applied.' });
      continue;
    }
    changedTargets.push(rewrite.target);
  }

  const whyGo = manifest.modules.find((module) => module.type === 'whyGo');
  let addedAudienceGroupCount = 0;
  if (whyGo?.type === 'whyGo') {
    const groups: EventPageAudienceGroup[] = [];
    for (const group of (Array.isArray(args.output.audienceGroups) ? args.output.audienceGroups : []).slice(0, 2)) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(group.id) || groups.some((candidate) => candidate.id === group.id)) continue;
      const title = cleanText(group.title, 70);
      const items = Array.isArray(group.items) ? group.items.map((item) => cleanText(item, 150)).filter(Boolean).slice(0, 4) : [];
      const copy = [title, ...items].join(' ');
      const grounding = copyIsGrounded(copy, group.sourceSnapshotIds, evidence);
      const sourceIds = sourceIdsForSnapshots(group.sourceSnapshotIds, args.input, manifest);
      if (!title || items.length < 2 || !grounding.ok || !sourceIds.length) continue;
      groups.push({ id: group.id, title, tone: group.tone === 'sunset' ? 'sunset' : 'water', items, sourceIds });
    }
    if (groups.length) {
      whyGo.audienceGroups = groups;
      addedAudienceGroupCount = groups.length;
    }
  }

  let addedSpotlight = false;
  if (whyGo?.type === 'whyGo' && !whyGo.spotlight && args.output.spotlight) {
    const spotlight = args.output.spotlight;
    const title = cleanText(spotlight.title, 100);
    const body = cleanText(spotlight.body, 380);
    const grounding = copyIsGrounded(`${title} ${body}`, spotlight.sourceSnapshotIds, evidence);
    const sourceIds = sourceIdsForSnapshots(spotlight.sourceSnapshotIds, args.input, manifest);
    const hasNarrativeSource = hasNarrativeSpotlightSource(spotlight.sourceSnapshotIds, args.input);
    if (title && body && grounding.ok && sourceIds.length && hasNarrativeSource) {
      whyGo.spotlight = {
        title,
        body,
        scoutPose: ['resting', 'standing', 'curious', 'running'].includes(spotlight.scoutPose) ? spotlight.scoutPose : 'curious',
        sourceIds,
      };
      addedSpotlight = true;
    } else if (!hasNarrativeSource) {
      rejected.push({ target: 'spotlight', reason: 'Scout Spotlights require history or tradition evidence, not schedule-only evidence.' });
    }
  }

  const immutableFactsLocked = beforeHash === projectionHash(manifest);
  const validation = validateEventPageManifest(manifest);
  const editorialQuality = validation.ok
    ? evaluateEventPageEditorialQuality(validation.value)
    : {
        ok: false,
        errors: ['The manifest is structurally invalid.'],
        repetitionPairs: [],
        genericHighlightCount: 0,
      };
  const report: ModelEditorialReviewSummary = {
    parentSynthesisId: args.parentSynthesisId,
    provider: args.provider,
    model: args.model,
    promptVersion: EDITORIAL_PROMPT_VERSION,
    proposedRewriteCount: Array.isArray(args.output.rewrites) ? args.output.rewrites.length : 0,
    appliedRewriteCount: changedTargets.length,
    rejectedRewriteCount: rejected.length,
    changedTargets,
    addedAudienceGroupCount,
    addedSpotlight,
    authoringMode: 'bounded_rewrite',
    qualityChecks: {
      immutableFactsLocked,
      sourceIdsVerified: true,
      numericClaimsGrounded: true,
      sponsorLanguageExcluded: true,
      researchNarrationExcluded: true,
      spotlightNarrativeSourceRequired: true,
      editorialQualityPassed: editorialQuality.ok,
      manifestValid: validation.ok,
    },
  };

  if (!immutableFactsLocked) throw new Error('Editorial assistance attempted to change immutable event facts.');
  return { manifest, report, rejected };
}

export function editorialInputHash(args: {
  parentInputHash: string;
  parentManifest: EventPageManifest;
  model: string;
}) {
  return createHash('sha256').update(JSON.stringify({
    parentInputHash: args.parentInputHash,
    parentManifest: JSON.parse(stableStringifyEventPageManifest(args.parentManifest)),
    promptVersion: EDITORIAL_PROMPT_VERSION,
    model: args.model,
  })).digest('hex');
}
