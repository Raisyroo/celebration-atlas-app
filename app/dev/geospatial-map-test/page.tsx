import type { Metadata } from 'next';
import GeospatialMapTest from './GeospatialMapTest';

export const metadata: Metadata = {
  title: 'Development Preview — Geospatial Map Test',
  description:
    'Isolated API-key-free real-coordinate map prototype using existing Celebration Atlas event latitude and longitude.',
};

export default function DevGeospatialMapTestPage() {
  return (
    <main className="dev-geospatial-map-page" aria-label="Development Preview — Geospatial Map Test">
      <GeospatialMapTest />
    </main>
  );
}
