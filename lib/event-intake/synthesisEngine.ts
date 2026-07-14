import { createHash } from 'node:crypto';
import type { EventPageManifest, EventScheduleCategory } from '../../data/eventPageManifestTypes.ts';
import { validateEventPageManifest } from '../../data/eventPageManifestValidation.ts';
import { getEventPageVisual } from '../../data/eventPageVisuals.ts';
import { buildEditorialPlan, editorialReviewSummary } from './editorialPlanning.ts';
import type {
  EditorialPlan,
  EventSourceSynthesisInput,
  EventSourceSynthesisResult,
  ReconciledAlternative,
  ReconciledEventProfile,
  ReconciledField,
  SourceClaimConfidence,
  SynthesisConflict,
  SynthesisScheduleCandidate,
  SynthesisSourceClaim,
  SynthesisSourceSnapshot,
} from './synthesisTypes.ts';

export const DETERMINISTIC_SYNTHESIS_ENGINE_VERSION = 'deterministic-v10';

const CONFIDENCE_RANK: Record<SourceClaimConfidence, number> = {
  unknown: 0,
  low: 1,
  medium: 2,
  high: 3,
  verified: 4,
};

const REQUIRED_PROFILE_FIELDS = [
  'identity.name',
  'timing.startDate',
  'timing.endDate',
  'location.display',
  'sources.officialUrl',
] as const;

const SPONSOR_LANGUAGE = /\b(?:sponsor(?:ed|ship|s)?|presented by|presenting partner|title partner|powered by)\b/i;
const SCHEDULE_CATEGORIES = new Set<EventScheduleCategory>([
  'registration',
  'fishing',
  'family',
  'music',
  'community',
  'food',
  'awards',
]);

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, canonicalize(value[key])]),
  );
}

export function stableStringifySynthesisInput(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function inputHash(input: EventSourceSynthesisInput, baseManifest?: EventPageManifest) {
  const stableInput = {
    bundle: {
      id: input.bundle.id,
      name: input.bundle.name,
      eventKey: input.bundle.eventKey,
      canonicalEventId: input.bundle.canonicalEventId,
      candidateId: input.bundle.candidateId,
      readyAt: input.bundle.readyAt,
    },
    snapshots: [...input.snapshots].sort((a, b) => a.id.localeCompare(b.id)),
    claims: [...input.claims].sort((a, b) => a.id.localeCompare(b.id)),
    scheduleCandidates: [...input.scheduleCandidates].sort((a, b) => a.id.localeCompare(b.id)),
    approvedVisual: input.approvedVisual ?? null,
    baseManifest: baseManifest ?? null,
  };
  return createHash('sha256').update(stableStringifySynthesisInput(stableInput)).digest('hex');
}

function normalizedClaimValue(claim: SynthesisSourceClaim) {
  const value = typeof claim.value === 'string' ? claim.value.trim() : claim.value;
  if (typeof value !== 'string') return claim.normalizedText.trim().toLowerCase();
  if (claim.fieldPath === 'timing.startDate' || claim.fieldPath === 'timing.endDate') {
    const date = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
    if (date) return date;
  }
  if (claim.fieldPath === 'sources.officialUrl') {
    try {
      const url = new URL(value);
      url.hash = '';
      return url.toString().replace(/\/$/, '').toLowerCase();
    } catch {
      return value.toLowerCase();
    }
  }
  return value.replace(/\s+/g, ' ').toLowerCase();
}

function compareClaims(
  left: SynthesisSourceClaim,
  right: SynthesisSourceClaim,
  snapshotDates: Map<string, number>,
) {
  const reviewRank = (claim: SynthesisSourceClaim) => claim.reviewStatus === 'accepted' ? 2 : 1;
  const comparisons = [
    reviewRank(right) - reviewRank(left),
    CONFIDENCE_RANK[right.confidence] - CONFIDENCE_RANK[left.confidence],
    (right.confidenceScore ?? 0) - (left.confidenceScore ?? 0),
    (snapshotDates.get(right.sourceSnapshotId) ?? 0) - (snapshotDates.get(left.sourceSnapshotId) ?? 0),
  ];
  return comparisons.find((value) => value !== 0) ?? left.id.localeCompare(right.id);
}

function alternativeFromClaims(
  claims: SynthesisSourceClaim[],
  snapshotDates: Map<string, number>,
): ReconciledAlternative {
  const ranked = [...claims].sort((left, right) => compareClaims(left, right, snapshotDates));
  const selected = ranked[0];
  return {
    value: selected.value,
    normalizedText: normalizedClaimValue(selected),
    confidence: selected.confidence,
    confidenceScore: selected.confidenceScore ?? CONFIDENCE_RANK[selected.confidence] / 4,
    claimIds: ranked.map((claim) => claim.id).sort(),
    sourceSnapshotIds: [...new Set(ranked.map((claim) => claim.sourceSnapshotId))].sort(),
  };
}

function setNestedValue(target: JsonRecord, fieldPath: string, value: unknown) {
  const parts = fieldPath.split('.').filter(Boolean);
  let cursor = target;
  parts.forEach((part, index) => {
    if (index === parts.length - 1) {
      cursor[part] = value;
      return;
    }
    const child = cursor[part];
    if (!isRecord(child)) cursor[part] = {};
    cursor = cursor[part] as JsonRecord;
  });
}

function getNestedValue(target: JsonRecord, fieldPath: string): unknown {
  return fieldPath.split('.').reduce<unknown>((value, part) => {
    return isRecord(value) ? value[part] : undefined;
  }, target);
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function safeText(value: unknown): string | undefined {
  if (!hasText(value)) return undefined;
  const text = value.replace(/\s+/g, ' ').trim();
  return SPONSOR_LANGUAGE.test(text) ? undefined : text;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim()))
    : [];
}

function profileHasLocation(values: JsonRecord) {
  return hasText(getNestedValue(values, 'location.display'))
    || (hasText(getNestedValue(values, 'location.city')) && hasText(getNestedValue(values, 'location.state')));
}

