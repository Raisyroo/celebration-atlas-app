import {
  normalizeName,
  normalizeOfficialUrl,
} from "./workbook.ts";
import type {
  ExistingCanonicalEvent,
  ExistingEventCandidate,
  MatchSignal,
  MatchTarget,
  NormalizedCountySeed,
  SeedClassification,
  SeedMatchResult,
} from "./types.ts";

type ComparableRecord = {
  recordType: "canonical_event" | "event_candidate";
  id: string;
  name: string;
  normalizedName: string;
  slug: string | null;
  municipality: string | null;
  normalizedMunicipality: string | null;
  venue: string | null;
  normalizedVenue: string | null;
  officialUrl: string | null;
  officialUrlKey: string | null;
  typicalMonth: string | null;
  typicalSeason: string | null;
  organizer: string | null;
  retainedSeedId: string | null;
  matchedEventId: string | null;
};

function rawRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function findString(value: unknown, keys: Set<string>): string | null {
  const record = rawRecord(value);
  if (!record) return null;
  for (const [key, child] of Object.entries(record)) {
    if (keys.has(key.toLowerCase()) && typeof child === "string" && child.trim()) return child.trim();
  }
  for (const child of Object.values(record)) {
    const match = findString(child, keys);
    if (match) return match;
  }
  return null;
}

function canonicalComparable(event: ExistingCanonicalEvent): ComparableRecord {
  const normalizedUrl = normalizeOfficialUrl(event.official_website);
  return {
    recordType: "canonical_event",
    id: event.id,
    name: event.name,
    normalizedName: normalizeName(event.name),
    slug: event.slug,
    municipality: event.city,
    normalizedMunicipality: event.city ? normalizeName(event.city) : null,
    venue: event.venue_name,
    normalizedVenue: event.venue_name ? normalizeName(event.venue_name) : null,
    officialUrl: event.official_website,
    officialUrlKey: normalizedUrl.identityKey,
    typicalMonth: event.typical_month,
    typicalSeason: event.typical_season,
    organizer: null,
    retainedSeedId: null,
    matchedEventId: event.id,
  };
}

function candidateComparable(candidate: ExistingEventCandidate): ComparableRecord {
  const normalizedUrl = normalizeOfficialUrl(candidate.official_website_candidate);
  const retainedSeedId = findString(candidate.raw_payload, new Set(["seedid", "seed_id", "cleanid", "clean_id"]));
  const organizer = findString(candidate.raw_payload, new Set(["organizer", "organizer_name", "organizername"]));
  return {
    recordType: "event_candidate",
    id: candidate.id,
    name: candidate.candidate_name,
    normalizedName: normalizeName(candidate.normalized_name || candidate.candidate_name),
    slug: candidate.slug_candidate,
    municipality: candidate.city,
    normalizedMunicipality: candidate.city ? normalizeName(candidate.city) : null,
    venue: candidate.venue_name,
    normalizedVenue: candidate.venue_name ? normalizeName(candidate.venue_name) : null,
    officialUrl: candidate.official_website_candidate,
    officialUrlKey: normalizedUrl.identityKey,
    typicalMonth: candidate.typical_month,
    typicalSeason: candidate.typical_season,
    organizer,
    retainedSeedId,
    matchedEventId: candidate.matched_event_id,
  };
}

function diceCoefficient(left: string, right: string) {
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;
  const pairs = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1);
  }
  let intersection = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = pairs.get(pair) ?? 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      intersection += 1;
    }
  }
  return (2 * intersection) / (left.length + right.length - 2);
}

function explicitIdentifier(seed: NormalizedCountySeed, record: ComparableRecord) {
  const explicit = seed.spreadsheet.existingAtlasMatch;
  if (!explicit || /^not checked$/i.test(explicit)) return false;
  return explicit === record.id || normalizeName(explicit) === normalizeName(record.slug ?? "");
}

