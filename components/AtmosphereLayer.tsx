import type { AtlasEvent } from '../data/events';
import CloudEffect from './effects/CloudEffect';
import FireworksEffect from './effects/FireworksEffect';
import GeeseEffect from './effects/GeeseEffect';

type AtmosphereLayerProps = {
  events: AtlasEvent[];
};

export default function AtmosphereLayer({ events }: AtmosphereLayerProps) {
  const fireworksPoints = events
    .filter((event) => event.atmosphere?.effects?.includes('fireworks'))
    .map((event) => ({ id: event.id, x: event.x, y: event.y, intensity: event.atmosphere?.intensity ?? 'subtle' }));

  return (
    <>
      <CloudEffect />
      {/* Temporary debug only: fireworks should sit above map/clouds while staying below markers/cards/search UI. */}
      <FireworksEffect points={fireworksPoints} />
      <GeeseEffect />
    </>
  );
}
