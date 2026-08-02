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
const eventHubCallSites = [
  '../app/events/[id]/page.tsx',
  '../app/dev/event-package-preview/[packageId]/page.tsx',
  '../app/atlas-control/synthesis-preview/[synthesisId]/page.tsx',
  '../app/event-preview/[packageId]/page.tsx',
] as const;

for (const removedComposerBehavior of [
  'scopedScoutSuggestions',
  'runScoutSuggestion',
  'getScoutResponse',
  'normalizedQuery.includes',
  'Composer preview:',
  'Question kept in this composer.',
  'submittedScoutQuestion',
  'setSubmittedScoutQuestion',
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
  eventHubSource.includes(
    'const [scoutConversation, setScoutConversation] = useState<ScoutDemoTurn[]>([])',
  ),
  'Scout composer does not retain an ordered, component-local conversation.',
);
assert(
  eventHubSource.includes(
    'const [isScoutHistoryVisible, setIsScoutHistoryVisible] = useState(false)',
  ),
  'Scout conversation visibility must remain presentation state separate from retained turns.',
);

const submitScoutQueryMatch = eventHubSource.match(
  /const submitScoutQuery = \(event: FormEvent<HTMLFormElement>\) => \{[\s\S]*?\n  \};/,
);
assert(submitScoutQueryMatch, 'Scout submit handler could not be inspected.');
const submitScoutQuerySource = submitScoutQueryMatch[0];
assert(
  /setScoutConversation\(\((\w+)\)\s*=>\s*\[[\s\S]*?\.\.\.\1\s*,[\s\S]*?question:\s*trimmedQuery,[\s\S]*?answer:\s*SCOUT_DEMO_RESPONSE,[\s\S]*?\]\);/.test(
    submitScoutQuerySource,
  ),
  'Each valid Scout submit must append the question and generic demo answer.',
);
assert(
  submitScoutQuerySource.includes('setIsScoutHistoryVisible(true)') &&
    submitScoutQuerySource.includes("setScoutQuery('')") &&
    submitScoutQuerySource.includes('setIsScoutInputFocused(false)') &&
    submitScoutQuerySource.includes('scoutInputRef.current?.blur()'),
  'Scout submit must reopen history, clear the composer, clear its focus state, and dismiss the keyboard.',
);
const emptyQueryReturnIndex = submitScoutQuerySource.indexOf('return;');
assert(
  emptyQueryReturnIndex >= 0 &&
    !submitScoutQuerySource
      .slice(emptyQueryReturnIndex + 'return;'.length)
      .includes('scoutInputRef.current?.focus'),
  'A valid Scout submit must not refocus the text input after dismissing the keyboard.',
);
assert(
  !submitScoutQuerySource.includes('requestAnimationFrame') &&
    !eventHubSource.includes('onMouseDown={(event) => event.preventDefault()}'),
  'Scout submit still preserves or restores text-input focus.',
);

const dismissScoutHistoryMatch = eventHubSource.match(
  /const dismissScoutHistory = \(\) => \{[\s\S]*?\n  \};/,
);
assert(
  dismissScoutHistoryMatch,
  'Scout conversation dismissal handler could not be inspected.',
);
const dismissScoutHistorySource = dismissScoutHistoryMatch[0];
assert(
  dismissScoutHistorySource.includes('setIsScoutHistoryVisible(false)') &&
    dismissScoutHistorySource.includes('setIsScoutInputFocused(false)') &&
    dismissScoutHistorySource.includes('scoutInputRef.current?.blur()') &&
    dismissScoutHistorySource.includes(
      'scoutSubmitButtonRef.current?.focus({ preventScroll: true })',
    ),
  'Dismissing Scout history must hide it, dismiss the keyboard, and restore focus to the send control.',
);
assert(
  !dismissScoutHistorySource.includes('setScoutConversation') &&
    !/\bsetScoutConversation\(\s*\[\s*\]\s*\)/.test(eventHubSource),
  'Dismissing Scout history must never clear the retained same-event conversation.',
);

const activateScoutInputMatch = eventHubSource.match(
  /const activateScoutInput = \(\) => \{[\s\S]*?\n  \};/,
);
assert(
  activateScoutInputMatch,
  'Scout input activation handler could not be inspected.',
);
assert(
  activateScoutInputMatch[0].includes('setIsScoutInputFocused(true)') &&
    /if\s*\(\s*scoutConversation\.length\s*>\s*0\s*\)\s*\{[\s\S]*?setIsScoutHistoryVisible\(true\)/.test(
      activateScoutInputMatch[0],
    ),
  'Focusing Scout must reopen retained history when the current event has prior turns.',
);

const scoutHistoryScrollEffectMatch = eventHubSource.match(
  /useEffect\(\(\) => \{\s*const history = scoutHistoryRef\.current;[\s\S]*?\}, \[([^\]]+)\]\);/,
);
assert(
  scoutHistoryScrollEffectMatch &&
    scoutHistoryScrollEffectMatch[0].includes('!isScoutHistoryVisible') &&
    scoutHistoryScrollEffectMatch[0].includes(
      'history.scrollTop = history.scrollHeight',
    ) &&
    /\bisScoutHistoryVisible\b/.test(scoutHistoryScrollEffectMatch[1]) &&
    /\bscoutConversation\.length\b/.test(scoutHistoryScrollEffectMatch[1]),
  'Scout auto-scroll must run only for visible history and respond to both visibility and turn count.',
);

const scoutInputMatch = eventHubSource.match(
  /<input[\s\S]*?id="scout-event-question"[\s\S]*?\/>/,
);
assert(scoutInputMatch, 'Scout question input could not be inspected.');
assert(
  scoutInputMatch[0].includes(
    'onChange={(event) => setScoutQuery(event.target.value)}',
  ) &&
    scoutInputMatch[0].includes('onFocus={activateScoutInput}') &&
    !scoutInputMatch[0].includes('setScoutConversation'),
  'Editing and refocusing Scout must preserve and reopen the same-event conversation history.',
);

assert(
  /const hasVisibleScoutHistory\s*=\s*isScoutHistoryVisible\s*&&\s*scoutConversation\.length\s*>\s*0;/.test(
    eventHubSource,
  ) &&
    /hasVisibleScoutHistory\s*\?\s*`\s*\$\{styles\.rootWithScoutResponse\}`\s*:\s*''/.test(
      eventHubSource,
    ) &&
    eventHubSource.includes('{hasVisibleScoutHistory ? (') &&
    eventHubSource.includes(
      "data-scout-history-visible={hasVisibleScoutHistory ? 'true' : 'false'}",
    ),
  'Scout history rendering and content clearance must depend on both retained turns and visible presentation state.',
);

const scoutHistoryMatch = eventHubSource.match(
  /<ol[\s\S]*?className=\{styles\.scoutResponse\}[\s\S]*?<\/ol>/,
);
assert(scoutHistoryMatch, 'Scout conversation history could not be inspected.');
assert(
  scoutHistoryMatch[0].includes('data-scout-response-mode="demo"') &&
    scoutHistoryMatch[0].includes('id="scout-conversation-history"') &&
    scoutHistoryMatch[0].includes('aria-label="Scout conversation history"') &&
    scoutHistoryMatch[0].includes('tabIndex={0}') &&
    scoutHistoryMatch[0].includes('scoutConversation.map((turn)') &&
    scoutHistoryMatch[0].includes('{turn.question}') &&
    scoutHistoryMatch[0].includes('{turn.answer}') &&
    !scoutHistoryMatch[0].includes('role="status"') &&
    !scoutHistoryMatch[0].includes('aria-live='),
  'Scout demo history must render every turn without acting as the live announcement region.',
);

const scoutHistoryCloseClassIndex = eventHubSource.indexOf(
  'className={styles.scoutHistoryClose}',
);
assert(
  scoutHistoryCloseClassIndex >= 0,
  'Scout conversation history does not expose a close control.',
);
const scoutHistoryCloseStart = eventHubSource.lastIndexOf(
  '<button',
  scoutHistoryCloseClassIndex,
);
const scoutHistoryCloseEnd = eventHubSource.indexOf(
  '</button>',
  scoutHistoryCloseClassIndex,
);
assert(
  scoutHistoryCloseStart >= 0 && scoutHistoryCloseEnd >= 0,
  'Scout conversation close button could not be inspected.',
);
const scoutHistoryCloseSource = eventHubSource.slice(
  scoutHistoryCloseStart,
  scoutHistoryCloseEnd + '</button>'.length,
);
assert(
  scoutHistoryCloseSource.includes('type="button"') &&
    scoutHistoryCloseSource.includes(
      'aria-label="Hide Scout conversation history"',
    ) &&
    scoutHistoryCloseSource.includes(
      'aria-controls="scout-conversation-history"',
    ) &&
    scoutHistoryCloseSource.includes('onClick={dismissScoutHistory}') &&
    /<X\b[\s\S]*?aria-hidden="true"/.test(scoutHistoryCloseSource),
  'Scout history close control must be an accessible X button connected to the history region.',
);
assert(
  /\.scoutResponse:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--hub-gold-soft\);[^}]*outline-offset:\s*-3px;/.test(
    eventHubStyles,
  ),
  'Scrollable Scout history must preserve a visible keyboard focus indicator.',
);
const scoutHistoryEndIndex =
  eventHubSource.indexOf(scoutHistoryMatch[0]) + scoutHistoryMatch[0].length;
