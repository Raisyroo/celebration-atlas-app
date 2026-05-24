'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import AtlasAIResponseCard, { type AtlasAIResponseCardData } from './AtlasAIResponseCard';
import { getMockEventAIResponse } from '../data/eventAI';

type PromptChip = { id: string; label: string };

type AtlasAIResponseDemoProps = {
  eventId: string;
  eventName: string;
  chips: PromptChip[];
  title?: string;
};

export default function AtlasAIResponseDemo({ eventId, eventName, chips, title }: AtlasAIResponseDemoProps) {
  const [activeQuestion, setActiveQuestion] = useState<string>('');

  const cards = useMemo<AtlasAIResponseCardData[]>(() => {
    const response = getMockEventAIResponse(eventId, activeQuestion || `What should I know before visiting ${eventName}?`);
    return response.sections.map((section) => {
      const typeMap = {
        answer: 'narrative',
        checklist: 'checklist',
        itinerary: 'timeline',
        mapPreview: 'mapPreview',
        sourceConfidence: 'sourceConfidence',
      } as const;
      return { type: typeMap[section.type], lines: section.lines };
    });
  }, [activeQuestion, eventId, eventName]);

  return (
    <section style={styles.wrap} aria-label="Atlas AI response section">
      <p style={styles.eyebrow}>Atlas AI guide preview</p>
      <h2 style={styles.heading}>{title ?? `Ask about ${eventName}`}</h2>
      <p style={styles.sub}>Prompt chips trigger mock on-page answers only. No live AI, RAG, database, or API calls yet.</p>

      <div style={styles.chipGrid}>
        {chips.map((chip) => (
          <button key={chip.id} type="button" onClick={() => setActiveQuestion(chip.label)} style={styles.chip}>
            {chip.label}
          </button>
        ))}
      </div>

      {activeQuestion ? <p style={styles.question}>Asked: “{activeQuestion}”</p> : null}

      <div style={styles.cards}>
        {cards.map((card, idx) => (
          <AtlasAIResponseCard key={`${card.type}-${idx}`} card={card} />
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    width: '100%',
    display: 'grid',
    gap: '0.85rem',
    border: '1px solid rgba(163, 201, 252, 0.3)',
    borderRadius: '1.2rem',
    padding: '0.95rem',
    background: 'radial-gradient(circle at 15% 0%, rgba(121, 177, 255, 0.17), transparent 48%), linear-gradient(170deg, rgba(8, 12, 21, 0.95), rgba(6, 10, 18, 0.89))',
  },
  eyebrow: { margin: 0, color: 'rgba(177, 216, 255, 0.92)', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.12em' },
  heading: { margin: 0, fontSize: '1.1rem', lineHeight: 1.3, color: 'rgba(241, 247, 255, 0.97)' },
  sub: { margin: 0, color: 'rgba(206, 225, 248, 0.9)', fontSize: '0.9rem', lineHeight: 1.45 },
  chipGrid: { display: 'grid', gap: '0.55rem' },
  chip: {
    textAlign: 'left',
    borderRadius: '0.9rem',
    border: '1px solid rgba(176, 211, 255, 0.34)',
    padding: '0.72rem 0.82rem',
    background: 'linear-gradient(170deg, rgba(15, 24, 38, 0.88), rgba(10, 16, 28, 0.82))',
    color: 'rgba(235, 245, 255, 0.97)',
    fontSize: '0.96rem',
    lineHeight: 1.38,
    cursor: 'pointer',
  },
  question: { margin: 0, fontSize: '0.9rem', color: 'rgba(225, 239, 255, 0.94)' },
  cards: { display: 'grid', gap: '0.68rem' },
};
