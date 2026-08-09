import 'server-only';

import { getEventPageManifest } from '@/data/eventPageManifests';
import { validateEventPageManifest } from '@/data/eventPageManifestValidation';
import type { AtlasEvent } from '@/data/events';
import type { StateAtlasConfig } from '@/data/stateAtlasConfig';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';
import { resolvePublishedAtlasEvents } from '@/lib/events/publishedAtlasEvents';

const PACKAGE_QUERY_CHUNK_SIZE = 180;

type PublishedPackageKnowledgeRow = {
  id: string;
  event_key: string;
  slug: string;
  status: string;
  package_version: number;
  page_manifest: unknown;
};

export type PublishedAtlasSearchCorpus = {
  events: AtlasEvent[];
  supplementalKnowledgeByEventId: ReadonlyMap<string, unknown>;
};

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function localPublishedKnowledge(events: readonly AtlasEvent[]): Map<string, unknown> {
  const knowledge = new Map<string, unknown>();
  for (const event of events) {
    const manifest = getEventPageManifest(event.id);
    if (manifest) knowledge.set(event.id, manifest);
  }
  return knowledge;
}

/**
 * Resolves the authoritative public candidate universe first, then attaches
 * only the exact Event Factory package that the publication-gated discovery
 * RPC identified for each event. Draft, approved-only, preview, and test
 * packages can never enter the public ASK corpus through this path.
 */
export async function resolvePublishedAtlasSearchCorpus(
  config: StateAtlasConfig,
): Promise<PublishedAtlasSearchCorpus> {
  const events = await resolvePublishedAtlasEvents(config);
  const supplementalKnowledgeByEventId = localPublishedKnowledge(events);
  const supabase = createAtlasServiceClient();
  if (!supabase) return { events, supplementalKnowledgeByEventId };

  const eventByPackageId = new Map<string, AtlasEvent>();
  for (const event of events) {
    const packageId = event.publishedDiscovery?.packageId;
    if (packageId) eventByPackageId.set(packageId, event);
  }
  const packageIds = [...eventByPackageId.keys()];
  if (packageIds.length === 0) return { events, supplementalKnowledgeByEventId };

  const rowGroups = await Promise.all(
    chunks(packageIds, PACKAGE_QUERY_CHUNK_SIZE).map(async (packageIdChunk) => {
      const result = await supabase
        .from('event_factory_packages')
        .select('id,event_key,slug,status,package_version,page_manifest')
        .in('id', packageIdChunk)
        .eq('status', 'published');
      return result.error
        ? []
        : (result.data ?? []) as PublishedPackageKnowledgeRow[];
    }),
  );

  for (const row of rowGroups.flat()) {
    const event = eventByPackageId.get(row.id);
    const publication = event?.publishedDiscovery;
    if (
      !event
      || !publication
      || row.status !== 'published'
      || row.package_version !== publication.packageVersion
      || row.event_key !== event.id
      || row.slug !== event.id
    ) {
      continue;
    }

    const validation = validateEventPageManifest(row.page_manifest);
    if (
      !validation.ok
      || validation.value.eventId !== event.id
      || validation.value.slug !== event.id
    ) {
      continue;
    }
    supplementalKnowledgeByEventId.set(event.id, validation.value);
  }

  return { events, supplementalKnowledgeByEventId };
}
