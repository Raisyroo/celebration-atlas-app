import assert from 'node:assert/strict';
import { BROWN_TROUT_EVENT_PAGE_MANIFEST } from '../data/brownTroutEventPageManifest.ts';
import type { EventPageManifest } from '../data/eventPageManifestTypes.ts';
import {
  reconcileEventSourceClaims,
  synthesizeEventSourceBundle,
} from '../lib/event-intake/synthesisEngine.ts';
import { buildEditorialPlan } from '../lib/event-intake/editorialPlanning.ts';
import { applyEditorialModelOutput } from '../lib/event-intake/editorialAssistance.ts';
import type { EventSourceSynthesisInput } from '../lib/event-intake/synthesisTypes.ts';

const input: EventSourceSynthesisInput = {
  bundle: {
    id: 'bundle-1',
    name: 'Michigan Brown Trout Festival',
    status: 'ready_for_synthesis',
    eventKey: 'alpena-brown-trout',
    canonicalEventId: null,
    candidateId: null,
    readyAt: '2026-07-10T12:00:00.000Z',
  },
  snapshots: [
    {
      id: 'snapshot-older',
      sequenceNumber: 1,
      sourceKind: 'official_home',
      canonicalUrl: 'https://example.com/festival',
      pageTitle: 'Festival home',
      contentHash: 'a'.repeat(64),
      fetchedAt: '2026-07-09T12:00:00.000Z',
    },
    {
      id: 'snapshot-newer',
      sequenceNumber: 2,
      sourceKind: 'schedule',
      canonicalUrl: 'https://example.com/festival/schedule',
      pageTitle: 'Festival schedule',
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-07-10T12:00:00.000Z',
    },
  ],
  claims: [
    {
      id: 'claim-name-accepted',
      sourceSnapshotId: 'snapshot-older',
      fieldPath: 'identity.name',
      value: 'Michigan Brown Trout Festival',
      normalizedText: 'michigan brown trout festival',
      confidence: 'high',
      confidenceScore: 0.9,
      extractionMethod: 'operator',
      reviewStatus: 'accepted',
      createdAt: '2026-07-09T12:00:00.000Z',
    },
    {
      id: 'claim-name-newer',
      sourceSnapshotId: 'snapshot-newer',
      fieldPath: 'identity.name',
      value: 'Brown Trout Festival',
      normalizedText: 'brown trout festival',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'json_ld',
      reviewStatus: 'unreviewed',
      createdAt: '2026-07-10T12:00:00.000Z',
    },
    {
      id: 'claim-start',
      sourceSnapshotId: 'snapshot-newer',
      fieldPath: 'timing.startDate',
      value: '2026-07-17',
      normalizedText: '2026-07-17',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'json_ld',
      reviewStatus: 'unreviewed',
      createdAt: '2026-07-10T12:00:00.000Z',
    },
    {
      id: 'claim-end',
      sourceSnapshotId: 'snapshot-newer',
      fieldPath: 'timing.endDate',
      value: '2026-07-26',
      normalizedText: '2026-07-26',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'json_ld',
      reviewStatus: 'unreviewed',
      createdAt: '2026-07-10T12:00:00.000Z',
    },
    {
      id: 'claim-location',
      sourceSnapshotId: 'snapshot-older',
      fieldPath: 'location.display',
      value: 'Alpena, Michigan',
      normalizedText: 'alpena, michigan',
      confidence: 'high',
      confidenceScore: 0.9,
      extractionMethod: 'json_ld',
      reviewStatus: 'unreviewed',
      createdAt: '2026-07-09T12:00:00.000Z',
    },
    {
      id: 'claim-location-rejected',
      sourceSnapshotId: 'snapshot-newer',
      fieldPath: 'location.display',
      value: 'Detroit, Michigan',
      normalizedText: 'detroit, michigan',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'html',
      reviewStatus: 'rejected',
      createdAt: '2026-07-10T12:00:00.000Z',
    },
    {
      id: 'claim-url',
      sourceSnapshotId: 'snapshot-older',
      fieldPath: 'sources.officialUrl',
      value: 'https://example.com/festival/',
      normalizedText: 'https://example.com/festival/',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'metadata',
      reviewStatus: 'unreviewed',
      createdAt: '2026-07-09T12:00:00.000Z',
    },
    {
      id: 'claim-description-sponsored',
      sourceSnapshotId: 'snapshot-older',
      fieldPath: 'identity.description',
      value: 'A waterfront festival presented by Example Corp.',
      normalizedText: 'a waterfront festival presented by example corp.',
      confidence: 'high',
      confidenceScore: 0.9,
      extractionMethod: 'metadata',
      reviewStatus: 'unreviewed',
      createdAt: '2026-07-09T12:00:00.000Z',
    },
  ],
  scheduleCandidates: [],
};

