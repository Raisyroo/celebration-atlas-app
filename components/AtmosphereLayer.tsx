import type { ReactNode } from 'react';
import type { AtlasEvent } from '../data/events';
import CloudEffect from './effects/CloudEffect';
import FogEffect from './effects/FogEffect';
import FireworksEffect from './effects/FireworksEffect';
import GeeseEffect from './effects/GeeseEffect';
import FerrisGlowEffect from './effects/FerrisGlowEffect';

type AtmosphereLayerProps = {
  events: AtlasEvent[];
};

type EffectName = 'geese' | 'clouds' | 'fireworks' | 'fog' | 'snow' | 'balloons' | 'ferrisGlow';

export default function AtmosphereLayer({ events }: AtmosphereLayerProps) {
  const hasFog = events.some((event) => event.atmosphere?.effects?.includes('fog'));
  const fireworksPoints = events
    .filter((event) => event.atmosphere?.effects?.includes('fireworks'))
    .map((event) => ({ id: event.id, x: event.x, y: event.y, intensity: event.atmosphere?.intensity ?? 'subtle' }));

  const ferrisGlowPoints = events
    .filter((event) => event.atmosphere?.effects?.includes('ferrisGlow'))
    .map((event) => ({ id: event.id, x: event.x, y: event.y }));

  const effectRegistry: Record<EffectName, ReactNode | null> = {
    geese: <GeeseEffect key="geese" />,
    clouds: <CloudEffect key="clouds" />,
    fireworks: <FireworksEffect key="fireworks" points={fireworksPoints} />,
    fog: <FogEffect key="fog" enabled={hasFog} />,
    snow: null,
    balloons: null,
    ferrisGlow: <FerrisGlowEffect key="ferrisGlow" points={ferrisGlowPoints} />,
  };

  const implementedEffects: EffectName[] = ['clouds', 'fog', 'fireworks', 'ferrisGlow', 'geese'];

  return <>{implementedEffects.map((effectName) => effectRegistry[effectName])}</>;
}
