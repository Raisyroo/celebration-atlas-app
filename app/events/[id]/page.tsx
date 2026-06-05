'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ATLAS_EVENTS, type AtlasEvent } from '../../../data/events';
import InteractiveArtworkPage from '../../../components/InteractiveArtworkPage';
import AtlasAIResponseDemo from '../../../components/AtlasAIResponseDemo';
import RomeoAtlasWindowPage from '../../../components/RomeoAtlasWindowPage';

type AtlasEventWithDetail = AtlasEvent & { detailPage: NonNullable<AtlasEvent['detailPage']> };

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

function hasDetailPage(event: AtlasEvent | undefined): event is AtlasEventWithDetail {
  return Boolean(event?.detailPage);
}

function getPageTone(regionAtmosphere?: string, iconType?: string): PageTone {
  if (regionAtmosphere === 'harvest' || iconType === 'harvest') return TONES.harvest;
  if (regionAtmosphere === 'urban') return TONES.urban;
  if (regionAtmosphere === 'lakeshore' || iconType === 'waterfront') return TONES.lakeshore;
  if (regionAtmosphere === 'northwoods' || iconType === 'music') return TONES.musicNorthwoods;
  return TONES.harvest;
}

function getRelatedEvents(event: AtlasEvent): AtlasEvent[] {
  return ATLAS_EVENTS.filter((entry) => entry.id !== event.id)
    .map((entry) => {
      let score = 0;
      if (entry.category === event.category) score += 3;
      if (entry.iconType && event.iconType && entry.iconType === event.iconType) score += 2;
      if (entry.regionAtmosphere && event.regionAtmosphere && entry.regionAtmosphere === event.regionAtmosphere) score += 2;
      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ entry }) => entry)
    .slice(0, 2);
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const id = params?.id;
  const event = ATLAS_EVENTS.find((entry) => entry.id === id);

  if (event?.pageArchetype === 'livingScrapbook' && event.detailPage) {
    return (
      <InteractiveArtworkPage
        key={event.id}
        eventId={event.id}
        eventName={event.name}
        artworkSrc="/event-pages/goodells/goodells-master-page.webp"
        heroVideoSrc="/event-media/goodells/goodells-fair-intro.mp4"
        backHref={`/?event=${event.id}`}
      />
    );
  }

  if (event?.id === 'romeo-peach') {
    return (
      <RomeoAtlasWindowPage
        key={event.id}
        eventId={event.id}
        eventName={event.name}
        // Expected public asset path: /event-media/romeo/romeo-peach-memory-bg-v1.webp
        memoryImageSrc="/event-media/romeo/romeo-peach-memory-bg-v1.webp"
        introVideoSrc="/event-media/romeo/romeo-intro.mp4"
        backHref={`/?event=${event.id}`}
      />
    );
  }

  if (!hasDetailPage(event)) {
    return (
      <main style={styles.notFoundPage}>
        <Link href="/" style={styles.notFoundLink}>
          ← Back to Atlas
        </Link>
      </main>
    );
  }

  return <StandardEventDetailPage event={event} isElectricForestCinematicEntry={event.id === 'electric-forest' && searchParams.get('intro') === 'cinematic'} />;
}

