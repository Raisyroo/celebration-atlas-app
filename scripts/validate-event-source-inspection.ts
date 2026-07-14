import {
  isPublicIpAddress,
  parsePublicSourceUrl,
} from '../lib/event-intake/publicUrlPolicy.ts';
import { parseOfficialEventSourceHtml } from '../lib/event-intake/officialSourceInspectionCore.ts';
import {
  claimsFromInspection,
  inferEventSourceKind,
} from '../lib/event-intake/sourceBundlePayload.ts';
import { selectBoundedOfficialSourceLinks } from '../lib/event-intake/sourceCollection.ts';
import {
  scheduleItemsFromSaffireResponse,
  scheduleItemsFromStaticSegments,
} from '../lib/event-intake/dynamicSchedule.ts';

const failures: string[] = [];
function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

const fixture = `<!doctype html>
<html>
  <head>
    <title>Example Lakeside Festival | Official Site</title>
    <meta name="description" content="A weekend of music, food, and waterfront traditions. Presented by Example Sponsor." />
    <link rel="canonical" href="https://festival.example/events/lakeside" />
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Festival",
        "name": "Example Sponsor Lakeside Festival presented by Example Sponsor",
        "startDate": "2026-08-14T17:00:00-04:00",
        "endDate": "2026-08-16T20:00:00-04:00",
        "description": "A weekend of music and waterfront traditions. Sponsored by Example Sponsor.",
        "location": {
          "@type": "Place",
          "name": "Harbor Park",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "1 Lake Street",
            "addressLocality": "Example City",
            "addressRegion": "Michigan",
            "postalCode": "48000"
          }
        },
        "sponsor": { "@type": "Organization", "name": "Example Sponsor" }
      }
    </script>
  </head>
  <body>
    <h1>Lakeside Festival</h1>
    <a href="/schedule">Festival Schedule</a>
    <a href="/about-us">Festival History</a>
    <a href="/personalities">Festival Queen and Grand Marshal</a>
    <a href="/photo-video-gallery">Photo Gallery</a>
    <a href="/faq">Visitor FAQ</a>
    <a href="/sponsors">Our Sponsors</a>
  </body>
</html>`;

const inspection = parseOfficialEventSourceHtml({
  html: fixture,
  requestedUrl: 'https://festival.example/',
  finalUrl: 'https://festival.example/',
  fetchedAt: '2026-07-11T12:00:00.000Z',
});

assert(inspection.candidate.name === 'Lakeside Festival', 'Schema.org name was not cleaned of sponsor branding.');
assert(inspection.candidate.startDate === '2026-08-14', 'Schema.org start date was not normalized.');
assert(inspection.candidate.endDate === '2026-08-16', 'Schema.org end date was not normalized.');
assert(inspection.candidate.city === 'Example City', 'Schema.org city was not extracted.');
assert(inspection.candidate.state === 'MI', 'Michigan was not normalized to MI.');
assert(inspection.evidence.some((item) => item.field === 'startDate' && item.method === 'jsonLd'), 'Date evidence did not retain its extraction method.');
assert(inspection.usefulLinks.some((link) => link.kind === 'schedule'), 'Official schedule link was not discovered.');
assert(inspection.usefulLinks.some((link) => link.url.endsWith('/about-us')), 'Official history link was not discovered.');
assert(inspection.usefulLinks.some((link) => link.url.endsWith('/personalities')), 'Official personalities link was not discovered.');
assert(inspection.usefulLinks.some((link) => link.url.endsWith('/photo-video-gallery')), 'Official gallery link was not discovered.');
assert(!inspection.usefulLinks.some((link) => /sponsor/i.test(`${link.label} ${link.url}`)), 'Sponsor links were not excluded.');
assert(inspection.contentSegments.some((segment) => segment.text === 'Lakeside Festival'), 'Meaningful page content was not retained for later synthesis.');
assert(!/sponsor/i.test(JSON.stringify({ candidate: inspection.candidate, evidence: inspection.evidence, contentSegments: inspection.contentSegments, usefulLinks: inspection.usefulLinks })), 'Sponsor references leaked into reviewable content.');
assert(inspection.diagnostics.excludedSponsorReferenceCount > 0, 'Excluded sponsor references were not counted.');
assert(inspection.diagnostics.contentCharacters > 0, 'Sanitized source content character count was not recorded.');

