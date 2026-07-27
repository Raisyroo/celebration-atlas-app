import { access } from "node:fs/promises";
import path from "node:path";
import type {
  ExistingCanonicalEvent,
  ExistingEventCandidate,
  SchemaParityReport,
} from "./types.ts";

const TABLE_CONTRACTS: Record<string, readonly string[]> = {
  discovery_runs: [
    "id", "run_type", "source_id", "status", "started_at", "completed_at", "items_found",
    "candidates_created", "duplicates_flagged", "estimated_cost", "actual_cost", "approval_required",
    "approval_status", "error_message", "notes", "run_metadata", "created_at",
  ],
  event_candidates: [
    "id", "discovery_run_id", "candidate_name", "normalized_name", "slug_candidate", "event_type",
    "category", "subcategory", "city", "county", "state", "country", "venue_name", "start_date",
    "end_date", "typical_month", "typical_season", "probable_recurrence", "description",
    "official_website_candidate", "social_links", "source_urls", "discovery_confidence",
    "verification_status", "duplicate_status", "matched_event_id", "needs_review", "semantic_notes",
    "raw_payload", "created_at", "updated_at",
  ],
  event_candidate_sources: [
    "id", "candidate_id", "source_name", "source_url", "source_type", "source_excerpt",
    "trust_score", "last_accessed", "created_at",
  ],
  events: [
    "id", "name", "slug", "event_type", "category", "subcategory", "city", "county", "state",
    "country", "venue_name", "official_website", "facebook_url", "instagram_url", "typical_month",
    "typical_season", "recurrence_pattern", "short_description", "long_description", "status",
    "verification_status", "confidence_score", "first_discovered_at", "last_verified_at", "created_at",
    "updated_at", "latitude", "longitude", "location_confidence", "location_source", "geocoded_at",
    "location_verified",
  ],
  atlas_operation_runs: [
    "id", "operation_type", "actor_type", "actor_identity", "status", "idempotency_key", "request",
    "summary", "error", "created_at", "started_at", "completed_at", "updated_at",
  ],
  atlas_operation_actions: [
    "id", "operation_run_id", "action_type", "target_entity_type", "target_entity_id",
    "lifecycle_state", "source_references", "requested_payload", "before_snapshot", "applied_payload",
    "after_snapshot", "reason", "warnings", "failure", "created_at", "applied_at", "updated_at",
  ],
};

type OpenApiSchema = {
  definitions?: Record<string, {
    required?: string[];
    properties?: Record<string, {
      type?: string;
      format?: string;
      default?: unknown;
      description?: string;
    }>;
  }>;
};

function requireConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) throw new Error("Read-only schema inspection requires configured Supabase URL and service-role credentials.");
  return { url: url.replace(/\/+$/, ""), key };
}

async function getJson(url: string, key: string, accept?: string) {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(accept ? { Accept: accept } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Read-only Supabase request failed with status ${response.status}.`);
  return payload;
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function inspectDeployedSchema(repoRoot = process.cwd()): Promise<SchemaParityReport> {
  const { url, key } = requireConnection();
  const openApi = await getJson(`${url}/rest/v1/`, key, "application/openapi+json") as OpenApiSchema;
  const definitions = openApi.definitions ?? {};
  const inspectedTables = Object.entries(TABLE_CONTRACTS).map(([table, expectedColumns]) => {
    const definition = definitions[table];
    const columns = definition?.properties ?? {};
    const deployedColumns = Object.keys(columns);
    return {
      table,
      deployed: Boolean(definition),
      missingTrackedColumns: expectedColumns.filter((column) => !deployedColumns.includes(column)),
      unexpectedDeployedColumns: deployedColumns.filter((column) => !expectedColumns.includes(column)).sort(),
      requiredColumns: [...(definition?.required ?? [])].sort(),
      columns: Object.fromEntries(Object.entries(columns).sort(([left], [right]) => left.localeCompare(right))),
    };
  });
  const foundationalMigrationTracked = await exists(path.join(repoRoot, "supabase", "migrations", "004_atlas_control_plane.sql"));
  const generatedDatabaseTypesTracked = await Promise.all([
    path.join(repoRoot, "types", "database.ts"),
    path.join(repoRoot, "lib", "database.types.ts"),
    path.join(repoRoot, "supabase", "database.types.ts"),
  ]).then((checks) => Promise.all(checks.map(exists))).then((checks) => checks.some(Boolean));
  const blockers = inspectedTables.flatMap((table) => (
    !table.deployed
      ? [`Deployed table ${table.table} is unavailable.`]
      : table.missingTrackedColumns.map((column) => `Deployed table ${table.table} is missing tracked column ${column}.`)
  ));
  return {
    source: "deployed-postgrest-openapi",
    inspectedTables,
    foundationalMigrationTracked,
    generatedDatabaseTypesTracked,
    limitations: [
      "PostgREST OpenAPI exposes deployed columns, required fields, defaults, and primary/foreign-key descriptions, but not every check constraint or unique index.",
      "Tracked migration 010 documents the candidate-intake write contract and migration 011 documents Event Factory foreign-key usage, but neither replaces the missing foundational table definitions.",
      "No schema mutation, migration generation, or write RPC is performed by this inspector.",
    ],
    blockers,
  };
}

function queryUrl(baseUrl: string, table: string, select: string) {
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("state", "eq.Michigan");
  url.searchParams.set("limit", "1000");
  return url.toString();
}

export async function loadExistingMatchRecords() {
  const { url, key } = requireConnection();
  const [events, candidates] = await Promise.all([
    getJson(
      queryUrl(
        url,
        "events",
        "id,name,slug,city,county,venue_name,official_website,typical_month,typical_season,status,verification_status",
      ),
      key,
    ) as Promise<ExistingCanonicalEvent[]>,
    getJson(
      queryUrl(
        url,
        "event_candidates",
        "id,candidate_name,normalized_name,slug_candidate,city,county,venue_name,official_website_candidate,typical_month,typical_season,verification_status,duplicate_status,matched_event_id,raw_payload",
      ),
      key,
    ) as Promise<ExistingEventCandidate[]>,
  ]);
  return {
    events: [...events].sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id)),
    candidates: [...candidates].sort((left, right) => left.candidate_name.localeCompare(right.candidate_name) || left.id.localeCompare(right.id)),
  };
}

export const COUNTY_SEED_READ_ONLY_TABLES = [
  "events",
  "event_candidates",
] as const;
