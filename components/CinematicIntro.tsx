'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CinematicIntroProps = {
  children: ReactNode;
};

const INTRO_DURATION_MS = 4200;

export default function CinematicIntro({ children }: CinematicIntroProps) {
  const [isActive, setIsActive] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setIsReducedMotion(mediaQuery.matches);

    syncMotion();
    setIsActive(!mediaQuery.matches);
    mediaQuery.addEventListener('change', syncMotion);

    return () => mediaQuery.removeEventListener('change', syncMotion);
  }, []);

  const shouldRenderOverlay = isActive && !isReducedMotion;

  useEffect(() => {
    if (!shouldRenderOverlay) return;
    const timer = window.setTimeout(() => setIsActive(false), INTRO_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [shouldRenderOverlay]);

  const finishIntro = () => setIsActive(false);

  const introTimingClass = useMemo(() => (shouldRenderOverlay ? 'atlas-intro--active' : ''), [shouldRenderOverlay]);

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      {children}
      {shouldRenderOverlay ? (
        <button
          aria-label="Skip intro"
          onClick={finishIntro}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') finishIntro();
          }}
          style={{
            border: 'none',
            background: 'transparent',
            position: 'fixed',
            inset: 0,
            width: '100%',
            padding: 0,
            zIndex: 40,
            cursor: 'pointer',
          }}
        >
          <span className={`atlas-intro ${introTimingClass}`}>
            <span className="atlas-intro__veil" aria-hidden="true" />
            <span className="atlas-intro__logo-wrap" aria-hidden="true">
              <Image
                src="/branding/celebration-atlas-logo.png"
                alt=""
                width={820}
                height={820}
                priority
                className="atlas-intro__logo"
              />
            </span>
          </span>
        </button>
      ) : null}
      <style jsx>{`
        .atlas-intro {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          background: #000;
          overflow: hidden;
          animation: introBackdrop ${INTRO_DURATION_MS}ms ease forwards;
        }

        .atlas-intro__veil {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at center, rgba(16, 20, 34, 0.34) 0%, rgba(0, 0, 0, 0.88) 58%, rgba(0, 0, 0, 1) 100%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.74) 0%, rgba(0, 0, 0, 0.92) 100%);
          animation: veilLift ${INTRO_DURATION_MS}ms ease forwards;
        }

        .atlas-intro__logo-wrap {
          position: relative;
          width: min(76vw, 460px);
          opacity: 0;
          transform: scale(0.976);
          filter: brightness(0.84);
          animation: logoReveal ${INTRO_DURATION_MS}ms cubic-bezier(0.2, 0.7, 0.16, 1) forwards;
        }

        :global(.atlas-intro__logo) {
          width: 100%;
          height: auto;
          filter: drop-shadow(0 0 10px rgba(210, 220, 255, 0.16)) drop-shadow(0 0 36px rgba(134, 172, 255, 0.15));
        }

        @keyframes logoReveal {
          0% {
            opacity: 0;
            transform: scale(0.97);
            filter: brightness(0.72) saturate(0.9);
          }
          34% {
            opacity: 0.88;
            transform: scale(1);
            filter: brightness(0.98) saturate(1);
          }
          58% {
            opacity: 0.92;
            filter: brightness(1.03) saturate(1.02);
          }
          100% {
            opacity: 0;
            transform: scale(1.012);
            filter: brightness(1.04) saturate(1.04);
          }
        }

        @keyframes introBackdrop {
          0% {
            background: rgba(0, 0, 0, 1);
            opacity: 1;
          }
          58% {
            background: rgba(0, 0, 0, 0.98);
            opacity: 1;
          }
          84% {
            background: rgba(0, 0, 0, 0.68);
            opacity: 1;
          }
          100% {
            background: rgba(0, 0, 0, 0);
            opacity: 0;
          }
        }

        @keyframes veilLift {
          0% {
            opacity: 1;
          }
          62% {
            opacity: 0.8;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
