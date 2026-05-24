'use client';

import type { CSSProperties } from 'react';

export type EventAIPlaceholderType = 'answer' | 'checklist' | 'itinerary' | 'mapPreview' | 'sourceConfidence';

type EventAIPlaceholderProps = {
  type: EventAIPlaceholderType;
  lines?: string[];
};

const PLACEHOLDER_COPY: Record<EventAIPlaceholderType, { title: string; lines: string[] }> = {
  answer: { title: 'Answer', lines: ['A clear, plain-language response appears here.', 'Concise highlights stay readable on mobile screens.'] },
  checklist: { title: 'Checklist', lines: ['• Bring weather-ready layers.', '• Confirm parking and entry timing.', '• Save one must-see moment.'] },
  itinerary: { title: 'Itinerary', lines: ['5:00 PM — Arrival + orientation', '6:30 PM — Signature event block', '8:00 PM — Food, lights, and closeout'] },
  mapPreview: { title: 'Map / Image Preview', lines: ['Preview card area for map route or image context.', 'Supports future AI-selected visual references.'] },
  sourceConfidence: { title: 'Sources & Confidence', lines: ['Source summary and freshness note.', 'Confidence indicator appears with rationale.'] },
};

export default function EventAIPlaceholder({ type, lines }: EventAIPlaceholderProps) {
  const copy = PLACEHOLDER_COPY[type];
  const contentLines = lines?.length ? lines : copy.lines;

  return (
    <section style={styles.card} aria-label={`${copy.title} placeholder`}>
      <p style={styles.kicker}>{copy.title}</p>
      {contentLines.map((line, index) => (
        <p key={`${type}-line-${index}`} style={styles.line}>
          {line}
        </p>
      ))}
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  card: { border: '1px solid rgba(181, 204, 255, 0.28)', borderRadius: '0.9rem', background: 'linear-gradient(160deg, rgba(10, 16, 28, 0.9), rgba(8, 12, 21, 0.72))', padding: '0.88rem 0.92rem' },
  kicker: { margin: 0, fontSize: '0.71rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(184, 217, 255, 0.88)' },
  line: { margin: '0.5rem 0 0', lineHeight: 1.55, fontSize: '0.88rem', color: 'rgba(230, 241, 255, 0.9)' },
};
