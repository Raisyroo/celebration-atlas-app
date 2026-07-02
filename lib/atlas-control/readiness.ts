import "server-only";
import { getAtlasConfigStatus } from "./config";
import { createAtlasServiceClient } from "./service";

export type Readiness = { state: "ready" | "missing_migration" | "incomplete"; title: string; detail: string };

export async function getReadiness(): Promise<Readiness> {
  const config = getAtlasConfigStatus();
  if (!config.isComplete) return { state: "incomplete", title: "Control Plane Configuration Incomplete", detail: "Add the Supabase URL, anon key, service-role key, and ATLAS_ADMIN_EMAILS to enable the protected bridge." };
  const supabase = createAtlasServiceClient();
  if (!supabase) return { state: "incomplete", title: "Control Plane Configuration Incomplete", detail: "Server-side Supabase configuration is unavailable." };
  const checks = await Promise.all([
    supabase.from("atlas_operation_runs").select("id", { count: "exact", head: true }),
    supabase.from("atlas_operation_actions").select("id", { count: "exact", head: true }),
    supabase.from("atlas_review_items").select("id", { count: "exact", head: true }),
  ]);
  if (checks.some((r) => r.error)) return { state: "missing_migration", title: "Control Plane Migration Not Yet Applied", detail: "The app is connected, but migration 004 Control Plane tables/RPCs are not reachable yet." };
  return { state: "ready", title: "Control Plane Ready", detail: "Protected service-role bridge can reach the Control Plane ledger and review queue." };
}
