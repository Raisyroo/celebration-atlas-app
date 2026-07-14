import { NextResponse } from 'next/server';
import { requireAtlasAdmin } from '@/lib/atlas-control/auth';
import {
  generateEventSourceSynthesis,
  generateModelAssistedEditorialSynthesis,
  listEventSourceSyntheses,
  transitionEventSourceSynthesis,
} from '@/lib/event-intake/synthesis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REVIEW_ACTIONS = new Set(['submit', 'accept', 'reject']);

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  });
}

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const result = await listEventSourceSyntheses();
  if (result.error) {
    return noStoreJson(
      { error: 'Synthesis proposals are unavailable. Confirm migration 007 is applied.' },
      503,
    );
  }
  return noStoreJson({ items: result.items });
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return noStoreJson({ error: 'A JSON request body is required.' }, 400);
  }
  const payload = body as Record<string, unknown>;
  const action = text(payload.action);
  const actorIdentity = auth.admin.email;

  try {
    if (action === 'generate') {
      const bundleId = text(payload.bundleId);
      if (!UUID.test(bundleId)) return noStoreJson({ error: 'A valid source bundle id is required.' }, 400);
      const result = await generateEventSourceSynthesis({ bundleId, actorIdentity });
      return noStoreJson({ result: result.result, proposal: {
        isManifestValid: result.synthesis.isManifestValid,
        qualityScore: result.synthesis.qualityScore,
        conflictCount: result.synthesis.conflicts.length,
        missingFields: result.synthesis.missingFields,
      } });
    }

    if (action === 'editorial') {
      const synthesisId = text(payload.synthesisId);
      if (!UUID.test(synthesisId)) return noStoreJson({ error: 'A valid deterministic synthesis id is required.' }, 400);
      const result = await generateModelAssistedEditorialSynthesis({ synthesisId, actorIdentity });
      return noStoreJson({ result: result.result, proposal: result.proposal });
    }

    if (REVIEW_ACTIONS.has(action)) {
      const synthesisId = text(payload.synthesisId);
      const notes = text(payload.notes);
      if (!UUID.test(synthesisId)) return noStoreJson({ error: 'A valid synthesis proposal id is required.' }, 400);
      if (notes.length > 2_000) return noStoreJson({ error: 'Review notes must be 2,000 characters or fewer.' }, 400);
      const result = await transitionEventSourceSynthesis({
        synthesisId,
        action: action as 'submit' | 'accept' | 'reject',
        actorIdentity,
        notes,
      });
      return noStoreJson({ result });
    }

    return noStoreJson({ error: 'Unsupported synthesis action.' }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/must be ready|cannot be accepted|not found|has no archived source|Only a ready source bundle|requires an unsubmitted|no grounded improvements|not ready for editorial/i.test(message)) {
      return noStoreJson({ error: message }, 409);
    }
    if (/AI Gateway|editorial model|structured draft|structured JSON/i.test(message)) {
      return noStoreJson({ error: message }, 502);
    }
    return noStoreJson(
      { error: 'Synthesis operation failed. Confirm migration 007 and the source bundle records are available.' },
      502,
    );
  }
}
