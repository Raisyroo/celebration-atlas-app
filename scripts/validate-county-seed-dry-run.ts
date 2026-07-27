import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  COUNTY_SEED_HEADERS,
  COUNTY_SEED_SOURCE_SHEET,
  type ExistingCanonicalEvent,
  type ExistingEventCandidate,
} from "../lib/county-seeds/types.ts";
import { matchCountySeeds } from "../lib/county-seeds/matching.ts";
import {
  normalizeCounty,
  normalizeMunicipality,
  normalizeOfficialUrl,
  parseCountySeedWorkbook,
  parseDateInformation,
} from "../lib/county-seeds/workbook.ts";

const workbookArg = process.argv.slice(2).find((argument) => !argument.startsWith("--"));
assert(workbookArg, "Pass the finalized county workbook path to validate:county-seeds.");
const workbookPath = path.resolve(workbookArg);

const first = await parseCountySeedWorkbook(workbookPath, "macomb");
const second = await parseCountySeedWorkbook(workbookPath, "macomb");

assert.equal(first.sourceSheet, COUNTY_SEED_SOURCE_SHEET, "The parser did not use only 03_IMPORT_READY.");
assert.deepEqual(first.headers, COUNTY_SEED_HEADERS, "The finalized county seed header contract changed.");
assert.equal(first.seeds.length, 83, "Exactly 83 approved Macomb seed rows are required.");
assert.equal(new Set(first.seeds.map((seed) => seed.cleanId)).size, 83, "Clean IDs must be unique.");
assert.match(first.workbookFingerprint, /^[0-9a-f]{64}$/, "Workbook fingerprint is not SHA-256.");
assert.match(first.approvedSheetFingerprint, /^[0-9a-f]{64}$/, "Approved-sheet fingerprint is not SHA-256.");
assert.equal(
  createHash("sha256").update(JSON.stringify(first)).digest("hex"),
  createHash("sha256").update(JSON.stringify(second)).digest("hex"),
  "Repeated workbook parsing is not stable.",
);

assert.deepEqual(
  normalizeOfficialUrl("https://WWW.Example.com/events/?utm_source=test#details"),
  {
    original: "https://WWW.Example.com/events/?utm_source=test#details",
    normalized: "https://example.com/events",
    identityKey: "example.com/events",
  },
  "Official URL normalization changed.",
);
assert.deepEqual(parseDateInformation("Unknown"), { kind: "unresolved", original: "Unknown" });
assert.deepEqual(parseDateInformation(null), { kind: "unresolved", original: null });
assert.deepEqual(parseDateInformation("2026"), { kind: "year_only", original: "2026", year: 2026 });
assert.deepEqual(
  parseDateInformation("2026-09-05 to 2026-09-06"),
  {
    kind: "exact_range",
    original: "2026-09-05 to 2026-09-06",
    startDate: "2026-09-05",
    endDate: "2026-09-06",
  },
);
assert.equal(normalizeCounty("Macomb County"), "Macomb");
assert.equal(normalizeMunicipality("  Chesterfield   Township "), "Chesterfield Township");
assert(first.seeds.every((seed) => seed.spreadsheet.qualificationStatus === "Qualifies"), "Spreadsheet qualification must remain seed metadata.");
assert(first.seeds.every((seed) => seed.proposedIdempotencyKey.endsWith(first.workbookFingerprint)), "Idempotency keys must retain the workbook fingerprint.");

const armadaSeed = first.seeds.find((seed) => seed.cleanId === "MAC-001");
const romeoSeed = first.seeds.find((seed) => seed.cleanId === "MAC-050");
assert(armadaSeed && romeoSeed, "Batch 0 seeds are missing.");
const events: ExistingCanonicalEvent[] = [
  {
    id: "armada-event", name: "Armada Fair", slug: "armada-fair", city: "Armada", county: "Macomb",
    venue_name: null, official_website: "https://www.armadafair.org/", typical_month: null,
    typical_season: null, status: "active", verification_status: "verified",
  },
  {
    id: "romeo-event", name: "Romeo Peach Festival", slug: "romeo-peach-festival", city: "Romeo",
    county: "Macomb", venue_name: "Downtown Romeo", official_website: "https://romeopeachfestival.com/",
    typical_month: "September", typical_season: "fall", status: "active", verification_status: "verified",
  },
];
const candidates: ExistingEventCandidate[] = [
  {
    id: "armada-candidate", candidate_name: "Armada Fair", normalized_name: "armada fair",
    slug_candidate: "armada-fair", city: "Armada", county: "Macomb", venue_name: null,
    official_website_candidate: "https://www.armadafair.org/", typical_month: null, typical_season: null,
    verification_status: "promoted", duplicate_status: "unique_candidate", matched_event_id: "armada-event",
    raw_payload: {},
  },
];
const matchFixture = matchCountySeeds([armadaSeed, romeoSeed], events, candidates);
assert.equal(matchFixture[0].primaryClassification, "Existing canonical event — likely match");
assert.equal(matchFixture[0].proposedCandidateMatch?.id, "armada-candidate");
assert.equal(matchFixture[1].primaryClassification, "Existing canonical event — likely match");
assert(matchFixture.every((match) => match.matchSignals.every((signal) => signal.kind !== "fuzzy_name" || !signal.deterministic)));

const sharedUrlSeeds = first.seeds.filter((seed) => ["MAC-008", "MAC-009"].includes(seed.cleanId));
assert.equal(sharedUrlSeeds.length, 2, "The shared-listing URL safety fixture is missing.");
const sharedUrlFixture = matchCountySeeds(sharedUrlSeeds, [{
  id: "shared-listing-event",
  name: "A Different Chesterfield Event",
  slug: "different-chesterfield-event",
  city: "Chesterfield Township",
  county: "Macomb",
  venue_name: null,
  official_website: sharedUrlSeeds[0].officialEventUrl.normalized,
  typical_month: null,
  typical_season: null,
  status: "active",
  verification_status: "verified",
}], []);
assert(sharedUrlFixture.every((match) => !match.proposedCanonicalMatch), "A shared listing URL must not create a deterministic identity match by itself.");
assert(sharedUrlFixture.every((match) => match.matchSignals.some((signal) => (
  signal.kind === "exact_official_url" && !signal.deterministic
))), "A shared listing URL must remain visible as a non-deterministic review signal.");

const sourceFiles = [
  "lib/county-seeds/deployedSchema.ts",
  "scripts/county-seed-dry-run.ts",
];
for (const sourceFile of sourceFiles) {
  const source = await readFile(path.resolve(sourceFile), "utf8");
  assert.doesNotMatch(source, /\.rpc\s*\(/, `${sourceFile} may not call database RPCs.`);
  assert.doesNotMatch(source, /\.(?:insert|update|upsert|delete)\s*\(/, `${sourceFile} contains a database mutation method.`);
  assert.doesNotMatch(source, /atlas_intake_event_candidate/, `${sourceFile} may not call candidate intake.`);
  assert.doesNotMatch(source, /method:\s*["'`](?:POST|PUT|PATCH|DELETE)["'`]/i, `${sourceFile} contains a mutating HTTP method.`);
}

console.log("County seed dry-run validation passed (83 rows, stable output, read-only safeguards).");
