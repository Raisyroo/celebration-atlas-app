import { resolveEventFlyerMediaServer } from '@/data/eventMediaServer';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '@/data/stateAtlasConfig';
import { resolvePublishedAtlasEvents } from '@/lib/events/publishedAtlasEvents';

const EVENT_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(
  _request: Request,
  context: RouteContext<'/api/events/[id]/homepage-media'>,
) {
  const { id } = await context.params;
  if (!EVENT_ID_PATTERN.test(id)) {
    return Response.json(
      { error: 'Invalid event identifier.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const events = await resolvePublishedAtlasEvents(MICHIGAN_STATE_ATLAS_CONFIG);
  const event = events.find((candidate) => candidate.id === id);
  if (!event) {
    return Response.json(
      { error: 'Published event was not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const resolution = await resolveEventFlyerMediaServer(event);
  return Response.json(
    { resolution: resolution ?? null },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800',
      },
    },
  );
}
