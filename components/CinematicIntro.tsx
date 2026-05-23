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
  const [showMobileDebugIntro, setShowMobileDebugIntro] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const syncMotion = () => setIsReducedMotion(mediaQuery.matches);

    syncMotion();
    setIsActive(true);
    mediaQuery.addEventListener('change', syncMotion);

    return () => mediaQuery.removeEventListener('change', syncMotion);
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px)');
    if (!mobileQuery.matches) return;

    setShowMobileDebugIntro(true);
    const timer = window.setTimeout(() => setShowMobileDebugIntro(false), 2000);
    return () => window.clearTimeout(timer);
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
      {showMobileDebugIntro ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100dvh',
            zIndex: 2147483647,
            background: '#000',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: '1.5rem',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}
        >
          INTRO TEST
        </div>
      ) : null}
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
            zIndex: 2147483000,
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
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100dvh;
          display: grid;
          place-items: center;
          background: #000;
          overflow: hidden;
          z-index: 2147483001;
          animation: introBackdrop ${introDurationMs}ms ease forwards;
        }

        .atlas-intro__veil {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at center, rgba(16, 20, 34, 0.34) 0%, rgba(0, 0, 0, 0.88) 58%, rgba(0, 0, 0, 1) 100%),
            linear-gradient(180deg, rgba(0, 0, 0, 0.74) 0%, rgba(0, 0, 0, 0.92) 100%);
          animation: veilLift ${introDurationMs}ms ease forwards;
        }

        .atlas-intro__logo-wrap {
          position: relative;
          width: min(76vw, 460px);
          opacity: 0;
          transform: scale(0.976);
          filter: brightness(0.84);
          animation: logoReveal ${introDurationMs}ms cubic-bezier(0.2, 0.7, 0.16, 1) forwards;
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

        @media (prefers-reduced-motion: reduce) {
          .atlas-intro__logo-wrap {
            animation-timing-function: ease-out;
          }

          @keyframes logoReveal {
            0% {
              opacity: 0;
              transform: scale(0.992);
              filter: brightness(0.9);
            }
            30% {
              opacity: 0.95;
              transform: scale(1);
            }
            100% {
              opacity: 0;
              transform: scale(1);
              filter: brightness(1);
            }
          }

          @keyframes introBackdrop {
            0% {
              background: rgba(0, 0, 0, 1);
              opacity: 1;
            }
            70% {
              background: rgba(0, 0, 0, 0.86);
              opacity: 1;
            }
            100% {
              background: rgba(0, 0, 0, 0);
              opacity: 0;
            }
          }

          @keyframes veilLift {
            0% {
              opacity: 0.92;
            }
            100% {
              opacity: 0;
            }
          }
        }
      `}</style>
    </div>
  );
}
