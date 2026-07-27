import type {
  CountySeedPreflightSnapshot,
  PreflightCandidateRow,
  PreflightOperationRow,
  PreflightSourceRow,
} from "./staging.ts";
import type { ExistingCanonicalEvent } from "./types.ts";

function requireConnection() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("County-seed preflight requires configured Supabase URL and service-role credentials.");
  }
  return { url: url.replace(/\/+$/, ""), key };
}

async function getJson<T>(url: URL | string, key: string, accept?: string): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(accept ? { Accept: accept } : {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Read-only Supabase request failed with status ${response.status}.`);
  }
  return payload as T;
}

function tableUrl(baseUrl: string, table: string, select: string) {
  const url = new URL(`${baseUrl}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("limit", "5000");
  return url;
}

type OpenApiDocument = {
  paths?: Record<string, unknown>;
};

export async function loadCountySeedPreflightSnapshot(
  capturedAt = new Date().toISOString(),
): Promise<CountySeedPreflightSnapshot> {
  const { url, key } = requireConnection();
  const [events, candidates, sources, operationRuns, openApi] = await Promise.all([
    getJson<ExistingCanonicalEvent[]>(
      tableUrl(
        url,
        "events",
        "id,name,slug,city,county,venue_name,official_website,typical_month,typical_season,status,verification_status",
      ),
      key,
    ),
    getJson<PreflightCandidateRow[]>(
      tableUrl(
        url,
        "event_candidates",
        "id,candidate_name,normalized_name,slug_candidate,city,county,venue_name,official_website_candidate,typical_month,typical_season,verification_status,duplicate_status,matched_event_id,raw_payload,source_urls,created_at",
      ),
      key,
    ),
    getJson<PreflightSourceRow[]>(
      tableUrl(url, "event_candidate_sources", "id,candidate_id,source_url,source_type,created_at"),
      key,
    ),
    getJson<PreflightOperationRow[]>(
      tableUrl(url, "atlas_operation_runs", "id,operation_type,idempotency_key,status,request,summary,created_at"),
      key,
    ),
    getJson<OpenApiDocument>(`${url}/rest/v1/`, key, "application/openapi+json"),
  ]);
  return {
    captured_at: capturedAt,
    method: "PostgREST GET only",
    schema_guard: {
      guarded_rpc_visible: Boolean(openApi.paths?.["/rpc/atlas_stage_county_seed_candidate"]),
      required_migration: "018_guard_county_seed_candidate_staging.sql",
    },
    events: [...events].sort((left, right) => left.id.localeCompare(right.id)),
    candidates: [...candidates].sort((left, right) => left.id.localeCompare(right.id)),
    sources: [...sources].sort((left, right) => left.id.localeCompare(right.id)),
    operation_runs: [...operationRuns].sort((left, right) => left.id.localeCompare(right.id)),
  };
}
export function summarizeDuplicateConstraints(snapshot: CountySeedPreflightSnapshot) {
  const duplicates = <T>(rows: T[], key: (row: T) => string | null) => {
    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const identity = key(row);
      if (!identity) continue;
      const id = typeof (row as { id?: unknown }).id === "string"
        ? (row as { id: string }).id
        : "<unknown>";
      groups.set(identity, [...(groups.get(identity) ?? []), id]);
    }
    return [...groups.entries()]
      .filter(([, ids]) => ids.length > 1)
      .map(([identity, ids]) => ({ identity, ids }))
      .sort((left, right) => left.identity.localeCompare(right.identity));
  };
  const nested = (value: unknown, keys: string[]) => {
    let current: unknown = value;
    for (const key of keys) {
      current = current && typeof current === "object" && !Array.isArray(current)
        ? (current as Record<string, unknown>)[key]
        : null;
    }
    return typeof current === "string" && current.trim() ? current.trim() : null;
  };
  return {
    inspected_counts: {
      event_candidates: snapshot.candidates.length,
      event_candidate_sources: snapshot.sources.length,
      atlas_operation_runs: snapshot.operation_runs.length,
      events: snapshot.events.length,
    },
    duplicate_candidate_slugs: duplicates(snapshot.candidates, (row) => row.slug_candidate),
    duplicate_candidate_source_associations: duplicates(
      snapshot.sources,
      (row) => `${row.candidate_id}|${row.source_url.trim()}`,
    ),
    duplicate_operation_identities: duplicates(
      snapshot.operation_runs,
      (row) => `${row.operation_type}|${row.idempotency_key}`,
    ),
    duplicate_county_seed_identities: duplicates(snapshot.candidates, (row) => {
      const countyCode = nested(row.raw_payload, ["county_seed", "county_code"]);
      const cleanId = nested(row.raw_payload, ["county_seed", "clean_id"]);
      return countyCode && cleanId ? `${countyCode.toLowerCase()}|${cleanId}` : null;
    }),
    null_candidate_slugs: snapshot.candidates.filter((row) => !row.slug_candidate).map((row) => row.id),
  };
}
