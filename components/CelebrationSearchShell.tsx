'use client';

import { FormEvent, useMemo, useState } from 'react';
import { parseCelebrationSearchMock } from '../data/celebrationSearchMockParser';
import type { AtlasSearchResult } from '../data/celebrationSearchTypes';

const EXAMPLE_QUERIES = [
  'Show me music festivals in Michigan',
  'What festivals are active in Michigan?',
  'Show me county fairs near the Great Lakes',
  'Romeo Peach Festival',
] as const;

export default function CelebrationSearchShell() {
  const [queryText, setQueryText] = useState('');
  const [result, setResult] = useState<AtlasSearchResult | null>(null);

  const highlightedEventCount = result?.command.highlightedEventIds.length ?? 0;
  const hasWarnings = Boolean(result?.warnings.length);
  const shouldShowDeferredHighlightNote = highlightedEventCount > 0;

  const resultMeta = useMemo(() => {
    if (!result) return null;

    const { command } = result;
    const parts = [command.scope, command.action, command.confidence]
      .filter(Boolean)
      .join(' · ');

    return parts ? `Mock command · ${parts}` : 'Mock command';
  }, [result]);

  const runMockSearch = (nextQueryText: string) => {
    const parsedResult = parseCelebrationSearchMock({
      queryText: nextQueryText,
    });

    setResult(parsedResult);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runMockSearch(queryText);
  };

  const handleExampleSelect = (exampleQuery: string) => {
    setQueryText(exampleQuery);
    runMockSearch(exampleQuery);
  };

  return (
    <section className="celebration-search-shell" aria-labelledby="celebration-search-title">
      <div className="celebration-search-shell__glow" aria-hidden="true" />
      <div className="celebration-search-shell__header">
        <p className="celebration-search-shell__eyebrow">Map command layer</p>
        <h2 id="celebration-search-title">Celebration Search</h2>
        <p className="celebration-search-shell__note">
          Mock parser only. It can summarize safe Atlas intent, but it does not verify live or current-year event status.
        </p>
      </div>

      <form className="celebration-search-shell__form" onSubmit={handleSubmit}>
        <label className="celebration-search-shell__label" htmlFor="celebration-search-input">
          Ask the Atlas
        </label>
        <div className="celebration-search-shell__control">
          <input
            id="celebration-search-input"
            value={queryText}
            onChange={(event) => setQueryText(event.target.value)}
            placeholder="Show me music festivals in Michigan"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
          />
          <button type="submit">Search</button>
        </div>
      </form>

      <div className="celebration-search-shell__examples" aria-label="Try example Celebration Search queries">
        <span>Try:</span>
        {EXAMPLE_QUERIES.map((exampleQuery) => (
          <button
            key={exampleQuery}
            type="button"
            onClick={() => handleExampleSelect(exampleQuery)}
          >
            {exampleQuery}
          </button>
        ))}
      </div>

      {result ? (
        <div className="celebration-search-shell__result" aria-live="polite">
          {resultMeta ? <p className="celebration-search-shell__meta">{resultMeta}</p> : null}
          <p className="celebration-search-shell__response">{result.command.responseText}</p>

          {result.command.needsClarification && result.command.clarificationQuestion ? (
            <p className="celebration-search-shell__clarification">
              {result.command.clarificationQuestion}
            </p>
          ) : null}

          {hasWarnings ? (
            <div className="celebration-search-shell__warnings" aria-label="Celebration Search warnings">
              <p>Warnings</p>
              <ul>
                {result.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {shouldShowDeferredHighlightNote ? (
            <p className="celebration-search-shell__handoff">
              {highlightedEventCount} map highlight {highlightedEventCount === 1 ? 'candidate' : 'candidates'} found. Map highlighting is deferred for this shell so existing search, marker taps, clusters, and constellation trails remain untouched.
            </p>
          ) : null}
        </div>
      ) : null}

      <style jsx>{`
        .celebration-search-shell {
          position: relative;
          isolation: isolate;
          width: min(calc(100% - 28px), 720px);
          margin: -2px auto 18px;
          padding: 18px 16px 16px;
          overflow: hidden;
          border: 1px solid rgba(255, 226, 170, 0.16);
          border-radius: 24px;
          background:
            radial-gradient(circle at 18% 0%, rgba(255, 213, 137, 0.14), transparent 34%),
            linear-gradient(180deg, rgba(22, 24, 31, 0.72), rgba(8, 10, 15, 0.58));
          box-shadow:
            inset 0 1px 0 rgba(255, 246, 219, 0.08),
            0 18px 50px rgba(0, 0, 0, 0.26);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .celebration-search-shell__glow {
          position: absolute;
          inset: -35% -20% auto 35%;
          z-index: -1;
          height: 190px;
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 204, 122, 0.16), transparent 66%);
          filter: blur(2px);
          pointer-events: none;
        }

        .celebration-search-shell__header {
          display: grid;
          gap: 5px;
          margin-bottom: 13px;
        }

        .celebration-search-shell__eyebrow,
        .celebration-search-shell__meta,
        .celebration-search-shell__warnings p {
          margin: 0;
          color: rgba(255, 226, 170, 0.52);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: rgba(255, 242, 216, 0.94);
          font-size: clamp(22px, 7vw, 34px);
          font-weight: 700;
          letter-spacing: -0.035em;
          line-height: 0.96;
          text-shadow: 0 0 18px rgba(255, 202, 116, 0.12);
        }

        .celebration-search-shell__note {
          max-width: 56ch;
          margin: 0;
          color: rgba(255, 236, 205, 0.62);
          font-size: 12px;
          line-height: 1.45;
        }

        .celebration-search-shell__form {
          display: grid;
          gap: 7px;
        }

        .celebration-search-shell__label {
          color: rgba(255, 226, 170, 0.58);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .celebration-search-shell__control {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 8px;
          padding: 6px;
          border: 1px solid rgba(255, 226, 170, 0.2);
          border-radius: 999px;
          background: rgba(3, 5, 10, 0.34);
          box-shadow: inset 0 0 0 1px rgba(255, 246, 219, 0.035);
        }

        input {
          min-width: 0;
          width: 100%;
          border: 0;
          outline: 0;
          padding: 8px 8px 8px 10px;
          background: transparent;
          color: rgba(255, 243, 221, 0.94);
          font-size: 14px;
        }

        input::placeholder {
          color: rgba(255, 232, 188, 0.34);
        }

        button {
          border: 1px solid rgba(255, 226, 170, 0.24);
          border-radius: 999px;
          background: linear-gradient(180deg, rgba(255, 224, 165, 0.16), rgba(255, 194, 112, 0.08));
          color: rgba(255, 241, 213, 0.88);
          font: inherit;
          font-size: 12px;
          font-weight: 800;
          letter-spacing: 0.02em;
          cursor: pointer;
          touch-action: manipulation;
        }

        .celebration-search-shell__control button {
          min-height: 36px;
          padding: 0 14px;
          box-shadow: 0 0 18px rgba(255, 196, 98, 0.08);
        }

        .celebration-search-shell__examples {
          display: flex;
          gap: 7px;
          align-items: center;
          margin-top: 10px;
          padding-bottom: 2px;
          overflow-x: auto;
          color: rgba(255, 226, 170, 0.46);
          font-size: 11px;
          scrollbar-width: none;
          -webkit-overflow-scrolling: touch;
        }

        .celebration-search-shell__examples span {
          flex: 0 0 auto;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .celebration-search-shell__examples button {
          flex: 0 0 auto;
          padding: 7px 10px;
          background: rgba(255, 226, 170, 0.065);
          color: rgba(255, 238, 210, 0.78);
          font-size: 11px;
          font-weight: 700;
        }

        .celebration-search-shell__result {
          display: grid;
          gap: 9px;
          margin-top: 14px;
          padding-top: 13px;
          border-top: 1px solid rgba(255, 226, 170, 0.13);
        }

        .celebration-search-shell__response,
        .celebration-search-shell__clarification,
        .celebration-search-shell__handoff {
          margin: 0;
          color: rgba(255, 241, 216, 0.82);
          font-size: 13px;
          line-height: 1.5;
        }

        .celebration-search-shell__clarification {
          color: rgba(255, 222, 165, 0.9);
        }

        .celebration-search-shell__warnings {
          display: grid;
          gap: 6px;
          padding: 10px 11px;
          border: 1px solid rgba(255, 203, 120, 0.16);
          border-radius: 16px;
          background: rgba(255, 203, 120, 0.055);
        }

        .celebration-search-shell__warnings ul {
          display: grid;
          gap: 4px;
          margin: 0;
          padding-left: 16px;
          color: rgba(255, 232, 190, 0.72);
          font-size: 12px;
          line-height: 1.4;
        }

        .celebration-search-shell__handoff {
          color: rgba(203, 225, 255, 0.7);
          font-size: 12px;
        }

        @media (min-width: 720px) {
          .celebration-search-shell {
            margin-top: 4px;
            padding: 22px 22px 18px;
          }

          .celebration-search-shell__control button {
            padding-inline: 18px;
          }
        }
      `}</style>
    </section>
  );
}
