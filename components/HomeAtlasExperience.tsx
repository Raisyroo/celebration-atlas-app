'use client';

import { useCallback, useState } from 'react';
import AtlasMap from './AtlasMap';
import CelebrationSearchShell from './CelebrationSearchShell';
import { ATLAS_EVENTS } from '../data/events';
import type { AtlasSearchResult } from '../data/celebrationSearchTypes';

export default function HomeAtlasExperience() {
  const [celebrationSearchHighlightedIds, setCelebrationSearchHighlightedIds] =
    useState<string[]>([]);

  const handleCelebrationSearchResult = useCallback(
    (result: AtlasSearchResult) => {
      const atlasEventIds = new Set(ATLAS_EVENTS.map((event) => event.id));
      const safeHighlightedIds = result.command.highlightedEventIds.filter(
        (eventId) => atlasEventIds.has(eventId),
      );

      setCelebrationSearchHighlightedIds(safeHighlightedIds);
    },
    [],
  );

  const handleCelebrationSearchClear = useCallback(() => {
    setCelebrationSearchHighlightedIds([]);
  }, []);

  return (
    <>
      <AtlasMap
        celebrationSearchHighlightedIds={celebrationSearchHighlightedIds}
        onSearchActivate={() => {
          setCelebrationSearchHighlightedIds([]);
        }}
      />
      <CelebrationSearchShell
        onResult={handleCelebrationSearchResult}
        onClear={handleCelebrationSearchClear}
      />
      {/*
        AI-first homepage: keep the preserved HomeDiscoverySections component out
        of the visible / route so the Michigan map and Celebration Search remain
        the primary interface.
      */}
    </>
  );
}
