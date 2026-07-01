import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { strict as assert } from 'node:assert';
import { EVENT_FLYERS } from '../data/eventFlyers.ts';
import { ATLAS_EVENTS } from '../data/events.ts';
import { getFlyerEventPresentation } from '../data/flyerEventPresentation.ts';

const LOCAL_RUNTIME_PREFIX = '/event-media/flyers/';
const LOCAL_PUBLIC_PREFIX = path.join('public', 'event-media', 'flyers');
const LOCAL_PUBLIC_ROOT = path.join(process.cwd(), LOCAL_PUBLIC_PREFIX);
const args = new Set(process.argv.slice(2));
const checkLocalFiles = args.has('--local');

type FlyerRecord = {
  src?: string;
  assetMode?: string;
  ticketsUrl?: string;
};

const errors: string[] = [];
const eventIds = new Set<string>();
const duplicateEventIds = new Set<string>();

for (const event of ATLAS_EVENTS) {
  if (eventIds.has(event.id)) duplicateEventIds.add(event.id);
  eventIds.add(event.id);
}

for (const eventId of duplicateEventIds) {
  errors.push(`Duplicate event id in ATLAS_EVENTS: ${eventId}`);
}

const fixtureEventsById = new Map(ATLAS_EVENTS.map((event) => [event.id, event]));
const nonRomeoFlyerFixture = fixtureEventsById.get('goodells-fair');
const nonFlyerFixture = fixtureEventsById.get('armada-fair');

if (!nonRomeoFlyerFixture) errors.push('Missing flyer presentation fixture event: goodells-fair');
if (!nonFlyerFixture) errors.push('Missing standard-card fixture event: armada-fair');

if (nonRomeoFlyerFixture && nonFlyerFixture) {
  assert.equal(
    getFlyerEventPresentation({
      media: { flyerSrc: 'https://media.example.test/goodells-fair-approved-flyer.webp' },
      officialUrl: 'https://goodells.example.test',
    }).isFlyerFirst,
    true,
    'Non-Romeo event with resolved flyer media should use flyer-first presentation',
  );
  assert.equal(
    getFlyerEventPresentation({
      media: { flyerSrc: 'https://media.example.test/goodells-fair-approved-flyer.webp' },
      officialUrl: 'https://goodells.example.test',
    }).hasOfficialHotspot,
    true,
    'Flyer event with official URL should expose the footer hotspot',
  );
  assert.equal(
    getFlyerEventPresentation({ media: undefined, officialUrl: undefined }).isFlyerFirst,
    false,
    'Event without resolved flyer media should keep the standard event card path',
  );
  assert.equal(
    getFlyerEventPresentation({
      media: { flyerSrc: 'https://media.example.test/goodells-fair-approved-flyer.webp' },
      officialUrl: undefined,
    }).hasOfficialHotspot,
    false,
    'Flyer event without official URL should not expose a footer hotspot',
  );
}

const flyerEntries = Object.entries(EVENT_FLYERS as Record<string, FlyerRecord>);
const flyerIds = new Set<string>();
const seenPaths = new Map<string, string>();

for (const [eventId, record] of flyerEntries) {
  if (flyerIds.has(eventId)) errors.push(`Duplicate flyer catalog entry: ${eventId}`);
  flyerIds.add(eventId);

  if (!eventIds.has(eventId)) errors.push(`Flyer catalog id does not match an ATLAS_EVENTS id: ${eventId}`);

  if (record.assetMode !== 'local' && record.assetMode !== 'hosted') {
    errors.push(`Unsupported assetMode for ${eventId}: ${String(record.assetMode)}`);
  }

  if (!record.src) {
    errors.push(`Missing flyer src for ${eventId}`);
    continue;
  }

  if (record.src.includes('/public/')) {
    errors.push(`Flyer runtime path must not include /public/ for ${eventId}: ${record.src}`);
  }

  if (record.assetMode === 'local' && !record.src.startsWith(LOCAL_RUNTIME_PREFIX)) {
    errors.push(`Local flyer src must start with ${LOCAL_RUNTIME_PREFIX} for ${eventId}: ${record.src}`);
  }

  if (record.assetMode === 'hosted' && !/^https:\/\//.test(record.src)) {
    errors.push(`Hosted flyer src must be an https URL for ${eventId}: ${record.src}`);
  }

  if (record.ticketsUrl && !/^https:\/\//.test(record.ticketsUrl)) {
    errors.push(`ticketsUrl must be an https URL for ${eventId}: ${record.ticketsUrl}`);
  }

  const existingEventId = seenPaths.get(record.src);
  if (existingEventId) {
    errors.push(`Duplicate flyer src used by ${existingEventId} and ${eventId}: ${record.src}`);
  } else {
    seenPaths.set(record.src, eventId);
  }
}