const claims = claimsFromInspection(inspection);
assert(claims.some((claim) => claim.fieldPath === 'identity.name'), 'Inspection name was not converted into a provenance claim.');
assert(claims.some((claim) => claim.fieldPath === 'sources.officialUrl' && claim.confidence === 'verified'), 'Canonical source URL claim is missing.');
assert(!/sponsor/i.test(JSON.stringify(claims)), 'Sponsor references leaked into source bundle claims.');
assert(inferEventSourceKind('https://festival.example/') === 'official_home', 'Official homepage source kind was not inferred.');
assert(inferEventSourceKind('https://festival.example/fishing-schedule') === 'schedule', 'Schedule source kind was not inferred.');

const metadataFixture = parseOfficialEventSourceHtml({
  html: `<!doctype html><html><head><title>National Fruit Festival</title><meta name="description" content="Celebrate July 4–11, 2026, in Traverse City, Michigan." /></head><body><form><main><h1>National Fruit Festival</h1><p>A century of parades and harvest traditions.</p></main></form></body></html>`,
  requestedUrl: 'https://fruit.example/',
  finalUrl: 'https://fruit.example/',
  fetchedAt: '2026-07-13T12:00:00.000Z',
});
assert(metadataFixture.candidate.startDate === '2026-07-04', 'Natural-language metadata start date was not extracted.');
assert(metadataFixture.candidate.endDate === '2026-07-11', 'Natural-language metadata end date was not extracted.');
assert(metadataFixture.candidate.city === 'Traverse City' && metadataFixture.candidate.state === 'MI', 'Natural-language Michigan location was not extracted.');
assert(metadataFixture.contentSegments.some((segment) => /century of parades/i.test(segment.text)), 'Content inside a page-shell form was incorrectly discarded.');
const subpageClaims = claimsFromInspection(metadataFixture, { sourceKind: 'schedule' });
assert(!subpageClaims.some((claim) => claim.fieldPath === 'identity.name'), 'A related source subpage was allowed to overwrite canonical event identity.');
assert(!subpageClaims.some((claim) => claim.fieldPath === 'sources.officialUrl'), 'A related source subpage was allowed to overwrite the canonical official URL.');

const genericHomeFixture = parseOfficialEventSourceHtml({
  html: `<!doctype html><html><head><title>Home</title></head><body><img alt="St Clair County 4-H &amp; Youth Fair Logo"><img alt="St Clair County 4-H &amp; Youth Fair Logo"><p>July 20-25, 2026</p></body></html>`,
  requestedUrl: 'https://countyfair.example/',
  finalUrl: 'https://countyfair.example/',
  fetchedAt: '2026-07-14T12:00:00.000Z',
});
assert(genericHomeFixture.candidate.name === 'St Clair County 4-H & Youth Fair', 'A generic home-page title did not inherit the repeated event logo identity.');
assert(genericHomeFixture.candidate.sourceName === 'St Clair County 4-H & Youth Fair', 'The generic source label did not inherit the repeated event logo identity.');

