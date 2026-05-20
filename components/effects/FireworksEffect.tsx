import type { CSSProperties } from 'react';

type FireworkPoint = {
  id: string;
  x: number;
  y: number;
};

type FireworksEffectProps = {
  points: FireworkPoint[];
};

const styles: Record<string, CSSProperties> = {
  fireworksLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 3,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  firework: {
    position: 'absolute',
    width: 1,
    height: 1,
    pointerEvents: 'none',
    filter: 'blur(.08px)',
  },
  streak: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 1,
    height: 8,
    borderRadius: 999,
    background: 'linear-gradient(to top, rgba(255,191,115,0), rgba(255,198,135,0.22) 35%, rgba(255,219,175,0.36))',
    transformOrigin: 'center bottom',
  },
  burst: {
    position: 'absolute',
    left: '-7px',
    top: '-7px',
    width: 14,
    height: 14,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(255,236,198,0.34) 0%, rgba(255,204,133,0.22) 28%, rgba(255,177,102,0.08) 56%, rgba(255,177,102,0) 75%)',
    boxShadow: '0 0 10px rgba(255,200,128,0.15)',
    mixBlendMode: 'screen',
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

export default function FireworksEffect({ points }: FireworksEffectProps) {
  if (points.length === 0) return null;

  return (
    <>
      <div style={styles.fireworksLayer} aria-hidden="true">
        {points.map((point, index) => {
          const seed = hashSeed(point.id);
          const cycleSeconds = 16 + (seed % 9) + index * 0.7;
          const delaySeconds = -((seed % 12) + index * 1.9);
          const driftX = (seed % 5) - 2;

          return (
            <div
              key={point.id}
              style={{
                ...styles.firework,
                left: `calc(${point.x}% + ${driftX}px)`,
                top: `${point.y}%`,
                animation: `fireworkCycle ${cycleSeconds}s linear infinite`,
                animationDelay: `${delaySeconds}s`,
              }}
            >
              <span style={{ ...styles.streak, animation: `fireworkStreak ${cycleSeconds}s ease-out infinite`, animationDelay: 'inherit' }} />
              <span style={{ ...styles.burst, animation: `fireworkBurst ${cycleSeconds}s ease-out infinite`, animationDelay: 'inherit' }} />
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
            opacity: 0.32;
            transform: translate3d(0, -8px, 0) scaleY(1);
          }
          3.2% {
            opacity: 0;
            transform: translate3d(0, -12px, 0) scaleY(.86);
          }
        }

        @keyframes fireworkBurst {
          0%, 90%, 100% {
            opacity: 0;
            transform: translate3d(0, -11px, 0) scale(.45);
          }
          2.5% {
            opacity: 0.26;
            transform: translate3d(0, -12px, 0) scale(.92);
          }
          4.8% {
            opacity: 0;
            transform: translate3d(0, -12px, 0) scale(1.16);
          }
        }
      `}</style>
    </>
  );
}
