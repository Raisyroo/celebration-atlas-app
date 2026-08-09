'use client';

import Image from 'next/image';
import { type PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ATLAS_EVENTS } from '@/data/events';
import {
  MICHIGAN_COMPOSITION_SAMPLE_PLANS,
  MICHIGAN_MOBILE_PLACEMENT_ZONES,
  MICHIGAN_MOBILE_PROTECTED_REGIONS,
  type MapAnchorVisibility,
  type MapCalloutConnector,
  type MapCalloutPriority,
  type MapLabelAlignment,
  type MapLabelStyle,
  type MapPresentationCallout,
  type MapPresentationPlan,
} from '@/data/mapPresentationPlan';
import { validateMapPresentationPlan } from '@/data/mapPresentationPlanValidation';

const plans = MICHIGAN_COMPOSITION_SAMPLE_PLANS;
type Scenario = keyof typeof plans;
const eventById = new Map(ATLAS_EVENTS.map((event) => [event.id, event]));
const zonesById = new Map(MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => [zone.id, zone]));

const clonePlan = (plan: MapPresentationPlan): MapPresentationPlan => JSON.parse(JSON.stringify(plan));
const roundPercent = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 10) / 10;
const labelAlignments: MapLabelAlignment[] = ['left', 'right', 'center'];
const labelStyles: MapLabelStyle[] = ['text', 'icon-text', 'thumbnail-text'];
const connectors: MapCalloutConnector[] = ['none', 'short-elbow'];
const priorities: MapCalloutPriority[] = ['primary', 'secondary'];
const anchorVisibilities: MapAnchorVisibility[] = ['ambient-light', 'subtle-dot', 'emphasized'];
const MICHIGAN_COMPOSITION_SANDBOX_SCROLL_CLASS = 'dev-michigan-composition-sandbox-scroll';

