import { Suspense } from 'react';
import CinematicIntro from '../components/CinematicIntro';
import HomeAtlasExperience from '../components/HomeAtlasExperience';
import { ATLAS_EVENTS } from '../data/events';
import { resolveEventFlyerMediaMapServer } from '../data/eventMediaServer';

export default async function HomePage() {
  const flyerResolutions = await resolveEventFlyerMediaMapServer(ATLAS_EVENTS);

  return (
    <Suspense fallback={null}>
      <CinematicIntro skipOnDesktop>
        <HomeAtlasExperience flyerResolutions={flyerResolutions} />
      </CinematicIntro>
    </Suspense>
  );
}
