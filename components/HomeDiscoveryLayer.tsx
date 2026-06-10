import type { CSSProperties } from 'react';

type DiscoveryShortcutGroup = {
  label?: string;
  shortcuts: string[];
};

export type HomeDiscoveryResultRow = {
  id: string;
  name: string;
  location: string;
  category?: string;
  atmosphereLabel?: string;
  blurb?: string;
};

type HomeDiscoveryLayerProps = {
  query?: string;
  resultCount?: number;
  statusText?: string;
  shortcuts?: string[];
  shortcutGroups?: DiscoveryShortcutGroup[];
  results?: HomeDiscoveryResultRow[];
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
  results: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    width: 'min(100%, 420px)',
    margin: '1px auto 2px',
    padding: '2px 0',
  },
  resultLabel: {
    margin: 0,
    color: 'rgba(255, 226, 170, 0.5)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.72,
    lineHeight: 1,
    textAlign: 'center',
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.68)',
    textTransform: 'uppercase',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  resultList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  resultRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    minHeight: 28,
    padding: '5px 9px',
    borderRadius: 12,
    border: '1px solid rgba(255, 226, 170, 0.18)',
    background:
      'linear-gradient(180deg, rgba(43, 36, 24, 0.26), rgba(8, 10, 14, 0.14))',
    boxShadow:
      'inset 0 0 0 1px rgba(255, 245, 218, 0.03), 0 2px 9px rgba(0, 0, 0, 0.12)',
    backdropFilter: 'blur(2px)',
    WebkitBackdropFilter: 'blur(2px)',
    pointerEvents: 'none',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
  },
  resultIdentity: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  resultName: {
    overflow: 'hidden',
    color: 'rgba(255, 242, 215, 0.86)',
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0.18,
    lineHeight: 1.15,
    textOverflow: 'ellipsis',
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.72)',
    whiteSpace: 'nowrap',
  },
  resultLocation: {
    overflow: 'hidden',
    color: 'rgba(255, 232, 188, 0.62)',
    fontSize: 10,
    letterSpacing: 0.18,
    lineHeight: 1.1,
    textOverflow: 'ellipsis',
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.68)',
    whiteSpace: 'nowrap',
  },
  resultMeta: {
    flex: '0 0 auto',
    maxWidth: '42%',
    overflow: 'hidden',
    color: 'rgba(255, 226, 170, 0.58)',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: 0.22,
    lineHeight: 1.1,
    textAlign: 'right',
    textOverflow: 'ellipsis',
    textShadow: '0 1px 2px rgba(2, 3, 7, 0.68)',
    whiteSpace: 'nowrap',
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
  query,
  shortcuts,
  shortcutGroups,
  statusText,
  resultCount,
  results,
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
  const hasResults = Boolean(query?.trim() && resultCount && results?.length);

  if (!statusText && !hasShortcuts && !hasResults) return null;

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
      {hasResults ? (
        <div style={styles.results} aria-label="Matching Discoveries">
          <p style={styles.resultLabel}>Matching Discoveries</p>
          <ol style={styles.resultList}>
            {results?.map((result) => {
              const meta = result.atmosphereLabel || result.category;

              return (
                <li key={result.id} style={styles.resultRow}>
                  <span style={styles.resultIdentity}>
                    <span style={styles.resultName}>{result.name}</span>
                    <span style={styles.resultLocation}>{result.location}</span>
                  </span>
                  {meta ? <span style={styles.resultMeta}>{meta}</span> : null}
                </li>
              );
            })}
          </ol>
        </div>
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