const scoutAnnouncerMatch = eventHubSource
  .slice(scoutHistoryEndIndex)
  .match(
    /<(?:div|p)[\s\S]*?className=\{styles\.srOnly\}[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?latestScoutTurn[\s\S]*?<\/(?:div|p)>/,
  );
assert(
  scoutAnnouncerMatch,
  'Scout history must use a separate screen-reader-only polite latest-turn announcement.',
);
assert(
  eventHubSource.includes('history.scrollTop = history.scrollHeight'),
  'Scout conversation history does not keep the latest appended turn in view.',
);

const getStyleRule = (selector: string) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = eventHubStyles.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
  );
  assert(match, `${selector} style contract could not be inspected.`);
  return match[1];
};

const scoutHistoryRule = getStyleRule('.scoutHistory');
const scoutTurnRule = getStyleRule('.scoutTurn');
for (const [selector, rule] of [
  ['.scoutHistory', scoutHistoryRule],
  ['.scoutTurn', scoutTurnRule],
] as const) {
  assert(
    !/(?:background(?:-color)?|border-radius|box-shadow)\s*:/.test(rule),
    `${selector} must not introduce a nested panel box inside the shared Scout dock.`,
  );
}

const scoutHistoryCloseRule = getStyleRule('.scoutHistoryClose');
assert(
  /position:\s*absolute;/.test(scoutHistoryCloseRule) &&
    /top:\s*\d+(?:\.\d+)?px;/.test(scoutHistoryCloseRule) &&
    /right:\s*\d+(?:\.\d+)?px;/.test(scoutHistoryCloseRule),
  'Scout history close control must remain anchored at the top right of the response area.',
);
assert(
  /min-width:\s*44px;/.test(scoutHistoryCloseRule) &&
    /min-height:\s*44px;/.test(scoutHistoryCloseRule),
  'Scout history close control must preserve a minimum 44px target.',
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

for (const callSitePath of eventHubCallSites) {
  const callSiteSource = readFileSync(new URL(callSitePath, import.meta.url), 'utf8');
  const eventHubElement = callSiteSource.match(/<EventHub\b[\s\S]*?\/>/)?.[0];
  assert(
    eventHubElement && /key=\{[^}]*\.eventId\}/.test(eventHubElement),
    `${callSitePath} must key EventHub by event ID so Scout history resets on event changes.`,
  );
}

