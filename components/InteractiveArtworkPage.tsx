'use client';

import { useState, type CSSProperties } from 'react';
import Link from 'next/link';
import EventAIResult from './EventAIResult';
import { getMockEventAIResponse } from '../data/eventAI';

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
  const [activeQuestion, setActiveQuestion] = useState<string>('');

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

        <div style={styles.promptWrap}>
          <label htmlFor="goodells-question" style={styles.promptLabel}>
            Ask Atlas AI about Goodells Fair
          </label>
          <input
            id="goodells-question"
            value={activeQuestion}
            onChange={(event) => setActiveQuestion(event.target.value)}
            placeholder="Ask anything: parking, family activities, food, timing…"
            style={styles.askInput}
          />
        </div>

        <div style={styles.chipsArea} aria-label="Suggested questions">
          {chips.map((chip) => (
            <button key={chip.id} type="button" style={styles.chip} onClick={() => setActiveQuestion(chip.label)}>
              {chip.label}
            </button>
          ))}
        </div>
      </section>

      <section style={styles.resultSection}>
        <EventAIResult
          eventName={eventName}
          activeQuestion={activeQuestion || undefined}
          response={activeQuestion ? getMockEventAIResponse(eventId, activeQuestion) : undefined}
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
    display: 'grid',
    justifyItems: 'center',
    gap: '1rem',
    padding: '0 0 2rem',
  },
  heroSection: { width: '100%', display: 'grid', justifyItems: 'center' },
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
  promptWrap: { display: 'grid', gap: '0.4rem' },
  promptLabel: { fontSize: '1.1rem', lineHeight: 1.3, fontWeight: 700, letterSpacing: '0.01em', color: 'rgba(255, 220, 172, 0.98)' },
  askInput: {
    width: '100%',
    minHeight: '3.15rem',
    borderRadius: '1rem',
    border: '1px solid rgba(255, 202, 132, 0.4)',
    background: 'linear-gradient(170deg, rgba(30, 23, 17, 0.82), rgba(18, 14, 10, 0.78))',
    color: 'rgba(255, 245, 227, 0.98)',
    padding: '0.85rem 1rem',
    fontSize: '1.05rem',
  },
  chipsArea: { display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' },
  chip: {
    width: '100%',
    textAlign: 'left',
    minHeight: '3rem',
    border: '1px solid rgba(255, 202, 128, 0.38)',
    borderRadius: '0.95rem',
    background: 'linear-gradient(155deg, rgba(33, 23, 16, 0.84), rgba(20, 15, 11, 0.76))',
    color: 'rgba(255, 232, 203, 0.98)',
    padding: '0.75rem 0.9rem',
    fontSize: '1rem',
    lineHeight: 1.35,
    cursor: 'pointer',
  },
  resultSection: { width: '100%', maxWidth: '760px', padding: '0 0.8rem' },
};
