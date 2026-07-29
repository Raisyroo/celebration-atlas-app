export type SourceCompositionServices = {
  createBundle(args: {
    name: string;
    eventKey: string;
    actorIdentity: string;
  }): Promise<{ bundle_id: string } & Record<string, unknown>>;
  attachCandidate(args: {
    bundleId: string;
    candidateId: string;
    actorIdentity: string;
  }): Promise<Record<string, unknown>>;
  captureSource(args: {
    bundleId: string;
    sourceUrl: string;
    sourceKind?: "official_home" | "other";
    includeEventIdentity?: boolean;
    includeEventDescription?: boolean;
    includeEventLocation?: boolean;
    actorIdentity: string;
  }): Promise<{
    result: Record<string, unknown>;
    inspection: Record<string, unknown>;
  }>;
  collectRelated(args: {
    bundleId: string;
    seedInspection: Record<string, unknown>;
    actorIdentity: string;
    maxRelatedSources: number;
  }): Promise<{
    attempted: number;
    added: number;
    reused: number;
    failures: Array<{ message: string } & Record<string, unknown>>;
  }>;
  transitionReady(args: {
    bundleId: string;
    actorIdentity: string;
    notes: string;
  }): Promise<Record<string, unknown>>;
};

export type SourceBundleCompositionResult = {
  bundleId: string;
  officialSourceCaptured: true;
  supportingSourcesAttempted: number;
  supportingSourcesAdded: number;
  relatedSourcesAttempted: number;
  relatedSourcesAdded: number;
  failures: Array<{
    sourceUrl: string | null;
    message: string;
  }>;
};

export async function composeRetainedSourceBundle(args: {
  services: SourceCompositionServices;
  eventName: string;
  eventKey: string;
  candidateId: string;
  officialSourceUrl: string;
  supportingSourceUrls: string[];
  actorIdentity: string;
  maxAdditionalSources?: number;
}): Promise<SourceBundleCompositionResult> {
  const maxAdditionalSources = Math.max(
    0,
    Math.min(8, args.maxAdditionalSources ?? 5),
  );
  const bundle = await args.services.createBundle({
    name: `${args.eventName} retained official-source bundle`,
    eventKey: args.eventKey,
    actorIdentity: args.actorIdentity,
  });
  const bundleId = String(bundle.bundle_id ?? "").trim();
  if (!bundleId) {
    throw new Error("The source-bundle service returned no bundle identity.");
  }
  await args.services.attachCandidate({
    bundleId,
    candidateId: args.candidateId,
    actorIdentity: args.actorIdentity,
  });
  const official = await args.services.captureSource({
    bundleId,
    sourceUrl: args.officialSourceUrl,
    sourceKind: "official_home",
    includeEventIdentity: true,
    includeEventDescription: true,
    includeEventLocation: true,
    actorIdentity: args.actorIdentity,
  });

  const failures: SourceBundleCompositionResult["failures"] = [];
  let supportingSourcesAdded = 0;
  const supporting = [
    ...new Set(
      args.supportingSourceUrls
        .map((url) => url.trim())
        .filter((url) => url && url !== args.officialSourceUrl),
    ),
  ].slice(0, Math.min(2, maxAdditionalSources));
  for (const sourceUrl of supporting) {
    try {
      const captured = await args.services.captureSource({
        bundleId,
        sourceUrl,
        sourceKind: "other",
        includeEventIdentity: true,
        includeEventDescription: true,
        includeEventLocation: true,
        actorIdentity: args.actorIdentity,
      });
      if (captured.result.created !== false) supportingSourcesAdded += 1;
    } catch (error) {
      failures.push({
        sourceUrl,
        message:
          error instanceof Error
            ? error.message.slice(0, 300)
            : "Supporting source capture failed.",
      });
    }
  }

  const relatedLimit = Math.max(
    0,
    maxAdditionalSources - supporting.length,
  );
  const related = relatedLimit
    ? await args.services.collectRelated({
        bundleId,
        seedInspection: official.inspection,
        actorIdentity: args.actorIdentity,
        maxRelatedSources: relatedLimit,
      })
    : { attempted: 0, added: 0, reused: 0, failures: [] };
  failures.push(
    ...related.failures.map((failure) => ({
      sourceUrl:
        typeof failure.url === "string" ? failure.url : null,
      message: failure.message.slice(0, 300),
    })),
  );
  await args.services.transitionReady({
    bundleId,
    actorIdentity: args.actorIdentity,
    notes:
      "County completion retained bounded official-source evidence. Supporting capture failures remain visible and were not retried.",
  });
  return {
    bundleId,
    officialSourceCaptured: true,
    supportingSourcesAttempted: supporting.length,
    supportingSourcesAdded,
    relatedSourcesAttempted: related.attempted,
    relatedSourcesAdded: related.added,
    failures,
  };
}

export type VerificationSnapshotInput = {
  id: string;
  sourceKind: string;
  canonicalUrl: string;
  pageTitle: string | null;
  contentHash: string;
};

