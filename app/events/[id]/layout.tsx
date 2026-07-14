import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ATLAS_EVENTS } from '../../../data/events';
import { resolveEventPageManifest } from '../../../lib/event-pages/publishedManifest';

type EventLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: EventLayoutProps): Promise<Metadata> {
  const { id } = await params;
  const manifest = await resolveEventPageManifest(id);

  if (manifest) {
    return {
      title: `${manifest.identity.name} | Celebration Atlas`,
      description: manifest.hero.tagline,
      alternates: {
        canonical: `/events/${manifest.slug}`,
      },
      openGraph: {
        title: manifest.identity.name,
        description: manifest.hero.tagline,
        type: 'website',
      },
    };
  }

  const event = ATLAS_EVENTS.find((candidate) => candidate.id === id);
  if (!event) return {};

  return {
    title: `${event.name} | Celebration Atlas`,
    description: event.blurb,
    alternates: {
      canonical: `/events/${event.id}`,
    },
  };
}

export default function EventLayout({ children }: EventLayoutProps) {
  return children;
}
