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
  const [draftQuestion, setDraftQuestion] = useState<string>('');

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
      <div style={styles.askRow}>
        <input
          type="text"
          value={draftQuestion}
          onChange={(event) => setDraftQuestion(event.target.value)}
          placeholder={`Ask AI about ${eventName}`}
          style={styles.askInput}
          aria-label="Ask AI question"
        />
        <button
          type="button"
          style={styles.askButton}
          onClick={() => {
            if (draftQuestion.trim()) setActiveQuestion(draftQuestion.trim());
          }}
        >
          Ask
        </button>
      </div>

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
    gap: '0.75rem',
    border: '1px solid rgba(110, 82, 54, 0.38)',
    borderRadius: '0.55rem',
    padding: '0.88rem 0.72rem',
    background: 'rgba(251, 241, 214, 0.72)',
  },
  eyebrow: { margin: 0, color: '#6a4a2d', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.1em' },
  heading: { margin: 0, fontSize: 'clamp(1.05rem, 4.2vw, 1.3rem)', lineHeight: 1.3, color: '#3a2515' },
  sub: { margin: 0, color: '#5b4027', fontSize: '0.88rem', lineHeight: 1.4 },
  askRow: { display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr', alignItems: 'stretch' },
  askInput: {
    border: '1px solid rgba(112, 81, 49, 0.52)',
    borderRadius: '0.45rem',
    padding: '0.76rem 0.74rem',
    fontSize: '1rem',
    color: '#3b2818',
    background: 'rgba(255, 250, 235, 0.7)',
  },
  askButton: {
    border: '1px solid rgba(98, 68, 42, 0.55)',
    borderRadius: '0.45rem',
    background: 'rgba(239, 218, 178, 0.9)',
    color: '#432b18',
    padding: '0.7rem 0.95rem',
    fontWeight: 700,
    justifySelf: 'start',
    cursor: 'pointer',
  },
  chipGrid: { display: 'grid', gap: '0.5rem' },
  chip: {
    textAlign: 'left',
    borderRadius: '0.35rem',
    border: '1px solid rgba(110, 81, 52, 0.5)',
    padding: '0.64rem 0.72rem',
    background: 'rgba(246, 228, 195, 0.85)',
    color: '#4a301d',
    fontSize: '0.95rem',
    lineHeight: 1.38,
    cursor: 'pointer',
    boxShadow: '0 1px 1px rgba(72, 45, 25, 0.12)',
  },
  question: { margin: 0, fontSize: '0.9rem', color: '#4a311f' },
  cards: { display: 'grid', gap: '0.68rem' },
};
