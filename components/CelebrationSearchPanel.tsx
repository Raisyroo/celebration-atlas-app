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
    <section aria-label="Future Celebration Search command panel">
      <p>Celebration Search command panel shell is not wired into the app yet.</p>
      <p>Current command scope: {scopeLabel}</p>
    </section>
  );
}

export { CelebrationSearchPanel };
export type { CelebrationSearchPanelProps };
