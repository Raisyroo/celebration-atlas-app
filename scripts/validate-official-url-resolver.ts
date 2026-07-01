import assert from 'node:assert/strict';
import {
  diagnoseOfficialEventUrl,
  selectOfficialEventUrl,
  selectOfficialUrlFromEventSources,
} from '../data/officialEventUrl.ts';

const ROMEO_OFFICIAL_URL = 'https://www.romeopeachfestival.com';
const ROMEO_CANONICAL_SLUG = 'romeo-peach-festival';

const romeoCanonicalSources = [
  {
    id: 'romeo-social',
    event_slug: ROMEO_CANONICAL_SLUG,
    source_type: 'official_social',
    source_url: 'https://www.facebook.com/romeopeachfestival',
    status: 'approved',
    created_at: '2026-01-02T00:00:00.000Z',
  },
  {
    id: 'romeo-canonical-source-url-only',
    event_slug: ROMEO_CANONICAL_SLUG,
    source_url: ROMEO_OFFICIAL_URL,
    status: 'approved',
    created_at: '2026-01-01T00:00:00.000Z',
  },
] as const;

assert.deepEqual(selectOfficialUrlFromEventSources(romeoCanonicalSources), {
  url: ROMEO_OFFICIAL_URL,
  source: 'event_sources',
  field: 'source_url',
});

assert.deepEqual(diagnoseOfficialEventUrl(undefined, romeoCanonicalSources), {
  sourcePath: 'event_sources',
  eventSourceRejectedReasons: ['rejected_source_hint_or_host'],
});

assert.deepEqual(
  selectOfficialEventUrl(
    { slug: ROMEO_CANONICAL_SLUG, official_url: 'https://events.example.test/romeo' },
    romeoCanonicalSources,
  ),
  {
    url: 'https://events.example.test/romeo',
    source: 'events',
    field: 'official_url',
  },
);

assert.equal(
  selectOfficialUrlFromEventSources([
    {
      id: 'non-https',
      source_type: 'official_website',
      source_url: 'http://www.romeopeachfestival.com',
      status: 'approved',
      is_official: true,
    },
    {
      id: 'ticketing',
      source_type: 'ticketing',
      source_url: 'https://tickets.example.test/romeo',
      status: 'approved',
      is_official: true,
    },
    {
      id: 'directory',
      source_type: 'directory',
      source_url: 'https://directory.example.test/romeo-peach-festival',
      status: 'approved',
      is_official: true,
    },
    {
      id: 'social',
      source_type: 'official_social',
      source_url: 'https://www.instagram.com/romeopeachfestival',
      status: 'approved',
      is_official: true,
    },
    {
      id: 'archive',
      source_type: 'archive',
      source_url: 'https://archive.org/details/romeo-peach-festival',
      status: 'approved',
      is_official: true,
    },
  ]),
  undefined,
);

assert.deepEqual(
  selectOfficialUrlFromEventSources([
    {
      id: 'sparse-site-with-lower-priority',
      source_url: 'https://sparse.example.test',
      status: 'approved',
      priority: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'explicit-official-site-wins-with-signal-rank',
      source_type: 'official_website',
      source_url: 'https://explicit.example.test',
      status: 'approved',
      priority: 2,
      created_at: '2026-01-02T00:00:00.000Z',
    },
  ]),
  {
    url: 'https://explicit.example.test',
    source: 'event_sources',
    field: 'source_url',
  },
);

assert.deepEqual(
  selectOfficialUrlFromEventSources([
    {
      id: 'later-sparse-site',
      source_url: 'https://later.example.test',
      status: 'approved',
      priority: 2,
      created_at: '2026-01-02T00:00:00.000Z',
    },
    {
      id: 'first-sparse-site',
      source_url: 'https://first.example.test',
      status: 'approved',
      priority: 1,
      created_at: '2026-01-01T00:00:00.000Z',
    },
  ]),
  {
    url: 'https://first.example.test',
    source: 'event_sources',
    field: 'source_url',
  },
);

console.log(`Validated official URL resolver fixtures, including metadata-sparse Romeo -> ${ROMEO_OFFICIAL_URL}.`);
