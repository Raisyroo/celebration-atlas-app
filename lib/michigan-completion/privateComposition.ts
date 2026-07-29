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
  contentSegments?: Array<{
    kind: string;
    text: string;
  }>;
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

export const COMPLETION_EVIDENCE_POLICY_VERSION =
  "completion-evidence-selection/1";

export type CompletionEvidenceIgnoredReason =
  | "inactive_review"
  | "identity_mismatch"
  | "irrelevant_snapshot"
  | "non_target_year"
  | "invalid_city"
  | "lower_authority_alternative"
  | "narrative_alternative";

export type CompletionEvidenceSelection = {
  policyVersion: typeof COMPLETION_EVIDENCE_POLICY_VERSION;
  claims: VerificationClaimInput[];
  relevantSnapshotIds: string[];
  compatibleSnapshotIds: string[];
  ignoredClaims: Array<{
    claimId: string;
    fieldPath: string;
    reason: CompletionEvidenceIgnoredReason;
  }>;
  dateConflicts: Array<{
    fieldPath: string;
    values: string[];
    claims: Array<{
      claimId: string;
      sourceSnapshotId: string;
      value: unknown;
    }>;
  }>;
};

function normalizeCompletionIdentityName(value: unknown) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(?:19|20)\d{2}\b/g, " ")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function claimDateYear(value: unknown) {
  const match = String(value ?? "").match(/^(\d{4})-\d{2}-\d{2}/);
  return match ? Number(match[1]) : null;
}

function identityEditionYears(value: unknown) {
  return [
    ...String(value ?? "").matchAll(/\b((?:19|20)\d{2})\b/g),
  ].map((match) => Number(match[1]));
}

