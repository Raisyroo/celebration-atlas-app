import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import {
  approveAndPublishEventFactoryPackage,
  createEventFactoryArtRevision,
  prepareEventFactoryPackage,
  reviewEventFactoryPackage,
} from "@/lib/event-factory/packages";
import { getEventFactoryOverview } from "@/lib/event-factory/readiness";

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

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const overview = await getEventFactoryOverview();
  return noStoreJson(overview, overview.state === "ready" ? 200 : 503);
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return noStoreJson({ error: "A JSON request body is required." }, 400);

  const action = text(payload.action);
  const packageId = text(payload.packageId);
  const candidateId = text(payload.candidateId);
  const verificationCaseId = text(payload.verificationCaseId);
  const notes = text(payload.notes);
  if (notes.length > 2000) return noStoreJson({ error: "Review notes must be 2,000 characters or fewer." }, 400);

  try {
    if (action === "prepare") {
      if (!UUID.test(candidateId) || !UUID.test(verificationCaseId)) {
        return noStoreJson({ error: "A valid candidate and verification case are required." }, 400);
      }
      const result = await prepareEventFactoryPackage({
        candidateId,
        verificationCaseId,
        actorIdentity: auth.admin.email,
      });
      return noStoreJson({ result });
    }

    if (action === "approve_and_publish") {
      if (!UUID.test(packageId)) return noStoreJson({ error: "A valid event package id is required." }, 400);
      const result = await approveAndPublishEventFactoryPackage({
        packageId,
        actorIdentity: auth.admin.email,
        notes: notes || undefined,
      });
      return noStoreJson({ result });
    }

    if (action === "remove_art_and_publish") {
      if (!UUID.test(packageId)) return noStoreJson({ error: "A valid published event package id is required." }, 400);
      const revision = await createEventFactoryArtRevision({
        sourcePackageId: packageId,
        visualWorkflowId: null,
        actorIdentity: auth.admin.email,
        notes: notes || "Prepared reviewed removal of Event Hub hero art.",
      });
      const revisionPackageId = text(revision.package_id);
      if (!UUID.test(revisionPackageId)) throw new Error("The art removal revision did not return a valid package id.");
      const result = await approveAndPublishEventFactoryPackage({
        packageId: revisionPackageId,
        actorIdentity: auth.admin.email,
        notes: notes || "Approved Event Hub hero removal; image-free hero retained.",
      });
      const eventKey = text(revision.event_key);
      if (eventKey) revalidatePath(`/events/${eventKey}`);
      revalidatePath("/");
      return noStoreJson({ result, packageId: revisionPackageId, publicPath: eventKey ? `/events/${eventKey}` : null });
    }

    if (action === "reject" || action === "reopen") {
      if (!UUID.test(packageId)) return noStoreJson({ error: "A valid event package id is required." }, 400);
      const result = await reviewEventFactoryPackage({
        packageId,
        decision: action,
        actorIdentity: auth.admin.email,
        notes: notes || undefined,
      });
      return noStoreJson({ result });
    }

    return noStoreJson({ error: "Unsupported Event Factory action." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Event Factory operation failed.";
    if (/required|not found|not ready|cannot|only|invalid|match|duplicate|remove|complete/i.test(message)) {
      return noStoreJson({ error: message }, 400);
    }
    return noStoreJson({ error: "Event Factory operation failed. Confirm migration 011 is applied." }, 502);
  }
}
