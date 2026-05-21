import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ATLAS_EVENTS } from '../../../data/events';

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = ATLAS_EVENTS.find((entry) => entry.id === id);

  if (!event || !event.detailPage) {
    notFound();
  }

  const storyBlocks = event.detailPage.storySections?.length
    ? [event.detailPage.detailIntro, ...event.detailPage.storySections].filter(Boolean)
    : [event.detailPage.shortStory];

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <p style={styles.kicker}>Event Atlas</p>
        <h1 style={styles.title}>{event.name}</h1>
        <p style={styles.location}>{event.location}</p>
        <p style={styles.atmosphere}>{event.detailPage.atmosphereLine ?? event.atmosphereLabel}</p>
      </section>

      <section style={styles.mediaSection} aria-label="Event poster and media">
        <div style={styles.mediaFrame}>
          {event.detailPage.mediaType === 'video' && event.detailPage.mediaSrc ? (
            <video src={event.detailPage.mediaSrc} muted autoPlay loop playsInline style={styles.media} />
          ) : null}
          {event.detailPage.posterSrc ? <img src={event.detailPage.posterSrc} alt={`${event.name} poster`} style={styles.media} /> : null}
          <div style={styles.mediaVignette} aria-hidden="true" />
          <div style={styles.mediaGlow} aria-hidden="true" />
        </div>
        <div style={styles.mediaCaptionRow}>
          <p style={styles.mediaEyebrow}>Cinematic archive</p>
          <p style={styles.mediaMeta}>{event.detailPage.atmosphereLine ?? event.atmosphereLabel}</p>
        </div>
      </section>

      <section style={styles.storySection}>
        <h2 style={styles.storyHeading}>Story</h2>
        {storyBlocks.map((storyBlock, index) => (
          <p key={`${event.id}-story-${index}`} style={styles.storyBody}>
            {storyBlock}
          </p>
        ))}
        {event.detailPage.archivalNote ? <p style={styles.metaLine}>Archival note: {event.detailPage.archivalNote}</p> : null}
        {event.detailPage.visitorMood ? <p style={styles.metaLine}>Visitor mood: {event.detailPage.visitorMood}</p> : null}
      </section>

      <Link href="/" style={styles.backLink}>
        ← Back to Atlas
      </Link>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    color: 'rgba(250, 238, 212, 0.96)',
    background:
      'radial-gradient(circle at 18% 10%, rgba(255, 170, 94, 0.24), transparent 44%), radial-gradient(circle at 78% 0%, rgba(226, 148, 84, 0.14), transparent 50%), linear-gradient(180deg, #090c13 0%, #0b1019 48%, #101723 100%)',
    padding: 'clamp(1.5rem, 3.5vw, 3rem)',
    display: 'grid',
    gap: '1.25rem',
  },
  hero: { maxWidth: '52rem' },
  kicker: {
    margin: 0,
    textTransform: 'uppercase',
    letterSpacing: '0.16em',
    fontSize: '0.72rem',
    color: 'rgba(255, 214, 154, 0.8)',
  },
  title: { margin: '0.4rem 0 0', fontSize: 'clamp(2rem, 6vw, 4rem)', lineHeight: 1.04 },
  location: { margin: '0.65rem 0 0', color: 'rgba(255, 227, 175, 0.88)', fontSize: '1rem', letterSpacing: '0.04em' },
  atmosphere: { margin: '0.75rem 0 0', fontSize: '1.02rem', color: 'rgba(246, 226, 188, 0.92)' },
  mediaSection: {
    width: 'min(100%, 58rem)',
    border: '1px solid rgba(255, 214, 152, 0.3)',
    borderRadius: '1.2rem',
    background: 'linear-gradient(150deg, rgba(18, 24, 36, 0.75), rgba(11, 16, 27, 0.63))',
    boxShadow: '0 22px 44px rgba(0,0,0,.42)',
    backdropFilter: 'blur(5px)',
    padding: '0.75rem',
  },
  mediaFrame: {
    position: 'relative',
    borderRadius: '0.9rem',
    overflow: 'hidden',
    border: '1px solid rgba(255, 224, 172, 0.24)',
    background: 'rgba(7, 10, 16, 0.72)',
  },
  media: { display: 'block', width: '100%', aspectRatio: '16 / 9', objectFit: 'cover' },
  mediaVignette: {
    position: 'absolute',
    inset: 0,
    background:
      'radial-gradient(circle at 50% 45%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.34) 100%), linear-gradient(180deg, rgba(8, 11, 18, 0.05), rgba(7, 10, 16, 0.42))',
    pointerEvents: 'none',
  },
  mediaGlow: {
    position: 'absolute',
    inset: 0,
    boxShadow: 'inset 0 0 0 1px rgba(255, 221, 171, 0.24), inset 0 -70px 90px rgba(0, 0, 0, 0.35)',
    pointerEvents: 'none',
  },
  mediaCaptionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.8rem',
    flexWrap: 'wrap',
    padding: '0.72rem 0.35rem 0.2rem',
  },
  mediaEyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    textTransform: 'uppercase',
    letterSpacing: '0.14em',
    color: 'rgba(255, 217, 151, 0.76)',
  },
  mediaMeta: { margin: 0, fontSize: '0.88rem', color: 'rgba(248, 230, 191, 0.84)' },
  storySection: {
    width: 'min(100%, 58rem)',
    background: 'linear-gradient(160deg, rgba(16,22,33,.72), rgba(11,16,25,.56))',
    border: '1px solid rgba(255, 212, 140, 0.18)',
    borderRadius: '1rem',
    padding: '1.15rem 1.2rem',
  },
  storyHeading: { margin: 0, fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255, 213, 142, 0.88)' },
  storyBody: { margin: '0.75rem 0 0', lineHeight: 1.7, color: 'rgba(245, 231, 200, 0.94)' },
  metaLine: { margin: '0.7rem 0 0', lineHeight: 1.5, color: 'rgba(255, 220, 171, 0.84)', fontSize: '0.92rem' },
  backLink: {
    marginTop: '0.35rem',
    color: 'rgba(255, 214, 145, 0.9)',
    textDecoration: 'none',
    width: 'fit-content',
    borderBottom: '1px solid rgba(255, 214, 145, 0.45)',
    paddingBottom: '0.1rem',
  },
};
