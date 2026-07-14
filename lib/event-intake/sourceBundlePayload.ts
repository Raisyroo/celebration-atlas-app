import type {
  EventSourceEvidence,
  EventSourceLinkKind,
  OfficialEventSourceInspection,
} from './types.ts';

export type EventSourceKind =
  | 'official_home'
  | 'schedule'
  | 'lineup'
  | 'tickets'
  | 'registration'
  | 'plan'
  | 'faq'
  | 'rules'
  | 'other';

export type EventSourceClaimPayload = {
  fieldPath: string;
  value: unknown;
  normalizedText: string;
  confidence: 'unknown' | 'low' | 'medium' | 'high' | 'verified';
  confidenceScore: number;
  method: 'json_ld' | 'metadata' | 'html' | 'operator' | 'ai_assisted';
  sourceLocator: Record<string, unknown>;
};

const FIELD_PATHS: Record<EventSourceEvidence['field'], string> = {
  name: 'identity.name',
  startDate: 'timing.startDate',
  endDate: 'timing.endDate',
  location: 'location.display',
  description: 'identity.description',
};

const CONFIDENCE_SCORES = { low: 0.45, medium: 0.7, high: 0.9 } as const;
const METHODS = { jsonLd: 'json_ld', metadata: 'metadata', html: 'html' } as const;

function normalizeText(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.replace(/\s+/g, ' ').trim().toLowerCase().slice(0, 4_000);
}

function extraClaim(
  fieldPath: string,
  value: unknown,
  confidence: EventSourceClaimPayload['confidence'],
  confidenceScore: number,
  sourceLocator: Record<string, unknown>,
): EventSourceClaimPayload | null {
  const normalizedText = normalizeText(value);
  if (!normalizedText) return null;
  return {
    fieldPath,
    value,
    normalizedText,
    confidence,
    confidenceScore,
    method: 'metadata',
    sourceLocator,
  };
}

export function claimsFromInspection(
  inspection: OfficialEventSourceInspection,
  options?: {
    sourceKind?: EventSourceKind;
    includeEventIdentity?: boolean;
    includeEventDescription?: boolean;
    includeEventLocation?: boolean;
  },
) {
  const includesEventIdentity = !options?.sourceKind
    || options.sourceKind === 'official_home'
    || options.includeEventIdentity === true;
  const includesEventDescription = includesEventIdentity || options?.includeEventDescription === true;
  const includesEventLocation = includesEventIdentity
    || options?.sourceKind === 'plan'
    || options?.includeEventLocation === true;
  const retainedEvidence = inspection.evidence.filter((evidence) => (
    evidence.field === 'name'
      ? includesEventIdentity
      : evidence.field === 'description'
        ? includesEventDescription
        : evidence.field === 'location'
          ? includesEventLocation
          : includesEventIdentity
  ));
  const claims: EventSourceClaimPayload[] = retainedEvidence.map((evidence) => ({
    fieldPath: FIELD_PATHS[evidence.field],
    value: evidence.value,
    normalizedText: normalizeText(evidence.value),
    confidence: evidence.confidence,
    confidenceScore: CONFIDENCE_SCORES[evidence.confidence],
    method: METHODS[evidence.method],
    sourceLocator: { kind: evidence.method, field: evidence.field },
  }));

  const locationConfidence = inspection.evidence.some(
    (evidence) => evidence.field === 'location' && evidence.method === 'jsonLd',
  ) ? { level: 'high' as const, score: 0.9 } : { level: 'medium' as const, score: 0.7 };
  const extras = [
    includesEventLocation ? extraClaim('location.city', inspection.candidate.city, locationConfidence.level, locationConfidence.score, { kind: 'inspectionCandidate' }) : null,
    includesEventLocation ? extraClaim('location.state', inspection.candidate.state, locationConfidence.level, locationConfidence.score, { kind: 'inspectionCandidate' }) : null,
    includesEventLocation ? extraClaim('location.venue', inspection.candidate.locationName, locationConfidence.level, locationConfidence.score, { kind: 'inspectionCandidate' }) : null,
    includesEventLocation && ['MI', 'Michigan'].includes(inspection.candidate.state)
      ? extraClaim('timing.timezone', 'America/Detroit', 'verified', 1, { kind: 'stateTimezone' })
      : null,
    (!options?.sourceKind || options.sourceKind === 'official_home')
      ? extraClaim('sources.officialUrl', inspection.canonicalUrl, 'verified', 1, { kind: 'canonicalLink' })
      : null,
  ].filter((claim): claim is EventSourceClaimPayload => Boolean(claim));

  const unique = new Map<string, EventSourceClaimPayload>();
  [...claims, ...extras].forEach((claim) => {
    unique.set(`${claim.fieldPath}:${claim.normalizedText}`, claim);
  });
  return [...unique.values()];
}

export function inferEventSourceKind(url: string, hint?: EventSourceLinkKind | EventSourceKind): EventSourceKind {
  if (hint) return hint;
  const signal = new URL(url).pathname.toLowerCase();
  if (signal === '/' || !signal) return 'official_home';
  if (/schedule|calendar|program|events?/.test(signal)) return 'schedule';
  if (/lineup|performer|artist|entertainment/.test(signal)) return 'lineup';
  if (/ticket|pass|admission/.test(signal)) return 'tickets';
  if (/register|registration|entry-form/.test(signal)) return 'registration';
  if (/parking|direction|getting-there|plan|visit|travel|map/.test(signal)) return 'plan';
  if (/faq|frequently-asked/.test(signal)) return 'faq';
  if (/rule|policy|policies/.test(signal)) return 'rules';
  return 'other';
}
