'use client';

import { useMemo, useState } from 'react';
import AtlasMap from './AtlasMap';
import HomeDiscoverySections from './HomeDiscoverySections';
import { ATLAS_CONSTELLATIONS } from '../data/atlasConstellations';

export default function HomeAtlasExperience() {
  const [selectedConstellationId, setSelectedConstellationId] = useState<
    string | null
  >(null);

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
      <HomeDiscoverySections
        selectedConstellationId={selectedConstellationId}
        onConstellationSelect={setSelectedConstellationId}
        onConstellationClear={() => setSelectedConstellationId(null)}
      />
    </>
  );
}
