import { NextResponse } from "next/server";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { validateCandidateIntake, toRpcPayload } from "@/lib/atlas-control/candidateIntake";
import { callCandidateIntakeRpc } from "@/lib/atlas-control/service";

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const parsed = validateCandidateIntake(await request.json().catch(() => null));
  if (!parsed.ok) return NextResponse.json({ errors: parsed.errors }, { status: 400 });
  const { candidate, sources } = toRpcPayload(parsed.value);
  const { data, error } = await callCandidateIntakeRpc({ actorIdentity: auth.admin.email, idempotencyKey: parsed.value.idempotencyKey, candidate, sources });
  if (error) return NextResponse.json({ error: "Candidate intake could not be completed. Confirm Control Plane migration 004 is applied and the source-backed payload is valid." }, { status: 502 });
  return NextResponse.json({ result: data });
}
