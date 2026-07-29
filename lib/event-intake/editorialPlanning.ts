import type {
  EditorialPageMode,
  EditorialPlan,
  EditorialReferenceGroup,
  EditorialReviewSummary,
  EditorialScheduleStatus,
  EditorialHighlightCandidate,
  EditorialSourceRole,
  EditorialTraditionCandidate,
  EventSourceSynthesisInput,
  SynthesisContentSegment,
  SynthesisSourceSnapshot,
} from './synthesisTypes.ts';

const SPONSOR_LANGUAGE = /\b(?:sponsor(?:ed|ship|s)?|presented by|presenting partner|title partner|powered by)\b/i;
const PERSONAL_CONTACT = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\b(?:email|call|text)\s+(?:me|us|the|to)\b/i;
const YEAR = /\b(20\d{2})\b/g;
const PENDING_SCHEDULE = /(?:working on|building|preparing|coming soon|check back|not yet (?:available|published|released)).{0,80}schedule|schedule.{0,80}(?:coming soon|check back|not yet (?:available|published|released))/i;
const DATE_HEADING = /^(?:(?:Labor Day|Memorial Day)\s+)?(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Z][a-z]+)\s+(\d{1,2})(?:,\s*(20\d{2}))?$/i;
const TIME_TOKEN = '(?:all day|noon|midnight|\\d{1,2}(?::\\d{2})?\\s*(?:a\\.?m\\.?|p\\.?m\\.?))';
const TIME_PREFIX = new RegExp(`^(${TIME_TOKEN}(?:\\s*(?:-|\\u2013|\\u2014|to)\\s*(?:${TIME_TOKEN}|\\?))?(?:\\s*\\([^)]{3,45}\\))?)\\s+(.+)$`, 'i');
const ARCHIVE_TIME_PREFIX = /^(all day|noon|midnight|\d{1,2}(?::\d{2})?(?:\s*(?:a\.?m\.?|p\.?m\.?))?(?:\s*(?:-|\u2013|\u2014|to)\s*\d{1,2}(?::\d{2})?(?:\s*(?:a\.?m\.?|p\.?m\.?))?)?)\s*:?\s+(.+)$/i;

const EVENT_TITLE_ENDINGS = [
  /parking/i,
  /peach-y treats tent/i,
  /artists?'? exhibition/i,
  /fall family fun(?: kick off)?/i,
  /craft show/i,
  /food at the masonic lodge/i,
  /winery at schoolhouse/i,
  /used book sale/i,
  /carnival rides/i,
  /peach festival 5k\/10k run/i,
  /concert series(?: live music)?/i,
  /live music at the masonic lodge/i,
  /oral history/i,
  /pasta dinner/i,
  /peach festival fireworks/i,
  /open mic night(?: at [A-Z][A-Za-z ]+)?/i,
  /peach festival golf classic/i,
  /children'?s entrepreneur market/i,
  /kidsfest/i,
  /cornhole tournament/i,
  /peach festival classic car show/i,
  /pancake breakfast/i,
  /kids pie eating contest/i,
  /karaoke (?:night|nite)/i,
  /peach festival bed races/i,
  /peach festival charity car cruise/i,
  /children'?s parade/i,
  /peach festival hometown parade/i,
];

