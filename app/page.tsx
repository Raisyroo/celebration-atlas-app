import { Suspense } from 'react';
import AtlasMap from '../components/AtlasMap';
import CinematicIntro from '../components/CinematicIntro';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <CinematicIntro>
        <AtlasMap />
      </CinematicIntro>
    </Suspense>
  );
}