export function reconcileEventSourceClaims(input: EventSourceSynthesisInput): {
  profile: ReconciledEventProfile;
  conflicts: SynthesisConflict[];
} {
  const snapshotDates = new Map(
    input.snapshots.map((snapshot) => [snapshot.id, Date.parse(snapshot.fetchedAt) || 0]),
  );
  const groups = new Map<string, SynthesisSourceClaim[]>();
  input.claims
    .filter((claim) => claim.reviewStatus !== 'rejected' && claim.reviewStatus !== 'superseded')
    .forEach((claim) => {
      const claims = groups.get(claim.fieldPath) ?? [];
      claims.push(claim);
      groups.set(claim.fieldPath, claims);
    });

  const values: JsonRecord = {};
  const fields: ReconciledField[] = [];
  const conflicts: SynthesisConflict[] = [];

  [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).forEach(([fieldPath, claims]) => {
    const valueGroups = new Map<string, SynthesisSourceClaim[]>();
    claims.forEach((claim) => {
      const key = normalizedClaimValue(claim);
      const grouped = valueGroups.get(key) ?? [];
      grouped.push(claim);
      valueGroups.set(key, grouped);
    });
    const alternatives = [...valueGroups.values()]
      .map((group) => ({
        value: alternativeFromClaims(group, snapshotDates),
        bestClaim: [...group].sort((left, right) => compareClaims(left, right, snapshotDates))[0],
      }))
      .sort((left, right) => {
        const rank = compareClaims(left.bestClaim, right.bestClaim, snapshotDates);
        if (rank !== 0) return rank;
        return right.value.claimIds.length - left.value.claimIds.length;
      })
      .map((entry) => entry.value);
    const selected = alternatives[0];
    const remaining = alternatives.slice(1);
    setNestedValue(values, fieldPath, selected.value);
    fields.push({ fieldPath, ...selected, alternatives: remaining });
    if (remaining.length) conflicts.push({ fieldPath, selected, alternatives: remaining });
  });

  const resolvedRequiredFieldCount = REQUIRED_PROFILE_FIELDS.filter((field) => {
    if (field === 'location.display') return profileHasLocation(values);
    if (field === 'timing.endDate') {
      return hasText(getNestedValue(values, field)) || hasText(getNestedValue(values, 'timing.startDate'));
    }
    return hasText(getNestedValue(values, field));
  }).length;
  const supportedFieldCount = fields.filter((field) => field.sourceSnapshotIds.length > 1).length;
  const confidenceAverage = fields.length
    ? fields.reduce((total, field) => total + field.confidenceScore, 0) / fields.length
    : 0;
  const completeness = resolvedRequiredFieldCount / REQUIRED_PROFILE_FIELDS.length;
  const score = Math.max(0, Math.min(1, completeness * 0.75 + confidenceAverage * 0.25 - conflicts.length * 0.03));

  return {
    profile: {
      values,
      fields,
      quality: {
        score: Number(score.toFixed(3)),
        requiredFieldCount: REQUIRED_PROFILE_FIELDS.length,
        resolvedRequiredFieldCount,
        supportedFieldCount,
        conflictCount: conflicts.length,
      },
    },
    conflicts,
  };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
}

function dateOnly(value: unknown) {
  if (!hasText(value)) return '';
  return value.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? '';
}

function dateKeyInTimeZone(value: string, timeZone: string) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return dateOnly(value);

  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((candidate) => candidate.type === type)?.value ?? '';
    const year = part('year');
    const month = part('month');
    const day = part('day');
    return year && month && day ? `${year}-${month}-${day}` : dateOnly(value);
  } catch {
    return dateOnly(value);
  }
}