function recurringSeasonAgrees(seed: NormalizedCountySeed, record: ComparableRecord) {
  const seedTiming = normalizeName(seed.typicalMonthOrSeason ?? "");
  if (!seedTiming) return false;
  return [record.typicalMonth, record.typicalSeason].filter(Boolean).some((value) => (
    seedTiming.includes(normalizeName(value!)) || normalizeName(value!).includes(seedTiming)
  ));
}

function signalsFor(seed: NormalizedCountySeed, record: ComparableRecord, sharedOfficialUrlCount: number) {
  const signals: MatchSignal[] = [];
  const sameMunicipality = Boolean(
    seed.normalizedMunicipality
      && record.normalizedMunicipality
      && seed.normalizedMunicipality === record.normalizedMunicipality,
  );
  const sameVenue = Boolean(seed.normalizedVenue && record.normalizedVenue && seed.normalizedVenue === record.normalizedVenue);
  if (record.retainedSeedId && record.retainedSeedId === seed.cleanId) {
    signals.push({ kind: "retained_seed_id", detail: `Retained seed id ${seed.cleanId} matches.`, score: 1, deterministic: true });
  }
  if (explicitIdentifier(seed, record)) {
    signals.push({ kind: "explicit_canonical_identifier", detail: "Spreadsheet canonical identifier matches this record.", score: 1, deterministic: true });
  }
  if (seed.officialEventUrl.identityKey && seed.officialEventUrl.identityKey === record.officialUrlKey) {
    signals.push({
      kind: "exact_official_url",
      detail: sharedOfficialUrlCount > 1
        ? `Normalized official URL ${seed.officialEventUrl.identityKey} matches, but ${sharedOfficialUrlCount} finalized seeds share it, so the URL is not identity-deterministic by itself.`
        : `Normalized official URL ${seed.officialEventUrl.identityKey} matches.`,
      score: 0.99,
      deterministic: sharedOfficialUrlCount === 1,
    });
  }
  if (seed.normalizedName === record.normalizedName && sameMunicipality) {
    signals.push({ kind: "exact_name_municipality", detail: `Normalized name and municipality ${seed.municipality} match.`, score: 0.97, deterministic: true });
  }
  if (seed.normalizedAlternateNames.includes(record.normalizedName) && (sameMunicipality || sameVenue)) {
    signals.push({ kind: "alternate_name_location", detail: "An alternate name matches with the same municipality or venue.", score: 0.9, deterministic: true });
  }
  if (
    seed.normalizedOrganizer
    && record.organizer
    && seed.normalizedOrganizer === normalizeName(record.organizer)
    && sameVenue
    && recurringSeasonAgrees(seed, record)
  ) {
    signals.push({ kind: "organizer_venue_season", detail: "Organizer, venue, and recurring season agree.", score: 0.86, deterministic: true });
  }
  const fuzzyScore = diceCoefficient(seed.normalizedName, record.normalizedName);
  if (fuzzyScore >= 0.82 && !signals.some((signal) => signal.kind === "exact_name_municipality")) {
    signals.push({
      kind: "fuzzy_name",
      detail: `Name similarity is ${fuzzyScore.toFixed(3)}; this is a review signal only.`,
      score: Number(fuzzyScore.toFixed(3)),
      deterministic: false,
    });
  }
  return signals.sort((left, right) => right.score - left.score || left.kind.localeCompare(right.kind));
}

function target(record: ComparableRecord): MatchTarget {
  return {
    recordType: record.recordType,
    id: record.id,
    name: record.name,
    slug: record.slug,
    municipality: record.municipality,
    venue: record.venue,
    officialUrl: record.officialUrl,
  };
}

function confidence(score: number, deterministic: boolean): SeedMatchResult["confidence"] {
  if (deterministic && score >= 0.97) return "high";
  if (deterministic && score >= 0.86) return "medium";
  if (score >= 0.82) return "low";
  return "none";
}

function incomplete(seed: NormalizedCountySeed) {
  return /possibly inactive/i.test(seed.spreadsheet.activityStatus ?? "")
    || !seed.officialEventUrl.normalized
    || !seed.address;
}

