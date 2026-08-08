import { NextResponse } from "next/server";
import { CELEBRATION_ATLAS_MEDIA_BUCKET } from "@/data/eventMedia";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import {
  attachEventVisualWorkflowRevisionAsset,
  createManualEventVisualWorkflow,
  getEventVisualWorkflow,
  saveEventVisualWorkflow,
} from "@/lib/event-factory/visuals";
import {
  EVENT_HERO_UPLOAD_SPEC,
} from "@/lib/event-factory/heroUploadSpec";
import { optimizeEventHeroUpload } from "@/lib/event-factory/heroOptimization";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_CONTENT_TYPES = new Set<string>(EVENT_HERO_UPLOAD_SPEC.acceptedMimeTypes);

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
  let uploadedStoragePath: string | null = null;

  const formData = await request.formData().catch(() => null);
  const workflowId = formData?.get("workflowId");
  const sourcePackageId = formData?.get("sourcePackageId");
  const altText = formData?.get("altText");
  const file = formData?.get("hero");
  const confirmations = {
    correctEvent: formData?.get("correctEvent") === "true",
    rightsConfirmed: formData?.get("rightsConfirmed") === "true",
    noInventedMarks: formData?.get("noInventedMarks") === "true",
    fullFrameReviewed: formData?.get("fullFrameReviewed") === "true",
  };
  const hasWorkflowId = typeof workflowId === "string" && UUID.test(workflowId);
  const hasSourcePackageId = typeof sourcePackageId === "string" && UUID.test(sourcePackageId);
  if (!hasWorkflowId && !hasSourcePackageId) {
    return NextResponse.json({ error: "Choose an event or a valid visual workflow." }, { status: 400 });
  }
  if (hasWorkflowId && hasSourcePackageId) {
    return NextResponse.json({ error: "Choose either a visual workflow or a published event package." }, { status: 400 });
  }
  if (typeof altText !== "string" || !altText.trim()) {
    return NextResponse.json({ error: "Descriptive hero alt text is required." }, { status: 400 });
  }
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a hero image file." }, { status: 400 });
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) return NextResponse.json({ error: "Hero art must be JPG, PNG, or WEBP." }, { status: 400 });
  if (file.size > EVENT_HERO_UPLOAD_SPEC.maxBytes) {
    return NextResponse.json({ error: `Hero art must be ${EVENT_HERO_UPLOAD_SPEC.maxMegabytes} MB or smaller.` }, { status: 400 });
  }

  try {
    const sourceBytes = new Uint8Array(await file.arrayBuffer());
    const optimized = await optimizeEventHeroUpload(sourceBytes, file.type);
    if (!optimized.ok) {
      return NextResponse.json({ error: optimized.errors.join(" ") }, { status: 400 });
    }
    const hero = optimized.hero;

    let eventKey = "";
    let workflow = null;
    if (hasWorkflowId) {
      workflow = await getEventVisualWorkflow(workflowId);
      if (["approved", "archived"].includes(workflow.status)) {
        return NextResponse.json({ error: "Reopen this visual workflow before replacing its artwork." }, { status: 400 });
      }
      eventKey = workflow.eventKey;
    } else {
      const packageResult = await supabase
        .from("event_factory_packages")
        .select("id,event_key,status")
        .eq("id", sourcePackageId)
        .single();
      if (packageResult.error || !packageResult.data) {
        return NextResponse.json({ error: "The published event package was not found." }, { status: 400 });
      }
      if (packageResult.data.status !== "published") {
        return NextResponse.json({ error: "Finished art can be attached only to a published event package." }, { status: 400 });
      }
      eventKey = packageResult.data.event_key;
    }

    const storagePath = `events/${eventKey}/hero/${Date.now()}-${safeFilename(file.name)}.${hero.extension}`;
    const upload = await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).upload(storagePath, hero.bytes, {
      contentType: hero.contentType,
      cacheControl: hero.cacheControl,
      upsert: false,
    });
    if (upload.error) throw new Error(`Hero upload failed: ${upload.error.message}`);
    uploadedStoragePath = storagePath;

    const { data: publicUrlData } = supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).getPublicUrl(storagePath);
    const publicUrl = publicUrlData.publicUrl;
    const publicResponse = await fetch(publicUrl, { method: "HEAD", cache: "no-store" }).catch(() => null);
    if (!publicResponse?.ok || !publicResponse.headers.get("content-type")?.startsWith("image/")) {
      await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).remove([storagePath]).catch(() => undefined);
      uploadedStoragePath = null;
      throw new Error("Uploaded hero art is not publicly reachable yet.");
    }

    const asset = {
      publicUrl,
      altText: altText.trim(),
      credit: "Celebration Atlas artwork",
      sourceKind: "supabase" as const,
      storageBucket: CELEBRATION_ATLAS_MEDIA_BUCKET,
      storagePath,
      contentType: hero.contentType,
      byteSize: hero.byteSize,
      width: hero.width,
      height: hero.height,
      sourceFilename: file.name.slice(0, 255),
      sourceContentType: hero.sourceContentType,
      sourceByteSize: hero.sourceByteSize,
      optimization: {
        strategy: "webp" as const,
        quality: hero.quality,
        originalByteSize: hero.sourceByteSize,
        optimizedByteSize: hero.byteSize,
        savingsPercent: hero.savingsPercent,
      },
      uploadedBy: auth.admin.email,
      uploadedAt: new Date().toISOString(),
      provenanceCategory: "externally_supplied" as const,
    };
    const result = hasSourcePackageId
      ? await createManualEventVisualWorkflow({
          sourcePackageId: sourcePackageId as string,
          asset,
          confirmations,
          actorIdentity: auth.admin.email,
        })
      : workflow!.supersedesWorkflowId
      ? await attachEventVisualWorkflowRevisionAsset({
          workflowId: workflow!.id,
          asset,
          actorIdentity: auth.admin.email,
        })
      : await saveEventVisualWorkflow({
          candidateId: workflow!.candidateId,
          sourceBundleId: workflow!.sourceBundleId,
          targetYear: workflow!.targetYear,
          eventKey: workflow!.eventKey,
          eventName: workflow!.eventName,
          locationLabel: workflow!.locationLabel,
          lane: workflow!.lane,
          searchQuery: workflow!.searchQuery,
          reviewedThumbnailCount: workflow!.reviewedThumbnailCount,
          referenceSources: workflow!.referenceSources,
          motifs: workflow!.visualSignature.motifs,
          heroMoment: workflow!.visualSignature.heroMoment,
          asset,
          qaChecks: {
            ...workflow!.qaChecks,
            publicAssetVerified: true,
          },
          actorIdentity: auth.admin.email,
        });

    return NextResponse.json({
      ok: true,
      publicUrl,
      storagePath,
      width: hero.width,
      height: hero.height,
      contentType: hero.contentType,
      sourceByteSize: hero.sourceByteSize,
      byteSize: hero.byteSize,
      savingsPercent: hero.savingsPercent,
      result,
    });
  } catch (error) {
    if (uploadedStoragePath) {
      await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).remove([uploadedStoragePath]).catch(() => undefined);
    }
    const message = error instanceof Error ? error.message : "Hero upload failed.";
    return NextResponse.json({ error: message }, { status: /required|reopen|not found/i.test(message) ? 400 : 502 });
  }
}
