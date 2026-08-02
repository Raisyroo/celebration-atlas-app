import assert from 'node:assert/strict';
import { BROWN_TROUT_EVENT_PAGE_MANIFEST } from '../data/brownTroutEventPageManifest.ts';
import { validateEventPageContentReadiness } from '../data/eventPageContentReadiness.ts';
import { evaluateEventPageEditorialQuality } from '../data/eventPageEditorialQuality.ts';
import type { EventPageManifest } from '../data/eventPageManifestTypes.ts';
import {
  reconcileEventSourceClaims,
  synthesizeEventSourceBundle,
} from '../lib/event-intake/synthesisEngine.ts';
import { buildEditorialPlan } from '../lib/event-intake/editorialPlanning.ts';
import {
  applyFullManifestEditorialOutput,
  applyEditorialModelOutput,
  buildBoundedEditorialRewriteTargets,
} from '../lib/event-intake/editorialAssistance.ts';
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
assert.equal(JSON.stringify(withApprovedVisual.manifestProposal).includes('Official event overview'), false);
assert.equal(JSON.stringify(withApprovedVisual.manifestProposal).includes('Official program'), false);
assert.equal(JSON.stringify(withApprovedVisual.manifestProposal).includes('Source-backed event times'), false);

const operationalDescriptionInput: EventSourceSynthesisInput = {
  ...input,
  claims: input.claims.map((claim) => (
    claim.fieldPath === 'identity.description'
      ? {
          ...claim,
          value: 'Planning to exhibit at this year’s fair? Please review the drop-off schedule below and refer to the department you entered for additional instructions.',
          normalizedText: 'planning to exhibit at this year fair please review the drop off schedule below',
        }
      : claim
  )),
  scheduleCandidates: [
    {
      id: 'fair-livestock',
      sourceSnapshotId: 'snapshot-newer',
      dedupeKey: 'fair-livestock',
      title: 'Dairy cattle showmanship',
      startsAt: '2026-07-25T13:00:00-04:00',
      endsAt: null,
      dateText: 'July 25, 2026',
      timezone: 'America/Detroit',
      venue: 'Show ring',
      category: 'livestock',
      tags: ['livestock'],
      details: null,
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'accepted',
    },
    {
      id: 'fair-grandstand',
      sourceSnapshotId: 'snapshot-newer',
      dedupeKey: 'fair-grandstand',
      title: 'Truck pull',
      startsAt: '2026-07-25T19:00:00-04:00',
      endsAt: null,
      dateText: 'July 25, 2026',
      timezone: 'America/Detroit',
      venue: 'Grandstand',
      category: 'grandstand',
      tags: ['grandstand'],
      details: null,
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'accepted',
    },
  ],
};
const operationalDescriptionSynthesis = synthesizeEventSourceBundle({
  ...operationalDescriptionInput,
  approvedVisual: {
    workflowId: 'visual-workflow-operational-description',
    imageSrc: 'https://media.example/fair/hero.png',
    imageAlt: 'A fair grandstand event under evening lights.',
    contentHash: 'e'.repeat(64),
  },
});
const operationalDescriptionManifest = operationalDescriptionSynthesis.manifestProposal as EventPageManifest;
const operationalWhyGo = operationalDescriptionManifest.modules.find((module) => module.type === 'whyGo');
assert(operationalWhyGo?.type === 'whyGo');
assert(!JSON.stringify(operationalDescriptionManifest).includes('Planning to exhibit'), 'operational homepage instructions must not become general Event Hub copy');
assert(!JSON.stringify(operationalDescriptionManifest).includes('official program'), 'factory provenance language must not become public Event Hub copy');
assert.match(operationalDescriptionManifest.hero.tagline, /livestock and showmanship/);
assert.match(operationalWhyGo.summary, /grandstand action/);
assert(
  operationalDescriptionManifest.scoutSuggestions.some((suggestion) => suggestion.id === 'scout-grandstand'),
  'fair schedules should expose a source-bound Grandstand Scout shortcut',
);
assert(
  operationalDescriptionManifest.scoutSuggestions.some((suggestion) => suggestion.id === 'scout-livestock'),
  'fair schedules should expose a source-bound Livestock Scout shortcut',
);
assert(
  operationalDescriptionSynthesis.validationReport.warnings.some((warning) => warning.includes('operational or task-specific')),
  'excluded operational descriptions should remain visible to reviewers as retained evidence',
);

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

