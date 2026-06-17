import type { Metadata } from 'next';
import DevNationalAtlasScrollBoundary from './DevNationalAtlasScrollBoundary';
import DevNationalAtlasDemo from './DevNationalAtlasDemo';

export const metadata: Metadata = {
  title: 'Development Preview — National Atlas Shell',
  description:
    'Development Preview for the National Atlas shell with partial coverage; not a complete U.S. event index.',
};

export default function DevNationalAtlasPage() {
  return (
    <DevNationalAtlasScrollBoundary>
      <main aria-label="Development Preview — National Atlas">
        <DevNationalAtlasDemo />
      </main>
    </DevNationalAtlasScrollBoundary>
  );
}
