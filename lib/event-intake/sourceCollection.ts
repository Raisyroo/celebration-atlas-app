import type {
  EventSourceLink,
  EventSourceLinkKind,
  OfficialEventSourceInspection,
} from './types.ts';

const KIND_PRIORITY: Record<EventSourceLinkKind, number> = {
  schedule: 1,
  lineup: 2,
  plan: 3,
  other: 4,
  faq: 5,
  rules: 6,
  tickets: 7,
  registration: 8,
};

function editorialPriority(link: EventSourceLink) {
  const signal = `${link.label} ${link.url}`.toLowerCase();
  if (/featured[-\s]?artists?|artist[-\s]?(?:directory|lineup)/.test(signal)) return 1;
  if (/vendors?|exhibitors?|marketplace/.test(signal)) return 2;
  if (/contests?|competitions?/.test(signal)) return 2;
  if (/entertainment|performers?|live[-\s]?art/.test(signal)) return 3;
  if (link.kind === 'schedule') {
    if (/\bevent calendar\b|\bfull schedule\b|\bdaily schedule\b|\/events?\/?(?:[?#].*)?$/.test(signal)) return 1;
    if (/\bschedule\b|\bcalendar\b/.test(signal)) return 2;
    return 8;
  }
  if (link.kind === 'lineup') return 1;
  if (link.kind === 'plan') return 1;
  if (link.kind !== 'other') return 5;
  if (/about|history|heritage|our-story|tradition/.test(signal)) return 1;
  if (/personali|pageant|queen|court|grand-marshal/.test(signal)) return 2;
  if (/parade|gallery|photo|video/.test(signal)) return 3;
  return 9;
}

function coverageBucket(link: EventSourceLink) {
  const signal = `${link.label} ${link.url}`.toLowerCase();
  if (/featured[-\s]?artists?|artist[-\s]?(?:directory|lineup)/.test(signal)) return 'artists';
  if (/vendors?|exhibitors?|marketplace/.test(signal)) return 'vendors';
  if (/contests?|competitions?/.test(signal)) return 'competitions';
  if (/entertainment|performers?|live[-\s]?art/.test(signal)) return 'entertainment';
  if (link.kind === 'schedule') return 'schedule';
  if (link.kind === 'lineup') return 'lineup';
  if (link.kind === 'plan' || /parking|map|visit|travel|direction/.test(signal)) return 'planning';
  if (/history|heritage|our-story|about|media-kit/.test(signal)) return 'history';
  if (/personali|pageant|queen|court|grand-marshal|royal/.test(signal)) return 'personalities';
  if (/parade/.test(signal)) return 'parade';
  if (/tradition|gallery|photo|video/.test(signal)) return 'traditions';
  return `${link.kind}:other`;
}

function normalizedHost(url: URL) {
  return url.hostname.toLowerCase().replace(/^www\./, '');
}

function sameOfficialSite(left: URL, right: URL) {
  const leftHost = normalizedHost(left);
  const rightHost = normalizedHost(right);
  return leftHost === rightHost
    || leftHost.endsWith(`.${rightHost}`)
    || rightHost.endsWith(`.${leftHost}`);
}

function normalizedUrl(value: string) {
  const url = new URL(value);
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

export function selectBoundedOfficialSourceLinks(
  inspection: OfficialEventSourceInspection,
  limit = 5,
): EventSourceLink[] {
  const source = new URL(inspection.finalUrl);
  const excluded = new Set(
    [inspection.requestedUrl, inspection.finalUrl, inspection.canonicalUrl]
      .map((url) => normalizedUrl(url)),
  );
  const links = new Map<string, EventSourceLink>();

  inspection.usefulLinks.forEach((link) => {
    try {
      const url = new URL(link.url);
      if (!['http:', 'https:'].includes(url.protocol) || !sameOfficialSite(url, source)) return;
      const normalized = normalizedUrl(url.toString());
      if (excluded.has(normalized) || links.has(normalized)) return;
      links.set(normalized, { ...link, url: normalized });
    } catch {
      // The network fetcher performs the authoritative URL validation later.
    }
  });

  const ranked = [...links.values()]
    .sort((left, right) => (
      KIND_PRIORITY[left.kind] - KIND_PRIORITY[right.kind]
      || editorialPriority(left) - editorialPriority(right)
      || left.label.localeCompare(right.label)
      || left.url.localeCompare(right.url)
    ));
  const boundedLimit = Math.max(0, Math.min(limit, 8));
  const selected: EventSourceLink[] = [];
  const selectedUrls = new Set<string>();
  const buckets = [
    'schedule',
    'artists',
    'competitions',
    'vendors',
    'entertainment',
    'lineup',
    'planning',
    'history',
    'personalities',
    'parade',
    'traditions',
  ];

  for (const bucket of buckets) {
    const match = ranked.find((link) => coverageBucket(link) === bucket && !selectedUrls.has(link.url));
    if (!match) continue;
    selected.push(match);
    selectedUrls.add(match.url);
    if (selected.length >= boundedLimit) return selected;
  }

  for (const link of ranked) {
    if (selectedUrls.has(link.url)) continue;
    selected.push(link);
    selectedUrls.add(link.url);
    if (selected.length >= boundedLimit) break;
  }
  return selected;
}