function displayDateRange(startsOn: string, endsOn: string) {
  if (!startsOn) return '';
  const start = new Date(`${startsOn}T12:00:00Z`);
  const end = new Date(`${endsOn || startsOn}T12:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) return startsOn;
  const startMonth = start.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const endMonth = end.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
  const startDay = start.getUTCDate();
  const endDay = end.getUTCDate();
  const startYear = start.getUTCFullYear();
  const endYear = end.getUTCFullYear();
  if (startsOn === (endsOn || startsOn)) return `${startMonth} ${startDay}, ${startYear}`;
  if (startYear === endYear && startMonth === endMonth) {
    return `${startMonth} ${startDay}-${endDay}, ${startYear}`;
  }
  if (startYear === endYear) return `${startMonth} ${startDay}-${endMonth} ${endDay}, ${startYear}`;
  return `${startMonth} ${startDay}, ${startYear}-${endMonth} ${endDay}, ${endYear}`;
}

function displayEventName(evidenceName: string | undefined, bundleName: string | undefined) {
  const candidate = evidenceName ?? bundleName ?? '';
  const withoutEditionYear = candidate.replace(/\s+(?:19|20)\d{2}\s*$/, '').trim();
  const normalizedIdentity = (value: string) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (bundleName && normalizedIdentity(withoutEditionYear) === normalizedIdentity(bundleName)) return bundleName;
  return withoutEditionYear || candidate;
}

function normalizedStateLabel(state: string | undefined) {
  if (!state) return '';
  return /^michigan$/i.test(state) ? 'MI' : state;
}

function displayEventLocation(rawLocation: string | undefined, city: string | undefined, state: string | undefined) {
  if (city) return [city, normalizedStateLabel(state)].filter(Boolean).join(', ');
  if (!rawLocation) return '';
  const parts = rawLocation.split(',').map((part) => part.trim()).filter(Boolean);
  return [...new Set(parts.map((part) => part.toLowerCase()))]
    .map((normalized) => parts.find((part) => part.toLowerCase() === normalized) ?? normalized)
    .join(', ');
}

function preferredVenue(input: EventSourceSynthesisInput, fallback: string | undefined) {
  const planningSnapshotIds = new Set(
    input.snapshots
      .filter((snapshot) => ['plan', 'tickets'].includes(snapshot.sourceKind))
      .map((snapshot) => snapshot.id),
  );
  const planningVenue = input.claims
    .filter((claim) => claim.fieldPath === 'location.venue' && planningSnapshotIds.has(claim.sourceSnapshotId))
    .map((claim) => safeText(claim.value))
    .find((value) => (
      value
      && value.length <= 100
      && !/\b(?:meetings?|held|second|first|monday|tuesday|wednesday|thursday|friday|saturday|sunday|a\.?m\.?|p\.?m\.?)\b/i.test(value)
      && /\b(?:center|hall|park|grounds|plaza|arena|theater|theatre|museum|venue)\b/i.test(value)
    ));
  if (planningVenue) return planningVenue;
  const segmentVenue = input.snapshots
    .filter((snapshot) => planningSnapshotIds.has(snapshot.id))
    .flatMap((snapshot) => snapshot.contentSegments ?? [])
    .map((segment) => segment.text.match(/^(.{2,80}?\b(?:center|hall|park|fairgrounds|plaza|arena|theater|theatre|museum|venue))\b(?=,\s*(?:north|south|east|west|\d))/i)?.[1]?.trim())
    .find(Boolean);
  if (segmentVenue) return segmentVenue;
  if (
    fallback
    && !/^\d/.test(fallback)
    && !/,\s*\d/.test(fallback)
    && !/^(?:fairgrounds?\s+)?(?:address|location|venue)$/i.test(fallback.trim())
  ) return fallback;
  return undefined;
}

function lifecycleForDates(startsOn: string, endsOn: string) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  if (endsOn && endsOn < today) return 'completed';
  if (startsOn && startsOn <= today && (!endsOn || endsOn >= today)) return 'live';
  return 'upcoming';
}

function sourceId(snapshot: SynthesisSourceSnapshot) {
  return `source-${snapshot.sequenceNumber}-${snapshot.contentHash.slice(0, 8)}`;
}

function sourceTitle(snapshot: SynthesisSourceSnapshot) {
  if (snapshot.pageTitle?.trim()) return snapshot.pageTitle.trim();
  try {
    return new URL(snapshot.canonicalUrl).hostname.replace(/^www\./, '');
  } catch {
    return `Official source ${snapshot.sequenceNumber}`;
  }
}

function planLinkLabel(snapshot: SynthesisSourceSnapshot) {
  const signal = `${snapshot.pageTitle ?? ''} ${snapshot.canonicalUrl}`.toLowerCase();
  if (snapshot.sourceKind === 'tickets') return /admission|gate|pass/.test(signal) ? 'Admission' : 'Tickets';
  if (snapshot.sourceKind === 'registration') {
    if (/fair[ -]?book/.test(signal)) return 'Fair Book & entries';
    return /livestock|exhibit|entry|entries/.test(signal) ? 'Entries & registration' : 'Registration';
  }
  if (/carnival|midway|rides?/.test(signal)) return 'Carnival information';
  if (/admission|gate|parking/.test(signal)) return 'Admission & parking';
  return 'Visitor information';
}

function planLinks(snapshots: SynthesisSourceSnapshot[]) {
  const seen = new Set<string>();
  return snapshots
    .filter((snapshot) => ['plan', 'tickets', 'registration'].includes(snapshot.sourceKind))
    .filter((snapshot) => {
      const key = snapshot.canonicalUrl.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 4)
    .map((snapshot) => ({
      id: `plan-link-${snapshot.sequenceNumber}`,
      label: planLinkLabel(snapshot),
      href: snapshot.canonicalUrl,
      type: snapshot.sourceKind === 'tickets'
        ? 'tickets'
        : snapshot.sourceKind === 'registration'
          ? 'registration'
          : 'officialInfo',
      sourceId: sourceId(snapshot),
    }));
}

function categoryForCandidate(candidate: SynthesisScheduleCandidate): EventScheduleCategory {
  if (candidate.category && SCHEDULE_CATEGORIES.has(candidate.category as EventScheduleCategory)) {
    return candidate.category as EventScheduleCategory;
  }
  const signal = `${candidate.title} ${candidate.tags.join(' ')}`.toLowerCase();
  if (/register|check[ -]?in/.test(signal)) return 'registration';
  if (/fish|trout|salmon|walleye|weigh[ -]?in|tournament/.test(signal)) return 'fishing';
  if (/kid|family|youth|child/.test(signal)) return 'family';
  if (/music|band|concert|stage|quartet|orchestra/.test(signal)) return 'music';
  if (/food|dinner|lunch|breakfast|taste/.test(signal)) return 'food';
  if (/award|final|winner|prize/.test(signal)) return 'awards';
  return 'community';
}

function scheduleItems(
  candidates: SynthesisScheduleCandidate[],
  snapshots: SynthesisSourceSnapshot[],
  editionYear?: number,
) {
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  return candidates
    .filter((candidate) => (
      candidate.reviewStatus !== 'rejected'
      && candidate.reviewStatus !== 'superseded'
      && Boolean(candidate.startsAt)
      && (!editionYear || candidate.startsAt?.startsWith(`${editionYear}-`))
      && !SPONSOR_LANGUAGE.test(`${candidate.title} ${candidate.details ?? ''}`)
    ))
    .sort((left, right) => `${left.startsAt}:${left.id}`.localeCompare(`${right.startsAt}:${right.id}`))
    .map((candidate, index) => {
      const snapshot = snapshotMap.get(candidate.sourceSnapshotId);
      const category = categoryForCandidate(candidate);
      return {
        id: slugify(`${candidate.title}-${candidate.startsAt}-${index + 1}`) || `schedule-item-${index + 1}`,
        title: candidate.title.trim(),
        startsAt: candidate.startsAt as string,
        ...(candidate.endsAt ? { endsAt: candidate.endsAt } : {}),
        ...(candidate.venue?.trim() ? { venue: candidate.venue.trim() } : {}),
        category,
        tags: [...new Set([
          category,
          ...candidate.tags.map((tag) => slugify(tag)).filter(Boolean),
        ])],
        ...(candidate.details?.trim() ? { details: candidate.details.trim() } : {}),
        sourceIds: snapshot ? [sourceId(snapshot)] : [],
        confidence: candidate.confidence,
      };
    });
}

function mergedSources(baseManifest: EventPageManifest | undefined, snapshots: SynthesisSourceSnapshot[]) {
  const baseSources = baseManifest ? structuredClone(baseManifest.sources) : [];
  const knownUrls = new Set(baseSources.map((source) => source.url).filter(Boolean));
  const officialHost = (() => {
    const official = snapshots.find((snapshot) => snapshot.sourceKind === 'official_home');
    try {
      return official ? new URL(official.canonicalUrl).hostname.replace(/^www\./, '').toLowerCase() : '';
    } catch {
      return '';
    }
  })();
  snapshots.forEach((snapshot) => {
    if (knownUrls.has(snapshot.canonicalUrl)) return;
    let type: EventPageManifest['sources'][number]['type'] = 'officialWebsite';
    try {
      const host = new URL(snapshot.canonicalUrl).hostname.replace(/^www\./, '').toLowerCase();
      if (officialHost && host !== officialHost && !host.endsWith(`.${officialHost}`)) {
        type = /(?:visit|tourism|chamber|travel|thumbcoast|bluewater|michigan\.org)/i.test(host)
          ? 'tourismBoard'
          : 'other';
      }
    } catch {
      type = 'other';
    }
    baseSources.push({
      id: sourceId(snapshot),
      type,
      title: sourceTitle(snapshot),
      url: snapshot.canonicalUrl,
      accessedAt: snapshot.fetchedAt,
      lastVerifiedAt: snapshot.fetchedAt,
      confidence: 'verified',
      notes: `Archived source snapshot ${snapshot.sequenceNumber}.`,
    });
    knownUrls.add(snapshot.canonicalUrl);
  });
  return baseSources;
}

function sourceIdsForSnapshots(
  snapshotIds: string[],
  snapshots: SynthesisSourceSnapshot[],
  proposalSources: unknown,
) {
  const snapshotMap = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const sources = Array.isArray(proposalSources) ? proposalSources.filter(isRecord) : [];
  return [...new Set(snapshotIds.flatMap((snapshotId) => {
    const snapshot = snapshotMap.get(snapshotId);
    if (!snapshot) return [];
    const matchingSource = sources.find((source) => source.url === snapshot.canonicalUrl);
    return [typeof matchingSource?.id === 'string' ? matchingSource.id : sourceId(snapshot)];
  }))];
}

function applyEditorialPlan(
  proposal: JsonRecord,
  plan: EditorialPlan,
  snapshots: SynthesisSourceSnapshot[],
  hasBaseManifest: boolean,
) {
  const modules = Array.isArray(proposal.modules) ? proposal.modules.filter(isRecord) : [];
  const navigation = Array.isArray(proposal.navigation) ? proposal.navigation.filter(isRecord) : [];
  const schedule = modules.find((module) => module.type === 'schedule');
  const planVisit = modules.find((module) => module.type === 'planVisit');
  const eventName = safeText(getNestedValue(proposal, 'identity.shortName'))
    ?? safeText(getNestedValue(proposal, 'identity.name'))
    ?? 'this event';
  const lifecycle = safeText(proposal.lifecycle) ?? 'upcoming';
  const completedArchive = lifecycle === 'completed' && plan.scheduleStatus === 'completed_archive';

  if (schedule && plan.referenceSchedule) {
    const referenceSourceIds = sourceIdsForSnapshots(
      plan.referenceSchedule.groups.flatMap((group) => (
        group.items.flatMap((item) => item.sourceSnapshotIds)
      )),
      snapshots,
      proposal.sources,
    );
    schedule.title = completedArchive
      ? `${plan.referenceSchedule.observedYear} Program Archive`
      : 'The Festival Weekend';
    schedule.eyebrow = completedArchive
      ? 'Completed edition'
      : 'Current dates confirmed, detailed program pending';
    schedule.subtitle = completedArchive
      ? `Revisit the published ${plan.referenceSchedule.observedYear} program and see how the completed edition unfolded.`
      : `Use the latest complete official program to understand ${eventName}'s rhythm while current-year details develop.`;
    schedule.sourceIds = [...new Set([
      ...stringArray(schedule.sourceIds),
      ...referenceSourceIds,
    ])];
    schedule.referenceSchedule = {
      observedYear: plan.referenceSchedule.observedYear,
      title: `How the weekend unfolded in ${plan.referenceSchedule.observedYear}`,
      summary: completedArchive
        ? 'This official archive preserves the rhythm of the completed edition across its public program.'
        : 'The latest complete official program shows how the event was organized across its days and recurring experiences.',
      caveat: completedArchive
        ? `Every day and time in this section belongs to the completed ${plan.referenceSchedule.observedYear} edition. It is an archive, not a schedule for the next convention.`
        : `All days and times in this section belong to the official ${plan.referenceSchedule.observedYear} program. They are useful reference, not current-year confirmations. Verify the current official schedule before planning around a time, venue, admission detail, or activity.`,
      groups: plan.referenceSchedule.groups.map((group) => ({
        id: group.id,
        label: group.label,
        title: group.title,
        items: group.items.map((item) => ({
          id: item.id,
          title: item.title,
          timeText: item.timeText,
          sourceIds: sourceIdsForSnapshots(item.sourceSnapshotIds, snapshots, proposal.sources),
        })),
      })),
    };
    schedule.notes = completedArchive
      ? [
          `The ${plan.referenceSchedule.observedYear} program is retained for discovery and historical reference.`,
          'Future dates and times will appear only after a new edition is officially confirmed.',
        ]
      : [
          'The detailed current-year program is not yet published.',
          'Historical entries stay in the reference weekend and are never promoted into the current schedule.',
          'Celebration Atlas will replace reference guidance with confirmed current-year items as official details arrive.',
        ];

    if (completedArchive) {
      const scheduleNavigation = navigation.find((item) => item.targetModuleId === safeText(schedule.id));
      if (scheduleNavigation) scheduleNavigation.label = 'Archive';
    }
  }

  if (lifecycle === 'completed') {
    const whyGoNavigation = navigation.find((item) => item.targetModuleId === 'why-go');
    const planNavigation = navigation.find((item) => item.targetModuleId === 'plan');
    if (whyGoNavigation) whyGoNavigation.label = 'Experience';
    if (planNavigation) planNavigation.label = 'Next Time';
    const hero = isRecord(proposal.hero) ? proposal.hero : null;
    const identity = isRecord(proposal.identity) ? proposal.identity : null;
    if (hero) hero.eyebrow = 'Event Archive';
    if (identity && plan.currentEditionYear) identity.edition = `${plan.currentEditionYear} edition archive`;
    if (planVisit && Array.isArray(planVisit.details) && plan.currentEditionYear) {
      const dateDetail = planVisit.details.filter(isRecord).find((detail) => detail.id === 'dates');
      if (dateDetail) dateDetail.label = `${plan.currentEditionYear} edition dates`;
    }

    const updateSnapshot = snapshots.find((snapshot) => (
      snapshot.sourceKind === 'official_home'
      && /\b20\d{2}\s+updates?\s+coming\s+soon\b/i.test(
        (snapshot.contentSegments ?? []).map((segment) => segment.text).join(' '),
      )
    ));
    const updateText = updateSnapshot
      ? (updateSnapshot.contentSegments ?? []).map((segment) => segment.text).join(' ')
      : '';
    const nextEditionYear = updateText.match(/\b(20\d{2})\s+updates?\s+coming\s+soon\b/i)?.[1];
    if (updateSnapshot && nextEditionYear && plan.currentEditionYear) {
      proposal.editionStatus = {
        label: `${plan.currentEditionYear} edition complete`,
        title: `${nextEditionYear} updates are coming soon`,
        summary: `The organizer has begun the transition to ${nextEditionYear}, but new dates have not been published. Explore the completed ${plan.currentEditionYear} edition while Celebration Atlas watches for confirmed updates.`,
        sourceIds: sourceIdsForSnapshots([updateSnapshot.id], snapshots, proposal.sources),
      };
    }
  }

  const existingHighlights = modules.find((module) => module.type === 'highlights');
  const existingTraditions = modules.find((module) => module.type === 'traditions');
  const tattooExperience = /\btattoo\b/i.test(eventName);
  const canAddHighlights = plan.highlights.length >= 3
    && !existingTraditions
    && (!hasBaseManifest || navigation.length < 4 || Boolean(existingHighlights));
  if (canAddHighlights && !existingHighlights) {
    const highlightModule = {
      id: 'highlights',
      type: 'highlights',
      title: 'Highlights',
      eyebrow: lifecycle === 'completed' && plan.currentEditionYear
        ? `${plan.currentEditionYear} edition archive`
        : 'Inside the experience',
      headline: `The people and experiences that shape ${eventName}.`,
      summary: lifecycle === 'completed' && plan.currentEditionYear
        ? `Explore the artist floor, competitions, and creative program preserved from the completed ${plan.currentEditionYear} edition.`
        : 'Explore the creative program, participants, and defining experiences gathered from official event information.',
      items: plan.highlights.map((highlight) => ({
        id: highlight.id,
        kind: highlight.kind,
        kicker: highlight.kicker,
        title: highlight.title,
        summary: highlight.summary,
        ...(highlight.observedEdition ? { observedEdition: highlight.observedEdition } : {}),
        sourceIds: sourceIdsForSnapshots(highlight.sourceSnapshotIds, snapshots, proposal.sources),
      })),
      links: [...new Map(plan.highlights.flatMap((highlight) => (
        highlight.sourceSnapshotIds.flatMap((snapshotId) => {
          const snapshot = snapshots.find((candidate) => candidate.id === snapshotId);
          if (!snapshot || snapshot.sourceKind === 'official_home') return [];
          const sourceId = sourceIdsForSnapshots([snapshotId], snapshots, proposal.sources)[0];
          if (!sourceId) return [];
          const label = highlight.kind === 'artists'
            ? `${plan.currentEditionYear ?? 'Event'} featured artists`
            : snapshot.sourceKind === 'registration' || snapshot.sourceKind === 'plan'
              ? planLinkLabel(snapshot)
              : highlight.kind === 'contests'
                ? 'Competition categories and terms'
                : highlight.kind === 'marketplace'
                  ? `${plan.currentEditionYear ?? 'Event'} vendor directory`
                  : highlight.kind === 'liveArt' || highlight.kind === 'entertainment'
                    ? lifecycle === 'completed' && plan.currentEditionYear
                      ? `${plan.currentEditionYear} entertainment archive`
                      : 'Entertainment details'
                    : 'Official event details';
          return [[snapshot.canonicalUrl, {
            id: `highlight-link-${snapshot.sequenceNumber}`,
            label,
            href: snapshot.canonicalUrl,
            type: 'officialInfo',
            sourceId,
          }]] as const;
        })
      ))).values()].slice(0, 4),
    };
    const planIndex = modules.findIndex((module) => module.type === 'planVisit');
    if (planIndex >= 0) modules.splice(planIndex, 0, highlightModule);
    else modules.push(highlightModule);
    const planNavigationIndex = navigation.findIndex((item) => item.targetModuleId === 'plan');
    const highlightsNavigation = {
      id: 'nav-highlights',
      label: 'Highlights',
      icon: 'artists',
      targetModuleId: 'highlights',
    };
    if (planNavigationIndex >= 0) navigation.splice(planNavigationIndex, 0, highlightsNavigation);
    else navigation.push(highlightsNavigation);

    const whyGo = modules.find((pageModule) => pageModule.type === 'whyGo');
    if (whyGo && tattooExperience) {
      const highlightsByKind = new Map(plan.highlights.map((highlight) => [highlight.kind, highlight]));
      const idsForHighlight = (kind: string) => {
        const highlight = highlightsByKind.get(kind as EditorialPlan['highlights'][number]['kind']);
        return highlight
          ? sourceIdsForSnapshots(highlight.sourceSnapshotIds, snapshots, proposal.sources)
          : [];
      };
      const referenceSourceIds = sourceIdsForSnapshots(
        plan.referenceSchedule?.groups.flatMap((group) => group.items.flatMap((item) => item.sourceSnapshotIds)) ?? [],
        snapshots,
        proposal.sources,
      );
      const artistText = snapshots
        .flatMap((snapshot) => (snapshot.contentSegments ?? []).map((segment) => segment.text))
        .join(' ');
      const artistCount = artistText.match(/(?:over|more than)\s+(\d{2,4})\s+(?:hand[- ]chosen\s+)?tattoo artists?/i)?.[1];
      const referenceGroups = plan.referenceSchedule?.groups ?? [];
      const competitionDays = referenceGroups.filter((group) => (
        group.items.some((item) => /competition|contest/i.test(item.title))
      )).length;
      const metrics: JsonRecord[] = [];
      if (artistCount) {
        metrics.push({
          id: 'metric-artists',
          value: `${artistCount}+`,
          label: 'Invited tattoo artists',
          detail: `Documented for the ${plan.currentEditionYear ?? 'latest'} edition`,
          icon: 'ticket',
          sourceIds: idsForHighlight('artists'),
        });
      }
      if (referenceGroups.length) {
        metrics.push({
          id: 'metric-duration',
          value: `${referenceGroups.length} days`,
          label: plan.currentEditionYear ? `${plan.currentEditionYear} edition` : 'Convention weekend',
          detail: safeText(getNestedValue(proposal, 'identity.dateText')) ?? 'Official program archive',
          icon: 'calendar',
          sourceIds: referenceSourceIds,
        });
      }
      if (competitionDays) {
        metrics.push({
          id: 'metric-competitions',
          value: competitionDays === referenceGroups.length ? 'Daily' : `${competitionDays} days`,
          label: 'Tattoo competitions',
          detail: 'Preserved in the completed program',
          icon: 'trophy',
          sourceIds: idsForHighlight('contests'),
        });
      }
      if (metrics.length) whyGo.metrics = metrics.slice(0, 3);

      whyGo.audienceGroups = [
        {
          id: 'audience-collectors',
          title: 'For tattoo collectors',
          tone: 'water',
          items: [
            'Explore the official roster of invited artists from the completed edition.',
            'See how tattoo competitions shaped each day of the convention program.',
            'Use the artist directory to research styles as the next edition develops.',
          ],
          sourceIds: [...new Set([...idsForHighlight('artists'), ...idsForHighlight('contests')])],
        },
        {
          id: 'audience-art-culture',
          title: 'Beyond the tattoo chair',
          tone: 'sunset',
          items: [
            'Live painting and ArtFusion made the creative process part of the show.',
            'Stage entertainment ran alongside the artist floor throughout the weekend.',
            'An independent vendor marketplace rounded out the convention experience.',
          ],
          sourceIds: [...new Set([
            ...idsForHighlight('liveArt'),
            ...idsForHighlight('entertainment'),
            ...idsForHighlight('marketplace'),
          ])],
        },
      ];

      const historyEntry = plan.sourceRoles.find((entry) => entry.role === 'history');
      const historySnapshot = historyEntry
        ? snapshots.find((snapshot) => snapshot.id === historyEntry.snapshotId)
        : undefined;
      const historySegments = historySnapshot?.contentSegments ?? [];
      const tribute = historySegments.find((segment) => /name Black River.{0,80}tribute/i.test(segment.text));
      const returnStory = historySegments.find((segment) => /honor my roots|rebrand.{0,80}Black River/i.test(segment.text));
      if (historySnapshot && tribute) {
        whyGo.spotlight = {
          title: 'Scout Spotlight: Why Black River',
          body: [tribute.text, returnStory?.text].filter(Boolean).join(' '),
          scoutPose: 'curious',
          sourceIds: sourceIdsForSnapshots([historySnapshot.id], snapshots, proposal.sources),
        };
      }
    }
  }

  const canAddTraditions = plan.traditions.length >= 2
    && !canAddHighlights
    && !existingHighlights
    && (!hasBaseManifest || navigation.length < 4 || Boolean(existingTraditions));
  if (canAddTraditions && !existingTraditions) {
    const traditionsNeedCurrentYearCaveat = plan.scheduleStatus.startsWith('current_pending')
      || plan.scheduleStatus === 'unknown';
    const traditionModule = {
      id: 'traditions',
      type: 'traditions',
      title: 'Traditions',
      eyebrow: 'The stories behind the event',
      headline: `The traditions that give ${eventName} its identity.`,
      summary: traditionsNeedCurrentYearCaveat
        ? 'These enduring traditions shape the festival from year to year. Current-year appearances and timing will be added as the official program is confirmed.'
        : 'These enduring traditions reveal the history and community character behind the event.',
      items: plan.traditions.map((tradition) => ({
        id: tradition.id,
        kind: tradition.kind,
        kicker: tradition.kicker,
        title: tradition.title,
        summary: tradition.summary,
        ...(tradition.latestObserved ? { latestObserved: tradition.latestObserved } : {}),
        currentStatus: tradition.currentStatus,
        sourceIds: sourceIdsForSnapshots(tradition.sourceSnapshotIds, snapshots, proposal.sources),
      })),
    };
    const planIndex = modules.findIndex((module) => module.type === 'planVisit');
    if (planIndex >= 0) modules.splice(planIndex, 0, traditionModule);
    else modules.push(traditionModule);
    const planNavigationIndex = navigation.findIndex((item) => item.targetModuleId === 'plan');
    const traditionNavigation = {
      id: 'nav-traditions',
      label: 'Traditions',
      icon: 'crown',
      targetModuleId: 'traditions',
    };
    if (planNavigationIndex >= 0) navigation.splice(planNavigationIndex, 0, traditionNavigation);
    else navigation.push(traditionNavigation);
  }

  const suggestions = Array.isArray(proposal.scoutSuggestions)
    ? proposal.scoutSuggestions.filter(isRecord)
    : [];
  const suggestionIds = new Set(suggestions.map((suggestion) => suggestion.id));
  if (plan.referenceSchedule && !suggestionIds.has('scout-reference-weekend')) {
    const sourceIds = sourceIdsForSnapshots(
      plan.referenceSchedule.groups.flatMap((group) => group.items.flatMap((item) => item.sourceSnapshotIds)),
      snapshots,
      proposal.sources,
    );
    suggestions.push({
      id: 'scout-reference-weekend',
      label: 'What did the latest full weekend look like?',
      response: lifecycle === 'completed'
        ? `The ${plan.referenceSchedule.observedYear} Archive tab preserves the official program from the completed edition. None of those times are presented as next-edition details.`
        : `The Weekend tab preserves the complete official ${plan.referenceSchedule.observedYear} rhythm as historical reference. None of those times are presented as current-year appointments.`,
      scopeModuleIds: ['schedule'],
      command: { type: 'openModule', moduleId: 'schedule' },
      sourceIds,
    });
  }
  if (canAddTraditions && !suggestionIds.has('scout-traditions')) {
    suggestions.push({
      id: 'scout-traditions',
      label: 'Which traditions define this event?',
      response: 'Explore the pageantry, parades, heritage, and community rituals that give the event continuity from year to year.',
      scopeModuleIds: ['why-go', 'traditions'],
      command: { type: 'openModule', moduleId: 'traditions' },
      sourceIds: sourceIdsForSnapshots(
        plan.traditions.flatMap((tradition) => tradition.sourceSnapshotIds),
        snapshots,
        proposal.sources,
      ),
    });
    suggestionIds.add('scout-traditions');
  }
  if (canAddTraditions && !suggestionIds.has('scout-not-miss')) {
    suggestions.push({
      id: 'scout-not-miss',
      label: 'What should I not miss?',
      response: 'Start with the event traditions, then use the current official schedule to choose the experiences that fit your visit.',
      scopeModuleIds: ['why-go', 'traditions'],
      command: { type: 'openModule', moduleId: 'traditions' },
      sourceIds: sourceIdsForSnapshots(
        plan.traditions.flatMap((tradition) => tradition.sourceSnapshotIds),
        snapshots,
        proposal.sources,
      ),
    });
    suggestionIds.add('scout-not-miss');
  }
  if (canAddHighlights && !suggestionIds.has('scout-highlights')) {
    const highlightSourceIds = sourceIdsForSnapshots(
      plan.highlights.flatMap((highlight) => highlight.sourceSnapshotIds),
      snapshots,
      proposal.sources,
    );
    suggestions.push({
      id: 'scout-highlights',
      label: lifecycle === 'completed' ? 'What defined the latest edition?' : 'What defines this event?',
      response: tattooExperience
        ? lifecycle === 'completed'
          ? 'The Highlights tab preserves the artist floor, competitions, live art, entertainment, and marketplace documented for the completed edition.'
          : 'The Highlights tab brings together the artists and creative experiences that define the event.'
        : lifecycle === 'completed'
          ? 'The Highlights tab preserves the defining experiences documented for the completed edition.'
          : 'The Highlights tab brings together the source-backed experiences that define the event.',
      scopeModuleIds: ['why-go', 'highlights'],
      command: { type: 'openModule', moduleId: 'highlights' },
      sourceIds: highlightSourceIds,
    });
    suggestionIds.add('scout-highlights');
  }
  if (canAddHighlights && !suggestionIds.has('scout-not-miss')) {
    suggestions.push({
      id: 'scout-not-miss',
      label: 'What should I explore first?',
      response: tattooExperience
        ? 'Start with the artist floor and creative program, then use the edition archive to see how the weekend unfolded.'
        : 'Start with the event highlights, then use the schedule to choose the experiences that fit your visit.',
      scopeModuleIds: ['why-go', 'highlights'],
      command: { type: 'openModule', moduleId: 'highlights' },
      sourceIds: sourceIdsForSnapshots(
        plan.highlights.flatMap((highlight) => highlight.sourceSnapshotIds),
        snapshots,
        proposal.sources,
      ),
    });
    suggestionIds.add('scout-not-miss');
  }

  const scheduleItems = Array.isArray(proposal.scheduleItems)
    ? proposal.scheduleItems.filter(isRecord)
    : [];
  const scheduleFilters = schedule && Array.isArray(schedule.filters)
    ? schedule.filters.filter(isRecord)
    : [];
  for (const categorySuggestion of [
    {
      category: 'family',
      id: 'scout-family',
      label: "What's in the family program?",
      response: 'The Family filter gathers the current official youth, competition, and shared family listings in one place.',
    },
    {
      category: 'music',
      id: 'scout-best-music',
      label: 'Where can I find the music lineup?',
      response: 'The Music filter gathers the current official concert and stage listings in one place.',
    },
  ]) {
    if (suggestionIds.has(categorySuggestion.id)) continue;
    const filterId = `category-${categorySuggestion.category}`;
    if (!scheduleFilters.some((filter) => filter.id === filterId)) continue;
    const categoryItems = scheduleItems.filter((item) => item.category === categorySuggestion.category);
    if (!categoryItems.length) continue;
    suggestions.push({
      id: categorySuggestion.id,
      label: categorySuggestion.label,
      response: categorySuggestion.response,
      scopeModuleIds: ['schedule'],
      command: { type: 'filterSchedule', moduleId: safeText(schedule?.id) ?? 'schedule', filterId },
      sourceIds: [...new Set(categoryItems.flatMap((item) => stringArray(item.sourceIds)))],
    });
    suggestionIds.add(categorySuggestion.id);
  }

  proposal.modules = modules;
  proposal.navigation = navigation;
  proposal.scoutSuggestions = suggestions;
}

