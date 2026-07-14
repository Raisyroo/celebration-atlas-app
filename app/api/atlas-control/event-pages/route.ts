import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { EVENT_PAGE_MANIFESTS } from '@/data/eventPageManifests';
import { requireAtlasAdmin } from '@/lib/atlas-control/auth';
import {
  createEventPageDraft,
  listEventPageVersions,
  publishEventPageVersion,
  reviewEventPageVersion,
  submitEventPageVersion,
} from '@/lib/event-pages/publishing';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export async function GET() {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const result = await listEventPageVersions();
  if (result.error) {
    return NextResponse.json(
      { error: 'Event page publishing is unavailable. Confirm migration 005 is applied.' },
      { status: 503 },
    );
  }
  return NextResponse.json({ items: result.items });
}

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A JSON request body is required.' }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  const action = text(payload.action);
  const actorIdentity = auth.admin.email;

  try {
    if (action === 'create_draft') {
      const eventId = text(payload.eventId);
      const changeSummary = text(payload.changeSummary);
      if (!EVENT_PAGE_MANIFESTS.some((manifest) => manifest.eventId === eventId)) {
        return NextResponse.json({ error: 'Choose an event with a local Event Hub manifest.' }, { status: 400 });
      }
      if (changeSummary.length > 500) {
        return NextResponse.json({ error: 'Change summary must be 500 characters or fewer.' }, { status: 400 });
      }
      const result = await createEventPageDraft({ eventId, actorIdentity, changeSummary });
      return NextResponse.json({ result });
    }

    const versionId = text(payload.versionId);
    if (!UUID.test(versionId)) {
      return NextResponse.json({ error: 'A valid event page version id is required.' }, { status: 400 });
    }

    if (action === 'submit') {
      return NextResponse.json({ result: await submitEventPageVersion(versionId, actorIdentity) });
    }

    if (action === 'approve' || action === 'reject') {
      const notes = text(payload.notes);
      if (notes.length > 2_000) {
        return NextResponse.json({ error: 'Review notes must be 2,000 characters or fewer.' }, { status: 400 });
      }
      const result = await reviewEventPageVersion({
        versionId,
        actorIdentity,
        decision: action,
        notes,
      });
      return NextResponse.json({ result });
    }

    if (action === 'publish') {
      const result = await publishEventPageVersion(versionId, actorIdentity);
      revalidatePath(`/events/${result.slug}`);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: 'Unsupported event page action.' }, { status: 400 });
  } catch {
    return NextResponse.json(
      { error: 'Event page operation failed. Confirm migration 005 is applied and the version is in the required state.' },
      { status: 502 },
    );
  }
}
