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
      <p style={styles.eyebrow}>Intelligence layer</p>
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
    gap: '0.9rem',
    border: '1px solid rgba(149, 114, 74, 0.42)',
    borderRadius: '1.1rem',
    padding: '1rem 0.85rem 1.05rem',
    background:
      'linear-gradient(150deg, rgba(255, 247, 226, 0.82), rgba(238, 217, 177, 0.68) 62%, rgba(226, 200, 160, 0.58))',
    boxShadow:
      '0 26px 44px rgba(47, 26, 13, 0.28), 0 2px 12px rgba(120, 79, 44, 0.17), inset 0 1px 0 rgba(255, 253, 244, 0.68)',
    backdropFilter: 'blur(7px) saturate(108%)',
    WebkitBackdropFilter: 'blur(7px) saturate(108%)',
    position: 'relative',
    transform: 'translateY(-0.2rem)',
  },
  eyebrow: { margin: 0, color: '#7a5431', fontSize: '0.66rem', textTransform: 'uppercase', letterSpacing: '0.14em' },
  heading: { margin: 0, fontSize: 'clamp(1.1rem, 4.5vw, 1.42rem)', lineHeight: 1.25, color: '#402715', textShadow: '0 1px 0 rgba(255, 247, 230, 0.5)' },
  sub: { margin: 0, color: '#5d4128', fontSize: '0.88rem', lineHeight: 1.5 },
  askRow: { display: 'grid', gap: '0.5rem', gridTemplateColumns: '1fr', alignItems: 'stretch' },
  askInput: {
    border: '1px solid rgba(126, 90, 56, 0.58)',
    borderRadius: '0.68rem',
    padding: '0.82rem 0.78rem',
    fontSize: '1rem',
    color: '#3b2818',
    background: 'linear-gradient(180deg, rgba(255, 252, 241, 0.84), rgba(246, 235, 210, 0.82))',
    boxShadow: 'inset 0 1px 2px rgba(111, 74, 44, 0.13)',
  },
  askButton: {
    border: '1px solid rgba(107, 74, 44, 0.6)',
    borderRadius: '0.7rem',
    background: 'linear-gradient(180deg, rgba(243, 224, 186, 0.97), rgba(222, 193, 146, 0.93))',
    color: '#432918',
    padding: '0.74rem 1.05rem',
    fontWeight: 700,
    justifySelf: 'start',
    cursor: 'pointer',
    boxShadow: '0 4px 11px rgba(84, 54, 28, 0.22), inset 0 1px 0 rgba(255, 247, 228, 0.68)',
  },
  chipGrid: { display: 'grid', gap: '0.5rem' },
  chip: {
    textAlign: 'left',
    borderRadius: '0.7rem',
    border: '1px solid rgba(122, 87, 56, 0.62)',
    padding: '0.7rem 0.76rem',
    background:
      'linear-gradient(160deg, rgba(247, 231, 200, 0.9), rgba(232, 206, 165, 0.88) 66%, rgba(221, 191, 150, 0.9))',
    color: '#4a2f1b',
    fontSize: '0.93rem',
    lineHeight: 1.42,
    cursor: 'pointer',
    boxShadow: '0 6px 12px rgba(82, 53, 29, 0.18), inset 0 1px 0 rgba(255, 247, 225, 0.58)',
  },
  question: { margin: 0, fontSize: '0.9rem', color: '#4a311f' },
  cards: { display: 'grid', gap: '0.72rem' },
};