function buildNewManifest(
  input: EventSourceSynthesisInput,
  profile: ReconciledEventProfile,
): JsonRecord {
  const values = profile.values;
  const evidenceName = safeText(getNestedValue(values, 'identity.name'));
  const bundleName = safeText(input.bundle.name);
  const name = displayEventName(evidenceName, bundleName);
  const eventKey = input.bundle.eventKey ?? slugify(name) ?? '';
  const visual = input.approvedVisual ?? getEventPageVisual(eventKey);
  const startsOn = dateOnly(getNestedValue(values, 'timing.startDate'));
  const endsOn = dateOnly(getNestedValue(values, 'timing.endDate')) || startsOn;
  const city = safeText(getNestedValue(values, 'location.city'));
  const state = safeText(getNestedValue(values, 'location.state'));
  const venue = preferredVenue(input, safeText(getNestedValue(values, 'location.venue')));
  const location = displayEventLocation(
    safeText(getNestedValue(values, 'location.display')),
    city,
    state,
  );
  const planLocation = [venue, location].filter(Boolean).join(', ');
  const description = safeText(getNestedValue(values, 'identity.description')) ?? '';
  const timezone = safeText(getNestedValue(values, 'timing.timezone')) ?? '';
  const sources = mergedSources(undefined, input.snapshots);
  const generatedSchedule = scheduleItems(input.scheduleCandidates, input.snapshots, Number(startsOn.slice(0, 4)) || undefined);
  const scheduleCategories = [...new Set(generatedSchedule.map((item) => item.category))];
  const scheduleFilters = [
    { id: 'all', label: 'All', mode: 'all' },
    ...scheduleCategories.slice(0, 6).map((category) => ({
      id: `category-${category}`,
      label: `${category[0].toUpperCase()}${category.slice(1)}`,
      mode: 'tag',
      value: category,
    })),
  ];
  const sourceDate = [...input.snapshots]
    .map((snapshot) => dateKeyInTimeZone(snapshot.fetchedAt, timezone))
    .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
    .sort()
    .at(-1) ?? '1970-01-01';
  const visitorLinks = planLinks(input.snapshots);
  const sourceIds = sources.length ? [sources[0].id] : [];
  const locationSourceIds = sourceIdsForSnapshots(
    input.claims.filter((claim) => claim.fieldPath.startsWith('location.')).map((claim) => claim.sourceSnapshotId),
    input.snapshots,
    sources,
  );
  const dateSourceIds = sourceIdsForSnapshots(
    input.claims.filter((claim) => claim.fieldPath === 'timing.startDate' || claim.fieldPath === 'timing.endDate').map((claim) => claim.sourceSnapshotId),
    input.snapshots,
    sources,
  );

  return {
    schemaVersion: 1,
    id: eventKey ? `event-page-${eventKey}` : '',
    eventId: eventKey,
    slug: eventKey,
    recipe: startsOn && endsOn !== startsOn ? 'multiDayFestival' : 'simpleEvent',
    lifecycle: lifecycleForDates(startsOn, endsOn),
    identity: {
      name,
      shortName: name,
      location,
      ...(venue ? { venue } : {}),
      dateText: displayDateRange(startsOn, endsOn),
      startsOn,
      endsOn,
      timezone,
    },
    hero: {
      imageSrc: visual?.imageSrc ?? '',
      imageAlt: visual?.imageAlt ?? '',
      ...(visual?.imagePosition ? { imagePosition: visual.imagePosition } : {}),
      eyebrow: 'Event Hub',
      tagline: description,
      ...(visual?.credit ? { credit: visual.credit } : {}),
    },
    navigation: [
      { id: 'nav-why-go', label: 'Why Go', icon: 'sparkles', targetModuleId: 'why-go' },
      { id: 'nav-schedule', label: 'Schedule', icon: 'schedule', targetModuleId: 'schedule' },
      { id: 'nav-plan', label: 'Plan', icon: 'plan', targetModuleId: 'plan' },
    ],
    modules: [
      {
        id: 'why-go',
        type: 'whyGo',
        title: 'Why Go',
        eyebrow: 'Official event overview',
        headline: description || name,
        summary: description,
        metrics: [],
        audienceGroups: [],
      },
      {
        id: 'schedule',
        type: 'schedule',
        title: 'Schedule',
        eyebrow: 'Official program',
        subtitle: generatedSchedule.length ? 'Source-backed event times.' : 'Schedule details need review.',
        filters: scheduleFilters,
      },
      {
        id: 'plan',
        type: 'planVisit',
        title: 'Plan Your Visit',
        eyebrow: 'Before you go',
        subtitle: planLocation || 'Location details need review.',
        details: [
          ...(planLocation ? [{ id: 'location', label: 'Location', value: planLocation, icon: 'mapPin', sourceIds: locationSourceIds.length ? locationSourceIds : sourceIds }] : []),
          ...(displayDateRange(startsOn, endsOn) ? [{ id: 'dates', label: 'Dates', value: displayDateRange(startsOn, endsOn), icon: 'clock', sourceIds: dateSourceIds.length ? dateSourceIds : sourceIds }] : []),
        ],
        links: visitorLinks,
        advisory: 'Confirm final details with the official event source before traveling.',
      },
    ],
    scheduleItems: generatedSchedule,
    scoutSuggestions: [],
    sources,
    publishedAt: sourceDate,
    reviewedAt: sourceDate,
  };
}