const reconciled = reconcileEventSourceClaims(input);
const name = reconciled.profile.fields.find((field) => field.fieldPath === 'identity.name');
assert.equal(name?.value, 'Michigan Brown Trout Festival', 'an accepted claim must outrank a newer unreviewed claim');
assert.equal(reconciled.conflicts.length, 1, 'distinct active claims should preserve one visible conflict');
assert.equal(reconciled.conflicts[0].fieldPath, 'identity.name');
assert.equal(
  reconciled.conflicts.some((conflict) => conflict.fieldPath === 'location.display'),
  false,
  'rejected claims must not create synthesis conflicts',
);

const withoutScaffold = synthesizeEventSourceBundle(input);
assert.equal(withoutScaffold.isManifestValid, false, 'a new event without required visual fields must stay incomplete');
assert(withoutScaffold.missingFields.includes('media.heroImage'));
assert(
  withoutScaffold.validationReport.warnings.some((warning) => warning.includes('sponsor-bearing')),
  'sponsor-bearing evidence should be retained but excluded from display copy',
);

const withApprovedVisual = synthesizeEventSourceBundle({
  ...input,
  approvedVisual: {
    workflowId: 'visual-workflow-1',
    imageSrc: 'https://media.example/alpena-brown-trout/hero.png',
    imageAlt: 'A brown trout leaping beside Alpena waterfront festivities at sunset.',
    credit: 'Celebration Atlas artwork',
    contentHash: 'f'.repeat(64),
  },
});
assert.equal(
  (withApprovedVisual.manifestProposal as EventPageManifest).hero.imageSrc,
  'https://media.example/alpena-brown-trout/hero.png',
  'approved visual workflows should supply the scalable Event Hub hero',
);
assert.equal(withApprovedVisual.missingFields.includes('media.heroImage'), false);

const withScaffold = synthesizeEventSourceBundle(input, BROWN_TROUT_EVENT_PAGE_MANIFEST);
assert.equal(withScaffold.isManifestValid, true, 'a valid checked-in scaffold should remain valid after evidence overlays');
assert.equal(withScaffold.conflicts.length, 1);
assert.equal(
  (withScaffold.manifestProposal as EventPageManifest).identity.name,
  'Michigan Brown Trout Festival',
);

const reversed = synthesizeEventSourceBundle({
  ...input,
  bundle: { ...input.bundle, status: 'draft_ready' },
  snapshots: [...input.snapshots].reverse(),
  claims: [...input.claims].reverse(),
}, BROWN_TROUT_EVENT_PAGE_MANIFEST);
assert.equal(withScaffold.inputHash, reversed.inputHash, 'input hash must not depend on row order or the post-generation bundle status');

