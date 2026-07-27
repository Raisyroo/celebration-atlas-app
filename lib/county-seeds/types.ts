export const COUNTY_SEED_SOURCE_SHEET = "03_IMPORT_READY";

export const COUNTY_SEED_HEADERS = [
  "Clean ID",
  "Canonical Event Name",
  "Alternate Names",
  "County",
  "Municipality",
  "Organizer",
  "Venue",
  "Full Address",
  "Official Event Source",
  "Official Organizer Source",
  "Primary Category",
  "Secondary Tags",
  "Most Recent Confirmed Edition",
  "Next Announced Edition",
  "Typical Month / Season",
  "Earliest Confirmed Edition",
  "Confirmed Years",
  "Annual Recurrence Evidence",
  "Public Participation Evidence",
  "Distinctive Experience",
  "Planning Evidence",
  "Admission Type",
  "Age Restrictions",
  "Setting",
  "Supporting Source 1",
  "Supporting Source 2",
  "Activity Status",
  "Qualification Status",
  "Confidence",
  "Research Date",
  "Source Schema",
  "Source Rows",
  "Duplicate Group",
  "Review Decision",
  "Decision ID",
  "Existing Atlas Match",
  "Needs Geocoding",
  "Latitude",
  "Longitude",
  "Cleanup Notes",
] as const;

export type CountySeedHeader = (typeof COUNTY_SEED_HEADERS)[number];
export type RawSeedRow = Record<CountySeedHeader, string | number | boolean | null>;

export type DateInformation =
  | { kind: "exact_range"; original: string; startDate: string; endDate: string }
  | { kind: "year_only"; original: string; year: number }
  | { kind: "unresolved"; original: string | null }
  | { kind: "other"; original: string };

export type NormalizedCountySeed = {
  countyCode: string;
  cleanId: string;
  candidateName: string;
  normalizedName: string;
  proposedSlugCandidate: string;
  alternateNames: string[];
  normalizedAlternateNames: string[];
  county: string;
  municipality: string;
  normalizedMunicipality: string;
  organizer: string | null;
  normalizedOrganizer: string | null;
  venue: string | null;
  normalizedVenue: string | null;
  address: string | null;
  officialEventUrl: { original: string | null; normalized: string | null; identityKey: string | null };
  officialOrganizerUrl: { original: string | null; normalized: string | null; identityKey: string | null };
  supportingUrls: Array<{ original: string; normalized: string; identityKey: string }>;
  category: string | null;
  tags: string[];
  dateInformation: DateInformation;
  typicalMonthOrSeason: string | null;
  mostRecentConfirmedEdition: string | null;
  earliestConfirmedEdition: string | null;
  confirmedYears: string[];
  geocoding: {
    spreadsheetValue: "yes" | "no" | "unknown";
    addressResolutionRequired: boolean;
    coordinatesPresent: boolean;
    requiresVerifiedCoordinates: true;
  };
  spreadsheet: {
    activityStatus: string | null;
    qualificationStatus: string | null;
    confidence: string | null;
    reviewDecision: string | null;
    existingAtlasMatch: string | null;
  };
  cleanupProvenance: {
    researchDate: string | null;
    sourceSchema: string | null;
    sourceRows: string | null;
    duplicateGroup: string | null;
    decisionId: string | null;
    notes: string | null;
  };
  workbookFingerprint: string;
  approvedSheetFingerprint: string;
  sourceSheet: typeof COUNTY_SEED_SOURCE_SHEET;
  sourceRow: number;
  proposedIdempotencyKey: string;
  raw: RawSeedRow;
};

export type ExistingCanonicalEvent = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  county: string | null;
  venue_name: string | null;
  official_website: string | null;
  typical_month: string | null;
  typical_season: string | null;
  status: string;
  verification_status: string;
};

export type ExistingEventCandidate = {
  id: string;
  candidate_name: string;
  normalized_name: string | null;
  slug_candidate: string | null;
  city: string | null;
  county: string | null;
  venue_name: string | null;
  official_website_candidate: string | null;
  typical_month: string | null;
  typical_season: string | null;
  verification_status: string;
  duplicate_status: string;
  matched_event_id: string | null;
  raw_payload: unknown;
};

export type MatchSignal = {
  kind:
    | "retained_seed_id"
    | "explicit_canonical_identifier"
    | "exact_official_url"
    | "exact_name_municipality"
    | "alternate_name_location"
    | "organizer_venue_season"
    | "fuzzy_name";
  detail: string;
  score: number;
  deterministic: boolean;
};

export type MatchTarget = {
  recordType: "canonical_event" | "event_candidate";
  id: string;
  name: string;
  slug: string | null;
  municipality: string | null;
  venue: string | null;
  officialUrl: string | null;
};

export type SeedClassification =
  | "Existing canonical event — likely match"
  | "Existing candidate — likely match"
  | "New candidate"
  | "Possible alias or duplicate"
  | "Insufficient information"
  | "Requires current-edition verification"
  | "Requires geocoding or address resolution"
  | "Blocked by schema or data conflict";

export type SeedMatchResult = {
  cleanId: string;
  spreadsheetEventName: string;
  primaryClassification: SeedClassification;
  classifications: SeedClassification[];
  proposedCanonicalMatch: MatchTarget | null;
  proposedCandidateMatch: MatchTarget | null;
  matchSignals: MatchSignal[];
  confidence: "high" | "medium" | "low" | "none";
  conflictWarnings: string[];
  recommendedHumanDecision: string;
};

export type DeployedColumn = {
  type?: string;
  format?: string;
  default?: unknown;
  description?: string;
};

export type DeployedTable = {
  required: string[];
  columns: Record<string, DeployedColumn>;
};

export type SchemaParityTable = {
  table: string;
  deployed: boolean;
  missingTrackedColumns: string[];
  unexpectedDeployedColumns: string[];
  requiredColumns: string[];
  columns: Record<string, DeployedColumn>;
};

export type SchemaParityReport = {
  source: "deployed-postgrest-openapi";
  inspectedTables: SchemaParityTable[];
  foundationalMigrationTracked: boolean;
  generatedDatabaseTypesTracked: boolean;
  limitations: string[];
  blockers: string[];
};

export type CountySeedWorkbook = {
  workbookPath: string;
  workbookFileName: string;
  workbookFingerprint: string;
  approvedSheetFingerprint: string;
  sourceSheet: typeof COUNTY_SEED_SOURCE_SHEET;
  headers: readonly string[];
  seeds: NormalizedCountySeed[];
};
