import type { CSSProperties } from 'react';

type HomeDiscoveryLayerProps = {
  query?: string;
  resultCount?: number;
  statusText?: string;
  shortcuts?: string[];
  onShortcutSelect?: (value: string) => void;
};

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 7,
    margin: '0 auto 8px',
    width: '100%',
  },
  status: {
    margin: 0,
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
  shortcuts: {
    display: 'flex',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: '6px 7px',
    width: 'min(100%, 520px)',
  },
  shortcut: {
    minHeight: 28,
    padding: '5px 10px',
    borderRadius: 999,
    border: '1px solid rgba(255, 226, 170, 0.3)',
    background:
      'linear-gradient(180deg, rgba(43, 36, 24, 0.34), rgba(8, 10, 14, 0.18))',
    color: 'rgba(255, 238, 205, 0.82)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.22,
    lineHeight: 1,
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.74)',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 245, 218, 0.045), 0 2px 10px rgba(0, 0, 0, 0.14)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    cursor: 'pointer',
    touchAction: 'manipulation',
  },
} satisfies Record<string, CSSProperties>;

export function HomeDiscoveryLayer({
  shortcuts,
  statusText,
  onShortcutSelect,
}: HomeDiscoveryLayerProps) {
  const hasShortcuts = Boolean(shortcuts?.length && onShortcutSelect);

  if (!statusText && !hasShortcuts) return null;

  return (
    // Future scalable discovery layer for filters, summaries, chips, and event lists.
    <section style={styles.shell}>
      {statusText ? (
        <p style={styles.status} aria-live="polite">
          {statusText}
        </p>
      ) : null}
      {hasShortcuts ? (
        <div style={styles.shortcuts} aria-label="Discovery shortcuts">
          {shortcuts?.map((shortcut) => (
            <button
              key={shortcut}
              type="button"
              style={styles.shortcut}
              onClick={() => onShortcutSelect?.(shortcut)}
              aria-label={`Search for ${shortcut}`}
            >
              {shortcut}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