export type VerificationClaimInput = {
  id: string;
  sourceSnapshotId: string;
  fieldPath: string;
  value: unknown;
  normalizedText: string;
  confidence: string;
  confidenceScore: number | null;
  reviewStatus: string;
};

export type PlannedVerificationEvidence = {
  sourceSnapshotId: string;
  proofKind:
    | "official_identity"
    | "current_occurrence"
    | "current_dates"
    | "annual_language"
    | "venue"
    | "location"
    | "independent_listing";
  sourceKind:
    | "official_event"
    | "government"
    | "tourism"
    | "venue"
    | "directory"
    | "other";
  sourceUrl: string;
  sourceTitle: string | undefined;
  excerpt: string;
  occurrenceYear: number | undefined;
  isOfficial: boolean;
  confidence: "unknown" | "low" | "medium" | "high" | "verified";
  confidenceScore: number | undefined;
  contentHash: string | undefined;
};

function evidenceExcerpt(claim: VerificationClaimInput) {
  const value =
    typeof claim.value === "string"
      ? claim.value
      : JSON.stringify(claim.value);
  return (value || claim.normalizedText || claim.fieldPath)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4_000);
}

function verificationSourceKind(
  snapshot: VerificationSnapshotInput,
): PlannedVerificationEvidence["sourceKind"] {
  if (snapshot.sourceKind === "official_home") return "official_event";
  try {
    const host = new URL(snapshot.canonicalUrl).hostname.toLowerCase();
    if (host.endsWith(".gov")) return "government";
    if (/tourism|visit/.test(host)) return "tourism";
  } catch {
    // The retained capture service already performed authoritative URL checks.
  }
  return "other";
}

function confidence(
  value: string,
): PlannedVerificationEvidence["confidence"] {
  return ["unknown", "low", "medium", "high", "verified"].includes(value)
    ? value as PlannedVerificationEvidence["confidence"]
    : "unknown";
}

