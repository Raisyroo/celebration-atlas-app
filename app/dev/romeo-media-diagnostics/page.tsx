import type { CSSProperties } from 'react';
import { notFound } from 'next/navigation';
import { ATLAS_EVENTS } from '../../../data/events';
import { getCanonicalEventSlug } from '../../../data/eventCanonicalSlugs';
import { resolveEventFlyerMediaServer } from '../../../data/eventMediaServer';

export default async function RomeoMediaDiagnosticsPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const event = ATLAS_EVENTS.find((candidate) => candidate.id === 'romeo-peach');

  if (!event) {
    return <main style={styles.main}>Romeo Peach Festival is not present in ATLAS_EVENTS.</main>;
  }

  const canonicalSlug = getCanonicalEventSlug(event);
  const flyer = await resolveEventFlyerMediaServer(event);

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
          <dt>Resolved flyer source</dt>
          <dd>{flyer?.source ?? 'none'}</dd>
        </div>
        <div style={styles.item}>
          <dt>Final URL/path</dt>
          <dd><code>{flyer?.src ?? 'No flyer resolved'}</code></dd>
        </div>
        <div style={styles.item}>
          <dt>Fallback used</dt>
          <dd>{flyer?.fallbackUsed ? 'yes' : 'no'}</dd>
        </div>
      </dl>
      <p style={styles.note}>
        This page intentionally prints only the canonical slug, resolved source, and public media URL/path. It never displays Supabase credentials.
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