const listingFixture = parseOfficialEventSourceHtml({
  html: `<!doctype html><html><head><title>Event Detail</title></head><body><h1>Event Detail</h1><p>Book An Overnight!</p><p>Family fair at the county fairgrounds, with livestock exhibits, a carnival, and youth projects.</p><p>Fair Entry Deadline is July 1.</p></body></html>`,
  requestedUrl: 'https://tourism.example/event-detail/county-fair/',
  finalUrl: 'https://tourism.example/event-detail/county-fair/',
  fetchedAt: '2026-07-14T12:00:00.000Z',
});
assert(listingFixture.candidate.description.startsWith('Family fair at'), 'A factual event lead was not retained when metadata had no description.');
const descriptionOnlyClaims = claimsFromInspection(listingFixture, { sourceKind: 'schedule', includeEventDescription: true });
assert(descriptionOnlyClaims.some((claim) => claim.fieldPath === 'identity.description'), 'A supporting schedule source could not contribute an explicitly allowed event description.');
assert(!descriptionOnlyClaims.some((claim) => claim.fieldPath === 'identity.name'), 'A description-only source was allowed to overwrite event identity.');

const wixFixture = parseOfficialEventSourceHtml({
  html: `<!doctype html><html><head><title>Black River Tattoo Convention | Official</title></head><body><main><h1>Event Detail</h1><h6>Friday June 5</h6><h6>12-3pm: Live Painters<br />6-7pm: Roadside Sideshow<br />8-10pm: Tattoo Competition</h6><h6>Sunday June 7</h6><h6>12-3pm: Live Painters<br />6-8pm: Tattoo Competition</h6><p>June 5-7, 2026</p><p>Blue Water Convention Center, 800 Harker Street, Port Huron, Michigan 48060</p><a href="/tattoo-contests">Tattoo Contests</a><a href="/vendors">Vendors</a></main></body></html>`,
  requestedUrl: 'https://convention.example/entertainment',
  finalUrl: 'https://convention.example/entertainment',
  fetchedAt: '2026-07-13T12:00:00.000Z',
});
assert(wixFixture.candidate.startDate === '2026-06-05' && wixFixture.candidate.endDate === '2026-06-07', 'A unique content date range was not retained as fallback evidence.');
assert(wixFixture.contentSegments.some((segment) => segment.text === '6-7pm: Roadside Sideshow'), 'Wix-style h6 schedule lines separated by breaks were not preserved individually.');
assert(wixFixture.contentSegments.filter((segment) => segment.text === '12-3pm: Live Painters').length === 2, 'A recurring program item was incorrectly removed from a later day.');
assert(wixFixture.usefulLinks.some((link) => link.url.endsWith('/tattoo-contests') && link.kind === 'schedule'), 'Convention competitions were not classified as schedule evidence.');
assert(wixFixture.usefulLinks.some((link) => link.url.endsWith('/vendors') && link.kind === 'lineup'), 'Convention vendors were not classified as participant evidence.');

const saffireItems = scheduleItemsFromSaffireResponse({
  d: {
    Days: [{
      DateString: '07/09/2026',
      Times: [{
        HasSpecificTime: true,
        Time: 1830,
        TimeDisplay: '6:30 PM',
        Items: [{
          EventID: 279,
          Name: 'Example Energy Community Royale Parade',
          SingleEventItemName: 'Example Energy Community Royale Parade<br />2025',
          EventTimeRangeString: '6:30 PM - 8:00 PM',
          ShortDescription: 'Meet at the Example Soda Bayside Music Stage and welcome our 2024/2025 royalty.',
          LongDescription: 'Presented by Example Energy. A community parade.',
          CategoryMaps: [{ CategoryID: 10 }],
          Locations: [{ DisplayName: 'Example Soda Bayside Music Stage presented by Example Health' }],
          DetailURL: 'https://fruit.example/events/2026/community-parade',
        }],
      }],
    }],
  },
}, new Map([[10, 'Free Family Fun']]), 'America/Detroit');
assert(saffireItems.length === 1, 'Structured official calendar response did not produce a schedule candidate.');
assert(saffireItems[0]?.title === 'Community Royale Parade', 'Leading schedule sponsor branding was not removed.');
assert(saffireItems[0]?.venue === 'Bayside Music Stage', 'Sponsor branding was not removed from the schedule venue.');
assert(saffireItems[0]?.details === null, 'A stale edition-year schedule description was retained.');
assert(saffireItems[0]?.startsAt === '2026-07-09T22:30:00.000Z', 'Official local schedule time was not converted with the event timezone.');
assert(!/example (?:energy|health|soda)/i.test(JSON.stringify(saffireItems)), 'Sponsor branding leaked into a structured schedule candidate.');
assert(!/<br/i.test(JSON.stringify(saffireItems)), 'Raw schedule markup leaked into a structured schedule candidate.');