function overlayProfileOnManifest(
  baseManifest: EventPageManifest,
  input: EventSourceSynthesisInput,
  profile: ReconciledEventProfile,
): JsonRecord {
  const manifest = structuredClone(baseManifest) as unknown as JsonRecord;
  const identity = manifest.identity as JsonRecord;
  const hero = manifest.hero as JsonRecord;
  const values = profile.values;
  const name = displayEventName(
    safeText(getNestedValue(values, 'identity.name')),
    safeText(baseManifest.identity.name),
  );
  const startsOn = dateOnly(getNestedValue(values, 'timing.startDate'));
  const endsOn = dateOnly(getNestedValue(values, 'timing.endDate')) || startsOn;
  const city = safeText(getNestedValue(values, 'location.city'));
  const state = safeText(getNestedValue(values, 'location.state'));
  const location = displayEventLocation(
    safeText(getNestedValue(values, 'location.display')),
    city,
    state,
  ) || undefined;
  const venue = preferredVenue(input, safeText(getNestedValue(values, 'location.venue')));
  const timezone = safeText(getNestedValue(values, 'timing.timezone'));
  const description = safeText(getNestedValue(values, 'identity.description'));

  if (name) identity.name = name;
  if (location) identity.location = location;
  if (venue) identity.venue = venue;
  if (startsOn) identity.startsOn = startsOn;
  if (endsOn) identity.endsOn = endsOn;
  if (startsOn) identity.dateText = displayDateRange(startsOn, endsOn);
  if (timezone) identity.timezone = timezone;
  if (description) hero.tagline = description;
  if (input.approvedVisual) {
    hero.imageSrc = input.approvedVisual.imageSrc;
    hero.imageAlt = input.approvedVisual.imageAlt;
    if (input.approvedVisual.imagePosition) hero.imagePosition = input.approvedVisual.imagePosition;
    else delete hero.imagePosition;
    if (input.approvedVisual.credit) hero.credit = input.approvedVisual.credit;
  }

  const baseItems = Array.isArray(manifest.scheduleItems) ? manifest.scheduleItems : [];
  const additions = scheduleItems(input.scheduleCandidates, input.snapshots, Number(startsOn.slice(0, 4)) || undefined);
  const knownSchedule = new Set(baseItems.map((item) => {
    if (!isRecord(item)) return '';
    return `${String(item.title ?? '').toLowerCase()}|${String(item.startsAt ?? '')}`;
  }));
  manifest.scheduleItems = [
    ...baseItems,
    ...additions.filter((item) => !knownSchedule.has(`${item.title.toLowerCase()}|${item.startsAt}`)),
  ];
  manifest.sources = mergedSources(baseManifest, input.snapshots);
  return manifest;
}

