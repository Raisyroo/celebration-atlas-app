'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

type CinematicIntroProps = {
  children: ReactNode;
};

const INTRO_SEEN_KEY = 'celebration-atlas-intro-seen-v1';

export default function CinematicIntro({ children }: CinematicIntroProps) {
  const [isActive, setIsActive] = useState(false);
  const [isReducedMotion, setIsReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setIsReducedMotion(mediaQuery.matches);
    syncMotion();
    mediaQuery.addEventListener('change', syncMotion);

    const hasSeenIntro = window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
    if (!hasSeenIntro && !mediaQuery.matches) {
      setIsActive(true);
      window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
    }

    return () => mediaQuery.removeEventListener('change', syncMotion);
  }, []);

  const shouldRenderOverlay = isActive && !isReducedMotion;
  const introTimingClass = useMemo(() => (isActive ? 'atlas-intro--active' : ''), [isActive]);

  useEffect(() => {
    if (!shouldRenderOverlay) return;
    const timer = window.setTimeout(() => setIsActive(false), 3600);
    return () => window.clearTimeout(timer);
  }, [shouldRenderOverlay]);

  const finishIntro = () => {
    setIsActive(false);
  };

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
            <span className="atlas-intro__content">
              <span className="atlas-intro__emblem" aria-hidden="true">
                <Image src="/globe.svg" alt="" width={64} height={64} priority />
              </span>
              <span className="atlas-intro__title">Celebration Atlas</span>
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
          animation: introBackdrop 3.6s ease forwards;
        }

        .atlas-intro__content {
          display: grid;
          gap: 0.75rem;
          justify-items: center;
          color: rgba(255, 247, 228, 0.95);
          text-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
        }

        .atlas-intro__emblem {
          width: 3.6rem;
          height: 3.6rem;
          display: grid;
          place-items: center;
          opacity: 0;
          transform: scale(0.8);
          filter: brightness(0.92);
          animation: emblemReveal 1.2s ease forwards;
        }

        :global(.atlas-intro__emblem img) {
          width: 100%;
          height: 100%;
          opacity: 0.86;
        }

        .atlas-intro__title {
          font-size: clamp(1.1rem, 4vw, 1.45rem);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          opacity: 0;
          animation: titleReveal 1s ease 0.6s forwards;
        }

        @keyframes emblemReveal {
          from {
            opacity: 0;
            transform: scale(0.74);
          }
          to {
            opacity: 0.88;
            transform: scale(1);
          }
        }

        @keyframes titleReveal {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 0.96;
            transform: translateY(0);
          }
        }

        @keyframes introBackdrop {
          0% {
            background: rgba(0, 0, 0, 1);
            opacity: 1;
          }
          62% {
            background: rgba(0, 0, 0, 0.95);
            opacity: 1;
          }
          84% {
            background: rgba(0, 0, 0, 0.74);
            opacity: 1;
          }
          100% {
            background: rgba(0, 0, 0, 0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
