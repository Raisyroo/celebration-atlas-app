import { NextRequest, NextResponse } from "next/server";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(request: NextRequest) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.message },
      { status: auth.status, headers: PRIVATE_HEADERS },
    );
  }
  const supabase = createAtlasServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Atlas Control Plane configuration is incomplete." },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
  const runId = request.nextUrl.searchParams.get("runId")?.trim();
  if (runId && !UUID_PATTERN.test(runId)) {
    return NextResponse.json(
      { error: "runId must be a UUID." },
      { status: 400, headers: PRIVATE_HEADERS },
    );
  }
  const result = runId
    ? await supabase.rpc("atlas_get_michigan_completion_run", {
        p_run_id: runId,
      })
    : await supabase.rpc("atlas_list_michigan_completion_runs", {
        p_limit: 50,
      });
  if (result.error) {
    return NextResponse.json(
      {
        error:
          "Michigan completion status is unavailable until migrations 023-024 are applied.",
      },
      { status: 503, headers: PRIVATE_HEADERS },
    );
  }
  return NextResponse.json(
    runId ? { run: result.data } : { runs: result.data ?? [] },
    { headers: PRIVATE_HEADERS },
  );
}
