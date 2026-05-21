import type { CSSProperties } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ATLAS_EVENTS } from '../../../data/events';

type PageTone = {
  pageBackground: string;
  pageColor: string;
  kickerColor: string;
  locationColor: string;
  atmosphereColor: string;
  panelBorder: string;
  panelBackground: string;
  panelShadow: string;
  frameBorder: string;
  storyBackground: string;
  storyBorder: string;
  headingColor: string;
  metaColor: string;
  backLinkColor: string;
};

const TONES: Record<'harvest' | 'musicNorthwoods' | 'urban' | 'lakeshore', PageTone> = {
  harvest: {
    pageBackground:
      'radial-gradient(circle at 18% 10%, rgba(255, 177, 109, 0.21), transparent 44%), radial-gradient(circle at 78% 0%, rgba(218, 140, 79, 0.13), transparent 50%), linear-gradient(180deg, #0a0d15 0%, #101620 48%, #171c26 100%)',
    pageColor: 'rgba(251, 236, 205, 0.96)',
    kickerColor: 'rgba(255, 212, 145, 0.8)',
    locationColor: 'rgba(251, 223, 167, 0.88)',
    atmosphereColor: 'rgba(245, 223, 181, 0.92)',
    panelBorder: '1px solid rgba(255, 209, 137, 0.3)',
    panelBackground: 'linear-gradient(150deg, rgba(24, 28, 39, 0.75), rgba(14, 17, 27, 0.63))',
    panelShadow: '0 22px 44px rgba(0,0,0,.4)',
    frameBorder: '1px solid rgba(255, 216, 160, 0.24)',
    storyBackground: 'linear-gradient(160deg, rgba(20,25,35,.72), rgba(12,16,24,.56))',
    storyBorder: '1px solid rgba(255, 206, 133, 0.18)',
    headingColor: 'rgba(255, 211, 140, 0.88)',
    metaColor: 'rgba(255, 218, 166, 0.84)',
    backLinkColor: 'rgba(255, 211, 140, 0.9)',
  },
  musicNorthwoods: {
    pageBackground:
      'radial-gradient(circle at 16% 7%, rgba(94, 144, 205, 0.19), transparent 42%), radial-gradient(circle at 82% 0%, rgba(82, 156, 133, 0.14), transparent 48%), linear-gradient(180deg, #070d16 0%, #0a1620 50%, #0d1f25 100%)',
    pageColor: 'rgba(225, 238, 249, 0.96)',
    kickerColor: 'rgba(165, 208, 243, 0.82)',
    locationColor: 'rgba(181, 223, 235, 0.9)',
    atmosphereColor: 'rgba(200, 230, 236, 0.93)',
    panelBorder: '1px solid rgba(141, 199, 229, 0.3)',
    panelBackground: 'linear-gradient(150deg, rgba(13, 24, 38, 0.76), rgba(9, 18, 30, 0.64))',
    panelShadow: '0 22px 44px rgba(0, 14, 22, .46)',
    frameBorder: '1px solid rgba(157, 211, 226, 0.25)',
    storyBackground: 'linear-gradient(160deg, rgba(12,28,40,.72), rgba(8,20,28,.57))',
    storyBorder: '1px solid rgba(145, 201, 218, 0.2)',
    headingColor: 'rgba(167, 219, 236, 0.9)',
    metaColor: 'rgba(188, 225, 237, 0.84)',
    backLinkColor: 'rgba(167, 218, 238, 0.9)',
  },
  urban: {
    pageBackground:
      'radial-gradient(circle at 20% 12%, rgba(255, 171, 104, 0.18), transparent 43%), radial-gradient(circle at 84% 0%, rgba(255, 194, 121, 0.09), transparent 50%), linear-gradient(180deg, #0b0f17 0%, #121725 50%, #171e2b 100%)',
    pageColor: 'rgba(245, 234, 213, 0.96)',
    kickerColor: 'rgba(250, 205, 139, 0.78)',
    locationColor: 'rgba(244, 220, 183, 0.88)',
    atmosphereColor: 'rgba(241, 221, 190, 0.91)',
    panelBorder: '1px solid rgba(247, 202, 135, 0.27)',
    panelBackground: 'linear-gradient(150deg, rgba(22, 27, 41, 0.75), rgba(14, 18, 28, 0.64))',
    panelShadow: '0 22px 44px rgba(8, 8, 12, .44)',
    frameBorder: '1px solid rgba(247, 210, 155, 0.22)',
    storyBackground: 'linear-gradient(160deg, rgba(19,24,37,.72), rgba(12,16,25,.57))',
    storyBorder: '1px solid rgba(241, 198, 134, 0.18)',
    headingColor: 'rgba(247, 206, 141, 0.87)',
    metaColor: 'rgba(243, 213, 170, 0.83)',
    backLinkColor: 'rgba(248, 207, 141, 0.9)',
  },
  lakeshore: {
    pageBackground:
      'radial-gradient(circle at 15% 8%, rgba(137, 188, 245, 0.2), transparent 45%), radial-gradient(circle at 83% 0%, rgba(121, 181, 231, 0.13), transparent 52%), linear-gradient(180deg, #07101a 0%, #0a1a28 50%, #0f2432 100%)',
    pageColor: 'rgba(227, 240, 251, 0.96)',
    kickerColor: 'rgba(172, 211, 244, 0.82)',
    locationColor: 'rgba(188, 223, 246, 0.9)',
    atmosphereColor: 'rgba(200, 229, 246, 0.93)',
    panelBorder: '1px solid rgba(152, 203, 241, 0.3)',
    panelBackground: 'linear-gradient(150deg, rgba(12, 24, 38, 0.76), rgba(8, 18, 30, 0.64))',
    panelShadow: '0 22px 44px rgba(0, 16, 28, .44)',
    frameBorder: '1px solid rgba(170, 215, 243, 0.24)',
    storyBackground: 'linear-gradient(160deg, rgba(10,26,40,.72), rgba(8,18,30,.57))',
    storyBorder: '1px solid rgba(157, 205, 239, 0.2)',
    headingColor: 'rgba(173, 218, 243, 0.9)',
    metaColor: 'rgba(195, 227, 245, 0.84)',
    backLinkColor: 'rgba(173, 219, 243, 0.9)',
  },
};

