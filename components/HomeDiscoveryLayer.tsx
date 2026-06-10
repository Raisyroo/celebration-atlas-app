import type { CSSProperties } from 'react';

type HomeDiscoveryLayerProps = {
  query?: string;
  resultCount?: number;
  statusText?: string;
};

const styles = {
  status: {
    margin: '0 auto 8px',
    width: 'fit-content',
    color: 'rgba(255, 232, 188, 0.62)',
    fontSize: 11,
    letterSpacing: 0.28,
    lineHeight: 1.2,
    textShadow:
      '0 1px 2px rgba(2, 3, 7, 0.55), 0 0 8px rgba(247, 199, 98, 0.16)',
    opacity: 0.86,
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
} satisfies Record<string, CSSProperties>;

export function HomeDiscoveryLayer({ statusText }: HomeDiscoveryLayerProps) {
  if (!statusText) return null;

  return (
    // Future scalable discovery layer for filters, summaries, chips, and event lists.
    <p style={styles.status} aria-live="polite">
      {statusText}
    </p>
  );
}