const maritimeTraditionsPlan = buildEditorialPlan({
  ...cherryTraditionsInput,
  snapshots: [
    {
      id: 'maritime-about',
      sequenceNumber: 1,
      sourceKind: 'other',
      canonicalUrl: 'https://maritime.example/about-history',
      pageTitle: 'Festival History',
      contentHash: 'a'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [
        { kind: 'paragraph', text: 'The celebration began as a Coast Guard personnel-only picnic, with the first picnic in 1924 and the first festival in 1937.' },
        { kind: 'paragraph', text: 'The National Coast Guard Memorial Service honors those who sacrificed their lives in service.' },
      ],
    },
    {
      id: 'maritime-ships',
      sequenceNumber: 2,
      sourceKind: 'schedule',
      canonicalUrl: 'https://maritime.example/ship-arrivals',
      pageTitle: 'Ship Arrivals',
      contentHash: 'b'.repeat(64),
      fetchedAt: '2026-07-14T12:00:00.000Z',
      contentSegments: [
        { kind: 'paragraph', text: 'Coast Guard cutters glide into the channel while crowds gather along the waterfront.' },
      ],
    },
  ],
}, editorialReconciled.profile.values);
assert(maritimeTraditionsPlan.traditions.length === 3, 'Maritime festival evidence should create origin, memorial, and ship-arrival traditions.');
assert(maritimeTraditionsPlan.recommendedTabs.includes('traditions'), 'A source-rich maritime festival should receive a traditions tab.');
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
    {
      id: 'cherry-rules',
      sequenceNumber: 8,
      sourceKind: 'rules',
      canonicalUrl: 'https://cherry.example/festival-rules',
      pageTitle: 'Festival Rules',
      contentHash: '8'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
    },
  ],
};
const cherryPlanLinks = (synthesizeEventSourceBundle(cherryPlanLinksInput).manifestProposal as EventPageManifest).modules
  .find((module) => module.type === 'planVisit');
assert(cherryPlanLinks?.type === 'planVisit');
assert.deepEqual(
  cherryPlanLinks.links.map((link) => link.label),
  ['Admission', 'Fair Book & entries', 'Carnival information', 'Festival rules'],
  'Generated Event Hubs should retain distinct, useful planning links.',
);

const transportPlanLinksInput: EventSourceSynthesisInput = {
  ...cherryTraditionsInput,
  snapshots: [
    ...cherryTraditionsInput.snapshots,
    {
      id: 'visitor-parking',
      sequenceNumber: 9,
      sourceKind: 'plan',
      canonicalUrl: 'https://festival.example/parking-information',
      pageTitle: 'Parking Information',
      contentHash: '9'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
    },
    {
      id: 'visitor-transit',
      sequenceNumber: 10,
      sourceKind: 'plan',
      canonicalUrl: 'https://transit.example/festival-shuttle',
      pageTitle: 'Festival Transit',
      contentHash: 'a'.repeat(64),
      fetchedAt: '2026-07-13T12:00:00.000Z',
    },
  ],
};
const transportPlanLinks = (synthesizeEventSourceBundle(transportPlanLinksInput).manifestProposal as EventPageManifest).modules
  .find((module) => module.type === 'planVisit');
