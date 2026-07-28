import HomeAtlasExperience from './HomeAtlasExperience';
import type { AtlasEvent } from '../data/events';
import { MICHIGAN_HOME_ATLAS_SEARCH_RULES } from '../data/stateAtlasSearchRules';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig';

type MichiganAtlasExperienceProps = {
  events: readonly AtlasEvent[];
};

export default function MichiganAtlasExperience({
  events,
}: MichiganAtlasExperienceProps) {
  return (
    <HomeAtlasExperience
      stateConfig={MICHIGAN_STATE_ATLAS_CONFIG}
      searchRules={MICHIGAN_HOME_ATLAS_SEARCH_RULES}
      events={events}
    />
  );
}

export { MichiganAtlasExperience };
