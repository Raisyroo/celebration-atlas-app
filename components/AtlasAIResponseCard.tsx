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
    border: '1px solid rgba(142, 106, 70, 0.3)',
    background: 'linear-gradient(165deg, rgba(255, 249, 236, 0.8), rgba(242, 224, 192, 0.56))',
    borderRadius: '1rem',
    padding: '1rem',
    boxShadow: '0 14px 26px rgba(78, 48, 25, 0.14), 0 0 0 1px rgba(168, 126, 77, 0.12), inset 0 1px 0 rgba(255, 249, 232, 0.75)',
    backdropFilter: 'blur(5px)',
    WebkitBackdropFilter: 'blur(5px)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' },
  title: { margin: 0, fontSize: '0.77rem', textTransform: 'uppercase', letterSpacing: '0.14em', color: '#5f3f26', fontWeight: 700 },
  badge: { fontSize: '0.68rem', color: '#5f4025', border: '1px solid rgba(140, 108, 74, 0.45)', borderRadius: '999px', padding: '0.2rem 0.58rem', background: 'linear-gradient(180deg, rgba(245, 229, 195, 0.95), rgba(237, 217, 179, 0.75))' },
  body: { display: 'grid', gap: '0.48rem', marginTop: '0.6rem' },
  line: { margin: 0, fontSize: '0.94rem', lineHeight: 1.56, color: '#3f2a18' },
};