const staticScheduleItems = scheduleItemsFromStaticSegments({
  ...genericHomeFixture,
  candidate: {
    ...genericHomeFixture.candidate,
    startDate: '2026-07-20',
    endDate: '2026-07-25',
  },
  contentSegments: [
    { kind: 'heading', text: 'Event Schedule' },
    { kind: 'paragraph', text: 'Monday' },
    { kind: 'listItem', text: '12-6pm - Farm Museum' },
    { kind: 'listItem', text: '7pm - Flying Star Rodeo (Rimrock Crater)' },
    { kind: 'paragraph', text: 'Tuesday' },
    { kind: 'listItem', text: "Kid's day!" },
    { kind: 'listItem', text: '2pm-Close - Carnival' },
    { kind: 'paragraph', text: 'Admissions' },
    { kind: 'listItem', text: '7pm - This must not be treated as a schedule item' },
  ],
});
assert(staticScheduleItems.length === 3, 'Static weekday schedule parsing did not retain only explicit timed rows.');
assert(staticScheduleItems[0]?.startsAt === '2026-07-20T16:00:00.000Z' && staticScheduleItems[0]?.endsAt === '2026-07-20T22:00:00.000Z', 'Static time ranges were not converted from Michigan local time.');
assert(staticScheduleItems[1]?.venue === 'Rimrock Crater', 'Static schedule venue text was not separated from its title.');
assert(staticScheduleItems[2]?.endsAt === null, 'A closing-time placeholder was incorrectly converted into an invented time.');

const boundedLinks = selectBoundedOfficialSourceLinks({
  ...inspection,
  usefulLinks: [
    ...inspection.usefulLinks,
    { label: 'Festival Map', url: 'https://festival.example/plan', kind: 'plan' },
    { label: 'Duplicate Map', url: 'https://festival.example/plan#parking', kind: 'plan' },
    { label: 'External Tickets', url: 'https://tickets.example.net/buy', kind: 'tickets' },
  ],
}, 2);
assert(boundedLinks.length === 2, 'Bounded source collection did not enforce its page cap.');
assert(boundedLinks[0]?.kind === 'schedule', 'Bounded source collection did not prioritize schedule evidence.');
assert(boundedLinks.every((link) => new URL(link.url).hostname === 'festival.example'), 'Bounded source collection accepted a third-party URL.');
assert(new Set(boundedLinks.map((link) => link.url)).size === boundedLinks.length, 'Bounded source collection retained duplicate URLs.');

for (const blocked of [
  'http://localhost/event',
  'http://127.0.0.1/event',
  'http://10.0.0.1/event',
  'http://[::1]/event',
  'http://metadata.internal/event',
  'ftp://festival.example/event',
]) {
  let rejected = false;
  try {
    parsePublicSourceUrl(blocked);
  } catch {
    rejected = true;
  }
  assert(rejected, `Blocked source URL was accepted: ${blocked}`);
}

assert(isPublicIpAddress('8.8.8.8'), 'Public IPv4 address was rejected.');
assert(isPublicIpAddress('2606:4700:4700::1111'), 'Public IPv6 address was rejected.');
assert(!isPublicIpAddress('169.254.169.254'), 'Link-local IPv4 address was accepted.');
assert(!isPublicIpAddress('203.0.113.10'), 'Documentation IPv4 address was accepted.');
assert(!isPublicIpAddress('fc00::1'), 'Private IPv6 address was accepted.');

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log('Event source inspection validations passed.');
