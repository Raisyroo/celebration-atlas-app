import type { AtlasEvent } from './events';

export const EVENT_CANONICAL_SLUGS = {
  'romeo-peach': 'romeo-peach-festival',
} as const satisfies Partial<Record<AtlasEvent['id'], string>>;

export function getCanonicalEventSlug(event: { id: string }): string {
  return EVENT_CANONICAL_SLUGS[event.id as keyof typeof EVENT_CANONICAL_SLUGS] ?? event.id;
}
