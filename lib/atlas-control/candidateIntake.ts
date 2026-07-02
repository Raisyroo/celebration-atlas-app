import "server-only";

export type CandidateIntakePayload = {
  idempotencyKey: string;
  name: string;
  city: string;
  county?: string;
  state?: string;
  startDate?: string;
  endDate?: string;
  sourceName: string;
  sourceUrl: string;
  sourceExcerpt?: string;
  confidence?: number;
};

export function slugifyCandidate(name: string, city: string, state: string) {
  return [name, city, state].join("-").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 120);
}

function text(value: unknown) { return typeof value === "string" ? value.trim() : ""; }
function validDate(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)); }

export function validateCandidateIntake(input: unknown): { ok: true; value: CandidateIntakePayload } | { ok: false; errors: string[] } {
  const body = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const errors: string[] = [];
  const value: CandidateIntakePayload = {
    idempotencyKey: text(body.idempotencyKey), name: text(body.name), city: text(body.city), county: text(body.county) || undefined,
    state: text(body.state) || "MI", startDate: text(body.startDate) || undefined, endDate: text(body.endDate) || undefined,
    sourceName: text(body.sourceName), sourceUrl: text(body.sourceUrl), sourceExcerpt: text(body.sourceExcerpt) || undefined,
    confidence: typeof body.confidence === "number" ? body.confidence : text(body.confidence) ? Number(text(body.confidence)) : undefined,
  };
  if (!value.idempotencyKey || value.idempotencyKey.length > 160) errors.push("A stable idempotency key is required.");
  if (!value.name) errors.push("Event or festival name is required.");
  if (!value.city) errors.push("City is required.");
  if (value.state !== "MI" && value.state !== "Michigan") errors.push("Only Michigan candidate intake is enabled in this foundation.");
  if (value.startDate && !validDate(value.startDate)) errors.push("Start date must use YYYY-MM-DD.");
  if (value.endDate && !validDate(value.endDate)) errors.push("End date must use YYYY-MM-DD.");
  if (value.startDate && value.endDate && value.endDate < value.startDate) errors.push("End date must be on or after start date.");
  if (!value.sourceName) errors.push("Official source name is required.");
  try { const url = new URL(value.sourceUrl); if (!["http:", "https:"].includes(url.protocol)) errors.push("Official source URL must start with http:// or https://."); } catch { errors.push("Official source URL must be valid."); }
  if (value.confidence !== undefined && (!Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1)) errors.push("Confidence must be between 0 and 1.");
  return errors.length ? { ok: false, errors } : { ok: true, value };
}

export function toRpcPayload(payload: CandidateIntakePayload) {
  const state = payload.state === "Michigan" ? "MI" : (payload.state ?? "MI");
  const candidate = {
    candidate_name: payload.name,
    normalized_name: payload.name.toLowerCase(),
    slug_candidate: slugifyCandidate(payload.name, payload.city, state),
    city: payload.city,
    county: payload.county ?? null,
    state,
    start_date: payload.startDate ?? null,
    end_date: payload.endDate ?? null,
    discovery_confidence: payload.confidence ?? 0.8,
    semantic_notes: payload.sourceExcerpt ?? null,
    source_url: payload.sourceUrl,
  };
  const sources = [{ source_name: payload.sourceName, source_url: payload.sourceUrl, source_type: "official", source_excerpt: payload.sourceExcerpt ?? null, is_official: true, trust_score: payload.confidence ?? 0.9 }];
  return { candidate, sources };
}
