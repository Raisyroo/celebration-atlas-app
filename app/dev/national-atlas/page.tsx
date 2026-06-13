import type { Metadata } from 'next';
import CelebrationSearchPanel from '../../../components/CelebrationSearchPanel';
import NationalAtlasShell from '../../../components/NationalAtlasShell';

export const metadata: Metadata = {
  title: 'Development Preview — National Atlas Shell',
  description:
    'Development Preview for the National Atlas shell with partial coverage; not a complete U.S. event index.',
};

export default function DevNationalAtlasPage() {
  return (
    <main aria-label="Development Preview — National Atlas">
      <p>Development Preview — partial coverage, not a complete U.S. event index.</p>
      <NationalAtlasShell />
      <CelebrationSearchPanel currentScope="national" />
    </main>
  );
}
