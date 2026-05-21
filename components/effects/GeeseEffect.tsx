import type { CSSProperties } from 'react';

// Temporary 30s cadence until ambient timing is finalized.
const GEESE_FLYOVER_CYCLE_SECONDS = 30;
const Z_INDEX_GEESE = 4;

const styles: Record<string, CSSProperties> = {
  geeseLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: Z_INDEX_GEESE,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  geeseImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 'clamp(104px, 16vw, 168px)',
    height: 'auto',
    maxWidth: 'none',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
    opacity: 0.28,
    mixBlendMode: 'screen',
    willChange: 'transform, opacity',
    transform: 'translateZ(0)',
    animation: `${GEESE_FLYOVER_CYCLE_SECONDS}s geeseFlyover linear infinite`,
  },
};

export default function GeeseEffect() {
  return (
    <>
      <div style={styles.geeseLayer} aria-hidden="true">
        <img src="/overlays/geese.png" alt="" draggable={false} style={styles.geeseImage} />
      </div>

      <style jsx>{`
        @keyframes geeseFlyover {
          0% {
            opacity: 0.28;
            transform: translate3d(-72vw, 136vh, 0) scale(0.6);
          }
          92% {
            opacity: 0.28;
            transform: translate3d(172vw, -58vh, 0) scale(0.66);
          }
          100% {
            opacity: 0;
            transform: translate3d(172vw, -58vh, 0) scale(0.66);
          }
        }
      `}</style>
    </>
  );
}
