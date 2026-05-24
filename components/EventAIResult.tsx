'use client';

import type { CSSProperties } from 'react';
import EventAIPlaceholder, { type EventAIPlaceholderType } from './EventAIPlaceholder';

export type EventAIResponseSection = {
  type: EventAIPlaceholderType;
  lines: string[];
};

export type EventAIResponse = {
  question: string;
  sections: EventAIResponseSection[];
};

type EventAIResultProps = {
  eventName: string;
  activeQuestion?: string;
  response?: EventAIResponse;
};

const ORDERED_TYPES: EventAIPlaceholderType[] = ['answer', 'checklist', 'itinerary', 'mapPreview', 'sourceConfidence'];

export default function EventAIResult({ eventName, activeQuestion, response }: EventAIResultProps) {
  return (
    <section style={styles.wrap} aria-label="Universal AI result panel">
      <header style={styles.header}>
        <p style={styles.eyebrow}>Atlas AI result preview</p>
        <h2 style={styles.title}>Universal answer structure for {eventName}</h2>
        <p style={styles.subtitle}>Placeholder-only UI. No live model, retrieval, or database wiring yet.</p>
        {activeQuestion ? <p style={styles.question}>Asked: “{activeQuestion}”</p> : null}
      </header>

      <div style={styles.stack}>
        {ORDERED_TYPES.map((type) => {
          const sectionLines = response?.sections.find((section) => section.type === type)?.lines;
          return <EventAIPlaceholder key={type} type={type} lines={sectionLines} />;
        })}
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  wrap: {
    width: 'min(100%, 58rem)',
    border: '1px solid rgba(159, 196, 255, 0.3)',
    borderRadius: '1.05rem',
    padding: '1rem',
    background:
      'radial-gradient(circle at 12% 0%, rgba(120, 170, 255, 0.16), transparent 50%), linear-gradient(170deg, rgba(9, 14, 24, 0.9), rgba(8, 12, 19, 0.8))',
    boxShadow: '0 18px 34px rgba(0, 0, 0, 0.28)',
    display: 'grid',
    gap: '0.85rem',
  },
  header: { display: 'grid', gap: '0.32rem' },
  eyebrow: { margin: 0, fontSize: '0.7rem', letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(170, 210, 255, 0.88)' },
  title: { margin: 0, fontSize: '1.1rem', lineHeight: 1.35, color: 'rgba(240, 247, 255, 0.96)' },
  subtitle: { margin: 0, color: 'rgba(205, 223, 246, 0.88)', fontSize: '0.88rem', lineHeight: 1.45 },
  question: { margin: '0.1rem 0 0', color: 'rgba(220, 236, 255, 0.95)', fontSize: '0.9rem', lineHeight: 1.4 },
  stack: { display: 'grid', gap: '0.68rem' },
};
