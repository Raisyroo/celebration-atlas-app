import { createHash } from "node:crypto";
import {
  normalizeName,
  normalizeOfficialUrl,
} from "./workbook.ts";
import type {
  ExistingCanonicalEvent,
  ExistingEventCandidate,
  NormalizedCountySeed,
} from "./types.ts";

export const COUNTY_SEED_ADAPTER_VERSION = "county-seed-staging-adapter/1";
export const COUNTY_SEED_PARSER_VERSION = "county-seed-parser/1";
export const COUNTY_SEED_STAGING_CONTRACT_VERSION = 1;
export const COUNTY_SEED_GUARD_MIGRATION = "018_guard_county_seed_candidate_staging.sql";
export const COUNTY_SEED_GUARDED_RPC = "atlas_stage_county_seed_candidate";

export const BATCH_0_CLEAN_IDS = ["MAC-001", "MAC-050"] as const;
export const BATCH_1_CLEAN_IDS = [
  "MAC-003",
  "MAC-004",
  "MAC-008",
  "MAC-011",
  "MAC-041",
  "MAC-042",
  "MAC-049",
] as const;

export type CountySeedRpcSource = {
  source_name: string;
  source_url: string;
  source_type: "official";
  source_excerpt: null;
  is_official: true;
  trust_score: number;
};

export type CountySeedRpcCandidate = {
  candidate_name: string;
  normalized_name: string;
  slug_candidate: string;
  event_type: "unknown";
  category: string | null;
  subcategory: null;
  city: string;
  county: string;
  state: "Michigan";
  country: "USA";
  venue_name: string | null;
  start_date: string | null;
  end_date: string | null;
  typical_month: string | null;
  typical_season: string | null;
  probable_recurrence: "annual";
  description: null;
  official_website_candidate: string;
  social_links: [];
  discovery_confidence: number;
  duplicate_status: "unchecked";
  semantic_notes: string;
  county_seed: {
    contract_version: number;
    adapter_version: string;
    parser_version: string;
    batch_id: string;
    county_code: string;
    clean_id: string;
    inventory_identity: {
      inventory_name: string;
      workbook_file_name: string;
      workbook_fingerprint: string;
      approved_sheet_fingerprint: string;
    };
    source_sheet: string;
    source_row: number;
    seed_name: string;
    normalized_name: string;
    aliases: string[];
    normalized_aliases: string[];
    municipality: string;
    normalized_municipality: string;
    organizer: {
      original: string | null;
      normalized: string | null;
    };
    venue: {
      original: string | null;
      normalized: string | null;
    };
    full_address: string | null;
    urls: {
      official_event: NormalizedCountySeed["officialEventUrl"];
      official_organizer: NormalizedCountySeed["officialOrganizerUrl"];
      supporting: NormalizedCountySeed["supportingUrls"];
    };
    cohort_relationships: {
      shared_official_url_clean_ids: string[];
      shared_organizer_clean_ids: string[];
      shared_venue_clean_ids: string[];
    };
    category: string | null;
    tags: string[];
    date_information: NormalizedCountySeed["dateInformation"];
    spreadsheet: NormalizedCountySeed["spreadsheet"];
    cleanup_provenance: NormalizedCountySeed["cleanupProvenance"];
    geocoding: NormalizedCountySeed["geocoding"];
    source_row_values: NormalizedCountySeed["raw"];
    resolved_decision: {
      phase_b_classification: "New candidate";
      phase_c1_disposition: "provisional_batch_1_manifest_only";
      execution_approval: "not_authorized";
    };
    payload_hash?: string;
  };
};

export type CountySeedRpcArgs = {
  p_actor_type: "human";
  p_actor_identity: string;
  p_idempotency_key: string;
  p_candidate: CountySeedRpcCandidate;
  p_sources: CountySeedRpcSource[];
};

export type PreparedCountySeedRecord = {
  clean_id: string;
  rpc: "public.atlas_intake_event_candidate(text,text,text,jsonb,jsonb)";
  guarded_rpc: "public.atlas_stage_county_seed_candidate(text,text,text,text,text,jsonb,jsonb)";
  args: CountySeedRpcArgs;
  payload_sha256: string;
};

export type PreflightCandidateRow = ExistingEventCandidate & {
  source_urls?: unknown;
  created_at?: string;
};

export type PreflightSourceRow = {
  id: string;
  candidate_id: string;
  source_url: string;
  source_type: string | null;
  created_at?: string;
};

