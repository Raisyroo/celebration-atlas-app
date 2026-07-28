import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const outputDir = path.join(process.cwd(), 'artifacts', 'visual-smoke');
const homepageScreenshotPath = path.join(outputDir, 'homepage-mobile.png');
const resultCloudScreenshotPath = path.join(outputDir, 'map-search-result-text-cloud-desktop.png');
const exactEventScreenshotPath = path.join(outputDir, 'exact-event-hub-desktop.png');
const resultCloudMobileScreenshotPath = path.join(outputDir, 'map-search-result-text-cloud-mobile.png');
const noResultsMobileScreenshotPath = path.join(outputDir, 'map-search-no-results-mobile.png');
const experienceDeckMobileScreenshotPath = path.join(outputDir, 'atlas-experience-deck-mobile.png');
const eventHubMobileTabsScreenshotPath = path.join(outputDir, 'event-hub-mobile-tabs.png');
const scoutComposerPhonePortraitScreenshotPath = path.join(
  outputDir,
  'scout-composer-phone-portrait.png',
);
const scoutComposerKeyboardViewportScreenshotPath = path.join(
  outputDir,
  'scout-composer-keyboard-viewport.png',
);
const scoutComposerPhoneLandscapeScreenshotPath = path.join(
  outputDir,
  'scout-composer-phone-landscape.png',
);
const scoutComposerTabletScreenshotPath = path.join(
  outputDir,
  'scout-composer-tablet.png',
);
const scoutComposerDesktopScreenshotPath = path.join(
  outputDir,
  'scout-composer-desktop.png',
);
const atlasControlScreenshotPath = path.join(outputDir, 'atlas-control-unauthenticated.png');
const baseUrl = process.env.VISUAL_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const shouldStartServer = !process.env.VISUAL_SMOKE_BASE_URL;
const shouldRunExperienceDeck = process.env.VISUAL_SMOKE_EXPERIENCE_DECK === '1';
const homepageUrl = new URL('/', baseUrl).toString();
const atlasLoginUrl = new URL('/atlas-login', baseUrl).toString();
const atlasControlUrl = new URL('/atlas-control', baseUrl).toString();
const npmExecPath = process.env.npm_execpath;
const visualSmokeTime = new Date('2026-07-15T16:00:00Z');
const scoutGenericResponse =
  'Thanks for asking. This is a generic Scout response so you can review how answers will appear here. The universal Scout intelligence service is not connected yet.';
const atlasRootSelector =
  '[data-state-slug="michigan"][data-presentation-profile="michigan-illustrated-map-v1"]';
const atlasViewportFixtures = Object.freeze([
  { label: 'phone portrait', width: 390, height: 844, mode: 'portrait', artworkVariant: 'mobile' },
  { label: 'phone landscape', width: 844, height: 390, mode: 'compact-landscape', artworkVariant: 'desktop' },
  { label: 'short desktop landscape', width: 1024, height: 390, mode: 'compact-landscape', artworkVariant: 'desktop' },
  { label: 'tablet portrait', width: 768, height: 1024, mode: 'portrait', artworkVariant: 'mobile' },
  { label: 'desktop boundary', width: 1024, height: 768, mode: 'desktop', artworkVariant: 'desktop' },
  { label: 'wide desktop', width: 1440, height: 900, mode: 'desktop', artworkVariant: 'desktop' },
]);
const scoutComposerReviewFixtures = Object.freeze([
  {
    label: 'phone portrait',
    width: 390,
    height: 844,
    screenshotPath: scoutComposerPhonePortraitScreenshotPath,
  },
  {
    label: 'keyboard-reduced phone portrait',
    width: 390,
    height: 430,
    screenshotPath: scoutComposerKeyboardViewportScreenshotPath,
    exerciseKeyboard: true,
  },
  {
    label: 'short phone landscape',
    width: 844,
    height: 390,
    screenshotPath: scoutComposerPhoneLandscapeScreenshotPath,
  },
  {
    label: 'tablet portrait',
    width: 768,
    height: 1024,
    screenshotPath: scoutComposerTabletScreenshotPath,
  },
]);
const searchReviewFixtures = Object.freeze([
  {
    label: 'category',
    query: 'music festivals',
    expectedEventIds: [
      'common-ground-lansing',
      'detroit-jazz',
      'electric-forest',
      'faster-horses',
      'muskegon-summer-celebration',
    ],
  },
  { label: 'city', query: 'events in Detroit', expectedEventIds: ['detroit-jazz'] },
  {
    label: 'month',
    query: 'events in September',
    expectedEventIds: ['detroit-jazz', 'romeo-peach-festival'],
  },
  {
    label: 'Michigan region',
    query: 'events in Detroit Metro',
    expectedEventIds: ['armada-fair', 'detroit-jazz', 'romeo-peach-festival'],
  },
  {
    label: 'live or upcoming status',
    query: 'upcoming events',
    expectedRailResults: true,
  },
  {
    label: 'combined intent',
    query: 'music events in Detroit in September',
    expectedEventIds: ['detroit-jazz'],
  },
]);
const noResultsSearchFixture = Object.freeze({
  label: 'no results',
  query: 'events in Kalamazoo in February',
});

let server;
let browser;
const browserErrors = [];

function captureBrowserErrors(page, label) {
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const error = `[${label}:console] ${message.text()}`;
    browserErrors.push(error);
    console.error(error);
  });
  page.on('pageerror', (error) => {
    const message = `[${label}:pageerror] ${error.message}`;
    browserErrors.push(message);
    console.error(message);
  });
}

async function waitForServer(url, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status} from ${url}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function waitForLoadedImage(page, selector, timeoutMs = 45_000) {
  await page.waitForFunction(
    (imageSelector) => {
      const image = document.querySelector(imageSelector);
      return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    },
    selector,
    { timeout: timeoutMs },
  );
}

async function submitAtlasSearch(page, query) {
  const input = page.getByLabel('Ask Celebration Atlas');
  await input.waitFor({ state: 'visible', timeout: 45_000 });
  await input.fill(query);
  await input.press('Enter');
}

