'use client';

import { useState, type CSSProperties } from 'react';

type PromptChip = { id: string; label: string };

type AtlasAIResponseDemoProps = {
  eventId?: string;
  eventName: string;
  chips: PromptChip[];
  title?: string;
  onQuestionSelect?: (question: string) => void;
};

export default function AtlasAIResponseDemo({ eventName, chips, title, onQuestionSelect }: AtlasAIResponseDemoProps) {
  const [draftQuestion, setDraftQuestion] = useState<string>('');

  return (
    <section style={styles.wrap} aria-label="Atlas AI response section">
      <h2 style={styles.heading}>{title ?? `Ask the Fair Guide`}</h2>
      <input
        type="text"
        value={draftQuestion}
        onChange={(event) => {
          const next = event.target.value;
          setDraftQuestion(next);
          if (next.trim()) onQuestionSelect?.(next.trim());
        }}
        placeholder={`Ask about ${eventName}`}
        style={styles.askInput}
        aria-label="Ask AI question"
      />

      <div style={styles.chipGrid}>
        {chips.slice(0, 3).map((chip) => (
          <button key={chip.id} type="button" onClick={() => onQuestionSelect?.(chip.label)} style={styles.chip}>
            {chip.label}
          </button>
        ))}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    width: '100%',
    display: 'grid',
    gap: '0.65rem',
  },
  heading: {
    margin: 0,
    fontSize: 'clamp(0.98rem, 3.7vw, 1.15rem)',
    lineHeight: 1.2,
    letterSpacing: '0.01em',
    color: '#3f2818',
  },
  askInput: {
    border: '1px solid rgba(136, 101, 69, 0.42)',
    borderRadius: '0.68rem',
    padding: '0.58rem 0.66rem',
    fontSize: '0.9rem',
    color: '#3b2818',
    background: 'rgba(255, 251, 241, 0.45)',
  },
  chipGrid: { display: 'grid', gap: '0.42rem' },
  chip: {
    textAlign: 'left',
    borderRadius: '0.64rem',
    border: '1px solid rgba(125, 90, 58, 0.42)',
    padding: '0.5rem 0.58rem',
    background: 'rgba(248, 233, 205, 0.4)',
    color: '#4a2f1b',
    fontSize: '0.82rem',
    lineHeight: 1.32,
    cursor: 'pointer',
  },
};
