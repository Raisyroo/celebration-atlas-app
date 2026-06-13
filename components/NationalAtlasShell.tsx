import type { CSSProperties, ReactNode } from 'react';
import { existsSync } from 'fs';
import Image from 'next/image';

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

const nationalPreviewMapSrc = '/maps/us-atlas-preview.webp';
const nationalPreviewMapFile = 'public/maps/us-atlas-preview.webp';
const hasNationalPreviewMap = existsSync(nationalPreviewMapFile);

interface NationalAtlasShellProps {
  children?: ReactNode;
}

export default function NationalAtlasShell({ children }: NationalAtlasShellProps) {
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

        {hasNationalPreviewMap ? (
          <figure style={styles.mapStage} aria-label="Visual preview only for the future U.S. Atlas map">
            <div style={styles.mapGlow} aria-hidden="true" />
            <div style={styles.mapFrame}>
              <Image
                src={nationalPreviewMapSrc}
                alt="Development preview map artwork for the future national Celebration Atlas gateway"
                fill
                sizes="(min-width: 1024px) 92vw, 100vw"
                style={styles.mapImage}
                priority={false}
              />
            </div>
            <figcaption style={styles.caption}>
              Visual preview only. No state clicks, stars, coordinates, clusters, search wiring, or constellation
              lines are active in this development route.
            </figcaption>
          </figure>
        ) : (
          <div style={styles.missingMapNotice} role="status">
            The visual U.S. map preview is missing. Add <code>{nationalPreviewMapFile}</code> to render this
            development-only national gateway artwork.
          </div>
        )}

        {children ? <div style={styles.searchSlot}>{children}</div> : null}

        <aside style={styles.honestyPanel} aria-label="National atlas coverage status">
          <p style={styles.honestyLabel}>Coverage note</p>
          <p style={styles.honestyCopy}>
            This is not a complete U.S. event index yet. Celebration Search will eventually control the national
            map, but this preview does not run real AI, verify active events, or change map state.
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