const TRADITION_TOPICS: Array<{
  id: string;
  kind: EditorialTraditionCandidate['kind'];
  title: string;
  pattern: RegExp;
}> = [
  { id: 'pageantry', kind: 'pageantry', title: 'Festival pageantry', pattern: /peach queen|cherry queen|junior royalty|royalty program|pageant|queen court|festival court/i },
  { id: 'floral-parade', kind: 'parade', title: 'The Floral Parade', pattern: /floral parade|floats? decorated with flowers?/i },
  { id: 'youth-parades', kind: 'parade', title: 'Children\'s and youth parades', pattern: /children'?s parade|juvenile parade|youth parade/i },
  { id: 'festival-parades', kind: 'parade', title: 'Festival parades', pattern: /festival foundation parades|two great parades|community.{0,50}parades/i },
  { id: 'street-traditions', kind: 'community', title: 'Street traditions', pattern: /bed races?|car cruise|mummers parade/i },
  { id: 'harvest-crafts', kind: 'harvest', title: 'Harvest and agricultural heritage', pattern: /orchards?|prized crop|peach crop|thriving cherry industry|showcase.{0,45}cherry industry|cherry farm market|agricultural heritage|harvest|craft shows?/i },
  { id: 'festival-programs', kind: 'community', title: 'Festival programs and honors', pattern: /marching band|fine art competition|student art competition|pin program|very cherry awards/i },
  { id: 'personalities', kind: 'heritage', title: 'Festival personalities', pattern: /grand marshal|honored citizen|lil.? miss|peachy king|festival personalities/i },
  { id: 'maritime-origins', kind: 'heritage', title: 'From service picnic to waterfront festival', pattern: /coast guard personnel.{0,30}picnic|first picnic in 19\d{2}|first festival in 19\d{2}/i },
  { id: 'service-memorial', kind: 'heritage', title: 'The Coast Guard Memorial Service', pattern: /national coast guard memorial service|memorial service honoring.{0,80}coast guard/i },
  { id: 'ships-in-channel', kind: 'community', title: 'Ships in the channel', pattern: /ship arrivals?|parade of ships|cutters?.{0,100}(?:channel|waterfront|glide)|sail into (?:port|the harbor)/i },
];

const HIGHLIGHT_TOPICS: Array<{
  id: string;
  kind: EditorialHighlightCandidate['kind'];
  kicker: string;
  title: string;
  pattern: RegExp;
  roles: EditorialSourceRole[];
}> = [
  {
    id: 'artist-floor',
    kind: 'artists',
    kicker: 'Invited artists',
    title: 'The artist floor',
    pattern: /featured artists?|hand[ -]?chosen tattoo artists?|artist attending|artist booths?/i,
    roles: ['participants', 'identity'],
  },
  {
    id: 'competitions',
    kind: 'contests',
    kicker: 'Weekend competition',
    title: 'Tattoo competitions',
    pattern: /tattoo contests?|tattoo competitions?|best of (?:day|show)|contest categories/i,
    roles: ['competition', 'program'],
  },
  {
    id: 'live-art',
    kind: 'liveArt',
    kicker: 'Made in the room',
    title: 'Live art and ArtFusion',
    pattern: /artfusion|live painters?|speed painter|performance art/i,
    roles: ['program'],
  },
  {
    id: 'entertainment',
    kind: 'entertainment',
    kicker: 'Beyond the booths',
    title: 'Entertainment throughout the weekend',
    pattern: /entertainment|sideshow|warrior dance|caricature|face painting/i,
    roles: ['program', 'identity', 'schedule', 'other'],
  },
  {
    id: 'marketplace',
    kind: 'marketplace',
    kicker: 'Vendor marketplace',
    title: 'Independent vendors and makers',
    pattern: /visit our vendors|vendors?|vendor booth|marketplace/i,
    roles: ['participants', 'identity', 'schedule', 'other'],
  },
  {
    id: 'family-activities',
    kind: 'community',
    kicker: 'For younger visitors',
    title: 'Kids’ crafts and activities',
    pattern: /kid(?:s|[’']s)?\s+(?:craft|activity)|children[’']?s\s+(?:craft|activity)|family\s+(?:craft|activity)|youth\s+(?:craft|activity)/i,
    roles: ['program', 'identity', 'schedule', 'other'],
  },
  {
    id: 'livestock-showmanship',
    kind: 'community',
    kicker: 'In the show ring',
    title: 'Livestock and showmanship',
    pattern: /live animal projects?|livestock|showmanship|beef cattle|dairy cattle|swine|horse\s*&\s*pony/i,
    roles: ['other', 'program', 'identity'],
  },
  {
    id: 'fair-exhibits',
    kind: 'contests',
    kicker: 'Across the exhibit halls',
    title: 'Exhibits for every maker',
    pattern: /still exhibit projects?|adult exhibits?|creative writing|horticulture|needlework|woodworking/i,
    roles: ['other', 'competition', 'program'],
  },
  {
    id: 'fair-midway',
    kind: 'entertainment',
    kicker: 'Fair-week fun',
    title: 'The carnival midway',
    pattern: /carnival midway|carnival rides?|mega passes?|daily armbands?/i,
    roles: ['other', 'planning', 'schedule', 'identity'],
  },
  {
    id: 'grandstand-action',
    kind: 'entertainment',
    kicker: 'Under the lights',
    title: 'Grandstand action',
    pattern: /rodeo|monster trucks?|truck pull|bump n run|stock derby|figure 8/i,
    roles: ['program', 'schedule', 'identity', 'other'],
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nestedValue(record: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((value, key) => (
    isRecord(value) ? value[key] : undefined
  ), record);
}

function cleanText(value: string, limit = 500) {
  if (SPONSOR_LANGUAGE.test(value)) return '';
  const text = value
    .replace(/\bINFO(?:RMATION)?\s*:.*$/i, '')
    .replace(/([.!?])\s*[.!?]+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= limit) return text;
  const bounded = text.slice(0, limit);
  return `${bounded.slice(0, bounded.lastIndexOf(' ')).trim()}...`;
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function yearsIn(value: string) {
  return [...value.matchAll(YEAR)].map((match) => Number(match[1]));
}

function currentEditionYear(values: Record<string, unknown>, input: EventSourceSynthesisInput) {
  const startDate = nestedValue(values, 'timing.startDate');
  if (typeof startDate === 'string') {
    const year = Number(startDate.match(/^(20\d{2})/)?.[1]);
    if (Number.isInteger(year)) return year;
  }
  const latestFetchYear = input.snapshots.reduce((latest, snapshot) => (
    Math.max(latest, Number(snapshot.fetchedAt.slice(0, 4)) || 0)
  ), 0);
  const contentYears = input.snapshots.flatMap((snapshot) => [
    ...yearsIn(snapshot.pageTitle ?? ''),
    ...yearsIn((snapshot.contentSegments ?? []).map((segment) => segment.text).join(' ')),
  ]).filter((year) => (
    year >= latestFetchYear - 1 && year <= latestFetchYear + 2
  ));
  return contentYears.sort((left, right) => right - left)[0] ?? null;
}

function snapshotSignal(snapshot: SynthesisSourceSnapshot) {
  return `${snapshot.sourceKind} ${snapshot.pageTitle ?? ''} ${snapshot.canonicalUrl}`.toLowerCase();
}

export function classifyEditorialSource(snapshot: SynthesisSourceSnapshot): EditorialSourceRole {
  const signal = snapshotSignal(snapshot);
  if (/featured[-\s]?artists?|vendors?|exhibitors?|marketplace/.test(signal)) return 'participants';
  if (/tattoo[-\s]?contests?|contests?|competitions?/.test(signal)) return 'competition';
  if (/entertainment|performers?|live[-\s]?art|artfusion/.test(signal)) return 'program';
  if (/personali|pageant|queen|court|grand-marshal/.test(signal)) return 'personalities';
  if (/gallery|photo|video/.test(signal)) return 'gallery';
  if (/about|history|heritage|our-story|tradition|parades?/.test(signal)) return 'history';
  if (/parking|direction|getting-there|plan|visit|travel|map/.test(signal)) return 'planning';
  if (/schedule|calendar|program|events?/.test(signal)) return 'schedule';
  if (snapshot.sourceKind === 'official_home') return 'identity';
  return 'other';
}

function scheduleTitle(value: string) {
  const text = cleanText(value, 260);
  if (!text) return '';
  let end = Number.POSITIVE_INFINITY;
  for (const pattern of EVENT_TITLE_ENDINGS) {
    const match = pattern.exec(text);
    if (match) end = Math.min(end, match.index + match[0].length);
  }
  if (!Number.isFinite(end)) return '';
  let title = text.slice(0, end).trim();
  title = title
    .replace(/^AAUW\s+/i, '')
    .replace(/^Knights of Columbus\s+/i, '')
    .replace(/^Romeo Lions Club Annual\s+/i, '')
    .replace(/^Patrick L\. Rinke Memorial\s+/i, '')
    .replace(/^[A-Z][A-Za-z& ]+\s+\d{1,3}(?:st|nd|rd|th) Annual\s+/i, '')
    .trim();
  if (/concert series/i.test(title)) return /live music/i.test(title) ? 'Festival live music' : 'Festival concert program';
  if (/mid america carnival rides/i.test(title)) return 'Carnival rides';
  if (/fall family fun/i.test(title)) return 'Fall Family Fun';
  return title.slice(0, 120);
}

function timeAndTitle(segment: SynthesisContentSegment) {
  if (!['paragraph', 'listItem', 'detail'].includes(segment.kind)) return null;
  const text = cleanText(segment.text, 1_000);
  const match = text.match(TIME_PREFIX);
  if (!match) return null;
  const title = scheduleTitle(match[2]);
  if (!title) return null;
  return {
    timeText: match[1]
      .replace(/\ba\.?m\.?\b/gi, 'AM')
      .replace(/\bp\.?m\.?\b/gi, 'PM')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim(),
    title,
  };
}

function archiveTimeAndTitle(segment: SynthesisContentSegment) {
  const text = cleanText(segment.text, 260);
  if (!text || /subject to change|terms below|top \d+ winners?|per entry/i.test(text)) return null;
  const match = text.match(ARCHIVE_TIME_PREFIX);
  if (!match) return null;
  const title = cleanText(match[2].replace(/^[-:|\s]+/, ''), 140);
  if (!title || title.length < 3) return null;
  return {
    timeText: match[1]
      .replace(/\ba\.?m\.?\b/gi, 'AM')
      .replace(/\bp\.?m\.?\b/gi, 'PM')
      .replace(/[\u2013\u2014]/g, '-')
      .replace(/\s+/g, ' ')
      .trim(),
    title,
  };
}

function referenceGroupsFromSnapshot(
  snapshot: SynthesisSourceSnapshot,
  observedYear: number,
  allowGenericTitles = false,
): EditorialReferenceGroup[] {
  const groups: EditorialReferenceGroup[] = [];
  let active: EditorialReferenceGroup | null = null;

  for (const segment of snapshot.contentSegments ?? []) {
    const text = cleanText(segment.text, 1_000);
    if (!text) continue;
    if (segment.kind === 'heading' && /^recurring events?$/i.test(text)) {
      active = {
        id: 'reference-recurring',
        label: 'Recurring',
        title: `Experiences listed across multiple days in ${observedYear}`,
        items: [],
      };
      groups.push(active);
      continue;
    }
    const dateHeading = segment.kind === 'heading' ? text.match(DATE_HEADING) : null;
    if (dateHeading) {
      const headingYear = Number(dateHeading[4] ?? observedYear);
      if (headingYear !== observedYear) {
        active = null;
        continue;
      }
      const weekday = dateHeading[1];
      active = {
        id: `reference-${slugify(weekday)}`,
        label: weekday.slice(0, 3),
        title: `${text.replace(/,?\s*20\d{2}$/, '')}, ${observedYear}`,
        items: [],
      };
      groups.push(active);
      continue;
    }
    if (!active) continue;
    const parsed = allowGenericTitles
      ? archiveTimeAndTitle(segment) ?? timeAndTitle(segment)
      : timeAndTitle(segment);
    if (!parsed) continue;
    const id = slugify(`${active.id}-${parsed.title}-${active.items.length + 1}`);
    if (active.items.some((item) => item.title.toLowerCase() === parsed.title.toLowerCase() && item.timeText === parsed.timeText)) continue;
    active.items.push({
      id,
      ...parsed,
      sourceSnapshotIds: [snapshot.id],
    });
  }

  return groups.filter((group) => group.items.length > 0);
}

function referenceSchedule(
  snapshots: SynthesisSourceSnapshot[],
  roles: Map<string, EditorialSourceRole>,
  editionYear: number | null,
) {
  if (!editionYear) return null;
  const scheduleSnapshots = snapshots.filter((snapshot) => roles.get(snapshot.id) === 'schedule');
  const pastYears = scheduleSnapshots.flatMap((snapshot) => (
    yearsIn((snapshot.contentSegments ?? []).map((segment) => segment.text).join(' '))
      .filter((year) => year < editionYear)
  ));
  const observedYear = pastYears.sort((left, right) => right - left)[0];
  if (!observedYear) return null;

  const groups = new Map<string, EditorialReferenceGroup>();
  scheduleSnapshots.forEach((snapshot) => {
    const pageText = (snapshot.contentSegments ?? []).map((segment) => segment.text).join(' ');
    if (!yearsIn(pageText).includes(observedYear)) return;
    referenceGroupsFromSnapshot(snapshot, observedYear).forEach((group) => {
      const existing = groups.get(group.id);
      if (!existing) {
        groups.set(group.id, group);
        return;
      }
      group.items.forEach((item) => {
        if (!existing.items.some((candidate) => candidate.id === item.id)) existing.items.push(item);
      });
    });
  });

  const collected = [...groups.values()];
  const recurring = collected.find((group) => group.id === 'reference-recurring');
  const ordered = recurring
    ? [recurring, ...collected.filter((group) => group !== recurring)]
    : collected;
  return ordered.length ? { observedYear, groups: ordered } : null;
}

function isCompletedEdition(values: Record<string, unknown>) {
  const endDate = nestedValue(values, 'timing.endDate');
  if (typeof endDate !== 'string' || !/^20\d{2}-\d{2}-\d{2}$/.test(endDate)) return false;
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Detroit',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  return endDate < today;
}

function completedEditionArchive(
  snapshots: SynthesisSourceSnapshot[],
  roles: Map<string, EditorialSourceRole>,
  editionYear: number | null,
) {
  if (!editionYear) return null;
  const groups = new Map<string, EditorialReferenceGroup>();
  snapshots
    .filter((snapshot) => ['schedule', 'program', 'competition'].includes(roles.get(snapshot.id) ?? ''))
    .filter((snapshot) => {
      const text = `${snapshot.pageTitle ?? ''} ${(snapshot.contentSegments ?? []).map((segment) => segment.text).join(' ')}`;
      return text.includes(String(editionYear));
    })
    .forEach((snapshot) => {
      referenceGroupsFromSnapshot(snapshot, editionYear, true).forEach((group) => {
        const existing = groups.get(group.id);
        if (!existing) {
          groups.set(group.id, group);
          return;
        }
        group.items.forEach((item) => {
          if (!existing.items.some((candidate) => (
            candidate.title.toLowerCase() === item.title.toLowerCase()
            && candidate.timeText === item.timeText
          ))) existing.items.push(item);
        });
      });
    });
  const collected = [...groups.values()];
  return collected.length ? { observedYear: editionYear, groups: collected } : null;
}

function matchingExcerpt(text: string, pattern: RegExp) {
  const cleaned = cleanText(text, 1_000);
  if (!cleaned) return '';
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const index = sentences.findIndex((sentence) => pattern.test(sentence));
  if (index < 0) return cleanText(cleaned, 420);
  const selected = [sentences[index]];
  if (selected[0].length < 220 && sentences[index + 1]) selected.push(sentences[index + 1]);
  return cleanText(selected.join(' '), 420);
}

function focusedHighlightSummary(topicId: string, summary: string) {
  if (topicId === 'marketplace') {
    const vendorCount = summary.match(
      /\b(?:over|more than)\s+\d+\s+(?:artist(?:s|ic)?(?:\s+and)?\s+)?marketplace vendors?\b/i,
    );
    if (vendorCount) {
      return `The fair brings together ${vendorCount[0].toLowerCase()}.`;
    }
  }
  if (
    topicId === 'entertainment'
    && /\bfood\b/i.test(summary)
    && /\b(?:musical entertainment|live music)\b/i.test(summary)
  ) {
    return 'Food and musical entertainment add to the event experience.';
  }
  if (
    topicId === 'family-activities'
    && /\bkid(?:s|[’']s)?\s+(?:craft|activity)/i.test(summary)
  ) {
    return 'The event includes a kids’ craft and activity area.';
  }
  return summary;
}

function traditions(
  snapshots: SynthesisSourceSnapshot[],
  roles: Map<string, EditorialSourceRole>,
) {
  const roleRank: Record<EditorialSourceRole, number> = {
    history: 1,
    personalities: 2,
    participants: 3,
    competition: 4,
    program: 5,
    gallery: 6,
    schedule: 7,
    identity: 8,
    planning: 9,
    other: 10,
  };
  const orderedSnapshots = [...snapshots].sort((left, right) => (
    roleRank[roles.get(left.id) ?? 'other'] - roleRank[roles.get(right.id) ?? 'other']
    || right.fetchedAt.localeCompare(left.fetchedAt)
  ));

  return TRADITION_TOPICS.flatMap<EditorialTraditionCandidate>((topic) => {
    for (const snapshot of orderedSnapshots) {
      const segment = (snapshot.contentSegments ?? []).find((candidate) => (
        !SPONSOR_LANGUAGE.test(candidate.text) && topic.pattern.test(candidate.text)
      ));
      if (!segment) continue;
      const summary = matchingExcerpt(segment.text, topic.pattern);
      if (!summary) continue;
      const role = roles.get(snapshot.id) ?? 'other';
      const originYear = /(?:began|started|since|back in).{0,35}\b(19\d{2}|20\d{2})\b/i.exec(summary)?.[1];
      const title = topic.id === 'pageantry' && /peach queen/i.test(summary)
        ? 'The Peach Queen Pageant'
        : topic.title;
      return [{
        id: `tradition-${topic.id}`,
        kind: topic.kind,
        kicker: originYear ? `Since ${originYear}` : role === 'personalities' ? 'Festival representatives' : 'Official tradition',
        title,
        summary,
        sourceSnapshotIds: [snapshot.id],
      }];
    }
    return [];
  });
}

function highlights(
  snapshots: SynthesisSourceSnapshot[],
  roles: Map<string, EditorialSourceRole>,
  editionYear: number | null,
) {
  return HIGHLIGHT_TOPICS.flatMap<EditorialHighlightCandidate>((topic) => {
    const candidates = snapshots
      .filter((snapshot) => topic.roles.includes(roles.get(snapshot.id) ?? 'other'))
      .sort((left, right) => (
        topic.roles.indexOf(roles.get(left.id) ?? 'other')
        - topic.roles.indexOf(roles.get(right.id) ?? 'other')
        || right.fetchedAt.localeCompare(left.fetchedAt)
      ));
    for (const snapshot of candidates) {
      const text = (snapshot.contentSegments ?? [])
        .map((segment) => segment.text)
        .filter((value) => !SPONSOR_LANGUAGE.test(value) && !PERSONAL_CONTACT.test(value))
        .join('. ');
      if (!topic.pattern.test(text)) continue;
      const exhibitCategories = topic.id === 'fair-exhibits'
        ? (snapshot.contentSegments ?? [])
            .filter((segment) => segment.kind === 'listItem')
            .map((segment) => cleanText(segment.text, 80))
            .filter((value) => (
              value
              && value.length <= 45
              && !PERSONAL_CONTACT.test(value)
              && !/\b(?:form|application|record book|guidelines?|rules?)\b/i.test(value)
              && /arts?|crafts?|creative writing|food preparation|horticulture|needlework|photography|sewing|vegetable gardening|woodworking/i.test(value)
            ))
            .slice(0, 7)
        : [];
      const summary = exhibitCategories.length >= 4
        ? `Exhibit categories include ${exhibitCategories.join(', ')}.`
        : focusedHighlightSummary(
            topic.id,
            matchingExcerpt(text, topic.pattern),
          );
      if (!summary) continue;
      return [{
        id: `highlight-${topic.id}`,
        kind: topic.kind,
        kicker: topic.kicker,
        title: topic.title,
        summary,
        ...(editionYear ? { observedEdition: `${editionYear} edition` } : {}),
        sourceSnapshotIds: [snapshot.id],
      }];
    }
    return [];
  });
}

function scheduleStatus(
  input: EventSourceSynthesisInput,
  editionYear: number | null,
  roles: Map<string, EditorialSourceRole>,
  hasReference: boolean,
  completed: boolean,
): EditorialScheduleStatus {
  if (completed && hasReference) return 'completed_archive';
  const currentCandidates = editionYear
    ? input.scheduleCandidates.filter((candidate) => candidate.startsAt?.startsWith(`${editionYear}-`))
    : [];
  if (currentCandidates.length >= 5) return 'current_published';
  if (currentCandidates.length > 0) return 'current_partial';
  const scheduleText = input.snapshots
    .filter((snapshot) => roles.get(snapshot.id) === 'schedule')
    .flatMap((snapshot) => snapshot.contentSegments ?? [])
    .map((segment) => segment.text)
    .join(' ');
  if (PENDING_SCHEDULE.test(scheduleText)) {
    return hasReference ? 'current_pending_with_reference' : 'current_pending';
  }
  if (editionYear && scheduleText.includes(String(editionYear)) && DATE_HEADING.test(scheduleText)) {
    return 'current_partial';
  }
  return 'unknown';
}

function pageMode(
  status: EditorialScheduleStatus,
  hasReference: boolean,
  traditionCount: number,
  highlightCount: number,
): EditorialPageMode {
  if (highlightCount >= 3) return 'experience_rich_event';
  if (hasReference) return 'reference_rich_festival';
  if (status === 'current_published' || status === 'current_partial') return 'current_program_festival';
  if (traditionCount >= 2) return 'tradition_rich_festival';
  return 'simple_event';
}

export function buildEditorialPlan(
  input: EventSourceSynthesisInput,
  profileValues: Record<string, unknown>,
): EditorialPlan {
  const editionYear = currentEditionYear(profileValues, input);
  const roleEntries = input.snapshots.map((snapshot) => ({
    snapshotId: snapshot.id,
    role: classifyEditorialSource(snapshot),
  }));
  const roles = new Map(roleEntries.map((entry) => [entry.snapshotId, entry.role]));
  const completed = isCompletedEdition(profileValues);
  const reference = completed
    ? completedEditionArchive(input.snapshots, roles, editionYear)
      ?? referenceSchedule(input.snapshots, roles, editionYear)
    : referenceSchedule(input.snapshots, roles, editionYear);
  const status = scheduleStatus(input, editionYear, roles, Boolean(reference), completed);
  const traditionCandidates = traditions(input.snapshots, roles);
  const highlightCandidates = highlights(input.snapshots, roles, editionYear);
  const hasEditorialSource = roleEntries.some((entry) => (
    entry.role === 'history' || entry.role === 'personalities' || entry.role === 'gallery'
  ));
  const mode = pageMode(status, Boolean(reference), traditionCandidates.length, highlightCandidates.length);
  const recommendedTabs: EditorialPlan['recommendedTabs'] = ['why-go', 'schedule'];
  if (highlightCandidates.length >= 3) recommendedTabs.push('highlights');
  if (traditionCandidates.length >= 2) recommendedTabs.push('traditions');
  recommendedTabs.push('plan');

  const warnings: string[] = [];
  if (status === 'current_pending_with_reference') {
    warnings.push(`The current program is pending; ${reference?.observedYear} may appear only as visibly labeled historical reference.`);
  } else if (status === 'current_pending') {
    warnings.push('The current program is pending and no complete historical schedule was found.');
  } else if (status === 'completed_archive') {
    warnings.push(`${reference?.observedYear} program details are preserved as a completed-edition archive, not a future schedule.`);
  }
  if (!hasEditorialSource) warnings.push('No official history, personalities, or gallery source was archived.');
  if (hasEditorialSource && traditionCandidates.length < 2) {
    warnings.push('Editorial sources were found, but tradition coverage is still too thin for a dedicated module.');
  }

  return {
    mode,
    currentEditionYear: editionYear,
    scheduleStatus: status,
    sourceRoles: roleEntries,
    referenceSchedule: reference,
    traditions: traditionCandidates,
    highlights: highlightCandidates,
    recommendedTabs,
    qualityChecks: {
      truthLayersSeparated: !reference || status === 'current_pending_with_reference' || status === 'completed_archive',
      currentScheduleProtected: !reference || status === 'completed_archive' || reference.observedYear !== editionYear,
      referenceScheduleCaveated: !reference || status === 'current_pending_with_reference' || status === 'completed_archive',
      traditionCoverage: traditionCandidates.length >= 2,
      highlightCoverage: highlightCandidates.length >= 3,
      editorialSourceCoverage: hasEditorialSource,
    },
    warnings,
  };
}

export function editorialReviewSummary(plan: EditorialPlan): EditorialReviewSummary {
  return {
    mode: plan.mode,
    scheduleStatus: plan.scheduleStatus,
    currentEditionYear: plan.currentEditionYear,
    referenceYear: plan.referenceSchedule?.observedYear ?? null,
    referenceItemCount: plan.referenceSchedule?.groups.reduce((total, group) => total + group.items.length, 0) ?? 0,
    traditionCount: plan.traditions.length,
    highlightCount: plan.highlights.length,
    recommendedTabs: plan.recommendedTabs,
    qualityChecks: plan.qualityChecks,
  };
}
