import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { getReadiness } from "@/lib/atlas-control/readiness";
import ControlDesk from "./ControlDesk";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import "./control.css";

export const dynamic = "force-dynamic";

export default async function AtlasControlPage() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok && auth.status === 401) redirect("/atlas-login");
  const readiness = auth.ok ? await getReadiness() : { state: "incomplete", title: auth.status === 403 ? "Atlas Administrator Required" : "Control Plane Configuration Incomplete", detail: auth.message };
  const supabase = auth.ok ? createAtlasServiceClient() : null;
  const [runs, actions, reviewItems] = supabase ? await Promise.all([
    supabase.from("atlas_operation_runs").select("id,operation_type,actor_identity,status,summary,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("atlas_operation_actions").select("id,action_type,target_entity_type,target_entity_id,lifecycle_state,reason,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("atlas_review_items").select("id,review_type,candidate_id,event_id,priority,status,recommended_action").eq("status", "open").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(12),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];
  return <main className="control-shell"><nav className="control-nav"><Link href="/">Celebration Atlas</Link><span>/ Atlas Control Desk</span></nav><section className="control-hero"><p className="eyebrow">Protected app-to-Supabase bridge</p><h1>Atlas Control Desk</h1><p>Source-backed candidate intake, readiness, and read-only operating visibility for authorized Atlas administrators.</p></section>{auth.ok ? <ControlDesk initialReadiness={readiness} initialOps={{ runs: runs.data ?? [], actions: actions.data ?? [] }} initialReviews={reviewItems.data ?? []} /> : <section className="control-panel"><h2>{readiness.title}</h2><p>{readiness.detail}</p><Link href="/atlas-login">Sign in</Link></section>}</main>;
}
