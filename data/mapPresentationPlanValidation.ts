import { ATLAS_EVENTS } from './events';
import {
  MICHIGAN_MOBILE_PLACEMENT_ZONES,
  MICHIGAN_MOBILE_PROTECTED_REGIONS,
  type MapPresentationPlan,
  type PercentBounds,
} from './mapPresentationPlan';

export type MapPresentationDiagnosticSeverity = 'valid' | 'warning' | 'invalid';
export type MapPresentationDiagnostic = {
  severity: Exclude<MapPresentationDiagnosticSeverity, 'valid'>;
  code: string;
  message: string;
  subject?: string;
};
export type MapPresentationValidationResult = {
  status: MapPresentationDiagnosticSeverity;
  diagnostics: readonly MapPresentationDiagnostic[];
};

type Box = PercentBounds & { id: string };
const LABEL_WIDTH = 22;
const LABEL_HEIGHT = 6;
const MAX_SHORT_CONNECTOR = 34;
const MAX_PRIMARY_CALLOUTS = 3;
const EDGE_MARGIN = 4;

const zonesById = new Map(MICHIGAN_MOBILE_PLACEMENT_ZONES.map((zone) => [zone.id, zone]));
const eventById = new Map(ATLAS_EVENTS.map((event) => [event.id, event]));

const pointInBounds = (x: number, y: number, bounds: PercentBounds) =>
  x >= bounds.minX && x <= bounds.maxX && y >= bounds.minY && y <= bounds.maxY;

const overlaps = (a: Box, b: Box) =>
  a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;

const labelBox = (id: string, x: number, y: number): Box => ({
  id,
  minX: x - LABEL_WIDTH / 2,
  maxX: x + LABEL_WIDTH / 2,
  minY: y - LABEL_HEIGHT / 2,
  maxY: y + LABEL_HEIGHT / 2,
});

const ccw = (a: [number, number], b: [number, number], c: [number, number]) =>
  (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
const segmentsCross = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
  ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);

export function validateMapPresentationPlan(plan: MapPresentationPlan): MapPresentationValidationResult {
  const diagnostics: MapPresentationDiagnostic[] = [];
  const boxes: Box[] = [];
  const connectors: { id: string; from: [number, number]; to: [number, number] }[] = [];
  const seenEventIds = new Set<string>();
  const checkEventId = (eventId: string, subject: string) => {
    seenEventIds.add(eventId);
    if (!eventById.has(eventId)) diagnostics.push({ severity: 'invalid', code: 'unknown-event-id', subject, message: `${subject} references unknown event ID “${eventId}”.` });
  };

  plan.visibleEventIds.forEach((id) => checkEventId(id, `visibleEventIds:${id}`));
  if (plan.selectedEventId) checkEventId(plan.selectedEventId, 'selectedEventId');

  const primaryCount = plan.callouts?.filter((callout) => callout.priority === 'primary').length ?? 0;
  if (primaryCount > MAX_PRIMARY_CALLOUTS) diagnostics.push({ severity: 'warning', code: 'too-many-primary-callouts', message: `${primaryCount} primary callouts exceeds the recommended maximum of ${MAX_PRIMARY_CALLOUTS}.` });

  plan.callouts?.forEach((callout) => {
    checkEventId(callout.eventId, `callout:${callout.eventId}`);
    const zone = zonesById.get(callout.placementZone);
    if (!zone) {
      diagnostics.push({ severity: 'invalid', code: 'unknown-zone', subject: callout.eventId, message: `Callout uses unknown zone “${callout.placementZone}”.` });
      return;
    }
    const x = callout.labelXPercent ?? (zone.minX + zone.maxX) / 2;
    const y = callout.labelYPercent ?? (zone.minY + zone.maxY) / 2;
    if (!pointInBounds(x, y, zone)) diagnostics.push({ severity: 'invalid', code: 'label-outside-safe-bounds', subject: callout.eventId, message: `${callout.eventId} label at ${x}, ${y} is outside ${zone.id}.` });
    const box = labelBox(callout.eventId, x, y);
    boxes.push(box);
    MICHIGAN_MOBILE_PROTECTED_REGIONS.filter((region) => region.id !== 'map-edges').forEach((region) => {
      if (overlaps(box, { ...region, id: region.id })) diagnostics.push({ severity: 'invalid', code: 'label-overlaps-protected-ui', subject: callout.eventId, message: `${callout.eventId} label overlaps ${region.label}.` });
    });
    if (box.minX < EDGE_MARGIN || box.maxX > 100 - EDGE_MARGIN || box.minY < EDGE_MARGIN || box.maxY > 100 - EDGE_MARGIN) diagnostics.push({ severity: 'invalid', code: 'label-overlaps-map-edge', subject: callout.eventId, message: `${callout.eventId} label is inside map edge/clipping margin.` });
    if (callout.connector === 'short-elbow') {
      if (!zone.connectorAllowed) diagnostics.push({ severity: 'warning', code: 'connector-not-allowed-in-zone', subject: callout.eventId, message: `${zone.id} is not intended for connectors.` });
      const event = eventById.get(callout.eventId);
      if (event) {
        const length = Math.hypot(x - event.x, y - event.y);
        if (length > MAX_SHORT_CONNECTOR) diagnostics.push({ severity: 'invalid', code: 'connector-too-long', subject: callout.eventId, message: `${callout.eventId} connector length ${length.toFixed(1)}% exceeds ${MAX_SHORT_CONNECTOR}%.` });
        connectors.push({ id: callout.eventId, from: [event.x, event.y], to: [x, y] });
      }
    }
  });

  plan.overflowGroups?.forEach((group) => {
    group.eventIds.forEach((id) => checkEventId(id, `overflowGroup:${group.id}`));
    const zone = zonesById.get(group.placementZone);
    if (!zone) diagnostics.push({ severity: 'invalid', code: 'unknown-zone', subject: group.id, message: `Overflow group uses unknown zone “${group.placementZone}”.` });
    else boxes.push(labelBox(group.id, group.labelXPercent ?? (zone.minX + zone.maxX) / 2, group.labelYPercent ?? (zone.minY + zone.maxY) / 2));
  });

  for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) if (overlaps(boxes[i], boxes[j])) diagnostics.push({ severity: 'warning', code: 'label-to-label-overlap', subject: `${boxes[i].id}/${boxes[j].id}`, message: `${boxes[i].id} overlaps ${boxes[j].id}.` });
  for (let i = 0; i < connectors.length; i += 1) for (let j = i + 1; j < connectors.length; j += 1) if (segmentsCross(connectors[i].from, connectors[i].to, connectors[j].from, connectors[j].to)) diagnostics.push({ severity: 'invalid', code: 'connector-crossing', subject: `${connectors[i].id}/${connectors[j].id}`, message: `${connectors[i].id} connector crosses ${connectors[j].id}.` });

  const status = diagnostics.some((d) => d.severity === 'invalid') ? 'invalid' : diagnostics.some((d) => d.severity === 'warning') ? 'warning' : 'valid';
  return { status, diagnostics };
}
