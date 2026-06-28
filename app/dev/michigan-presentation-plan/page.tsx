import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AtlasMap from '@/components/AtlasMap';
import { EXAMPLE_MICHIGAN_PRESENTATION_PLAN } from '@/data/mapPresentationPlan';

export const metadata: Metadata = {
  title: 'Michigan Presentation Plan Preview | Celebration Atlas Dev',
  description: 'Developer-only preview for explicit Michigan map composition plans.',
  robots: { index: false, follow: false },
};

export default function MichiganPresentationPlanPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  return (
    <main style={{ minHeight: '100vh', background: '#120f0a', color: '#fff7df' }}>
      <section style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
        <p style={{ letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f7c86a' }}>
          Developer preview
        </p>
        <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(2rem, 5vw, 4rem)' }}>
          Michigan presentation-plan contract
        </h1>
        <p style={{ maxWidth: 760, lineHeight: 1.6, color: 'rgba(255,247,223,.78)' }}>
          These entries are example composition outputs only. They demonstrate one direct near-anchor label,
          two explicitly planned short-elbow water callouts, and one compact +N cluster; they are not automatic
          placement rules and do not enable runtime AI planning.
        </p>
      </section>
      <div style={{ height: '78vh', minHeight: 640 }}>
        <AtlasMap presentationPlan={EXAMPLE_MICHIGAN_PRESENTATION_PLAN} />
      </div>
      <section style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
        <pre style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,.18)', borderRadius: 18, padding: 18, background: 'rgba(255,255,255,.06)' }}>
          {JSON.stringify(EXAMPLE_MICHIGAN_PRESENTATION_PLAN, null, 2)}
        </pre>
      </section>
    </main>
  );
}
