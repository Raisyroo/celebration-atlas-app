import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium, devices } from 'playwright';

const outputDir = path.join(process.cwd(), 'artifacts', 'visual-smoke');
const baseUrl = process.env.VISUAL_SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const shouldStartServer = !process.env.VISUAL_SMOKE_BASE_URL;
const homepageUrl = new URL('/', baseUrl).toString();

let server;

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

async function main() {
  await mkdir(outputDir, { recursive: true });

  if (shouldStartServer) {
    server = spawn('npm', ['run', 'dev', '--', '--webpack', '--hostname', '127.0.0.1'], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: '3000' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    server.stdout.on('data', (chunk) => process.stdout.write(`[next] ${chunk}`));
    server.stderr.on('data', (chunk) => process.stderr.write(`[next] ${chunk}`));
    server.on('exit', (code, signal) => {
      if (code !== null && code !== 0) console.error(`Next dev server exited with code ${code}`);
      if (signal) console.error(`Next dev server exited from signal ${signal}`);
    });
  }

  await waitForServer(homepageUrl);

  const browser = await chromium.launch();
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
  await page.getByLabel('Ask Celebration Atlas').waitFor({ state: 'visible', timeout: 45_000 });
  await page.screenshot({ path: path.join(outputDir, 'homepage-mobile.png'), fullPage: true });

  await page.getByLabel('Ask Celebration Atlas').fill('Romeo Peach Festival');
  await page.getByLabel('Submit Atlas question').click();
  await page.getByLabel('Open Romeo Peach Festival').click({ timeout: 45_000 });
  await page.getByAltText('Romeo Peach Festival flyer').waitFor({ state: 'visible', timeout: 45_000 });
  await page.screenshot({ path: path.join(outputDir, 'romeo-peach-flyer-mobile.png'), fullPage: true });

  await browser.close();

  console.log(`Visual smoke screenshots written to ${path.relative(process.cwd(), outputDir)}/`);
}

try {
  await main();
} finally {
  if (server) server.kill('SIGTERM');
}
