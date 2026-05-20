import type { CSSProperties } from 'react';

const GEESE_FLYOVER_CYCLE_SECONDS = 120;

const styles: Record<string, CSSProperties> = {
  geeseLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 4,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  geeseImage: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 'clamp(88px, 18vw, 128px)',
    height: 'auto',
    maxWidth: 'none',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
    opacity: 0.34,
    mixBlendMode: 'screen',
    willChange: 'transform, opacity',
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
          0%,
          84% {
            opacity: 0;
            transform: translate3d(-66vw, 132vh, 0) scale(0.86);
          }
          87% {
            opacity: 0.34;
          }
          96% {
            opacity: 0.34;
            transform: translate3d(164vw, -54vh, 0) scale(0.92);
          }
          100% {
            opacity: 0;
            transform: translate3d(164vw, -54vh, 0) scale(0.92);
          }
        }
      `}</style>
    </>
  );
}
