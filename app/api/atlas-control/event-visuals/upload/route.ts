import { NextResponse } from "next/server";
import { CELEBRATION_ATLAS_MEDIA_BUCKET } from "@/data/eventMedia";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import {
  attachEventVisualWorkflowRevisionAsset,
  getEventVisualWorkflow,
  saveEventVisualWorkflow,
} from "@/lib/event-factory/visuals";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HERO_BYTES = 16 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function extensionFor(file: File) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  return "webp";
}

function safeFilename(name: string) {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "hero";
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const supabase = createAtlasServiceClient();
  if (!supabase) return NextResponse.json({ error: "Atlas Supabase service configuration is incomplete." }, { status: 503 });

  const formData = await request.formData().catch(() => null);
  const workflowId = formData?.get("workflowId");
  const altText = formData?.get("altText");
  const file = formData?.get("hero");
  if (typeof workflowId !== "string" || !UUID.test(workflowId)) {
    return NextResponse.json({ error: "A valid visual workflow is required." }, { status: 400 });
  }
  if (typeof altText !== "string" || !altText.trim()) {
    return NextResponse.json({ error: "Descriptive hero alt text is required." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a hero image file." }, { status: 400 });
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) return NextResponse.json({ error: "Hero art must be JPG, PNG, or WEBP." }, { status: 400 });
  if (file.size > MAX_HERO_BYTES) return NextResponse.json({ error: "Hero art must be 16 MB or smaller." }, { status: 400 });

  try {
    const workflow = await getEventVisualWorkflow(workflowId);
    if (["approved", "archived"].includes(workflow.status)) {
      return NextResponse.json({ error: "Reopen this visual workflow before replacing its artwork." }, { status: 400 });
    }

    const storagePath = `events/${workflow.eventKey}/hero/${Date.now()}-${safeFilename(file.name)}.${extensionFor(file)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).upload(storagePath, bytes, {
      contentType: file.type,
      upsert: false,
    });
    if (upload.error) throw new Error(`Hero upload failed: ${upload.error.message}`);

    const { data: publicUrlData } = supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;
    const publicResponse = await fetch(publicUrl, { method: "HEAD", cache: "no-store" }).catch(() => null);
    if (!publicResponse?.ok || !publicResponse.headers.get("content-type")?.startsWith("image/")) {
      await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
      throw new Error("Uploaded hero art is not publicly reachable yet.");
    }

    const asset = {
      publicUrl,
      altText: altText.trim(),
      credit: "Celebration Atlas artwork",
      sourceKind: "supabase" as const,
      storageBucket: CELEBRATION_ATLAS_MEDIA_BUCKET,
      storagePath,
      contentType: file.type,
      byteSize: file.size,
    };
    const result = workflow.supersedesWorkflowId
      ? await attachEventVisualWorkflowRevisionAsset({
          workflowId: workflow.id,
          asset,
          actorIdentity: auth.admin.email,
        })
      : await saveEventVisualWorkflow({
          candidateId: workflow.candidateId,
          sourceBundleId: workflow.sourceBundleId,
          targetYear: workflow.targetYear,
          eventKey: workflow.eventKey,
          eventName: workflow.eventName,
          locationLabel: workflow.locationLabel,
          lane: workflow.lane,
          searchQuery: workflow.searchQuery,
          reviewedThumbnailCount: workflow.reviewedThumbnailCount,
          referenceSources: workflow.referenceSources,
          motifs: workflow.visualSignature.motifs,
          heroMoment: workflow.visualSignature.heroMoment,
          asset,
          qaChecks: {
            ...workflow.qaChecks,
            publicAssetVerified: true,
          },
          actorIdentity: auth.admin.email,
        });

    return NextResponse.json({ ok: true, publicUrl, storagePath, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Hero upload failed.";
    return NextResponse.json({ error: message }, { status: /required|reopen|not found/i.test(message) ? 400 : 502 });
  }
}
