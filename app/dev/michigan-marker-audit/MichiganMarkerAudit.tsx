'use client';

import { useEffect, useMemo, useState } from 'react';
import { getMichiganMarkerAudit } from '../../../data/michiganMarkerAudit';
import { MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY } from '../../../data/michiganArtworkCalibration';
import type { MichiganArtworkVariant } from '../../../data/michiganArtworkCalibration';

type LabelLayout = {
  dx: number;
  dy: number;
  anchor: 'start' | 'end';
  labelX: number;
  labelY: number;
  labelOverlap: boolean;
};

function useArtworkVariant(): MichiganArtworkVariant {
  const [variant, setVariant] = useState<MichiganArtworkVariant>('desktop');

  useEffect(() => {
    const mediaQuery = window.matchMedia(MICHIGAN_ARTWORK_MOBILE_MEDIA_QUERY);
    const updateVariant = () => setVariant(mediaQuery.matches ? 'mobile' : 'desktop');

    updateVariant();
    mediaQuery.addEventListener('change', updateVariant);

    return () => mediaQuery.removeEventListener('change', updateVariant);
  }, []);

  return variant;
}

function getLabelLayout(index: number, x: number, y: number, allLabels: Array<{ x: number; y: number }>): LabelLayout {
  const angle = (index * 137.508 * Math.PI) / 180;
  const radius = 4.4 + (index % 5) * 1.25;
  const dx = Math.cos(angle) * radius;
  const dy = Math.sin(angle) * radius;
  const labelX = Math.max(4, Math.min(96, x + dx));
  const labelY = Math.max(4, Math.min(96, y + dy));
  const labelOverlap = allLabels.some((label) => Math.hypot(label.x - labelX, label.y - labelY) < 4.2);

  allLabels.push({ x: labelX, y: labelY });

  return { dx: labelX - x, dy: labelY - y, labelX, labelY, labelOverlap, anchor: labelX >= x ? 'start' : 'end' };
}

