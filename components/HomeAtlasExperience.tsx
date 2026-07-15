'use client';

import AtlasMap from './AtlasMap';
import type { AtlasEvent } from '../data/events';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes';
import type { StateAtlasConfig } from '../data/stateAtlasConfig';

export type HomeAtlasExperienceProps = {
  stateConfig: StateAtlasConfig;
  events: readonly AtlasEvent[];
  flyerResolutions?: EventFlyerResolutionMap;
};

export default function HomeAtlasExperience({
  stateConfig,
  events,
  flyerResolutions = {},
}: HomeAtlasExperienceProps) {
  return (
    <>
      <AtlasMap
        stateConfig={stateConfig}
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
