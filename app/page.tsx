import { Suspense } from 'react';
import CinematicIntro from '../components/CinematicIntro';
import MichiganAtlasExperience from '../components/MichiganAtlasExperience';
import AuthCallbackRecovery from '../components/AuthCallbackRecovery';
import { resolveEventFlyerMediaMapServer } from '../data/eventMediaServer';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig';
import { resolvePublishedAtlasEvents } from '../lib/events/publishedAtlasEvents';

export default async function HomePage() {
  const events = await resolvePublishedAtlasEvents(MICHIGAN_STATE_ATLAS_CONFIG);
  const flyerResolutions = await resolveEventFlyerMediaMapServer(events);

  return (
    <Suspense fallback={null}>
      <AuthCallbackRecovery />
      <CinematicIntro skipOnDesktop>
        <MichiganAtlasExperience events={events} flyerResolutions={flyerResolutions} />
      </CinematicIntro>
    </Suspense>
  );
}
