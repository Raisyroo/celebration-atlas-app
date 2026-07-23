export type EventFactoryGateState = "ready" | "claimed" | "missing";

export type EventFactoryGateKey =
  | "exists"
  | "annual"
  | "dates"
  | "location"
  | "sources"
  | "map"
  | "page"
  | "art";

export type EventFactoryStage =
  | "discovery_review"
  | "canonical_review"
  | "due_diligence"
  | "production"
  | "ready_for_approval"
  | "live"
  | "excluded";

export type EventFactoryPackageStatus =
  | "assembling"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "publishing"
  | "published"
  | "failed"
  | "archived";

export type EventFactoryItem = {
  key: string;
  candidateId: string | null;
  eventId: string | null;
  verificationCaseId: string | null;
  targetYear: number | null;
  packageId: string | null;
  packageStatus: EventFactoryPackageStatus | null;
  visualWorkflowId: string | null;
  visualWorkflowStatus: EventVisualWorkflowStatus | null;
  visualLane: EventVisualLane | null;
  verificationStatus: "collecting" | "needs_review" | "verified" | "rejected" | "stale" | null;
  name: string;
  slug: string;
  city: string | null;
  county: string | null;
  eventType: string;
  officialWebsite: string | null;
  confidenceScore: number;
  stage: EventFactoryStage;
  readinessScore: number;
  sourceCount: number;
  gates: Record<EventFactoryGateKey, EventFactoryGateState>;
  blockers: string[];
};

export type EventVisualLane = "fast_visual" | "editorial";

export type EventVisualWorkflowStatus =
  | "researching"
  | "draft"
  | "ready_for_review"
  | "approved"
  | "rejected"
  | "archived";

export type EventVisualReference = {
  url: string;
  label?: string;
};

export type EventVisualSignature = {
  motifs: string[];
  heroMoment: string;
};

export type EventVisualGenerationBrief = {
  prompt: string;
  aspectRatio: "2:3";
  textPolicy: "no_generated_text";
  style: string;
};

export type EventVisualAsset = {
  publicUrl: string;
  altText: string;
  credit: string;
  sourceKind: "supabase";
  storageBucket: string;
  storagePath: string;
  contentType?: string;
  byteSize?: number;
};

export type EventVisualQaChecks = {
  visualElementsVerified: boolean;
  independentComposition: boolean;
  noInventedTextOrMarks: boolean;
  mobileCropVerified: boolean;
  publicAssetVerified: boolean;
};

export type EventVisualWorkflowSummary = {
  id: string;
  revisionNumber: number;
  supersedesWorkflowId: string | null;
  candidateId: string;
  eventId: string | null;
  sourceBundleId: string | null;
  targetYear: number;
  eventKey: string;
  eventName: string;
  locationLabel: string;
  lane: EventVisualLane;
  status: EventVisualWorkflowStatus;
  searchQuery: string;
  reviewedThumbnailCount: number;
  referenceSources: EventVisualReference[];
  visualSignature: EventVisualSignature;
  generationBrief: EventVisualGenerationBrief;
  asset: EventVisualAsset | null;
  qaChecks: EventVisualQaChecks;
  contentHash: string;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
};

export type EventFactoryPackageSummary = {
  id: string;
  verificationCaseId: string;
  candidateId: string;
  eventId: string | null;
  eventKey: string;
  slug: string;
  eventName: string;
  targetYear: number;
  status: EventFactoryPackageStatus;
  packageVersion: number;
  readinessChecks: Record<EventFactoryGateKey, boolean>;
  readinessScore: number;
  contentHash: string;
  mapRecord: Record<string, unknown>;
  artAsset: Record<string, unknown>;
  reviewedBy: string | null;
  reviewNotes: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

export type EventFactoryOverview = {
  generatedAt: string;
  state: "ready" | "unavailable";
  counts: {
    discoveryCandidates: number;
    canonicalEvents: number;
    registeredSources: number;
    coveredCounties: number;
    dueDiligenceReady: number;
    mapReady: number;
    pageReady: number;
    approvalReady: number;
  };
  items: EventFactoryItem[];
  warnings: string[];
};

export type EventVerificationCaseSummary = {
  id: string;
  candidateId: string | null;
  eventId: string | null;
  eventName: string;
  eventSlug: string;
  targetYear: number;
  status: "collecting" | "needs_review" | "verified" | "rejected" | "stale";
  existenceStatus: "unverified" | "likely" | "confirmed" | "rejected";
  recurrenceStatus: "unverified" | "likely" | "confirmed" | "rejected";
  datesStatus: "unknown" | "announced" | "not_announced" | "conflicting";
  locationStatus: "unknown" | "likely" | "confirmed" | "conflicting";
  officialSourceCount: number;
  supportingSourceCount: number;
  historicalOccurrenceCount: number;
  verificationScore: number;
  evidenceCount: number;
  createdAt: string;
  updatedAt: string;
  verifiedAt: string | null;
};
