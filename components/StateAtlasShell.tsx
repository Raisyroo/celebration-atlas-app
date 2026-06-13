import type { ReactNode } from 'react';

interface StateAtlasShellProps {
  stateSlug: string;
  stateName?: string;
  children: ReactNode;
}

// Future reusable state atlas boundary.
//
// State atlases are intended to become the main operational discovery layer for
// Celebration Atlas: maps, regions, categories, seasons, trails, and practical
// event planning all live inside a state experience.
//
// Michigan is the first canonical state implementation. This shell should wrap
// Michigan and later state experiences without changing their map internals,
// projection, clustering, marker behavior, cards, panels, or constellations
// first.

export default function StateAtlasShell({
  stateSlug,
  stateName,
  children,
}: StateAtlasShellProps) {
  return (
    <section aria-label={stateName ? `${stateName} Celebration Atlas` : 'State Celebration Atlas'} data-state-slug={stateSlug}>
      {children}
    </section>
  );
}

export { StateAtlasShell };
export type { StateAtlasShellProps };
