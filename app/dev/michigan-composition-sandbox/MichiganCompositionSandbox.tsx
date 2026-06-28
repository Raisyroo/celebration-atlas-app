'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { ATLAS_EVENTS } from '@/data/events';
import { MICHIGAN_COMPOSITION_SAMPLE_PLANS, MICHIGAN_MOBILE_PLACEMENT_ZONES, MICHIGAN_MOBILE_PROTECTED_REGIONS, type MapPresentationPlan } from '@/data/mapPresentationPlan';
import { validateMapPresentationPlan } from '@/data/mapPresentationPlanValidation';

const plans = MICHIGAN_COMPOSITION_SAMPLE_PLANS;
type Scenario = keyof typeof plans;
const eventById = new Map(ATLAS_EVENTS.map((event) => [event.id, event]));

export default function MichiganCompositionSandbox() {
  const [scenario, setScenario] = useState<Scenario>('music');
  const plan: MapPresentationPlan = plans[scenario];
  const validation = useMemo(() => validateMapPresentationPlan(plan), [plan]);
  const zonesById = new Map(MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => [zone.id, zone]));

  return (
    <main style={{ minHeight: '100vh', background: '#100d09', color: '#fff7df', padding: 20 }}>
      <header style={{ maxWidth: 1180, margin: '0 auto 18px' }}>
        <p style={{ color: '#f7c86a', letterSpacing: '.16em', textTransform: 'uppercase' }}>Developer-only sandbox</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 4rem)' }}>Michigan composition sandbox</h1>
        <p style={{ maxWidth: 900, color: 'rgba(255,247,223,.76)', lineHeight: 1.55 }}>Sample plans exercise the typed AI-ready contract, reusable safe zones, overflow clusters, short-elbow connectors, and deterministic validation. They are preview data only and are not activated in normal production map behavior.</p>
      </header>
      <section style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(320px, 430px) 1fr', gap: 18 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, color: '#f7c86a' }}>Sample query scenario</label>
          <select value={scenario} onChange={(event) => setScenario(event.target.value as Scenario)} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#21170f', color: '#fff7df', border: '1px solid rgba(247,200,106,.45)' }}>
            {(Object.keys(plans) as Scenario[]).map((key) => <option key={key}>{key}</option>)}
          </select>
          <div style={{ marginTop: 16, border: '1px solid rgba(255,255,255,.14)', borderRadius: 28, overflow: 'hidden', position: 'relative', aspectRatio: '9 / 16', background: '#1d2b26' }}>
            <Image src="/maps/michigan-atlas-base-tall.webp" alt="Michigan mobile artwork frame" fill sizes="430px" style={{ objectFit: 'cover', opacity: .9 }} priority />
            {MICHIGAN_MOBILE_PROTECTED_REGIONS.filter((region) => region.id !== 'map-edges').map((region) => <div key={region.id} title={region.label} style={{ position: 'absolute', left: `${region.minX}%`, top: `${region.minY}%`, width: `${region.maxX - region.minX}%`, height: `${region.maxY - region.minY}%`, border: '1px dashed rgba(255,90,90,.55)', background: 'rgba(255,50,50,.09)' }} />)}
            {MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => <div key={zone.id} title={zone.reservedSpaceNotes} style={{ position: 'absolute', left: `${zone.minX}%`, top: `${zone.minY}%`, width: `${zone.maxX - zone.minX}%`, height: `${zone.maxY - zone.minY}%`, border: '1px solid rgba(96,214,255,.42)', background: 'rgba(96,214,255,.05)', fontSize: 9, color: '#bdefff' }}>{zone.id}</div>)}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
              {plan.callouts?.filter((callout) => callout.connector === 'short-elbow').map((callout) => {
                const event = eventById.get(callout.eventId); if (!event) return null;
                const zone = zonesById.get(callout.placementZone); if (!zone) return null;
                const x = callout.labelXPercent ?? (zone.minX + zone.maxX) / 2; const y = callout.labelYPercent ?? (zone.minY + zone.maxY) / 2;
                const bendX = event.x + Math.sign(x - event.x) * Math.min(Math.abs(x - event.x) * .55, 8);
                return <polyline key={callout.eventId} points={`${event.x},${event.y} ${bendX},${event.y} ${x},${y}`} fill="none" stroke="#ffe18a" strokeWidth=".5" />;
              })}
            </svg>
            {plan.visibleEventIds.map((id) => { const event = eventById.get(id); if (!event) return null; return <span key={id} title={event.name} style={{ position: 'absolute', left: `${event.x}%`, top: `${event.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: 99, background: '#ffd76a', boxShadow: '0 0 18px #ffd76a' }} />; })}
            {plan.callouts?.map((callout) => { const event = eventById.get(callout.eventId); const zone = zonesById.get(callout.placementZone); if (!event || !zone) return null; const x = callout.labelXPercent ?? (zone.minX + zone.maxX) / 2; const y = callout.labelYPercent ?? (zone.minY + zone.maxY) / 2; return <div key={callout.eventId} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', maxWidth: '34%', padding: '5px 7px', borderRadius: 999, border: `1px solid ${callout.priority === 'primary' ? '#ffd76a' : 'rgba(255,255,255,.45)'}`, background: 'rgba(17,12,7,.82)', fontSize: 10, lineHeight: 1.15 }}>{callout.labelStyle !== 'text' ? '✦ ' : ''}{event.name}</div>; })}
            {plan.overflowGroups?.map((group) => { const zone = zonesById.get(group.placementZone); if (!zone) return null; const x = group.labelXPercent ?? (zone.minX + zone.maxX) / 2; const y = group.labelYPercent ?? (zone.minY + zone.maxY) / 2; return <div key={group.id} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', padding: '7px 10px', borderRadius: 14, background: '#233f58', color: '#dff5ff', border: '1px solid #8adfff', fontSize: 11 }}>{group.label}</div>; })}
          </div>
        </div>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}>
            <h2 style={{ marginTop: 0 }}>Validation: <span style={{ color: validation.status === 'valid' ? '#7dffa0' : validation.status === 'warning' ? '#ffd76a' : '#ff8585' }}>{validation.status}</span></h2>
            {validation.diagnostics.length === 0 ? <p>No diagnostics. Proposed plan is valid.</p> : <ul>{validation.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${index}`}><strong>{diagnostic.severity}</strong> · {diagnostic.code}: {diagnostic.message}</li>)}</ul>}
          </section>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}>
            <h2 style={{ marginTop: 0 }}>Reusable placement zones</h2>
            <p>{MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => zone.id).join(', ')}</p>
          </section>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}>
            <h2 style={{ marginTop: 0 }}>Copyable JSON plan</h2>
            <pre style={{ maxHeight: 420, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(plan, null, 2)}</pre>
          </section>
        </aside>
      </section>
    </main>
  );
}
