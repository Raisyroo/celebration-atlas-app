import 'server-only';
import { cache } from 'react';
import type { EventPageManifest } from '@/data/eventPageManifestTypes';
import { validateEventPageManifest } from '@/data/eventPageManifestValidation';
import { getEventPageManifest } from '@/data/eventPageManifests';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';

type PublishedEventPageRow = {
  event_key: string;
  slug: string;
  manifest: unknown;
};

async function resolveManifest(identifier: string): Promise<EventPageManifest | undefined> {
  const localFallback = getEventPageManifest(identifier);
  const supabase = createAtlasServiceClient();
  if (!supabase) return localFallback;

  const { data, error } = await supabase
    .rpc('atlas_get_published_event_page', { p_identifier: identifier })
    .maybeSingle<PublishedEventPageRow>();

  if (error || !data) return localFallback;

  const validation = validateEventPageManifest(data.manifest);
  if (!validation.ok) return localFallback;
  if (validation.value.eventId !== data.event_key || validation.value.slug !== data.slug) {
    return localFallback;
  }

  return validation.value;
}

export const resolveEventPageManifest = cache(resolveManifest);
