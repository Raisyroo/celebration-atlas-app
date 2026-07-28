import type { Metadata } from "next";
import { notFound } from "next/navigation";
import EventHub from "@/components/EventHub";
import { getPublicEventFactoryPackagePreview } from "@/lib/event-factory/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Event Hub Review | Celebration Atlas",
  robots: { index: false, follow: false },
};

type EventPackagePreviewPageProps = {
  params: Promise<{ packageId: string }>;
};

async function loadManifest(packageId: string) {
  try {
    return await getPublicEventFactoryPackagePreview(packageId);
  } catch {
    notFound();
  }
}

export default async function EventPackagePreviewPage({ params }: EventPackagePreviewPageProps) {
  const { packageId } = await params;
  const preview = await loadManifest(packageId);
  return (
    <EventHub
      key={preview.manifest.eventId}
      manifest={preview.manifest}
      scoutContentReference={preview.scoutContentReference}
      artPending={preview.artPending}
    />
  );
}
