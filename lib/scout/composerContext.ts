import type { EventPageManifest } from '../../data/eventPageManifestTypes';

export const SCOUT_COMPOSER_CONTRACT_VERSION = 1 as const;

export type ScoutContentSourceKind =
  | 'event-page-version'
  | 'event-factory-package'
  | 'source-synthesis'
  | 'transition-manifest';

export type ScoutContentReference = Readonly<{
  sourceKind: ScoutContentSourceKind;
  packageId: string;
  packageVersion: string;
}>;

export type ScoutComposerContext = Readonly<{
  contractVersion: typeof SCOUT_COMPOSER_CONTRACT_VERSION;
  eventId: string;
  packageId: string;
  packageVersion: string;
  sourceKind: ScoutContentSourceKind;
  activeSectionId: string;
}>;

export function getManifestScoutContentReference(
  manifest: EventPageManifest,
): ScoutContentReference {
  return {
    sourceKind: 'transition-manifest',
    packageId: manifest.id,
    packageVersion: manifest.publishedAt,
  };
}

export function createScoutComposerContext(args: {
  manifest: EventPageManifest;
  contentReference?: ScoutContentReference;
  activeSectionId: string;
}): ScoutComposerContext {
  const contentReference =
    args.contentReference ?? getManifestScoutContentReference(args.manifest);

  return {
    contractVersion: SCOUT_COMPOSER_CONTRACT_VERSION,
    eventId: args.manifest.eventId,
    packageId: contentReference.packageId,
    packageVersion: contentReference.packageVersion,
    sourceKind: contentReference.sourceKind,
    activeSectionId: args.activeSectionId,
  };
}
