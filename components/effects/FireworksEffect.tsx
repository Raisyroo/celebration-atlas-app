import type { CSSProperties } from 'react';

type FireworkPoint = {
  id: string;
  x: number;
  y: number;
  intensity: 'subtle' | 'medium' | 'signature';
};

type FireworksEffectProps = {
  points: FireworkPoint[];
};

type FireworkTone = {
  streak: string;
  burst: string;
  glow: string;
};

type IntensityProfile = {
  cycleBase: number;
  cycleVariance: number;
  launchLift: number;
  burstScale: number;
  bloomOpacity: number;
};

const Z_INDEX_FIREWORKS = 3; // Decorative layer above map art, below markers.

const styles: Record<string, CSSProperties> = {
  fireworksLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX_FIREWORKS,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  firework: {
    position: 'absolute',
    width: 1,
    height: 1,
    pointerEvents: 'none',
    filter: 'blur(.08px)',
    transform: 'translateZ(0)',
  },
  streak: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 1,
    height: 8,
    borderRadius: 999,
    transformOrigin: 'center bottom',
  },
  burst: {
    position: 'absolute',
    left: '-7px',
    top: '-7px',
    width: 14,
    height: 14,
    borderRadius: '50%',
    mixBlendMode: 'screen',
  },
};

const INTENSITY_PROFILE: Record<FireworkPoint['intensity'], IntensityProfile> = {
  subtle: {
    cycleBase: 28,
    cycleVariance: 24,
    launchLift: 9,
    burstScale: 0.9,
    bloomOpacity: 0.82,
  },
  medium: {
    cycleBase: 24,
    cycleVariance: 28,
    launchLift: 10,
    burstScale: 0.96,
    bloomOpacity: 0.88,
  },
  signature: {
    cycleBase: 20,
    cycleVariance: 32,
    launchLift: 11,
    burstScale: 1.04,
    bloomOpacity: 0.94,
  },
};

const FIREWORK_TONES: FireworkTone[] = [
  {
    streak: 'linear-gradient(to top, rgba(255,198,140,0), rgba(255,214,158,0.24) 35%, rgba(255,230,188,0.38))',
    burst:
      'radial-gradient(circle, rgba(255,236,198,0.34) 0%, rgba(255,212,151,0.23) 28%, rgba(255,186,120,0.09) 56%, rgba(255,186,120,0) 76%)',
    glow: '0 0 10px rgba(255,208,142,0.16)',
  },
  {
    streak: 'linear-gradient(to top, rgba(255,185,148,0), rgba(255,205,171,0.24) 35%, rgba(255,227,204,0.36))',
    burst:
      'radial-gradient(circle, rgba(255,229,210,0.33) 0%, rgba(255,199,165,0.22) 30%, rgba(255,172,136,0.08) 58%, rgba(255,172,136,0) 76%)',
    glow: '0 0 10px rgba(255,198,166,0.15)',
  },
  {
    streak: 'linear-gradient(to top, rgba(255,181,122,0), rgba(255,200,145,0.24) 36%, rgba(255,221,172,0.36))',
    burst:
      'radial-gradient(circle, rgba(255,232,190,0.32) 0%, rgba(255,203,140,0.22) 30%, rgba(255,174,110,0.08) 58%, rgba(255,174,110,0) 76%)',
    glow: '0 0 10px rgba(255,196,128,0.15)',
  },
];

const hashSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export default function FireworksEffect({ points }: FireworksEffectProps) {
  if (points.length === 0) return null;

  return (
    <>
      <div style={styles.fireworksLayer} aria-hidden="true">
        {points.map((point, index) => {
          const seed = hashSeed(point.id);
          const profile = INTENSITY_PROFILE[point.intensity];
          const tone = FIREWORK_TONES[seed % FIREWORK_TONES.length];

          const cycleSeconds = profile.cycleBase + (seed % profile.cycleVariance) + index * 0.15;
          const delaySeconds = -((seed % 11) + index * 1.6);
          const driftX = (seed % 9) - 4;
          const driftY = ((seed >> 3) % 7) - 3;

          return (
            <div
              key={point.id}
              style={{
                ...styles.firework,
                left: `calc(${point.x}% + ${driftX}px)`,
                top: `calc(${point.y}% + ${driftY}px)`,
                animation: `fireworkCycle ${cycleSeconds}s linear infinite`,
                animationDelay: `${delaySeconds}s`,
                ['--firework-launch-lift' as string]: `${profile.launchLift}px`,
                ['--firework-burst-scale' as string]: `${profile.burstScale}`,
                ['--firework-bloom-opacity' as string]: `${profile.bloomOpacity}`,
              }}
            >
              <span
                style={{
                  ...styles.streak,
                  background: tone.streak,
                  animation: `fireworkStreak ${cycleSeconds}s ease-out infinite`,
                  animationDelay: 'inherit',
                }}
              />
              <span
                style={{
                  ...styles.burst,
                  background: tone.burst,
                  boxShadow: tone.glow,
                  animation: `fireworkBurst ${cycleSeconds}s ease-out infinite`,
                  animationDelay: 'inherit',
                }}
              />
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes fireworkCycle {
          0%, 90%, 100% { opacity: 0; }
          2.2%, 4.1% { opacity: 1; }
          5.2% { opacity: 0; }
        }

        @keyframes fireworkStreak {
          0%, 90%, 100% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scaleY(.45);
          }
          1.8% {
            opacity: calc(0.3 * var(--firework-bloom-opacity, 1));
            transform: translate3d(0, calc(var(--firework-launch-lift, 11px) * -0.72), 0) scaleY(1);
          }
          3.2% {
            opacity: 0;
            transform: translate3d(0, calc(var(--firework-launch-lift, 11px) * -1), 0) scaleY(.86);
          }
        }

        @keyframes fireworkBurst {
          0%, 90%, 100% {
            opacity: 0;
            transform: translate3d(0, calc(var(--firework-launch-lift, 11px) * -1), 0) scale(calc(.45 * var(--firework-burst-scale, 1)));
          }
          2.5% {
            opacity: calc(0.24 * var(--firework-bloom-opacity, 1));
            transform: translate3d(0, calc(var(--firework-launch-lift, 11px) * -1.02), 0) scale(calc(.92 * var(--firework-burst-scale, 1)));
          }
          4.8% {
            opacity: 0;
            transform: translate3d(0, calc(var(--firework-launch-lift, 11px) * -1.02), 0) scale(calc(1.14 * var(--firework-burst-scale, 1)));
          }
        }
      `}</style>
    </>
  );
}
