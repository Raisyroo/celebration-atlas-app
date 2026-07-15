'use client';

import AtlasMap from './AtlasMap';
import type { AtlasEvent } from '../data/events';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes';
import type { HomeAtlasSearchRules } from '../data/homeAtlasSearch';
import type { StateAtlasConfig } from '../data/stateAtlasConfig';

export type HomeAtlasExperienceProps = {
  stateConfig: StateAtlasConfig;
  searchRules: HomeAtlasSearchRules;
  events: readonly AtlasEvent[];
  flyerResolutions?: EventFlyerResolutionMap;
};

export default function HomeAtlasExperience({
  stateConfig,
  searchRules,
  events,
  flyerResolutions = {},
}: HomeAtlasExperienceProps) {
  return (
    <>
      <AtlasMap
        stateConfig={stateConfig}
        searchRules={searchRules}
        events={events}
        flyerResolutions={flyerResolutions}
        enableAtlasDebug
      />
      {/*
        The below-map Celebration Search shell is preserved as a component for
        development routes and future use, but the visible Michigan homepage now
        keeps search inside the AtlasMap command dock.
      */}
    </>
  );
}
