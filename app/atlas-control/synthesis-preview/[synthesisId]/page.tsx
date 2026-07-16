import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import EventHub from '@/components/EventHub';
import { requireAtlasAdmin } from '@/lib/atlas-control/auth';
import { getEventSourceSynthesisPreview } from '@/lib/event-intake/synthesis';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Private Synthesis Preview | Celebration Atlas',
  robots: { index: false, follow: false },
};

type SynthesisPreviewPageProps = {
  params: Promise<{ synthesisId: string }>;
};

async function loadManifest(synthesisId: string) {
  try {
    return await getEventSourceSynthesisPreview(synthesisId);
  } catch {
    notFound();
  }
}

export default async function SynthesisPreviewPage({ params }: SynthesisPreviewPageProps) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) redirect('/atlas-login');

  const { synthesisId } = await params;
  const preview = await loadManifest(synthesisId);
  return (
    <EventHub
      manifest={preview.manifest}
      scoutContentReference={preview.scoutContentReference}
    />
  );
}