function conflictWarnings(
  seed: NormalizedCountySeed,
  records: ComparableRecord[],
  seedCohort: NormalizedCountySeed[],
  selectedSignals: MatchSignal[],
  selectedRecord: ComparableRecord | null,
) {
  const warnings: string[] = [];
  const sameNameDifferentPlace = records.filter((record) => (
    record.normalizedName === seed.normalizedName
    && record.normalizedMunicipality
    && record.normalizedMunicipality !== seed.normalizedMunicipality
  ));
  if (sameNameDifferentPlace.length) warnings.push("The same normalized name exists in a different municipality.");
  const sharedVenue = records.filter((record) => (
    seed.normalizedVenue
    && record.normalizedVenue === seed.normalizedVenue
    && record.normalizedName !== seed.normalizedName
  ));
  if (sharedVenue.length) warnings.push("The venue is shared with a differently named event; venue alone must not merge the series.");
  const sameOrganizer = records.filter((record) => (
    seed.normalizedOrganizer
    && record.organizer
    && normalizeName(record.organizer) === seed.normalizedOrganizer
    && record.normalizedName !== seed.normalizedName
  ));
  if (sameOrganizer.length) warnings.push("The organizer is shared with a different event series; organizer alone must not merge the records.");
  const siblingOrganizerSeries = seedCohort.filter((other) => (
    other.cleanId !== seed.cleanId
    && seed.normalizedOrganizer
    && other.normalizedOrganizer === seed.normalizedOrganizer
    && other.normalizedName !== seed.normalizedName
  ));
  if (siblingOrganizerSeries.length) {
    warnings.push(`The organizer is shared with ${siblingOrganizerSeries.length} other finalized seed series; those records remain distinct.`);
  }
  const siblingVenueSeries = seedCohort.filter((other) => (
    other.cleanId !== seed.cleanId
    && seed.normalizedVenue
    && other.normalizedVenue === seed.normalizedVenue
    && other.normalizedName !== seed.normalizedName
  ));
  if (siblingVenueSeries.length) {
    warnings.push(`The venue is shared with ${siblingVenueSeries.length} other finalized seed series; shared venue is not a merge signal.`);
  }
  const siblingUrlSeries = seedCohort.filter((other) => (
    other.cleanId !== seed.cleanId
    && seed.officialEventUrl.identityKey
    && other.officialEventUrl.identityKey === seed.officialEventUrl.identityKey
    && other.normalizedName !== seed.normalizedName
  ));
  if (siblingUrlSeries.length) {
    warnings.push(`The official URL is shared with ${siblingUrlSeries.length} other finalized seed series; the shared listing URL is not a deterministic identity signal by itself.`);
  }
  if (
    selectedRecord?.officialUrlKey
    && seed.officialEventUrl.identityKey
    && selectedRecord.officialUrlKey !== seed.officialEventUrl.identityKey
    && selectedSignals.some((signal) => signal.kind === "exact_name_municipality")
  ) {
    warnings.push("Name and municipality match, but the official URL changed; verify the current official identity before confirming.");
  }
  if (selectedSignals.some((signal) => signal.kind === "alternate_name_location")) {
    warnings.push("The match depends on an alternate name and may represent a renamed event; human confirmation is required.");
  }
  if (seed.cleanupProvenance.duplicateGroup) {
    warnings.push(`Spreadsheet duplicate group ${seed.cleanupProvenance.duplicateGroup} is resolved provenance and must not be re-merged automatically.`);
  }
  return warnings;
}

