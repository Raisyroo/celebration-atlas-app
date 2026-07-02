import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getAtlasConfigStatus } from "./config";

export function createAtlasServiceClient() {
  const status = getAtlasConfigStatus();
  if (!status.hasUrl || !status.hasServiceRoleKey) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type IntakeRpcResult = { operation_run_id: string; action_id?: string; candidate_id: string; status: "created" | "updated"; idempotent_replay?: boolean };

export async function callCandidateIntakeRpc(args: { actorIdentity: string; idempotencyKey: string; candidate: Record<string, unknown>; sources: Record<string, unknown>[] }) {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error("Atlas Control Plane configuration is incomplete.");
  return supabase.rpc("atlas_intake_event_candidate", {
    p_actor_type: "human",
    p_actor_identity: args.actorIdentity,
    p_idempotency_key: args.idempotencyKey,
    p_candidate: args.candidate,
    p_sources: args.sources,
  });
}
