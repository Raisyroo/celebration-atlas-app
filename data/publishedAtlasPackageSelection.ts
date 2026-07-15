export type VersionedPublishedAtlasPackage = {
  id: string;
  event_id: string;
  target_year: number;
  published_at: string | null;
};

export function comparePublishedAtlasPackageRecency(
  left: VersionedPublishedAtlasPackage,
  right: VersionedPublishedAtlasPackage,
): number {
  if (left.target_year !== right.target_year) {
    return right.target_year - left.target_year;
  }

  const publishedAtComparison = (right.published_at ?? '').localeCompare(
    left.published_at ?? '',
  );
  if (publishedAtComparison !== 0) return publishedAtComparison;

  return right.id.localeCompare(left.id);
}

export function groupPublishedAtlasPackagesByEvent<
  T extends VersionedPublishedAtlasPackage,
>(packages: readonly T[]): Map<string, T[]> {
  const packagesByEvent = new Map<string, T[]>();

  for (const eventPackage of packages) {
    const eventPackages = packagesByEvent.get(eventPackage.event_id) ?? [];
    eventPackages.push(eventPackage);
    packagesByEvent.set(eventPackage.event_id, eventPackages);
  }

  for (const eventPackages of packagesByEvent.values()) {
    eventPackages.sort(comparePublishedAtlasPackageRecency);
  }

  return packagesByEvent;
}
