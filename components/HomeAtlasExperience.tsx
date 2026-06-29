'use client';

import AtlasMap from './AtlasMap';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes';

type HomeAtlasExperienceProps = {
  flyerResolutions?: EventFlyerResolutionMap;
};

export default function HomeAtlasExperience({ flyerResolutions = {} }: HomeAtlasExperienceProps) {
  return (
    <>
      <AtlasMap flyerResolutions={flyerResolutions} />
      {/*
        The below-map Celebration Search shell is preserved as a component for
        development routes and future use, but the visible Michigan homepage now
        keeps search inside the AtlasMap command dock.
      */}
    </>
  );
}
