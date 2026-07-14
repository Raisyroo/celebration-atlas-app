import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { getReadiness } from "@/lib/atlas-control/readiness";
import ControlDesk from "./ControlDesk";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import { EVENT_PAGE_MANIFESTS } from "@/data/eventPageManifests";
import { listEventPageVersions } from "@/lib/event-pages/publishing";
import { listEventSourceBundles } from "@/lib/event-intake/sourceBundles";
import { listEventSourceSyntheses } from "@/lib/event-intake/synthesis";
import { getEventFactoryOverview } from "@/lib/event-factory/readiness";
import { listEventVisualWorkflows } from "@/lib/event-factory/visuals";
import "./control.css";

export const dynamic = "force-dynamic";

export default async function AtlasControlPage() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok && auth.status === 401) redirect("/atlas-login");
  const readiness = auth.ok ? await getReadiness() : { state: "incomplete", title: auth.status === 403 ? "Atlas Administrator Required" : "Control Plane Configuration Incomplete", detail: auth.message };
  const supabase = auth.ok ? createAtlasServiceClient() : null;
  const [runs, actions, reviewItems, eventPageVersions, sourceBundles, sourceSyntheses, factory, visualWorkflows] = supabase ? await Promise.all([
    supabase.from("atlas_operation_runs").select("id,operation_type,actor_identity,status,summary,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("atlas_operation_actions").select("id,action_type,target_entity_type,target_entity_id,lifecycle_state,reason,created_at").order("created_at", { ascending: false }).limit(12),
    supabase.from("atlas_review_items").select("id,review_type,candidate_id,event_id,priority,status,recommended_action").eq("status", "open").order("priority", { ascending: false }).order("created_at", { ascending: false }).limit(12),
    listEventPageVersions(),
    listEventSourceBundles(),
    listEventSourceSyntheses(),
    getEventFactoryOverview(),
    listEventVisualWorkflows(),
  ]) : [{ data: [] }, { data: [] }, { data: [] }, { items: [], error: null }, { items: [], error: null }, { items: [], error: null }, { generatedAt: new Date().toISOString(), state: "unavailable" as const, counts: { discoveryCandidates: 0, canonicalEvents: 0, registeredSources: 0, coveredCounties: 0, dueDiligenceReady: 0, mapReady: 0, pageReady: 0, approvalReady: 0 }, items: [], warnings: ["Sign in to view the event factory."] }, { items: [], error: null }];
  const eventPageOptions = EVENT_PAGE_MANIFESTS.map((manifest) => ({
    eventId: manifest.eventId,
    name: manifest.identity.name,
    location: manifest.identity.location,
  }));
  return <main className="control-shell"><nav className="control-nav"><Link href="/">Celebration Atlas</Link><span>/ Atlas Control Desk</span></nav><section className="control-hero"><p className="eyebrow">Protected app-to-Supabase bridge</p><h1>Atlas Control Desk</h1><p>Source-backed candidate intake, reviewed Event Hub publishing, and operating visibility for authorized Atlas administrators.</p></section>{auth.ok ? <ControlDesk initialReadiness={readiness} initialFactory={factory} initialVisualWorkflows={visualWorkflows.items} initialOps={{ runs: runs.data ?? [], actions: actions.data ?? [] }} initialReviews={reviewItems.data ?? []} initialEventPageVersions={eventPageVersions.items} initialSourceBundles={sourceBundles.items} initialSourceSyntheses={sourceSyntheses.items} eventPageOptions={eventPageOptions} /> : <section className="control-panel"><h2>{readiness.title}</h2><p>{readiness.detail}</p><Link href="/atlas-login">Sign in</Link></section>}</main>;
}
