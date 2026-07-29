import { createHash } from 'node:crypto';
import type {
  EventPageAudienceGroup,
  EventPageManifest,
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

export const EDITORIAL_PROMPT_VERSION = 'celebration-atlas-editor-v6';
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
  let remainingCharacters = 36_000;
  const sources = input.snapshots.map((snapshot) => {
    const excerpts: string[] = [];
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
  };
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