export function planVerificationEvidence(args: {
  snapshots: VerificationSnapshotInput[];
  claims: VerificationClaimInput[];
  targetYear: number;
}) {
  const snapshots = new Map(
    args.snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const planned: PlannedVerificationEvidence[] = [];
  for (const claim of args.claims) {
    if (["rejected", "superseded"].includes(claim.reviewStatus)) continue;
    const snapshot = snapshots.get(claim.sourceSnapshotId);
    if (!snapshot?.canonicalUrl) continue;
    const isOfficial = snapshot.sourceKind === "official_home";
    const common = {
      sourceSnapshotId: snapshot.id,
      sourceKind: verificationSourceKind(snapshot),
      sourceUrl: snapshot.canonicalUrl,
      sourceTitle: snapshot.pageTitle ?? undefined,
      excerpt: evidenceExcerpt(claim),
      isOfficial,
      confidence: confidence(claim.confidence),
      confidenceScore: claim.confidenceScore ?? undefined,
      contentHash: snapshot.contentHash || undefined,
    };
    if (claim.fieldPath === "identity.name") {
      planned.push({
        ...common,
        proofKind: isOfficial
          ? "official_identity"
          : "independent_listing",
        occurrenceYear: undefined,
      });
    } else if (claim.fieldPath === "timing.startDate") {
      planned.push({
        ...common,
        proofKind: "current_dates",
        occurrenceYear: args.targetYear,
      });
      if (isOfficial) {
        planned.push({
          ...common,
          proofKind: "current_occurrence",
          occurrenceYear: args.targetYear,
        });
      }
    } else if (claim.fieldPath === "location.venue") {
      planned.push({
        ...common,
        proofKind: "venue",
        occurrenceYear: args.targetYear,
      });
    } else if (
      claim.fieldPath === "location.display" ||
      claim.fieldPath === "location.city"
    ) {
      planned.push({
        ...common,
        proofKind: "location",
        occurrenceYear: args.targetYear,
      });
    } else if (claim.fieldPath === "recurrence.annual") {
      planned.push({
        ...common,
        proofKind: "annual_language",
        occurrenceYear: args.targetYear,
      });
    }
  }
  return [
    ...new Map(
      planned.map((item) => [
        [
          item.proofKind,
          item.sourceUrl,
          item.occurrenceYear ?? 0,
          item.contentHash ?? "",
        ].join("|"),
        item,
      ]),
    ).values(),
  ];
}

export type VerificationCompositionServices = {
  createCase(args: {
    candidateId: string;
    targetYear: number;
    actorIdentity: string;
  }): Promise<Record<string, unknown>>;
  addEvidence(args: PlannedVerificationEvidence & {
    verificationCaseId: string;
    actorIdentity: string;
  }): Promise<Record<string, unknown>>;
  submitCase(args: {
    verificationCaseId: string;
    actorIdentity: string;
    notes: string;
  }): Promise<Record<string, unknown>>;
};

export type VerificationCompositionResult = {
  verificationCaseId: string;
  status: string;
  evidencePlanned: number;
  evidenceAdded: number;
  submittedForHumanReview: boolean;
  automaticallyVerified: false;
};

export async function composeVerificationCase(args: {
  services: VerificationCompositionServices;
  candidateId: string;
  targetYear: number;
  actorIdentity: string;
  existingCase?: { id: string; status: string } | null;
  snapshots: VerificationSnapshotInput[];
  claims: VerificationClaimInput[];
}): Promise<VerificationCompositionResult> {
  let verificationCaseId = args.existingCase?.id ?? "";
  let status = args.existingCase?.status ?? "";
  if (!verificationCaseId) {
    const created = await args.services.createCase({
      candidateId: args.candidateId,
      targetYear: args.targetYear,
      actorIdentity: args.actorIdentity,
    });
    verificationCaseId = String(
      created.verification_case_id ?? created.id ?? "",
    ).trim();
    status = String(created.status ?? "collecting");
  }
  if (!verificationCaseId) {
    throw new Error("The verification service returned no case identity.");
  }
  if (status === "verified") {
    return {
      verificationCaseId,
      status,
      evidencePlanned: 0,
      evidenceAdded: 0,
      submittedForHumanReview: false,
      automaticallyVerified: false,
    };
  }
  if (!["collecting", "needs_review"].includes(status)) {
    return {
      verificationCaseId,
      status,
      evidencePlanned: 0,
      evidenceAdded: 0,
      submittedForHumanReview: false,
      automaticallyVerified: false,
    };
  }

  const planned = planVerificationEvidence({
    snapshots: args.snapshots,
    claims: args.claims,
    targetYear: args.targetYear,
  });
  let evidenceAdded = 0;
  if (status === "collecting") {
    for (const evidence of planned) {
      const result = await args.services.addEvidence({
        ...evidence,
        verificationCaseId,
        actorIdentity: args.actorIdentity,
      });
      if (result.created !== false) evidenceAdded += 1;
    }
    if (planned.length) {
      const submitted = await args.services.submitCase({
        verificationCaseId,
        actorIdentity: args.actorIdentity,
        notes:
          "County completion added deterministic retained evidence and submitted the case for the existing human diligence review. It did not verify or publish the event.",
      });
      status = String(submitted.status ?? "needs_review");
    }
  }
  return {
    verificationCaseId,
    status,
    evidencePlanned: planned.length,
    evidenceAdded,
    submittedForHumanReview: status === "needs_review",
    automaticallyVerified: false,
  };
}

export function createDefaultSourceCompositionServices(): SourceCompositionServices {
  return {
    async createBundle(args) {
      const { createEventSourceBundle } = await import(
        "../event-intake/sourceBundles.ts"
      );
      return createEventSourceBundle(args);
    },
    async attachCandidate(args) {
      const { attachEventSourceBundleCandidate } = await import(
        "../event-intake/sourceBundles.ts"
      );
      return attachEventSourceBundleCandidate(args);
    },
    async captureSource(args) {
      const { captureEventSourceToBundle } = await import(
        "../event-intake/sourceBundles.ts"
      );
      const captured = await captureEventSourceToBundle(args);
      return {
        result: captured.result,
        inspection:
          captured.inspection as unknown as Record<string, unknown>,
      };
    },
    async collectRelated(args) {
      const { collectRelatedEventSources } = await import(
        "../event-intake/sourceBundles.ts"
      );
      return collectRelatedEventSources({
        bundleId: args.bundleId,
        seedInspection: args.seedInspection as never,
        actorIdentity: args.actorIdentity,
        maxRelatedSources: args.maxRelatedSources,
      });
    },
    async transitionReady(args) {
      const { transitionEventSourceBundle } = await import(
        "../event-intake/sourceBundles.ts"
      );
      return transitionEventSourceBundle({
        bundleId: args.bundleId,
        action: "ready",
        actorIdentity: args.actorIdentity,
        notes: args.notes,
      });
    },
  };
}

export function createDefaultVerificationCompositionServices(): VerificationCompositionServices {
  return {
    async createCase(args) {
      const { createEventVerificationCase } = await import(
        "../event-factory/verification.ts"
      );
      return createEventVerificationCase(args);
    },
    async addEvidence(args) {
      const { addEventVerificationEvidence } = await import(
        "../event-factory/verification.ts"
      );
      return addEventVerificationEvidence({
        verificationCaseId: args.verificationCaseId,
        sourceSnapshotId: args.sourceSnapshotId,
        proofKind: args.proofKind,
        sourceKind: args.sourceKind,
        sourceUrl: args.sourceUrl,
        sourceTitle: args.sourceTitle,
        excerpt: args.excerpt,
        occurrenceYear: args.occurrenceYear,
        isOfficial: args.isOfficial,
        confidence: args.confidence,
        confidenceScore: args.confidenceScore,
        contentHash: args.contentHash,
        actorIdentity: args.actorIdentity,
      });
    },
    async submitCase(args) {
      const { transitionEventVerificationCase } = await import(
        "../event-factory/verification.ts"
      );
      return transitionEventVerificationCase({
        verificationCaseId: args.verificationCaseId,
        action: "submit",
        actorIdentity: args.actorIdentity,
        notes: args.notes,
      });
    },
  };
}
