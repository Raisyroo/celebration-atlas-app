import type { CSSProperties } from 'react';

const CLOUD_ASSET_VERSION = '2026-05-20';

const styles: Record<string, CSSProperties> = {
  cloudLayer: {
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    pointerEvents: 'none',
    overflow: 'hidden',
  },
  cloudImage: {
    position: 'absolute',
    height: 'auto',
    maxWidth: 'none',
    objectFit: 'contain',
    pointerEvents: 'none',
    userSelect: 'none',
    willChange: 'transform',
  },
  cloudDriftUpper: {
    width: 360,
    left: '-34%',
    top: '10%',
    opacity: 0.16,
    mixBlendMode: 'screen',
    animation: 'cloudDriftPrimary 84s linear infinite',
  },
  cloudDriftLower: {
    width: 330,
    left: '-30%',
    top: '56%',
    opacity: 0.13,
    mixBlendMode: 'screen',
    animation: 'cloudDriftSecondary 76s linear infinite',
  },
};

export default function CloudEffect() {
  return (
    <>
      <div style={styles.cloudLayer} aria-hidden="true">
        <img
          src={`/overlays/cloud-drift-1.png?v=${CLOUD_ASSET_VERSION}`}
          alt=""
          draggable={false}
          style={{ ...styles.cloudImage, ...styles.cloudDriftUpper }}
        />
        <img
          src={`/overlays/cloud-drift-1.png?v=${CLOUD_ASSET_VERSION}`}
          alt=""
          draggable={false}
          style={{ ...styles.cloudImage, ...styles.cloudDriftLower }}
        />
      </div>

      <style jsx>{`
        @keyframes cloudDriftPrimary {
          0% {
            opacity: 0.16;
            transform: translate3d(-128vw, 0vh, 0) scale(1.01);
          }
          93% {
            opacity: 0.16;
            transform: translate3d(146vw, 7vh, 0) scale(1.04);
          }
          100% {
            opacity: 0;
            transform: translate3d(146vw, 7vh, 0) scale(1.04);
          }
        }

        @keyframes cloudDriftSecondary {
          0% {
            opacity: 0.13;
            transform: translate3d(-124vw, 0vh, 0) scale(1.02);
          }
          92% {
            opacity: 0.13;
            transform: translate3d(144vw, -9vh, 0) scale(1.05);
          }
          100% {
            opacity: 0;
            transform: translate3d(144vw, -9vh, 0) scale(1.05);
          }
        }
      `}</style>
    </>
  );
}
