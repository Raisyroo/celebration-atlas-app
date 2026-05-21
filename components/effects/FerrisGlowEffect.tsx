import type { CSSProperties } from 'react';

type FerrisGlowPoint = {
  id: string;
  x: number;
  y: number;
};

type FerrisGlowEffectProps = {
  points: FerrisGlowPoint[];
};

const Z_INDEX_FERRIS_GLOW = 3; // Decorative layer only, below markers/labels/cards/search.

const styles: Record<string, CSSProperties> = {
  layer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX_FERRIS_GLOW,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: '50%',
    pointerEvents: 'none',
    willChange: 'transform, opacity',
    transform: 'translate(-50%, -50%) translateZ(0)',
    mixBlendMode: 'screen',
    background:
      'radial-gradient(circle, rgba(255,220,154,0.2) 0%, rgba(255,196,122,0.12) 42%, rgba(255,174,98,0.03) 70%, rgba(255,174,98,0) 100%)',
    filter: 'blur(0.2px)',
  },
};

const hashSeed = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

export default function FerrisGlowEffect({ points }: FerrisGlowEffectProps) {
  if (points.length === 0) return null;

  return (
    <>
      <div style={styles.layer} aria-hidden="true">
        {points.map((point) => {
          const seed = hashSeed(point.id);
          const driftX = (seed % 7) - 3;
          const driftY = ((seed >> 2) % 5) - 2;
          const cycleSeconds = 10 + (seed % 5);
          const delaySeconds = -((seed % 9) * 0.7);
          const scale = 0.92 + (seed % 4) * 0.04;

          return (
            <span
              key={point.id}
              style={{
                ...styles.glow,
                left: `calc(${point.x}% + ${driftX}px)`,
                top: `calc(${point.y}% + ${driftY}px)`,
                animation: `ferrisGlowPulse ${cycleSeconds}s ease-in-out infinite`,
                animationDelay: `${delaySeconds}s`,
                ['--ferris-glow-scale' as string]: `${scale}`,
              }}
            />
          );
        })}
      </div>

      <style jsx>{`
        @keyframes ferrisGlowPulse {
          0%, 100% {
            opacity: 0.08;
            transform: translate(-50%, -50%) scale(calc(0.92 * var(--ferris-glow-scale, 1)));
          }
          50% {
            opacity: 0.16;
            transform: translate(-50%, -50%) scale(calc(1.05 * var(--ferris-glow-scale, 1)));
          }
        }
      `}</style>
    </>
  );
}
