import type { CSSProperties } from 'react';
import { ATLAS_EVENTS } from '../../../data/events';
import { getEventFlyer } from '../../../data/eventFlyers';
import { getEventMediaRecords, resolveEventFlyerMedia } from '../../../data/eventMedia';

export default function BrownTroutMediaDiagnosticsPage() {
  const event = ATLAS_EVENTS.find((candidate) => candidate.id === 'alpena-brown-trout');

  if (!event) {
    return <main style={styles.main}>Brown Trout Festival is not present in ATLAS_EVENTS.</main>;
  }

  const flyer = resolveEventFlyerMedia(event, getEventFlyer(event.id));
  const records = getEventMediaRecords(event.id);

  return (
    <main style={styles.main}>
      <p style={styles.kicker}>Developer diagnostics</p>
      <h1 style={styles.heading}>Brown Trout media resolver</h1>
      <dl style={styles.grid}>
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
        <div style={styles.item}>
          <dt>Configured pilot records</dt>
          <dd>{records.length}</dd>
        </div>
      </dl>
      <section style={styles.panel}>
        <h2>Brown Trout pilot records</h2>
        <pre style={styles.pre}>{JSON.stringify(records, null, 2)}</pre>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  main: { minHeight: '100vh', padding: '48px', background: '#111827', color: '#f9fafb', fontFamily: 'system-ui, sans-serif' },
  kicker: { margin: 0, color: '#fbbf24', textTransform: 'uppercase', letterSpacing: '0.16em', fontSize: 12 },
  heading: { marginTop: 8, fontSize: 36 },
  grid: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' },
  item: { padding: 16, border: '1px solid rgba(255,255,255,0.16)', borderRadius: 12, background: 'rgba(255,255,255,0.06)' },
  panel: { marginTop: 28 },
  pre: { overflowX: 'auto', padding: 16, borderRadius: 12, background: '#020617', color: '#d1d5db' },
};