assert(transportPlanLinks?.type === 'planVisit');
assert.deepEqual(
  transportPlanLinks.links.map((link) => link.label),
  ['Parking & shuttles', 'Transit & shuttles'],
  'Parking and transit sources should receive accurate visitor-facing labels.',
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
  scheduleCandidates: [
    {
      id: 'fair-livestock-schedule',
      sourceSnapshotId: 'fair-schedule',
      dedupeKey: 'fair-livestock-schedule',
      title: 'Youth dairy showmanship',
      startsAt: '2026-07-20T09:00:00-04:00',
      endsAt: '2026-07-20T11:00:00-04:00',
      dateText: 'July 20, 2026',
      timezone: 'America/Detroit',
      venue: 'Livestock arena',
      category: 'Livestock',
      tags: ['youth', 'showmanship'],
      details: 'Official youth livestock program.',
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'unreviewed',
    },
    {
      id: 'fair-exhibits-schedule',
      sourceSnapshotId: 'fair-schedule',
      dedupeKey: 'fair-exhibits-schedule',
      title: 'Home arts judging',
      startsAt: '2026-07-20T11:30:00-04:00',
      endsAt: '2026-07-20T13:00:00-04:00',
      dateText: 'July 20, 2026',
      timezone: 'America/Detroit',
      venue: 'Exhibit hall',
      category: 'Exhibits',
      tags: ['home-arts'],
      details: 'Official exhibit judging.',
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'unreviewed',
    },
    {
      id: 'fair-grandstand-schedule',
      sourceSnapshotId: 'fair-schedule',
      dedupeKey: 'fair-grandstand-schedule',
      title: 'Demolition derby',
      startsAt: '2026-07-20T19:00:00-04:00',
      endsAt: '2026-07-20T21:00:00-04:00',
      dateText: 'July 20, 2026',
      timezone: 'America/Detroit',
      venue: 'Grandstand',
      category: 'Grandstand Events',
      tags: ['ticketed'],
      details: 'Official grandstand program.',
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'unreviewed',
    },
    {
      id: 'fair-midway-schedule',
      sourceSnapshotId: 'fair-schedule',
      dedupeKey: 'fair-midway-schedule',
      title: 'Carnival midway opens',
      startsAt: '2026-07-21T12:00:00-04:00',
      endsAt: null,
      dateText: 'July 21, 2026',
      timezone: 'America/Detroit',
      venue: 'Midway',
      category: 'Carnival',
      tags: ['rides', 'mega-pass'],
      details: 'Official midway opening time.',
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'unreviewed',
    },
  ],
};
const countyFairPlan = buildEditorialPlan(countyFairInput, reconcileEventSourceClaims(countyFairInput).profile.values);
assert(countyFairPlan.highlights.length >= 4, 'County fair evidence should produce distinct livestock, exhibit, midway, and grandstand highlights.');
assert(countyFairPlan.recommendedTabs.includes('highlights'));
const countyFairManifest = synthesizeEventSourceBundle(countyFairInput).manifestProposal as EventPageManifest;
assert.equal(countyFairManifest.identity.name, 'St. Clair County 4-H & Youth Fair', 'Bundle punctuation should survive equivalent evidence names.');
assert.equal(countyFairManifest.identity.venue, 'Goodells County Park', 'A real venue in address text should outrank a generic address heading.');
assert(countyFairManifest.navigation.some((item) => item.targetModuleId === 'highlights'));
assert.deepEqual(
  countyFairManifest.navigation.map((item) => item.label),
  ['Experience', 'Schedule', 'Highlights', 'Next Time'],
  'Completed Event Hubs should preserve the four-column structure with lifecycle-appropriate labels.',
);
assert.equal(
  countyFairManifest.hero.tagline.includes('official'),
  false,
  'Visitor-facing hero copy must sell the experience rather than direct people to official program material.',
);
const countyFairWhyGo = countyFairManifest.modules.find((module) => module.type === 'whyGo');
assert(countyFairWhyGo?.type === 'whyGo');
assert.equal(countyFairWhyGo.eyebrow, '6 days of fair energy');
assert.equal(countyFairWhyGo.headline, 'Come for the midway. Stay for the grandstand.');
assert.match(countyFairWhyGo.summary, /Demolition derby/i);
assert.match(countyFairWhyGo.summary, /carnival rides throughout fair week/i);
assert.doesNotMatch(countyFairWhyGo.summary, /every fair day/i, 'Daily carnival copy requires explicit daily evidence.');
assert.deepEqual(
  countyFairManifest.scheduleItems.map((item) => item.category),
  ['livestock', 'exhibits', 'grandstand', 'midway'],
  'County fair schedule rows should preserve fair-specific visitor semantics.',
);
assert(
  countyFairManifest.scheduleItems.every((item) => item.tags.includes(item.category)),
  'County fair schedule rows should retain their normalized category as a filter tag.',
);
const countyFairSchedule = countyFairManifest.modules.find((module) => module.type === 'schedule');
assert(countyFairSchedule?.type === 'schedule');
assert.equal(countyFairSchedule.eyebrow, 'Fair week at a glance');
assert.equal(
  countyFairSchedule.subtitle,
  "Plan around grandstand action and Monday's Youth dairy showmanship.",
  'Fair schedules should invite visitors into the evidence-backed week without leaking another fair’s lineup.',
);
assert.deepEqual(
  countyFairSchedule.filters.map((filter) => ({
    id: filter.id,
    label: filter.label,
    mode: filter.mode,
    value: filter.value,
  })),
  [
    { id: 'all', label: 'All', mode: 'all', value: undefined },
    { id: 'category-livestock', label: 'Livestock', mode: 'tag', value: 'livestock' },
    { id: 'category-exhibits', label: 'Exhibits', mode: 'tag', value: 'exhibits' },
    { id: 'category-grandstand', label: 'Grandstand', mode: 'tag', value: 'grandstand' },
    { id: 'category-midway', label: 'Midway', mode: 'tag', value: 'midway' },
  ],
  'County fair schedule filters should expose each fair-specific schedule category.',
);
assert(!JSON.stringify(countyFairManifest).includes('tattoo collectors'), 'Event-specific audience copy must not leak into another event type.');
assert(!JSON.stringify(countyFairManifest).includes('fair@example.com'), 'Personal contact details must stay in the evidence archive, not public highlights.');
assert(!JSON.stringify(countyFairManifest).includes('Friday Livestock Sale'), 'Another fair’s dated livestock event must not leak into reusable fair copy.');
assert(!JSON.stringify(countyFairManifest).includes('Seven days of fair energy'), 'Fair duration copy must be derived from the retained edition dates.');
const countyFairHighlights = countyFairManifest.modules.find((module) => module.type === 'highlights');
assert(countyFairHighlights?.type === 'highlights');
assert(countyFairHighlights.items.length >= 3, 'A fair Highlights tab must contain multiple distinct reasons to attend.');
assert.equal(countyFairHighlights.eyebrow, 'Three ways to do fair week');
assert.match(countyFairHighlights.summary, /^Midway lights/);
assert.match(countyFairHighlights.summary, /Midway lights, grandstand nights/i);
assert.doesNotMatch(countyFairHighlights.summary, /live music/i, 'Live-music copy requires a retained concert source.');
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

