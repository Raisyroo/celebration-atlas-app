import { BROWN_TROUT_EVENT_PAGE_MANIFEST } from './brownTroutEventPageManifest.ts';
import { DETROIT_JAZZ_EVENT_PAGE_MANIFEST } from './detroitJazzEventPageManifest.ts';
import type { EventPageManifest } from './eventPageManifestTypes';

export const EVENT_PAGE_MANIFESTS: EventPageManifest[] = [
  BROWN_TROUT_EVENT_PAGE_MANIFEST,
  DETROIT_JAZZ_EVENT_PAGE_MANIFEST,
];

export function getEventPageManifest(identifier: string): EventPageManifest | undefined {
  return EVENT_PAGE_MANIFESTS.find(
    (manifest) => manifest.eventId === identifier || manifest.slug === identifier,
  );
}

export function hasEventPageManifest(identifier: string): boolean {
  return Boolean(getEventPageManifest(identifier));
}