function proposalMissingFields(
  proposal: JsonRecord,
  input: EventSourceSynthesisInput,
  hasBaseManifest: boolean,
) {
  const missing: string[] = [];
  if (!hasText(getNestedValue(proposal, 'identity.name'))) missing.push('identity.name');
  if (!hasText(getNestedValue(proposal, 'identity.startsOn'))) missing.push('timing.startDate');
  if (!hasText(getNestedValue(proposal, 'identity.endsOn'))) missing.push('timing.endDate');
  if (!hasText(getNestedValue(proposal, 'identity.location'))) missing.push('location.display');
  if (!hasText(getNestedValue(proposal, 'identity.timezone'))) missing.push('timing.timezone');
  if (!hasText(getNestedValue(proposal, 'hero.tagline'))) missing.push('identity.description');
  if (!hasText(getNestedValue(proposal, 'hero.imageSrc'))) missing.push('media.heroImage');
  const sources = proposal.sources;
  if (!Array.isArray(sources) || !sources.some((source) => isRecord(source) && hasText(source.url))) {
    missing.push('sources.officialUrl');
  }
  if (!hasBaseManifest && !input.bundle.eventKey) missing.push('identity.eventKey');
  return [...new Set(missing)];
}

export function synthesizeEventSourceBundle(
  input: EventSourceSynthesisInput,
  baseManifest?: EventPageManifest,
): EventSourceSynthesisResult {
  const { profile, conflicts } = reconcileEventSourceClaims(input);
  const editorialPlan = buildEditorialPlan(input, profile.values);
  profile.editorialPlan = editorialPlan;
  const proposal = baseManifest
    ? overlayProfileOnManifest(baseManifest, input, profile)
    : buildNewManifest(input, profile);
  applyEditorialPlan(proposal, editorialPlan, input.snapshots, Boolean(baseManifest));
  const missingFields = proposalMissingFields(proposal, input, Boolean(baseManifest));
  const validation = validateEventPageManifest(proposal);
  const warnings = [...validation.warnings, ...editorialPlan.warnings];
  if (!baseManifest && !hasText(getNestedValue(proposal, 'hero.imageSrc'))) {
    warnings.push('No checked-in Event Hub manifest or registered Celebration Atlas visual was available as a visual-content scaffold.');
  }
  if (conflicts.length) warnings.push(`${conflicts.length} conflicting source field${conflicts.length === 1 ? '' : 's'} need operator review.`);
  const excludedScheduleCount = input.scheduleCandidates.filter((candidate) => (
    candidate.reviewStatus !== 'rejected'
    && candidate.reviewStatus !== 'superseded'
    && !candidate.startsAt
  )).length;
  if (excludedScheduleCount) warnings.push(`${excludedScheduleCount} schedule candidate${excludedScheduleCount === 1 ? '' : 's'} lacked a start time and remained outside the manifest proposal.`);
  const excludedSponsorClaimCount = profile.fields.filter((field) => (
    typeof field.value === 'string' && SPONSOR_LANGUAGE.test(field.value)
  )).length;
  if (excludedSponsorClaimCount) warnings.push(`${excludedSponsorClaimCount} sponsor-bearing field${excludedSponsorClaimCount === 1 ? '' : 's'} remained in evidence but was excluded from generated display copy.`);

  const completeness = Math.max(0, 1 - missingFields.length / 9);
  const qualityScore = Math.max(
    0,
    Math.min(1, profile.quality.score * 0.55 + completeness * 0.45 - conflicts.length * 0.02),
  );
  profile.quality.score = Number(qualityScore.toFixed(3));

  return {
    engineKind: 'deterministic',
    engineVersion: DETERMINISTIC_SYNTHESIS_ENGINE_VERSION,
    inputHash: inputHash(input, baseManifest),
    reconciledProfile: profile,
    conflicts,
    missingFields,
    manifestProposal: validation.ok ? validation.value : proposal,
    validationReport: {
      errors: validation.errors,
      warnings: [...new Set(warnings)],
      missingFields,
      editorial: editorialReviewSummary(editorialPlan),
    },
    isManifestValid: validation.ok,
    qualityScore: Number(qualityScore.toFixed(3)),
  };
}
