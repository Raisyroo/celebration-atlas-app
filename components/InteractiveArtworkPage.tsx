'use client';

import { useEffect, type CSSProperties } from 'react';
import Link from 'next/link';
import AtlasAIResponseDemo from './AtlasAIResponseDemo';

type SuggestedChip = { id: string; label: string };

type InteractiveArtworkPageProps = {
  eventId: string;
  eventName: string;
  artworkSrc: string;
  heroVideoSrc: string;
  backHref: string;
  shareUrl?: string;
  chips: SuggestedChip[];
};

export default function InteractiveArtworkPage({ eventId, eventName, artworkSrc, heroVideoSrc, backHref, shareUrl, chips }: InteractiveArtworkPageProps) {
  useEffect(() => {
    document.documentElement.classList.add('event-detail-scroll');
    document.body.classList.add('event-detail-scroll');

    return () => {
      document.documentElement.classList.remove('event-detail-scroll');
      document.body.classList.remove('event-detail-scroll');
    };
  }, []);

  return (
    <main style={styles.page}>
      <section style={styles.heroSection} aria-label={`${eventName} memory collage`}>
        <div style={styles.artworkShell}>
          <img src={artworkSrc} alt={`${eventName} scrapbook artwork`} style={styles.artworkImage} />

          <div style={styles.videoRegion} aria-label="Hero video region">
            <video src={heroVideoSrc} muted autoPlay loop playsInline controls style={styles.video} />
          </div>
        </div>
      </section>

      <section style={styles.guideSection} aria-label={`${eventName} AI guide`}>
        <div style={styles.actionRow}>
          <Link href={backHref} style={styles.backButton}>
            ← Back to Atlas
          </Link>

          <button
            type="button"
            style={styles.shareButton}
            onClick={() => {
              const target = shareUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
              if (navigator.share) {
                navigator.share({ title: eventName, url: target }).catch(() => {});
                return;
              }
              navigator.clipboard.writeText(target).catch(() => {});
            }}
          >
            Share memory
          </button>
        </div>

      </section>

      <section style={styles.resultSection}>
        <AtlasAIResponseDemo
          eventId={eventId}
          eventName={eventName}
          chips={chips}
          title={`Atlas field guide for ${eventName}`}
        />
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 10% 0%, rgba(255, 200, 138, 0.12), transparent 45%), #08090c',
    color: 'rgba(250, 238, 217, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '0 0 6rem',
  },
  heroSection: { width: '100%', display: 'grid', justifyItems: 'center', position: 'relative', zIndex: 0 },
  artworkShell: { position: 'relative', width: '100%', maxWidth: '760px' },
  artworkImage: { display: 'block', width: '100%', height: 'auto' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  guideSection: {
    width: 'min(100%, 760px)',
    marginTop: '0.2rem',
    padding: '0 0.9rem',
    display: 'grid',
    gap: '0.9rem',
    position: 'relative',
    zIndex: 1,
  },
  actionRow: { display: 'flex', gap: '0.7rem', flexWrap: 'wrap' },
  backButton: {
    textDecoration: 'none',
    padding: '0.8rem 1rem',
    borderRadius: '999px',
    border: '1px solid rgba(255, 206, 140, 0.45)',
    background: 'linear-gradient(180deg, rgba(73, 40, 19, 0.5), rgba(28, 20, 13, 0.7))',
    color: 'rgba(255, 231, 196, 0.98)',
    fontSize: '1rem',
    fontWeight: 600,
  },
  shareButton: {
    padding: '0.8rem 1rem',
    borderRadius: '999px',
    border: '1px solid rgba(255, 200, 125, 0.45)',
    background: 'linear-gradient(180deg, rgba(95, 55, 25, 0.52), rgba(30, 19, 12, 0.72))',
    color: 'rgba(255, 232, 197, 0.98)',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  resultSection: {
    width: '100%',
    maxWidth: '760px',
    padding: '0 0.8rem 3.5rem',
    position: 'relative',
    zIndex: 1,
  },
};
