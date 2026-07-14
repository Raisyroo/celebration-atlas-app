export type InspectionEvidenceMethod = 'jsonLd' | 'metadata' | 'html';
export type InspectionConfidence = 'high' | 'medium' | 'low';

export type EventSourceEvidence = {
  field: 'name' | 'startDate' | 'endDate' | 'location' | 'description';
  value: string;
  method: InspectionEvidenceMethod;
  confidence: InspectionConfidence;
};

export type EventSourceLinkKind =
  | 'schedule'
  | 'lineup'
  | 'tickets'
  | 'registration'
  | 'plan'
  | 'faq'
  | 'rules'
  | 'other';

export type EventSourceLink = {
  label: string;
  url: string;
  kind: EventSourceLinkKind;
};

export type EventSourceContentSegment = {
  kind: 'heading' | 'paragraph' | 'listItem' | 'detail' | 'time';
  text: string;
};

export type EventSourceCandidate = {
  name: string;
  city: string;
  state: string;
  startDate: string;
  endDate: string;
  locationName: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  sourceExcerpt: string;
  confidence: number;
};

export type OfficialEventSourceInspection = {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  fetchedAt: string;
  candidate: EventSourceCandidate;
  evidence: EventSourceEvidence[];
  contentSegments: EventSourceContentSegment[];
  usefulLinks: EventSourceLink[];
  warnings: string[];
  diagnostics: {
    jsonLdEventCount: number;
    invalidJsonLdBlocks: number;
    excludedSponsorReferenceCount: number;
    downloadedBytes: number;
    contentCharacters: number;
  };
};

export type EventSourceBundleStatus =
  | 'collecting'
  | 'ready_for_synthesis'
  | 'synthesis_in_progress'
  | 'draft_ready'
  | 'archived';

export type EventSourceBundleSummary = {
  id: string;
  name: string;
  status: EventSourceBundleStatus;
  eventKey: string | null;
  candidateId: string | null;
  eventPageVersionId: string | null;
  sourceCount: number;
  claimCount: number;
  unresolvedClaimCount: number;
  discoveredLinkCount: number;
  inspectedLinkCount: number;
  scheduleCandidateCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
};

export type EventSourceCollectionSummary = {
  attempted: number;
  added: number;
  reused: number;
  failures: Array<{
    label: string;
    url: string;
    kind: EventSourceLinkKind;
    message: string;
  }>;
};