for (const event of ATLAS_EVENTS) {
  if (!event.flyerSrc) continue;

  const existingEventId = seenPaths.get(event.flyerSrc);
  if (existingEventId && existingEventId !== event.id) {
    errors.push(`Duplicate legacy event flyerSrc used by ${existingEventId} and ${event.id}: ${event.flyerSrc}`);
  } else {
    seenPaths.set(event.flyerSrc, event.id);
  }

  if (event.flyerSrc.includes('/public/')) {
    errors.push(`Legacy event flyerSrc must not include /public/ for ${event.id}: ${event.flyerSrc}`);
  }

  if (!event.flyerSrc.startsWith('/event-media/')) {
    errors.push(`Legacy event flyerSrc must start with /event-media/ for ${event.id}: ${event.flyerSrc}`);
  }

}


async function assertExactCaseFilePath(filePath: string): Promise<void> {
  const parsedPath = path.parse(filePath);
  const relativeSegments = path.relative(parsedPath.root, filePath).split(path.sep).filter(Boolean);
  let currentPath = parsedPath.root;

  for (const segment of relativeSegments) {
    const entries = await readdir(currentPath);
    if (!entries.includes(segment)) {
      const caseInsensitiveMatch = entries.find((entry) => entry.toLowerCase() === segment.toLowerCase());
      if (caseInsensitiveMatch) {
        throw new Error(`Local flyer filename case mismatch (expected ${segment}, found ${caseInsensitiveMatch})`);
      }
      throw new Error('Missing local flyer file');
    }
    currentPath = path.join(currentPath, segment);
  }

  const fileStat = await stat(filePath);
  if (!fileStat.isFile()) throw new Error('Local flyer path is not a file');
}

function normalizeLocalFlyerRelativePath(src: string): string {
  const relativeName = src.slice(LOCAL_RUNTIME_PREFIX.length);
  const normalizedRelativeName = path.posix.normalize(relativeName);

  if (
    !relativeName ||
    path.isAbsolute(relativeName) ||
    path.win32.isAbsolute(relativeName) ||
    relativeName.includes('\\') ||
    normalizedRelativeName === '.' ||
    normalizedRelativeName.startsWith('../') ||
    normalizedRelativeName.includes('/../')
  ) {
    throw new Error(`Local flyer src must resolve under ${LOCAL_RUNTIME_PREFIX}: ${src}`);
  }

  return normalizedRelativeName;
}

if (checkLocalFiles) {
  for (const [eventId, record] of flyerEntries) {
    if (record.assetMode !== 'local' || !record.src?.startsWith(LOCAL_RUNTIME_PREFIX)) continue;
    try {
      const relativeName = normalizeLocalFlyerRelativePath(record.src);
      const publicPath = path.join(LOCAL_PUBLIC_ROOT, relativeName);
      await assertExactCaseFilePath(publicPath);
    } catch (error) {
      const publicPath = path.join(LOCAL_PUBLIC_ROOT, record.src.slice(LOCAL_RUNTIME_PREFIX.length));
      errors.push(`${error instanceof Error ? error.message : 'Missing local flyer file'} for ${eventId}: ${path.relative(process.cwd(), publicPath)}`);
    }
  }
}

if (errors.length) {
  console.error(`Flyer validation failed with ${errors.length} issue(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const mode = checkLocalFiles ? 'catalog and local files' : 'catalog';
console.log(`Validated ${flyerEntries.length} flyer ${flyerEntries.length === 1 ? 'entry' : 'entries'} against ${ATLAS_EVENTS.length} events (${mode}).`);
