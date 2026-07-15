import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AtlasMap from '@/components/AtlasMap';
import { ATLAS_EVENTS } from '@/data/events';
import {
  MICHIGAN_COMPOSITION_SAMPLE_PLANS,
  MUSIC_PRESENTATION_PRIMARY_EVENT_IDS,
} from '@/data/mapPresentationPlan';
import { MICHIGAN_HOME_ATLAS_SEARCH_RULES } from '@/data/stateAtlasSearchRules';
import { MICHIGAN_STATE_ATLAS_CONFIG } from '@/data/stateAtlasConfig';

export const metadata: Metadata = {
  title: 'Michigan Presentation Plan Preview | Celebration Atlas Dev',
  description: 'Developer-only preview for explicit Michigan map composition plans.',
  robots: { index: false, follow: false },
};

export default function MichiganPresentationPlanPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  const musicPlan = MICHIGAN_COMPOSITION_SAMPLE_PLANS.music;
  return (
    <main style={{ minHeight: '100vh', background: '#120f0a', color: '#fff7df' }}>
      <section style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
        <p style={{ letterSpacing: '0.16em', textTransform: 'uppercase', color: '#f7c86a' }}>Developer preview</p>
        <h1 style={{ margin: '0 0 10px', fontSize: 'clamp(2rem, 5vw, 4rem)' }}>Michigan presentation-plan contract</h1>
        <p style={{ maxWidth: 760, lineHeight: 1.6, color: 'rgba(255,247,223,.78)' }}>This route renders the sample music plan as a developer-only preview. Broad production searches do not activate this plan and continue to use the clean direct-label fallback until a reviewed plan is explicitly wired in.</p>
      </section>
      <div style={{ height: '78vh', minHeight: 640 }}>
        <AtlasMap
          stateConfig={MICHIGAN_STATE_ATLAS_CONFIG}
          searchRules={MICHIGAN_HOME_ATLAS_SEARCH_RULES}
          events={ATLAS_EVENTS}
          presentationPlan={musicPlan}
        />
      </div>
      <section style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 12px', color: '#f7c86a' }}>Music plan primary callouts</h2>
        <p style={{ color: 'rgba(255,247,223,.7)' }}>Visible primary event IDs: {MUSIC_PRESENTATION_PRIMARY_EVENT_IDS.join(', ')}.</p>
        <pre style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,.18)', borderRadius: 18, padding: 18, background: 'rgba(255,255,255,.06)' }}>{JSON.stringify(musicPlan, null, 2)}</pre>
      </section>
    </main>
  );
}
