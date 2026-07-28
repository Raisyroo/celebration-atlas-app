import { notFound } from 'next/navigation';
import EventHub from '@/components/EventHub';
import { getEventFactoryPackagePreview } from '@/lib/event-factory/packages';

export const dynamic = 'force-dynamic';

type DevelopmentPackagePreviewProps = {
  params: Promise<{ packageId: string }>;
};

async function loadManifest(packageId: string) {
  try {
    return await getEventFactoryPackagePreview(packageId);
  } catch {
    notFound();
  }
}

export default async function DevelopmentPackagePreview({ params }: DevelopmentPackagePreviewProps) {
  if (process.env.NODE_ENV !== 'development') notFound();
  const { packageId } = await params;
  const preview = await loadManifest(packageId);
  return (
    <EventHub
      key={preview.manifest.eventId}
      manifest={preview.manifest}
      scoutContentReference={preview.scoutContentReference}
      homeLink={{ href: '/atlas-control', label: 'Atlas Control' }}
      artPending={preview.artPending}
    />
  );
}
