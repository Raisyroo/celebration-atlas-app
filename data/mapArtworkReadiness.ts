export type MapArtworkImageSnapshot = {
  source: string | null;
  complete: boolean;
  naturalWidth: number;
};

export function resolveLoadedMapArtworkSource(
  activeSource: string,
  image: MapArtworkImageSnapshot | null | undefined,
): string | null {
  if (
    !image ||
    image.source !== activeSource ||
    !image.complete ||
    image.naturalWidth <= 0
  ) {
    return null;
  }

  return activeSource;
}

export function isMapArtworkSourceReady({
  activeSource,
  loadedSource,
  isCelestialFallback,
}: {
  activeSource: string;
  loadedSource: string | null;
  isCelestialFallback: boolean;
}): boolean {
  return isCelestialFallback || loadedSource === activeSource;
}
