import { Suspense } from 'react';
import AtlasMap from '../components/AtlasMap';

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <AtlasMap />
    </Suspense>
  );
}
