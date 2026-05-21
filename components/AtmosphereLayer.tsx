import type { AtlasEvent } from '../data/events';
import CloudEffect from './effects/CloudEffect';
import FogEffect from './effects/FogEffect';
import FireworksEffect from './effects/FireworksEffect';
import GeeseEffect from './effects/GeeseEffect';

type AtmosphereLayerProps = {
  events: AtlasEvent[];
};

export default function AtmosphereLayer({ events }: AtmosphereLayerProps) {
  const hasFog = events.some((event) => event.atmosphere?.effects?.includes('fog'));
  const fireworksPoints = events
    .filter((event) => event.atmosphere?.effects?.includes('fireworks'))
    .map((event) => ({ id: event.id, x: event.x, y: event.y, intensity: event.atmosphere?.intensity ?? 'subtle' }));

  return (
    <>
      <CloudEffect />
      <FogEffect enabled={hasFog} />
      <FireworksEffect points={fireworksPoints} />
      <GeeseEffect />
    </>
  );
}
