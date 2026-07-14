import { Suspense } from 'react';
import CinematicIntro from '../components/CinematicIntro';
import HomeAtlasExperience from '../components/HomeAtlasExperience';
import AuthCallbackRecovery from '../components/AuthCallbackRecovery';
import { resolveEventFlyerMediaMapServer } from '../data/eventMediaServer';
import { resolvePublishedAtlasEvents } from '../lib/events/publishedAtlasEvents';

export default async function HomePage() {
  const events = await resolvePublishedAtlasEvents();
  const flyerResolutions = await resolveEventFlyerMediaMapServer(events);

  return (
    <Suspense fallback={null}>
      <AuthCallbackRecovery />
      <CinematicIntro skipOnDesktop>
        <HomeAtlasExperience events={events} flyerResolutions={flyerResolutions} />
      </CinematicIntro>
    </Suspense>
  );
}