const combinedReviewSource = readFileSync(
  new URL('../app/atlas-control/event-preview/[packageId]/EventReviewDesk.tsx', import.meta.url),
  'utf8',
);
assert(
  combinedReviewSource.includes('src={previewUrl}')
    && combinedReviewSource.includes('/event-preview/${review.package.id}'),
  'Combined package review must embed the keyed read-only EventHub preview.',
);

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
  /\.scoutResponse\s*\{[^}]*max-height:\s*min\(42dvh,\s*300px\);[^}]*overflow-y:\s*auto;/.test(
    eventHubStyles,
  ),
  'Scout conversation history does not preserve its bounded, scroll-safe layout.',
);
assert(
  /\.scoutDock\[data-scout-input-focused='true'\]\s+\.scoutResponse\s*\{[^}]*max-height:\s*min\(24dvh,\s*160px\);/.test(
    eventHubStyles,
  ),
  'Focused Scout history does not contract to keep the composer visible above the keyboard.',
);
assert(
  /\.rootWithScoutResponse\s*\{[^}]*--hub-scout-clearance:\s*390px;/.test(
    eventHubStyles,
  ),
  'Scout conversation history does not reserve content clearance for the expanded dock.',
);
assert(
  /@media \(orientation:\s*landscape\) and \(max-height:\s*600px\) and \(max-width:\s*1024px\)[\s\S]*?\.rootWithScoutResponse\s*\{[^}]*--hub-scout-clearance:\s*220px;[\s\S]*?\.scoutResponse\s*\{[^}]*max-height:\s*min\(32dvh,\s*132px\);/.test(
    eventHubStyles,
  ),
  'Short phone landscape does not preserve bounded Scout history and content clearance.',
);

console.log('Scout composer contract validation passed.');
