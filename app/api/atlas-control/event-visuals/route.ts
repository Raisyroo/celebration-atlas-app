import { NextResponse } from "next/server";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import {
  createEventVisualWorkflowRevision,
  getEventVisualWorkflow,
  listEventVisualWorkflows,
  reviewEventVisualWorkflow,
  saveEventVisualWorkflow,
  saveEventVisualWorkflowRevisionQa,
} from "@/lib/event-factory/visuals";
import type { EventVisualLane, EventVisualReference } from "@/lib/event-factory/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

function referenceSources(value: unknown): EventVisualReference[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [{ url: item.trim() }] : [];
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const source = item as Record<string, unknown>;
    const url = text(source.url);
    if (!url) return [];
    const label = text(source.label);
    return [{ url, ...(label ? { label } : {}) }];
  });
}

function motifs(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean)
    : [];
}

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const workflows = await listEventVisualWorkflows();
  return noStoreJson(workflows, workflows.error ? 503 : 200);
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return noStoreJson({ error: "A JSON request body is required." }, 400);

  const action = text(payload.action);
  const workflowId = text(payload.workflowId);
  const notes = text(payload.notes);
  if (notes.length > 2000) return noStoreJson({ error: "Review notes must be 2,000 characters or fewer." }, 400);

  try {
    if (action === "save") {
      const candidateId = text(payload.candidateId);
      const sourceBundleId = text(payload.sourceBundleId);
      const eventKey = text(payload.eventKey);
      const eventName = text(payload.eventName);
      const locationLabel = text(payload.locationLabel);
      const searchQuery = text(payload.searchQuery);
      const heroMoment = text(payload.heroMoment);
      const lane = text(payload.lane) as EventVisualLane;
      const targetYear = Number(payload.targetYear);
      const reviewedThumbnailCount = Number(payload.reviewedThumbnailCount);
      if (!UUID.test(candidateId)) return noStoreJson({ error: "A valid event candidate is required." }, 400);
      if (sourceBundleId && !UUID.test(sourceBundleId)) return noStoreJson({ error: "The source bundle id is invalid." }, 400);
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(eventKey)) return noStoreJson({ error: "A valid event key is required." }, 400);
      if (!eventName || !locationLabel || !searchQuery) return noStoreJson({ error: "Event name, location, and search query are required." }, 400);
      if (!Number.isInteger(targetYear) || targetYear < 2000 || targetYear > 2100) return noStoreJson({ error: "A valid target year is required." }, 400);
      if (!Number.isInteger(reviewedThumbnailCount) || reviewedThumbnailCount < 0 || reviewedThumbnailCount > 60) {
        return noStoreJson({ error: "Reviewed thumbnail count must be between 0 and 60." }, 400);
      }
      if (!['fast_visual', 'editorial'].includes(lane)) return noStoreJson({ error: "Choose a supported visual lane." }, 400);

      const existing = workflowId ? await getEventVisualWorkflow(workflowId) : null;
      if (existing && existing.candidateId !== candidateId) return noStoreJson({ error: "Visual workflow and candidate do not match." }, 400);
      const rawQa = payload.qaChecks && typeof payload.qaChecks === "object" && !Array.isArray(payload.qaChecks)
        ? payload.qaChecks as Record<string, unknown>
        : {};
      if (existing?.supersedesWorkflowId) {
        const result = await saveEventVisualWorkflowRevisionQa({
          workflowId: existing.id,
          qaChecks: {
            visualElementsVerified: rawQa.visualElementsVerified === true,
            independentComposition: rawQa.independentComposition === true,
            noInventedTextOrMarks: rawQa.noInventedTextOrMarks === true,
            mobileCropVerified: rawQa.mobileCropVerified === true,
          },
          actorIdentity: auth.admin.email,
        });
        return noStoreJson({ result });
      }
      const result = await saveEventVisualWorkflow({
        candidateId,
        sourceBundleId: sourceBundleId || existing?.sourceBundleId || null,
        targetYear,
        eventKey,
        eventName,
        locationLabel,
        lane,
        searchQuery,
        reviewedThumbnailCount,
        referenceSources: referenceSources(payload.referenceSources),
        motifs: motifs(payload.motifs),
        heroMoment,
        asset: existing?.asset ?? null,
        qaChecks: {
          visualElementsVerified: rawQa.visualElementsVerified === true,
          independentComposition: rawQa.independentComposition === true,
          noInventedTextOrMarks: rawQa.noInventedTextOrMarks === true,
          mobileCropVerified: rawQa.mobileCropVerified === true,
          publicAssetVerified: existing?.qaChecks.publicAssetVerified ?? false,
        },
        actorIdentity: auth.admin.email,
      });
      return noStoreJson({ result });
    }

    if (action === "revise") {
      if (!UUID.test(workflowId)) return noStoreJson({ error: "A valid visual workflow id is required." }, 400);
      const result = await createEventVisualWorkflowRevision({
        workflowId,
        actorIdentity: auth.admin.email,
        notes: notes || undefined,
      });
      return noStoreJson({ result });
    }

    if (action === "approve" || action === "reject" || action === "reopen") {
      if (!UUID.test(workflowId)) return noStoreJson({ error: "A valid visual workflow id is required." }, 400);
      const result = await reviewEventVisualWorkflow({
        workflowId,
        decision: action,
        actorIdentity: auth.admin.email,
        notes: notes || undefined,
      });
      return noStoreJson({ result });
    }

    return noStoreJson({ error: "Unsupported visual workflow action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Visual workflow operation failed.";
    if (/required|not found|invalid|match|belong|only|complete|reopened|retained|public source/i.test(message)) {
      return noStoreJson({ error: message }, 400);
    }
    return noStoreJson({ error: "Visual workflow operation failed. Confirm migration 014 is applied." }, 502);
  }
}
