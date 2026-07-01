export const OFFICIAL_EVENT_URL_FIELDS = ['official_url', 'official_site', 'website_url'] as const;

export type OfficialEventUrlField = (typeof OFFICIAL_EVENT_URL_FIELDS)[number];

export type ResolvedOfficialEventUrl = {
  url: `https://${string}`;
  source: 'events' | 'event_sources';
  field: OfficialEventUrlField | 'source_url';
};

export type OfficialEventSourceRow = Record<string, unknown> & {
  source_url?: unknown;
};

const REJECTED_SOURCE_HINTS = [
  'archive',
  'archival',
  'directory',
  'facebook',
  'instagram',
  'social',
  'ticket',
  'tickets',
  'ticketing',
  'x.com',
];

const OFFICIAL_WEBSITE_HINTS = ['official', 'website', 'site', 'homepage', 'home_page'];

function isHttpsUrl(value: unknown): value is `https://${string}` {
  if (typeof value !== 'string' || !value.trim()) return false;

  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizedSearchText(row: OfficialEventSourceRow): string {
  return [
    row.source_type,
    row.source_role,
    row.type,
    row.kind,
    row.category,
    row.title,
    row.label,
    row.name,
    row.description,
    row.source_url,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase();
}

function hasRejectedSourceHint(row: OfficialEventSourceRow): boolean {
  const text = normalizedSearchText(row);
  if (REJECTED_SOURCE_HINTS.some((hint) => text.includes(hint))) return true;

  if (!isHttpsUrl(row.source_url)) return true;

  const hostname = new URL(row.source_url).hostname.toLowerCase();
  return [
    'facebook.com',
    'instagram.com',
    'eventbrite.com',
    'ticketmaster.com',
    'archive.org',
  ].some((rejectedHost) => hostname === rejectedHost || hostname.endsWith(`.${rejectedHost}`));
}

function isApprovedSource(row: OfficialEventSourceRow): boolean {
  if (row.approved === false || row.is_approved === false || row.is_active === false) return false;

  const status = typeof row.status === 'string' ? row.status.toLowerCase() : undefined;
  if (!status) return true;

  return ['approved', 'active', 'verified', 'official'].includes(status);
}

function isOfficialWebsiteSource(row: OfficialEventSourceRow): boolean {
  if (row.is_official === false) return false;

  const text = normalizedSearchText(row);
  const hasOfficialSignal = row.is_official === true || text.includes('official');
  const hasWebsiteSignal = OFFICIAL_WEBSITE_HINTS.some((hint) => text.includes(hint));

  return hasOfficialSignal && hasWebsiteSignal;
}

function getSourceSortKey(row: OfficialEventSourceRow, index: number): string {
  const priority =
    typeof row.priority === 'number'
      ? row.priority
      : typeof row.sort_order === 'number'
        ? row.sort_order
        : Number.MAX_SAFE_INTEGER;
  const createdAt = typeof row.created_at === 'string' ? row.created_at : '';
  const id = typeof row.id === 'string' || typeof row.id === 'number' ? String(row.id) : '';

  return `${String(priority).padStart(16, '0')}|${createdAt}|${id}|${String(index).padStart(6, '0')}`;
}

export function selectOfficialUrlFromEventsRow(
  row: Record<string, unknown> | undefined,
): ResolvedOfficialEventUrl | undefined {
  if (!row) return undefined;

  for (const field of OFFICIAL_EVENT_URL_FIELDS) {
    const candidate = row[field];
    if (isHttpsUrl(candidate)) {
      return { url: candidate, source: 'events', field };
    }
  }

  return undefined;
}

export function selectOfficialUrlFromEventSources(
  rows: readonly OfficialEventSourceRow[],
): ResolvedOfficialEventUrl | undefined {
  const candidates = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => isHttpsUrl(row.source_url))
    .filter(({ row }) => isApprovedSource(row))
    .filter(({ row }) => !hasRejectedSourceHint(row))
    .filter(({ row }) => isOfficialWebsiteSource(row))
    .sort((a, b) => getSourceSortKey(a.row, a.index).localeCompare(getSourceSortKey(b.row, b.index)));

  const sourceUrl = candidates[0]?.row.source_url;

  return isHttpsUrl(sourceUrl)
    ? { url: sourceUrl, source: 'event_sources', field: 'source_url' }
    : undefined;
}

export function selectOfficialEventUrl(
  eventsRow: Record<string, unknown> | undefined,
  eventSourceRows: readonly OfficialEventSourceRow[],
): ResolvedOfficialEventUrl | undefined {
  return selectOfficialUrlFromEventsRow(eventsRow) ?? selectOfficialUrlFromEventSources(eventSourceRows);
}
