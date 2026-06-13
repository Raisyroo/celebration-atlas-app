'use client';

import { useCallback, useMemo, useState } from 'react';
import AtlasMap from './AtlasMap';
import HomeDiscoverySections from './HomeDiscoverySections';
import CelebrationSearchShell from './CelebrationSearchShell';
import { ATLAS_CONSTELLATIONS } from '../data/atlasConstellations';
import { ATLAS_EVENTS } from '../data/events';
import type { AtlasSearchResult } from '../data/celebrationSearchTypes';

export default function HomeAtlasExperience() {
  const [selectedConstellationId, setSelectedConstellationId] = useState<
    string | null
  >(null);
  const [celebrationSearchHighlightedIds, setCelebrationSearchHighlightedIds] =
    useState<string[]>([]);

  const handleConstellationSelect = useCallback((constellationId: string) => {
    setCelebrationSearchHighlightedIds([]);
    setSelectedConstellationId((currentConstellationId) =>
      currentConstellationId === constellationId ? null : constellationId,
    );
  }, []);

  const handleCelebrationSearchResult = useCallback(
    (result: AtlasSearchResult) => {
      const atlasEventIds = new Set(ATLAS_EVENTS.map((event) => event.id));
      const safeHighlightedIds = result.command.highlightedEventIds.filter(
        (eventId) => atlasEventIds.has(eventId),
      );

      setCelebrationSearchHighlightedIds(safeHighlightedIds);

      if (safeHighlightedIds.length > 0) {
        setSelectedConstellationId(null);
      }
    },
    [],
  );

  const handleCelebrationSearchClear = useCallback(() => {
    setCelebrationSearchHighlightedIds([]);
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
        celebrationSearchHighlightedIds={celebrationSearchHighlightedIds}
        activeConstellationTitle={selectedConstellation?.title ?? null}
        onSearchActivate={() => {
          setSelectedConstellationId(null);
          setCelebrationSearchHighlightedIds([]);
        }}
      />
      <CelebrationSearchShell
        onResult={handleCelebrationSearchResult}
        onClear={handleCelebrationSearchClear}
      />
      <HomeDiscoverySections
        selectedConstellationId={selectedConstellationId}
        onConstellationSelect={handleConstellationSelect}
        onConstellationClear={() => setSelectedConstellationId(null)}
      />
    </>
  );
}
