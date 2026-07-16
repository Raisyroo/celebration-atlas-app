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
  'Composer preview:',
  'Question kept in this composer.',
]) {
  assert(
    !eventHubSource.includes(removedComposerBehavior),
    `Ask Scout still includes legacy event-specific behavior: ${removedComposerBehavior}.`,
  );
}

assert(
  eventHubSource.includes('Verified guidance for this event'),
  'Scout composer no longer uses the existing helper subtitle.',
);
assert(
  eventHubSource.includes('isScoutInputFocused || Boolean(scoutQuery)'),
  'Scout composer does not preserve its active state while focused or populated.',
);
assert(
  eventHubSource.includes('placeholder=""'),
  'Scout input still supplies visible placeholder text.',
);
assert(
  eventHubSource.includes('SCOUT_DEMO_RESPONSE') &&
    eventHubSource.includes('universal Scout intelligence service is not connected yet'),
  'Scout composer does not expose the explicit disconnected-service demo response.',
);
assert(
  eventHubSource.includes('setSubmittedScoutQuestion(trimmedQuery)'),
  'Scout submit does not reveal the generic response preview.',
);
assert(
  eventHubSource.includes('data-scout-response-mode="demo"') &&
    eventHubSource.includes('role="status"') &&
    eventHubSource.includes('aria-live="polite"') &&
    eventHubSource.includes(
      'submittedScoutQuestion ? styles.scoutResponse : styles.srOnly',
    ),
  'Scout demo response does not expose its accessible preview contract.',
);

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
  /\.scoutForm button[\s\S]*?min-width:\s*50px;[\s\S]*?min-height:\s*50px;/.test(
    eventHubStyles,
  ),
  'Scout send control must preserve a minimum 44px target.',
);
assert(
  /\.scoutForm input:not\(\[type='hidden'\]\)[\s\S]*?border:\s*0;[\s\S]*?background:\s*transparent;/.test(
    eventHubStyles,
  ),
  'Scout input must remain borderless and transparent inside the single outer composer.',
);
assert(
  !eventHubStyles.includes('.scoutHeader'),
  'Scout composer still uses a stacked header above the input row.',
);
assert(
  eventHubStyles.includes('var(--scout-keyboard-inset)'),
  'Scout composer is not anchored to the visual keyboard inset.',
);
assert(
  eventHubStyles.includes('background-color: rgba(5, 44, 52, 0.72);'),
  'Scout composer translucency contract changed.',
);
assert(
  /\.scoutResponse[\s\S]*?max-height:\s*132px;[\s\S]*?overflow-y:\s*auto;/.test(
    eventHubStyles,
  ),
  'Scout response preview does not preserve a bounded, scroll-safe mobile layout.',
);
assert(
  /\.rootWithScoutResponse[\s\S]*?--hub-scout-clearance:\s*224px;/.test(
    eventHubStyles,
  ),
  'Scout response preview does not reserve content clearance for the taller dock.',
);

console.log('Scout composer contract validation passed.');
