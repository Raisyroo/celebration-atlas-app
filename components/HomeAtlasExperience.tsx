'use client';

import AtlasMap from './AtlasMap';
import type { AtlasEvent } from '../data/events';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes';

type HomeAtlasExperienceProps = {
  events?: readonly AtlasEvent[];
  flyerResolutions?: EventFlyerResolutionMap;
};

export default function HomeAtlasExperience({ events, flyerResolutions = {} }: HomeAtlasExperienceProps) {
  return (
    <>
      <AtlasMap events={events} flyerResolutions={flyerResolutions} enableAtlasDebug />
      {/*
        The below-map Celebration Search shell is preserved as a component for
        development routes and future use, but the visible Michigan homepage now
        keeps search inside the AtlasMap command dock.
      */}
    </>
  );
}
