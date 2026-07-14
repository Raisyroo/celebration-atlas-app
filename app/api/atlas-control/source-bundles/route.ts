import { NextResponse } from 'next/server';
import { requireAtlasAdmin } from '@/lib/atlas-control/auth';
import { OfficialSourceInspectionError } from '@/lib/event-intake/officialSourceInspection';
import {
  attachEventSourceBundleCandidate,
  captureEventSourceToBundle,
  collectRelatedEventSources,
  createEventSourceBundle,
  listEventSourceBundles,
  transitionEventSourceBundle,
} from '@/lib/event-intake/sourceBundles';
import type { EventSourceKind } from '@/lib/event-intake/sourceBundlePayload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENT_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SOURCE_KINDS = new Set<EventSourceKind>([
  'official_home',
  'schedule',
  'lineup',
  'tickets',
  'registration',
  'plan',
  'faq',
  'rules',
  'other',
]);

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
  const result = await listEventSourceBundles();
  if (result.error) {
    return noStoreJson(
      { error: 'Source bundles are unavailable. Confirm migration 006 is applied.' },
      503,
    );
  }
  return noStoreJson({ items: result.items });
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return noStoreJson({ error: auth.message }, auth.status);
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') return noStoreJson({ error: 'A JSON request body is required.' }, 400);
  const payload = body as Record<string, unknown>;
  const action = text(payload.action);
  const actorIdentity = auth.admin.email;

  try {
    if (action === 'create_and_capture' || action === 'create_and_collect') {
      const name = text(payload.name);
      const sourceUrl = text(payload.sourceUrl);
      const eventKey = text(payload.eventKey);
      const sourceKind = text(payload.sourceKind) as EventSourceKind;
      if (!name || name.length > 200) return noStoreJson({ error: 'Bundle name must be between 1 and 200 characters.' }, 400);
      if (!sourceUrl || sourceUrl.length > 2_048) return noStoreJson({ error: 'Enter an official public event URL.' }, 400);
      if (eventKey && !EVENT_KEY.test(eventKey)) return noStoreJson({ error: 'Event key must be lowercase kebab-case.' }, 400);
      if (sourceKind && !SOURCE_KINDS.has(sourceKind)) return noStoreJson({ error: 'Unsupported source kind.' }, 400);

      const bundle = await createEventSourceBundle({ name, eventKey: eventKey || undefined, actorIdentity });
      try {
        const snapshot = await captureEventSourceToBundle({
          bundleId: bundle.bundle_id,
          sourceUrl,
          sourceKind: sourceKind || undefined,
          actorIdentity,
        });
        const collection = action === 'create_and_collect'
          ? await collectRelatedEventSources({
              bundleId: bundle.bundle_id,
              seedInspection: snapshot.inspection,
              actorIdentity,
              maxRelatedSources: 7,
            })
          : null;
        return noStoreJson({ bundle, snapshot, collection });
      } catch (error) {
        const message = error instanceof OfficialSourceInspectionError
          ? error.message
          : 'The bundle was created, but its first source could not be captured.';
        return noStoreJson({ error: message, bundleId: bundle.bundle_id }, 502);
      }
    }

    const bundleId = text(payload.bundleId);
    if (!UUID.test(bundleId)) return noStoreJson({ error: 'A valid source bundle id is required.' }, 400);

    if (action === 'add_source') {
      const sourceUrl = text(payload.sourceUrl);
      const sourceKind = text(payload.sourceKind) as EventSourceKind;
      if (!sourceUrl || sourceUrl.length > 2_048) return noStoreJson({ error: 'Enter an official public event URL.' }, 400);
      if (sourceKind && !SOURCE_KINDS.has(sourceKind)) return noStoreJson({ error: 'Unsupported source kind.' }, 400);
      const snapshot = await captureEventSourceToBundle({
        bundleId,
        sourceUrl,
        sourceKind: sourceKind || undefined,
        actorIdentity,
      });
      return noStoreJson({ snapshot });
    }

    if (action === 'ready' || action === 'reopen' || action === 'archive') {
      const notes = text(payload.notes);
      if (notes.length > 2_000) return noStoreJson({ error: 'Notes must be 2,000 characters or fewer.' }, 400);
      const result = await transitionEventSourceBundle({ bundleId, action, actorIdentity, notes });
      return noStoreJson({ result });
    }

    if (action === 'attach_candidate') {
      const candidateId = text(payload.candidateId);
      if (!UUID.test(candidateId)) return noStoreJson({ error: 'A valid candidate id is required.' }, 400);
      const result = await attachEventSourceBundleCandidate({ bundleId, candidateId, actorIdentity });
      return noStoreJson({ result });
    }

    return noStoreJson({ error: 'Unsupported source bundle action.' }, 400);
  } catch (error) {
    if (error instanceof OfficialSourceInspectionError) {
      return noStoreJson({ error: error.message, code: error.code }, error.status);
    }
    return noStoreJson(
      { error: 'Source bundle operation failed. Confirm migration 006 and the private archive bucket are available.' },
      502,
    );
  }
}