function getPageTone(regionAtmosphere?: string, iconType?: string): PageTone {
  if (regionAtmosphere === 'harvest' || iconType === 'harvest') return TONES.harvest;
  if (regionAtmosphere === 'urban') return TONES.urban;
  if (regionAtmosphere === 'lakeshore' || iconType === 'waterfront') return TONES.lakeshore;
  if (regionAtmosphere === 'northwoods' || iconType === 'music') return TONES.musicNorthwoods;
  return TONES.harvest;
}

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

  const tone = getPageTone(event.regionAtmosphere, event.iconType);

  const storyBlocks = event.detailPage.storySections?.length
    ? [event.detailPage.detailIntro, ...event.detailPage.storySections].filter(Boolean)
    : [event.detailPage.shortStory];

  return (
    <main style={{ ...styles.page, color: tone.pageColor, background: tone.pageBackground }}>
      <section style={styles.hero}>
        <p style={{ ...styles.kicker, color: tone.kickerColor }}>Event Atlas</p>
        <h1 style={styles.title}>{event.name}</h1>
        <p style={{ ...styles.location, color: tone.locationColor }}>{event.location}</p>
        <p style={{ ...styles.atmosphere, color: tone.atmosphereColor }}>{event.detailPage.atmosphereLine ?? event.atmosphereLabel}</p>
      </section>

      <section style={{ ...styles.mediaSection, border: tone.panelBorder, background: tone.panelBackground, boxShadow: tone.panelShadow }} aria-label="Event poster and media">
        <div style={{ ...styles.mediaFrame, border: tone.frameBorder }}>
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

      <section style={{ ...styles.storySection, background: tone.storyBackground, border: tone.storyBorder }}>
        <h2 style={{ ...styles.storyHeading, color: tone.headingColor }}>Story</h2>
        {storyBlocks.map((storyBlock, index) => (
          <p key={`${event.id}-story-${index}`} style={styles.storyBody}>
            {storyBlock}
          </p>
        ))}
        {event.detailPage.archivalNote ? <p style={{ ...styles.metaLine, color: tone.metaColor }}>Archival note: {event.detailPage.archivalNote}</p> : null}
        {event.detailPage.visitorMood ? <p style={{ ...styles.metaLine, color: tone.metaColor }}>Visitor mood: {event.detailPage.visitorMood}</p> : null}
      </section>

      <Link href="/" style={{ ...styles.backLink, color: tone.backLinkColor, borderBottom: `1px solid ${tone.backLinkColor.replace('0.9', '0.45')}` }}>
        ← Back to Atlas
      </Link>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
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
  },
  title: { margin: '0.4rem 0 0', fontSize: 'clamp(2rem, 6vw, 4rem)', lineHeight: 1.04 },
  location: { margin: '0.65rem 0 0', fontSize: '1rem', letterSpacing: '0.04em' },
  atmosphere: { margin: '0.75rem 0 0', fontSize: '1.02rem' },
  mediaSection: {
    width: 'min(100%, 58rem)',
    borderRadius: '1.2rem',
    backdropFilter: 'blur(5px)',
    padding: '0.75rem',
  },
  mediaFrame: {
    position: 'relative',
    borderRadius: '0.9rem',
    overflow: 'hidden',
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
    borderRadius: '1rem',
    padding: '1.15rem 1.2rem',
  },
  storyHeading: { margin: 0, fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  storyBody: { margin: '0.75rem 0 0', lineHeight: 1.7, color: 'rgba(245, 231, 200, 0.94)' },
  metaLine: { margin: '0.7rem 0 0', lineHeight: 1.5, fontSize: '0.92rem' },
  backLink: {
    marginTop: '0.35rem',
    textDecoration: 'none',
    width: 'fit-content',
    paddingBottom: '0.1rem',
  },
};
