"use client";

import { type FormEvent, useMemo, useState } from "react";
import { ATLAS_EVENTS } from "@/data/events";
import { ExternalLink, FileCheck, FileInput, Search, Sparkles, Upload } from "lucide-react";
import type {
  EventSourceBundleSummary,
  EventSourceCandidate,
  EventSourceLinkKind,
  OfficialEventSourceInspection,
} from "@/lib/event-intake/types";
import type { EventSourceSynthesisSummary } from "@/lib/event-intake/synthesisTypes";
import type {
  EventFactoryGateKey,
  EventFactoryItem,
  EventFactoryOverview,
  EventFactoryStage,
  EventVisualLane,
  EventVisualQaChecks,
  EventVisualWorkflowSummary,
} from "@/lib/event-factory/types";
import { buildEventVisualGenerationBrief } from "@/lib/event-factory/visualPrompt";
import ManualEventHeroUpload from "./ManualEventHeroUpload";

type Ready = { title: string; detail: string; state: string };
type OperationRun = { id: string; operation_type: string; actor_identity: string; status: string; summary?: { candidate_id?: string } | null; created_at: string };
type OperationAction = { id: string; action_type: string; target_entity_type?: string | null; target_entity_id?: string | null; lifecycle_state: string; reason?: string | null; created_at: string };
type ReviewItem = { id: string; operation_run_id?: string | null; review_type: string; candidate_id?: string | null; event_id?: string | null; priority: number; status: string; recommended_action: string; evidence?: { eventKey?: string; stageId?: string; exceptionCode?: string } | null };
type CompletionRunSummary = {
  runId: string;
  status: string;
  countyIdentity?: string | null;
  batchIdentity: string;
  dryRun: boolean;
  deterministicOnly: boolean;
  exceptionCount: number;
  publicationEligibilityCount: number;
  modelUsage?: {
    actualInputUsage?: number;
    actualOutputUsage?: number;
  } | null;
  createdAt: string;
};
type Ops = { runs: OperationRun[]; actions: OperationAction[]; completionRuns: CompletionRunSummary[] };
type EventPageOption = { eventId: string; name: string; location: string };
type EventPageVersion = {
  id: string;
  eventKey: string;
  slug: string;
  versionNumber: number;
  schemaVersion: number;
  status: "draft" | "in_review" | "approved" | "published" | "rejected" | "archived";
  isValid: boolean;
  sourceKind: string;
  changeSummary: string | null;
  reviewNotes: string | null;
  createdBy: string;
  reviewedBy: string | null;
  publishedBy: string | null;
  createdAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
};

type VisualDraft = {
  workflowId: string;
  lane: EventVisualLane;
  searchQuery: string;
  reviewedThumbnailCount: string;
  referenceSources: string;
  motifs: string;
  heroMoment: string;
  altText: string;
  qaChecks: Omit<EventVisualQaChecks, "publicAssetVerified">;
};

function visualDraftFor(item: EventFactoryItem | undefined, workflow: EventVisualWorkflowSummary | undefined): VisualDraft {
  const location = [item?.city, "Michigan"].filter(Boolean).join(", ");
  return {
    workflowId: workflow?.id ?? "",
    lane: workflow?.lane ?? "fast_visual",
    searchQuery: workflow?.searchQuery ?? (item ? `${item.name} ${location}` : ""),
    reviewedThumbnailCount: workflow ? String(workflow.reviewedThumbnailCount) : "",
    referenceSources: workflow?.referenceSources.map((source) => source.url).join("\n") ?? "",
    motifs: workflow?.visualSignature.motifs.join("\n") ?? "",
    heroMoment: workflow?.visualSignature.heroMoment ?? "",
    altText: workflow?.asset?.altText ?? "",
    qaChecks: {
      visualElementsVerified: workflow?.qaChecks.visualElementsVerified ?? false,
      independentComposition: workflow?.qaChecks.independentComposition ?? false,
      noInventedTextOrMarks: workflow?.qaChecks.noInventedTextOrMarks ?? false,
      mobileCropVerified: workflow?.qaChecks.mobileCropVerified ?? false,
    },
  };
}

const FACTORY_GATES: Array<{ key: EventFactoryGateKey; label: string }> = [
  { key: "exists", label: "Exists" },
  { key: "annual", label: "Annual" },
  { key: "dates", label: "Dates" },
  { key: "location", label: "Location" },
  { key: "sources", label: "Sources" },
  { key: "map", label: "Map" },
  { key: "page", label: "Page" },
  { key: "art", label: "Art" },
];

const FACTORY_STAGE_LABELS: Record<EventFactoryStage, string> = {
  discovery_review: "Discovery review",
  canonical_review: "Canonical approval",
  due_diligence: "Due diligence",
  production: "Build outputs",
  ready_for_approval: "Ready for approval",
  live: "Live",
  excluded: "Excluded",
};

function normalizedEventName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function sourceCollectionStatus(bundle: EventSourceBundleSummary) {
  if (bundle.status === "collecting") {
    return bundle.sourceCount > 0 ? "Sources collected" : "Awaiting sources";
  }
  if (bundle.status === "ready_for_synthesis" || bundle.status === "synthesis_in_progress") {
    return "Preparing proposal";
  }
  if (bundle.status === "draft_ready") return "Proposal created";
  return "Archived";
}

function remainingSourceLinkCount(bundle: EventSourceBundleSummary) {
  return Math.max(0, bundle.discoveredLinkCount - bundle.inspectedLinkCount);
}

function editorialLabel(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_.-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function missingFieldLabel(value: string) {
  return value === "media.heroImage" ? "Celebration Atlas hero art" : editorialLabel(value);
}

const CONTROL_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Detroit",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function formatControlTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  const parts = Object.fromEntries(
    CONTROL_TIME_FORMATTER.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return `${parts.month} ${parts.day}, ${parts.year} at ${parts.hour}:${parts.minute} ${parts.dayPeriod}`;
}

