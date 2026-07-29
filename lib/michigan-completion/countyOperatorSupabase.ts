import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCountySeedPreflightSnapshot } from "../county-seeds/stagingPreflight.ts";
import type {
  CountyOperatorBundleRow,
  CountyOperatorPackageRow,
  CountyOperatorSnapshot,
  CountyOperatorSynthesisRow,
  CountyOperatorVerificationRow,
  CountyOperatorVisualRow,
} from "./countyOperator.ts";
import type { CompletionStore } from "./types.ts";

type CountyOperatorSupabaseClient = Pick<SupabaseClient, "from" | "rpc">;

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

export async function loadSupabaseCountyOperatorSnapshot(args: {
  client: CountyOperatorSupabaseClient;
  store: CompletionStore;
  countyCode: string;
  capturedAt?: string;
}): Promise<CountyOperatorSnapshot> {
  const capturedAt = args.capturedAt ?? new Date().toISOString();
  const [
    preflight,
    bundleResult,
    synthesisResult,
    verificationResult,
    packageResult,
    visualResult,
    runListResult,
  ] = await Promise.all([
    loadCountySeedPreflightSnapshot(capturedAt),
    args.client
      .from("event_source_bundles")
      .select(
        "id,status,candidate_id,canonical_event_id,event_key,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(5_000),
    args.client
      .from("event_source_syntheses")
      .select("id,status,bundle_id,created_at")
      .order("created_at", { ascending: false })
      .limit(5_000),
    args.client
      .from("event_verification_cases")
      .select("id,status,candidate_id,event_id,target_year,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5_000),
    args.client
      .from("event_factory_packages")
      .select(
        "id,status,candidate_id,event_id,verification_case_id,source_bundle_id,synthesis_id,readiness_checks,art_asset,published_at,updated_at",
      )
      .order("updated_at", { ascending: false })
      .limit(5_000),
    args.client
      .from("event_visual_workflows")
      .select("id,status,candidate_id,event_key,asset,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5_000),
    args.client.rpc("atlas_list_michigan_completion_runs", {
      p_limit: 200,
    }),
  ]);
  const errors = [
    bundleResult.error,
    synthesisResult.error,
    verificationResult.error,
    packageResult.error,
    visualResult.error,
    runListResult.error,
  ].filter(Boolean);
  if (errors.length) {
    throw new Error(
      `County operator read snapshot failed: ${errors
        .map((error) => error?.message)
        .join("; ")}`,
    );
  }
  const listedRuns = rows<{ runId?: unknown; countyIdentity?: unknown }>(
    runListResult.data,
  );
  if (listedRuns.length === 200) {
    throw new Error(
      "County run discovery reached the bounded 200-run projection; reconcile or add a reviewed county-scoped projection before execution.",
    );
  }
  const runIds = listedRuns
    .filter(
      (run) =>
        run.countyIdentity === args.countyCode &&
        typeof run.runId === "string",
    )
    .map((run) => run.runId as string);
  const completionRuns = await Promise.all(
    runIds.map((runId) => args.store.getRun(runId)),
  );
  return {
    preflight,
    sourceBundles: rows<CountyOperatorBundleRow>(bundleResult.data),
    syntheses: rows<CountyOperatorSynthesisRow>(synthesisResult.data),
    verificationCases: rows<CountyOperatorVerificationRow>(
      verificationResult.data,
    ),
    packages: rows<CountyOperatorPackageRow>(packageResult.data),
    visualWorkflows: rows<CountyOperatorVisualRow>(visualResult.data),
    completionRuns,
  };
}
