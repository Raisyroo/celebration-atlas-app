import type { CSSProperties } from 'react';
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

const nationalPreviewMapSrc = '/maps/michigan-atlas-base.webp';

export default function NationalAtlasShell() {
  return (
    <section aria-label="Future national Celebration Atlas gateway" style={styles.shell}>
      <div style={styles.kicker}>Development Preview</div>
      <div style={styles.header}>
        <p style={styles.eyebrow}>Future National Atlas Gateway</p>
        <h1 style={styles.title}>A quiet first look at the national Celebration Atlas surface.</h1>
        <p style={styles.copy}>
          National coverage is partial. This is not a complete U.S. event index, and Michigan remains the
          current canonical state atlas prototype.
        </p>
      </div>

      <figure style={styles.mapStage} aria-label="Visual preview only for the future U.S. Atlas map">
        <div style={styles.mapGlow} aria-hidden="true" />
        <div style={styles.mapFrame}>
          <Image
            src={nationalPreviewMapSrc}
            alt="Development preview map artwork for the future national Celebration Atlas gateway"
            fill
            sizes="100vw"
            style={styles.mapImage}
            priority={false}
          />
        </div>
        <figcaption style={styles.caption}>
          Visual preview only — no state clicks, stars, coordinates, clusters, search wiring, or constellation
          lines are active in this development route.
        </figcaption>
      </figure>
    </section>
  );
}

export { NationalAtlasShell };

const styles: Record<string, CSSProperties> = {
  shell: {
    minHeight: '100svh',
    width: '100%',
    overflow: 'hidden',
    background:
      'radial-gradient(circle at 50% 12%, rgba(251, 216, 157, 0.2), transparent 34%), linear-gradient(180deg, #151e2b 0%, #101723 48%, #0a111b 100%)',
    color: '#f8ead2',
    padding: 'clamp(1.25rem, 4vw, 4rem)',
  },
  kicker: {
    display: 'inline-flex',
    borderRadius: '999px',
    background: 'rgba(255, 246, 220, 0.1)',
    color: 'rgba(255, 244, 219, 0.9)',
    fontSize: '0.72rem',
    letterSpacing: '0.18em',
    lineHeight: 1,
    marginBottom: '1.5rem',
    padding: '0.6rem 0.82rem',
    textTransform: 'uppercase',
  },
  header: {
    maxWidth: '58rem',
    position: 'relative',
    zIndex: 1,
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
    fontSize: 'clamp(2.45rem, 10vw, 6.75rem)',
    fontWeight: 400,
    letterSpacing: '-0.07em',
    lineHeight: 0.88,
    margin: '0.65rem 0 1rem',
    maxWidth: '12ch',
  },
  copy: {
    color: 'rgba(255, 244, 219, 0.78)',
    fontSize: 'clamp(1rem, 2.5vw, 1.18rem)',
    lineHeight: 1.6,
    margin: 0,
    maxWidth: '43rem',
  },
  mapStage: {
    margin: 'clamp(2rem, 7vw, 5rem) auto 0',
    maxWidth: '78rem',
    position: 'relative',
    width: '100%',
  },
  mapFrame: {
    aspectRatio: '16 / 10',
    maxHeight: 'min(68svh, 46rem)',
    position: 'relative',
    width: '100%',
    zIndex: 1,
  },
  mapGlow: {
    background:
      'radial-gradient(circle at 50% 45%, rgba(246, 190, 119, 0.24), transparent 54%), radial-gradient(circle at 28% 32%, rgba(123, 173, 189, 0.18), transparent 32%)',
    filter: 'blur(26px)',
    inset: '-12%',
    opacity: 0.72,
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
    maxWidth: '46rem',
    position: 'relative',
    textAlign: 'center',
    zIndex: 1,
  },
};