export default function ControlDesk({ initialReadiness, initialFactory, initialVisualWorkflows, initialOps, initialReviews, initialEventPageVersions, initialSourceBundles, initialSourceSyntheses, eventPageOptions }: { initialReadiness: Ready; initialFactory: EventFactoryOverview; initialVisualWorkflows: EventVisualWorkflowSummary[]; initialOps: Ops; initialReviews: ReviewItem[]; initialEventPageVersions: EventPageVersion[]; initialSourceBundles: EventSourceBundleSummary[]; initialSourceSyntheses: EventSourceSynthesisSummary[]; eventPageOptions: EventPageOption[] }) {
  const initialVisualItem = initialFactory.items.find((item) => item.visualWorkflowId)
    ?? initialFactory.items.find((item) => item.candidateId && item.stage !== "excluded");
  const initialVisualWorkflow = initialVisualWorkflows.find((workflow) => workflow.candidateId === initialVisualItem?.candidateId);
  const [readiness, setReadiness] = useState(initialReadiness);
  const [factory, setFactory] = useState(initialFactory);
  const [visualWorkflows, setVisualWorkflows] = useState(initialVisualWorkflows);
  const [ops, setOps] = useState<Ops>(initialOps);
  const [reviews, setReviews] = useState<ReviewItem[]>(initialReviews);
  const [eventPageVersions, setEventPageVersions] = useState<EventPageVersion[]>(initialEventPageVersions);
  const [sourceBundles, setSourceBundles] = useState<EventSourceBundleSummary[]>(initialSourceBundles);
  const [sourceSyntheses, setSourceSyntheses] = useState<EventSourceSynthesisSummary[]>(initialSourceSyntheses);
  const [pending, setPending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [eventPagePending, setEventPagePending] = useState<string>("");
  const [inspectionPending, setInspectionPending] = useState(false);
  const [sourceBundlePending, setSourceBundlePending] = useState("");
  const [synthesisPending, setSynthesisPending] = useState("");
  const [factoryPending, setFactoryPending] = useState("");
  const [visualPending, setVisualPending] = useState("");
  const [result, setResult] = useState<string>("");
  const [uploadResult, setUploadResult] = useState<string>("");
  const [eventPageResult, setEventPageResult] = useState<string>("");
  const [inspectionResult, setInspectionResult] = useState<string>("");
  const [sourceBundleResult, setSourceBundleResult] = useState<string>("");
  const [synthesisResult, setSynthesisResult] = useState<string>("");
  const [factoryResult, setFactoryResult] = useState<string>("");
  const [visualResult, setVisualResult] = useState<string>("");
  const [selectedVisualCandidateId, setSelectedVisualCandidateId] = useState(initialVisualItem?.candidateId ?? "");
  const [visualDraft, setVisualDraft] = useState<VisualDraft>(() => visualDraftFor(initialVisualItem, initialVisualWorkflow));
  const [inspectionUrl, setInspectionUrl] = useState("");
  const [inspectionSourceKind, setInspectionSourceKind] = useState<EventSourceLinkKind | "official_home" | "other">("other");
  const [inspection, setInspection] = useState<OfficialEventSourceInspection | null>(null);
  const [inspectionEventKey, setInspectionEventKey] = useState("");
  const [selectedSourceBundleId, setSelectedSourceBundleId] = useState("");
  const [candidatePrefill, setCandidatePrefill] = useState<EventSourceCandidate | null>(null);
  const [candidateFormVersion, setCandidateFormVersion] = useState(0);
  const [candidateIntakeKey, setCandidateIntakeKey] = useState(() => `candidate-intake:${crypto.randomUUID()}`);
  const eventPageNames = useMemo(
    () => new Map(eventPageOptions.map((event) => [event.eventId, event.name])),
    [eventPageOptions],
  );
  const visualFactoryItems = useMemo(
    () => factory.items.filter((item) => item.candidateId && item.stage !== "excluded"),
    [factory.items],
  );
  const selectedVisualItem = visualFactoryItems.find((item) => item.candidateId === selectedVisualCandidateId);
  const selectedVisualWorkflow = visualWorkflows.find((workflow) => workflow.id === visualDraft.workflowId)
    ?? visualWorkflows.find((workflow) => workflow.candidateId === selectedVisualCandidateId);
  const visualLocked = selectedVisualWorkflow?.status === "approved" || selectedVisualWorkflow?.status === "archived";
  const visualResearchLocked = visualLocked || Boolean(selectedVisualWorkflow?.supersedesWorkflowId);
  const selectedVisualBundle = sourceBundles.find((bundle) => bundle.candidateId === selectedVisualCandidateId);
  const selectedVisualLocation = [selectedVisualItem?.city, "Michigan"].filter(Boolean).join(", ");
  const visualPrompt = buildEventVisualGenerationBrief({
    eventName: selectedVisualItem?.name ?? "",
    locationLabel: selectedVisualLocation,
    motifs: visualDraft.motifs.split(/\r?\n/).map((value) => value.trim()).filter(Boolean),
    heroMoment: visualDraft.heroMoment,
  }).prompt;

  async function refresh() {
    const [status, factoryOverview, operations, reviewItems, eventPages, bundles, syntheses, visuals] = await Promise.all([
      fetch("/api/atlas-control/status"),
      fetch("/api/atlas-control/event-factory"),
      fetch("/api/atlas-control/operations"),
      fetch("/api/atlas-control/review-items"),
      fetch("/api/atlas-control/event-pages"),
      fetch("/api/atlas-control/source-bundles"),
      fetch("/api/atlas-control/source-syntheses"),
      fetch("/api/atlas-control/event-visuals"),
    ]);
    if (status.ok) setReadiness(await status.json());
    if (factoryOverview.ok) setFactory(await factoryOverview.json());
    if (operations.ok) setOps(await operations.json());
    if (reviewItems.ok) setReviews((await reviewItems.json()).items ?? []);
    if (eventPages.ok) setEventPageVersions((await eventPages.json()).items ?? []);
    if (bundles.ok) setSourceBundles((await bundles.json()).items ?? []);
    if (syntheses.ok) setSourceSyntheses((await syntheses.json()).items ?? []);
    if (visuals.ok) setVisualWorkflows((await visuals.json()).items ?? []);
  }

  async function eventPageAction(payload: Record<string, string>, pendingLabel: string) {
    setEventPagePending(pendingLabel);
    setEventPageResult("Applying reviewed publishing action...");
    const response = await fetch("/api/atlas-control/event-pages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setEventPagePending("");
    if (!response.ok) {
      setEventPageResult(body.error ?? "Event page operation failed.");
      return;
    }
    setEventPageResult("Event page workflow updated.");
    await refresh();
  }

  async function eventFactoryAction(payload: Record<string, string>, pendingLabel: string) {
    if (payload.action === "publish_reviewed" && !window.confirm("Publish this separately reviewed Event Hub package? This will materialize its canonical event and make the page public.")) return;
    setFactoryPending(pendingLabel);
    setFactoryResult(payload.action === "prepare" ? "Freezing the complete review package..." : payload.action === "publish_reviewed" ? "Publishing the separately reviewed package..." : "Updating the editorial decision...");
    const response = await fetch("/api/atlas-control/event-factory", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setFactoryPending("");
    if (!response.ok) {
      setFactoryResult(body.error ?? "Event package operation failed.");
      await refresh();
      return;
    }
    setFactoryResult(
      payload.action === "prepare"
        ? "Review package assembled. Preview it before approval; nothing was published."
        : payload.action === "publish_reviewed"
          ? "Reviewed event package published."
          : payload.action === "reject"
            ? "Package returned for changes. Nothing was published."
            : "Package reopened for revision.",
    );
    await refresh();
  }

  function selectVisualItem(candidateId: string) {
    const item = visualFactoryItems.find((candidate) => candidate.candidateId === candidateId);
    const workflow = visualWorkflows.find((candidate) => candidate.candidateId === candidateId);
    setSelectedVisualCandidateId(candidateId);
    setVisualDraft(visualDraftFor(item, workflow));
    setVisualResult("");
  }

  async function saveVisualWorkflow(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedVisualItem?.candidateId) {
      setVisualResult("Choose an event candidate first.");
      return;
    }
    setVisualPending("save");
    setVisualResult("Saving the visual signature and generation brief...");
    const response = await fetch("/api/atlas-control/event-visuals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save",
        workflowId: selectedVisualWorkflow?.id ?? visualDraft.workflowId,
        candidateId: selectedVisualItem.candidateId,
        sourceBundleId: selectedVisualBundle?.id ?? "",
        targetYear: selectedVisualItem.targetYear ?? new Date().getFullYear(),
        eventKey: selectedVisualItem.slug,
        eventName: selectedVisualItem.name,
        locationLabel: selectedVisualLocation,
        lane: visualDraft.lane,
        searchQuery: visualDraft.searchQuery,
        reviewedThumbnailCount: Number(visualDraft.reviewedThumbnailCount || 0),
        referenceSources: visualDraft.referenceSources.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
        motifs: visualDraft.motifs.split(/\r?\n/).map((motif) => motif.trim()).filter(Boolean),
        heroMoment: visualDraft.heroMoment,
        qaChecks: visualDraft.qaChecks,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setVisualPending("");
    if (!response.ok) {
      setVisualResult(body.error ?? "Visual workflow could not be saved.");
      return;
    }
    const workflowId = String(body.result?.workflow_id ?? selectedVisualWorkflow?.id ?? "");
    setVisualDraft((current) => ({ ...current, workflowId }));
    setVisualResult(body.result?.status === "ready_for_review" ? "Visual workflow is ready for approval." : "Visual workflow saved.");
    await refresh();
  }

  async function uploadVisualHero(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const workflowId = selectedVisualWorkflow?.id ?? visualDraft.workflowId;
    if (!workflowId) {
      setVisualResult("Save the visual brief before uploading artwork.");
      return;
    }
    setVisualPending("upload");
    setVisualResult("Uploading and verifying the public hero asset...");
    const formData = new FormData(event.currentTarget);
    formData.set("workflowId", workflowId);
    const response = await fetch("/api/atlas-control/event-visuals/upload", {
      method: "POST",
      body: formData,
    });
    const body = await response.json().catch(() => ({}));
    setVisualPending("");
    if (!response.ok) {
      setVisualResult(body.error ?? "Hero artwork could not be uploaded.");
      return;
    }
    setVisualResult("Hero artwork uploaded and publicly verified.");
    await refresh();
  }

  async function visualReviewAction(decision: "approve" | "reject" | "reopen" | "revise") {
    const workflowId = selectedVisualWorkflow?.id ?? visualDraft.workflowId;
    if (!workflowId) return;
    if (decision === "approve" && !window.confirm("Approve this visual signature, mobile crop, and cloud hero asset for Event Factory use?")) return;
    if (decision === "revise" && !window.confirm("Create a new visual revision for corrected artwork? The released workflow and hero will remain in the audit history.")) return;
    setVisualPending(decision);
    setVisualResult(
      decision === "approve"
        ? "Approving the hero workflow..."
        : decision === "revise"
          ? "Creating a QA-reset visual revision..."
          : "Updating the visual review state...",
    );
    const response = await fetch("/api/atlas-control/event-visuals", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: decision, workflowId }),
    });
    const body = await response.json().catch(() => ({}));
    setVisualPending("");
    if (!response.ok) {
      setVisualResult(body.error ?? "Visual review could not be updated.");
      return;
    }
    if (decision === "revise") {
      const revisionId = String(body.result?.workflow_id ?? "");
      setVisualDraft((current) => ({
        ...current,
        workflowId: revisionId,
        altText: "",
        qaChecks: {
          visualElementsVerified: false,
          independentComposition: false,
          noInventedTextOrMarks: false,
          mobileCropVerified: false,
        },
      }));
      setVisualResult("Visual revision created. Upload the corrected hero and rerun every release check.");
    } else {
      setVisualResult(decision === "approve" ? "Hero workflow approved for Event Factory use." : "Visual workflow review updated.");
    }
    await refresh();
  }

  async function copyVisualPrompt() {
    if (!visualPrompt) return;
    await navigator.clipboard.writeText(visualPrompt);
    setVisualResult("Generation prompt copied.");
  }

  async function runSourceInspection(sourceUrl: string, sourceKind: EventSourceLinkKind | "official_home" | "other" = "other") {
    setInspectionPending(true);
    setInspectionResult("Inspecting official source...");
    const response = await fetch("/api/atlas-control/event-source-inspection", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sourceUrl }),
    });
    const body = await response.json().catch(() => ({}));
    setInspectionPending(false);
    if (!response.ok) {
      setInspection(null);
      setInspectionResult(body.error ?? "The official source could not be inspected.");
      return;
    }
    setInspection(body.inspection);
    setInspectionUrl(body.inspection.finalUrl);
    setInspectionSourceKind(sourceKind);
    if (!selectedSourceBundleId) {
      const candidateName = normalizedEventName(body.inspection.candidate.name ?? "");
      const matchedEvent = eventPageOptions.find((event) => normalizedEventName(event.name) === candidateName);
      setInspectionEventKey(matchedEvent?.eventId ?? "");
    }
    setInspectionResult("Source inspection ready for review.");
  }

  async function inspectOfficialSource(formData: FormData) {
    await runSourceInspection(String(formData.get("sourceUrl") ?? ""));
  }

  function loadInspectionIntoCandidate() {
    if (!inspection) return;
    setCandidatePrefill(inspection.candidate);
    setCandidateFormVersion((version) => version + 1);
    setCandidateIntakeKey(`candidate-intake:${crypto.randomUUID()}`);
    requestAnimationFrame(() => document.getElementById("candidate-intake")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function saveInspectionToBundle() {
    if (!inspection) return;
    const action = selectedSourceBundleId ? "add_source" : "create_and_collect";
    setSourceBundlePending(action);
    setSourceBundleResult(selectedSourceBundleId ? "Adding source to evidence bundle..." : "Collecting prioritized official pages into a new evidence bundle...");
    const response = await fetch("/api/atlas-control/source-bundles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action,
        bundleId: selectedSourceBundleId,
        name: inspection.candidate.name || inspection.candidate.sourceName,
        sourceUrl: inspection.finalUrl,
        sourceKind: inspectionSourceKind,
        eventKey: inspectionEventKey,
      }),
    });
    const body = await response.json().catch(() => ({}));
    setSourceBundlePending("");
    if (!response.ok) {
      if (body.bundleId) setSelectedSourceBundleId(body.bundleId);
      setSourceBundleResult(body.error ?? "Source could not be saved to the evidence bundle.");
      await refresh();
      return;
    }
    const createdBundleId = body.bundle?.bundle_id;
    if (createdBundleId) setSelectedSourceBundleId(createdBundleId);
    if (body.collection) {
      const archived = 1 + Number(body.collection.added ?? 0);
      const failures = Number(body.collection.failures?.length ?? 0);
      setSourceBundleResult(`Official-page collection complete: ${archived} page${archived === 1 ? "" : "s"} saved${failures ? `; ${failures} linked page${failures === 1 ? "" : "s"} need manual review` : ""}.`);
    } else {
      setSourceBundleResult(body.snapshot?.result?.created === false ? "This source snapshot is already in the bundle." : "Source archived with claims and provenance.");
    }
    await refresh();
  }

  async function createReviewProposal(bundleId: string) {
    const pendingKey = `proposal:${bundleId}`;
    setSourceBundlePending(pendingKey);
    setSynthesisPending(`generate:${bundleId}`);
    setSourceBundleResult("Confirming the collected official sources...");

    const readyResponse = await fetch("/api/atlas-control/source-bundles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "ready", bundleId }),
    });
    const readyBody = await readyResponse.json().catch(() => ({}));
    if (!readyResponse.ok) {
      setSourceBundlePending("");
      setSynthesisPending("");
      setSourceBundleResult(readyBody.error ?? "The collected sources could not be confirmed.");
      return;
    }

    setSourceBundleResult("Sources confirmed. Creating the review proposal...");
    const synthesisResponse = await fetch("/api/atlas-control/source-syntheses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "generate", bundleId }),
    });
    const synthesisBody = await synthesisResponse.json().catch(() => ({}));
    setSourceBundlePending("");
    setSynthesisPending("");
    if (!synthesisResponse.ok) {
      setSourceBundleResult(`Sources confirmed. ${synthesisBody.error ?? "The review proposal still needs to be generated."}`);
      await refresh();
      return;
    }

    if (selectedSourceBundleId === bundleId) setSelectedSourceBundleId("");
    const proposal = synthesisBody.proposal;
    setSourceBundleResult("Collection complete. A review proposal has been created below.");
    setSynthesisResult(
      proposal?.isManifestValid
        ? `Review proposal created at ${Math.round(Number(proposal.qualityScore) * 100)}% quality. Nothing has been published.`
        : `Review proposal created with ${proposal?.missingFields?.length ?? 0} missing fields. Nothing has been published.`,
    );
    await refresh();
    requestAnimationFrame(() => document.getElementById("source-synthesis")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function transitionSourceBundle(bundleId: string, action: "ready" | "reopen" | "archive") {
    setSourceBundlePending(`${action}:${bundleId}`);
    setSourceBundleResult("Updating evidence bundle...");
    const response = await fetch("/api/atlas-control/source-bundles", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, bundleId }),
    });
    const body = await response.json().catch(() => ({}));
    setSourceBundlePending("");
    if (!response.ok) {
      setSourceBundleResult(body.error ?? "Evidence bundle could not be updated.");
      return;
    }
    if (action === "ready" && selectedSourceBundleId === bundleId) setSelectedSourceBundleId("");
    setSourceBundleResult(action === "ready" ? "Bundle is ready for synthesis." : action === "reopen" ? "Bundle reopened for source collection." : "Bundle archived.");
    await refresh();
  }

  async function generateSourceSynthesis(bundleId: string) {
    setSynthesisPending(`generate:${bundleId}`);
    setSynthesisResult("Reconciling source claims into a review proposal...");
    const response = await fetch("/api/atlas-control/source-syntheses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "generate", bundleId }),
    });
    const body = await response.json().catch(() => ({}));
    setSynthesisPending("");
    if (!response.ok) {
      setSynthesisResult(body.error ?? "Synthesis proposal could not be generated.");
      return;
    }
    const proposal = body.proposal;
    setSynthesisResult(
      proposal?.isManifestValid
        ? `Valid proposal generated at ${Math.round(Number(proposal.qualityScore) * 100)}% quality. It still requires review.`
        : `Proposal generated with ${proposal?.missingFields?.length ?? 0} missing fields. Collect or resolve evidence before review.`,
    );
    await refresh();
  }

  async function generateEditorialSynthesis(synthesisId: string) {
    setSynthesisPending(`editorial:${synthesisId}`);
    setSynthesisResult("Polishing the proposal inside its verified evidence boundaries...");
    const response = await fetch("/api/atlas-control/source-syntheses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "editorial", synthesisId }),
    });
    const body = await response.json().catch(() => ({}));
    setSynthesisPending("");
    if (!response.ok) {
      setSynthesisResult(body.error ?? "The evidence-bound editorial draft could not be generated.");
      return;
    }
    const editorial = body.proposal?.editorial;
    setSynthesisResult(
      `Editorial proposal created with ${editorial?.appliedRewriteCount ?? 0} grounded rewrite${editorial?.appliedRewriteCount === 1 ? "" : "s"}, ${editorial?.addedAudienceGroupCount ?? 0} audience group${editorial?.addedAudienceGroupCount === 1 ? "" : "s"}, and ${editorial?.addedSpotlight ? "a Scout Spotlight" : "no new Spotlight"}. Nothing has been published.`,
    );
    await refresh();
  }

  async function transitionSourceSynthesis(
    synthesisId: string,
    action: "submit" | "accept" | "reject",
    notes = "",
  ) {
    setSynthesisPending(`${action}:${synthesisId}`);
    setSynthesisResult("Updating the synthesis review gate...");
    const response = await fetch("/api/atlas-control/source-syntheses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, synthesisId, notes }),
    });
    const body = await response.json().catch(() => ({}));
    setSynthesisPending("");
    if (!response.ok) {
      setSynthesisResult(body.error ?? "Synthesis proposal could not be updated.");
      return;
    }
    setSynthesisResult(
      action === "submit"
        ? "Proposal submitted for human review."
        : action === "accept"
          ? "Proposal accepted. No public page was created or published."
          : "Proposal rejected. Reopen its evidence bundle to collect corrections.",
    );
    await refresh();
  }

  async function createEventPageDraft(formData: FormData) {
    const eventId = String(formData.get("eventId") ?? "");
    await eventPageAction(
      {
        action: "create_draft",
        eventId,
        changeSummary: String(formData.get("changeSummary") ?? ""),
      },
      `create:${eventId}`,
    );
  }

  async function reviewEventPageVersion(versionId: string, formData: FormData) {
    const decision = String(formData.get("decision") ?? "");
    await eventPageAction(
      {
        action: decision,
        versionId,
        notes: String(formData.get("notes") ?? ""),
      },
      `${decision}:${versionId}`,
    );
  }

  async function uploadFlyer(formData: FormData) {
    setUploadPending(true);
    setUploadResult("Uploading flyer and approving it for the public map...");
    const response = await fetch("/api/atlas-control/flyer-upload", { method: "POST", body: formData });
    const body = await response.json().catch(() => ({}));
    setUploadPending(false);
    if (!response.ok) {
      setUploadResult(body.error ?? "Flyer upload failed.");
      return;
    }
    setUploadResult(`Approved flyer for ${body.canonicalSlug}. Public URL: ${body.flyerUrl}`);
  }

  async function submit(formData: FormData) {
    setPending(true);
    setResult("Submitting source-backed candidate intake...");
    const payload = Object.fromEntries(formData.entries());
    const response = await fetch("/api/atlas-control/candidate-intake", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...payload, idempotencyKey: candidateIntakeKey, confidence: payload.confidence ? Number(payload.confidence) : undefined }),
    });
    const body = await response.json();
    setPending(false);
    if (!response.ok) {
      setResult((body.errors ?? [body.error]).join(" "));
      return;
    }
    const r = body.result;
    let bundleNote = "";
    if (selectedSourceBundleId && r.candidate_id) {
      const attachment = await fetch("/api/atlas-control/source-bundles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "attach_candidate", bundleId: selectedSourceBundleId, candidateId: r.candidate_id }),
      });
      bundleNote = attachment.ok ? " Evidence bundle attached." : " Candidate created, but the evidence bundle attachment needs retry.";
      if (attachment.ok) await refresh();
    }
    setResult(`Candidate ${r.candidate_id} via operation ${r.operation_run_id}: ${r.idempotent_replay ? "replayed idempotently" : r.status}.${bundleNote}`);
    setCandidateIntakeKey(`candidate-intake:${crypto.randomUUID()}`);
    refresh();
  }

  return (
    <div className="control-grid">
      <section className={`status-card ${readiness.state}`}>
        <p className="eyebrow">Readiness</p>
        <h2>{readiness.title}</h2>
        <p>{readiness.detail}</p>
      </section>

      <section className="control-panel wide factory-panel">
        <p className="eyebrow">Michigan Event Factory</p>
        <div className="factory-title-row">
          <div>
            <h2>Statewide production queue</h2>
            <p>AI prepares evidence-backed event packages; editorial approval remains the public release gate.</p>
          </div>
          <span>{factory.counts.coveredCounties} of 83 counties represented</span>
        </div>

        <dl className="factory-metrics">
          <div><dt>Candidates</dt><dd>{factory.counts.discoveryCandidates}</dd></div>
          <div><dt>Canonical</dt><dd>{factory.counts.canonicalEvents}</dd></div>
          <div><dt>Research sources</dt><dd>{factory.counts.registeredSources}</dd></div>
          <div><dt>Diligence ready</dt><dd>{factory.counts.dueDiligenceReady}</dd></div>
          <div><dt>On map</dt><dd>{factory.counts.mapReady}</dd></div>
          <div><dt>Event Hubs</dt><dd>{factory.counts.pageReady}</dd></div>
          <div><dt>Approval ready</dt><dd>{factory.counts.approvalReady}</dd></div>
        </dl>

        {factory.warnings.length > 0 && <p className="factory-warning">{factory.warnings[0]}</p>}
        {factoryResult && <p className="factory-result" role="status">{factoryResult}</p>}
        <div className="factory-queue" aria-label="Michigan event production readiness">
          {factory.items.map((item) => (
            <article key={item.key} className={`factory-item ${item.stage}`}>
              <div className="factory-item-heading">
                <span>
                  <b>{item.name}</b>
                  <small>{[item.city, item.county ? `${item.county} County` : null, item.eventType.replaceAll("_", " ")].filter(Boolean).join(" / ")}</small>
                </span>
                <span className={`factory-stage ${item.stage}`}>{FACTORY_STAGE_LABELS[item.stage]}</span>
                <strong>{item.readinessScore}%</strong>
              </div>
              <div className="factory-gates">
                {FACTORY_GATES.map((gate) => (
                  <span key={gate.key} className={item.gates[gate.key]} title={`${gate.label}: ${item.gates[gate.key]}`}>
                    {gate.label}
                  </span>
                ))}
              </div>
              {item.blockers.length > 0 && <small className="factory-blockers">Needs: {item.blockers.slice(0, 4).join("; ")}{item.blockers.length > 4 ? `; +${item.blockers.length - 4} more` : ""}</small>}
              {(item.packageId || item.stage === "ready_for_approval" || item.stage === "live") && (
                <div className="factory-actions">
                  <div>
                    {item.packageId ? (
                      <a href={`/atlas-control/event-preview/${item.packageId}`} target="_blank" rel="noreferrer">
                        Review page + hero <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : item.stage === "live" ? (
                      <a href={`/events/${item.slug}`} target="_blank" rel="noreferrer">
                        View public Event Hub <ExternalLink size={14} aria-hidden="true" />
                      </a>
                    ) : null}
                    {item.verificationStatus === "verified" && !item.packageId && item.stage === "ready_for_approval" && (
                      <button
                        type="button"
                        disabled={Boolean(factoryPending)}
                        onClick={() => eventFactoryAction({ action: "prepare", candidateId: item.candidateId ?? "", verificationCaseId: item.verificationCaseId ?? "" }, `prepare:${item.key}`)}
                      >
                        <Sparkles size={14} aria-hidden="true" />
                        {factoryPending === `prepare:${item.key}` ? "Assembling..." : "Assemble review package"}
                      </button>
                    )}
                    {item.verificationStatus === "verified"
                      && (item.packageStatus === "published" || item.packageStatus === "assembling" || item.packageStatus === "rejected")
                      && item.visualWorkflowStatus === "approved"
                      && (item.visualWorkflowRevisionNumber ?? 1) > 1 && (
                        <button
                          type="button"
                          disabled={Boolean(factoryPending)}
                          onClick={() => eventFactoryAction({ action: "prepare", candidateId: item.candidateId ?? "", verificationCaseId: item.verificationCaseId ?? "" }, `prepare-correction:${item.key}`)}
                        >
                          <Sparkles size={14} aria-hidden="true" />
                          {factoryPending === `prepare-correction:${item.key}` ? "Assembling..." : "Assemble corrected hero"}
                        </button>
                      )}
                    {item.packageId && item.packageStatus === "ready_for_review" && (
                      <>
                        {item.pageReviewStatus === "approved" && (
                          <button
                            type="button"
                            disabled={Boolean(factoryPending)}
                            onClick={() => eventFactoryAction({ action: "publish_reviewed", packageId: item.packageId ?? "" }, `publish:${item.key}`)}
                          >
                            <FileCheck size={14} aria-hidden="true" />
                            {factoryPending === `publish:${item.key}` ? "Publishing..." : "Publish reviewed event"}
                          </button>
                        )}
                      </>
                    )}
                    {item.packageId && item.packageStatus === "failed" && (
                      <button
                        type="button"
                        disabled={Boolean(factoryPending)}
                        onClick={() => eventFactoryAction({ action: "publish_reviewed", packageId: item.packageId ?? "" }, `retry:${item.key}`)}
                      >
                        {factoryPending === `retry:${item.key}` ? "Retrying..." : "Retry publication"}
                      </button>
                    )}
                    {item.packageId && item.packageStatus === "rejected" && (
                      <button
                        type="button"
                        disabled={Boolean(factoryPending)}
                        onClick={() => eventFactoryAction({ action: "reopen", packageId: item.packageId ?? "", notes: "Reopened for a corrected review package." }, `reopen:${item.key}`)}
                      >
                        {factoryPending === `reopen:${item.key}` ? "Reopening..." : "Reopen package"}
                      </button>
                    )}
                  </div>
                  {item.packageStatus === "ready_for_review" && item.pageReviewStatus === "approved" && <span>Page approved; publication remains separate</span>}
                  {item.packageStatus === "ready_for_review" && item.pageReviewStatus === "rejected" && <span>Page changes requested; hero review remains independent</span>}
                  {item.packageStatus === "ready_for_review" && item.pageReviewStatus === "pending" && <span>Review page and hero together</span>}
                  {item.packageStatus === "published" && <span>Approved and published</span>}
                </div>
              )}
            </article>
          ))}
        </div>
      </section>

      <section className="control-panel wide visual-workbench">
        <p className="eyebrow">Hero image factory</p>
        <div className="visual-title-row">
          <div>
            <h2>Visual signature workflow</h2>
            <p>Evidence-backed art direction, cloud media, and editorial release.</p>
          </div>
          {selectedVisualWorkflow && (
            <span className={`visual-status ${selectedVisualWorkflow.status}`}>
              {editorialLabel(selectedVisualWorkflow.status)}
            </span>
          )}
        </div>
        {visualResult && <p className="factory-result" role="status">{visualResult}</p>}

        <ManualEventHeroUpload items={factory.items} workflows={visualWorkflows} onComplete={refresh} />

        <form className="visual-brief-form" onSubmit={saveVisualWorkflow}>
          <label>
            Event
            <select value={selectedVisualCandidateId} onChange={(event) => selectVisualItem(event.target.value)}>
              <option value="">Choose an event</option>
              {visualFactoryItems.map((item) => (
                <option key={item.candidateId} value={item.candidateId ?? ""}>{item.name}</option>
              ))}
            </select>
          </label>
          <label>
            Art lane
            <select
              value={visualDraft.lane}
              disabled={visualResearchLocked}
              onChange={(event) => setVisualDraft((current) => ({ ...current, lane: event.target.value as EventVisualLane }))}
            >
              <option value="fast_visual">Fast visual</option>
              <option value="editorial">Editorial</option>
            </select>
          </label>
          <label className="visual-wide-field">
            Image search query
            <input
              type="text"
              value={visualDraft.searchQuery}
              disabled={visualResearchLocked}
              onChange={(event) => setVisualDraft((current) => ({ ...current, searchQuery: event.target.value }))}
            />
          </label>
          <label>
            Thumbnails reviewed
            <input
              type="number"
              min="0"
              max="60"
              value={visualDraft.reviewedThumbnailCount}
              disabled={visualResearchLocked}
              onChange={(event) => setVisualDraft((current) => ({ ...current, reviewedThumbnailCount: event.target.value }))}
            />
          </label>
          <label className="visual-wide-field">
            Representative source pages
            <textarea
              rows={4}
              value={visualDraft.referenceSources}
              disabled={visualResearchLocked}
              placeholder="One public source URL per line"
              onChange={(event) => setVisualDraft((current) => ({ ...current, referenceSources: event.target.value }))}
            />
          </label>
          <label className="visual-wide-field">
            Visual signature
            <textarea
              rows={5}
              value={visualDraft.motifs}
              disabled={visualResearchLocked}
              placeholder="One recurring element per line"
              onChange={(event) => setVisualDraft((current) => ({ ...current, motifs: event.target.value }))}
            />
          </label>
          <label className="visual-wide-field">
            Hero moment
            <textarea
              rows={3}
              value={visualDraft.heroMoment}
              disabled={visualResearchLocked}
              onChange={(event) => setVisualDraft((current) => ({ ...current, heroMoment: event.target.value }))}
            />
          </label>
          <label className="visual-wide-field">
            Generation prompt
            <textarea rows={9} value={visualPrompt} readOnly />
          </label>

          <fieldset className="visual-qa">
            <legend>Release checks</legend>
            {([
              ["visualElementsVerified", "Visual elements verified against event sources"],
              ["independentComposition", "Original composition, not a copied reference photograph"],
              ["noInventedTextOrMarks", "No invented text, numbers, logos, or insignia"],
              ["mobileCropVerified", "Mobile hero crop verified"],
            ] as Array<[keyof VisualDraft["qaChecks"], string]>).map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={visualDraft.qaChecks[key]}
                  disabled={visualLocked}
                  onChange={(event) => setVisualDraft((current) => ({
                    ...current,
                    qaChecks: { ...current.qaChecks, [key]: event.target.checked },
                  }))}
                />
                {label}
              </label>
            ))}
            <span className={selectedVisualWorkflow?.qaChecks.publicAssetVerified ? "verified" : "pending"}>
              Public cloud asset {selectedVisualWorkflow?.qaChecks.publicAssetVerified ? "verified" : "pending"}
            </span>
          </fieldset>

          <div className="visual-form-actions">
            <button type="submit" disabled={!selectedVisualCandidateId || visualLocked || Boolean(visualPending)}>
              <Sparkles size={15} aria-hidden="true" />
              {visualPending === "save" ? "Saving..." : "Save visual brief"}
            </button>
            <button type="button" className="secondary" disabled={!visualPrompt} onClick={copyVisualPrompt}>
              Copy prompt
            </button>
          </div>
        </form>

        {selectedVisualWorkflow && (
          <div className="visual-asset-row">
            <div className="visual-crop-review">
              {selectedVisualWorkflow.asset ? (
                <img src={selectedVisualWorkflow.asset.publicUrl} alt={selectedVisualWorkflow.asset.altText} />
              ) : (
                <span>Hero preview</span>
              )}
            </div>
            <form className="visual-upload-form" onSubmit={uploadVisualHero}>
              <label>
                Hero artwork
                <input name="hero" type="file" accept="image/jpeg,image/png,image/webp" required disabled={visualLocked} />
              </label>
              <label>
                Alt text
                <textarea
                  name="altText"
                  rows={3}
                  required
                  value={visualDraft.altText}
                  disabled={visualLocked}
                  onChange={(event) => setVisualDraft((current) => ({ ...current, altText: event.target.value }))}
                />
              </label>
              <button type="submit" disabled={visualLocked || Boolean(visualPending)}>
                <Upload size={15} aria-hidden="true" />
                {visualPending === "upload" ? "Uploading..." : "Upload hero"}
              </button>
            </form>
            <div className="visual-review-actions">
              {selectedVisualWorkflow.status === "ready_for_review" && (
                <>
                  <button type="button" disabled={Boolean(visualPending)} onClick={() => visualReviewAction("approve")}>
                    <FileCheck size={15} aria-hidden="true" />
                    {visualPending === "approve" ? "Approving..." : "Approve visual"}
                  </button>
                  <button type="button" className="factory-reject" disabled={Boolean(visualPending)} onClick={() => visualReviewAction("reject")}>
                    Needs changes
                  </button>
                </>
              )}
              {selectedVisualWorkflow.status === "rejected" && (
                <button type="button" disabled={Boolean(visualPending)} onClick={() => visualReviewAction("reopen")}>Reopen visual</button>
              )}
              {selectedVisualWorkflow.status === "approved" && (
                <>
                  <span>Approved for Event Factory use</span>
                  {(selectedVisualItem?.packageStatus === "published" || selectedVisualItem?.packageStatus === "rejected") && (
                    <button type="button" className="secondary" disabled={Boolean(visualPending)} onClick={() => visualReviewAction("revise")}>
                      {visualPending === "revise" ? "Creating revision..." : "Correct approved hero"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="control-panel wide source-workbench">
        <p className="eyebrow">Source intelligence</p>
        <h2>Inspect official event page</h2>
        <form action={inspectOfficialSource} className="source-inspection-form">
          <input
            name="sourceUrl"
            type="url"
            required
            maxLength={2048}
            value={inspectionUrl}
            onChange={(event) => setInspectionUrl(event.target.value)}
            placeholder="https://official-event-website.example/"
            aria-label="Official event website URL"
          />
          <button disabled={inspectionPending}>
            <Search size={17} aria-hidden="true" />
            {inspectionPending ? "Inspecting..." : "Inspect source"}
          </button>
        </form>
        <p className="result-text">{inspectionResult || "Inspection creates a review candidate only. It never publishes an event."}</p>

        {sourceBundles.length > 0 && (
          <div className="source-bundle-list">
            <h3>Official source collections</h3>
            {sourceBundles.map((bundle) => (
              <div key={bundle.id} className={selectedSourceBundleId === bundle.id ? "selected" : ""}>
                <span>
                  <b>{bundle.name}</b>
                  <small>
                    {bundle.sourceCount} official page{bundle.sourceCount === 1 ? "" : "s"} saved / {bundle.claimCount} extracted record{bundle.claimCount === 1 ? "" : "s"} / {remainingSourceLinkCount(bundle)} optional link{remainingSourceLinkCount(bundle) === 1 ? "" : "s"} remaining
                  </small>
                </span>
                <span className={`bundle-status ${bundle.status} ${bundle.status === "collecting" && bundle.sourceCount > 0 ? "has-sources" : ""}`}>
                  {sourceCollectionStatus(bundle)}
                </span>
                <span className="source-bundle-actions">
                  {bundle.status === "collecting" && (
                    <button type="button" disabled={Boolean(sourceBundlePending) || selectedSourceBundleId === bundle.id} onClick={() => setSelectedSourceBundleId(bundle.id)}>
                      {selectedSourceBundleId === bundle.id ? "Selected" : "Use bundle"}
                    </button>
                  )}
                  {bundle.status === "collecting" && bundle.sourceCount > 0 && (
                    <button type="button" disabled={Boolean(sourceBundlePending) || Boolean(synthesisPending)} onClick={() => createReviewProposal(bundle.id)}>
                      <Sparkles size={15} aria-hidden="true" />
                      {sourceBundlePending === `proposal:${bundle.id}` ? "Creating..." : "Create review proposal"}
                    </button>
                  )}
                  {bundle.status === "ready_for_synthesis" && (
                    <button type="button" disabled={Boolean(sourceBundlePending) || Boolean(synthesisPending)} onClick={() => generateSourceSynthesis(bundle.id)}>
                      <Sparkles size={15} aria-hidden="true" />
                      {synthesisPending === `generate:${bundle.id}` ? "Generating..." : "Generate proposal"}
                    </button>
                  )}
                  {(bundle.status === "ready_for_synthesis" || bundle.status === "draft_ready") && (
                    <button type="button" className="secondary-action" disabled={Boolean(sourceBundlePending) || Boolean(synthesisPending)} onClick={() => transitionSourceBundle(bundle.id, "reopen")}>
                      Reopen collection
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
        {sourceBundleResult && <p className="result-text" role="status" aria-live="polite">{sourceBundleResult}</p>}

        {inspection && (
          <div className="inspection-review">
            <div className="inspection-heading">
              <div>
                <h3>{inspection.candidate.name || "Event name unresolved"}</h3>
                <p>{inspection.candidate.sourceName}</p>
              </div>
              <span className="inspection-confidence">{Math.round(inspection.candidate.confidence * 100)}% confidence</span>
            </div>

            <dl className="inspection-facts">
              <div>
                <dt>Dates</dt>
                <dd>{inspection.candidate.startDate ? `${inspection.candidate.startDate}${inspection.candidate.endDate ? ` to ${inspection.candidate.endDate}` : ""}` : "Needs review"}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{[inspection.candidate.locationName, inspection.candidate.city, inspection.candidate.state].filter(Boolean).join(", ") || "Needs review"}</dd>
              </div>
              <div>
                <dt>Structured records</dt>
                <dd>{inspection.diagnostics.jsonLdEventCount}</dd>
              </div>
            </dl>

            {inspection.candidate.description && <p className="inspection-description">{inspection.candidate.description}</p>}

            <div className="inspection-evidence">
              <h4>Extracted evidence</h4>
              {inspection.evidence.map((item) => (
                <div key={`${item.field}:${item.value}`}>
                  <span>{item.field}</span>
                  <p>{item.value}</p>
                  <small>{item.method} / {item.confidence}</small>
                </div>
              ))}
            </div>

            {inspection.warnings.length > 0 && (
              <div className="inspection-warnings" role="status">
                <h4>Needs review</h4>
                <ul>{inspection.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              </div>
            )}

            {inspection.usefulLinks.length > 0 && (
              <div className="source-link-list">
                <h4>Useful official pages</h4>
                {inspection.usefulLinks.map((link) => (
                  <div key={link.url}>
                    <span><b>{link.label}</b><small>{link.kind}</small></span>
                    <span className="source-link-actions">
                      <button type="button" disabled={inspectionPending} onClick={() => runSourceInspection(link.url, link.kind)} title={`Inspect ${link.label}`}>
                        <Search size={15} aria-hidden="true" /> Inspect
                      </button>
                      <a href={link.url} target="_blank" rel="noreferrer" aria-label={`Open ${link.label}`} title={`Open ${link.label}`}>
                        <ExternalLink size={16} aria-hidden="true" />
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="source-bundle-capture">
              <h4>Save official sources</h4>
              <div>
                {!selectedSourceBundleId && (
                  <select aria-label="Associated Event Hub" value={inspectionEventKey} onChange={(event) => setInspectionEventKey(event.target.value)}>
                    <option value="">No existing Event Hub association</option>
                    {eventPageOptions.map((event) => (
                      <option key={event.eventId} value={event.eventId}>{event.name} - {event.location}</option>
                    ))}
                  </select>
                )}
                <select aria-label="Evidence bundle" value={selectedSourceBundleId} onChange={(event) => setSelectedSourceBundleId(event.target.value)}>
                  <option value="">Start a new bundle</option>
                  {sourceBundles.map((bundle) => (
                    <option key={bundle.id} value={bundle.id} disabled={bundle.status !== "collecting"}>{bundle.name} - {bundle.status.replaceAll("_", " ")}</option>
                  ))}
                </select>
                <button type="button" disabled={Boolean(sourceBundlePending)} onClick={saveInspectionToBundle}>
                  {selectedSourceBundleId ? <FileInput size={17} aria-hidden="true" /> : <Sparkles size={17} aria-hidden="true" />}
                  {sourceBundlePending ? "Collecting..." : selectedSourceBundleId ? "Add source to bundle" : "Collect official pages"}
                </button>
              </div>
              <small>Saves this page and the most useful same-site event pages. Nothing is published.</small>
            </div>

            <div className="inspection-footer">
              <small>Fetched {formatControlTimestamp(inspection.fetchedAt)} from {new URL(inspection.finalUrl).hostname}</small>
              <button type="button" onClick={loadInspectionIntoCandidate} disabled={!inspection.candidate.name}>
                <FileInput size={17} aria-hidden="true" /> Load into candidate intake
              </button>
            </div>
          </div>
        )}
      </section>

      <section id="source-synthesis" className="control-panel wide synthesis-panel">
        <p className="eyebrow">Source synthesis</p>
        <h2>Versioned review proposals</h2>
        <p>Deterministic synthesis locks the facts first. Evidence-bound AI can then refine allowlisted copy while dates, times, locations, sources, and publication remain outside its control.</p>
        <p className="result-text">{synthesisResult || "Ready evidence bundles can produce an immutable proposal for human review."}</p>
        {sourceSyntheses.length === 0 ? (
          <p className="empty-state">No synthesis proposals yet.</p>
        ) : (
          <div className="synthesis-list">
            {sourceSyntheses.map((synthesis) => (
              <article key={synthesis.id} className="synthesis-proposal">
                <div className="synthesis-heading">
                  <div>
                    <h3>{synthesis.bundleName}</h3>
                    <p>Proposal {synthesis.versionNumber} / {synthesis.engineKind === "model_assisted" ? "AI editorial" : "fact synthesis"}</p>
                  </div>
                  <span className={`version-status ${synthesis.status}`}>{synthesis.status.replaceAll("_", " ")}</span>
                </div>
                <dl className="synthesis-facts">
                  <div><dt>Quality</dt><dd>{Math.round(synthesis.qualityScore * 100)}%</dd></div>
                  <div><dt>Conflicts</dt><dd>{synthesis.conflictCount}</dd></div>
                  <div><dt>Missing fields</dt><dd>{synthesis.missingFieldCount}</dd></div>
                  <div><dt>Manifest</dt><dd className={synthesis.isManifestValid ? "valid" : "invalid"}>{synthesis.isManifestValid ? "Valid" : "Incomplete"}</dd></div>
                </dl>
                {synthesis.validationReport.editorial && (
                  <section className="editorial-strategy" aria-label={`Editorial strategy for ${synthesis.bundleName}`}>
                    <div className="editorial-strategy-heading">
                      <div>
                        <span>Editorial strategy</span>
                        <strong>{editorialLabel(synthesis.validationReport.editorial.mode)}</strong>
                      </div>
                      <small>{editorialLabel(synthesis.validationReport.editorial.scheduleStatus)}</small>
                    </div>
                    <dl>
                      <div>
                        <dt>Current edition</dt>
                        <dd>{synthesis.validationReport.editorial.currentEditionYear ?? "Unknown"}</dd>
                      </div>
                      <div>
                        <dt>Reference year</dt>
                        <dd>{synthesis.validationReport.editorial.referenceYear ?? "None"}</dd>
                      </div>
                      <div>
                        <dt>Reference items</dt>
                        <dd>{synthesis.validationReport.editorial.referenceItemCount}</dd>
                      </div>
                      <div>
                        <dt>Traditions</dt>
                        <dd>{synthesis.validationReport.editorial.traditionCount}</dd>
                      </div>
                    </dl>
                    <div className="editorial-tabs" aria-label="Recommended Event Hub tabs">
                      {synthesis.validationReport.editorial.recommendedTabs.map((tab) => (
                        <span key={tab}>{editorialLabel(tab)}</span>
                      ))}
                    </div>
                    <div className="editorial-checks">
                      {Object.entries(synthesis.validationReport.editorial.qualityChecks).map(([key, passed]) => (
                        <span className={passed ? "passed" : "needs-attention"} key={key}>
                          {passed ? "Ready" : "Review"}: {editorialLabel(key)}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
                {synthesis.validationReport.modelEditorial && (
                  <section className="model-editorial" aria-label={`AI editorial safeguards for ${synthesis.bundleName}`}>
                    <div className="model-editorial-heading">
                      <div>
                        <span>Evidence-bound editorial</span>
                        <strong>{synthesis.validationReport.modelEditorial.model}</strong>
                      </div>
                      <small>{synthesis.validationReport.modelEditorial.appliedRewriteCount} rewrites</small>
                    </div>
                    <dl>
                      <div><dt>Audience groups</dt><dd>{synthesis.validationReport.modelEditorial.addedAudienceGroupCount}</dd></div>
                      <div><dt>Scout Spotlight</dt><dd>{synthesis.validationReport.modelEditorial.addedSpotlight ? "Added" : "Retained"}</dd></div>
                      <div><dt>Rejected copy</dt><dd>{synthesis.validationReport.modelEditorial.rejectedRewriteCount}</dd></div>
                    </dl>
                    <div className="editorial-checks">
                      {Object.entries(synthesis.validationReport.modelEditorial.qualityChecks).map(([key, passed]) => (
                        <span className={passed ? "passed" : "needs-attention"} key={key}>
                          {passed ? "Ready" : "Review"}: {editorialLabel(key)}
                        </span>
                      ))}
                    </div>
                  </section>
                )}
                {synthesis.validationReport.missingFields.length > 0 && (
                  <p className="synthesis-missing">Needs: {synthesis.validationReport.missingFields.map(missingFieldLabel).join(", ")}</p>
                )}
                {synthesis.validationReport.errors.length > 0 && (
                  <details className="synthesis-validation">
                    <summary>{synthesis.validationReport.errors.length} validation issue{synthesis.validationReport.errors.length === 1 ? "" : "s"}</summary>
                    <ul>{synthesis.validationReport.errors.slice(0, 8).map((error) => <li key={error}>{error}</li>)}</ul>
                  </details>
                )}
                <small>Generated {formatControlTimestamp(synthesis.createdAt)} by {synthesis.createdBy}</small>
                {synthesis.reviewNotes && <small>Review: {synthesis.reviewNotes}</small>}
                {synthesis.isManifestValid && (
                  <a
                    className="synthesis-preview-link"
                    href={`/atlas-control/synthesis-preview/${synthesis.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} aria-hidden="true" /> Preview Event Hub
                  </a>
                )}
                {synthesis.status === "generated" && (
                  <div className="synthesis-actions">
                    {synthesis.engineKind === "deterministic" && (
                      <button
                        type="button"
                        className="editorial-action"
                        disabled={Boolean(synthesisPending)}
                        onClick={() => generateEditorialSynthesis(synthesis.id)}
                      >
                        <Sparkles size={16} aria-hidden="true" />
                        {synthesisPending === `editorial:${synthesis.id}` ? "Writing..." : "Polish with AI"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={Boolean(synthesisPending) || !synthesis.isManifestValid}
                      onClick={() => transitionSourceSynthesis(synthesis.id, "submit")}
                      title={synthesis.isManifestValid ? "Submit proposal for review" : "Resolve manifest gaps before review"}
                    >
                      <FileCheck size={16} aria-hidden="true" />
                      {synthesisPending === `submit:${synthesis.id}` ? "Submitting..." : "Submit for review"}
                    </button>
                    {!synthesis.isManifestValid && <small>Reopen the evidence bundle to resolve required fields.</small>}
                  </div>
                )}
                {synthesis.status === "in_review" && (
                  <form
                    className="synthesis-review-form"
                    action={async (formData) => {
                      const decision = String(formData.get("decision") ?? "") as "accept" | "reject";
                      await transitionSourceSynthesis(synthesis.id, decision, String(formData.get("notes") ?? ""));
                    }}
                  >
                    <textarea name="notes" maxLength={2000} placeholder="Review notes" aria-label={`Review notes for ${synthesis.bundleName}`} />
                    <div>
                      <button name="decision" value="accept" disabled={Boolean(synthesisPending)}>Accept proposal</button>
                      <button name="decision" value="reject" className="secondary-action" disabled={Boolean(synthesisPending)}>Reject</button>
                    </div>
                  </form>
                )}
                {synthesis.status === "accepted" && (
                  <p className="synthesis-accepted">Accepted as a source-backed proposal. Event Hub publishing remains a separate reviewed workflow.</p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="control-panel event-page-panel">
        <p className="eyebrow">Event Hub publishing</p>
        <h2>Reviewed page versions</h2>
        <form action={createEventPageDraft} className="event-page-draft-form">
          <select name="eventId" required defaultValue="">
            <option value="" disabled>Choose Event Hub</option>
            {eventPageOptions.map((event) => (
              <option key={event.eventId} value={event.eventId}>{event.name} - {event.location}</option>
            ))}
          </select>
          <input name="changeSummary" maxLength={500} placeholder="What changed in this checked-in manifest?" />
          <button disabled={Boolean(eventPagePending)}>{eventPagePending.startsWith("create:") ? "Creating..." : "Create draft from local manifest"}</button>
        </form>
        <p className="result-text">{eventPageResult || "Local manifests remain live until an approved database version is explicitly published."}</p>
        <div className="event-page-list">
          {eventPageVersions.map((version) => (
            <article key={version.id} className="event-page-version">
              <div className="event-page-version-heading">
                <div>
                  <h3>{eventPageNames.get(version.eventKey) ?? version.eventKey}</h3>
                  <p>Version {version.versionNumber} / schema {version.schemaVersion}</p>
                </div>
                <span className={`version-status ${version.status}`}>{version.status.replace("_", " ")}</span>
              </div>
              <p>{version.changeSummary || "No change summary provided."}</p>
              <small>Created {formatControlTimestamp(version.createdAt)} by {version.createdBy}</small>
              {version.reviewNotes && <small>Review: {version.reviewNotes}</small>}
              <div className="event-page-actions">
                {version.status === "draft" && (
                  <button type="button" disabled={Boolean(eventPagePending)} onClick={() => eventPageAction({ action: "submit", versionId: version.id }, `submit:${version.id}`)}>
                    {eventPagePending === `submit:${version.id}` ? "Submitting..." : "Submit for review"}
                  </button>
                )}
                {version.status === "approved" && (
                  <button type="button" disabled={Boolean(eventPagePending)} onClick={() => eventPageAction({ action: "publish", versionId: version.id }, `publish:${version.id}`)}>
                    {eventPagePending === `publish:${version.id}` ? "Publishing..." : "Publish version"}
                  </button>
                )}
              </div>
              {version.status === "in_review" && (
                <form action={(formData) => reviewEventPageVersion(version.id, formData)} className="event-page-review-form">
                  <textarea name="notes" maxLength={2000} placeholder="Review notes" />
                  <div>
                    <button name="decision" value="approve" disabled={Boolean(eventPagePending)}>Approve</button>
                    <button name="decision" value="reject" className="secondary-action" disabled={Boolean(eventPagePending)}>Reject</button>
                  </div>
                </form>
              )}
            </article>
          ))}
          {!eventPageVersions.length && <p>No Event Hub page versions yet. Apply migration 005, then create the first draft.</p>}
        </div>
      </section>

      <section className="control-panel">
        <p className="eyebrow">Flyer media</p>
        <h2>Upload approved flyer</h2>
        <form action={uploadFlyer} className="intake-form">
          <select name="eventId" required defaultValue="">
            <option value="" disabled>Choose event</option>
            {ATLAS_EVENTS.map((event) => (
              <option key={event.id} value={event.id}>{event.name} - {event.location}</option>
            ))}
          </select>
          <input name="flyer" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
          <button disabled={uploadPending}>{uploadPending ? "Uploading..." : "Upload and approve flyer"}</button>
        </form>
        <p className="result-text">{uploadResult || "Approved flyer uploads replace the current Supabase flyer for that event."}</p>
      </section>

      <section className="control-panel" id="candidate-intake">
        <p className="eyebrow">Source-backed intake</p>
        <h2>Single event candidate</h2>
        <form action={submit} className="intake-form" key={candidateFormVersion}>
          <input name="name" placeholder="Event or festival name" defaultValue={candidatePrefill?.name} required />
          <input name="eventKey" placeholder="Stable event key (optional, for example armada-fair)" />
          <select name="eventType" defaultValue="unknown" aria-label="Event type">
            <option value="unknown">Event type: needs review</option>
            <option value="festival">Festival</option>
            <option value="fair">Fair</option>
            <option value="county_fair">County fair</option>
            <option value="art_fair">Art fair</option>
            <option value="convention">Convention</option>
            <option value="community_event">Community event</option>
            <option value="other">Other</option>
          </select>
          <input name="city" placeholder="City" defaultValue={candidatePrefill?.city} required />
          <input name="county" placeholder="County (optional)" />
          <input name="state" defaultValue={candidatePrefill?.state || "MI"} />
          <input name="startDate" type="date" defaultValue={candidatePrefill?.startDate} />
          <input name="endDate" type="date" defaultValue={candidatePrefill?.endDate} />
          <input name="recurrencePattern" placeholder="Recurrence (for example, annual)" />
          <input name="sourceName" placeholder="Official source name" defaultValue={candidatePrefill?.sourceName} required />
          <input name="sourceUrl" placeholder="https://official-source.example/event" defaultValue={candidatePrefill?.sourceUrl} required />
          <textarea name="sourceExcerpt" placeholder="Source excerpt / notes (optional)" defaultValue={candidatePrefill?.sourceExcerpt} />
          <input name="confidence" type="number" min="0" max="1" step="0.01" placeholder="Confidence 0-1" defaultValue={candidatePrefill?.confidence} />
          <button disabled={pending}>{pending ? "Submitting..." : "Intake candidate"}</button>
        </form>
        <p className="result-text">{result || "No canonical event will be published from this action."}</p>
      </section>

      <section className="control-panel wide">
        <p className="eyebrow">Operational visibility</p>
        <h2>Michigan completion runs</h2>
        <div className="record-list">
          {ops.completionRuns.map((run) => (
            <article key={run.runId}>
              <b>{run.countyIdentity ?? "Michigan"} / {run.batchIdentity}</b>
              <span>{run.status} - {formatControlTimestamp(run.createdAt)}</span>
              <small>Run: {run.runId}</small>
              <small>
                {run.dryRun ? "Dry run" : "Private writes authorized"}
                {" · "}
                {run.deterministicOnly ? "Deterministic only" : "Budgeted model routing"}
              </small>
              <small>
                Exceptions: {run.exceptionCount}
                {" · "}
                Publication eligible: {run.publicationEligibilityCount}
                {" · "}
                Model usage: {(run.modelUsage?.actualInputUsage ?? 0) + (run.modelUsage?.actualOutputUsage ?? 0)} tokens
              </small>
            </article>
          ))}
          {!ops.completionRuns.length && <p>No Michigan completion runs visible yet.</p>}
        </div>

        <h2>Recent operation runs</h2>
        <div className="record-list">
          {ops.runs.map((run) => (
            <article key={run.id}>
              <b>{run.operation_type}</b>
              <span>{run.status} - {formatControlTimestamp(run.created_at)}</span>
              <small>Actor: {run.actor_identity}</small>
              <small>Target: {run.summary?.candidate_id ?? "-"}</small>
            </article>
          ))}
          {!ops.runs.length && <p>No operation runs visible yet.</p>}
        </div>

        <h2>Recent operation actions</h2>
        <div className="record-list">
          {ops.actions.map((action) => (
            <article key={action.id}>
              <b>{action.action_type}</b>
              <span>{action.lifecycle_state} - {formatControlTimestamp(action.created_at)}</span>
              <small>Target: {action.target_entity_type ?? "-"} {action.target_entity_id ?? ""}</small>
              <small>Reason: {action.reason ?? "-"}</small>
            </article>
          ))}
          {!ops.actions.length && <p>No operation actions visible yet.</p>}
        </div>

        <h2>Open review items</h2>
        <div className="record-list">
          {reviews.map((item) => (
            <article key={item.id}>
              <b>{item.review_type}</b>
              <span>{item.status} - priority {item.priority}</span>
              <small>Run: {item.operation_run_id ?? "-"}</small>
              <small>
                Target: {item.evidence?.eventKey ?? item.candidate_id ?? item.event_id ?? "-"}
                {item.evidence?.stageId ? ` / ${item.evidence.stageId}` : ""}
              </small>
              {item.evidence?.exceptionCode && <small>Exception: {item.evidence.exceptionCode}</small>}
              <small>Recommended: {item.recommended_action}</small>
            </article>
          ))}
          {!reviews.length && <p>No open review items visible.</p>}
        </div>
      </section>
    </div>
  );
}
