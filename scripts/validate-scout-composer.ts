import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BROWN_TROUT_EVENT_PAGE_MANIFEST } from '../data/brownTroutEventPageManifest.ts';
import {
  SCOUT_COMPOSER_CONTRACT_VERSION,
  createScoutComposerContext,
} from '../lib/scout/composerContext.ts';

const initialSectionId =
  BROWN_TROUT_EVENT_PAGE_MANIFEST.navigation[0]?.targetModuleId ?? '';
const defaultContext = createScoutComposerContext({
  manifest: BROWN_TROUT_EVENT_PAGE_MANIFEST,
  activeSectionId: initialSectionId,
});

assert.equal(defaultContext.contractVersion, SCOUT_COMPOSER_CONTRACT_VERSION);
assert.equal(defaultContext.eventId, BROWN_TROUT_EVENT_PAGE_MANIFEST.eventId);
assert.equal(defaultContext.packageId, BROWN_TROUT_EVENT_PAGE_MANIFEST.id);
assert.equal(defaultContext.packageVersion, BROWN_TROUT_EVENT_PAGE_MANIFEST.publishedAt);
assert.equal(defaultContext.sourceKind, 'transition-manifest');
assert.equal(defaultContext.activeSectionId, initialSectionId);

const reviewedPackageContext = createScoutComposerContext({
  manifest: BROWN_TROUT_EVENT_PAGE_MANIFEST,
  contentReference: {
    sourceKind: 'event-factory-package',
    packageId: 'package-review-fixture',
    packageVersion: '4',
  },
  activeSectionId: 'schedule',
});

assert.deepEqual(reviewedPackageContext, {
  contractVersion: 1,
  eventId: BROWN_TROUT_EVENT_PAGE_MANIFEST.eventId,
  packageId: 'package-review-fixture',
  packageVersion: '4',
  sourceKind: 'event-factory-package',
  activeSectionId: 'schedule',
});

const eventHubSource = readFileSync(
  new URL('../components/EventHub.tsx', import.meta.url),
  'utf8',
);
const eventHubStyles = readFileSync(
  new URL('../components/EventHub.module.css', import.meta.url),
  'utf8',
);

for (const removedComposerBehavior of [
  'scopedScoutSuggestions',
  'runScoutSuggestion',
  'getScoutResponse',
  'normalizedQuery.includes',
]) {
  assert(
    !eventHubSource.includes(removedComposerBehavior),
    `Ask Scout still includes legacy event-specific behavior: ${removedComposerBehavior}.`,
  );
}

for (const contextField of [
  'data-scout-event-id',
  'data-scout-package-id',
  'data-scout-package-version',
  'data-scout-active-section-id',
]) {
  assert(
    eventHubSource.includes(contextField),
    `Scout composer does not expose ${contextField}.`,
  );
}

assert(
  /\.scoutForm input:not\(\[type='hidden'\]\)[\s\S]*?font-size:\s*1rem;/.test(
    eventHubStyles,
  ),
  'Scout composer input must remain at least 16px to prevent iOS focus zoom.',
);
assert(
  /\.scoutForm button[\s\S]*?min-width:\s*48px;[\s\S]*?min-height:\s*48px;/.test(
    eventHubStyles,
  ),
  'Scout send control must preserve a minimum 44px target.',
);
assert(
  eventHubStyles.includes('var(--scout-keyboard-inset)'),
  'Scout composer is not anchored to the visual keyboard inset.',
);
assert(
  eventHubStyles.includes('background-color: rgba(5, 44, 52, 0.72);'),
  'Scout composer translucency contract changed.',
);

console.log('Scout composer contract validation passed.');