export default function MichiganCompositionSandbox() {
  const [scenario, setScenario] = useState<Scenario>('music');
  const [editedPlans, setEditedPlans] = useState<Partial<Record<Scenario, MapPresentationPlan>>>({});
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const plan: MapPresentationPlan = editedPlans[scenario] ?? plans[scenario];
  const isEdited = Boolean(editedPlans[scenario]);
  const validation = useMemo(() => validateMapPresentationPlan(plan), [plan]);
  const selectedCallout = plan.callouts?.find((callout) => callout.eventId === selectedEventId) ?? null;
  const overflowEventIds = new Set(plan.overflowGroups?.flatMap((group) => [...group.eventIds]) ?? []);

  useEffect(() => {
    document.documentElement.classList.add(MICHIGAN_COMPOSITION_SANDBOX_SCROLL_CLASS);
    document.body.classList.add(MICHIGAN_COMPOSITION_SANDBOX_SCROLL_CLASS);

    return () => {
      document.documentElement.classList.remove(MICHIGAN_COMPOSITION_SANDBOX_SCROLL_CLASS);
      document.body.classList.remove(MICHIGAN_COMPOSITION_SANDBOX_SCROLL_CLASS);
    };
  }, []);

  const updatePlan = (updater: (draft: MapPresentationPlan) => void) => {
    setEditedPlans((current) => {
      const draft = clonePlan(current[scenario] ?? plans[scenario]);
      updater(draft);
      return { ...current, [scenario]: draft };
    });
  };

  const updateSelectedCallout = (updates: Partial<MapPresentationCallout>) => {
    if (!selectedEventId) return;
    updatePlan((draft) => {
      draft.callouts = draft.callouts?.map((callout) => callout.eventId === selectedEventId ? { ...callout, ...updates } : callout) ?? [];
    });
  };

  const dragLabel = (event: ReactPointerEvent<HTMLDivElement>, eventId: string) => {
    event.preventDefault();
    setSelectedEventId(eventId);
    event.currentTarget.setPointerCapture(event.pointerId);
    const moveLabel = (clientX: number, clientY: number) => {
      const bounds = previewRef.current?.getBoundingClientRect();
      if (!bounds) return;
      updatePlan((draft) => {
        draft.callouts = draft.callouts?.map((callout) => callout.eventId === eventId ? {
          ...callout,
          labelXPercent: roundPercent(((clientX - bounds.left) / bounds.width) * 100),
          labelYPercent: roundPercent(((clientY - bounds.top) / bounds.height) * 100),
        } : callout) ?? [];
      });
    };
    moveLabel(event.clientX, event.clientY);
  };

  const moveSelectedToOverflow = () => {
    if (!selectedEventId) return;
    updatePlan((draft) => {
      const existingGroup = draft.overflowGroups?.[0] ?? { id: `${scenario}-overflow`, eventIds: [], label: '+0', placementZone: 'east-water-upper' as const, countStyle: 'pill' as const, labelXPercent: 82, labelYPercent: 34 };
      const overflowIds = Array.from(new Set([...existingGroup.eventIds, selectedEventId]));
      draft.visibleEventIds = draft.visibleEventIds.filter((id) => id !== selectedEventId);
      draft.callouts = draft.callouts?.filter((callout) => callout.eventId !== selectedEventId) ?? [];
      draft.overflowGroups = [{ ...existingGroup, eventIds: overflowIds, label: `+${overflowIds.length}` }, ...(draft.overflowGroups ?? []).slice(1)];
    });
    setSelectedEventId(null);
  };

  const promoteOverflowEvent = (eventId: string) => {
    updatePlan((draft) => {
      draft.visibleEventIds = Array.from(new Set([...draft.visibleEventIds, eventId]));
      draft.overflowGroups = draft.overflowGroups?.map((group) => {
        const eventIds = group.eventIds.filter((id) => id !== eventId);
        return { ...group, eventIds, label: `+${eventIds.length}` };
      }).filter((group) => group.eventIds.length > 0) ?? [];
      if (!draft.callouts?.some((callout) => callout.eventId === eventId)) {
        draft.callouts = [...(draft.callouts ?? []), { eventId, placementZone: 'east-water-upper', labelXPercent: 82, labelYPercent: 34, labelAlignment: 'center', labelStyle: 'text', connector: 'none', anchorVisibility: 'subtle-dot', priority: 'secondary' }];
      }
    });
    setSelectedEventId(eventId);
  };

  return (
    <main className="michigan-composition-sandbox" style={{ minHeight: '100vh', background: '#100d09', color: '#fff7df', padding: 20 }}>
      <header style={{ maxWidth: 1180, margin: '0 auto 18px' }}>
        <p style={{ color: '#f7c86a', letterSpacing: '.16em', textTransform: 'uppercase' }}>Developer-only sandbox</p>
        <h1 style={{ margin: 0, fontSize: 'clamp(2rem, 5vw, 4rem)' }}>Michigan composition sandbox</h1>
        <p style={{ maxWidth: 900, color: 'rgba(255,247,223,.76)', lineHeight: 1.55 }}>Sample plans are preview-only. Edits are local to this developer route, do not change production, and do not activate any plan in normal map behavior.</p>
      </header>
      <section className="michigan-composition-sandbox__layout" style={{ maxWidth: 1180, margin: '0 auto', display: 'grid', gridTemplateColumns: 'minmax(320px, 430px) 1fr', gap: 18 }}>
        <div>
          <label style={{ display: 'block', marginBottom: 8, color: '#f7c86a' }}>Sample query scenario</label>
          <select value={scenario} onChange={(event) => { setScenario(event.target.value as Scenario); setSelectedEventId(null); }} style={{ width: '100%', padding: 12, borderRadius: 12, background: '#21170f', color: '#fff7df', border: '1px solid rgba(247,200,106,.45)' }}>
            {(Object.keys(plans) as Scenario[]).map((key) => <option key={key}>{key}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '12px 0' }}>
            <button type="button" onClick={() => { setEditedPlans((current) => { const next = { ...current }; delete next[scenario]; return next; }); setSelectedEventId(null); }} style={{ padding: '9px 12px', borderRadius: 999, border: '1px solid #f7c86a', background: 'transparent', color: '#fff7df' }}>Reset Sample</button>
            <span style={{ color: isEdited ? '#ffd76a' : 'rgba(255,247,223,.62)' }}>{isEdited ? 'Edited locally in sandbox' : 'Original sample plan'}</span>
          </div>
          <div ref={previewRef} style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 28, overflow: 'hidden', position: 'relative', aspectRatio: '9 / 16', background: '#1d2b26', touchAction: 'none' }}>
            <Image src="/maps/michigan-atlas-clouds-mobile-2026-08.webp" alt="Michigan mobile artwork frame" fill sizes="430px" style={{ objectFit: 'cover', objectPosition: 'center top', opacity: .9 }} priority />
            {MICHIGAN_MOBILE_PROTECTED_REGIONS.filter((region) => region.id !== 'map-edges').map((region) => <div key={region.id} title={region.label} style={{ position: 'absolute', left: `${region.minX}%`, top: `${region.minY}%`, width: `${region.maxX - region.minX}%`, height: `${region.maxY - region.minY}%`, border: '1px dashed rgba(255,90,90,.55)', background: 'rgba(255,50,50,.09)' }} />)}
            {MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => <div key={zone.id} title={zone.reservedSpaceNotes} style={{ position: 'absolute', left: `${zone.minX}%`, top: `${zone.minY}%`, width: `${zone.maxX - zone.minX}%`, height: `${zone.maxY - zone.minY}%`, border: '1px solid rgba(96,214,255,.42)', background: 'rgba(96,214,255,.05)', fontSize: 9, color: '#bdefff' }}>{zone.id}</div>)}
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>{plan.callouts?.filter((callout) => callout.connector === 'short-elbow').map((callout) => { const event = eventById.get(callout.eventId); const zone = zonesById.get(callout.placementZone); if (!event || !zone) return null; const x = callout.labelXPercent ?? (zone.minX + zone.maxX) / 2; const y = callout.labelYPercent ?? (zone.minY + zone.maxY) / 2; const bendX = event.x + Math.sign(x - event.x) * Math.min(Math.abs(x - event.x) * .55, 8); return <polyline key={callout.eventId} points={`${event.x},${event.y} ${bendX},${event.y} ${x},${y}`} fill="none" stroke="#ffe18a" strokeWidth=".5" />; })}</svg>
            {plan.visibleEventIds.map((id) => { const event = eventById.get(id); if (!event) return null; return <span key={id} title={event.name} style={{ position: 'absolute', left: `${event.x}%`, top: `${event.y}%`, transform: 'translate(-50%,-50%)', width: 10, height: 10, borderRadius: 99, background: '#ffd76a', boxShadow: '0 0 18px #ffd76a' }} />; })}
            {plan.callouts?.map((callout) => { const event = eventById.get(callout.eventId); const zone = zonesById.get(callout.placementZone); if (!event || !zone) return null; const x = callout.labelXPercent ?? (zone.minX + zone.maxX) / 2; const y = callout.labelYPercent ?? (zone.minY + zone.maxY) / 2; const selected = selectedEventId === callout.eventId; return <div key={callout.eventId} role="button" tabIndex={0} onClick={() => setSelectedEventId(callout.eventId)} onPointerDown={(pointerEvent) => dragLabel(pointerEvent, callout.eventId)} onPointerMove={(pointerEvent) => { if (pointerEvent.currentTarget.hasPointerCapture(pointerEvent.pointerId)) dragLabel(pointerEvent, callout.eventId); }} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', maxWidth: '34%', padding: '5px 7px', borderRadius: 999, border: `2px solid ${selected ? '#74f5ff' : callout.priority === 'primary' ? '#ffd76a' : 'rgba(255,255,255,.45)'}`, background: selected ? 'rgba(20,70,82,.94)' : 'rgba(17,12,7,.82)', fontSize: 10, lineHeight: 1.15, cursor: 'grab', textAlign: callout.labelAlignment ?? zone.preferredAlign }}>{callout.labelStyle !== 'text' ? '✦ ' : ''}{event.name}</div>; })}
            {plan.overflowGroups?.map((group) => { const zone = zonesById.get(group.placementZone); if (!zone) return null; const x = group.labelXPercent ?? (zone.minX + zone.maxX) / 2; const y = group.labelYPercent ?? (zone.minY + zone.maxY) / 2; return <div key={group.id} title={group.eventIds.join(', ')} style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)', padding: '7px 10px', borderRadius: 14, background: '#233f58', color: '#dff5ff', border: '1px solid #8adfff', fontSize: 11 }}>{group.label}</div>; })}
          </div>
        </div>
        <aside style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}>
            <h2 style={{ marginTop: 0 }}>Selected callout</h2>
            {!selectedCallout ? <p>Click a visible callout to edit it. Drag the selected label to update explicit X/Y only; the event anchor stays unchanged.</p> : <div style={{ display: 'grid', gap: 10 }}>
              <strong>{eventById.get(selectedCallout.eventId)?.name ?? selectedCallout.eventId}</strong>
              <label>Placement zone<select value={selectedCallout.placementZone} onChange={(event) => updateSelectedCallout({ placementZone: event.target.value as MapPresentationCallout['placementZone'] })}>{MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => <option key={zone.id}>{zone.id}</option>)}</select></label>
              <label>X %<input type="number" min="0" max="100" step="0.1" value={selectedCallout.labelXPercent ?? 0} onChange={(event) => updateSelectedCallout({ labelXPercent: Number(event.target.value) })} /></label>
              <label>Y %<input type="number" min="0" max="100" step="0.1" value={selectedCallout.labelYPercent ?? 0} onChange={(event) => updateSelectedCallout({ labelYPercent: Number(event.target.value) })} /></label>
              <label>Alignment<select value={selectedCallout.labelAlignment ?? zonesById.get(selectedCallout.placementZone)?.preferredAlign ?? 'center'} onChange={(event) => updateSelectedCallout({ labelAlignment: event.target.value as MapLabelAlignment })}>{labelAlignments.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Style<select value={selectedCallout.labelStyle} onChange={(event) => updateSelectedCallout({ labelStyle: event.target.value as MapLabelStyle })}>{labelStyles.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Connector<select value={selectedCallout.connector} onChange={(event) => updateSelectedCallout({ connector: event.target.value as MapCalloutConnector })}>{connectors.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Priority<select value={selectedCallout.priority} onChange={(event) => updateSelectedCallout({ priority: event.target.value as MapCalloutPriority })}>{priorities.map((value) => <option key={value}>{value}</option>)}</select></label>
              <label>Anchor visibility<select value={selectedCallout.anchorVisibility} onChange={(event) => updateSelectedCallout({ anchorVisibility: event.target.value as MapAnchorVisibility })}>{anchorVisibilities.map((value) => <option key={value}>{value}</option>)}</select></label>
              <button type="button" onClick={moveSelectedToOverflow}>Move visible event into overflow</button>
            </div>}
          </section>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}>
            <h2 style={{ marginTop: 0 }}>Overflow editor</h2>
            {overflowEventIds.size === 0 ? <p>No overflow events.</p> : <div style={{ display: 'grid', gap: 8 }}>{Array.from(overflowEventIds).map((id) => <button key={id} type="button" onClick={() => promoteOverflowEvent(id)}>Promote {eventById.get(id)?.name ?? id}</button>)}</div>}
          </section>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}>
            <h2 style={{ marginTop: 0 }}>Validation: <span style={{ color: validation.status === 'valid' ? '#7dffa0' : validation.status === 'warning' ? '#ffd76a' : '#ff8585' }}>{validation.status}</span></h2>
            {validation.diagnostics.length === 0 ? <p>No diagnostics. Proposed plan is valid.</p> : <ul>{validation.diagnostics.map((diagnostic, index) => <li key={`${diagnostic.code}-${index}`}><strong>{diagnostic.severity}</strong> · {diagnostic.code}: {diagnostic.message}</li>)}</ul>}
          </section>
          <section style={{ border: '1px solid rgba(255,255,255,.14)', borderRadius: 18, padding: 16, background: 'rgba(255,255,255,.06)' }}><h2 style={{ marginTop: 0 }}>Copyable JSON plan</h2><pre style={{ maxHeight: 420, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{JSON.stringify(plan, null, 2)}</pre></section>
        </aside>
      </section>
    </main>
  );
}
