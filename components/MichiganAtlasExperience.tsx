import HomeAtlasExperience from './HomeAtlasExperience';
import type { AtlasEvent } from '../data/events';
import type { EventFlyerResolutionMap } from '../data/eventMediaResolutionTypes';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig';

type MichiganAtlasExperienceProps = {
  events: readonly AtlasEvent[];
  flyerResolutions?: EventFlyerResolutionMap;
};

export default function MichiganAtlasExperience({
  events,
  flyerResolutions = {},
}: MichiganAtlasExperienceProps) {
  return (
    <HomeAtlasExperience
      stateConfig={MICHIGAN_STATE_ATLAS_CONFIG}
      events={events}
      flyerResolutions={flyerResolutions}
    />
  );
}

export { MichiganAtlasExperience };
