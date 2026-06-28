import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AtlasMap from '@/components/AtlasMap';
import { ATLAS_EVENTS } from '@/data/events';
import {
  EXAMPLE_MICHIGAN_PRESENTATION_PLAN,
  MUSIC_MOBILE_PRESENTATION_PLAN,
  MUSIC_PRESENTATION_PRIMARY_EVENT_IDS,
  resolveMobileBroadSearchPresentationPlan,
} from '@/data/mapPresentationPlan';

export const metadata: Metadata = {
  title: 'Michigan Presentation Plan Preview | Celebration Atlas Dev',
  description: 'Developer-only preview for explicit Michigan map composition plans.',
  robots: { index: false, follow: false },
};

export default function MichiganPresentationPlanPage() {
  if (process.env.NODE_ENV === 'production') {
    notFound();
  }

  const musicPreviewMatchingIds = new Set(
    ATLAS_EVENTS.filter((event) =>
      [
        event.name,
        event.location,
        event.category,
        event.atmosphereLabel,
        event.blurb,
        ...(event.searchAliases ?? []),
      ]
        .join(' ')
        .toLowerCase()
        .includes('music'),
    ).map((event) => event.id),
  );
  const resolvedMusicPreviewPlan = resolveMobileBroadSearchPresentationPlan({
    query: 'music',
    matchingEventIds: musicPreviewMatchingIds,
  });
  const musicOverflowEventIds =
    resolvedMusicPreviewPlan?.clusters?.flatMap((cluster) => cluster.eventIds) ?? [];

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
          These entries are deterministic composition outputs only. The music plan demonstrates five
          intentionally selected mobile callouts with manual label positions; they are not automatic
          placement rules and do not enable runtime AI planning.
        </p>
      </section>
      <div style={{ height: '78vh', minHeight: 640 }}>
        <AtlasMap presentationPlan={MUSIC_MOBILE_PRESENTATION_PLAN} />
      </div>
      <section style={{ padding: '24px', maxWidth: 980, margin: '0 auto' }}>
        <h2 style={{ margin: '0 0 12px', color: '#f7c86a' }}>
          Music plan primary callouts
        </h2>
        <p style={{ color: 'rgba(255,247,223,.7)' }}>
          Visible primary event IDs: {MUSIC_PRESENTATION_PRIMARY_EVENT_IDS.join(', ')}.
        </p>
        <ul style={{ lineHeight: 1.7, color: 'rgba(255,247,223,.82)' }}>
          {MUSIC_MOBILE_PRESENTATION_PLAN.callouts?.map((callout) => (
            <li key={callout.eventId}>
              <strong>{callout.eventId}</strong> — mode {callout.labelPlacement}
              {callout.labelXPercent !== undefined && callout.labelYPercent !== undefined
                ? ` at ${callout.labelXPercent}%, ${callout.labelYPercent}%`
                : ''}
            </li>
          ))}
        </ul>
        <p style={{ color: 'rgba(255,247,223,.7)' }}>
          Omitted/overflow event IDs in this preview: {musicOverflowEventIds.length > 0
            ? musicOverflowEventIds.join(', ')
            : 'none'}
          . Overflow IDs are resolved from the submitted music search at runtime and displayed as one
          compact overflow cluster when any non-primary matches are present.
        </p>
        <pre style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,.18)', borderRadius: 18, padding: 18, background: 'rgba(255,255,255,.06)' }}>
          {JSON.stringify(
            {
              music: MUSIC_MOBILE_PRESENTATION_PLAN,
              contractExample: EXAMPLE_MICHIGAN_PRESENTATION_PLAN,
            },
            null,
            2,
          )}
        </pre>
      </section>
    </main>
  );
}
