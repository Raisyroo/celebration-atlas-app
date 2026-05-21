import type { CSSProperties } from 'react';

type FogEffectProps = {
  enabled?: boolean;
};

const Z_INDEX_FOG = 3; // Decorative only; must not intercept taps.

const styles: Record<string, CSSProperties> = {
  fogLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX_FOG,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  fogBand: {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(22px)',
    willChange: 'transform, opacity',
    transform: 'translateZ(0)',
    pointerEvents: 'none',
    mixBlendMode: 'screen',
  },
  lowerBand: {
    left: '-22%',
    bottom: '-8%',
    width: '158%',
    height: '42%',
    opacity: 0.14,
    background:
      'radial-gradient(ellipse at 48% 60%, rgba(214,227,238,0.32) 0%, rgba(196,214,228,0.18) 34%, rgba(186,208,226,0.08) 54%, rgba(180,203,220,0) 72%)',
    animation: 'fogDriftLower 72s ease-in-out infinite alternate',
  },
  middleBand: {
    left: '-14%',
    bottom: '10%',
    width: '138%',
    height: '30%',
    opacity: 0.1,
    background:
      'radial-gradient(ellipse at 50% 55%, rgba(222,233,242,0.26) 0%, rgba(200,217,230,0.16) 42%, rgba(191,210,226,0.06) 58%, rgba(188,208,223,0) 75%)',
    animation: 'fogDriftMiddle 84s ease-in-out infinite alternate',
  },
  upperBand: {
    left: '-18%',
    top: '20%',
    width: '145%',
    height: '24%',
    opacity: 0.06,
    background:
      'radial-gradient(ellipse at 48% 52%, rgba(228,236,244,0.22) 0%, rgba(207,222,233,0.12) 42%, rgba(196,213,227,0.05) 58%, rgba(190,209,223,0) 78%)',
    animation: 'fogDriftUpper 108s ease-in-out infinite alternate',
  },
};

export default function FogEffect({ enabled = true }: FogEffectProps) {
  if (!enabled) return null;

  return (
    <>
      <div style={styles.fogLayer} aria-hidden="true" className="fog-layer">
        <div className="fog-band" style={{ ...styles.fogBand, ...styles.lowerBand }} />
        <div className="fog-band" style={{ ...styles.fogBand, ...styles.middleBand }} />
        <div className="fog-band" style={{ ...styles.fogBand, ...styles.upperBand }} />
      </div>

      <style jsx>{`
        @keyframes fogDriftLower {
          0% { transform: translate3d(-2%, 0, 0) scale(1); }
          100% { transform: translate3d(2%, -1.5%, 0) scale(1.03); }
        }

        @keyframes fogDriftMiddle {
          0% { transform: translate3d(1.5%, 0, 0) scale(1); }
          100% { transform: translate3d(-1.5%, -1%, 0) scale(1.02); }
        }

        @keyframes fogDriftUpper {
          0% { transform: translate3d(-1%, 0, 0) scale(1); }
          100% { transform: translate3d(1%, -1.2%, 0) scale(1.02); }
        }

        @media (max-width: 768px) {
          .fog-layer .fog-band {
            filter: blur(18px);
          }
        }
      `}</style>
    </>
  );
}
