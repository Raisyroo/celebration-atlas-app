import type { EventPageManifest } from '../../data/eventPageManifestTypes.ts';

export type SourceClaimConfidence = 'unknown' | 'low' | 'medium' | 'high' | 'verified';
export type SourceClaimReviewStatus = 'unreviewed' | 'accepted' | 'rejected' | 'superseded';

export type SynthesisContentSegment = {
  kind: 'heading' | 'paragraph' | 'listItem' | 'detail' | 'time';
  text: string;
};

export type EditorialSourceRole =
  | 'identity'
  | 'schedule'
  | 'history'
  | 'personalities'
  | 'participants'
  | 'competition'
  | 'program'
  | 'gallery'
  | 'planning'
  | 'other';

export type EditorialScheduleStatus =
  | 'current_published'
  | 'current_partial'
  | 'current_pending_with_reference'
  | 'current_pending'
  | 'completed_archive'
  | 'unknown';

export type EditorialPageMode =
  | 'simple_event'
  | 'current_program_festival'
  | 'reference_rich_festival'
  | 'tradition_rich_festival'
  | 'experience_rich_event';

export type EditorialReferenceItem = {
  id: string;
  title: string;
  timeText: string;
  sourceSnapshotIds: string[];
};

export type EditorialReferenceGroup = {
  id: string;
  label: string;
  title: string;
  items: EditorialReferenceItem[];
};

export type EditorialTraditionCandidate = {
  id: string;
  kind: 'pageantry' | 'parade' | 'heritage' | 'harvest' | 'community';
  kicker: string;
  title: string;
  summary: string;
  latestObserved?: string;
  currentStatus?: string;
  sourceSnapshotIds: string[];
};

export type EditorialHighlightCandidate = {
  id: string;
  kind: 'artists' | 'contests' | 'liveArt' | 'entertainment' | 'marketplace' | 'heritage' | 'community';
  kicker: string;
  title: string;
  summary: string;
  observedEdition?: string;
  sourceSnapshotIds: string[];
};

export type EditorialPlan = {
  mode: EditorialPageMode;
  currentEditionYear: number | null;
  scheduleStatus: EditorialScheduleStatus;
  sourceRoles: Array<{
    snapshotId: string;
    role: EditorialSourceRole;
  }>;
  referenceSchedule: {
    observedYear: number;
    groups: EditorialReferenceGroup[];
  } | null;
  traditions: EditorialTraditionCandidate[];
  highlights: EditorialHighlightCandidate[];
  recommendedTabs: Array<'why-go' | 'schedule' | 'highlights' | 'traditions' | 'plan'>;
  qualityChecks: {
    truthLayersSeparated: boolean;
    currentScheduleProtected: boolean;
    referenceScheduleCaveated: boolean;
    traditionCoverage: boolean;
    highlightCoverage: boolean;
    editorialSourceCoverage: boolean;
  };
  warnings: string[];
};

export type EditorialReviewSummary = {
  mode: EditorialPageMode;
  scheduleStatus: EditorialScheduleStatus;
  currentEditionYear: number | null;
  referenceYear: number | null;
  referenceItemCount: number;
  traditionCount: number;
  highlightCount: number;
  recommendedTabs: string[];
  qualityChecks: EditorialPlan['qualityChecks'];
};

export type ModelEditorialReviewSummary = {
  parentSynthesisId: string;
  provider: string;
  model: string;
  promptVersion: string;
  proposedRewriteCount: number;
  appliedRewriteCount: number;
  rejectedRewriteCount: number;
  changedTargets: string[];
  addedAudienceGroupCount: number;
  addedSpotlight: boolean;
  authoringMode?: 'bounded_rewrite' | 'full_manifest';
  authoredModuleIds?: string[];
  authoredNavigationIds?: string[];
  authoredScoutSuggestionIds?: string[];
  rejectedClaimCount?: number;
  qualityChecks: {
    immutableFactsLocked: boolean;
    sourceIdsVerified: boolean;
    numericClaimsGrounded: boolean;
    sponsorLanguageExcluded: boolean;
    researchNarrationExcluded: boolean;
    spotlightNarrativeSourceRequired: boolean;
    editorialQualityPassed: boolean;
    manifestValid: boolean;
    fullManifestAuthored?: boolean;
    scheduleFactsLocked?: boolean;
    sourceRegistryLocked?: boolean;
    imageReferencesLocked?: boolean;
    allVisitorClaimsGrounded?: boolean;
  };
};

