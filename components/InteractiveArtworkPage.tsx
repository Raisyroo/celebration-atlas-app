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

          <AtlasAIResponseDemo
            eventId={eventId}
            eventName={eventName}
            chips={chips}
            title={`Atlas field guide for ${eventName}`}
          />
        </section>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#1c120c',
    color: '#3b2818',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
    padding: '0 0 6rem',
  },
  heroSection: { width: '100%', display: 'grid', justifyItems: 'center', alignContent: 'start', position: 'relative', zIndex: 0, gap: '1.25rem' },
  artworkShell: { position: 'relative', width: '100%', maxWidth: '760px' },
  artworkImage: { display: 'block', width: '100%', height: 'auto' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  guideSection: {
    width: 'min(86%, 640px)',
    padding: '1rem',
    marginTop: '0.4rem',
    borderRadius: '0.85rem',
    border: '1px solid rgba(142, 107, 71, 0.55)',
    background: 'linear-gradient(165deg, rgba(248, 231, 196, 0.93), rgba(232, 206, 167, 0.9))',
    boxShadow: '0 16px 30px rgba(22, 11, 7, 0.42)',
    display: 'grid',
    gap: '0.9rem',
  },
  actionRow: { display: 'flex', gap: '0.7rem', flexWrap: 'wrap' },
  backButton: {
    textDecoration: 'none',
    padding: '0.72rem 0.92rem',
    borderRadius: '0.45rem',
    border: '1px solid rgba(103, 76, 50, 0.55)',
    background: 'rgba(251, 239, 209, 0.68)',
    color: '#4e331d',
    fontSize: '0.95rem',
    fontWeight: 600,
    boxShadow: '0 1px 1px rgba(61, 36, 19, 0.16)',
  },
  shareButton: {
    padding: '0.72rem 0.92rem',
    borderRadius: '0.45rem',
    border: '1px solid rgba(103, 76, 50, 0.55)',
    background: 'rgba(251, 239, 209, 0.72)',
    color: '#4e331d',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 1px 1px rgba(61, 36, 19, 0.16)',
  },
};
