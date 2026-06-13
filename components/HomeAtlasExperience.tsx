'use client';

import { useCallback, useMemo, useState } from 'react';
import AtlasMap from './AtlasMap';
import HomeDiscoverySections from './HomeDiscoverySections';
import CelebrationSearchShell from './CelebrationSearchShell';
import { ATLAS_CONSTELLATIONS } from '../data/atlasConstellations';

export default function HomeAtlasExperience() {
  const [selectedConstellationId, setSelectedConstellationId] = useState<
    string | null
  >(null);

  const handleConstellationSelect = useCallback((constellationId: string) => {
    setSelectedConstellationId((currentConstellationId) =>
      currentConstellationId === constellationId ? null : constellationId,
    );
  }, []);

  const selectedConstellation = useMemo(
    () =>
      ATLAS_CONSTELLATIONS.find(
        (constellation) => constellation.id === selectedConstellationId,
      ) ?? null,
    [selectedConstellationId],
  );

  return (
    <>
      <AtlasMap
        constellationHighlightedIds={selectedConstellation?.eventIds ?? []}
        activeConstellationTitle={selectedConstellation?.title ?? null}
        onSearchActivate={() => setSelectedConstellationId(null)}
      />
      <CelebrationSearchShell />
      <HomeDiscoverySections
        selectedConstellationId={selectedConstellationId}
        onConstellationSelect={handleConstellationSelect}
        onConstellationClear={() => setSelectedConstellationId(null)}
      />
    </>
  );
}