export type SynthesisBundle = {
  id: string;
  name: string;
  status: string;
  eventKey: string | null;
  canonicalEventId: string | null;
  candidateId: string | null;
  readyAt: string | null;
};

export type SynthesisApprovedVisual = {
  workflowId: string;
  imageSrc: string;
  imageAlt: string;
  imagePosition?: string;
  credit?: string;
  contentHash: string;
};

export type SynthesisSourceSnapshot = {
  id: string;
  sequenceNumber: number;
  sourceKind: string;
  canonicalUrl: string;
  pageTitle: string | null;
  contentHash: string;
  fetchedAt: string;
  contentSegments?: SynthesisContentSegment[];
};

export type SynthesisSourceClaim = {
  id: string;
  sourceSnapshotId: string;
  fieldPath: string;
  value: unknown;
  normalizedText: string;
  confidence: SourceClaimConfidence;
  confidenceScore: number | null;
  extractionMethod: string;
  reviewStatus: SourceClaimReviewStatus;
  createdAt: string;
};

export type SynthesisScheduleCandidate = {
  id: string;
  sourceSnapshotId: string;
  dedupeKey: string;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  dateText: string | null;
  timezone: string | null;
  venue: string | null;
  category: string | null;
  tags: string[];
  details: string | null;
  confidence: SourceClaimConfidence;
  confidenceScore: number | null;
  reviewStatus: SourceClaimReviewStatus;
};

export type EventSourceSynthesisInput = {
  bundle: SynthesisBundle;
  snapshots: SynthesisSourceSnapshot[];
  claims: SynthesisSourceClaim[];
  scheduleCandidates: SynthesisScheduleCandidate[];
  approvedVisual?: SynthesisApprovedVisual;
  lifecycleAsOf?: string;
};

export type ReconciledAlternative = {
  value: unknown;
  normalizedText: string;
  confidence: SourceClaimConfidence;
  confidenceScore: number;
  claimIds: string[];
  sourceSnapshotIds: string[];
};

export type ReconciledField = ReconciledAlternative & {
  fieldPath: string;
  alternatives: ReconciledAlternative[];
};

export type SynthesisConflict = {
  fieldPath: string;
  selected: ReconciledAlternative;
  alternatives: ReconciledAlternative[];
};

export type ReconciledEventProfile = {
  values: Record<string, unknown>;
  fields: ReconciledField[];
  editorialPlan?: EditorialPlan;
  quality: {
    score: number;
    requiredFieldCount: number;
    resolvedRequiredFieldCount: number;
    supportedFieldCount: number;
    conflictCount: number;
  };
};

export type EventSourceSynthesisResult = {
  engineKind: 'deterministic';
  engineVersion: string;
  inputHash: string;
  reconciledProfile: ReconciledEventProfile;
  conflicts: SynthesisConflict[];
  missingFields: string[];
  manifestProposal: Record<string, unknown> | EventPageManifest;
  validationReport: {
    errors: string[];
    warnings: string[];
    missingFields: string[];
    editorial: EditorialReviewSummary;
    modelEditorial?: ModelEditorialReviewSummary;
  };
  isManifestValid: boolean;
  qualityScore: number;
};

export type EventSourceSynthesisStatus =
  | 'generated'
  | 'in_review'
  | 'accepted'
  | 'rejected'
  | 'superseded';

export type EventSourceSynthesisSummary = {
  id: string;
  bundleId: string;
  bundleName: string;
  eventKey: string | null;
  versionNumber: number;
  status: EventSourceSynthesisStatus;
  engineKind: 'deterministic' | 'model_assisted';
  engineVersion: string;
  inputHash: string;
  isManifestValid: boolean;
  qualityScore: number;
  conflictCount: number;
  missingFieldCount: number;
  validationReport: {
    errors: string[];
    warnings: string[];
    missingFields: string[];
    editorial?: EditorialReviewSummary;
    modelEditorial?: ModelEditorialReviewSummary;
  };
  reviewNotes: string | null;
  createdBy: string;
  reviewedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
};
