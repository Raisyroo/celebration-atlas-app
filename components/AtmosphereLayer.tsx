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
    .map((event) => ({ id: event.id, x: event.x, y: event.y }));

  return (
    <>
      <CloudEffect />
      <FireworksEffect points={fireworksPoints} />
      <GeeseEffect />
    </>
  );
}
