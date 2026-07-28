import { NextResponse } from "next/server";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const supabase = createAtlasServiceClient();
  if (!supabase) return NextResponse.json({ runs: [], actions: [] });
  const [runs, actions, completionRuns] = await Promise.all([
    supabase.from("atlas_operation_runs").select("id,operation_type,actor_type,actor_identity,status,summary,error,created_at,completed_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("atlas_operation_actions").select("id,operation_run_id,action_type,target_entity_type,target_entity_id,lifecycle_state,reason,warnings,created_at,applied_at").order("created_at", { ascending: false }).limit(12),
    supabase.rpc("atlas_list_michigan_completion_runs", { p_limit: 12 }),
  ]);
  if (runs.error || actions.error) return NextResponse.json({ error: "Control Plane operations are not available yet." }, { status: 503 });
  return NextResponse.json(
    {
      runs: runs.data ?? [],
      actions: actions.data ?? [],
      completionRuns: completionRuns.error ? [] : completionRuns.data ?? [],
      completionAvailable: !completionRuns.error,
    },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
      },
    },
  );
}
