'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import AtlasAIResponseDemo from './AtlasAIResponseDemo';
import AtlasAIResponseCard, { type AtlasAIResponseCardData } from './AtlasAIResponseCard';
import { getMockEventAIResponse } from '../data/eventAI';

type SuggestedChip = { id: string; label: string };

type InteractiveArtworkPageProps = {
  eventId: string;
  eventName: string;
  artworkSrc: string;
  heroVideoSrc: string;
  backHref: string;
  chips: SuggestedChip[];
};

export default function InteractiveArtworkPage({ eventId, eventName, artworkSrc, heroVideoSrc, backHref, chips }: InteractiveArtworkPageProps) {
  const [activeQuestion, setActiveQuestion] = useState('');

  useEffect(() => {
    document.documentElement.classList.add('event-detail-scroll');
    document.body.classList.add('event-detail-scroll');

    return () => {
      document.documentElement.classList.remove('event-detail-scroll');
      document.body.classList.remove('event-detail-scroll');
    };
  }, []);

  const responseCards = useMemo<AtlasAIResponseCardData[]>(() => {
    if (!activeQuestion) return [];
    const response = getMockEventAIResponse(eventId, activeQuestion);
    const typeMap = {
      answer: 'narrative',
      checklist: 'checklist',
      itinerary: 'timeline',
      mapPreview: 'mapPreview',
      sourceConfidence: 'sourceConfidence',
    } as const;

    return response.sections.map((section) => ({ type: typeMap[section.type], lines: section.lines }));
  }, [activeQuestion, eventId]);

  return (
    <main style={styles.page}>
      <section style={styles.parchmentColumn} aria-label={`${eventName} memory collage`}>
        <div style={styles.artworkShell}>
          <img src={artworkSrc} alt={`${eventName} scrapbook artwork`} style={styles.artworkImage} />

          <div style={styles.videoRegion} aria-label="Hero video region">
            <video src={heroVideoSrc} muted autoPlay loop playsInline controls style={styles.video} />
          </div>

          <Link href={backHref} style={styles.topBackLink}>
            ← Back to Atlas
          </Link>

          <section style={styles.overlayGuideCard} aria-label={`${eventName} AI guide`}>
            <AtlasAIResponseDemo
              eventName={eventName}
              chips={chips}
              title="Ask the Fair Guide"
              onQuestionSelect={setActiveQuestion}
            />
          </section>
        </div>

        {activeQuestion ? (
          <section style={styles.resultsSection} aria-label="AI guide results">
            <p style={styles.activeQuestion}>“{activeQuestion}”</p>
            <div style={styles.responseStack}>
              {responseCards.map((card, index) => (
                <AtlasAIResponseCard key={`${card.type}-${index}`} card={card} />
              ))}
            </div>
          </section>
        ) : null}
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
  topBackLink: {
    position: 'absolute',
    top: '0.6rem',
    left: '0.65rem',
    zIndex: 2,
    textDecoration: 'none',
    color: 'rgba(61, 39, 22, 0.85)',
    background: 'rgba(248, 233, 205, 0.64)',
    border: '1px solid rgba(128, 95, 63, 0.3)',
    borderRadius: '999px',
    padding: '0.28rem 0.58rem',
    fontSize: '0.74rem',
    letterSpacing: '0.02em',
    backdropFilter: 'blur(1.5px)',
  },
  overlayGuideCard: {
    position: 'absolute',
    left: '8%',
    width: '84%',
    top: '72%',
    zIndex: 2,
    border: '1px solid rgba(165, 126, 86, 0.4)',
    borderRadius: '1rem',
    padding: '0.78rem 0.7rem',
    background: 'rgba(245, 219, 166, 0.55)',
    boxShadow: '0 10px 18px rgba(53, 31, 16, 0.18)',
  },
  resultsSection: {
    width: '100%',
    padding: '0.85rem 0.75rem 1.8rem',
    display: 'grid',
    gap: '0.6rem',
  },
  activeQuestion: { margin: 0, fontSize: '0.9rem', color: '#4b3321', opacity: 0.9 },
  responseStack: { display: 'grid', gap: '0.65rem' },
};
