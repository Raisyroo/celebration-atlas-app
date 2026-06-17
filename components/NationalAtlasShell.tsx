import type { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';

// Future national atlas boundary.
//
// This component is intentionally not imported by app/page.tsx yet, so it does
// not affect the current Michigan-first homepage runtime.
//
// Future role:
// - host the national U.S. map gateway
// - route Celebration Search commands across national, state, and event scopes
// - transition users from national discovery into state atlases
//
// Coverage rule:
// - this shell must never claim national completeness while Atlas coverage is
//   still partial or uneven.

interface NationalAtlasShellProps {
  children?: ReactNode;
  highlightedStateSlug?: string;
}

export default function NationalAtlasShell({ children, highlightedStateSlug }: NationalAtlasShellProps) {
  const isMichiganHighlighted = highlightedStateSlug === 'michigan';
  return (
    <section aria-label="Future national Celebration Atlas gateway" style={styles.shell}>
      <div style={styles.ambientGlow} aria-hidden="true" />
      <div style={styles.content}>
        <header style={styles.header}>
          <p style={styles.kicker}>Development Preview</p>
          <p style={styles.eyebrow}>Future National Atlas Gateway</p>
          <h1 style={styles.title}>Celebration Atlas, across America.</h1>
          <p style={styles.copy}>
            A map-first preview of the future national entry experience. Michigan is the current live state
            atlas prototype. National coverage is partial.
          </p>
        </header>

        <figure style={styles.mapStage} aria-label="Interactive preview for the future U.S. Atlas map">
          <div style={styles.mapGlow} aria-hidden="true" />
          <div style={styles.nationalMapFrame}>
            <div style={styles.nationalMapBackdrop} aria-hidden="true" />
            <div style={styles.nationalMapLandmass} aria-hidden="true" />
            <div style={styles.nationalMapWest} aria-hidden="true" />
            <div style={styles.nationalMapEast} aria-hidden="true" />
            <div style={styles.nationalMapFlorida} aria-hidden="true" />
            <div
              style={{
                ...styles.michiganPortal,
                ...(isMichiganHighlighted ? styles.michiganPortalActive : null),
              }}
              aria-label={isMichiganHighlighted ? 'Michigan highlighted on national atlas preview' : 'Michigan state portal'}
              role="img"
            >
              <span style={styles.michiganPulse} aria-hidden="true" />
              <span style={styles.michiganDot} aria-hidden="true" />
              <span style={styles.michiganLabel}>Michigan</span>
            </div>
            <div style={styles.nationalMapSignalOne} aria-hidden="true" />
            <div style={styles.nationalMapSignalTwo} aria-hidden="true" />
          </div>
          <figcaption style={styles.caption}>
            Development preview. The national visual is intentionally partial: Michigan is the available state doorway,
            and Celebration Search can emphasize Michigan or known Michigan events without changing the live prototype.
          </figcaption>
        </figure>

        <section style={styles.statePortal} aria-label="Available state atlas">
          <div style={styles.statePortalHeader}>
            <p style={styles.statePortalLabel}>Live State Atlas</p>
            <p style={styles.statePortalStatus}>Prototype available</p>
          </div>
          <div style={styles.statePortalBody}>
            <div>
              <h2 style={styles.statePortalTitle}>Michigan is the first live state atlas.</h2>
              <p style={styles.statePortalCopy}>
                Open the current Michigan prototype. More states will appear as coverage is built and verified;
                other states are not populated yet, and this national preview is not a complete U.S. event index.
              </p>
            </div>
            <Link href="/" style={styles.statePortalLink} aria-label="Open Michigan Atlas prototype">
              Open Michigan Atlas
            </Link>
          </div>
        </section>

        {children ? <div style={styles.searchSlot}>{children}</div> : null}

        <aside style={styles.honestyPanel} aria-label="National atlas coverage status">
          <p style={styles.honestyLabel}>Coverage note</p>
          <p style={styles.honestyCopy}>
            Michigan is live as the state atlas prototype, but national coverage remains partial and other states are
            not populated yet. This is not a complete U.S. event index. Celebration Search will eventually control the
            national map, but this preview does not run real AI, verify active events, or change map state.
          </p>
        </aside>
      </div>
    </section>
  );
}

export { NationalAtlasShell };
export type { NationalAtlasShellProps };

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100svh',
    width: '100%',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 50% 8%, rgba(251, 216, 157, 0.22), transparent 31%), radial-gradient(circle at 18% 34%, rgba(104, 148, 164, 0.16), transparent 30%), linear-gradient(180deg, #151e2b 0%, #101723 50%, #070d16 100%)',
    color: '#f8ead2',
    padding: 'clamp(1.15rem, 4vw, 4.5rem)',
    position: 'relative',
  },
  ambientGlow: {
    background:
      'linear-gradient(120deg, transparent 0%, rgba(255, 232, 181, 0.08) 42%, transparent 68%)',
    inset: 0,
    opacity: 0.7,
    pointerEvents: 'none',
    position: 'absolute',
  },
  content: {
    margin: '0 auto',
    maxWidth: '86rem',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    maxWidth: '62rem',
  },
  kicker: {
    color: 'rgba(255, 244, 219, 0.74)',
    fontSize: '0.72rem',
    letterSpacing: '0.2em',
    lineHeight: 1,
    margin: '0 0 1.15rem',
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: 'rgba(251, 216, 157, 0.78)',
    fontSize: '0.78rem',
    letterSpacing: '0.22em',
    margin: 0,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 'clamp(3rem, 11vw, 7.6rem)',
    fontWeight: 400,
    letterSpacing: '-0.075em',
    lineHeight: 0.88,
    margin: '0.55rem 0 1.05rem',
    maxWidth: '11ch',
  },
  copy: {
    color: 'rgba(255, 244, 219, 0.8)',
    fontSize: 'clamp(1rem, 2.4vw, 1.2rem)',
    lineHeight: 1.65,
    margin: 0,
    maxWidth: '45rem',
  },
  mapStage: {
    margin: 'clamp(2.2rem, 6vw, 4.6rem) auto 0',
    maxWidth: '80rem',
    position: 'relative',
    width: '100%',
  },
  mapFrame: {
    aspectRatio: '16 / 10',
    maxHeight: 'min(66svh, 45rem)',
    position: 'relative',
    width: '100%',
    zIndex: 1,
  },
  mapGlow: {
    background:
      'radial-gradient(circle at 50% 45%, rgba(246, 190, 119, 0.27), transparent 54%), radial-gradient(circle at 28% 32%, rgba(123, 173, 189, 0.2), transparent 32%)',
    filter: 'blur(28px)',
    inset: '-12%',
    opacity: 0.78,
    position: 'absolute',
  },
  mapImage: {
    objectFit: 'contain',
  },

  nationalMapFrame: {
    aspectRatio: '16 / 8.6',
    borderRadius: '2.4rem',
    boxShadow:
      '0 32px 95px rgba(0, 0, 0, 0.28), inset 0 0 0 1px rgba(255, 236, 196, 0.1)',
    maxHeight: 'min(62svh, 42rem)',
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
    zIndex: 1,
  },
  nationalMapBackdrop: {
    background:
      'radial-gradient(circle at 52% 42%, rgba(251, 216, 157, 0.2), transparent 46%), linear-gradient(180deg, rgba(28, 45, 63, 0.82), rgba(9, 16, 27, 0.96))',
    inset: 0,
    position: 'absolute',
  },
  nationalMapLandmass: {
    background:
      'linear-gradient(135deg, rgba(223, 179, 111, 0.68), rgba(107, 147, 128, 0.48))',
    borderRadius: '52% 48% 45% 48% / 38% 42% 50% 46%',
    filter: 'drop-shadow(0 18px 34px rgba(0, 0, 0, 0.28))',
    height: '50%',
    left: '19%',
    opacity: 0.82,
    position: 'absolute',
    top: '23%',
    transform: 'rotate(-4deg)',
    width: '62%',
  },
  nationalMapWest: {
    background: 'rgba(167, 121, 82, 0.55)',
    borderRadius: '55% 30% 45% 54% / 40% 45% 52% 46%',
    height: '48%',
    left: '13%',
    position: 'absolute',
    top: '25%',
    transform: 'rotate(-10deg)',
    width: '27%',
  },
  nationalMapEast: {
    background: 'rgba(187, 156, 99, 0.62)',
    borderRadius: '46% 58% 48% 38% / 34% 40% 62% 54%',
    height: '42%',
    left: '57%',
    position: 'absolute',
    top: '26%',
    transform: 'rotate(8deg)',
    width: '23%',
  },
  nationalMapFlorida: {
    borderBottom: '3.4rem solid rgba(187, 156, 99, 0.56)',
    borderLeft: '1.1rem solid transparent',
    borderRight: '0.55rem solid transparent',
    height: 0,
    left: '74%',
    position: 'absolute',
    top: '58%',
    transform: 'rotate(-26deg)',
    width: 0,
  },
  michiganPortal: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.45rem',
    left: '66%',
    position: 'absolute',
    top: '31%',
    transform: 'translate(-50%, -50%)',
  },
  michiganPortalActive: {
    filter: 'drop-shadow(0 0 22px rgba(251, 216, 157, 0.82))',
  },
  michiganDot: {
    background: '#fbd89d',
    border: '2px solid rgba(255, 244, 219, 0.92)',
    borderRadius: '999px',
    boxShadow: '0 0 24px rgba(251, 216, 157, 0.8)',
    display: 'block',
    height: '1rem',
    width: '1rem',
    zIndex: 2,
  },
  michiganPulse: {
    background: 'rgba(251, 216, 157, 0.22)',
    border: '1px solid rgba(251, 216, 157, 0.55)',
    borderRadius: '999px',
    height: '3.2rem',
    left: '-1.1rem',
    position: 'absolute',
    top: '-1.1rem',
    width: '3.2rem',
  },
  michiganLabel: {
    background: 'rgba(8, 13, 22, 0.58)',
    border: '1px solid rgba(251, 216, 157, 0.2)',
    borderRadius: '999px',
    color: '#fff4db',
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    padding: '0.38rem 0.58rem',
    textTransform: 'uppercase',
  },
  nationalMapSignalOne: {
    background: 'rgba(123, 173, 189, 0.22)',
    borderRadius: '999px',
    height: '7rem',
    left: '25%',
    position: 'absolute',
    top: '40%',
    width: '7rem',
  },
  nationalMapSignalTwo: {
    background: 'rgba(251, 216, 157, 0.16)',
    borderRadius: '999px',
    height: '5.5rem',
    left: '50%',
    position: 'absolute',
    top: '22%',
    width: '5.5rem',
  },
  caption: {
    color: 'rgba(255, 244, 219, 0.62)',
    fontSize: '0.78rem',
    lineHeight: 1.55,
    margin: '1rem auto 0',
    maxWidth: '48rem',
    position: 'relative',
    textAlign: 'center',
    zIndex: 1,
  },

  statePortal: {
    background:
      'linear-gradient(135deg, rgba(255, 246, 220, 0.105), rgba(255, 246, 220, 0.035))',
    borderRadius: '1.35rem',
    boxShadow:
      '0 18px 55px rgba(0, 0, 0, 0.18), inset 0 0 0 1px rgba(255, 236, 196, 0.09)',
    margin: 'clamp(1.75rem, 4.4vw, 3rem) auto 0',
    maxWidth: '54rem',
    padding: 'clamp(1rem, 3vw, 1.35rem)',
  },
  statePortalHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'space-between',
    marginBottom: '0.9rem',
  },
  statePortalLabel: {
    color: 'rgba(251, 216, 157, 0.78)',
    fontSize: '0.72rem',
    letterSpacing: '0.2em',
    margin: 0,
    textTransform: 'uppercase',
  },
  statePortalStatus: {
    border: '1px solid rgba(251, 216, 157, 0.18)',
    borderRadius: '999px',
    color: 'rgba(255, 244, 219, 0.68)',
    flex: '0 0 auto',
    fontSize: '0.68rem',
    letterSpacing: '0.12em',
    margin: 0,
    padding: '0.45rem 0.62rem',
    textTransform: 'uppercase',
  },
  statePortalBody: {
    alignItems: 'end',
    display: 'grid',
    gap: '1.1rem',
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
  statePortalTitle: {
    color: '#fff4db',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: 'clamp(1.35rem, 4vw, 2.05rem)',
    fontWeight: 400,
    letterSpacing: '-0.035em',
    lineHeight: 1.05,
    margin: 0,
  },
  statePortalCopy: {
    color: 'rgba(255, 244, 219, 0.72)',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    margin: '0.65rem 0 0',
  },
  statePortalLink: {
    background: 'rgba(251, 216, 157, 0.16)',
    border: '1px solid rgba(251, 216, 157, 0.22)',
    borderRadius: '999px',
    color: '#fff4db',
    display: 'inline-flex',
    fontSize: '0.78rem',
    justifyContent: 'center',
    letterSpacing: '0.14em',
    padding: '0.88rem 1rem',
    textDecoration: 'none',
    textTransform: 'uppercase',
  },
  searchSlot: {
    margin: 'clamp(2rem, 5vw, 3.5rem) auto 0',
    maxWidth: '54rem',
  },
  honestyPanel: {
    margin: 'clamp(1.5rem, 4vw, 2.75rem) auto 0',
    maxWidth: '54rem',
    textAlign: 'center',
  },
  honestyLabel: {
    color: 'rgba(251, 216, 157, 0.76)',
    fontSize: '0.72rem',
    letterSpacing: '0.18em',
    margin: '0 0 0.7rem',
    textTransform: 'uppercase',
  },
  honestyCopy: {
    color: 'rgba(255, 244, 219, 0.72)',
    fontSize: '0.95rem',
    lineHeight: 1.65,
    margin: 0,
  },
  missingMapNotice: {
    background: 'rgba(255, 246, 220, 0.08)',
    borderRadius: '1.25rem',
    color: 'rgba(255, 244, 219, 0.72)',
    fontSize: '0.95rem',
    lineHeight: 1.6,
    margin: 'clamp(2rem, 7vw, 5rem) auto 0',
    maxWidth: '58rem',
    padding: '1rem 1.1rem',
  },
};