async function waitForHomepageRailReady(page, timeoutMs = 45_000) {
  const failureMessage =
    'Timed out waiting for homepage mobile rail artwork readiness: expected visible rail, first visible card, no visible loading/placeholder/overlay in that card, and a loaded image or stable fallback.';

  try {
    await page.waitForFunction(
      () => {
        const isVisible = (element) => {
          const style = window.getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return (
            style.visibility !== 'hidden' &&
            style.display !== 'none' &&
            Number(style.opacity) > 0.01 &&
            rect.width > 0 &&
            rect.height > 0
          );
        };

        const rail = document.querySelector(
          '.mobile-live-sheet[data-layout-ready="true"][data-testid="event-rail"]',
        );

        if (!(rail instanceof HTMLElement) || !isVisible(rail)) return false;

        const firstVisibleCard = Array.from(rail.querySelectorAll('.mobile-live-card')).find(
          (card) => card instanceof HTMLElement && isVisible(card),
        );

        if (!(firstVisibleCard instanceof HTMLElement)) return false;

        const unsettledArtwork = Array.from(firstVisibleCard.querySelectorAll('*')).some((element) => {
          if (!(element instanceof HTMLElement) || !isVisible(element)) return false;

          const markerText = [
            element.getAttribute('aria-label'),
            element.getAttribute('role'),
            element.getAttribute('class'),
            element.getAttribute('data-state'),
            element.getAttribute('data-loading'),
            element.textContent,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return (
            element.getAttribute('aria-busy') === 'true' ||
            markerText.includes('progressbar') ||
            markerText.includes('spinner') ||
            markerText.includes('skeleton') ||
            markerText.includes('placeholder') ||
            markerText.includes('loading') ||
            markerText.includes('overlay')
          );
        });

        if (unsettledArtwork) return false;

        const image = firstVisibleCard.querySelector('img');
        if (image instanceof HTMLImageElement) {
          return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
        }

        const fallback = firstVisibleCard.querySelector('[role="img"], [aria-label*="fallback visual" i]');
        return fallback instanceof HTMLElement && isVisible(fallback);
      },
      { timeout: timeoutMs },
    );
  } catch (error) {
    throw new Error(`${failureMessage} ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function waitForViewportContract(page, fixture, timeoutMs = 45_000) {
  const selector = `${atlasRootSelector}[data-viewport-mode="${fixture.mode}"][data-artwork-variant="${fixture.artworkVariant}"]`;
  const atlasRoot = page.locator(selector);
  await atlasRoot.waitFor({ state: 'visible', timeout: timeoutMs });
  return atlasRoot;
}

async function assertEssentialHomepageControls(page, fixture) {
  await page.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await page.getByRole('button', { name: 'Submit Atlas question' }).waitFor({ state: 'visible', timeout: 45_000 });

  const obsoleteFilterControls = page.locator(
    [
      '[id^="desktop-atlas-filter-"]',
      '[id^="mobile-atlas-filter-"]',
      'button[aria-label^="Open atlas filters"]',
      '[role="dialog"][aria-label="Filters"]',
    ].join(','),
  );
  if (await obsoleteFilterControls.count()) {
    throw new Error(`${fixture.label}: search-first homepage rendered obsolete filter controls.`);
  }

  if (fixture.mode !== 'desktop') {
    await page
      .getByRole('button', { name: /^Open Michigan atlas menu$/ })
      .waitFor({ state: 'visible', timeout: 45_000 });
  }
}

async function assertNoHorizontalOverflow(page, label) {
  try {
    await page.waitForFunction(
      () => {
        const documentWidth = Math.max(
          document.documentElement.scrollWidth,
          document.body?.scrollWidth ?? 0,
        );
        return documentWidth <= document.documentElement.clientWidth + 1;
      },
      undefined,
      { timeout: 10_000 },
    );
  } catch (error) {
    const dimensions = await page.evaluate(() => ({
      bodyScrollWidth: document.body?.scrollWidth ?? 0,
      clientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    throw new Error(
      `${label} has horizontal page overflow: ${JSON.stringify(dimensions)}. ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}

async function assertLiveUpcomingRail(page, label) {
  await waitForHomepageRailReady(page);
  const railSnapshot = await page
    .locator('[data-testid="event-rail"] .mobile-live-card')
    .evaluateAll((cards) =>
      cards.map((card) => {
        const status = Array.from(card.querySelectorAll('span'))
          .map((element) => element.textContent?.trim())
          .find((text) => text === 'LIVE' || text === 'UPCOMING');
        return {
          label: card.getAttribute('aria-label'),
          status: status ?? null,
        };
      }),
    );

  if (railSnapshot.length === 0) {
    throw new Error(`${label} should expose at least one live or upcoming event card.`);
  }

  const invalidCards = railSnapshot.filter(
    (card) => card.status !== 'LIVE' && card.status !== 'UPCOMING',
  );
  if (invalidCards.length > 0) {
    throw new Error(
      `${label} rail contains cards without an exact LIVE or UPCOMING badge: ${JSON.stringify(invalidCards)}.`,
    );
  }

  return railSnapshot;
}

async function assertHomepageViewport(page, fixture, { checkRail = true } = {}) {
  await waitForViewportContract(page, fixture);
  await page.locator('.atlas-map-frame').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('img.atlas-map-image[alt="Michigan Atlas"]').waitFor({ state: 'visible', timeout: 45_000 });
  await waitForLoadedImage(page, 'img.atlas-map-image[alt="Michigan Atlas"]');
  await assertEssentialHomepageControls(page, fixture);
  await assertNoHorizontalOverflow(page, `${fixture.width}x${fixture.height} ${fixture.label}`);

  if (checkRail && fixture.mode !== 'desktop') {
    await assertLiveUpcomingRail(page, `${fixture.width}x${fixture.height} ${fixture.label}`);
  }

  console.log(
    `Homepage viewport contract passed at ${fixture.width}x${fixture.height}: ${fixture.mode}/${fixture.artworkVariant}.`,
  );
}

async function assertEventHubTabContract(page, label) {
  const tablist = page.getByRole('tablist', { name: 'Event sections' });
  await tablist.waitFor({ state: 'visible', timeout: 45_000 });

  const assertSelectedTab = async (expectedName) => {
    const selectedTabs = tablist.locator('[role="tab"][aria-selected="true"]');
    const selectedCount = await selectedTabs.count();
    if (selectedCount !== 1) {
      throw new Error(`${label}: expected one selected Event Hub tab, received ${selectedCount}.`);
    }

    const selectedTab = tablist.getByRole('tab', { name: expectedName, exact: true });
    if ((await selectedTab.getAttribute('aria-selected')) !== 'true') {
      throw new Error(`${label}: ${expectedName} did not become the selected Event Hub tab.`);
    }

    await selectedTab.evaluate(async (element) => {
      const deadline = performance.now() + 5_000;

      while (performance.now() < deadline) {
        const borderColor = window.getComputedStyle(element).borderBottomColor;
        if (borderColor !== 'rgba(0, 0, 0, 0)' && borderColor !== 'transparent') {
          return;
        }
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    });

    const contract = await selectedTab.evaluate((element) => {
      const style = window.getComputedStyle(element);
      const panelId = element.getAttribute('aria-controls');
      const panel = panelId ? document.getElementById(panelId) : null;

      return {
        borderRadius: style.borderRadius,
        borderTopWidth: style.borderTopWidth,
        borderRightWidth: style.borderRightWidth,
        borderBottomWidth: style.borderBottomWidth,
        borderBottomColor: style.borderBottomColor,
        borderLeftWidth: style.borderLeftWidth,
        panelLabelledBy: panel?.getAttribute('aria-labelledby') ?? null,
        tabId: element.id,
      };
    });

    if (
      contract.borderRadius !== '0px' ||
      contract.borderTopWidth !== '0px' ||
      contract.borderRightWidth !== '0px' ||
      contract.borderBottomWidth !== '3px' ||
      contract.borderLeftWidth !== '0px' ||
      contract.borderBottomColor === 'rgba(0, 0, 0, 0)' ||
      contract.borderBottomColor === 'transparent' ||
      contract.panelLabelledBy !== contract.tabId
    ) {
      throw new Error(`${label}: Event Hub tab contract failed: ${JSON.stringify(contract)}.`);
    }
  };

  const activateTab = async (tab) => {
    const tabId = await tab.getAttribute('id');
    await page.waitForFunction(
      (targetTabId) => {
        const target = targetTabId ? document.getElementById(targetTabId) : null;
        if (!(target instanceof HTMLButtonElement)) return false;
        if (target.getAttribute('aria-selected') === 'true') return true;
        target.click();
        return false;
      },
      tabId,
      { timeout: 45_000 },
    );
  };

  await assertSelectedTab('Why Go');
  const scheduleTab = tablist.getByRole('tab', { name: 'Schedule', exact: true });
  await activateTab(scheduleTab);
  await assertSelectedTab('Schedule');
  const whyGoTab = tablist.getByRole('tab', { name: 'Why Go', exact: true });
  await activateTab(whyGoTab);
  await assertSelectedTab('Why Go');

  const leakedHomepageClasses = await page.evaluate(() =>
    Array.from(document.body.classList).filter((className) => className.startsWith('home-')),
  );
  if (leakedHomepageClasses.length > 0) {
    throw new Error(`${label}: homepage body classes leaked into Event Hub: ${leakedHomepageClasses.join(', ')}.`);
  }
}

async function assertScoutComposerContract(
  page,
  label,
  expectedEventId,
  { exerciseKeyboard = false } = {},
) {
  const composer = page.locator('[data-testid="scout-composer"]');
  const form = composer.locator('[data-testid="scout-composer-form"]');
  const input = form.getByLabel(/Ask Scout about/i);
  const sendButton = form.getByRole('button', {
    name: 'Submit question to Scout composer',
    exact: true,
  });
  const helperSubtitle = composer.getByText('Verified guidance for this event', {
    exact: true,
  });
  const scoutTitle = composer.getByText('Ask Scout', { exact: true });

  await composer.waitFor({ state: 'visible', timeout: 45_000 });
  await input.waitFor({ state: 'visible', timeout: 45_000 });
  await sendButton.waitFor({ state: 'visible', timeout: 45_000 });
  await scoutTitle.waitFor({ state: 'visible', timeout: 45_000 });
  await helperSubtitle.waitFor({ state: 'visible', timeout: 45_000 });

  if (await composer.getByText(/Composer preview:|Question kept in this composer\./).count()) {
    throw new Error(`${label}: Scout composer rendered additional status copy.`);
  }
  if (
    await composer.locator(
      '[data-testid*="suggest" i], [data-scout-prompt], [data-prompt-tag], [class*="suggestionChip"]',
    ).count()
  ) {
    throw new Error(`${label}: Scout composer rendered removed suggestion or prompt controls.`);
  }

  const composerButtonCount = await composer.getByRole('button').count();
  if (composerButtonCount !== 1) {
    throw new Error(
      `${label}: Ask Scout must contain only the icon send control; received ${composerButtonCount} buttons.`,
    );
  }

  const selectedTab = page.locator('[role="tab"][aria-selected="true"]');
  const selectedPanelId = await selectedTab.getAttribute('aria-controls');
  const expectedSectionId = selectedPanelId?.replace(/^event-module-/, '') ?? null;
  const context = await composer.evaluate((element) => {
    const formElement = element.querySelector('[data-testid="scout-composer-form"]');
    if (!(formElement instanceof HTMLFormElement)) return null;
    const formData = new FormData(formElement);
    return {
      activeSectionId: element.getAttribute('data-scout-active-section-id'),
      contractVersion: element.getAttribute('data-scout-contract-version'),
      eventId: element.getAttribute('data-scout-event-id'),
      packageId: element.getAttribute('data-scout-package-id'),
      packageVersion: element.getAttribute('data-scout-package-version'),
      sourceKind: element.getAttribute('data-scout-source-kind'),
      hiddenActiveSectionId: formData.get('activeSectionId'),
      hiddenEventId: formData.get('eventId'),
      hiddenPackageId: formData.get('packageId'),
      hiddenPackageVersion: formData.get('packageVersion'),
    };
  });

  if (
    !context ||
    context.contractVersion !== '1' ||
    context.eventId !== expectedEventId ||
    !context.packageId ||
    !context.packageVersion ||
    !context.sourceKind ||
    context.activeSectionId !== expectedSectionId ||
    context.hiddenEventId !== context.eventId ||
    context.hiddenPackageId !== context.packageId ||
    context.hiddenPackageVersion !== context.packageVersion ||
    context.hiddenActiveSectionId !== context.activeSectionId
  ) {
    throw new Error(`${label}: Scout composer context contract failed: ${JSON.stringify(context)}.`);
  }

  const geometry = await composer.evaluate((element) => {
    const inputElement = element.querySelector('input[name="question"]');
    const buttonElement = element.querySelector('button[type="submit"]');
    if (!(inputElement instanceof HTMLInputElement) || !(buttonElement instanceof HTMLButtonElement)) {
      return null;
    }
    const composerRect = element.getBoundingClientRect();
    const inputRect = inputElement.getBoundingClientRect();
    const buttonRect = buttonElement.getBoundingClientRect();
    const composerStyle = window.getComputedStyle(element);
    const inputStyle = window.getComputedStyle(inputElement);
    const backgroundMatch = composerStyle.backgroundColor.match(
      /rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*([\d.]+))?\s*\)/,
    );
    return {
      backgroundAlpha: backgroundMatch?.[1] ? Number(backgroundMatch[1]) : 1,
      backgroundColor: composerStyle.backgroundColor,
      buttonHeight: buttonRect.height,
      buttonRight: buttonRect.right,
      buttonWidth: buttonRect.width,
      composerBottom: composerRect.bottom,
      composerLeft: composerRect.left,
      composerRight: composerRect.right,
      composerTop: composerRect.top,
      inputBackgroundColor: inputStyle.backgroundColor,
      inputBorderBottomWidth: inputStyle.borderBottomWidth,
      inputBorderLeftWidth: inputStyle.borderLeftWidth,
      inputBorderRightWidth: inputStyle.borderRightWidth,
      inputBorderTopWidth: inputStyle.borderTopWidth,
      inputFontSize: Number.parseFloat(inputStyle.fontSize),
      inputLeft: inputRect.left,
      inputRight: inputRect.right,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });

  if (
    !geometry ||
    geometry.composerLeft < -1 ||
    geometry.composerRight > geometry.viewportWidth + 1 ||
    geometry.composerTop < -1 ||
    geometry.composerBottom > geometry.viewportHeight + 1 ||
    geometry.inputLeft < -1 ||
    geometry.inputRight > geometry.viewportWidth + 1 ||
    geometry.buttonRight > geometry.viewportWidth + 1 ||
    geometry.buttonWidth < 44 ||
    geometry.buttonHeight < 44 ||
    geometry.inputFontSize < 16 ||
    geometry.inputBackgroundColor !== 'rgba(0, 0, 0, 0)' ||
    geometry.inputBorderTopWidth !== '0px' ||
    geometry.inputBorderRightWidth !== '0px' ||
    geometry.inputBorderBottomWidth !== '0px' ||
    geometry.inputBorderLeftWidth !== '0px' ||
    geometry.backgroundAlpha >= 1 ||
    geometry.backgroundAlpha < 0.5
  ) {
    throw new Error(`${label}: Scout composer viewport contract failed: ${JSON.stringify(geometry)}.`);
  }

  await assertNoHorizontalOverflow(page, `${label} Scout composer`);

  const question = 'What should I know before I go?';
  if (exerciseKeyboard) {
    await input.focus();
    await page.waitForFunction(
      () => document.querySelector('#scout-event-question')?.getAttribute('placeholder') === '',
      undefined,
      { timeout: 45_000 },
    );
    if ((await input.inputValue()) !== '') {
      throw new Error(`${label}: focusing the Scout field did not leave an empty input.`);
    }
    await scoutTitle.waitFor({ state: 'detached', timeout: 45_000 });
    await helperSubtitle.waitFor({ state: 'detached', timeout: 45_000 });
    await page.keyboard.press('Tab');
    if (!(await sendButton.evaluate((element) => element === document.activeElement))) {
      throw new Error(`${label}: keyboard focus did not move from the question field to send.`);
    }
    await page.keyboard.press('Shift+Tab');
    if (!(await input.evaluate((element) => element === document.activeElement))) {
      throw new Error(`${label}: reverse keyboard navigation did not return to the question field.`);
    }
  } else {
    await input.focus();
  }

  await input.fill(question);
  await input.press('Enter');
  const history = composer.getByRole('list', { name: 'Scout conversation history' });
  await history.waitFor({ state: 'visible', timeout: 45_000 });
  const turns = history.locator('li');
  if (
    (await turns.count()) !== 1 ||
    (await history.getAttribute('data-scout-response-mode')) !== 'demo' ||
    (await history.getAttribute('data-scout-turn-count')) !== '1' ||
    !(await turns.nth(0).getByText(question, { exact: true }).isVisible()) ||
    !(await turns.nth(0).getByText(scoutGenericResponse, { exact: true }).isVisible())
  ) {
    throw new Error(`${label}: Scout did not append the ordered generic conversation turn.`);
  }
  if ((await composer.getAttribute('data-scout-history-visible')) !== 'true') {
    throw new Error(`${label}: Scout conversation history did not become visible.`);
  }
  if ((await input.inputValue()) !== '') {
    throw new Error(`${label}: Scout did not clear the submitted question.`);
  }
  if (await input.evaluate((element) => element === document.activeElement)) {
    throw new Error(`${label}: Scout input retained focus after submission.`);
  }
  if (!(await sendButton.evaluate((element) => element === document.activeElement))) {
    throw new Error(`${label}: Scout send button did not receive focus after submission.`);
  }
  if ((await composer.getByRole('button').count()) !== 2) {
    throw new Error(`${label}: expanded Scout should expose only send and history-close buttons.`);
  }
  await assertNoHorizontalOverflow(page, `${label} expanded Scout history`);

  console.log(`${label}: Scout composer contract passed for ${expectedEventId}.`);
}

async function assertSamePageRotation(page) {
  const portrait = atlasViewportFixtures[0];
  const compactLandscape = atlasViewportFixtures[1];

  await page.setViewportSize({ width: compactLandscape.width, height: compactLandscape.height });
  await waitForViewportContract(page, compactLandscape);
  await assertEssentialHomepageControls(page, compactLandscape);
  await assertNoHorizontalOverflow(page, 'same-page portrait-to-landscape rotation');

  await page.setViewportSize({ width: portrait.width, height: portrait.height });
  await waitForViewportContract(page, portrait);
  await assertEssentialHomepageControls(page, portrait);
  await assertNoHorizontalOverflow(page, 'same-page landscape-to-portrait rotation');

  console.log('Same-page portrait/compact-landscape rotation preserved menu and search controls.');
}

async function readMapSearchEventIds(page) {
  return page
    .locator('.atlas-result-text-field[data-search-mode="results"] button')
    .evaluateAll((buttons) =>
      buttons.flatMap((button) => {
        const singleId = button.getAttribute('data-search-event-id');
        if (singleId) return [singleId];
        return (button.getAttribute('data-search-event-ids') ?? '')
          .split(',')
          .map((eventId) => eventId.trim())
          .filter(Boolean);
      }),
    );
}

function assertSameEventIdSet(actualIds, expectedIds, label) {
  const actual = [...new Set(actualIds)].sort();
  const expected = [...new Set(expectedIds)].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: expected map results ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}.`,
    );
  }
}

async function assertSearchFirstCoverage(page) {
  for (const fixture of searchReviewFixtures) {
    await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
    await waitForViewportContract(page, atlasViewportFixtures[0]);
    const initialRail = await assertLiveUpcomingRail(page, `${fixture.label} initial rail`);
    await submitAtlasSearch(page, fixture.query);

    const atlasRoot = page.locator(
      `${atlasRootSelector}[data-search-mode="results"][data-search-presentation="title-tags"]`,
    );
    await atlasRoot.waitFor({ state: 'visible', timeout: 45_000 });
    const resultField = page.locator('.atlas-result-text-field[data-search-mode="results"]');
    await resultField.waitFor({ state: 'visible', timeout: 45_000 });

    const url = new URL(page.url());
    if (
      url.pathname !== '/' ||
      url.searchParams.get('q') !== fixture.query
    ) {
      throw new Error(`${fixture.label}: submitted query was not retained in homepage route state.`);
    }

    const rootResultCount = Number(await atlasRoot.getAttribute('data-search-result-count'));
    const expectedResultCount = fixture.expectedRailResults
      ? initialRail.length
      : fixture.expectedEventIds.length;
    if (rootResultCount !== expectedResultCount) {
      throw new Error(
        `${fixture.label}: expected ${expectedResultCount} deterministic results, received ${rootResultCount}.`,
      );
    }
    const mapSearchEventIds = await readMapSearchEventIds(page);
    if (fixture.expectedRailResults) {
      if (mapSearchEventIds.length < 1) {
        throw new Error(`${fixture.label}: status query did not expose an interactive map title tag.`);
      }
    } else {
      assertSameEventIdSet(mapSearchEventIds, fixture.expectedEventIds, fixture.label);
    }
    if (await page.locator('.atlas-discovery-panel [data-testid="discovery-results"]').count()) {
      throw new Error(`${fixture.label}: query-only search duplicated map results in a panel.`);
    }

    const searchedRail = await assertLiveUpcomingRail(page, `${fixture.label} searched rail`);
    if (JSON.stringify(searchedRail) !== JSON.stringify(initialRail)) {
      throw new Error(`${fixture.label}: query results repurposed the live/upcoming rail.`);
    }
    await assertNoHorizontalOverflow(page, `${fixture.label} search`);
    console.log(`${fixture.label} search-first contract passed for ${fixture.query}.`);
  }

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  const initialRail = await assertLiveUpcomingRail(page, 'no-results initial rail');
  await submitAtlasSearch(page, noResultsSearchFixture.query);
  const noResultsRoot = page.locator(
    `${atlasRootSelector}[data-search-mode="none"][data-search-presentation="query-status"]`,
  );
  await noResultsRoot.waitFor({ state: 'visible', timeout: 45_000 });
  await page
    .getByText(/No Michigan celebrations match/i)
    .first()
    .waitFor({ state: 'visible', timeout: 45_000 });
  if (
    Number(await noResultsRoot.getAttribute('data-search-result-count')) !== 0 ||
    (await page.locator('.atlas-result-text-field').count()) !== 0 ||
    (await page.locator('.marker-pulse--broad-highlighted, .marker-pulse--highlighted').count()) !== 0
  ) {
    throw new Error('No-results search left contradictory map result markers.');
  }
  const emptyRail = await assertLiveUpcomingRail(page, 'no-results searched rail');
  if (JSON.stringify(emptyRail) !== JSON.stringify(initialRail)) {
    throw new Error('No-results search repurposed the live/upcoming rail.');
  }
  await assertNoHorizontalOverflow(page, 'no-results search');
  await page.screenshot({
    path: noResultsMobileScreenshotPath,
    fullPage: true,
    caret: 'initial',
  });
  console.log(`No-results screenshot written to ${path.relative(process.cwd(), noResultsMobileScreenshotPath)}`);

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await submitAtlasSearch(page, 'music festivals');
  const detroitJazzTitleTag = page.locator(
    '.atlas-result-text-field button[data-search-event-id="detroit-jazz"]',
  );
  await detroitJazzTitleTag.waitFor({ state: 'visible', timeout: 45_000 });
  await Promise.all([
    page.waitForURL('**/events/detroit-jazz', { timeout: 45_000 }),
    detroitJazzTitleTag.click(),
  ]);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('q') === 'music festivals');
  await page
    .locator(`${atlasRootSelector}[data-search-mode="results"]`)
    .waitFor({ state: 'visible', timeout: 45_000 });
  assertSameEventIdSet(
    await readMapSearchEventIds(page),
    searchReviewFixtures[0].expectedEventIds,
    'browser Back search restoration',
  );
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/events/detroit-jazz', { timeout: 45_000 });
  console.log('Homepage query route and browser Back/Forward restoration contract passed.');
}

async function assertExperienceDeckCoverage(page) {
  const deckFixtureUrl = new URL('/', baseUrl);
  deckFixtureUrl.searchParams.set('q', 'music festivals');
  deckFixtureUrl.searchParams.set('atlasDebug', '1');
  deckFixtureUrl.searchParams.set('atlasDeckFixture', 'multi');
  await page.goto(deckFixtureUrl.toString(), { waitUntil: 'domcontentloaded' });
  await waitForHomepageRailReady(page);

  const clusterTrigger = page.getByRole('button', {
    name: 'Open Development multi-event fixture',
    exact: true,
  });
  await clusterTrigger.waitFor({ state: 'visible', timeout: 45_000 });
  await clusterTrigger.evaluate((element) => element.click());

  const dialog = page.getByRole('dialog', { name: /Events in this area/ });
  await dialog.waitFor({ state: 'visible', timeout: 45_000 });
  const deckRoot = page.locator(
    '[data-atlas-experience-deck-host="search-result-cluster"] [data-deck-view="stack"]',
  );
  await deckRoot.waitFor({ state: 'visible', timeout: 45_000 });
  await page.waitForFunction(
    () => {
      const panel = document.querySelector(
        '[data-atlas-experience-deck-host="search-result-cluster"] [role="dialog"]',
      );
      if (!(panel instanceof HTMLElement)) return false;
      const rect = panel.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        rect.top >= -1 &&
        rect.bottom <= window.innerHeight + 1
      );
    },
    undefined,
    { timeout: 10_000 },
  );
  const geometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      bottom: rect.bottom,
      height: rect.height,
      left: rect.left,
      right: rect.right,
      top: rect.top,
      viewportHeight: window.innerHeight,
      viewportWidth: window.innerWidth,
    };
  });
  if (
    geometry.left < -1 ||
    geometry.right > geometry.viewportWidth + 1 ||
    geometry.top < -1 ||
    geometry.bottom > geometry.viewportHeight + 1 ||
    geometry.height < 1
  ) {
    throw new Error(`Experience Deck was clipped by the transformed map: ${JSON.stringify(geometry)}.`);
  }
  await assertNoHorizontalOverflow(page, 'open Experience Deck');

  const stack = dialog.getByRole('list', { name: 'Event card stack' });
  await stack.locator('[data-card-index="1"] button[data-deck-card="true"]').click();
  await page.waitForFunction(
    () => document.querySelector('[aria-label="Event card stack"]')?.getAttribute('data-selected-index') === '1',
    undefined,
    { timeout: 45_000 },
  );
  await page.keyboard.press('ArrowDown');
  await page.waitForFunction(
    () =>
      document.querySelector('[aria-label="Event card stack"]')?.getAttribute('data-selected-index') === '2' &&
      document.querySelector('[data-deck-view="stack"]')?.getAttribute('data-deck-motion') === 'settled',
    undefined,
    { timeout: 45_000 },
  );
  await page.screenshot({
    path: experienceDeckMobileScreenshotPath,
    fullPage: true,
    caret: 'initial',
  });

  const activeCard = stack.locator('[data-card-active="true"] button[data-deck-card="true"]');
  await Promise.all([
    page.waitForURL('**/events/detroit-jazz', { timeout: 45_000 }),
    activeCard.click(),
  ]);
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname === '/' && url.searchParams.get('atlasDeckFixture') === 'multi');
  const restoredDialog = page.getByRole('dialog', { name: /Events in this area/ });
  await restoredDialog.waitFor({ state: 'visible', timeout: 45_000 });
  if ((await restoredDialog.getByRole('list', { name: 'Event card stack' }).getAttribute('data-selected-index')) !== '2') {
    throw new Error('Browser Back did not restore the active Experience Deck index.');
  }
  await page.goForward({ waitUntil: 'domcontentloaded' });
  await page.waitForURL('**/events/detroit-jazz', { timeout: 45_000 });
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await page.getByRole('dialog', { name: /Events in this area/ }).waitFor({ state: 'visible', timeout: 45_000 });
  await page
    .getByRole('dialog', { name: /Events in this area/ })
    .getByRole('button', { name: 'Close event deck' })
    .click();
  await page.getByRole('dialog', { name: /Events in this area/ }).waitFor({ state: 'detached', timeout: 45_000 });
  await assertNoHorizontalOverflow(page, 'closed Experience Deck');
  console.log(
    `Experience Deck navigation/restoration screenshot written to ${path.relative(process.cwd(), experienceDeckMobileScreenshotPath)}`,
  );
}

function createServerExitPromise(childProcess) {
  return new Promise((resolve) => {
    childProcess.once('close', (code, signal) => resolve({ code, signal }));
  });
}

function terminateProcessTree(childProcess, signal) {
  try {
    if (process.platform === 'win32') {
      const taskkill = spawn(
        'taskkill',
        ['/pid', String(childProcess.pid), '/t', '/f'],
        { stdio: 'ignore', windowsHide: true },
      );
      taskkill.once('error', () => childProcess.kill(signal));
    } else {
      process.kill(-childProcess.pid, signal);
    }
  } catch (error) {
    if (error?.code !== 'ESRCH') throw error;
  }
}

async function stopLocalServer(childProcess, exitPromise, timeoutMs = 5_000) {
  console.log('Stopping local Next server...');
  terminateProcessTree(childProcess, 'SIGTERM');

  const timeoutResult = Symbol('server-cleanup-timeout');
  let timeoutId;
  const timeoutPromise = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(timeoutResult), timeoutMs);
  });
  const result = await Promise.race([exitPromise, timeoutPromise]);
  clearTimeout(timeoutId);

  if (result === timeoutResult) {
    console.warn('Local Next server did not stop after SIGTERM; sending SIGKILL.');
    terminateProcessTree(childProcess, 'SIGKILL');
    await exitPromise;
  }

  childProcess.stdout?.removeAllListeners();
  childProcess.stderr?.removeAllListeners();
  childProcess.stdout?.destroy();
  childProcess.stderr?.destroy();
  childProcess.removeAllListeners();
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  if (shouldStartServer) {
    const npmCommand = npmExecPath ? process.execPath : process.platform === 'win32' ? 'npm.cmd' : 'npm';
    const npmArguments = [
      ...(npmExecPath ? [npmExecPath] : []),
      'run',
      'dev',
      '--',
      '--webpack',
      '--hostname',
      '127.0.0.1',
    ];
    server = spawn(npmCommand, npmArguments, {
      cwd: process.cwd(),
      detached: process.platform !== 'win32',
      env: { ...process.env, PORT: '3000' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.exitPromise = createServerExitPromise(server);
    server.stdout.on('data', (chunk) => process.stdout.write(`[next] ${chunk}`));
    server.stderr.on('data', (chunk) => process.stderr.write(`[next] ${chunk}`));
  }

  await waitForServer(homepageUrl);

  browser = await chromium.launch();
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await desktopContext.newPage();
  await page.clock.setFixedTime(visualSmokeTime);

  captureBrowserErrors(page, 'desktop');

  for (const [index, fixture] of atlasViewportFixtures.entries()) {
    await page.setViewportSize({ width: fixture.width, height: fixture.height });
    await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
    await assertHomepageViewport(page, fixture);

    if (index === 0) {
      await assertSamePageRotation(page);
    }
  }

  await submitAtlasSearch(page, 'music festivals');
  const desktopResultField = page.locator('.atlas-result-text-field[data-search-mode="results"]');
  await desktopResultField.waitFor({ state: 'visible', timeout: 45_000 });
  const desktopResultCount = Number(await desktopResultField.getAttribute('data-search-result-count'));
  if (!Number.isFinite(desktopResultCount) || desktopResultCount < 1) {
    throw new Error(`Expected deterministic desktop search results, received ${desktopResultCount}.`);
  }
  const desktopTitleTagCount = await desktopResultField.locator('button[data-search-event-id]').count();
  if (desktopTitleTagCount < 1) {
    throw new Error('Expected desktop search results to remain interactive map title tags.');
  }
  if (await page.locator('.atlas-discovery-panel [data-testid="discovery-results"]').count()) {
    throw new Error('Query-only desktop search must not duplicate map title tags in a result list.');
  }
  await page.screenshot({ path: resultCloudScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Desktop multi-result search screenshot written to ${path.relative(process.cwd(), resultCloudScreenshotPath)}`);

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await submitAtlasSearch(page, 'cherry');
  const cherryResultField = page.locator('.atlas-result-text-field[data-search-mode="results"]');
  await cherryResultField.waitFor({ state: 'visible', timeout: 45_000 });
  await cherryResultField.locator('[data-search-event-id="traverse-city-cherry"], [data-search-event-id="national-cherry-festival"]').waitFor({ state: 'visible', timeout: 45_000 });
  if (await cherryResultField.locator('[data-search-event-id^="romeo-peach"]').count()) {
    throw new Error('Deterministic cherry search incorrectly included Romeo Peach Festival.');
  }
  console.log('Deterministic cherry search includes National Cherry Festival and excludes Romeo Peach Festival.');

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await Promise.all([
    page.waitForURL('**/events/detroit-jazz', { timeout: 45_000 }),
    submitAtlasSearch(page, 'Detroit Jazz Festival'),
  ]);
  await page.locator('#event-hub-title').waitFor({ state: 'visible', timeout: 45_000 });
  await assertScoutComposerContract(page, 'desktop homepage-to-Event-Hub navigation', 'detroit-jazz');
  await page.screenshot({
    path: scoutComposerDesktopScreenshotPath,
    caret: 'initial',
  });
  console.log(
    `Desktop Scout composer screenshot written to ${path.relative(process.cwd(), scoutComposerDesktopScreenshotPath)}`,
  );
  await page.screenshot({ path: exactEventScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Desktop exact-event search screenshot written to ${path.relative(process.cwd(), exactEventScreenshotPath)}`);

  const mobileContext = await browser.newContext({
    ...devices['iPhone 14'],
    viewport: { width: 390, height: 844 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const mobileReviewPage = await mobileContext.newPage();
  await mobileReviewPage.clock.setFixedTime(visualSmokeTime);
  captureBrowserErrors(mobileReviewPage, 'mobile-review');

  const directEventHubUrl = new URL('/events/detroit-jazz', baseUrl).toString();
  for (const fixture of scoutComposerReviewFixtures) {
    await mobileReviewPage.setViewportSize({ width: fixture.width, height: fixture.height });
    await mobileReviewPage.goto(directEventHubUrl, { waitUntil: 'domcontentloaded' });
    await mobileReviewPage
      .locator('#event-hub-title')
      .waitFor({ state: 'visible', timeout: 45_000 });
    await assertEventHubTabContract(
      mobileReviewPage,
      `direct ${fixture.label} Event Hub navigation`,
    );
    await assertScoutComposerContract(
      mobileReviewPage,
      `direct ${fixture.label} Event Hub navigation`,
      'detroit-jazz',
      { exerciseKeyboard: fixture.exerciseKeyboard },
    );
    await mobileReviewPage.screenshot({ path: fixture.screenshotPath, caret: 'initial' });
    console.log(
      `${fixture.label} Scout composer screenshot written to ${path.relative(process.cwd(), fixture.screenshotPath)}`,
    );
  }

  await mobileReviewPage.close();
  const mobilePage = await mobileContext.newPage();
  await mobilePage.clock.setFixedTime(visualSmokeTime);
  captureBrowserErrors(mobilePage, 'mobile');
  await mobilePage.setViewportSize({ width: 390, height: 844 });
  await assertSearchFirstCoverage(mobilePage);
  if (shouldRunExperienceDeck) {
    const deckPage = await mobileContext.newPage();
    await deckPage.clock.setFixedTime(visualSmokeTime);
    await deckPage.setViewportSize({ width: 390, height: 844 });
    captureBrowserErrors(deckPage, 'experience-deck');
    await assertExperienceDeckCoverage(deckPage);
    await deckPage.close();
  }
  await mobilePage.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await mobilePage.locator(atlasRootSelector).waitFor({ state: 'visible', timeout: 45_000 });
  await mobilePage.locator('.atlas-map-frame').waitFor({ state: 'visible', timeout: 45_000 });
  await mobilePage.locator('img.atlas-map-image[alt="Michigan Atlas"]').waitFor({ state: 'visible', timeout: 45_000 });
  await waitForLoadedImage(mobilePage, 'img.atlas-map-image[alt="Michigan Atlas"]');
  await submitAtlasSearch(mobilePage, 'music festivals');
  await mobilePage
    .locator(`${atlasRootSelector}[data-search-mode="results"]`)
    .waitFor({ state: 'visible', timeout: 45_000 });
  await mobilePage.waitForFunction(
    (selector) =>
      document.querySelector(selector)?.getAttribute('data-search-presentation') === 'title-tags',
    atlasRootSelector,
    { timeout: 45_000 },
  );
  const mobileResultField = mobilePage.locator(
    '.atlas-result-text-field[data-search-mode="results"]',
  );
  await mobileResultField.waitFor({ state: 'visible', timeout: 45_000 });
  const mobileResultCount = await mobileResultField.locator('button[data-search-event-id]').count();
  if (mobileResultCount < 1) {
    throw new Error(`Expected interactive mobile map title tags, received ${mobileResultCount}.`);
  }
  if (await mobilePage.locator('.atlas-discovery-panel').count()) {
    throw new Error('Query-only mobile search opened the discovery/filter panel over the map.');
  }
  await mobilePage.screenshot({ path: resultCloudMobileScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Mobile multi-result search screenshot written to ${path.relative(process.cwd(), resultCloudMobileScreenshotPath)}`);

  const detroitJazzTitleTag = mobileResultField.locator(
    'button[data-search-event-id="detroit-jazz"]',
  );
  await detroitJazzTitleTag.waitFor({ state: 'visible', timeout: 45_000 });
  await Promise.all([
    mobilePage.waitForURL('**/events/detroit-jazz', { timeout: 45_000 }),
    detroitJazzTitleTag.click(),
  ]);
  await assertEventHubTabContract(mobilePage, 'homepage title-tag navigation');
  await assertScoutComposerContract(
    mobilePage,
    'homepage title-tag navigation',
    'detroit-jazz',
  );

  await mobilePage.goto(atlasLoginUrl, { waitUntil: 'domcontentloaded' });
  const returnToAtlasLink = mobilePage.locator('.control-shell a[href="/"]').first();
  await returnToAtlasLink.waitFor({ state: 'visible', timeout: 45_000 });
  await Promise.all([
    mobilePage.waitForURL(homepageUrl, { timeout: 45_000 }),
    returnToAtlasLink.click(),
  ]);
  await waitForHomepageRailReady(mobilePage);
  const brownTroutRailLink = mobilePage.getByRole('link', {
    name: 'Open Brown Trout Festival',
    exact: true,
  });
  await brownTroutRailLink.waitFor({ state: 'visible', timeout: 45_000 });
  await Promise.all([
    mobilePage.waitForURL('**/events/alpena-brown-trout', { timeout: 45_000 }),
    brownTroutRailLink.evaluate((element) => element.click()),
  ]);
  await assertEventHubTabContract(mobilePage, 'Atlas Control route-order navigation');
  await assertScoutComposerContract(
    mobilePage,
    'Atlas Control route-order navigation',
    'alpena-brown-trout',
  );
  await mobilePage.getByRole('tablist', { name: 'Event sections' }).screenshot({
    path: eventHubMobileTabsScreenshotPath,
    caret: 'initial',
  });
  console.log(`Mobile Event Hub tab contract screenshot written to ${path.relative(process.cwd(), eventHubMobileTabsScreenshotPath)}`);

  await mobilePage.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await waitForViewportContract(mobilePage, atlasViewportFixtures[0]);
  await mobilePage.locator('.atlas-map-frame').waitFor({ state: 'visible', timeout: 45_000 });
  await mobilePage.locator('img.atlas-map-image[alt="Michigan Atlas"]').waitFor({ state: 'visible', timeout: 45_000 });
  await waitForLoadedImage(mobilePage, 'img.atlas-map-image[alt="Michigan Atlas"]');
  await mobilePage.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await waitForHomepageRailReady(mobilePage);
  console.log('Homepage rail ready; capturing visual smoke screenshot.');

  await mobilePage.screenshot({ path: homepageScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Visual smoke screenshot written to ${path.relative(process.cwd(), homepageScreenshotPath)}`);

  await page.goto(atlasControlUrl, { waitUntil: 'domcontentloaded' });
  await page.getByText(/Atlas Control Desk|Control Plane Configuration Incomplete|Atlas Control Desk sign-in/).first().waitFor({ state: 'visible', timeout: 45_000 });
  await page.screenshot({ path: atlasControlScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Atlas Control Desk unauthenticated/configuration screenshot written to ${path.relative(process.cwd(), atlasControlScreenshotPath)}`);

  if (browserErrors.length > 0) {
    throw new Error(`Visual smoke captured browser errors:\n${browserErrors.join('\n')}`);
  }
}

try {
  await main();
} finally {
  if (browser) {
    console.log('Closing Playwright browser...');
    await browser.close();
    browser = undefined;
  }

  if (server) {
    await stopLocalServer(server, server.exitPromise);
    server = undefined;
  }
}

console.log('Visual smoke complete.');