export default function MichiganMarkerAudit() {
  const artworkVariant = useArtworkVariant();
  const audit = useMemo(() => getMichiganMarkerAudit(artworkVariant), [artworkVariant]);
  const labelLayouts = useMemo(() => {
    const labels: Array<{ x: number; y: number }> = [];

    return audit.records.map((record) =>
      getLabelLayout(record.eventIndex, record.position.x, record.position.y, labels),
    );
  }, [audit.records]);

  return (
    <main className="marker-audit-page">
      <section className="audit-map-shell" aria-label="Michigan all-events marker audit map">
        <picture>
          <source media="(max-width: 767px)" srcSet="/maps/michigan-atlas-clouds-mobile-2026-08.webp" />
          <img className="audit-map-image" src="/maps/michigan-atlas-clouds-desktop-2026-08.webp" alt="Michigan Atlas audit basemap" draggable={false} />
        </picture>
        <svg className="audit-leader-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {audit.records.map((record, index) => {
            const label = labelLayouts[index];
            return (
              <line
                key={`leader-${record.event.id}-${record.eventIndex}`}
                x1={record.position.x}
                y1={record.position.y}
                x2={label.labelX}
                y2={label.labelY}
                className={label.labelOverlap ? 'audit-leader audit-leader--label-overlap' : 'audit-leader'}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
        {audit.records.map((record, index) => {
          const label = labelLayouts[index];
          const statusClass = record.duplicateId
            ? 'audit-marker--duplicate-id'
            : record.overlapGroupId
              ? 'audit-marker--exact-overlap'
              : label.labelOverlap
                ? 'audit-marker--label-overlap'
                : 'audit-marker--ok';

          return (
            <button
              type="button"
              key={`${record.event.id}-${record.eventIndex}`}
              className={`audit-marker ${statusClass}`}
              style={{ left: `${record.position.x}%`, top: `${record.position.y}%` }}
              title={`${record.event.id} — ${record.event.name} — projected ${record.position.x.toFixed(3)}, ${record.position.y.toFixed(3)}`}
              aria-label={`${record.event.name}, event ID ${record.event.id}, projected ${record.position.x.toFixed(3)}, ${record.position.y.toFixed(3)}`}
            >
              <span className="audit-marker-dot" />
              <span
                className={`audit-marker-label${label.labelOverlap ? ' audit-marker-label--overlap' : ''}`}
                style={{ transform: `translate(${label.dx * 11}px, ${label.dy * 7}px)`, textAlign: label.anchor === 'start' ? 'left' : 'right' }}
              >
                {record.event.name}
                <small>{record.event.id}</small>
              </span>
            </button>
          );
        })}
      </section>

      <aside className="audit-panel" aria-label="Marker reconciliation panel">
        <h1>Michigan marker audit</h1>
        <p>Authoritative source: <code>ATLAS_EVENTS</code> from <code>data/events.ts</code>, projected with the same asset-scoped clouds-artwork calibration helper used by production.</p>
        <dl className="audit-stats">
          <div><dt>Total source-event count</dt><dd>{audit.sourceEventCount}</dd></div>
          <div><dt>Total rendered-marker count</dt><dd>{audit.renderedMarkerCount}</dd></div>
          <div><dt>Total unique event-ID count</dt><dd>{audit.uniqueEventIdCount}</dd></div>
          <div><dt>Artwork variant</dt><dd>{artworkVariant}</dd></div>
        </dl>
        <AuditList title="Duplicate event IDs" values={audit.duplicateEventIds.map((item) => `${item.id} (${item.count})`)} empty="None" />
        <AuditList title="Events missing from rendering" values={audit.missingEvents.map((event) => event.id)} empty="None" />
        <AuditList title="Events rendered more than once" values={audit.renderedMoreThanOnce.map((item) => `${item.id} (${item.count})`)} empty="None" />
        <AuditList title="Exact marker overlap groups" values={audit.exactOverlapGroups.map((group) => `${group.id}: ${group.events.map((event) => event.id).join(', ')}`)} empty="None" />
        <AuditList title="Detroit Jazz Festival findings" values={audit.detroitJazzMatches.map((event) => `${event.id} — ${event.name} — ${event.location}`)} empty="No match" />
        <AuditList title="“Landing” findings" values={audit.landingMatches.map((event) => `${event.id} — ${event.name} — ${event.location}`)} empty="No source event/profile match contains “Landing”." />
        <section className="audit-list">
          <h2>Production path audit</h2>
          <ul>
            <li>Production source is ATLAS_EVENTS; this page does not mutate source data.</li>
            <li><strong>Production clustering: enabled.</strong> Stable real-coordinate groups use these calibrated artwork positions only for their rendered anchors.</li>
            <li><strong>Production display-spacing: disabled.</strong> Marker positions use the final projected/calibrated map coordinates directly; overlap is intentionally allowed.</li>
            <li><strong>Production visible-result cap: disabled.</strong> Search result rows and mobile event rails render all matching/source events instead of silently slicing to a smaller count.</li>
            <li>Search and exact-event modes can still highlight or focus their intended event IDs, but every rendered marker remains an individual event target.</li>
          </ul>
        </section>
        <h2>Every source event</h2>
        <div className="audit-table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Name</th><th>Location</th><th>x/y</th><th>Status</th></tr></thead>
            <tbody>
              {audit.records.map((record) => (
                <tr key={`row-${record.event.id}-${record.eventIndex}`}>
                  <td>{record.event.id}</td><td>{record.event.name}</td><td>{record.event.location}</td>
                  <td>{record.position.x.toFixed(3)}, {record.position.y.toFixed(3)}</td>
                  <td>{record.duplicateId ? 'duplicate ID / same event ID rendered more than once' : record.overlapGroupId ? `rendered once / exact overlap group ${record.overlapGroupId}` : labelLayouts[record.eventIndex]?.labelOverlap ? 'rendered once / label overlap only' : 'rendered once'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </aside>
      <style jsx>{`
        .marker-audit-page { min-height: 100vh; display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 18px; padding: 18px; background: #090c12; color: #fff4dc; }
        .audit-map-shell { position: sticky; top: 18px; height: calc(100vh - 36px); overflow: hidden; border: 1px solid rgba(255, 225, 166, .22); background: radial-gradient(circle at 50% 40%, #222b35, #07090d 72%); }
        .audit-map-image { width: 100%; height: 100%; object-fit: cover; opacity: .88; user-select: none; pointer-events: none; }
        .audit-leader-layer { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 4; }
        .audit-leader { stroke: rgba(255, 235, 180, .62); stroke-width: .16; }
        .audit-leader--label-overlap { stroke: rgba(255, 117, 117, .86); stroke-dasharray: 1.2 1.2; }
        .audit-marker { position: absolute; z-index: 5; border: 0; padding: 0; background: transparent; color: inherit; transform: translate(-50%, -50%); cursor: help; }
        .audit-marker-dot { display: block; width: 14px; height: 14px; border-radius: 999px; border: 2px solid #1b0d00; background: #ffcf5a; box-shadow: 0 0 0 2px rgba(255,255,255,.75), 0 0 22px rgba(255, 185, 55, .96); }
        .audit-marker--exact-overlap .audit-marker-dot { background: #ff5b5b; box-shadow: 0 0 0 4px rgba(255,91,91,.4), 0 0 26px rgba(255, 91, 91, .95); }
        .audit-marker--duplicate-id .audit-marker-dot { background: #b178ff; }
        .audit-marker--label-overlap .audit-marker-dot { background: #70d7ff; }
        .audit-marker-label { position: absolute; left: 0; top: 0; min-width: 132px; max-width: 190px; padding: 4px 6px; border: 1px solid rgba(255, 226, 166, .45); background: rgba(9, 12, 18, .82); color: #fff3d6; font: 700 11px/1.15 system-ui, sans-serif; text-shadow: 0 1px 2px #000; pointer-events: none; }
        .audit-marker-label small { display: block; margin-top: 2px; color: #9fe7ff; font-weight: 650; }
        .audit-marker-label--overlap { border-color: rgba(255, 117, 117, .9); }
        .audit-panel { overflow: auto; max-height: calc(100vh - 36px); padding: 18px; border: 1px solid rgba(255, 225, 166, .22); background: rgba(13, 16, 23, .96); }
        h1, h2, h3 { margin: 0 0 10px; } p { color: rgba(255,244,220,.78); line-height: 1.5; } code { color: #9fe7ff; }
        .audit-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 18px 0; } .audit-stats div { padding: 10px; background: rgba(255,255,255,.06); } dt { color: rgba(255,244,220,.72); font-size: 12px; } dd { margin: 3px 0 0; font-size: 22px; font-weight: 800; }
        .audit-list { margin: 18px 0; } .audit-list ul { margin: 0; padding-left: 18px; } .audit-list li { margin: 4px 0; color: rgba(255,244,220,.86); }
        .audit-table-wrap { overflow: auto; } table { width: 100%; border-collapse: collapse; font-size: 12px; } th, td { padding: 7px; border-bottom: 1px solid rgba(255,255,255,.1); vertical-align: top; } th { text-align: left; color: #ffd98f; position: sticky; top: 0; background: #10141c; }
        @media (max-width: 980px) { .marker-audit-page { grid-template-columns: 1fr; } .audit-map-shell, .audit-panel { position: relative; top: auto; height: 72vh; max-height: none; } .audit-marker-label { font-size: 10px; min-width: 112px; } }
      `}</style>
    </main>
  );
}

function AuditList({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return (
    <section className="audit-list">
      <h2>{title}</h2>
      {values.length > 0 ? <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul> : <p>{empty}</p>}
    </section>
  );
}
