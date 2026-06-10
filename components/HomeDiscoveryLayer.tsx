import type { CSSProperties } from 'react';

type DiscoveryShortcutGroup = {
  label?: string;
  shortcuts: string[];
};

type HomeDiscoveryLayerProps = {
  query?: string;
  resultCount?: number;
  statusText?: string;
  shortcuts?: string[];
  shortcutGroups?: DiscoveryShortcutGroup[];
  onShortcutSelect?: (value: string) => void;
};

const styles = {
  shell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
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
  shortcutGroups: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 5,
    width: 'min(100%, 560px)',
  },
  shortcutGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    width: '100%',
    maxWidth: 560,
  },
  shortcutGroupLabel: {
    flex: '0 0 auto',
    color: 'rgba(255, 226, 170, 0.48)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.72,
    lineHeight: 1,
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.68)',
    textTransform: 'uppercase',
  },
  shortcuts: {
    display: 'flex',
    justifyContent: 'flex-start',
    flex: '1 1 auto',
    flexWrap: 'nowrap',
    gap: '6px 7px',
    minWidth: 0,
    overflowX: 'auto',
    padding: '1px 2px 3px',
    scrollbarWidth: 'none',
    WebkitOverflowScrolling: 'touch',
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
  shortcutGroups,
  statusText,
  onShortcutSelect,
}: HomeDiscoveryLayerProps) {
  const normalizedShortcutGroups = shortcutGroups?.length
    ? shortcutGroups
    : shortcuts?.length
      ? [{ shortcuts }]
      : [];
  const hasShortcuts = Boolean(
    normalizedShortcutGroups.length && onShortcutSelect,
  );

  if (!statusText && !hasShortcuts) return null;

  const renderShortcut = (shortcut: string) => (
    <button
      key={shortcut}
      type="button"
      style={styles.shortcut}
      onClick={() => onShortcutSelect?.(shortcut)}
      aria-label={`Search for ${shortcut}`}
    >
      {shortcut}
    </button>
  );

  return (
    // Future scalable discovery layer for filters, summaries, chips, and event lists.
    <section style={styles.shell}>
      {statusText ? (
        <p style={styles.status} aria-live="polite">
          {statusText}
        </p>
      ) : null}
      {hasShortcuts ? (
        <div style={styles.shortcutGroups} aria-label="Discovery shortcuts">
          {normalizedShortcutGroups.map((group, groupIndex) => {
            const groupLabel = group.label ?? `Discovery row ${groupIndex + 1}`;

            return (
              <div
                key={group.label ?? group.shortcuts.join('-')}
                style={styles.shortcutGroup}
                role="group"
                aria-label={groupLabel}
              >
                {group.label ? (
                  <span style={styles.shortcutGroupLabel}>{group.label}</span>
                ) : null}
                <div style={styles.shortcuts}>
                  {group.shortcuts.map(renderShortcut)}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
