import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventHub from "@/components/EventHub";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { getEventFactoryPackagePreview } from "@/lib/event-factory/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Private Event Hub Preview | Celebration Atlas",
  robots: { index: false, follow: false },
};

type EventPackagePreviewPageProps = {
  params: Promise<{ packageId: string }>;
};

async function loadManifest(packageId: string) {
  try {
    return await getEventFactoryPackagePreview(packageId);
  } catch {
    notFound();
  }
}

export default async function EventPackagePreviewPage({ params }: EventPackagePreviewPageProps) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) redirect("/atlas-login");

  const { packageId } = await params;
  const preview = await loadManifest(packageId);
  return (
    <EventHub
      manifest={preview.manifest}
      scoutContentReference={preview.scoutContentReference}
    />
  );
}
