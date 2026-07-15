import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const outputDir = path.join(process.cwd(), 'artifacts', 'visual-smoke');
const homepageScreenshotPath = path.join(outputDir, 'homepage-mobile.png');
const resultCloudScreenshotPath = path.join(outputDir, 'map-search-result-text-cloud-desktop.png');
const exactEventScreenshotPath = path.join(outputDir, 'exact-event-hub-desktop.png');
const resultCloudMobileScreenshotPath = path.join(outputDir, 'map-search-result-text-cloud-mobile.png');
const atlasControlScreenshotPath = path.join(outputDir, 'atlas-control-unauthenticated.png');
const baseUrl = process.env.VISUAL_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const shouldStartServer = !process.env.VISUAL_SMOKE_BASE_URL;
const homepageUrl = new URL('/', baseUrl).toString();
const atlasControlUrl = new URL('/atlas-control', baseUrl).toString();
const npmExecPath = process.env.npm_execpath;
const visualSmokeTime = new Date('2026-07-15T16:00:00Z');

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
    viewport: { width: 1440, height: 1000 },
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await desktopContext.newPage();
  await page.clock.setFixedTime(visualSmokeTime);

  captureBrowserErrors(page, 'desktop');

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });

  await page.locator('.atlas-desktop-intro').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('.atlas-map-frame').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('img.atlas-map-image[alt="Michigan Atlas"]').waitFor({ state: 'visible', timeout: 45_000 });
  await waitForLoadedImage(page, 'img.atlas-map-image[alt="Michigan Atlas"]');
  await page.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await submitAtlasSearch(page, 'music festivals');
  await page.locator('.atlas-result-text-field').waitFor({ state: 'visible', timeout: 45_000 });
  await page.screenshot({ path: resultCloudScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Desktop multi-result search screenshot written to ${path.relative(process.cwd(), resultCloudScreenshotPath)}`);

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await Promise.all([
    page.waitForURL('**/events/detroit-jazz', { timeout: 45_000 }),
    submitAtlasSearch(page, 'Detroit Jazz Festival'),
  ]);
  await page.locator('#event-hub-title').waitFor({ state: 'visible', timeout: 45_000 });
  await page.screenshot({ path: exactEventScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Desktop exact-event search screenshot written to ${path.relative(process.cwd(), exactEventScreenshotPath)}`);

  const mobileContext = await browser.newContext({
    ...devices['iPhone 14'],
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.clock.setFixedTime(visualSmokeTime);
  captureBrowserErrors(mobilePage, 'mobile');
  await mobilePage.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await mobilePage.locator('.atlas-map-frame').waitFor({ state: 'visible', timeout: 45_000 });
  await submitAtlasSearch(mobilePage, 'music festivals');
  await mobilePage.locator('.atlas-result-text-field').waitFor({ state: 'visible', timeout: 45_000 });
  await mobilePage.screenshot({ path: resultCloudMobileScreenshotPath, fullPage: true, caret: 'initial' });
  console.log(`Mobile multi-result search screenshot written to ${path.relative(process.cwd(), resultCloudMobileScreenshotPath)}`);

  await mobilePage.goto(homepageUrl, { waitUntil: 'domcontentloaded' });
  await mobilePage.getByLabel('Celebration Atlas Michigan').waitFor({ state: 'visible', timeout: 45_000 });
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