function normalizedClaimValue(claim: VerificationClaimInput) {
  if (claim.fieldPath === "identity.name") {
    return normalizeCompletionIdentityName(claim.value);
  }
  if (
    claim.fieldPath === "timing.startDate" ||
    claim.fieldPath === "timing.endDate"
  ) {
    return String(claim.value ?? "").match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  }
  return (
    claim.normalizedText ||
    String(claim.value ?? "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase()
  );
}

function sourceHost(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isSameHostFamily(left: string, right: string) {
  return Boolean(
    left &&
      right &&
      (left === right ||
        left.endsWith(`.${right}`) ||
        right.endsWith(`.${left}`)),
  );
}

function invalidCityClaim(value: unknown) {
  const candidate = String(value ?? "").trim();
  return (
    /^\d/.test(candidate) ||
    /\b(?:road|street|avenue|mile|drive|boulevard)\b/i.test(
      candidate,
    )
  );
}

function confidenceScore(claim: VerificationClaimInput) {
  return claim.confidenceScore ?? 0;
}

export function selectCompletionEvidenceClaims(args: {
  eventName: string;
  targetYear: number | null;
  snapshots: VerificationSnapshotInput[];
  claims: VerificationClaimInput[];
}): CompletionEvidenceSelection {
  const snapshots = new Map(
    args.snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const expectedName = normalizeCompletionIdentityName(args.eventName);
  const compatibleSnapshotIds = new Set(
    args.claims
      .filter(
        (claim) =>
          claim.fieldPath === "identity.name" &&
          normalizeCompletionIdentityName(claim.value) === expectedName,
      )
      .map((claim) => claim.sourceSnapshotId),
  );
  const snapshotYears = new Map<string, Set<number>>();
  for (const claim of args.claims) {
    const years = snapshotYears.get(claim.sourceSnapshotId) ?? new Set<number>();
    if (
      claim.fieldPath === "timing.startDate" ||
      claim.fieldPath === "timing.endDate"
    ) {
      const year = claimDateYear(claim.value);
      if (year) years.add(year);
    } else if (claim.fieldPath === "identity.name") {
      identityEditionYears(claim.value).forEach((year) => years.add(year));
    }
    snapshotYears.set(claim.sourceSnapshotId, years);
  }
  const officialHosts = args.snapshots
    .filter((snapshot) => snapshot.sourceKind === "official_home")
    .map((snapshot) => sourceHost(snapshot.canonicalUrl))
    .filter(Boolean);
  const relevantSnapshotIds = new Set(
    args.snapshots
      .filter(
        (snapshot) =>
          snapshot.sourceKind === "official_home" ||
          (compatibleSnapshotIds.has(snapshot.id) &&
            (args.targetYear === null ||
              !(snapshotYears.get(snapshot.id)?.size ?? 0) ||
              (snapshotYears.get(snapshot.id)?.size === 1 &&
                snapshotYears.get(snapshot.id)?.has(args.targetYear)))),
      )
      .map((snapshot) => snapshot.id),
  );
  const ignoredClaims: CompletionEvidenceSelection["ignoredClaims"] = [];
  let selected = args.claims.filter((claim) => {
    let reason: CompletionEvidenceIgnoredReason | null = null;
    if (["rejected", "superseded"].includes(claim.reviewStatus)) {
      reason = "inactive_review";
    } else if (claim.fieldPath === "identity.name") {
      if (normalizeCompletionIdentityName(claim.value) !== expectedName) {
        reason = "identity_mismatch";
      } else if (!relevantSnapshotIds.has(claim.sourceSnapshotId)) {
        reason = "non_target_year";
      }
    } else if (
      claim.fieldPath === "timing.startDate" ||
      claim.fieldPath === "timing.endDate"
    ) {
      if (
        args.targetYear !== null &&
        claimDateYear(claim.value) !== args.targetYear
      ) {
        reason = "non_target_year";
      } else if (!relevantSnapshotIds.has(claim.sourceSnapshotId)) {
        reason = "irrelevant_snapshot";
      }
    } else if (
      claim.fieldPath === "identity.description" ||
      claim.fieldPath.startsWith("location.") ||
      claim.fieldPath === "timing.timezone"
    ) {
      if (!relevantSnapshotIds.has(claim.sourceSnapshotId)) {
        reason = "irrelevant_snapshot";
      } else if (
        claim.fieldPath === "location.city" &&
        invalidCityClaim(claim.value)
      ) {
        reason = "invalid_city";
      }
    } else if (
      claim.fieldPath !== "sources.officialUrl" &&
      !relevantSnapshotIds.has(claim.sourceSnapshotId)
    ) {
      reason = "irrelevant_snapshot";
    }
    if (reason) {
      ignoredClaims.push({
        claimId: claim.id,
        fieldPath: claim.fieldPath,
        reason,
      });
      return false;
    }
    return true;
  });

  for (const fieldPath of [
    "identity.name",
    "identity.description",
    "timing.startDate",
    "timing.endDate",
    "location.city",
    "location.display",
    "location.venue",
  ]) {
    const fieldClaims = selected.filter(
      (claim) => claim.fieldPath === fieldPath,
    );
    if (fieldClaims.length < 2) continue;
    const officialFamilyClaims = fieldClaims.filter((claim) => {
      const host = sourceHost(
        snapshots.get(claim.sourceSnapshotId)?.canonicalUrl ?? "",
      );
      return officialHosts.some((officialHost) =>
        isSameHostFamily(host, officialHost),
      );
    });
    if (!officialFamilyClaims.length) continue;
    const authoritativeValues = new Set(
      officialFamilyClaims.map(normalizedClaimValue),
    );
    const narrativeField = fieldPath === "identity.description";
    if (authoritativeValues.size > 1 && !narrativeField) continue;
    const retained = narrativeField
      ? [
          [...officialFamilyClaims].sort(
            (left, right) =>
              confidenceScore(right) - confidenceScore(left) ||
              left.id.localeCompare(right.id),
          )[0],
        ]
      : officialFamilyClaims;
    const retainedIds = new Set(retained.map((claim) => claim.id));
    selected = selected.filter((claim) => {
      if (claim.fieldPath !== fieldPath || retainedIds.has(claim.id)) {
        return true;
      }
      ignoredClaims.push({
        claimId: claim.id,
        fieldPath: claim.fieldPath,
        reason: narrativeField
          ? "narrative_alternative"
          : "lower_authority_alternative",
      });
      return false;
    });
  }

  const dateConflicts = ["timing.startDate", "timing.endDate"].flatMap(
    (fieldPath) => {
      const fieldClaims = selected.filter(
        (claim) => claim.fieldPath === fieldPath,
      );
      const values = [
        ...new Set(fieldClaims.map(normalizedClaimValue).filter(Boolean)),
      ];
      return values.length > 1
        ? [
            {
              fieldPath,
              values,
              claims: fieldClaims.map((claim) => ({
                claimId: claim.id,
                sourceSnapshotId: claim.sourceSnapshotId,
                value: claim.value,
              })),
            },
          ]
        : [];
    },
  );

  return {
    policyVersion: COMPLETION_EVIDENCE_POLICY_VERSION,
    claims: selected,
    relevantSnapshotIds: [...relevantSnapshotIds].sort(),
    compatibleSnapshotIds: [...compatibleSnapshotIds].sort(),
    ignoredClaims: ignoredClaims.sort(
      (left, right) =>
        left.claimId.localeCompare(right.claimId) ||
        left.reason.localeCompare(right.reason),
    ),
    dateConflicts,
  };
}

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
  isOfficial: boolean,
): PlannedVerificationEvidence["sourceKind"] {
  if (isOfficial) return "official_event";
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

const ANNUAL_EVENT_LANGUAGE =
  /\b(?:annual|anniversary|each year|every year|yearly)\b/i;

function isOfficialSnapshot(
  snapshot: VerificationSnapshotInput,
  officialHosts: string[],
) {
  if (snapshot.sourceKind === "official_home") return true;
  const host = sourceHost(snapshot.canonicalUrl);
  return officialHosts.some((officialHost) =>
    isSameHostFamily(host, officialHost)
  );
}

export function planVerificationEvidence(args: {
  snapshots: VerificationSnapshotInput[];
  claims: VerificationClaimInput[];
  targetYear: number;
}) {
  const snapshots = new Map(
    args.snapshots.map((snapshot) => [snapshot.id, snapshot]),
  );
  const officialHosts = args.snapshots
    .filter((snapshot) => snapshot.sourceKind === "official_home")
    .map((snapshot) => sourceHost(snapshot.canonicalUrl))
    .filter(Boolean);
  const relevantSnapshotIds = new Set(
    args.claims.map((claim) => claim.sourceSnapshotId),
  );
  const planned: PlannedVerificationEvidence[] = [];
  for (const claim of args.claims) {
    if (["rejected", "superseded"].includes(claim.reviewStatus)) continue;
    const snapshot = snapshots.get(claim.sourceSnapshotId);
    if (!snapshot?.canonicalUrl) continue;
    const isOfficial = isOfficialSnapshot(snapshot, officialHosts);
    const common = {
      sourceSnapshotId: snapshot.id,
      sourceKind: verificationSourceKind(snapshot, isOfficial),
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
    } else if (
      claim.fieldPath === "identity.description" &&
      ANNUAL_EVENT_LANGUAGE.test(evidenceExcerpt(claim))
    ) {
      planned.push({
        ...common,
        proofKind: "annual_language",
        occurrenceYear: args.targetYear,
      });
    }
  }
  for (const snapshot of args.snapshots) {
    if (
      !relevantSnapshotIds.has(snapshot.id) ||
      !isOfficialSnapshot(snapshot, officialHosts)
    ) {
      continue;
    }
    const annualSegment = snapshot.contentSegments?.find((segment) =>
      ANNUAL_EVENT_LANGUAGE.test(segment.text)
    );
    if (!annualSegment) continue;
    planned.push({
      sourceSnapshotId: snapshot.id,
      proofKind: "annual_language",
      sourceKind: "official_event",
      sourceUrl: snapshot.canonicalUrl,
      sourceTitle: snapshot.pageTitle ?? undefined,
      excerpt: annualSegment.text.replace(/\s+/g, " ").trim().slice(0, 4_000),
      occurrenceYear: args.targetYear,
      isOfficial: true,
      confidence: "high",
      confidenceScore: 0.95,
      contentHash: snapshot.contentHash || undefined,
    });
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
  verifyCase(args: {
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
  automaticallyVerified: boolean;
  missingFacts: string[];
};

function missingVerificationFacts(
  planned: PlannedVerificationEvidence[],
  targetYear: number,
) {
  const officialCurrentOccurrence = planned.some(
    (evidence) =>
      evidence.proofKind === "current_occurrence" &&
      evidence.isOfficial &&
      evidence.occurrenceYear === targetYear,
  );
  const checks = [
    {
      label: "official event identity",
      passed: planned.some(
        (evidence) =>
          evidence.proofKind === "official_identity" &&
          evidence.isOfficial,
      ),
    },
    {
      label: "official current dates",
      passed:
        officialCurrentOccurrence &&
        planned.some(
          (evidence) =>
            evidence.proofKind === "current_dates" &&
            evidence.isOfficial &&
            evidence.occurrenceYear === targetYear,
        ),
    },
    {
      label: "official event location",
      passed: planned.some(
        (evidence) =>
          ["venue", "location"].includes(evidence.proofKind) &&
          evidence.isOfficial &&
          evidence.occurrenceYear === targetYear,
      ),
    },
    {
      label: "annual recurrence",
      passed: planned.some(
        (evidence) =>
          evidence.proofKind === "annual_language" &&
          (
            evidence.isOfficial ||
            (
              officialCurrentOccurrence &&
              ["high", "verified"].includes(evidence.confidence)
            )
          ),
      ),
    },
  ];
  return checks.filter((check) => !check.passed).map((check) => check.label);
}

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
      missingFacts: [],
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
      missingFacts: [],
    };
  }

  const planned = planVerificationEvidence({
    snapshots: args.snapshots,
    claims: args.claims,
    targetYear: args.targetYear,
  });
  let evidenceAdded = 0;
  for (const evidence of planned) {
    const result = await args.services.addEvidence({
      ...evidence,
      verificationCaseId,
      actorIdentity: args.actorIdentity,
    });
    if (result.created !== false) evidenceAdded += 1;
  }
  const missingFacts = missingVerificationFacts(planned, args.targetYear);
  if (planned.length) {
    if (status === "collecting") {
      const submitted = await args.services.submitCase({
        verificationCaseId,
        actorIdentity: args.actorIdentity,
        notes:
          "County completion added deterministic retained evidence. No canonical event or publication action was authorized.",
      });
      status = String(submitted.status ?? "needs_review");
    }
    if (status === "needs_review" && missingFacts.length === 0) {
      const verified = await args.services.verifyCase({
        verificationCaseId,
        actorIdentity: args.actorIdentity,
        notes:
          "Official-first deterministic verification cleared identity, current dates, location, and annual recurrence. This private verification does not create a canonical event or authorize publication.",
      });
      status = String(verified.status ?? "verified");
    }
  }
  return {
    verificationCaseId,
    status,
    evidencePlanned: planned.length,
    evidenceAdded,
    submittedForHumanReview: status === "needs_review",
    automaticallyVerified: status === "verified" && missingFacts.length === 0,
    missingFacts,
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
    async verifyCase(args) {
      const { transitionEventVerificationCase } = await import(
        "../event-factory/verification.ts"
      );
      return transitionEventVerificationCase({
        verificationCaseId: args.verificationCaseId,
        action: "verify",
        actorIdentity: args.actorIdentity,
        notes: args.notes,
      });
    },
  };
}
