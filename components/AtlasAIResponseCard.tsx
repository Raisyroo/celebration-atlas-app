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
    border: '1px solid rgba(137, 101, 65, 0.34)',
    background: 'linear-gradient(165deg, rgba(255, 249, 233, 0.74), rgba(242, 224, 189, 0.58))',
    borderRadius: '0.9rem',
    padding: '0.95rem',
    boxShadow: '0 12px 20px rgba(84, 52, 28, 0.14), inset 0 1px 0 rgba(255, 249, 232, 0.7)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  title: { margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.11em', color: '#5c3c24', fontWeight: 700 },
  badge: { fontSize: '0.72rem', color: '#5b3c22', border: '1px solid rgba(134, 103, 69, 0.45)', borderRadius: '0.45rem', padding: '0.18rem 0.55rem', background: 'rgba(243, 226, 190, 0.9)' },
  body: { display: 'grid', gap: '0.42rem', marginTop: '0.5rem' },
  line: { margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: '#3c2716' },
};
