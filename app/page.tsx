import { Suspense } from 'react';
import CinematicIntro from '../components/CinematicIntro';
import HomeAtlasExperience from '../components/HomeAtlasExperience';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CinematicIntro skipOnDesktop>
        <HomeAtlasExperience />
      </CinematicIntro>
    </Suspense>
  );
}
