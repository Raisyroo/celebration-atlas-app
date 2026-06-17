'use client';

import Link from 'next/link';
import { FormEvent, useState, type CSSProperties } from 'react';
import { parseCelebrationSearchMock } from '../data/celebrationSearchMockParser';
import { getEventProfileById } from '../data/eventProfiles';
import type {
  AtlasSearchResult,
  AtlasSearchScope,
} from '../data/celebrationSearchTypes';

interface CelebrationSearchPanelProps {
  currentScope?: AtlasSearchScope;
  currentStateSlug?: string;
  onResult?: (result: AtlasSearchResult) => void;
}

// Reusable Celebration Search command panel for safe mock-parser previews.
//
// This client component intentionally uses only the local mock parser. It does
// not call real AI, fetch external data, auto-navigate, mutate map state, or
// hand search state into the Michigan homepage.

export default function CelebrationSearchPanel({
  currentScope = 'state',
  currentStateSlug,
  onResult,
}: CelebrationSearchPanelProps) {
  const [queryText, setQueryText] = useState('');
  const [result, setResult] = useState<AtlasSearchResult | null>(null);
  const scopeLabel = currentStateSlug
    ? `${currentScope}:${currentStateSlug}`
    : currentScope;
  const showMichiganCta =
    result?.command.scope === 'state' && result.command.stateSlug === 'michigan';
  const eventMatch = result?.command.eventId
    ? getEventProfileById(result.command.eventId)
    : undefined;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextResult = parseCelebrationSearchMock({
      queryText,
      currentScope,
      currentStateSlug,
    });

    setResult(nextResult);
    onResult?.(nextResult);
  }

  return (
    <section aria-label="Celebration Search command panel" style={styles.panel}>
      <p style={styles.label}>Ask Celebration Atlas</p>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label htmlFor="celebration-search-query" style={styles.visuallyHidden}>
          Ask Celebration Search for a festival, state, category, or timeframe
        </label>
        <div style={styles.inputShell}>
          <input
            id="celebration-search-query"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Try Michigan, Show me Michigan, or Romeo Peach Festival"
            style={styles.input}
            type="search"
          />
          <button type="submit" style={styles.submitButton}>
            Interpret
          </button>
        </div>
      </form>
      <p style={styles.copy}>
        Development preview only. This uses the local mock parser, not real AI, live data, external fetches, or active
        event verification.
      </p>
      <p style={styles.scope}>Current command scope: {scopeLabel}</p>

      {result ? (
        <div style={styles.resultPanel} aria-live="polite">
          <p style={styles.resultLabel}>Parser response</p>
          <p style={styles.responseText}>{result.command.responseText}</p>

          {result.warnings.length > 0 ? (
            <div style={styles.warningPanel}>
              <p style={styles.warningLabel}>Coverage & timing notes</p>
              <ul style={styles.warningList}>
                {result.warnings.map((warning) => (
                  <li key={warning} style={styles.warningItem}>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {result.command.needsClarification && result.command.clarificationQuestion ? (
            <p style={styles.clarification}>{result.command.clarificationQuestion}</p>
          ) : null}

          {eventMatch ? (
            <div style={styles.michiganCtaGroup}>
              <Link href={`/events/${eventMatch.slug}`} style={styles.michiganCta} aria-label={`Open ${eventMatch.name}`}>
                <span style={styles.michiganCtaKicker}>Event doorway</span>
                <span style={styles.michiganCtaText}>Open {eventMatch.name}</span>
              </Link>
              <p style={styles.michiganCtaNote}>
                Known event match. The national preview highlights the Michigan doorway and offers the existing event route.
              </p>
            </div>
          ) : null}

          {showMichiganCta ? (
            <div style={styles.michiganCtaGroup}>
              <Link href="/" style={styles.michiganCta} aria-label="Open Michigan Atlas">
                <span style={styles.michiganCtaKicker}>State doorway</span>
                <span style={styles.michiganCtaText}>Open Michigan Atlas</span>
              </Link>
              <p style={styles.michiganCtaNote}>
                Manual doorway only. No query parameters, command state, or automatic navigation are sent to the
                Michigan Atlas.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
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
  form: {
    margin: 0,
  },
  inputShell: {
    alignItems: 'center',
    background:
      'linear-gradient(135deg, rgba(255, 246, 220, 0.12), rgba(255, 246, 220, 0.055))',
    borderRadius: '999px',
    boxShadow:
      '0 18px 55px rgba(0, 0, 0, 0.24), inset 0 0 0 1px rgba(255, 236, 196, 0.08)',
    display: 'flex',
    gap: '0.75rem',
    justifyContent: 'space-between',
    minHeight: '3.6rem',
    padding: '0.55rem 0.65rem 0.55rem 1.2rem',
  },
  input: {
    background: 'transparent',
    border: 0,
    color: '#fff4db',
    flex: '1 1 auto',
    font: 'inherit',
    fontSize: 'clamp(0.88rem, 2.3vw, 1rem)',
    lineHeight: 1.35,
    minWidth: 0,
    outline: 'none',
  },
  submitButton: {
    background: 'rgba(251, 216, 157, 0.16)',
    border: 0,
    borderRadius: '999px',
    color: 'rgba(255, 244, 219, 0.86)',
    cursor: 'pointer',
    flex: '0 0 auto',
    font: 'inherit',
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
  resultPanel: {
    background: 'rgba(8, 13, 22, 0.32)',
    borderRadius: '1.1rem',
    boxShadow: 'inset 0 0 0 1px rgba(255, 236, 196, 0.08)',
    marginTop: '1.2rem',
    padding: '1rem',
  },
  resultLabel: {
    color: 'rgba(251, 216, 157, 0.72)',
    fontSize: '0.68rem',
    letterSpacing: '0.18em',
    margin: '0 0 0.65rem',
    textTransform: 'uppercase',
  },
  responseText: {
    color: 'rgba(255, 244, 219, 0.82)',
    fontSize: '0.98rem',
    lineHeight: 1.6,
    margin: 0,
  },
  warningPanel: {
    borderLeft: '1px solid rgba(251, 216, 157, 0.28)',
    marginTop: '0.95rem',
    paddingLeft: '0.85rem',
  },
  warningLabel: {
    color: 'rgba(251, 216, 157, 0.7)',
    fontSize: '0.66rem',
    letterSpacing: '0.16em',
    margin: '0 0 0.45rem',
    textTransform: 'uppercase',
  },
  warningList: {
    color: 'rgba(255, 244, 219, 0.68)',
    fontSize: '0.84rem',
    lineHeight: 1.55,
    margin: 0,
    paddingLeft: '1.05rem',
  },
  warningItem: {
    margin: '0.22rem 0',
  },
  clarification: {
    color: 'rgba(255, 244, 219, 0.76)',
    fontSize: '0.92rem',
    fontStyle: 'italic',
    lineHeight: 1.55,
    margin: '0.95rem 0 0',
  },
  michiganCta: {
    alignItems: 'center',
    background:
      'linear-gradient(135deg, rgba(251, 216, 157, 0.2), rgba(123, 173, 189, 0.11))',
    borderRadius: '1rem',
    boxShadow: 'inset 0 0 0 1px rgba(251, 216, 157, 0.18)',
    color: '#fff4db',
    display: 'inline-flex',
    flexDirection: 'column',
    gap: '0.18rem',
    marginTop: '1rem',
    padding: '0.78rem 1rem',
    textDecoration: 'none',
  },
  michiganCtaGroup: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.58rem',
    marginTop: '1rem',
  },
  michiganCtaKicker: {
    color: 'rgba(251, 216, 157, 0.74)',
    fontSize: '0.62rem',
    letterSpacing: '0.16em',
    textTransform: 'uppercase',
  },
  michiganCtaText: {
    fontFamily: 'Georgia, "Times New Roman", serif',
    fontSize: '1.06rem',
  },
  michiganCtaNote: {
    color: 'rgba(255, 244, 219, 0.52)',
    fontSize: '0.76rem',
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '30rem',
  },
  visuallyHidden: {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: '1px',
    margin: '-1px',
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: '1px',
  },
};
