'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CinematicIntroProps = {
  children: ReactNode;
};

const INTRO_DURATION_MS = 4200;
const REDUCED_MOTION_DURATION_MS = 900;

export default function CinematicIntro({ children }: CinematicIntroProps) {
  const [isActive, setIsActive] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setIsReducedMotion(mediaQuery.matches);

    syncMotion();
    setIsActive(true);
    mediaQuery.addEventListener('change', syncMotion);

    return () => mediaQuery.removeEventListener('change', syncMotion);
  }, []);

  const shouldRenderOverlay = isActive;
  const introDurationMs = isReducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS;

  useEffect(() => {
    if (!shouldRenderOverlay) return;
    const timer = window.setTimeout(() => setIsActive(false), introDurationMs);
    return () => window.clearTimeout(timer);
  }, [introDurationMs, shouldRenderOverlay]);

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
            width: '100vw',
            height: '100dvh',
            padding: 0,
            zIndex: 2147483647,
            cursor: 'pointer',
          }}
        >
          <span className={`atlas-intro ${introTimingClass}`}>
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
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          display: grid;
          place-items: center;
          background: #000;
          overflow: hidden;
          z-index: 2147483647;
          animation: introBackdrop ${introDurationMs}ms ease forwards;
        }

        .atlas-intro__logo-wrap {
          position: relative;
          width: min(76vw, 360px);
          opacity: 0;
          animation: logoReveal ${introDurationMs}ms ease-in-out forwards;
        }

        :global(.atlas-intro__logo) {
          width: 100%;
          height: auto;
        }

        @keyframes logoReveal {
          0% {
            opacity: 0;
          }
          35% {
            opacity: 1;
          }
          65% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @keyframes introBackdrop {
          0% {
            opacity: 1;
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .atlas-intro__logo-wrap {
            animation-timing-function: linear;
          }
        }
      `}</style>
    </div>
  );
}
