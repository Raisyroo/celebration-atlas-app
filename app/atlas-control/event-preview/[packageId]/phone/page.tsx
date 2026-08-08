import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EventHub from "@/components/EventHub";
import { requireAtlasAdmin } from "@/lib/atlas-control/auth";
import { getEventFactoryCombinedReview } from "@/lib/event-factory/packages";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Proposed Event Hub | Celebration Atlas",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ packageId: string }>;
};

export default async function ProposedEventHubPage({ params }: Props) {
  const auth = await requireAtlasAdmin();
  if (!auth.ok) redirect("/atlas-login");

  const { packageId } = await params;
  const review = await getEventFactoryCombinedReview(packageId);
  const asset = review.visualWorkflow?.asset;
  const mayPreviewAsset = Boolean(
    asset
    && review.visualWorkflow
    && ["ready_for_review", "approved"].includes(review.visualWorkflow.status),
  );
  const manifest = mayPreviewAsset && asset
    ? {
        ...review.manifest,
        hero: {
          ...review.manifest.hero,
          imageSrc: asset.publicUrl,
          imageAlt: asset.altText,
          credit: asset.credit,
        },
      }
    : review.manifest;

  return (
    <EventHub
      key={`${review.package.id}:${review.package.packageVersion}:${review.visualWorkflow?.revisionNumber ?? 0}`}
      manifest={manifest}
      scoutContentReference={review.scoutContentReference}
      artPending={!mayPreviewAsset && review.artPending}
    />
  );
}
