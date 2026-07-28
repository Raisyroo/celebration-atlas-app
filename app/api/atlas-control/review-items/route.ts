import { NextResponse } from "next/server";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const supabase = createAtlasServiceClient();
  if (!supabase) return NextResponse.json({ items: [] });
  const { data, error } = await supabase.from("atlas_review_items").select("id,operation_run_id,review_type,candidate_id,event_id,priority,status,recommended_action,evidence,created_at").eq("status", "open").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(12);
  if (error) return NextResponse.json({ error: "Control Plane review items are not available yet." }, { status: 503 });
  return NextResponse.json(
    { items: data ?? [] },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