function EventIntroOverlay({ introVideoSrc, onFinished }: { introVideoSrc: string; onFinished: () => void }) {
  const [isIntroFallbackVisible, setIsIntroFallbackVisible] = useState(false);
  const [isIntroMuted, setIsIntroMuted] = useState(false);
  const [showIntroUnmuteAffordance, setShowIntroUnmuteAffordance] = useState(false);
  const introVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!introVideoSrc) return;
    const introVideo = introVideoRef.current;
    if (!introVideo) return;

    introVideo.muted = false;
    const playAttempt = introVideo.play();
    if (!playAttempt) return;

    playAttempt.catch(() => {
      const fallbackVideo = introVideoRef.current;
      if (!fallbackVideo) return;
      fallbackVideo.muted = true;
      setIsIntroMuted(true);
      setShowIntroUnmuteAffordance(true);
      fallbackVideo.play().catch(() => {
        setIsIntroFallbackVisible(true);
      });
    });
  }, [introVideoSrc]);

  const handleIntroUnmute = () => {
    const introVideo = introVideoRef.current;
    if (!introVideo) return;
    introVideo.muted = false;
    setIsIntroMuted(false);
    setShowIntroUnmuteAffordance(false);
    introVideo.play().catch(() => {
      introVideo.muted = true;
      setIsIntroMuted(true);
      setShowIntroUnmuteAffordance(true);
    });
  };

  if (isIntroFallbackVisible) {
    return (
      <div style={styles.introOverlay}>
        <p style={styles.introFallbackText}>Entering event...</p>
      </div>
    );
  }

  return (
    <div style={styles.introOverlay}>
      <video
        ref={introVideoRef}
        src={introVideoSrc}
        muted={isIntroMuted}
        autoPlay
        playsInline
        controls={false}
        preload="auto"
        style={styles.introVideo}
        onError={() => {
          setIsIntroFallbackVisible(true);
        }}
        onEnded={onFinished}
      />
      {showIntroUnmuteAffordance ? (
        <button type="button" style={styles.introUnmuteButton} onClick={handleIntroUnmute}>
          Tap for sound
        </button>
      ) : null}
    </div>
  );
}