export type PreflightOperationRow = {
  id: string;
  operation_type: string;
  idempotency_key: string;
  status: string;
  request: unknown;
  summary: unknown;
  created_at?: string;
};

export type CountySeedPreflightSnapshot = {
  captured_at: string;
  method: "PostgREST GET only";
  schema_guard: {
    guarded_rpc_visible: boolean;
    required_migration: string;
  };
  events: ExistingCanonicalEvent[];
  candidates: PreflightCandidateRow[];
  sources: PreflightSourceRow[];
  operation_runs: PreflightOperationRow[];
};

export type PreflightFinding = {
  check:
    | "canonical_match"
    | "exact_official_url"
    | "name_municipality"
    | "alias_location"
    | "slug_collision"
    | "idempotency_collision"
    | "candidate_identity"
    | "official_source_elsewhere"
    | "organizer_venue_shared"
    | "promoted_candidate"
    | "fuzzy_name";
  severity: "blocker" | "warning" | "info";
  code: string;
  message: string;
  record_type?: "canonical_event" | "event_candidate" | "operation_run" | "candidate_source";
  record_ids?: string[];
};

export type CountySeedRecordPreflight = {
  clean_id: string;
  checked_at: string;
  method: "PostgREST GET only";
  action: "stage_new_candidate" | "no_op_equivalent" | "blocked";
  equivalent_candidate_id: string | null;
  findings: PreflightFinding[];
  blockers: string[];
  warnings: string[];
  checks: {
    canonical_match: "clear" | "blocked";
    exact_official_url: "clear" | "warning" | "blocked";
    name_municipality: "clear" | "blocked";
    alias_location: "clear" | "blocked";
    slug_collision: "clear" | "equivalent_no_op" | "blocked";
    idempotency_collision: "clear" | "equivalent_no_op" | "blocked" | "uncertain";
    candidate_identity: "clear" | "equivalent_no_op" | "blocked";
    official_source_elsewhere: "clear" | "warning" | "blocked";
    organizer_venue_shared: "clear" | "warning";
    promoted_candidate: "clear" | "blocked";
    fuzzy_name: "clear" | "warning";
  };
};

export type CountySeedManifestRecord = PreparedCountySeedRecord & {
  preflight: CountySeedRecordPreflight;
  intended_action: "stage_new_candidate";
  status: "not_executed";
  eligibility: {
    preflight_eligible: boolean;
    execution_eligible: boolean;
    blockers: string[];
  };
  eventual_candidate_id: null;
  error: null;
  retry: {
    attempts: 0;
    allowed_after: "fresh_preflight_and_explicit_human_approval";
    uncertain_outcome_policy: "stop_and_reconcile_before_retry";
  };
  approval: {
    staging_execution: "not_authorized" | "human_approved";
    publication: "not_authorized";
  };
  audit: Array<{
    at: string;
    state: "manifest_prepared" | "preflight_completed";
    detail: string;
  }>;
};

