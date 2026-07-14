import { NextResponse } from 'next/server';
import { requireAtlasAdmin } from '@/lib/atlas-control/auth';
import {
  inspectOfficialEventSource,
  OfficialSourceInspectionError,
} from '@/lib/event-intake/officialSourceInspection';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 20;

export async function POST(request: Request) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const body = await request.json().catch(() => null);
  const sourceUrl = body && typeof body === 'object' && typeof (body as Record<string, unknown>).sourceUrl === 'string'
    ? ((body as Record<string, unknown>).sourceUrl as string).trim()
    : '';
  if (!sourceUrl || sourceUrl.length > 2_048) {
    return NextResponse.json({ error: 'Enter an official public event URL.' }, { status: 400 });
  }

  try {
    const inspection = await inspectOfficialEventSource(sourceUrl);
    return NextResponse.json(
      { inspection },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  } catch (error) {
    if (error instanceof OfficialSourceInspectionError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
      );
    }
    return NextResponse.json(
      { error: 'The official source could not be inspected.' },
      { status: 502, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }
}
