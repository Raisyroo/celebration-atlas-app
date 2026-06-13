import type { CSSProperties } from 'react';
import type {
  AtlasSearchResult,
  AtlasSearchScope,
} from '../data/celebrationSearchTypes';

interface CelebrationSearchPanelProps {
  currentScope?: AtlasSearchScope;
  currentStateSlug?: string;
  onResult?: (result: AtlasSearchResult) => void;
}

// Future reusable Celebration Search command panel.
//
// This shell is intentionally minimal and does not replace the current
// Celebration Search UI. It does not call the mock parser, does not add real AI,
// and does not fetch external data.
//
// Future role:
// - accept conversational commands
// - emit safe AtlasSearchResult objects through onResult
// - work across national, state, region, event, and constellation scopes
// - remain honest about partial coverage and unknown results

export default function CelebrationSearchPanel({
  currentScope = 'state',
  currentStateSlug,
}: CelebrationSearchPanelProps) {
  const scopeLabel = currentStateSlug
    ? `${currentScope}:${currentStateSlug}`
    : currentScope;

  return (
    <section aria-label="Future Celebration Search command panel" style={styles.panel}>
      <p style={styles.label}>Celebration Search</p>
      <div style={styles.inputShell} aria-hidden="true">
        <span style={styles.prompt}>Ask for fairs, parades, harvest trails, or a state to explore</span>
        <span style={styles.status}>Preview only</span>
      </div>
      <p style={styles.copy}>
        Celebration Search will eventually control the national map. For now, it is a non-functional command
        surface with no AI calls, no external fetches, and no active event verification.
      </p>
      <p style={styles.scope}>Current command scope: {scopeLabel}</p>
    </section>
  );
}

export { CelebrationSearchPanel };
export type { CelebrationSearchPanelProps };

const styles: Record<string, CSSProperties> = {
  panel: {
    color: '#f8ead2',
    textAlign: 'left',
  },
  label: {
    color: 'rgba(251, 216, 157, 0.78)',
    fontSize: '0.72rem',
    letterSpacing: '0.2em',
    margin: '0 0 0.8rem',
    textTransform: 'uppercase',
  },
  inputShell: {
    alignItems: 'center',
    background:
      'linear-gradient(135deg, rgba(255, 246, 220, 0.12), rgba(255, 246, 220, 0.055))',
    borderRadius: '999px',
    boxShadow:
      '0 18px 55px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255, 236, 196, 0.08)',
    display: 'flex',
    gap: '1rem',
    justifyContent: 'space-between',
    minHeight: '3.6rem',
    padding: '0.55rem 0.65rem 0.55rem 1.2rem',
  },
  prompt: {
    color: 'rgba(255, 244, 219, 0.68)',
    fontSize: 'clamp(0.88rem, 2.3vw, 1rem)',
    lineHeight: 1.35,
  },
  status: {
    background: 'rgba(251, 216, 157, 0.16)',
    borderRadius: '999px',
    color: 'rgba(255, 244, 219, 0.78)',
    flex: '0 0 auto',
    fontSize: '0.68rem',
    letterSpacing: '0.14em',
    padding: '0.72rem 0.78rem',
    textTransform: 'uppercase',
  },
  copy: {
    color: 'rgba(255, 244, 219, 0.72)',
    fontSize: '0.93rem',
    lineHeight: 1.6,
    margin: '1rem 0 0',
  },
  scope: {
    color: 'rgba(255, 244, 219, 0.48)',
    fontSize: '0.78rem',
    letterSpacing: '0.08em',
    margin: '0.8rem 0 0',
    textTransform: 'uppercase',
  },
};