export type CountySeedBatchManifest = {
  contract_version: 1;
  mode: "immutable_non_executed_batch_1_manifest";
  batch_id: string;
  inventory_name: string;
  workbook_file_name: string;
  workbook_fingerprint: string;
  approved_sheet_fingerprint: string;
  prepared_at: string;
  required_schema_guard: {
    migration: string;
    guarded_rpc: string;
    deployed: boolean;
  };
  read_only_snapshot: {
    captured_at: string;
    method: "PostgREST GET only";
    inspected_counts: {
      event_candidates: number;
      event_candidate_sources: number;
      atlas_operation_runs: number;
      events: number;
    };
    duplicate_candidate_slugs: number;
    duplicate_candidate_source_associations: number;
    duplicate_operation_identities: number;
    duplicate_county_seed_identities: number;
  };
  execution: {
    authorized: boolean;
    default_command_mode: "preflight";
    confirmation_requirement: "exact_manifest_sha256";
    batch_0_rejected: true;
    dirty_manifest_rejected: true;
    unresolved_matches_rejected: true;
    insufficient_information_rejected: true;
    equivalence_conflicts_rejected: true;
  };
  records: CountySeedManifestRecord[];
  integrity: {
    algorithm: "sha256";
    manifest_sha256: string;
  };
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function stableJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function sha256Canonical(value: unknown) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function monthOrSeason(value: string | null) {
  if (!value) return { typicalMonth: null, typicalSeason: null };
  const months = new Set([
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
  ]);
  return months.has(value.toLowerCase())
    ? { typicalMonth: value, typicalSeason: null }
    : { typicalMonth: null, typicalSeason: value };
}

function discoveryConfidence(value: string | null) {
  if (/^high$/i.test(value ?? "")) return 0.8;
  if (/^medium$/i.test(value ?? "")) return 0.7;
  return 0.6;
}

export function prepareCountySeedRecord(args: {
  seed: NormalizedCountySeed;
  workbookFileName: string;
  inventoryName: string;
  batchId: string;
  actorIdentity?: string;
  cohortRelationships?: CountySeedRpcCandidate["county_seed"]["cohort_relationships"];
}): PreparedCountySeedRecord {
  const { seed } = args;
  if (!BATCH_1_CLEAN_IDS.includes(seed.cleanId as (typeof BATCH_1_CLEAN_IDS)[number])) {
    throw new Error(`County seed ${seed.cleanId} is not in the reviewed provisional Batch 1 selection.`);
  }
  if (!seed.officialEventUrl.original) {
    throw new Error(`County seed ${seed.cleanId} has no official event URL and is insufficient for staging.`);
  }
  if (!seed.candidateName || !seed.municipality) {
    throw new Error(`County seed ${seed.cleanId} is missing a candidate name or municipality.`);
  }
  const timing = monthOrSeason(seed.typicalMonthOrSeason);
  const exactDates = seed.dateInformation.kind === "exact_range"
    ? { startDate: seed.dateInformation.startDate, endDate: seed.dateInformation.endDate }
    : { startDate: null, endDate: null };
  const countySeed: CountySeedRpcCandidate["county_seed"] = {
    contract_version: COUNTY_SEED_STAGING_CONTRACT_VERSION,
    adapter_version: COUNTY_SEED_ADAPTER_VERSION,
    parser_version: COUNTY_SEED_PARSER_VERSION,
    batch_id: args.batchId,
    county_code: seed.countyCode,
    clean_id: seed.cleanId,
    inventory_identity: {
      inventory_name: args.inventoryName,
      workbook_file_name: args.workbookFileName,
      workbook_fingerprint: seed.workbookFingerprint,
      approved_sheet_fingerprint: seed.approvedSheetFingerprint,
    },
    source_sheet: seed.sourceSheet,
    source_row: seed.sourceRow,
    seed_name: seed.candidateName,
    normalized_name: seed.normalizedName,
    aliases: seed.alternateNames,
    normalized_aliases: seed.normalizedAlternateNames,
    municipality: seed.municipality,
    normalized_municipality: seed.normalizedMunicipality,
    organizer: { original: seed.organizer, normalized: seed.normalizedOrganizer },
    venue: { original: seed.venue, normalized: seed.normalizedVenue },
    full_address: seed.address,
    urls: {
      official_event: seed.officialEventUrl,
      official_organizer: seed.officialOrganizerUrl,
      supporting: seed.supportingUrls,
    },
    cohort_relationships: args.cohortRelationships ?? {
      shared_official_url_clean_ids: [seed.cleanId],
      shared_organizer_clean_ids: [seed.cleanId],
      shared_venue_clean_ids: [seed.cleanId],
    },
    category: seed.category,
    tags: seed.tags,
    date_information: seed.dateInformation,
    spreadsheet: seed.spreadsheet,
    cleanup_provenance: seed.cleanupProvenance,
    geocoding: seed.geocoding,
    source_row_values: seed.raw,
    resolved_decision: {
      phase_b_classification: "New candidate",
      phase_c1_disposition: "provisional_batch_1_manifest_only",
      execution_approval: "not_authorized",
    },
  };
  const candidate: CountySeedRpcCandidate = {
    candidate_name: seed.candidateName,
    normalized_name: seed.normalizedName,
    slug_candidate: seed.proposedSlugCandidate,
    event_type: "unknown",
    category: seed.category,
    subcategory: null,
    city: seed.municipality,
    county: seed.county,
    state: "Michigan",
    country: "USA",
    venue_name: seed.venue,
    start_date: exactDates.startDate,
    end_date: exactDates.endDate,
    typical_month: timing.typicalMonth,
    typical_season: timing.typicalSeason,
    probable_recurrence: "annual",
    description: null,
    official_website_candidate: seed.officialEventUrl.original,
    social_links: [],
    discovery_confidence: discoveryConfidence(seed.spreadsheet.confidence),
    duplicate_status: "unchecked",
    semantic_notes: `County seed ${seed.cleanId}; ${seed.sourceSheet} row ${seed.sourceRow}; workbook ${seed.workbookFingerprint}.`,
    county_seed: countySeed,
  };
  const sources: CountySeedRpcSource[] = [{
    source_name: `${seed.candidateName} official event source`,
    source_url: seed.officialEventUrl.original,
    source_type: "official",
    source_excerpt: null,
    is_official: true,
    trust_score: 0.9,
  }];
  const rpcArgs: CountySeedRpcArgs = {
    p_actor_type: "human",
    p_actor_identity: args.actorIdentity ?? "<authenticated allowlisted Atlas administrator email>",
    p_idempotency_key: seed.proposedIdempotencyKey,
    p_candidate: candidate,
    p_sources: sources,
  };
  const payloadHash = sha256Canonical({
    contract_version: COUNTY_SEED_STAGING_CONTRACT_VERSION,
    adapter_version: COUNTY_SEED_ADAPTER_VERSION,
    rpc: "public.atlas_intake_event_candidate(text,text,text,jsonb,jsonb)",
    p_idempotency_key: rpcArgs.p_idempotency_key,
    p_candidate: candidate,
    p_sources: sources,
  });
  candidate.county_seed.payload_hash = payloadHash;
  return {
    clean_id: seed.cleanId,
    rpc: "public.atlas_intake_event_candidate(text,text,text,jsonb,jsonb)",
    guarded_rpc: "public.atlas_stage_county_seed_candidate(text,text,text,text,text,jsonb,jsonb)",
    args: rpcArgs,
    payload_sha256: payloadHash,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nestedString(value: unknown, path: string[]) {
  let current: unknown = value;
  for (const key of path) current = object(current)?.[key];
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function safeUrlKey(value: string | null | undefined) {
  if (!value) return null;
  try {
    return normalizeOfficialUrl(value).identityKey;
  } catch {
    return null;
  }
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

function finding(args: PreflightFinding) {
  return args;
}

export function preflightCountySeedRecord(
  record: PreparedCountySeedRecord,
  snapshot: CountySeedPreflightSnapshot,
): CountySeedRecordPreflight {
  const candidate = record.args.p_candidate;
  const seed = candidate.county_seed;
  const name = candidate.normalized_name;
  const municipality = seed.normalized_municipality;
  const aliases = new Set(seed.normalized_aliases);
  const slug = candidate.slug_candidate;
  const officialUrlKey = safeUrlKey(candidate.official_website_candidate);
  const organizer = seed.organizer.normalized;
  const venue = seed.venue.normalized;
  const cohort = seed.cohort_relationships;
  const findings: PreflightFinding[] = [];
  const equivalentCandidateIds = new Set<string>();

  const canonicalMatches = snapshot.events.filter((event) => {
    const sameUrl = officialUrlKey && safeUrlKey(event.official_website) === officialUrlKey;
    const eventName = normalizeName(event.name);
    const samePlace = normalizeName(event.city ?? "") === municipality
      || (venue && normalizeName(event.venue_name ?? "") === venue);
    const uniqueUrlMatch = sameUrl && cohort.shared_official_url_clean_ids.length <= 1;
    return Boolean(uniqueUrlMatch || (eventName === name && samePlace) || (aliases.has(eventName) && samePlace));
  });
  const canonicalUrlMatches = snapshot.events.filter((event) => (
    officialUrlKey && safeUrlKey(event.official_website) === officialUrlKey
  ));
  const canonicalNameMatches = snapshot.events.filter((event) => (
    normalizeName(event.name) === name
    && normalizeName(event.city ?? "") === municipality
  ));
  const canonicalAliasMatches = snapshot.events.filter((event) => (
    aliases.has(normalizeName(event.name))
    && (
      normalizeName(event.city ?? "") === municipality
      || Boolean(venue && normalizeName(event.venue_name ?? "") === venue)
    )
  ));
  if (canonicalMatches.length) {
    findings.push(finding({
      check: "canonical_match",
      severity: "blocker",
      code: "canonical_identity_exists",
      message: "A deterministic canonical-event identity already exists; candidate staging is rejected.",
      record_type: "canonical_event",
      record_ids: canonicalMatches.map((event) => event.id),
    }));
  }

  const candidateHash = (row: PreflightCandidateRow) => nestedString(row.raw_payload, ["county_seed", "payload_hash"]);
  const candidateCounty = (row: PreflightCandidateRow) => nestedString(row.raw_payload, ["county_seed", "county_code"]);
  const candidateCleanId = (row: PreflightCandidateRow) => nestedString(row.raw_payload, ["county_seed", "clean_id"]);
  const exactCountyIdentity = snapshot.candidates.filter((row) => (
    candidateCounty(row)?.toLowerCase() === seed.county_code.toLowerCase()
    && candidateCleanId(row) === seed.clean_id
  ));
  for (const row of exactCountyIdentity) {
    if (candidateHash(row) === record.payload_sha256 && !row.matched_event_id && row.verification_status !== "promoted") {
      equivalentCandidateIds.add(row.id);
      findings.push(finding({
        check: "candidate_identity",
        severity: "info",
        code: "equivalent_county_identity",
        message: "The exact county identity and payload hash already exist; replay is a no-op.",
        record_type: "event_candidate",
        record_ids: [row.id],
      }));
    } else {
      findings.push(finding({
        check: "candidate_identity",
        severity: "blocker",
        code: "county_identity_payload_conflict",
        message: "The exact county identity exists with a different payload or promoted state.",
        record_type: "event_candidate",
        record_ids: [row.id],
      }));
    }
  }

  const slugMatches = snapshot.candidates.filter((row) => row.slug_candidate === slug);
  for (const row of slugMatches) {
    if (candidateHash(row) === record.payload_sha256 && candidateCleanId(row) === seed.clean_id) {
      equivalentCandidateIds.add(row.id);
      findings.push(finding({
        check: "slug_collision",
        severity: "info",
        code: "equivalent_slug_payload",
        message: "The slug is retained by the equivalent county-seed payload; replay is a no-op.",
        record_type: "event_candidate",
        record_ids: [row.id],
      }));
    } else {
      findings.push(finding({
        check: "slug_collision",
        severity: "blocker",
        code: "slug_owned_by_different_identity",
        message: "The proposed slug is already owned by a non-equivalent candidate.",
        record_type: "event_candidate",
        record_ids: [row.id],
      }));
    }
  }

  const deterministicCandidateMatches = snapshot.candidates.filter((row) => {
    const sameUrl = officialUrlKey && safeUrlKey(row.official_website_candidate) === officialUrlKey;
    const rowName = normalizeName(row.normalized_name ?? row.candidate_name);
    const samePlace = normalizeName(row.city ?? "") === municipality
      || (venue && normalizeName(row.venue_name ?? "") === venue);
    const rowCleanId = candidateCleanId(row);
    const reviewedSharedUrlSibling = Boolean(
      sameUrl
      && rowCleanId
      && cohort.shared_official_url_clean_ids.includes(rowCleanId),
    );
    return Boolean(
      (sameUrl && !reviewedSharedUrlSibling)
      || (rowName === name && samePlace)
      || (aliases.has(rowName) && samePlace),
    );
  });
  const candidateUrlMatches = snapshot.candidates.filter((row) => (
    officialUrlKey && safeUrlKey(row.official_website_candidate) === officialUrlKey
  ));
  const candidateNameMatches = snapshot.candidates.filter((row) => (
    normalizeName(row.normalized_name ?? row.candidate_name) === name
    && normalizeName(row.city ?? "") === municipality
  ));
  const candidateAliasMatches = snapshot.candidates.filter((row) => (
    aliases.has(normalizeName(row.normalized_name ?? row.candidate_name))
    && (
      normalizeName(row.city ?? "") === municipality
      || Boolean(venue && normalizeName(row.venue_name ?? "") === venue)
    )
  ));
  for (const row of deterministicCandidateMatches) {
    if (equivalentCandidateIds.has(row.id)) continue;
    const promoted = Boolean(row.matched_event_id) || row.verification_status === "promoted";
    findings.push(finding({
      check: promoted ? "promoted_candidate" : "candidate_identity",
      severity: "blocker",
      code: promoted ? "promoted_candidate_identity" : "deterministic_candidate_identity",
      message: promoted
        ? "A deterministic candidate identity has already been promoted or matched."
        : "A deterministic non-equivalent candidate identity already exists.",
      record_type: "event_candidate",
      record_ids: [row.id],
    }));
  }

  const operationMatches = snapshot.operation_runs.filter((row) => (
    row.operation_type === "candidate_intake"
    && row.idempotency_key === record.args.p_idempotency_key
  ));
  for (const row of operationMatches) {
    const storedHash = nestedString(row.request, ["candidate", "county_seed", "payload_hash"]);
    if (storedHash !== record.payload_sha256) {
      findings.push(finding({
        check: "idempotency_collision",
        severity: "blocker",
        code: "idempotency_payload_hash_mismatch",
        message: "The idempotency key exists with a different or missing stored payload hash.",
        record_type: "operation_run",
        record_ids: [row.id],
      }));
    } else if (row.status === "succeeded") {
      const candidateId = nestedString(row.summary, ["candidate_id"]);
      if (candidateId) equivalentCandidateIds.add(candidateId);
      findings.push(finding({
        check: "idempotency_collision",
        severity: "info",
        code: "idempotent_success_no_op",
        message: "The same idempotency key and payload hash already succeeded; replay is a no-op.",
        record_type: "operation_run",
        record_ids: [row.id],
      }));
    } else {
      findings.push(finding({
        check: "idempotency_collision",
        severity: "blocker",
        code: "idempotency_outcome_uncertain",
        message: `The same idempotency identity is ${row.status}; reconcile its outcome before retrying.`,
        record_type: "operation_run",
        record_ids: [row.id],
      }));
    }
  }

  const candidateById = new Map(snapshot.candidates.map((row) => [row.id, row]));
  const sourceMatches = snapshot.sources.filter((row) => safeUrlKey(row.source_url) === officialUrlKey);
  const reviewedSiblingSources = sourceMatches.filter((row) => {
    const owner = candidateById.get(row.candidate_id);
    const ownerCleanId = owner ? candidateCleanId(owner) : null;
    return Boolean(ownerCleanId && cohort.shared_official_url_clean_ids.includes(ownerCleanId));
  });
  const nonEquivalentSources = sourceMatches.filter((row) => (
    !equivalentCandidateIds.has(row.candidate_id)
    && !reviewedSiblingSources.includes(row)
  ));
  if (nonEquivalentSources.length) {
    findings.push(finding({
      check: "official_source_elsewhere",
      severity: "blocker",
      code: "official_source_attached_elsewhere",
      message: "The normalized official source is attached to a different candidate identity.",
      record_type: "candidate_source",
      record_ids: nonEquivalentSources.map((row) => row.id),
    }));
  }
  if (cohort.shared_official_url_clean_ids.length > 1 || reviewedSiblingSources.length) {
    findings.push(finding({
      check: "official_source_elsewhere",
      severity: "warning",
      code: "reviewed_seed_cohort_shared_official_listing",
      message: `The official listing URL is shared by reviewed seed identities ${cohort.shared_official_url_clean_ids.join(", ")}; keep the event identities separate.`,
      record_type: reviewedSiblingSources.length ? "candidate_source" : undefined,
      record_ids: reviewedSiblingSources.map((row) => row.id),
    }));
  }

  const sharedOrganizerOrVenue = snapshot.candidates.filter((row) => {
    const rowName = normalizeName(row.normalized_name ?? row.candidate_name);
    if (rowName === name || equivalentCandidateIds.has(row.id)) return false;
    const rowOrganizer = nestedString(row.raw_payload, ["county_seed", "organizer", "normalized"])
      ?? nestedString(row.raw_payload, ["organizer"]);
    const rowVenue = normalizeName(row.venue_name ?? "");
    return Boolean((organizer && normalizeName(rowOrganizer ?? "") === organizer) || (venue && rowVenue === venue));
  });
  if (sharedOrganizerOrVenue.length) {
    findings.push(finding({
      check: "organizer_venue_shared",
      severity: "warning",
      code: "shared_organizer_or_venue",
      message: "Another candidate shares the organizer or venue; this is a warning and never an automatic merge.",
      record_type: "event_candidate",
      record_ids: sharedOrganizerOrVenue.map((row) => row.id),
    }));
  }
  if (cohort.shared_organizer_clean_ids.length > 1 || cohort.shared_venue_clean_ids.length > 1) {
    findings.push(finding({
      check: "organizer_venue_shared",
      severity: "warning",
      code: "reviewed_seed_cohort_shared_organizer_or_venue",
      message: "The finalized workbook contains distinct event identities sharing this organizer or venue; those identities must remain separate.",
    }));
  }

  const fuzzyMatches = [
    ...snapshot.events.map((row) => ({ id: row.id, type: "canonical_event" as const, name: row.name })),
    ...snapshot.candidates.map((row) => ({ id: row.id, type: "event_candidate" as const, name: row.candidate_name })),
  ].filter((row) => {
    const normalized = normalizeName(row.name);
    return normalized !== name && !aliases.has(normalized) && diceCoefficient(name, normalized) >= 0.82;
  });
  if (fuzzyMatches.length) {
    findings.push(finding({
      check: "fuzzy_name",
      severity: "warning",
      code: "fuzzy_review_only",
      message: "Similar names exist, but fuzzy similarity is review-only and never creates a match.",
      record_ids: fuzzyMatches.map((row) => row.id),
    }));
  }

  const blockers = [...new Set(findings.filter((entry) => entry.severity === "blocker").map((entry) => entry.code))];
  const warnings = [...new Set(findings.filter((entry) => entry.severity === "warning").map((entry) => entry.code))];
  const hasEquivalent = equivalentCandidateIds.size > 0
    || findings.some((entry) => entry.code === "idempotent_success_no_op");
  const action = blockers.length ? "blocked" : hasEquivalent ? "no_op_equivalent" : "stage_new_candidate";
  const status = (check: PreflightFinding["check"], equivalentCodes: string[] = []) => {
    const matches = findings.filter((entry) => entry.check === check);
    if (matches.some((entry) => entry.severity === "blocker")) {
      return check === "idempotency_collision"
        && matches.some((entry) => entry.code === "idempotency_outcome_uncertain")
        ? "uncertain"
        : "blocked";
    }
    if (matches.some((entry) => equivalentCodes.includes(entry.code))) return "equivalent_no_op";
    if (matches.some((entry) => entry.severity === "warning")) return "warning";
    return "clear";
  };
  return {
    clean_id: record.clean_id,
    checked_at: snapshot.captured_at,
    method: snapshot.method,
    action,
    equivalent_candidate_id: [...equivalentCandidateIds].sort()[0] ?? null,
    findings,
    blockers,
    warnings,
    checks: {
      canonical_match: status("canonical_match") as "clear" | "blocked",
      exact_official_url: (
        cohort.shared_official_url_clean_ids.length > 1
          ? "warning"
          : canonicalUrlMatches.length || candidateUrlMatches.some((row) => !equivalentCandidateIds.has(row.id))
            ? "blocked"
            : "clear"
      ),
      name_municipality: canonicalNameMatches.length || candidateNameMatches.some((row) => !equivalentCandidateIds.has(row.id)) ? "blocked" : "clear",
      alias_location: canonicalAliasMatches.length || candidateAliasMatches.some((row) => !equivalentCandidateIds.has(row.id)) ? "blocked" : "clear",
      slug_collision: status("slug_collision", ["equivalent_slug_payload"]) as "clear" | "equivalent_no_op" | "blocked",
      idempotency_collision: status("idempotency_collision", ["idempotent_success_no_op"]) as "clear" | "equivalent_no_op" | "blocked" | "uncertain",
      candidate_identity: status("candidate_identity", ["equivalent_county_identity"]) as "clear" | "equivalent_no_op" | "blocked",
      official_source_elsewhere: status("official_source_elsewhere") as "clear" | "warning" | "blocked",
      organizer_venue_shared: status("organizer_venue_shared") as "clear" | "warning",
      promoted_candidate: status("promoted_candidate") as "clear" | "blocked",
      fuzzy_name: status("fuzzy_name") as "clear" | "warning",
    },
  };
}

export function manifestHash(manifest: CountySeedBatchManifest) {
  const copy = structuredClone(manifest);
  copy.integrity.manifest_sha256 = "";
  return sha256Canonical(copy);
}

export function verifyManifestIntegrity(manifest: CountySeedBatchManifest) {
  const actual = manifestHash(manifest);
  if (actual !== manifest.integrity.manifest_sha256) {
    throw new Error(`Dirty manifest: expected ${manifest.integrity.manifest_sha256}, calculated ${actual}.`);
  }
  return actual;
}

export function buildBatch1Manifest(args: {
  workbookFileName: string;
  workbookFingerprint: string;
  approvedSheetFingerprint: string;
  inventoryName: string;
  batchId: string;
  preparedAt: string;
  records: PreparedCountySeedRecord[];
  preflights: CountySeedRecordPreflight[];
  schemaGuardDeployed: boolean;
  snapshotSummary: CountySeedBatchManifest["read_only_snapshot"];
}): CountySeedBatchManifest {
  const preflightById = new Map(args.preflights.map((preflight) => [preflight.clean_id, preflight]));
  const records = [...args.records]
    .sort((left, right) => left.clean_id.localeCompare(right.clean_id))
    .map((record): CountySeedManifestRecord => {
      const preflight = preflightById.get(record.clean_id);
      if (!preflight) throw new Error(`Missing preflight result for ${record.clean_id}.`);
      const eligibilityBlockers = [
        ...preflight.blockers,
        ...(!args.schemaGuardDeployed ? ["required_schema_guard_not_deployed"] : []),
        "batch_1_execution_not_human_approved",
      ];
      return {
        ...record,
        preflight,
        intended_action: "stage_new_candidate",
        status: "not_executed",
        eligibility: {
          preflight_eligible: preflight.action === "stage_new_candidate" && preflight.blockers.length === 0,
          execution_eligible: false,
          blockers: [...new Set(eligibilityBlockers)],
        },
        eventual_candidate_id: null,
        error: null,
        retry: {
          attempts: 0,
          allowed_after: "fresh_preflight_and_explicit_human_approval",
          uncertain_outcome_policy: "stop_and_reconcile_before_retry",
        },
        approval: {
          staging_execution: "not_authorized",
          publication: "not_authorized",
        },
        audit: [
          { at: args.preparedAt, state: "manifest_prepared", detail: "Immutable Batch 1 record prepared; no RPC executed." },
          { at: preflight.checked_at, state: "preflight_completed", detail: "Read-only PostgREST GET preflight completed." },
        ],
      };
    });
  const manifest: CountySeedBatchManifest = {
    contract_version: 1,
    mode: "immutable_non_executed_batch_1_manifest",
    batch_id: args.batchId,
    inventory_name: args.inventoryName,
    workbook_file_name: args.workbookFileName,
    workbook_fingerprint: args.workbookFingerprint,
    approved_sheet_fingerprint: args.approvedSheetFingerprint,
    prepared_at: args.preparedAt,
    required_schema_guard: {
      migration: COUNTY_SEED_GUARD_MIGRATION,
      guarded_rpc: `public.${COUNTY_SEED_GUARDED_RPC}`,
      deployed: args.schemaGuardDeployed,
    },
    read_only_snapshot: args.snapshotSummary,
    execution: {
      authorized: false,
      default_command_mode: "preflight",
      confirmation_requirement: "exact_manifest_sha256",
      batch_0_rejected: true,
      dirty_manifest_rejected: true,
      unresolved_matches_rejected: true,
      insufficient_information_rejected: true,
      equivalence_conflicts_rejected: true,
    },
    records,
    integrity: {
      algorithm: "sha256",
      manifest_sha256: "",
    },
  };
  manifest.integrity.manifest_sha256 = manifestHash(manifest);
  return manifest;
}

export function validateApplyAuthorization(args: {
  manifest: CountySeedBatchManifest;
  confirmation: string | null;
  allowExecution: boolean;
}) {
  const hash = verifyManifestIntegrity(args.manifest);
  if (!args.allowExecution) throw new Error("Apply is not authorized by this invocation.");
  if (args.confirmation !== hash) throw new Error("Confirmation token must exactly match the immutable manifest SHA-256.");
  if (args.manifest.mode !== "immutable_non_executed_batch_1_manifest") {
    throw new Error("Only the reviewed Batch 1 manifest type can enter the guarded apply path.");
  }
  if (!args.manifest.required_schema_guard.deployed) {
    throw new Error(`Required schema guard ${args.manifest.required_schema_guard.migration} is not deployed.`);
  }
  if (!args.manifest.execution.authorized) {
    throw new Error("The immutable manifest does not contain human staging authorization.");
  }
  const blocked = args.manifest.records.filter((record) => (
    record.preflight.action === "blocked"
    || record.preflight.blockers.length > 0
    || !record.eligibility.preflight_eligible
    || !record.eligibility.execution_eligible
    || record.approval.staging_execution !== "human_approved"
  ));
  if (blocked.length) {
    throw new Error(`Manifest contains blocked or unresolved records: ${blocked.map((record) => record.clean_id).join(", ")}.`);
  }
  return hash;
}

export function validateBatch0NoWriteCrosswalk(value: unknown) {
  const crosswalk = object(value);
  if (!crosswalk || crosswalk.mode !== "batch_0_crosswalk_only_no_write") {
    throw new Error("Batch 0 artifact must be a no-write crosswalk.");
  }
  const records = Array.isArray(crosswalk.records) ? crosswalk.records : [];
  const ids = records.map((record) => object(record)?.clean_id).sort();
  if (stableJson(ids) !== stableJson([...BATCH_0_CLEAN_IDS].sort())) {
    throw new Error("Batch 0 crosswalk must contain only MAC-001 and MAC-050.");
  }
  for (const rawRecord of records) {
    const record = object(rawRecord);
    if (
      !record
      || record.action !== "retain_seed_to_canonical_crosswalk_only"
      || record.rpc !== null
      || stableJson(record.database_writes) !== "[]"
    ) {
      throw new Error("Batch 0 records may not define an RPC or database write.");
    }
  }
  return true;
}
