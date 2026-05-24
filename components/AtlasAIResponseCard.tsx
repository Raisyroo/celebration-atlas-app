'use client';

import type { CSSProperties } from 'react';

export type AtlasAIResponseCardType = 'narrative' | 'checklist' | 'timeline' | 'mapPreview' | 'sourceConfidence';

export type AtlasAIResponseCardData = {
  type: AtlasAIResponseCardType;
  title?: string;
  lines: string[];
  badge?: string;
};

type AtlasAIResponseCardProps = {
  card: AtlasAIResponseCardData;
};

const DEFAULT_TITLES: Record<AtlasAIResponseCardType, string> = {
  narrative: 'Narrative Answer',
  checklist: 'Checklist',
  timeline: 'Itinerary / Timeline',
  mapPreview: 'Map / Image Preview',
  sourceConfidence: 'Sources & Confidence',
};

export default function AtlasAIResponseCard({ card }: AtlasAIResponseCardProps) {
  const title = card.title ?? DEFAULT_TITLES[card.type];

  return (
    <article style={styles.card} aria-label={title}>
      <header style={styles.header}>
        <p style={styles.title}>{title}</p>
        {card.badge ? <span style={styles.badge}>{card.badge}</span> : null}
      </header>
      <div style={styles.body}>
        {card.lines.map((line, idx) => (
          <p key={`${card.type}-${idx}`} style={styles.line}>
            {line}
          </p>
        ))}
      </div>
    </article>
  );
}

const styles: Record<string, CSSProperties> = {
  card: {
    border: '1px solid rgba(132, 98, 67, 0.36)',
    background: 'rgba(255, 247, 227, 0.72)',
    borderRadius: '0.48rem',
    padding: '0.9rem',
    boxShadow: '0 1px 2px rgba(74, 48, 28, 0.12)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  title: { margin: 0, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: '#5c3c24', fontWeight: 700 },
  badge: { fontSize: '0.72rem', color: '#5b3c22', border: '1px solid rgba(134, 103, 69, 0.45)', borderRadius: '0.35rem', padding: '0.18rem 0.55rem', background: 'rgba(243, 226, 190, 0.9)' },
  body: { display: 'grid', gap: '0.42rem', marginTop: '0.5rem' },
  line: { margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: '#3c2716' },
};