function StandardEventDetailPage({ event, isElectricForestCinematicEntry }: { event: AtlasEventWithDetail; isElectricForestCinematicEntry: boolean }) {
  const [shareStatus, setShareStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [memoryIndex, setMemoryIndex] = useState(0);
  const [memoryOpacity, setMemoryOpacity] = useState(1);
  const [isPageVisible, setIsPageVisible] = useState(false);
  const [introDismissedForEventId, setIntroDismissedForEventId] = useState<string | null>(null);

  const tone = getPageTone(event.regionAtmosphere, event.iconType);
  const relatedEvents = getRelatedEvents(event);

  const eventSnapshot = event.detailPage.eventSnapshot;
  const snapshotRows = eventSnapshot
    ? [
        { label: 'Typical month', value: eventSnapshot.typicalMonth },
        { label: 'Setting', value: eventSnapshot.setting },
        { label: 'Best for', value: eventSnapshot.bestFor },
        { label: 'Signature moment', value: eventSnapshot.signatureMoment },
      ].filter((row): row is { label: string; value: string } => Boolean(row.value))
    : [];

  const storyBlocks = event.detailPage.storySections?.length
    ? [event.detailPage.detailIntro, ...event.detailPage.storySections].filter(Boolean)
    : [event.detailPage.shortStory];
  const atlasMemories = event.atlasMemories ?? [];
  const introVideoSrc = event.detailPage.introVideoSrc ?? '';
  const isIntroVisible = isElectricForestCinematicEntry && introDismissedForEventId !== event.id;

  const localFlavorItems = (event.localFlavor ?? []).filter(Boolean).slice(0, 4);

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareStatus('copied');
    } catch {
      setShareStatus('failed');
    }
  };


  useEffect(() => {
    const revealDelay = isElectricForestCinematicEntry ? 180 : 30;
    const timer = window.setTimeout(() => setIsPageVisible(true), revealDelay);
    return () => window.clearTimeout(timer);
  }, [isElectricForestCinematicEntry]);


  useEffect(() => {
    document.documentElement.classList.add('event-detail-scroll');
    document.body.classList.add('event-detail-scroll');

    return () => {
      document.documentElement.classList.remove('event-detail-scroll');
      document.body.classList.remove('event-detail-scroll');
    };
  }, []);

  useEffect(() => {
    if (shareStatus === 'idle') return;
    const timeout = window.setTimeout(() => setShareStatus('idle'), 1800);
    return () => window.clearTimeout(timeout);
  }, [shareStatus]);

  useEffect(() => {
    if (atlasMemories.length < 2) return;
    const rotationDelayMs = 8000 + Math.floor(Math.random() * 4001);
    const timeout = window.setTimeout(() => {
      setMemoryOpacity(0);
      window.setTimeout(() => {
        setMemoryIndex((current) => (current + 1) % atlasMemories.length);
        setMemoryOpacity(1);
      }, 380);
    }, rotationDelayMs);
    return () => window.clearTimeout(timeout);
  }, [atlasMemories.length, memoryIndex]);


  return (
    <>
      {isIntroVisible && introVideoSrc ? (
        <EventIntroOverlay
          key={`${event.id}:${introVideoSrc}`}
          introVideoSrc={introVideoSrc}
          onFinished={() => {
            setIntroDismissedForEventId(event.id);
          }}
        />
      ) : null}
      <main
        className="atlas-event-shell"
        style={{
          ...styles.page,
          color: tone.pageColor,
          opacity: isPageVisible ? 1 : 0,
          transition: 'opacity 680ms ease',
        }}
      >
      <>
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


      {snapshotRows.length ? (
        <section style={{ ...styles.snapshotSection, border: tone.storyBorder, background: tone.storyBackground }} aria-label="Event snapshot">
          <p style={styles.snapshotEyebrow}>Event snapshot</p>
          <dl style={styles.snapshotGrid}>
            {snapshotRows.map((row) => (
              <div key={`${event.id}-${row.label}`} style={styles.snapshotRow}>
                <dt style={{ ...styles.snapshotLabel, color: tone.metaColor }}>{row.label}</dt>
                <dd style={styles.snapshotValue}>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section style={styles.aiPromptSection} aria-label="Suggested Atlas AI questions">
        <AtlasAIResponseDemo
          eventId={event.id}
          eventName={event.name}
          chips={[
            { id: 'priority', label: `What should I prioritize first at ${event.name}?` },
            { id: 'family-plan', label: `Give me a family-friendly plan for ${event.name}.` },
            { id: 'logistics', label: 'What should I know about timing, parking, and food?' },
          ]}
          title={`Atlas guide results for ${event.name}`}
        />
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


      {localFlavorItems.length ? (
        <section style={{ ...styles.localFlavorSection, border: tone.storyBorder, background: tone.storyBackground }} aria-label="Local flavor">
          <h2 style={{ ...styles.storyHeading, color: tone.headingColor }}>Local Flavor</h2>
          <ul style={styles.localFlavorList}>
            {localFlavorItems.map((item, index) => (
              <li key={`${event.id}-local-flavor-${index}`} style={{ ...styles.localFlavorItem, color: tone.metaColor }}>
                {item}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {event.atlasNotes?.length ? (
        <section style={{ ...styles.notesSection, border: tone.storyBorder, background: tone.storyBackground }} aria-label="Atlas notes">
          <h2 style={{ ...styles.storyHeading, color: tone.headingColor }}>Atlas Notes</h2>
          {event.atlasNotes.map((note, index) => (
            <p key={`${event.id}-atlas-note-${index}`} style={{ ...styles.notesBody, color: tone.metaColor }}>
              {note}
            </p>
          ))}
        </section>
      ) : null}

      {atlasMemories.length ? (
        <section style={{ ...styles.memorySection, border: tone.storyBorder, background: tone.storyBackground }} aria-label="Atlas memory">
          <p style={styles.memoryEyebrow}>Atlas Memory</p>
          <p style={{ ...styles.memoryExcerpt, opacity: memoryOpacity }}>{atlasMemories[memoryIndex]}</p>
        </section>
      ) : null}

      <section style={styles.shareSection} aria-label="Share discovery">
        <button type="button" onClick={handleShare} style={styles.shareButton}>
          Share this discovery
        </button>
        {shareStatus === 'copied' ? <p style={styles.shareStatus}>Link copied.</p> : null}
        {shareStatus === 'failed' ? <p style={styles.shareStatus}>Unable to copy link.</p> : null}
      </section>

      {relatedEvents.length ? (
        <section style={{ ...styles.relatedSection, border: tone.storyBorder, background: tone.storyBackground }} aria-label="Related discoveries">
          <h2 style={{ ...styles.storyHeading, color: tone.headingColor }}>Related discoveries</h2>
          <div style={styles.relatedGrid}>
            {relatedEvents.map((relatedEvent) => {
              const hasDetail = Boolean(relatedEvent.detailPage);
              const card = (
                <article style={styles.relatedCard}>
                  <p style={styles.relatedCategory}>{relatedEvent.category}</p>
                  <h3 style={styles.relatedTitle}>{relatedEvent.name}</h3>
                  <p style={styles.relatedLocation}>{relatedEvent.location}</p>
                </article>
              );

              return hasDetail ? (
                <Link key={relatedEvent.id} href={`/events/${relatedEvent.id}`} style={styles.relatedLink}>
                  {card}
                </Link>
              ) : (
                <div key={relatedEvent.id} style={styles.relatedStatic}>
                  {card}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <Link href={`/?event=${event.id}`} style={{ ...styles.backLink, color: tone.backLinkColor, borderBottom: `1px solid ${tone.backLinkColor.replace('0.9', '0.45')}` }}>
        ← Back to Atlas
      </Link>
      </>
      </main>
    </>
  );
}

const styles: Record<string, CSSProperties> = {
  introOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 250,
    background: '#040507',
  },
  introVideo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    filter: 'saturate(1.08) contrast(1.04)',
  },
  introFallbackText: {
    margin: 0,
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
    color: 'rgba(241, 246, 255, 0.86)',
    letterSpacing: '0.04em',
    fontSize: '0.95rem',
    fontWeight: 500,
    textShadow: '0 1px 4px rgba(0,0,0,0.45)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
  },
  introUnmuteButton: {
    position: 'absolute',
    right: '1rem',
    bottom: '1rem',
    border: '1px solid rgba(237, 245, 255, 0.48)',
    background: 'rgba(8, 12, 19, 0.42)',
    color: 'rgba(242, 248, 255, 0.92)',
    borderRadius: '999px',
    padding: '0.38rem 0.74rem',
    fontSize: '0.74rem',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    backdropFilter: 'blur(4px)',
  },
  notFoundPage: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(180deg, #090d15 0%, #131a25 100%)',
  },
  notFoundLink: {
    color: 'rgba(245, 219, 170, 0.92)',
    textDecoration: 'none',
    letterSpacing: '0.05em',
    borderBottom: '1px solid rgba(245, 219, 170, 0.45)',
    paddingBottom: '0.15rem',
  },
  page: {
    minHeight: '100svh',
    padding: 'clamp(1.5rem, 3.5vw, 3rem)',
    display: 'grid',
    gap: '1.25rem',
    position: 'relative',
    zIndex: 1,
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

  snapshotSection: {
    width: 'min(100%, 58rem)',
    borderRadius: '0.96rem',
    padding: '0.9rem 1.08rem',
  },
  snapshotEyebrow: {
    margin: 0,
    fontSize: '0.68rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(240, 218, 182, 0.68)',
  },
  snapshotGrid: {
    margin: '0.52rem 0 0',
    display: 'grid',
    gap: '0.55rem',
  },
  snapshotRow: {
    display: 'grid',
    gap: '0.18rem',
  },
  snapshotLabel: {
    margin: 0,
    fontSize: '0.68rem',
    letterSpacing: '0.09em',
    textTransform: 'uppercase',
  },
  aiPromptSection: {
    width: '100%',
    maxWidth: '58rem',
    border: '1px solid rgba(167, 207, 255, 0.24)',
    background: 'linear-gradient(170deg, rgba(10, 16, 26, 0.74), rgba(8, 12, 20, 0.58))',
    borderRadius: '1rem',
    padding: '0.95rem',
    display: 'grid',
    gap: '0.6rem',
  },
  aiPromptEyebrow: {
    margin: 0,
    fontSize: '0.72rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(186, 220, 253, 0.86)',
  },
  aiPromptChips: { display: 'flex', flexWrap: 'wrap', gap: '0.58rem' },
  aiPromptChip: {
    border: '1px solid rgba(158, 201, 255, 0.36)',
    background: 'rgba(20, 31, 48, 0.72)',
    color: 'rgba(229, 241, 255, 0.95)',
    padding: '0.46rem 0.7rem',
    borderRadius: '999px',
    fontSize: '0.84rem',
    cursor: 'pointer',
    textAlign: 'left',
  },
  snapshotValue: {
    margin: 0,
    lineHeight: 1.5,
    fontSize: '0.88rem',
    color: 'rgba(247, 233, 207, 0.92)',
  },
  storySection: {
    width: 'min(100%, 58rem)',
    borderRadius: '1rem',
    padding: '1.15rem 1.2rem',
  },
  storyHeading: { margin: 0, fontSize: '0.9rem', letterSpacing: '0.08em', textTransform: 'uppercase' },
  storyBody: { margin: '0.75rem 0 0', lineHeight: 1.7, color: 'rgba(245, 231, 200, 0.94)' },
  metaLine: { margin: '0.7rem 0 0', lineHeight: 1.5, fontSize: '0.92rem' },
  shareSection: {
    display: 'grid',
    gap: '0.35rem',
    width: 'fit-content',
  },
  shareButton: {
    appearance: 'none',
    border: '1px solid rgba(248, 223, 178, 0.28)',
    background: 'linear-gradient(145deg, rgba(27, 33, 49, 0.62), rgba(14, 18, 28, 0.42))',
    color: 'rgba(244, 221, 184, 0.9)',
    borderRadius: '999px',
    padding: '0.32rem 0.78rem',
    fontSize: '0.76rem',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    cursor: 'pointer',
  },
  shareStatus: {
    margin: 0,
    fontSize: '0.74rem',
    color: 'rgba(244, 221, 184, 0.75)',
    letterSpacing: '0.02em',
  },
  relatedSection: {
    width: 'min(100%, 58rem)',
    borderRadius: '1rem',
    padding: '1rem 1.2rem',
  },
  localFlavorSection: {
    width: 'min(100%, 58rem)',
    borderRadius: '1rem',
    padding: '0.95rem 1.2rem',
  },
  localFlavorList: {
    margin: '0.72rem 0 0',
    padding: '0 0 0 1.1rem',
    display: 'grid',
    gap: '0.45rem',
  },
  localFlavorItem: {
    lineHeight: 1.6,
    fontSize: '0.9rem',
    letterSpacing: '0.01em',
  },
  notesSection: {
    width: 'min(100%, 58rem)',
    borderRadius: '1rem',
    padding: '0.95rem 1.2rem',
  },
  memorySection: {
    width: 'min(100%, 58rem)',
    borderRadius: '1rem',
    padding: '0.9rem 1.2rem',
  },
  memoryEyebrow: {
    margin: 0,
    fontSize: '0.68rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(240, 218, 182, 0.68)',
  },
  memoryExcerpt: {
    margin: '0.58rem 0 0',
    lineHeight: 1.62,
    fontSize: '0.96rem',
    fontStyle: 'italic',
    color: 'rgba(245, 231, 200, 0.94)',
    letterSpacing: '0.01em',
    transition: 'opacity 380ms ease',
    minHeight: '3.2rem',
  },
  notesBody: {
    margin: '0.68rem 0 0',
    lineHeight: 1.62,
    fontSize: '0.9rem',
    fontStyle: 'italic',
    letterSpacing: '0.01em',
    opacity: 0.92,
  },
  relatedGrid: {
    display: 'grid',
    gap: '0.7rem',
    marginTop: '0.75rem',
  },
  relatedLink: { textDecoration: 'none' },
  relatedStatic: { opacity: 0.9 },
  relatedCard: {
    borderRadius: '0.8rem',
    border: '1px solid rgba(255, 222, 168, 0.16)',
    background: 'linear-gradient(160deg, rgba(19,24,37,.46), rgba(12,16,25,.28))',
    padding: '0.72rem 0.82rem',
  },
  relatedCategory: {
    margin: 0,
    fontSize: '0.68rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color: 'rgba(241, 217, 176, 0.72)',
  },
  relatedTitle: { margin: '0.22rem 0 0', fontSize: '0.96rem', color: 'rgba(248, 233, 207, 0.95)' },
  relatedLocation: { margin: '0.28rem 0 0', fontSize: '0.84rem', color: 'rgba(234, 213, 177, 0.78)' },
  backLink: {
    marginTop: '0.35rem',
    textDecoration: 'none',
    width: 'fit-content',
    paddingBottom: '0.1rem',
  },
};