const editorialInput: EventSourceSynthesisInput = {
  ...input,
  bundle: {
    ...input.bundle,
    id: 'bundle-editorial',
    name: 'Romeo Peach Festival',
    eventKey: 'romeo-peach-festival',
  },
  snapshots: [
    {
      id: 'editorial-home',
      sequenceNumber: 1,
      sourceKind: 'official_home',
      canonicalUrl: 'https://festival.example/',
      pageTitle: 'Romeo Peach Festival',
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-07-12T12:00:00.000Z',
      contentSegments: [],
    },
    {
      id: 'editorial-schedule',
      sequenceNumber: 2,
      sourceKind: 'schedule',
      canonicalUrl: 'https://festival.example/schedule-of-events/',
      pageTitle: 'Schedule of Events',
      contentHash: 'd'.repeat(64),
      fetchedAt: '2026-07-12T12:00:00.000Z',
      contentSegments: [
        { kind: 'paragraph', text: "WE'RE WORKING ON THE 2026 SCHEDULE - CHECK BACK SOON" },
        { kind: 'paragraph', text: 'THURSDAY, AUGUST 28 - MONDAY, SEPTEMBER 1, 2025' },
        { kind: 'heading', text: 'Recurring Events' },
        { kind: 'paragraph', text: '8 a.m. - 6 p.m. (Thursday-Monday) Westview Orchards Market and Peach-y Treats Tent 65075 Van Dyke, Washington' },
        { kind: 'paragraph', text: '10 a.m. - 5 p.m. (Saturday-Monday) Peachy Keen Craft Show 66600 Van Dyke, Washington' },
        { kind: 'heading', text: 'Thursday, August 28' },
        { kind: 'paragraph', text: '4 p.m. - 11 p.m. Mid America Carnival Rides Romeo Lions Field, Romeo' },
        { kind: 'paragraph', text: '4:45 p.m. Metro Electric 33rd Annual Peach Festival 5K/10K Run Romeo Middle School' },
        { kind: 'paragraph', text: '6:30 p.m. - 9:30 p.m. L and L Products Concert Series Live Music Romeo Lions Clubhouse' },
        { kind: 'heading', text: 'Labor Day Monday, September 1' },
        { kind: 'paragraph', text: "10 a.m. Children's Parade Main Street in Downtown Romeo" },
        { kind: 'paragraph', text: '1:30 p.m. Romeo Peach Festival Hometown Parade Main Street' },
      ],
    },
    {
      id: 'editorial-history',
      sequenceNumber: 3,
      sourceKind: 'other',
      canonicalUrl: 'https://festival.example/about-us/',
      pageTitle: 'About the Festival',
      contentHash: 'e'.repeat(64),
      fetchedAt: '2026-07-12T12:00:00.000Z',
      contentSegments: [
        { kind: 'paragraph', text: 'The festival started back in 1931. The Peach Queen Pageant took shape, and the court rode on huge floats decorated with flowers. Hence, the Floral Parade got its name. A Juvenile Parade was added for local children.' },
        { kind: 'paragraph', text: 'Every Labor Day weekend brings events around the prized peach crop, including parades, bed races, orchard visits, and craft shows.' },
      ],
    },
    {
      id: 'editorial-personalities',
      sequenceNumber: 4,
      sourceKind: 'other',
      canonicalUrl: 'https://festival.example/personalities/',
      pageTitle: '2025 Festival Personalities',
      contentHash: 'f'.repeat(64),
      fetchedAt: '2026-07-12T12:00:00.000Z',
      contentSegments: [
        { kind: 'heading', text: '2025 Michigan Peach Queen' },
        { kind: 'heading', text: '2025 Grand Marshal' },
        { kind: 'paragraph', text: 'The 2025 festival personalities also include Lil Miss Peach Blossom, Mr. Peachy King, and an honored citizen.' },
      ],
    },
  ],
  claims: input.claims.map((claim) => (
    claim.fieldPath === 'timing.startDate'
      ? { ...claim, sourceSnapshotId: 'editorial-home', value: '2026-09-03', normalizedText: '2026-09-03' }
      : claim.fieldPath === 'timing.endDate'
        ? { ...claim, sourceSnapshotId: 'editorial-home', value: '2026-09-07', normalizedText: '2026-09-07' }
        : { ...claim, sourceSnapshotId: 'editorial-home' }
  )),
  scheduleCandidates: [],
};

const editorialReconciled = reconcileEventSourceClaims(editorialInput);
const editorialPlan = buildEditorialPlan(editorialInput, editorialReconciled.profile.values);
assert.equal(editorialPlan.mode, 'reference_rich_festival');
assert.equal(editorialPlan.scheduleStatus, 'current_pending_with_reference');
assert.equal(editorialPlan.referenceSchedule?.observedYear, 2025);
assert.equal(editorialPlan.referenceSchedule?.groups.length, 3);
assert.equal(
  editorialPlan.referenceSchedule?.groups.reduce((total, group) => total + group.items.length, 0),
  7,
  'the historical reference parser should retain the complete fixture program',
);
assert(editorialPlan.traditions.length >= 5, 'history and personalities pages should create rich tradition coverage');
assert.deepEqual(editorialPlan.recommendedTabs, ['why-go', 'schedule', 'traditions', 'plan']);
assert.equal(editorialPlan.qualityChecks.truthLayersSeparated, true);
assert.equal(editorialPlan.qualityChecks.currentScheduleProtected, true);

