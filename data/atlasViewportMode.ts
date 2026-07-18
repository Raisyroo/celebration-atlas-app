export const ATLAS_DESKTOP_MIN_WIDTH = 1024;
export const ATLAS_DESKTOP_MIN_HEIGHT = 600;

export type AtlasViewportMode =
  | 'portrait'
  | 'compact-landscape'
  | 'desktop';

export type AtlasViewportDimensions = Readonly<{
  width: number;
  height: number;
}>;

export type AtlasViewportOrientation = 'portrait' | 'landscape';

export type AtlasArtworkVariant = 'mobile' | 'desktop';

export type AtlasViewportCapabilities = Readonly<{
  mode: AtlasViewportMode;
  artworkVariant: AtlasArtworkVariant;
  showsMobileChrome: boolean;
  usesCompactPanel: boolean;
  usesDesktopPanel: boolean;
  supportsRemoteCalloutConnectors: boolean;
}>;

const PORTRAIT_CAPABILITIES: AtlasViewportCapabilities = Object.freeze({
  mode: 'portrait',
  artworkVariant: 'mobile',
  showsMobileChrome: true,
  usesCompactPanel: false,
  usesDesktopPanel: false,
  supportsRemoteCalloutConnectors: true,
});

const COMPACT_LANDSCAPE_CAPABILITIES: AtlasViewportCapabilities = Object.freeze({
  mode: 'compact-landscape',
  artworkVariant: 'desktop',
  showsMobileChrome: true,
  usesCompactPanel: true,
  usesDesktopPanel: false,
  supportsRemoteCalloutConnectors: true,
});

const DESKTOP_CAPABILITIES: AtlasViewportCapabilities = Object.freeze({
  mode: 'desktop',
  artworkVariant: 'desktop',
  showsMobileChrome: false,
  usesCompactPanel: false,
  usesDesktopPanel: true,
  supportsRemoteCalloutConnectors: false,
});

export const ATLAS_VIEWPORT_CAPABILITIES: Readonly<
  Record<AtlasViewportMode, AtlasViewportCapabilities>
> = Object.freeze({
  portrait: PORTRAIT_CAPABILITIES,
  'compact-landscape': COMPACT_LANDSCAPE_CAPABILITIES,
  desktop: DESKTOP_CAPABILITIES,
});

const hasUsableDimensions = ({ width, height }: AtlasViewportDimensions) =>
  Number.isFinite(width) &&
  Number.isFinite(height) &&
  width > 0 &&
  height > 0;

/**
 * Resolves the shared Atlas shell mode from layout-viewport dimensions.
 *
 * Invalid dimensions fail closed to the portrait shell. A supplied layout
 * orientation takes precedence over the dimensions so a soft keyboard cannot
 * turn a physically portrait phone into the compact-landscape shell. Without an
 * explicit orientation, dimensions retain the deterministic server/test fallback.
 */
export function resolveAtlasViewportMode(
  dimensions: AtlasViewportDimensions,
  orientation?: AtlasViewportOrientation,
): AtlasViewportMode {
  if (!hasUsableDimensions(dimensions)) return 'portrait';

  const { width, height } = dimensions;
  const resolvedOrientation =
    orientation ?? (width <= height ? 'portrait' : 'landscape');
  if (resolvedOrientation === 'portrait') return 'portrait';
  if (
    width >= ATLAS_DESKTOP_MIN_WIDTH &&
    height >= ATLAS_DESKTOP_MIN_HEIGHT
  ) {
    return 'desktop';
  }

  return 'compact-landscape';
}

export function getAtlasViewportCapabilities(
  mode: AtlasViewportMode,
): AtlasViewportCapabilities {
  return ATLAS_VIEWPORT_CAPABILITIES[mode];
}

export function resolveAtlasViewportCapabilities(
  dimensions: AtlasViewportDimensions,
  orientation?: AtlasViewportOrientation,
): AtlasViewportCapabilities {
  return getAtlasViewportCapabilities(
    resolveAtlasViewportMode(dimensions, orientation),
  );
}
