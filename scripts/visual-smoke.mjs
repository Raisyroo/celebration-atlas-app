import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const outputDir = path.join(process.cwd(), 'artifacts', 'visual-smoke');
const homepageScreenshotPath = path.join(outputDir, 'homepage-mobile.png');
const baseUrl = process.env.VISUAL_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const shouldStartServer = !process.env.VISUAL_SMOKE_BASE_URL;
const homepageUrl = new URL('/', baseUrl).toString();

let server;
let browser;

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

function createServerExitPromise(childProcess) {
  return new Promise((resolve) => {
    childProcess.once('close', (code, signal) => resolve({ code, signal }));
  });
}

function terminateProcessTree(childProcess, signal) {
  try {
    if (process.platform === 'win32') {
      childProcess.kill(signal);
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
    server = spawn('npm', ['run', 'dev', '--', '--webpack', '--hostname', '127.0.0.1'], {
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
  const context = await browser.newContext({
    ...devices['iPhone 14'],
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') console.error(`[browser:${message.type()}] ${message.text()}`);
  });

  await page.goto(homepageUrl, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('Celebration Atlas Michigan').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('.atlas-map-frame').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('img.atlas-map-image[alt="Michigan Atlas"]').waitFor({ state: 'visible', timeout: 45_000 });
  await waitForLoadedImage(page, 'img.atlas-map-image[alt="Michigan Atlas"]');
  await page.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('.mobile-live-sheet[data-layout-ready="true"][aria-label="Michigan event rail"]').waitFor({ state: 'visible', timeout: 45_000 });
  await page.locator('.mobile-live-sheet[data-layout-ready="true"] .mobile-live-card').first().waitFor({ state: 'visible', timeout: 45_000 });

  await page.screenshot({ path: homepageScreenshotPath, fullPage: true });
  console.log(`Visual smoke screenshot written to ${path.relative(process.cwd(), homepageScreenshotPath)}`);
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
