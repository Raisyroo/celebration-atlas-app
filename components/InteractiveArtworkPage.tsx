'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';

type SuggestedChip = { id: string; label: string };

type InteractiveArtworkPageProps = {
  eventName: string;
  artworkSrc: string;
  heroVideoSrc: string;
  backHref: string;
  shareUrl?: string;
  chips: SuggestedChip[];
};

export default function InteractiveArtworkPage({ eventName, artworkSrc, heroVideoSrc, backHref, shareUrl, chips }: InteractiveArtworkPageProps) {
  return (
    <main style={styles.page}>
      <div style={styles.artworkShell}>
        <img src={artworkSrc} alt={`${eventName} artwork`} style={styles.artworkImage} />

        <div style={styles.videoRegion} aria-label="Hero video region">
          <video src={heroVideoSrc} muted autoPlay loop playsInline controls style={styles.video} />
        </div>

        <Link href={backHref} style={styles.backButton} aria-label="Back to Atlas">
          Back to Atlas
        </Link>

        <button
          type="button"
          style={styles.shareButton}
          aria-label="Share"
          onClick={() => {
            const target = shareUrl ?? (typeof window !== 'undefined' ? window.location.href : '');
            if (navigator.share) {
              navigator.share({ title: eventName, url: target }).catch(() => {});
              return;
            }
            navigator.clipboard.writeText(target).catch(() => {});
          }}
        >
          Share
        </button>

        <div style={styles.askInput} role="textbox" aria-label="Ask Anything placeholder" aria-readonly>
          Ask Anything about Goodells Fair...
        </div>

        <div style={styles.chipsArea} aria-label="Suggested questions">
          {chips.map((chip) => (
            <button key={chip.id} type="button" style={styles.chip}>
              {chip.label}
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: { minHeight: '100vh', background: '#08090c', display: 'grid', placeItems: 'start center', padding: '0 0 2rem' },
  artworkShell: { position: 'relative', width: '100%', maxWidth: '760px' },
  artworkImage: { display: 'block', width: '100%', height: 'auto' },
  videoRegion: { position: 'absolute', left: '8.5%', top: '17.4%', width: '82.8%', height: '20.4%', overflow: 'hidden', borderRadius: '1.2%' },
  video: { width: '100%', height: '100%', objectFit: 'cover' },
  backButton: { position: 'absolute', left: '6.2%', top: '4.3%', fontSize: 'clamp(0.7rem, 2.8vw, 1rem)', color: 'transparent', background: 'transparent', textDecoration: 'none', width: '30%', height: '4.4%' },
  shareButton: { position: 'absolute', right: '6%', top: '4.1%', width: '19%', height: '4.6%', background: 'transparent', color: 'transparent', border: 'none', cursor: 'pointer' },
  askInput: { position: 'absolute', left: '10.1%', top: '71.2%', width: '79.4%', height: '5.4%', borderRadius: '999px', background: 'transparent', color: 'transparent' },
  chipsArea: { position: 'absolute', left: '8.8%', top: '79.1%', width: '82.4%', display: 'grid', gridTemplateColumns: '1fr', gap: '2.1%' },
  chip: { minHeight: '6.1%', border: 'none', background: 'transparent', color: 'transparent', cursor: 'pointer' },
};
