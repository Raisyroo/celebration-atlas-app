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

  useMemo<AtlasAIResponseCardData[]>(() => {
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
      <h2 style={styles.heading}>{title ?? `Ask the Fair Guide`}</h2>
      <div style={styles.askRow}>
        <input
          type="text"
          value={draftQuestion}
          onChange={(event) => setDraftQuestion(event.target.value)}
          placeholder={`Ask about ${eventName}`}
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
        {chips.slice(0, 3).map((chip) => (
          <button key={chip.id} type="button" onClick={() => setActiveQuestion(chip.label)} style={styles.chip}>
            {chip.label}
          </button>
        ))}
      </div>

      {activeQuestion ? <p style={styles.question}>“{activeQuestion}”</p> : null}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    width: '100%',
    display: 'grid',
    gap: '1.15rem',
    border: '1px solid rgba(197, 168, 126, 0.4)',
    borderRadius: '1.25rem',
    padding: '1.28rem 1rem 1.24rem',
    background:
      'linear-gradient(160deg, rgba(254, 248, 234, 0.44), rgba(241, 224, 194, 0.34) 55%, rgba(213, 183, 145, 0.3) 100%)',
    boxShadow:
      '0 30px 50px rgba(36, 20, 9, 0.33), 0 10px 24px rgba(84, 52, 25, 0.2), inset 0 1px 0 rgba(255, 252, 244, 0.58), 0 0 34px rgba(240, 206, 146, 0.15)',
    backdropFilter: 'blur(16px) saturate(112%)',
    WebkitBackdropFilter: 'blur(16px) saturate(112%)',
    position: 'relative',
    transform: 'translateY(-0.15rem)',
    overflow: 'hidden',
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(1.18rem, 4.5vw, 1.56rem)',
    lineHeight: 1.22,
    letterSpacing: '0.01em',
    color: '#3f2818',
    textShadow: '0 1px 1px rgba(255, 249, 236, 0.58)',
  },
  askRow: { display: 'grid', gap: '0.6rem', gridTemplateColumns: '1fr', alignItems: 'stretch' },
  askInput: {
    border: '1px solid rgba(136, 101, 69, 0.44)',
    borderRadius: '0.84rem',
    padding: '0.9rem 0.85rem',
    fontSize: '1rem',
    color: '#3b2818',
    background: 'linear-gradient(180deg, rgba(255, 252, 241, 0.74), rgba(247, 235, 210, 0.66))',
    boxShadow: 'inset 0 1px 2px rgba(111, 74, 44, 0.1)',
  },
  askButton: {
    border: '1px solid rgba(106, 77, 52, 0.52)',
    borderRadius: '0.82rem',
    background: 'linear-gradient(180deg, rgba(246, 230, 197, 0.92), rgba(223, 195, 151, 0.88))',
    color: '#432918',
    padding: '0.74rem 1.1rem',
    fontWeight: 700,
    justifySelf: 'start',
    cursor: 'pointer',
    boxShadow: '0 5px 14px rgba(84, 54, 28, 0.24), inset 0 1px 0 rgba(255, 247, 228, 0.66)',
  },
  chipGrid: { display: 'grid', gap: '0.6rem' },
  chip: {
    textAlign: 'left',
    borderRadius: '0.75rem',
    border: '1px solid rgba(125, 90, 58, 0.5)',
    padding: '0.76rem 0.84rem',
    background:
      'linear-gradient(155deg, rgba(250, 236, 208, 0.74), rgba(236, 212, 173, 0.64) 60%, rgba(228, 196, 150, 0.66))',
    color: '#4a2f1b',
    fontSize: '0.93rem',
    lineHeight: 1.42,
    cursor: 'pointer',
    boxShadow: '0 8px 16px rgba(82, 53, 29, 0.2), inset 0 1px 0 rgba(255, 247, 225, 0.62)',
  },
  question: { margin: '0.1rem 0 0', fontSize: '0.88rem', color: '#4b3321', opacity: 0.88 },
};
