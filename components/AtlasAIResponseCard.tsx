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
    border: '1px solid rgba(190, 218, 255, 0.28)',
    background: 'linear-gradient(170deg, rgba(14, 22, 36, 0.9), rgba(7, 12, 22, 0.84))',
    borderRadius: '1rem',
    padding: '0.9rem',
    boxShadow: 'inset 0 0 0 1px rgba(163, 201, 252, 0.08), 0 14px 30px rgba(0, 0, 0, 0.26)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  title: { margin: 0, fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(185, 219, 255, 0.94)', fontWeight: 700 },
  badge: { fontSize: '0.72rem', color: 'rgba(225, 239, 255, 0.94)', border: '1px solid rgba(175, 210, 255, 0.35)', borderRadius: '999px', padding: '0.18rem 0.55rem' },
  body: { display: 'grid', gap: '0.42rem', marginTop: '0.5rem' },
  line: { margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: 'rgba(235, 244, 255, 0.93)' },
};
