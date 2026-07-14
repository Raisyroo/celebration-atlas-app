import type { ReactNode } from 'react';
import type { AtlasEvent } from '../data/events';
import { latLngToAtlasPosition } from '../data/mapCalibration';
import CloudEffect from './effects/CloudEffect';
import FireworksEffect from './effects/FireworksEffect';
import GeeseEffect from './effects/GeeseEffect';
import FerrisGlowEffect from './effects/FerrisGlowEffect';

type AtmosphereLayerProps = {
  events: readonly AtlasEvent[];
  selectedEvent: AtlasEvent | null;
  depthOffsetX?: number;
  depthOffsetY?: number;
  prefersReducedMotion?: boolean;
};

type EffectName = 'geese' | 'clouds' | 'fireworks' | 'snow' | 'balloons' | 'ferrisGlow';

export default function AtmosphereLayer({
  events,
  selectedEvent,
  depthOffsetX = 0,
  depthOffsetY = 0,
  prefersReducedMotion = false,
}: AtmosphereLayerProps) {
  const fireworksPoints = events
    .filter((event) => event.atmosphere?.effects?.includes('fireworks'))
    .map((event) => {
      const position = latLngToAtlasPosition(event.latitude, event.longitude);

      return { id: event.id, x: position.x, y: position.y, intensity: event.atmosphere?.intensity ?? 'subtle' };
    });

  const ferrisGlowPoints = events
    .filter((event) => event.atmosphere?.effects?.includes('ferrisGlow'))
    .map((event) => {
      const position = latLngToAtlasPosition(event.latitude, event.longitude);

      return { id: event.id, x: position.x, y: position.y };
    });

  const effectRegistry: Record<EffectName, ReactNode | null> = {
    geese: <GeeseEffect key="geese" />,
    clouds: <CloudEffect key="clouds" />,
    fireworks: <FireworksEffect key="fireworks" points={fireworksPoints} />,
    snow: null,
    balloons: null,
    ferrisGlow: <FerrisGlowEffect key="ferrisGlow" points={ferrisGlowPoints} />,
  };

  const implementedEffects: EffectName[] = ['clouds', 'fireworks', 'ferrisGlow', 'geese'];

  const regionAtmosphere = selectedEvent?.regionAtmosphere;
  const regionToneByType: Record<NonNullable<AtlasEvent['regionAtmosphere']>, string> = {
    lakeshore: 'radial-gradient(circle at 32% 42%, rgba(167, 201, 232, 0.11), rgba(167, 201, 232, 0) 58%)',
    northwoods: 'radial-gradient(circle at 26% 24%, rgba(120, 160, 206, 0.1), rgba(120, 160, 206, 0) 62%)',
    urban: 'radial-gradient(circle at 72% 58%, rgba(255, 211, 146, 0.09), rgba(255, 211, 146, 0) 44%)',
    harvest: 'radial-gradient(circle at 58% 48%, rgba(255, 180, 101, 0.12), rgba(255, 180, 101, 0) 56%)',
    winter: 'radial-gradient(circle at 50% 34%, rgba(198, 226, 255, 0.1), rgba(198, 226, 255, 0) 62%)',
  };

  const atmosphereDepthTransform = prefersReducedMotion
    ? 'translate3d(0, 0, 0)'
    : `translate3d(${depthOffsetX * 0.7}px, ${depthOffsetY * 0.7}px, 0)`;

  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        pointerEvents: 'none',
        transform: atmosphereDepthTransform,
        transition: prefersReducedMotion ? undefined : 'transform 480ms cubic-bezier(.22,.61,.36,1)',
        willChange: prefersReducedMotion ? undefined : 'transform',
      }}
    >
      {implementedEffects.map((effectName) => effectRegistry[effectName])}
      {regionAtmosphere ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            zIndex: 3,
            mixBlendMode: 'screen',
            opacity: 0.84,
            background: regionToneByType[regionAtmosphere],
            animation:
              regionAtmosphere === 'urban'
                ? 'regionalUrbanGlowPulse 8.4s ease-in-out infinite'
                : regionAtmosphere === 'lakeshore'
                  ? 'regionalLakeshoreShimmer 12s ease-in-out infinite'
                  : 'regionalBreathe 11s ease-in-out infinite',
            transform: 'translateZ(0)',
            willChange: 'opacity, transform',
          }}
        />
      ) : null}
      <style jsx global>{`
        @keyframes regionalBreathe {
          0%,
          100% { opacity: 0.72; transform: translate3d(0, 0, 0) scale(1); }
          50% { opacity: 0.9; transform: translate3d(0, -0.2%, 0) scale(1.012); }
        }
        @keyframes regionalLakeshoreShimmer {
          0%,
          100% { opacity: 0.68; transform: translate3d(0, 0, 0) scale(1); filter: blur(0px); }
          50% { opacity: 0.9; transform: translate3d(0.35%, -0.25%, 0) scale(1.013); filter: blur(0.4px); }
        }
        @keyframes regionalUrbanGlowPulse {
          0%,
          100% { opacity: 0.62; }
          35% { opacity: 0.82; }
          70% { opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