const cherryTraditionsInput: EventSourceSynthesisInput = {
  ...editorialInput,
  bundle: {
    ...editorialInput.bundle,
    name: 'National Cherry Festival',
    eventKey: 'national-cherry-festival',
  },
  snapshots: [
    {
      id: 'cherry-home',
      sequenceNumber: 1,
      sourceKind: 'official_home',
      canonicalUrl: 'https://cherry.example/',
      pageTitle: 'National Cherry Festival',
      contentHash: '1'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
      contentSegments: [],
    },
    {
      id: 'cherry-history',
      sequenceNumber: 2,
      sourceKind: 'other',
      canonicalUrl: 'https://cherry.example/media-kit',
      pageTitle: 'Festival History',
      contentHash: '2'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
      contentSegments: [
        { kind: 'paragraph', text: 'The festival began as a showcase for the cherry industry and remains rooted in regional agricultural heritage.' },
      ],
    },
    {
      id: 'cherry-traditions',
      sequenceNumber: 3,
      sourceKind: 'other',
      canonicalUrl: 'https://cherry.example/traditions',
      pageTitle: 'Traditions',
      contentHash: '3'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
      contentSegments: [
        { kind: 'listItem', text: 'National Cherry Queen Program and Junior Royalty' },
        { kind: 'listItem', text: 'National Cherry Festival Marching Band, Fine Art Competition, and Very Cherry Awards' },
      ],
    },
    {
      id: 'cherry-parades',
      sequenceNumber: 4,
      sourceKind: 'other',
      canonicalUrl: 'https://cherry.example/events/parades',
      pageTitle: 'Parades',
      contentHash: '4'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
      contentSegments: [
        { kind: 'paragraph', text: 'Festival Foundation Parades highlight the local community and celebrate the cherry industry.' },
      ],
    },
  ],
  scheduleCandidates: [],
};
const cherryPlan = buildEditorialPlan(cherryTraditionsInput, editorialReconciled.profile.values);
assert(cherryPlan.traditions.length >= 4, 'General festival evidence should create royalty, parade, harvest, and program traditions.');
assert(cherryPlan.recommendedTabs.includes('traditions'), 'A tradition-rich festival should receive a dedicated navigation tab.');
const cherrySynthesis = synthesizeEventSourceBundle(cherryTraditionsInput);
assert.equal(
  (cherrySynthesis.manifestProposal as EventPageManifest).hero.imageSrc,
  '/event-media/national-cherry/national-cherry-hero-v1.webp',
  'A registered Celebration Atlas visual should complete a generated Event Hub hero.',
);
assert(!cherrySynthesis.missingFields.includes('media.heroImage'), 'A registered hero visual should clear the media readiness gate.');

const cherryPlanLinksInput: EventSourceSynthesisInput = {
  ...cherryTraditionsInput,
  snapshots: [
    ...cherryTraditionsInput.snapshots,
    {
      id: 'cherry-admission',
      sequenceNumber: 5,
      sourceKind: 'tickets',
      canonicalUrl: 'https://cherry.example/admission',
      pageTitle: 'Admission',
      contentHash: '5'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
    },
    {
      id: 'cherry-fairbook',
      sequenceNumber: 6,
      sourceKind: 'registration',
      canonicalUrl: 'https://cherry.example/fairbook/registration-livestock',
      pageTitle: 'Fairbook Registration & Livestock',
      contentHash: '6'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
    },
    {
      id: 'cherry-carnival',
      sequenceNumber: 7,
      sourceKind: 'plan',
      canonicalUrl: 'https://cherry.example/carnival',
      pageTitle: 'Carnival',
      contentHash: '7'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
    },
  ],
};
const cherryPlanLinks = (synthesizeEventSourceBundle(cherryPlanLinksInput).manifestProposal as EventPageManifest).modules
  .find((module) => module.type === 'planVisit');
assert(cherryPlanLinks?.type === 'planVisit');
assert.deepEqual(
  cherryPlanLinks.links.map((link) => link.label),
  ['Admission', 'Fair Book & entries', 'Carnival information'],
  'Generated Event Hubs should retain distinct, useful planning links.',
);

