import 'server-only';

import type { AtlasEvent } from '@/data/events';
import { publishedDiscoveryPayloadToAtlasEvents } from '@/data/publishedAtlasDiscovery';
import {
  getStateAtlasEventCatalog,
  reconcileStateAtlasEvents,
} from '@/data/stateAtlasEvents';
import type { StateAtlasConfig } from '@/data/stateAtlasConfig';
import { createAtlasServiceClient } from '@/lib/atlas-control/service';

export async function resolvePublishedAtlasEvents(
  config: StateAtlasConfig,
): Promise<AtlasEvent[]> {
  const localEvents = getStateAtlasEventCatalog(config.identity.slug);
  const supabase = createAtlasServiceClient();
  if (!supabase) return [...localEvents];

  const result = await supabase.rpc('atlas_get_published_event_discovery', {
    p_state_values: [...config.identity.databaseStateValues],
  });
  if (result.error) return [...localEvents];

  const approvedEvents = publishedDiscoveryPayloadToAtlasEvents(
    config,
    result.data,
  );
  if (!approvedEvents?.length) return [...localEvents];

  return reconcileStateAtlasEvents(localEvents, approvedEvents);
}
