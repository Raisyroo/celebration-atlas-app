import 'server-only';
import { cache } from 'react';
import type { EventPageManifest } from '@/data/eventPageManifestTypes';
import { validateEventPageManifest } from '@/data/eventPageManifestValidation';
import { getEventPageManifest } from '@/data/eventPageManifests';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';
import {
  getManifestScoutContentReference,
  type ScoutContentReference,
} from '@/lib/scout/composerContext';

type PublishedEventPageRow = {
  event_key: string;
  slug: string;
  version_id: string;
  version_number: number;
  manifest: unknown;
};

export type ResolvedEventPage = {
  manifest: EventPageManifest;
  scoutContentReference: ScoutContentReference;
};

function getLocalEventPage(identifier: string): ResolvedEventPage | undefined {
  const localFallback = getEventPageManifest(identifier);
  if (!localFallback) return undefined;
  return {
    manifest: localFallback,
    scoutContentReference: getManifestScoutContentReference(localFallback),
  };
}

async function resolveEventPageResult(identifier: string): Promise<ResolvedEventPage | undefined> {
  const localFallback = getLocalEventPage(identifier);
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

  return {
    manifest: validation.value,
    scoutContentReference: {
      sourceKind: 'event-page-version',
      packageId: data.version_id,
      packageVersion: String(data.version_number),
    },
  };
}

export const resolveEventPage = cache(resolveEventPageResult);

export async function resolveEventPageManifest(
  identifier: string,
): Promise<EventPageManifest | undefined> {
  return (await resolveEventPage(identifier))?.manifest;
}
