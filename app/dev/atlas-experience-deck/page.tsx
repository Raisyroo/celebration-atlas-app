import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AtlasExperienceDeckPrototype from './AtlasExperienceDeckPrototype';

export const metadata: Metadata = {
  title: 'Atlas Experience Deck | Celebration Atlas Dev',
  description:
    'Development-only isolated prototype for the reusable Atlas Experience Deck.',
  robots: { index: false, follow: false },
};

export default function AtlasExperienceDeckPrototypePage() {
  if (process.env.NODE_ENV === 'production') notFound();

  return <AtlasExperienceDeckPrototype />;
}
