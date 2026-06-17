'use client';

import { useState } from 'react';
import CelebrationSearchPanel from '../../../components/CelebrationSearchPanel';
import NationalAtlasShell from '../../../components/NationalAtlasShell';
import type { AtlasSearchResult } from '../../../data/celebrationSearchTypes';

export default function DevNationalAtlasDemo() {
  const [highlightedStateSlug, setHighlightedStateSlug] = useState<string | undefined>();

  function handleSearchResult(result: AtlasSearchResult) {
    setHighlightedStateSlug(
      result.command.stateSlug === 'michigan' || result.visibleStateSlugs.includes('michigan')
        ? 'michigan'
        : undefined,
    );
  }

  return (
    <NationalAtlasShell highlightedStateSlug={highlightedStateSlug}>
      <CelebrationSearchPanel currentScope="national" onResult={handleSearchResult} />
    </NationalAtlasShell>
  );
}