export function matchCountySeeds(
  seeds: NormalizedCountySeed[],
  events: ExistingCanonicalEvent[],
  candidates: ExistingEventCandidate[],
  schemaBlocked = false,
) {
  const canonical = events.map(canonicalComparable);
  const candidateRecords = candidates.map(candidateComparable);
  const allRecords = [...canonical, ...candidateRecords];
  const officialUrlCounts = new Map<string, number>();
  for (const seed of seeds) {
    const key = seed.officialEventUrl.identityKey;
    if (key) officialUrlCounts.set(key, (officialUrlCounts.get(key) ?? 0) + 1);
  }
  return seeds.map((seed): SeedMatchResult => {
    const sharedOfficialUrlCount = seed.officialEventUrl.identityKey
      ? officialUrlCounts.get(seed.officialEventUrl.identityKey) ?? 1
      : 1;
    const ranked = allRecords
      .map((record) => ({ record, signals: signalsFor(seed, record, sharedOfficialUrlCount) }))
      .filter((match) => match.signals.length)
      .sort((left, right) => (
        (right.signals[0]?.score ?? 0) - (left.signals[0]?.score ?? 0)
        || left.record.recordType.localeCompare(right.record.recordType)
        || left.record.id.localeCompare(right.record.id)
      ));
    const deterministic = ranked.filter((match) => match.signals.some((signal) => signal.deterministic));
    const canonicalMatch = deterministic.find((match) => match.record.recordType === "canonical_event") ?? null;
    const candidateMatch = deterministic.find((match) => match.record.recordType === "event_candidate") ?? null;
    const fuzzyOnly = !deterministic.length && ranked[0]?.signals.some((signal) => signal.kind === "fuzzy_name");
    let primaryClassification: SeedClassification = "New candidate";
    if (schemaBlocked) primaryClassification = "Blocked by schema or data conflict";
    else if (canonicalMatch) primaryClassification = "Existing canonical event — likely match";
    else if (candidateMatch) primaryClassification = "Existing candidate — likely match";
    else if (fuzzyOnly) primaryClassification = "Possible alias or duplicate";
    else if (incomplete(seed)) primaryClassification = "Insufficient information";

    const classifications = new Set<SeedClassification>([primaryClassification]);
    if (candidateMatch) classifications.add("Existing candidate — likely match");
    if (incomplete(seed)) classifications.add("Insufficient information");
    classifications.add("Requires current-edition verification");
    if (seed.geocoding.requiresVerifiedCoordinates || seed.geocoding.addressResolutionRequired) {
      classifications.add("Requires geocoding or address resolution");
    }
    if (schemaBlocked) classifications.add("Blocked by schema or data conflict");

    const selected = canonicalMatch ?? candidateMatch ?? ranked[0] ?? null;
    const selectedSignals = selected?.signals ?? [];
    const selectedScore = selectedSignals[0]?.score ?? 0;
    const selectedDeterministic = selectedSignals.some((signal) => signal.deterministic);
    const recommendation = canonicalMatch
      ? "Confirm the canonical UUID and its promoted candidate; do not create a competing candidate identity."
      : candidateMatch
        ? "Confirm the existing candidate identity before any later staging action."
        : fuzzyOnly
          ? "Review the possible alias manually; fuzzy similarity cannot create a match."
          : incomplete(seed)
            ? "Retain as an approved seed, but resolve the missing or inactive identity evidence before staging."
            : "Eligible for a later reviewed new-candidate batch; this dry run performs no staging.";

    return {
      cleanId: seed.cleanId,
      spreadsheetEventName: seed.candidateName,
      primaryClassification,
      classifications: [...classifications],
      proposedCanonicalMatch: canonicalMatch ? target(canonicalMatch.record) : null,
      proposedCandidateMatch: candidateMatch ? target(candidateMatch.record) : null,
      matchSignals: [
        ...(canonicalMatch?.signals ?? []),
        ...(candidateMatch?.signals ?? []),
        ...(!canonicalMatch && !candidateMatch ? selectedSignals : []),
      ].filter((signal, index, values) => values.findIndex((candidate) => (
        candidate.kind === signal.kind && candidate.detail === signal.detail
      )) === index),
      confidence: confidence(selectedScore, selectedDeterministic),
      conflictWarnings: conflictWarnings(seed, allRecords, seeds, selectedSignals, selected?.record ?? null),
      recommendedHumanDecision: recommendation,
    };
  });
}
