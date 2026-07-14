import { NextResponse } from "next/server";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import {
  addEventVerificationEvidence,
  createEventVerificationCase,
  listEventVerificationCases,
  transitionEventVerificationCase,
} from "@/lib/event-factory/verification";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PROOF_KINDS = new Set(["official_identity", "current_occurrence", "current_dates", "annual_language", "prior_occurrence", "venue", "location", "independent_listing", "cancellation_status", "other"]);
const SOURCE_KINDS = new Set(["official_event", "organizer", "government", "tourism", "venue", "archive", "news", "social", "directory", "other"]);
const CONFIDENCE = new Set(["unknown", "low", "medium", "high", "verified"]);

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const result = await listEventVerificationCases();
  return noStoreJson(result, result.error ? 503 : 200);
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return noStoreJson({ error: "A JSON request body is required." }, 400);
  const action = text(payload.action);

  try {
    if (action === "create") {
      const candidateId = text(payload.candidateId);
      const eventId = text(payload.eventId);
      const targetYear = Number(payload.targetYear);
      if ((!candidateId || !UUID.test(candidateId)) && (!eventId || !UUID.test(eventId))) {
        return noStoreJson({ error: "A valid candidate or canonical event id is required." }, 400);
      }
      if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) {
        return noStoreJson({ error: "A target year between 2000 and 2100 is required." }, 400);
      }
      const result = await createEventVerificationCase({ candidateId: candidateId || undefined, eventId: eventId || undefined, targetYear, actorIdentity: auth.admin.email });
      return noStoreJson({ result });
    }

    if (action === "add_evidence") {
      const verificationCaseId = text(payload.verificationCaseId);
      const sourceSnapshotId = text(payload.sourceSnapshotId);
      const proofKind = text(payload.proofKind);
      const sourceKind = text(payload.sourceKind);
      const sourceUrl = text(payload.sourceUrl);
      const excerpt = text(payload.excerpt);
      const confidence = text(payload.confidence) || "medium";
      const occurrenceYear = payload.occurrenceYear === null || payload.occurrenceYear === undefined || payload.occurrenceYear === "" ? undefined : Number(payload.occurrenceYear);
      const confidenceScore = payload.confidenceScore === null || payload.confidenceScore === undefined || payload.confidenceScore === "" ? undefined : Number(payload.confidenceScore);
      if (!UUID.test(verificationCaseId)) return noStoreJson({ error: "A valid verification case id is required." }, 400);
      if (sourceSnapshotId && !UUID.test(sourceSnapshotId)) return noStoreJson({ error: "Source snapshot id is invalid." }, 400);
      if (!PROOF_KINDS.has(proofKind)) return noStoreJson({ error: "Verification proof kind is invalid." }, 400);
      if (!SOURCE_KINDS.has(sourceKind)) return noStoreJson({ error: "Verification source kind is invalid." }, 400);
      try { const url = new URL(sourceUrl); if (!["http:", "https:"].includes(url.protocol)) throw new Error(); } catch { return noStoreJson({ error: "A valid public source URL is required." }, 400); }
      if (!excerpt || excerpt.length > 4000) return noStoreJson({ error: "A source excerpt between 1 and 4000 characters is required." }, 400);
      if (!CONFIDENCE.has(confidence)) return noStoreJson({ error: "Evidence confidence is invalid." }, 400);
      if (occurrenceYear !== undefined && (!Number.isInteger(occurrenceYear) || occurrenceYear < 1900 || occurrenceYear > 2100)) return noStoreJson({ error: "Occurrence year is invalid." }, 400);
      if (confidenceScore !== undefined && (!Number.isFinite(confidenceScore) || confidenceScore < 0 || confidenceScore > 1)) return noStoreJson({ error: "Confidence score must be between 0 and 1." }, 400);
      const result = await addEventVerificationEvidence({
        verificationCaseId,
        sourceSnapshotId: sourceSnapshotId || undefined,
        proofKind,
        sourceKind,
        sourceUrl,
        sourceTitle: text(payload.sourceTitle) || undefined,
        excerpt,
        occurrenceYear,
        isOfficial: payload.isOfficial === true,
        confidence,
        confidenceScore,
        contentHash: text(payload.contentHash) || undefined,
        actorIdentity: auth.admin.email,
      });
      return noStoreJson({ result });
    }

    if (["submit", "verify", "reject", "reopen"].includes(action)) {
      const verificationCaseId = text(payload.verificationCaseId);
      if (!UUID.test(verificationCaseId)) return noStoreJson({ error: "A valid verification case id is required." }, 400);
      const result = await transitionEventVerificationCase({ verificationCaseId, action: action as "submit" | "verify" | "reject" | "reopen", actorIdentity: auth.admin.email, notes: text(payload.notes) || undefined });
      return noStoreJson({ result });
    }

    return noStoreJson({ error: "Unsupported verification action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Event verification operation failed.";
    if (/not found|required|only|cannot|unsupported|must be confirmed/i.test(message)) return noStoreJson({ error: message }, 400);
    return noStoreJson({ error: "Event verification operation failed. Confirm migration 008 is applied." }, 502);
  }
}
