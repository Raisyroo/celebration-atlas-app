import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MichiganMarkerAudit from './MichiganMarkerAudit';

export const metadata: Metadata = {
  title: 'Michigan Marker Audit | Celebration Atlas Dev',
  description: 'Developer-only all-events marker and tag reconciliation audit.',
  robots: { index: false, follow: false },
};

export default function MichiganMarkerAuditPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return <MichiganMarkerAudit />;
}
