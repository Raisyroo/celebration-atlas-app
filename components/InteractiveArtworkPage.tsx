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
      <section style={styles.parchmentColumn} aria-label={`${eventName} memory collage`}>
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
    background:
      'radial-gradient(circle at 20% 10%, rgba(83, 53, 34, 0.34), transparent 32%), radial-gradient(circle at 80% 30%, rgba(67, 43, 28, 0.32), transparent 28%), linear-gradient(180deg, #1f130d 0%, #2b1a11 55%, #1a100b 100%)',
    color: '#3b2818',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '0 1rem 6rem',
  },
  parchmentColumn: {
    width: 'min(100%, 760px)',
    background: 'linear-gradient(180deg, rgba(248, 232, 198, 0.98), rgba(236, 210, 170, 0.97))',
    border: '1px solid rgba(150, 116, 75, 0.52)',
    borderTop: 'none',
    borderBottomLeftRadius: '0.8rem',
    borderBottomRightRadius: '0.8rem',
    boxShadow: '0 20px 35px rgba(13, 6, 4, 0.46)',
    display: 'grid',
    justifyItems: 'center',
    alignContent: 'start',
    position: 'relative',
    zIndex: 0,
    overflow: 'hidden',
    gap: '0',
  },
  artworkShell: { position: 'relative', width: '100%' },
  artworkImage: { display: 'block', width: '100%', height: 'auto' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  guideSection: {
    width: '100%',
    padding: '0.9rem 0.85rem 1.6rem',
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