const countyFairInput: EventSourceSynthesisInput = {
  bundle: {
    id: 'bundle-county-fair',
    name: 'St. Clair County 4-H & Youth Fair',
    status: 'ready_for_synthesis',
    eventKey: 'st-clair-county-4-h-youth-fair',
    canonicalEventId: null,
    candidateId: null,
    readyAt: '2026-07-14T12:00:00.000Z',
  },
  snapshots: [
    {
      id: 'fair-home',
      sequenceNumber: 1,
      sourceKind: 'official_home',
      canonicalUrl: 'https://fair.example/',
      pageTitle: 'St Clair County 4-H & Youth Fair',
      contentHash: '8'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [{ kind: 'heading', text: 'The Best Family Fair in Michigan' }],
    },
    {
      id: 'fair-admission',
      sequenceNumber: 2,
      sourceKind: 'tickets',
      canonicalUrl: 'https://fair.example/admission',
      pageTitle: 'Admission',
      contentHash: '9'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [{ kind: 'paragraph', text: 'Goodells County Park, North Gate, 8231 Lapeer Road, Goodells, MI 48027' }],
    },
    {
      id: 'fair-book',
      sequenceNumber: 3,
      sourceKind: 'registration',
      canonicalUrl: 'https://fair.example/fairbook/registration-livestock',
      pageTitle: 'Fairbook Registration & Livestock',
      contentHash: 'a'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [
        { kind: 'heading', text: 'Creative Writing: Email writing to fair@example.com' },
        { kind: 'heading', text: 'Live Animal Projects' },
        { kind: 'listItem', text: 'Beef cattle, dairy cattle, goats, horse and pony, poultry, rabbits, sheep, and swine.' },
        { kind: 'heading', text: 'Still Exhibit Projects' },
        { kind: 'listItem', text: 'Arts, creative writing, horticulture, needlework, photography, and woodworking.' },
      ],
    },
    {
      id: 'fair-carnival',
      sequenceNumber: 4,
      sourceKind: 'plan',
      canonicalUrl: 'https://fair.example/carnival',
      pageTitle: 'Carnival',
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [{ kind: 'paragraph', text: 'Carnival midway rides run throughout fair week, with advance mega passes available.' }],
    },
    {
      id: 'fair-schedule',
      sequenceNumber: 5,
      sourceKind: 'schedule',
      canonicalUrl: 'https://tourism.example/county-fair',
      pageTitle: 'St. Clair County 4-H Fair July 20-25',
      contentHash: 'c'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [{ kind: 'listItem', text: 'Rodeo, monster trucks, truck pull, bump n run, and stock derby.' }],
    },
  ],
  claims: [
    {
      id: 'fair-name', sourceSnapshotId: 'fair-home', fieldPath: 'identity.name', value: 'St Clair County 4-H & Youth Fair', normalizedText: 'st clair county 4-h & youth fair', confidence: 'high', confidenceScore: 0.9, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-start', sourceSnapshotId: 'fair-home', fieldPath: 'timing.startDate', value: '2026-07-20', normalizedText: '2026-07-20', confidence: 'high', confidenceScore: 0.9, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-end', sourceSnapshotId: 'fair-home', fieldPath: 'timing.endDate', value: '2026-07-25', normalizedText: '2026-07-25', confidence: 'high', confidenceScore: 0.9, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-location', sourceSnapshotId: 'fair-admission', fieldPath: 'location.display', value: 'Goodells, Michigan', normalizedText: 'goodells, michigan', confidence: 'high', confidenceScore: 0.9, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-city', sourceSnapshotId: 'fair-admission', fieldPath: 'location.city', value: 'Goodells', normalizedText: 'goodells', confidence: 'high', confidenceScore: 0.9, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-state', sourceSnapshotId: 'fair-admission', fieldPath: 'location.state', value: 'MI', normalizedText: 'mi', confidence: 'high', confidenceScore: 0.9, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-venue', sourceSnapshotId: 'fair-admission', fieldPath: 'location.venue', value: 'FAIRGROUNDS ADDRESS', normalizedText: 'fairgrounds address', confidence: 'low', confidenceScore: 0.45, extractionMethod: 'html', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
    {
      id: 'fair-url', sourceSnapshotId: 'fair-home', fieldPath: 'sources.officialUrl', value: 'https://fair.example/', normalizedText: 'https://fair.example/', confidence: 'verified', confidenceScore: 1, extractionMethod: 'metadata', reviewStatus: 'unreviewed', createdAt: '2026-07-14T12:00:00.000Z',
    },
  ],
  scheduleCandidates: [],
};
const countyFairPlan = buildEditorialPlan(countyFairInput, reconcileEventSourceClaims(countyFairInput).profile.values);
assert(countyFairPlan.highlights.length >= 4, 'County fair evidence should produce distinct livestock, exhibit, midway, and grandstand highlights.');
assert(countyFairPlan.recommendedTabs.includes('highlights'));
const countyFairManifest = synthesizeEventSourceBundle(countyFairInput).manifestProposal as EventPageManifest;
assert.equal(countyFairManifest.identity.name, 'St. Clair County 4-H & Youth Fair', 'Bundle punctuation should survive equivalent evidence names.');
assert.equal(countyFairManifest.identity.venue, 'Goodells County Park', 'A real venue in address text should outrank a generic address heading.');
assert(countyFairManifest.navigation.some((item) => item.targetModuleId === 'highlights'));
assert(!JSON.stringify(countyFairManifest).includes('tattoo collectors'), 'Event-specific audience copy must not leak into another event type.');
assert(!JSON.stringify(countyFairManifest).includes('fair@example.com'), 'Personal contact details must stay in the evidence archive, not public highlights.');
const countyFairHighlights = countyFairManifest.modules.find((module) => module.type === 'highlights');
assert(countyFairHighlights?.type === 'highlights');
assert.equal(
  new Set((countyFairHighlights.links ?? []).map((link) => link.id)).size,
  (countyFairHighlights.links ?? []).length,
  'Highlights links must have stable unique IDs even when several share one content kind.',
);

const cherryCurrentInput: EventSourceSynthesisInput = {
  ...cherryTraditionsInput,
  scheduleCandidates: [{
    id: 'cherry-current-event',
    sourceSnapshotId: 'cherry-home',
    dedupeKey: 'cherry-current-event',
    title: 'Opening Ceremonies',
    startsAt: '2026-07-04T10:00:00-04:00',
    endsAt: '2026-07-04T11:00:00-04:00',
    dateText: 'July 4, 2026',
    timezone: 'America/Detroit',
    venue: 'Open Space Park',
    category: 'Community',
    tags: ['community'],
    details: 'The festival opens in Traverse City.',
    confidence: 'verified',
    confidenceScore: 1,
    reviewStatus: 'unreviewed',
  }],
};
const cherryCurrentPlan = buildEditorialPlan(cherryCurrentInput, editorialReconciled.profile.values);
assert.equal(cherryCurrentPlan.scheduleStatus, 'current_partial');
const cherryCurrentSynthesis = synthesizeEventSourceBundle(cherryCurrentInput);
const cherryCurrentTraditions = (cherryCurrentSynthesis.manifestProposal as EventPageManifest).modules
  .find((module) => module.type === 'traditions');
assert(cherryCurrentTraditions?.type === 'traditions');
assert(
  cherryCurrentTraditions.items.every((item) => !item.latestObserved && !item.currentStatus),
  'current-program tradition cards should not expose repetitive evidence or timing narration',
);
assert(
  !JSON.stringify(cherryCurrentTraditions).includes('latest-observed evidence'),
  'current-program tradition copy should remain visitor-facing',
);

const completedConventionInput: EventSourceSynthesisInput = {
  bundle: {
    id: 'bundle-completed-convention',
    name: 'Black River Tattoo Convention',
    status: 'ready_for_synthesis',
    eventKey: 'black-river-tattoo-convention',
    canonicalEventId: null,
    candidateId: null,
    readyAt: '2026-07-14T03:30:00.000Z',
  },
  snapshots: [
    {
      id: 'completed-home',
      sequenceNumber: 1,
      sourceKind: 'official_home',
      canonicalUrl: 'https://convention.example/',
      pageTitle: 'Black River Tattoo Convention',
      contentHash: '7'.repeat(64),
      fetchedAt: '2026-07-14T03:30:00.000Z',
      contentSegments: [
        { kind: 'heading', text: '2027 Updates Coming Soon' },
        { kind: 'paragraph', text: 'More than 100 hand-chosen tattoo artists gather in Port Huron.' },
      ],
    },
    {
      id: 'completed-program',
      sequenceNumber: 2,
      sourceKind: 'schedule',
      canonicalUrl: 'https://convention.example/entertainment',
      pageTitle: '2026 Entertainment',
      contentHash: '8'.repeat(64),
      fetchedAt: '2026-07-14T03:30:00.000Z',
      contentSegments: [
        { kind: 'heading', text: 'Friday June 5, 2026' },
        { kind: 'paragraph', text: '12-3pm Live Painters' },
        { kind: 'paragraph', text: '3-5pm ArtFusion and live auction' },
        { kind: 'heading', text: 'Saturday June 6, 2026' },
        { kind: 'paragraph', text: '12-2pm ArtFusion' },
        { kind: 'paragraph', text: '8-10pm Tattoo Competitions' },
        { kind: 'heading', text: 'Sunday June 7, 2026' },
        { kind: 'paragraph', text: '12-3pm Live Painters' },
        { kind: 'paragraph', text: '5-7pm Tattoo Competitions' },
      ],
    },
  ],
  claims: [
    {
      id: 'completed-name',
      sourceSnapshotId: 'completed-home',
      fieldPath: 'identity.name',
      value: 'Black River Tattoo Convention',
      normalizedText: 'black river tattoo convention',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'metadata',
      reviewStatus: 'accepted',
      createdAt: '2026-07-14T03:30:00.000Z',
    },
    {
      id: 'completed-start',
      sourceSnapshotId: 'completed-program',
      fieldPath: 'timing.startDate',
      value: '2026-06-05',
      normalizedText: '2026-06-05',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'html',
      reviewStatus: 'accepted',
      createdAt: '2026-07-14T03:30:00.000Z',
    },
    {
      id: 'completed-end',
      sourceSnapshotId: 'completed-program',
      fieldPath: 'timing.endDate',
      value: '2026-06-07',
      normalizedText: '2026-06-07',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'html',
      reviewStatus: 'accepted',
      createdAt: '2026-07-14T03:30:00.000Z',
    },
    {
      id: 'completed-timezone',
      sourceSnapshotId: 'completed-home',
      fieldPath: 'timing.timezone',
      value: 'America/Detroit',
      normalizedText: 'america/detroit',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'operator',
      reviewStatus: 'accepted',
      createdAt: '2026-07-14T03:30:00.000Z',
    },
    {
      id: 'completed-location',
      sourceSnapshotId: 'completed-home',
      fieldPath: 'location.display',
      value: 'Port Huron, Michigan',
      normalizedText: 'port huron, michigan',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'html',
      reviewStatus: 'accepted',
      createdAt: '2026-07-14T03:30:00.000Z',
    },
    {
      id: 'completed-url',
      sourceSnapshotId: 'completed-home',
      fieldPath: 'sources.officialUrl',
      value: 'https://convention.example/',
      normalizedText: 'https://convention.example/',
      confidence: 'verified',
      confidenceScore: 1,
      extractionMethod: 'metadata',
      reviewStatus: 'accepted',
      createdAt: '2026-07-14T03:30:00.000Z',
    },
  ],
  scheduleCandidates: [],
};
const completedConventionSynthesis = synthesizeEventSourceBundle(completedConventionInput);
const completedConventionManifest = completedConventionSynthesis.manifestProposal as EventPageManifest;
assert.equal(completedConventionManifest.lifecycle, 'completed');
assert.equal(completedConventionManifest.hero.imagePosition, 'center 52%');
assert.equal(completedConventionManifest.reviewedAt, '2026-07-13', 'verification dates should use the event timezone');
assert.equal(
  completedConventionManifest.navigation.find((item) => item.targetModuleId === 'schedule')?.label,
  'Archive',
  'completed-edition navigation should remain compact on mobile',
);
const completedPlan = completedConventionManifest.modules.find((module) => module.type === 'planVisit');
assert(completedPlan?.type === 'planVisit');
assert.equal(
  completedPlan.details.find((detail) => detail.id === 'dates')?.label,
  '2026 edition dates',
  'historical dates must never read as upcoming dates',
);

const editorialSynthesis = synthesizeEventSourceBundle(editorialInput);
const editorialManifest = editorialSynthesis.manifestProposal as EventPageManifest;
const editorialSchedule = editorialManifest.modules.find((module) => module.type === 'schedule');
const traditionsModule = editorialManifest.modules.find((module) => module.type === 'traditions');
assert(editorialSchedule?.type === 'schedule' && editorialSchedule.referenceSchedule, 'synthesis should compose a reference weekend');
assert(traditionsModule?.type === 'traditions', 'synthesis should compose a dedicated traditions module');
assert.equal(editorialManifest.scheduleItems.length, 0, 'historical times must never become current schedule items');
assert.equal(editorialSynthesis.validationReport.editorial.referenceYear, 2025);
assert.equal(editorialSynthesis.validationReport.editorial.referenceItemCount, 7);
assert(!JSON.stringify(editorialManifest).includes('Metro Electric'), 'a leading event-sponsor name must not leak into generated copy');

const assisted = applyEditorialModelOutput({
  parentSynthesisId: '00000000-0000-4000-8000-000000000001',
  provider: 'fixture-gateway',
  model: 'fixture-editor',
  input: editorialInput,
  manifest: editorialManifest,
  output: {
    rewrites: [
      {
        target: 'hero.tagline',
        text: 'A Labor Day weekend shaped by peach harvest traditions, hometown parades, and festival pageantry.',
        sourceSnapshotIds: ['editorial-history'],
      },
      {
        target: 'module.why-go.headline',
        text: 'Join 500,000 visitors for the peach harvest.',
        sourceSnapshotIds: ['editorial-history'],
      },
      {
        target: 'module.why-go.summary',
        text: 'Presented by Example Sponsor, the festival fills Romeo with tradition.',
        sourceSnapshotIds: ['editorial-history'],
      },
      {
        target: 'module.traditions.summary',
        text: 'The official history lists the traditions that shape the festival.',
        sourceSnapshotIds: ['editorial-history'],
      },
    ],
    audienceGroups: [
      {
        id: 'parade-traditions',
        title: 'For parade traditions',
        tone: 'water',
        items: ['See the Floral Parade heritage take shape downtown.', 'Look for youth traditions rooted in the Juvenile Parade.'],
        sourceSnapshotIds: ['editorial-history'],
      },
      {
        id: 'harvest-weekend',
        title: 'For the harvest weekend',
        tone: 'sunset',
        items: ['Explore orchard visits tied to the peach crop.', 'Pair craft shows with the festival street traditions.'],
        sourceSnapshotIds: ['editorial-history'],
      },
    ],
    spotlight: {
      title: 'Scout Spotlight: The Floral Parade',
      body: 'The parade took its name from festival-court floats decorated with flowers, a tradition preserved across generations.',
      scoutPose: 'curious',
      sourceSnapshotIds: ['editorial-history'],
    },
  },
});
assert.equal(assisted.report.appliedRewriteCount, 1, 'Only grounded allowlisted copy should be applied.');
assert.equal(assisted.report.rejectedRewriteCount, 3, 'Unsupported numeric, sponsor-bearing, and research-narration rewrites should be rejected.');
assert.equal(assisted.report.addedAudienceGroupCount, 2, 'Grounded audience groups should enrich an empty Why Go module.');
assert.equal(assisted.report.addedSpotlight, true, 'A grounded Scout Spotlight should be added when one is absent.');
assert.equal(assisted.report.qualityChecks.immutableFactsLocked, true, 'Editorial assistance must preserve the immutable fact projection.');
assert.equal(assisted.report.qualityChecks.researchNarrationExcluded, true, 'Editorial assistance must keep research narration out of public copy.');
assert.equal(assisted.report.qualityChecks.spotlightNarrativeSourceRequired, true, 'Scout Spotlights must require narrative evidence.');
assert.equal(assisted.manifest.identity.startsOn, editorialManifest.identity.startsOn, 'Editorial assistance changed the verified start date.');
assert.equal(assisted.manifest.scheduleItems.length, editorialManifest.scheduleItems.length, 'Editorial assistance changed the current schedule.');
assert(!/example sponsor|500,000/i.test(JSON.stringify(assisted.manifest)), 'Rejected editorial copy leaked into the manifest.');

const scheduleOnlySpotlight = applyEditorialModelOutput({
  parentSynthesisId: '00000000-0000-4000-8000-000000000002',
  provider: 'fixture-gateway',
  model: 'fixture-editor',
  input: editorialInput,
  manifest: editorialManifest,
  output: {
    rewrites: [],
    audienceGroups: [],
    spotlight: {
      title: 'Recurring festival events',
      body: 'Recurring events include orchard visits, craft shows, carnival rides, and hometown parades.',
      scoutPose: 'standing',
      sourceSnapshotIds: ['editorial-schedule'],
    },
  },
});
assert.equal(scheduleOnlySpotlight.report.addedSpotlight, false, 'A schedule-only Scout Spotlight must not be added.');
assert.equal(scheduleOnlySpotlight.report.rejectedRewriteCount, 1, 'A schedule-only Scout Spotlight should be reported as rejected.');

const citationManifest = structuredClone(editorialManifest);
const citationScout = citationManifest.scoutSuggestions[0];
const scheduleSource = citationManifest.sources.find((source) => source.url === 'https://festival.example/schedule-of-events/');
const historySource = citationManifest.sources.find((source) => source.url === 'https://festival.example/about-us/');
assert(citationScout && scheduleSource && historySource, 'Citation fixture sources are incomplete.');
citationScout.sourceIds = [scheduleSource.id];
const citationRewrite = applyEditorialModelOutput({
  parentSynthesisId: '00000000-0000-4000-8000-000000000003',
  provider: 'fixture-gateway',
  model: 'fixture-editor',
  input: editorialInput,
  manifest: citationManifest,
  output: {
    rewrites: [{
      target: `scout.${citationScout.id}.response`,
      text: 'Peach harvest traditions, hometown parades, and festival pageantry shape the weekend.',
      sourceSnapshotIds: ['editorial-history'],
    }],
    audienceGroups: [],
    spotlight: null,
  },
});
assert.deepEqual(citationRewrite.manifest.scoutSuggestions[0].sourceIds, [historySource.id], 'Rewritten copy must publish the model citations that supported it.');
assert.equal(citationRewrite.report.qualityChecks.immutableFactsLocked, true, 'Citation reassignment must not alter immutable facts.');

console.log('Event source synthesis validations passed.');
