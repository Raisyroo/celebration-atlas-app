import assert from 'node:assert/strict';
import { ATLAS_EVENTS } from '../data/events.ts';
import {
  DEFAULT_EVENT_HUB_HOME_LINK,
  resolveEventHubHomeLink,
} from '../data/eventHubNavigation.ts';
import { getFlyerEventPresentation } from '../data/flyerEventPresentation.ts';
import { getEventMarkerPresentation } from '../data/eventMarkerPresentation.ts';
import { deriveSafeAtlasEventCard } from '../data/safeEventCard.ts';
import { resolveEventThumbnailPresentation } from '../data/eventThumbnail.ts';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes.ts';
import type { EventProfile } from '../data/eventProfileTypes.ts';

function eventById(eventId: string) {
  const event = ATLAS_EVENTS.find((candidate) => candidate.id === eventId);
  assert.ok(event, `missing fixture event ${eventId}`);
  return event;
}

const armada = eventById('armada-fair');
const armadaCard = deriveSafeAtlasEventCard(armada);
assert.equal(armadaCard.media, undefined, 'missing media keeps the generic text card');
assert.equal(armadaCard.detailAction, undefined, 'unmanifested events do not advertise a legacy detail route');
assert.deepEqual(
  resolveEventThumbnailPresentation(armada),
  { kind: 'fallback', glyph: '🎡', label: 'Fairs fallback visual' },
  'missing thumbnails use the asset-independent event glyph',
);
const basicMarkerProfile = {
  coverageLevel: 'basicNationalCoverage',
  trust: { confidenceScore: 0.35 },
} as EventProfile;
assert.equal(
  getEventMarkerPresentation(basicMarkerProfile).intensity,
  'standard',
  'generic thumbnail fallback does not change the established map marker intensity',
);
assert.equal(
  getEventMarkerPresentation({
    ...basicMarkerProfile,
    media: [{ id: 'reviewed-media', slot: 'thumbnailImage', kind: 'image', src: '/reviewed.webp' }],
  }).intensity,
  'standard',
  'media availability does not compete with marker coverage styling',
);
const mackinac = eventById('mackinac-lilac');
const mackinacCard = deriveSafeAtlasEventCard(mackinac);
assert.equal(
  getFlyerEventPresentation(mackinacCard).isFlyerFirst,
  false,
  'an explicit thumbnail remains ordinary generic-card media',
);
assert.equal(mackinacCard.media?.mediaSrc, mackinac.cardMedia?.thumbnailSrc);

const goodellsCard = deriveSafeAtlasEventCard(eventById('goodells-fair'));
assert.equal(
  goodellsCard.detailAction,
  undefined,
  'detailPage and pageArchetype metadata do not activate an experimental layout',
);

const manifestEvent = eventById('detroit-jazz');
assert.deepEqual(
  deriveSafeAtlasEventCard(manifestEvent).detailAction,
  { label: 'Open full event', href: '/events/detroit-jazz' },
  'manifest events retain their Event Hub route',
);

const hostedFlyerResolutions: EventFlyerResolutionMap = {
  [armada.id]: {
    eventId: armada.id,
    mediaRole: 'flyer',
    src: 'https://media.example.test/armada-approved-flyer.webp',
    source: 'supabase',
    fallbackUsed: false,
    canonicalSlug: armada.id,
    officialUrl: 'https://armada.example.test',
  },
};
const hostedFlyerCard = deriveSafeAtlasEventCard(armada, hostedFlyerResolutions);
assert.equal(getFlyerEventPresentation(hostedFlyerCard).isFlyerFirst, true);
assert.equal(getFlyerEventPresentation(hostedFlyerCard).hasOfficialHotspot, true);
assert.deepEqual(
  getFlyerEventPresentation(hostedFlyerCard, null),
  { isFlyerFirst: false, hasOfficialHotspot: false },
  'a failed flyer source returns to the universal generic-card presentation',
);

assert.equal(
  getEventMarkerPresentation({
    ...basicMarkerProfile,
    coverageLevel: 'practicalEventPage',
  }).intensity,
  'active',
  'practical event markers retain their established emphasis without fabricated media',
);

const failedMackinacThumbnail = resolveEventThumbnailPresentation(
  mackinac,
  mackinac.cardMedia?.thumbnailSrc,
);
assert.deepEqual(
  failedMackinacThumbnail,
  { kind: 'fallback', glyph: '✿', label: 'Festivals fallback visual' },
  'a failed explicit thumbnail falls back to the event glyph',
);

assert.deepEqual(resolveEventHubHomeLink(), DEFAULT_EVENT_HUB_HOME_LINK);
assert.deepEqual(
  resolveEventHubHomeLink({ href: '/atlas-control', label: 'Atlas Control' }),
  { href: '/atlas-control', label: 'Atlas Control' },
  'private previews can supply an explicit authoring destination',
);

console.log('Universal event interface validation passed.');
