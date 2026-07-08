import { NextResponse } from "next/server";
import { CELEBRATION_ATLAS_MEDIA_BUCKET } from "@/data/eventMedia";
import { ATLAS_EVENTS } from "@/data/events";
import { getCanonicalEventSlug } from "@/data/eventCanonicalSlugs";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";

const MAX_FLYER_BYTES = 12 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extensionFor(file: File): string {
  const fromType = file.type === "image/jpeg" ? "jpg" : file.type.replace("image/", "");
  const fromName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return fromName || fromType || "jpg";
}

function safeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "flyer";
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const supabase = createAtlasServiceClient();
  if (!supabase) return NextResponse.json({ error: "Atlas Supabase service configuration is incomplete." }, { status: 503 });

  const formData = await request.formData().catch(() => null);
  const eventId = formData?.get("eventId");
  const file = formData?.get("flyer");

  if (typeof eventId !== "string") return NextResponse.json({ error: "Choose an event for this flyer." }, { status: 400 });
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a flyer image file." }, { status: 400 });
  if (!ALLOWED_CONTENT_TYPES.has(file.type)) return NextResponse.json({ error: "Flyer must be JPG, PNG, WEBP, or GIF." }, { status: 400 });
  if (file.size > MAX_FLYER_BYTES) return NextResponse.json({ error: "Flyer must be 12 MB or smaller." }, { status: 400 });

  const event = ATLAS_EVENTS.find((candidate) => candidate.id === eventId);
  if (!event) return NextResponse.json({ error: "That event is not in the Atlas catalog." }, { status: 400 });

  const canonicalSlug = getCanonicalEventSlug(event);
  const { data: eventRow, error: eventError } = await supabase
    .from("events")
    .select("id,slug")
    .eq("slug", canonicalSlug)
    .maybeSingle();

  if (eventError || !eventRow?.id) {
    return NextResponse.json({ error: `Supabase event row not found for ${canonicalSlug}.` }, { status: 404 });
  }

  const storagePath = `events/${canonicalSlug}/flyer/${Date.now()}-${safeFilename(file.name)}.${extensionFor(file)}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const upload = await supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).upload(storagePath, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (upload.error) {
    return NextResponse.json({ error: `Flyer upload failed: ${upload.error.message}` }, { status: 502 });
  }

  const { data: publicUrlData } = supabase.storage.from(CELEBRATION_ATLAS_MEDIA_BUCKET).getPublicUrl(storagePath);
  const publicUrl = publicUrlData.publicUrl;

  await supabase
    .from("event_media")
    .update({ status: "archived" })
    .eq("event_id", eventRow.id)
    .eq("media_role", "flyer")
    .eq("source", "supabase")
    .eq("status", "approved");

  const insert = await supabase.from("event_media").insert({
    event_id: eventRow.id,
    media_role: "flyer",
    source: "supabase",
    status: "approved",
    storage_bucket: CELEBRATION_ATLAS_MEDIA_BUCKET,
    storage_path: storagePath,
    public_url: publicUrl,
    title: `${event.name} flyer`,
    alt_text: `${event.name} flyer`,
    updated_at: new Date().toISOString(),
  }).select("id,public_url,storage_path").single();

  if (insert.error) {
    return NextResponse.json({ error: `Flyer uploaded, but media approval row failed: ${insert.error.message}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    canonicalSlug,
    flyerUrl: publicUrl,
    storagePath,
    mediaId: insert.data.id,
  });
}
