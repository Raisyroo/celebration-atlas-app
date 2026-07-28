import { Suspense } from 'react';
import { connection } from 'next/server';
import MichiganAtlasExperience from '../components/MichiganAtlasExperience';
import AuthCallbackRecovery from '../components/AuthCallbackRecovery';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '../data/stateAtlasConfig';
import { resolvePublishedAtlasEvents } from '../lib/events/publishedAtlasEvents';

export default async function HomePage() {
  await connection();
  const events = await resolvePublishedAtlasEvents(MICHIGAN_STATE_ATLAS_CONFIG);

  return (
    <Suspense fallback={null}>
      <AuthCallbackRecovery />
      <MichiganAtlasExperience events={events} />
    </Suspense>
  );
}
