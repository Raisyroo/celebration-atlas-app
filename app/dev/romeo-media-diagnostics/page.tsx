import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { ATLAS_EVENTS } from '../../../data/events';
import { getCanonicalEventSlug } from '../../../data/eventCanonicalSlugs';
import { getEventFlyerDiagnostics } from '../../../data/eventMediaServer';
import { deriveSafeAtlasEventCard } from '../../../data/safeEventCard';

export default async function RomeoMediaDiagnosticsPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const event = ATLAS_EVENTS.find((candidate) => candidate.id === 'romeo-peach');

  if (!event) {
    return <main style={styles.main}>Romeo Peach Festival is not present in ATLAS_EVENTS.</main>;
  }

  const canonicalSlug = getCanonicalEventSlug(event);
  const diagnostics = await getEventFlyerDiagnostics(event);
  const flyer = diagnostics.resolved;
  const safeCard = deriveSafeAtlasEventCard(
    event,
    flyer ? { [event.id]: flyer } : {},
  );
  const renderedFlyerSrc = safeCard.media?.flyerSrc;

  return (
    <main style={styles.main}>
      <p style={styles.kicker}>Developer diagnostics</p>
      <h1 style={styles.heading}>Romeo Peach media resolver</h1>
      <dl style={styles.grid}>
        <div style={styles.item}>
          <dt>Canonical slug requested</dt>
          <dd><code>{canonicalSlug}</code></dd>
        </div>
        <div style={styles.item}>
          <dt>Exact rendered flyer src</dt>
          <dd><code>{renderedFlyerSrc ?? 'No flyer rendered'}</code></dd>
        </div>
        <div style={styles.item}>
          <dt>Rendered source kind</dt>
          <dd>
            {flyer?.source === 'supabase'
              ? 'Supabase public URL'
              : flyer?.source === 'local'
                ? 'local public asset'
                : 'none'}
          </dd>
        </div>
        <div style={styles.item}>
          <dt>Exact fallback src</dt>
          <dd><code>{diagnostics.fallbackSrc ?? 'No fallback catalog entry'}</code></dd>
        </div>
        <div style={styles.item}>
          <dt>Fallback source kind</dt>
          <dd>
            {diagnostics.fallbackSource === 'local'
              ? 'local public asset'
              : diagnostics.fallbackSource === 'hosted'
                ? 'hosted URL'
                : 'none'}
          </dd>
        </div>
        <div style={styles.item}>
          <dt>Fallback file exists in app build</dt>
          <dd>{diagnostics.fallbackExists ? 'yes' : 'no'}</dd>
        </div>
        <div style={styles.item}>
          <dt>Fallback public build path</dt>
          <dd>
            <code>
              {diagnostics.fallbackPublicPath
                ? diagnostics.fallbackPublicPath.replace(process.cwd(), '')
                : 'not local'}
            </code>
          </dd>
        </div>
        <div style={styles.item}>
          <dt>Fallback used</dt>
          <dd>{flyer?.fallbackUsed ? 'yes' : 'no'}</dd>
        </div>
      </dl>
      <p style={styles.note}>
        This page intentionally prints only the canonical slug, rendered source,
        fallback source, and local file availability. It never displays Supabase
        credentials.
      </p>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: { minHeight: '100vh', padding: '48px', background: '#111827', color: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  kicker: { margin: 0, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: 12 },
  heading: { marginTop: 8, fontSize: 36 },
  grid: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' },
  item: { padding: 16, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, background: 'rgba(255,255,255,0.06)' },
  note: { marginTop: 28, color: '#d1d5db' },
};
