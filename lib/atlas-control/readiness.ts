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
    supabase.from("atlas_operation_runs").select("id").limit(1),
    supabase.from("atlas_operation_actions").select("id").limit(1),
    supabase.from("atlas_review_items").select("id").limit(1),
  ]);
  if (checks.some((r) => r.error)) return { state: "missing_migration", title: "Control Plane Migration Not Yet Applied", detail: "The app is connected, but migration 004 Control Plane tables/RPCs are not reachable yet." };
  const eventPageChecks = await Promise.all([
    supabase.from("event_pages").select("id").limit(1),
    supabase.from("event_page_versions").select("id").limit(1),
    supabase.from("event_page_version_transitions").select("id").limit(1),
  ]);
  if (eventPageChecks.some((r) => r.error)) return { state: "missing_migration", title: "Event Page Publishing Migration Not Yet Applied", detail: "The Control Plane is connected, but migration 005 Event Hub versioning and publishing records are not reachable yet." };
  const sourceIntelligenceChecks = await Promise.all([
    supabase.from("event_source_bundles").select("id").limit(1),
    supabase.from("event_source_snapshots").select("id").limit(1),
    supabase.from("event_source_claims").select("id").limit(1),
    supabase.from("event_source_links").select("id").limit(1),
    supabase.storage.getBucket("event-source-archive"),
  ]);
  if (sourceIntelligenceChecks.some((r) => r.error)) return { state: "missing_migration", title: "Source Intelligence Migration Not Yet Applied", detail: "Event Hub publishing is connected, but migration 006 source bundles, provenance records, or the private source archive are not reachable yet." };
  const synthesisChecks = await Promise.all([
    supabase.from("event_source_syntheses").select("id").limit(1),
    supabase.from("event_source_synthesis_actions").select("id").limit(1),
  ]);
  if (synthesisChecks.some((r) => r.error)) return { state: "missing_migration", title: "Source Synthesis Migration Not Yet Applied", detail: "Source collection is connected, but migration 007 synthesis proposals and review audit records are not reachable yet." };
  const editorialSynthesisCheck = await supabase
    .from("event_source_syntheses")
    .select("id,parent_synthesis_id")
    .limit(1);
  if (editorialSynthesisCheck.error) return { state: "missing_migration", title: "Editorial Synthesis Migration Not Yet Applied", detail: "Deterministic synthesis is connected, but migration 012 parent-bound model editorial proposals are not reachable yet." };
  const eventFactoryChecks = await Promise.all([
    supabase.from("event_verification_cases").select("id").limit(1),
    supabase.from("event_factory_packages").select("id").limit(1),
    supabase.from("event_factory_package_actions").select("id").limit(1),
  ]);
  if (eventFactoryChecks.some((r) => r.error)) return { state: "missing_migration", title: "Event Factory Package Migration Not Yet Applied", detail: "Source synthesis is connected, but migrations 008-011 for retained verification and complete editorial packages are not reachable yet." };
  const visualWorkflowChecks = await Promise.all([
    supabase.from("event_visual_workflows").select("id").limit(1),
    supabase.from("event_visual_workflow_actions").select("id").limit(1),
    supabase.storage.getBucket("celebration-atlas-media"),
  ]);
  if (visualWorkflowChecks.some((r) => r.error)) return { state: "missing_migration", title: "Visual Workflow Migration Not Yet Applied", detail: "The Event Factory is connected, but migration 014 for evidence-backed hero briefs and cloud media approval is not reachable yet." };
  const factoryRevisionChecks = await Promise.all([
    supabase.from("event_visual_workflows").select("id,revision_number,supersedes_workflow_id").limit(1),
    supabase.from("event_factory_packages").select("id,supersedes_package_id").limit(1),
  ]);
  if (factoryRevisionChecks.some((r) => r.error)) return { state: "missing_migration", title: "Event Factory Revision Migration Not Yet Applied", detail: "The Event Factory is connected, but migration 017 for immutable same-edition visual and package corrections is not reachable yet." };
  const completionChecks = await Promise.all([
    supabase.from("atlas_review_item_actions").select("id").limit(1),
    supabase.rpc("atlas_list_michigan_completion_runs", { p_limit: 1 }),
  ]);
  if (completionChecks.some((r) => r.error)) return { state: "missing_migration", title: "Michigan Completion Migration Not Yet Applied", detail: "The existing Control Plane is connected, but migrations 023-024 for private resumable completion runs and exception audit history are not reachable yet." };
  return { state: "ready", title: "Control Plane Ready", detail: "Protected service-role bridge can reach discovery evidence, parent-bound editorial proposals, retained verification, visual-signature workflows, complete editorial packages, private Michigan completion runs, reviewed publishing, and the private source archive." };
}