const editorialAssistanceManifest = structuredClone(editorialManifest);
const editorialAssistanceWhyGo = editorialAssistanceManifest.modules.find(
  (module) => module.type === 'whyGo',
);
if (editorialAssistanceWhyGo?.type === 'whyGo') {
  editorialAssistanceWhyGo.audienceGroups = [];
}
const assisted = applyEditorialModelOutput({
  parentSynthesisId: '00000000-0000-4000-8000-000000000001',
  provider: 'fixture-gateway',
  model: 'fixture-editor',
  input: editorialInput,
  manifest: editorialAssistanceManifest,
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

const shelbySnapshotId = 'shelby-official-event';
const shelbySourceUrl = 'https://municipality.example/calendar/shelby-township-art-fair';
const shelbyInput: EventSourceSynthesisInput = {
  bundle: {
    id: 'shelby-bundle',
    name: 'Shelby Township Art Fair',
    status: 'ready_for_synthesis',
    eventKey: 'shelby-township-art-fair-shelby-township-mi',
    canonicalEventId: null,
    candidateId: 'shelby-candidate',
    readyAt: '2026-07-29T12:00:00.000Z',
  },
  snapshots: [{
    id: shelbySnapshotId,
    sequenceNumber: 1,
    sourceKind: 'schedule',
    canonicalUrl: shelbySourceUrl,
    pageTitle: 'Shelby Township Art Fair | Shelby Township, MI',
    contentHash: 'd'.repeat(64),
    fetchedAt: '2026-07-29T12:00:00.000Z',
    contentSegments: [
      { kind: 'heading', text: 'Shelby Township Art Fair' },
      { kind: 'paragraph', text: 'The Shelby Township Art Fair will celebrate its 43rd anniversary in 2026. This includes over 120 artist and marketplace vendors. There is also food, musical entertainment, and a kid’s craft and activity area.' },
      { kind: 'paragraph', text: 'Entry and parking is free at River Bends Park, with additional parking and free shuttle buses nearby.' },
    ],
  }, {
    id: 'shelby-applications',
    sequenceNumber: 2,
    sourceKind: 'registration',
    canonicalUrl: 'https://artfair.example/applications',
    pageTitle: 'Applications',
    contentHash: 'e'.repeat(64),
    fetchedAt: '2026-07-29T12:00:00.000Z',
    contentSegments: [
      { kind: 'paragraph', text: 'The application period is closed. This juried outdoor event accepts original handmade work only.' },
    ],
  }, {
    id: 'shelby-artists',
    sequenceNumber: 3,
    sourceKind: 'other',
    canonicalUrl: 'https://artfair.example/artists-and-vendors',
    pageTitle: 'Artists & Vendors',
    contentHash: 'f'.repeat(64),
    fetchedAt: '2026-07-29T13:00:00.000Z',
    contentSegments: [
      { kind: 'paragraph', text: 'More than 120 artist and marketplace vendors show original work at the fair.' },
    ],
  }],
  claims: [
    ['claim-shelby-name', 'identity.name', 'Shelby Township Art Fair'],
    ['claim-shelby-start', 'timing.startDate', '2026-08-08'],
    ['claim-shelby-end', 'timing.endDate', '2026-08-09'],
    ['claim-shelby-location', 'location.display', 'River Bends Park, Shelby Township, MI'],
    ['claim-shelby-city', 'location.city', 'Shelby Township'],
    ['claim-shelby-state', 'location.state', 'MI'],
    ['claim-shelby-venue', 'location.venue', 'River Bends Park'],
    ['claim-shelby-timezone', 'timing.timezone', 'America/Detroit'],
    ['claim-shelby-source', 'sources.officialUrl', shelbySourceUrl],
  ].map(([id, fieldPath, value]) => ({
    id,
    sourceSnapshotId: shelbySnapshotId,
    fieldPath,
    value,
    normalizedText: value.toLowerCase(),
    confidence: 'verified' as const,
    confidenceScore: 1,
    extractionMethod: 'json_ld' as const,
    reviewStatus: 'unreviewed' as const,
    createdAt: '2026-07-29T12:00:00.000Z',
  })),
  scheduleCandidates: [
    {
      id: 'shelby-hours-saturday',
      sourceSnapshotId: shelbySnapshotId,
      dedupeKey: '1'.repeat(64),
      title: 'Shelby Township Art Fair hours',
      startsAt: '2026-08-08T14:00:00.000Z',
      endsAt: '2026-08-08T21:00:00.000Z',
      dateText: '08/08/2026',
      timezone: 'America/Detroit',
      venue: 'River Bends Park',
      category: 'community',
      tags: ['main-event', 'event-hours'],
      details: null,
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'unreviewed',
    },
    {
      id: 'shelby-hours-sunday',
      sourceSnapshotId: shelbySnapshotId,
      dedupeKey: '2'.repeat(64),
      title: 'Shelby Township Art Fair hours',
      startsAt: '2026-08-09T14:00:00.000Z',
      endsAt: '2026-08-09T21:00:00.000Z',
      dateText: '08/09/2026',
      timezone: 'America/Detroit',
      venue: 'River Bends Park',
      category: 'community',
      tags: ['main-event', 'event-hours'],
      details: null,
      confidence: 'verified',
      confidenceScore: 1,
      reviewStatus: 'unreviewed',
    },
  ],
};
const shelbySynthesis = synthesizeEventSourceBundle(shelbyInput);
const shelbyManifest = shelbySynthesis.manifestProposal as EventPageManifest;
const shelbyContent = validateEventPageContentReadiness(shelbyManifest);
const shelbyBoundedEditorial = buildBoundedEditorialRewriteTargets(
  shelbyManifest,
);
assert.equal(shelbySynthesis.engineVersion, 'deterministic-v22');
assert.equal(shelbyManifest.navigation.length, 4, 'A new art-fair manifest must contain all four primary topics.');
assert.equal(shelbyManifest.scheduleItems.length, 2, 'Official event-day hours must appear as useful Schedule rows.');
assert.equal(
  shelbyManifest.modules.find((module) => module.type === 'highlights')?.type,
  'highlights',
  'Official artist, entertainment, and family evidence must create Highlights.',
);
const shelbyPlan = shelbyManifest.modules.find((module) => module.type === 'planVisit');
const shelbyHighlights = shelbyManifest.modules.find((module) => module.type === 'highlights');
assert(shelbyPlan?.type === 'planVisit' && shelbyHighlights?.type === 'highlights');
assert(
  shelbyPlan.links.some((link) => link.label === 'Applications'),
  'An applications page must use a truthful label that does not imply registration is open.',
);
assert(
  shelbyHighlights.links?.some((link) => link.label === 'Artists & vendors'),
  'A marketplace source must not be labeled as a current-year directory without retained current-year proof.',
);
assert.equal(shelbyContent.ok, false, 'A source-rich page must still fail when its core visitor copy only repeats one experience list.');
assert(
  !shelbyContent.ok && shelbyContent.errors.some((error) => error.includes('must do different jobs')),
  'The content gate must explain the repeated hero and Why Go copy in plain language.',
);
assert(
  shelbyBoundedEditorial.targets.every(
    (target) =>
      !target.id.startsWith('scout.')
      && !target.id.endsWith('.subtitle'),
  ),
  'A repetition-only pass must not spend model work on passing Scout, Schedule, or Plan copy.',
);
assert(
  shelbyBoundedEditorial.targets.some((target) => target.id === 'hero.tagline')
  && shelbyBoundedEditorial.targets.some((target) => target.id === 'module.why-go.summary')
  && shelbyBoundedEditorial.targets.some((target) => target.id.includes('module.highlights.item.')),
  'The bounded pass must retain every core visitor-copy target implicated by the gate.',
);

const shelbyEditorial = applyEditorialModelOutput({
  parentSynthesisId: '00000000-0000-4000-8000-000000000004',
  provider: 'fixture-gateway',
  model: 'fixture-editor',
  input: shelbyInput,
  manifest: shelbyManifest,
  output: {
    rewrites: [
      {
        target: 'hero.tagline',
        text: 'A two-day River Bends Park fair pairs more than 120 artist and marketplace vendors with free entry and parking.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.why-go.headline',
        text: 'Browse the artists, then stay for music and hands-on kids’ activities.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.why-go.summary',
        text: 'Free entry and parking make it easy to browse at your own pace, and nearby shuttle buses add another arrival option.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.highlights.headline',
        text: 'What fills River Bends Park.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.highlights.summary',
        text: 'Choose between browsing artist booths, a food-and-music break, and hands-on family time.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.highlights.item.highlight-entertainment.summary',
        text: 'Food and musical entertainment offer a break between rounds of artist booths.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.highlights.item.highlight-marketplace.summary',
        text: 'More than 120 artist and marketplace vendors form the center of the weekend.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        target: 'module.highlights.item.highlight-family-activities.summary',
        text: 'A dedicated craft and activity area gives children something hands-on to do.',
        sourceSnapshotIds: [shelbySnapshotId],
      },
    ],
    audienceGroups: [
      {
        id: 'art-fair-browsers',
        title: 'For art-fair browsers',
        tone: 'water',
        items: [
          'More than 120 artist and marketplace vendors',
          'Food and musical entertainment between booths',
        ],
        sourceSnapshotIds: [shelbySnapshotId],
      },
      {
        id: 'family-planning',
        title: 'For families',
        tone: 'sunset',
        items: [
          'A kids’ craft and activity area',
          'Free parking and shuttle buses nearby',
        ],
        sourceSnapshotIds: [shelbySnapshotId],
      },
    ],
    spotlight: null,
  },
});
const shelbyEditorialContent = validateEventPageContentReadiness(
  shelbyEditorial.manifest,
);
assert.equal(
  shelbyEditorial.report.qualityChecks.editorialQualityPassed,
  true,
  `The editorial review report must record the visitor-copy quality result: ${evaluateEventPageEditorialQuality(shelbyEditorial.manifest).errors.join(' ')} Changed targets: ${shelbyEditorial.report.changedTargets.join(', ')}`,
);
assert.equal(
  shelbyEditorial.report.addedAudienceGroupCount,
  2,
  'A grounded editorial pass may replace repetitive deterministic visitor groups.',
);
assert.equal(
  shelbyEditorialContent.ok,
  true,
  `Distinct, grounded Shelby visitor copy should pass: ${shelbyEditorialContent.ok ? '' : shelbyEditorialContent.errors.join(' ')}`,
);

const shelbyFullManifest = structuredClone(shelbyEditorial.manifest);
shelbyFullManifest.hero.tagline = 'More than 120 artist and marketplace vendors gather for two days at River Bends Park.';
shelbyFullManifest.navigation = shelbyFullManifest.navigation.map((item) =>
  item.targetModuleId === 'highlights'
    ? { ...item, label: 'What to See' }
    : item,
);
const shelbyFullWhyGo = shelbyFullManifest.modules.find((module) => module.type === 'whyGo');
const shelbyFullSchedule = shelbyFullManifest.modules.find((module) => module.type === 'schedule');
const shelbyFullHighlights = shelbyFullManifest.modules.find((module) => module.type === 'highlights');
const shelbyFullPlan = shelbyFullManifest.modules.find((module) => module.type === 'planVisit');
assert(
  shelbyFullWhyGo?.type === 'whyGo'
  && shelbyFullSchedule?.type === 'schedule'
  && shelbyFullHighlights?.type === 'highlights'
  && shelbyFullPlan?.type === 'planVisit',
);
shelbyFullWhyGo.headline = 'Original work fills a shaded park instead of a convention aisle.';
shelbyFullWhyGo.summary = 'The juried fair combines artist booths, marketplace vendors, music, food, and a hands-on children’s area.';
shelbyFullSchedule.subtitle = 'Use the two official event-day listings to choose a Saturday or Sunday visit.';
shelbyFullHighlights.headline = 'Start with original work, then find the parts of the fair that move and make noise.';
shelbyFullHighlights.summary = 'Artist booths anchor the visit while music, food, and children’s activities create natural breaks.';
shelbyFullPlan.subtitle = 'River Bends Park is the fixed point for both days of the fair.';
shelbyFullManifest.scoutSuggestions = [
  {
    id: 'scout-original-work',
    label: 'How large is the artist marketplace?',
    response: 'The fair brings together more than 120 artist and marketplace vendors.',
    scopeModuleIds: ['why-go', 'highlights'],
    command: { type: 'openModule', moduleId: 'highlights' },
    sourceIds: [shelbyManifest.sources[0].id],
  },
  {
    id: 'scout-family',
    label: 'What can children do?',
    response: 'A dedicated craft and activity area gives children a hands-on stop between the booths.',
    scopeModuleIds: ['why-go', 'highlights'],
    command: { type: 'openModule', moduleId: 'highlights' },
    sourceIds: [shelbyManifest.sources[0].id],
  },
];
const shelbyFullCitations = [
  'hero.tagline',
  `module.${shelbyFullWhyGo.id}.headline`,
  `module.${shelbyFullWhyGo.id}.summary`,
  `module.${shelbyFullSchedule.id}.subtitle`,
  `module.${shelbyFullHighlights.id}.headline`,
  `module.${shelbyFullHighlights.id}.summary`,
  `module.${shelbyFullPlan.id}.subtitle`,
  ...(shelbyFullSchedule.notes?.length ? [`module.${shelbyFullSchedule.id}.notes`] : []),
  ...(shelbyFullPlan.advisory ? [`module.${shelbyFullPlan.id}.advisory`] : []),
].map((path) => ({ path, sourceSnapshotIds: [shelbySnapshotId] }));
const shelbyFullEditorial = applyFullManifestEditorialOutput({
  parentSynthesisId: '00000000-0000-4000-8000-000000000005',
  provider: 'fixture-codex-session',
  model: 'fixture-ultra',
  input: shelbyInput,
  manifest: shelbyEditorial.manifest,
  output: {
    manifest: shelbyFullManifest,
    citations: shelbyFullCitations,
  },
});
assert.equal(shelbyFullEditorial.report.authoringMode, 'full_manifest');
assert.equal(shelbyFullEditorial.report.qualityChecks.fullManifestAuthored, true);
assert.equal(shelbyFullEditorial.report.qualityChecks.scheduleFactsLocked, true);
assert.deepEqual(
  shelbyFullEditorial.manifest.scheduleItems,
  shelbyEditorial.manifest.scheduleItems,
  'Full-manifest authorship must preserve every verified schedule row.',
);
assert.deepEqual(
  shelbyFullEditorial.manifest.identity,
  shelbyEditorial.manifest.identity,
  'Full-manifest authorship must preserve verified identity, dates, and location.',
);
assert(
  shelbyFullEditorial.manifest.navigation.some((item) => item.label === 'What to See'),
  'Full-manifest authorship must be able to make event-specific navigation decisions.',
);
assert.equal(
  shelbyFullEditorial.manifest.scoutSuggestions[0].label,
  'How large is the artist marketplace?',
  'Full-manifest authorship must replace generic Scout structure with event-specific questions.',
);
assert.equal(validateEventPageContentReadiness(shelbyFullEditorial.manifest).ok, true);

const changedScheduleManifest = structuredClone(shelbyFullManifest);
changedScheduleManifest.scheduleItems[0].title = 'Invented schedule title';
assert.throws(
  () => applyFullManifestEditorialOutput({
    parentSynthesisId: '00000000-0000-4000-8000-000000000006',
    provider: 'fixture-codex-session',
    model: 'fixture-ultra',
    input: shelbyInput,
    manifest: shelbyEditorial.manifest,
    output: { manifest: changedScheduleManifest, citations: shelbyFullCitations },
  }),
  /protected event facts/,
  'A model-authored manifest must not change retained schedule facts.',
);

const unsupportedPlanningManifest = structuredClone(shelbyFullManifest);
const unsupportedPlan = unsupportedPlanningManifest.modules.find((module) => module.type === 'planVisit');
assert(unsupportedPlan?.type === 'planVisit');
unsupportedPlan.details[0].value = '99 complimentary valet parking stations';
assert.throws(
  () => applyFullManifestEditorialOutput({
    parentSynthesisId: '00000000-0000-4000-8000-000000000007',
    provider: 'fixture-codex-session',
    model: 'fixture-ultra',
    input: shelbyInput,
    manifest: shelbyEditorial.manifest,
    output: { manifest: unsupportedPlanningManifest, citations: shelbyFullCitations },
  }),
  /Unsupported full-manifest editorial claims were rejected/,
  'Unsupported model-authored visitor claims must block the complete manifest.',
);

const shellOnlyManifest = structuredClone(shelbyManifest);
shellOnlyManifest.navigation = shellOnlyManifest.navigation.filter((item) => item.targetModuleId !== 'highlights');
shellOnlyManifest.modules = shellOnlyManifest.modules.filter((module) => module.type !== 'highlights');
shellOnlyManifest.scoutSuggestions = [];
const shellOnlyContent = validateEventPageContentReadiness(shellOnlyManifest);
assert.equal(shellOnlyContent.ok, false, 'A three-topic shell must never pass new-package content readiness.');
assert(
  !shellOnlyContent.ok && shellOnlyContent.errors.some((error) => error.includes('four primary topics')),
  'The content gate must explain the missing fourth topic in plain language.',
);

const dateOnlyManifest = structuredClone(shelbyFullManifest);
dateOnlyManifest.scheduleItems = [];
const dateOnlySchedule = dateOnlyManifest.modules.find((module) => module.type === 'schedule');
assert(dateOnlySchedule?.type === 'schedule');
delete dateOnlySchedule.recurringEvents;
delete dateOnlySchedule.referenceSchedule;
dateOnlySchedule.sourceIds = [dateOnlyManifest.sources[0].id];
const dateOnlyContent = validateEventPageContentReadiness(dateOnlyManifest);
assert.equal(
  dateOnlyContent.ok,
  true,
  'A verified, source-backed edition date must remain package-ready when no current-edition start time is retained.',
);

console.log('Event source synthesis validations passed.');
