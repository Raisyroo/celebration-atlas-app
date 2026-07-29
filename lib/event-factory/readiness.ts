import "server-only";
import { ATLAS_EVENTS } from "@/data/events";
import { getEventPageManifest } from "@/data/eventPageManifests";
import { validateEventPageManifest } from "@/data/eventPageManifestValidation";
import { resolveExplicitEventThumbnail } from "@/data/eventThumbnail";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import { sharesEventFactoryIdentity } from "./identity";
import type {
  EventFactoryGateKey,
  EventFactoryGateState,
  EventFactoryItem,
  EventFactoryOverview,
  EventFactoryPackageStatus,
  EventFactoryStage,
} from "./types";

type EventRow = {
  id: string;
  name: string;
  slug: string;
  event_type: string;
  city: string | null;
  county: string | null;
  official_website: string | null;
  recurrence_pattern: string | null;
  verification_status: string;
  confidence_score: number | string | null;
  latitude: number | null;
  longitude: number | null;
  location_verified: boolean;
  short_description: string | null;
};

type CandidateRow = {
  id: string;
  candidate_name: string;
  slug_candidate: string | null;
  event_type: string;
  city: string | null;
  county: string | null;
  start_date: string | null;
  end_date: string | null;
  probable_recurrence: string | null;
  description: string | null;
  official_website_candidate: string | null;
  discovery_confidence: number | string;
  verification_status: string;
  duplicate_status: string;
  matched_event_id: string | null;
};

type CandidateSourceRow = {
  candidate_id: string;
  source_url: string;
  trust_score: number | string | null;
};

type EventSourceRow = { event_id: string; source_url: string; trust_score: number | string | null };
type MediaRow = { event_id: string; media_role: string; status: string };
type BundleRow = { id: string; candidate_id: string | null; canonical_event_id: string | null; event_key: string | null; status: string };
type SynthesisRow = {
  bundle_id: string;
  status: string;
  is_manifest_valid: boolean;
  manifest_proposal: unknown;
  reconciled_profile: unknown;
};
type VerificationCaseRow = {
  id: string;
  candidate_id: string | null;
  event_id: string | null;
  target_year: number;
  status: "collecting" | "needs_review" | "verified" | "rejected" | "stale";
  existence_status: "unverified" | "likely" | "confirmed" | "rejected";
  recurrence_status: "unverified" | "likely" | "confirmed" | "rejected";
  dates_status: "unknown" | "announced" | "not_announced" | "conflicting";
  location_status: "unknown" | "likely" | "confirmed" | "conflicting";
  official_source_count: number;
  supporting_source_count: number;
};
type PageVersionRow = {
  status: string;
  is_valid: boolean;
  event_pages: { event_id: string; event_key: string; slug: string } | Array<{ event_id: string; event_key: string; slug: string }>;
};
type PackageRow = {
  id: string;
  candidate_id: string;
  event_id: string | null;
  status: EventFactoryPackageStatus;
  readiness_checks: Partial<Record<EventFactoryGateKey, boolean>>;
  package_version: number;
  page_manifest: unknown;
  art_asset: Record<string, unknown>;
  published_at: string | null;
};
type VisualWorkflowRow = {
  id: string;
  revision_number: number;
  candidate_id: string;
  event_id: string | null;
  event_key: string;
  lane: "fast_visual" | "editorial";
  status: "researching" | "draft" | "ready_for_review" | "approved" | "rejected" | "archived";
  asset: Record<string, unknown>;
  generation_brief: Record<string, unknown>;
};

const CURRENT_YEAR = new Date().getUTCFullYear();
const ANNUAL_LANGUAGE = /\b(?:annual|anniversary|every year|yearly|recurring)\b/i;
const PRODUCTION_MEDIA_ROLES = new Set(["thumbnail", "hero", "event-card", "map-art", "brand"]);
const GATE_WEIGHTS: Record<EventFactoryGateKey, number> = {
  exists: 18,
  annual: 16,
  dates: 12,
  location: 14,
  sources: 12,
  map: 10,
  page: 10,
  art: 8,
};

function normalized(value: string | null | undefined) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function hasVerifiedSynthesisMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const mapRecord = (value as Record<string, unknown>).mapRecord;
  if (!mapRecord || typeof mapRecord !== "object" || Array.isArray(mapRecord)) return false;
  const map = mapRecord as Record<string, unknown>;
  const latitude = Number(map.latitude);
  const longitude = Number(map.longitude);
  return Number.isFinite(latitude)
    && latitude >= -90
    && latitude <= 90
    && Number.isFinite(longitude)
    && longitude >= -180
    && longitude <= 180
    && typeof map.sourceUrl === "string"
    && /^https?:\/\//i.test(map.sourceUrl);
}

function pageOwner(row: PageVersionRow) {
  return Array.isArray(row.event_pages) ? row.event_pages[0] : row.event_pages;
}

function hasCurrentDates(candidate: CandidateRow | undefined) {
  if (!candidate?.start_date) return false;
  const year = Number(candidate.start_date.slice(0, 4));
  return Number.isFinite(year) && year >= CURRENT_YEAR;
}

function recurrenceGate(event: EventRow | undefined, candidate: CandidateRow | undefined): EventFactoryGateState {
  const recurrence = `${event?.recurrence_pattern ?? ""} ${candidate?.probable_recurrence ?? ""}`;
  if (/\b(?:annual|yearly|every year)\b/i.test(recurrence)) return "ready";
  if (ANNUAL_LANGUAGE.test(`${event?.short_description ?? ""} ${candidate?.description ?? ""}`)) return "claimed";
  return "missing";
}

function scoreGates(gates: Record<EventFactoryGateKey, EventFactoryGateState>) {
  const score = (Object.keys(gates) as EventFactoryGateKey[]).reduce((total, gate) => {
    const factor = gates[gate] === "ready" ? 1 : gates[gate] === "claimed" ? 0.5 : 0;
    return total + GATE_WEIGHTS[gate] * factor;
  }, 0);
  return Math.round(score);
}

function stageFor(
  gates: Record<EventFactoryGateKey, EventFactoryGateState>,
  hasCanonicalEvent: boolean,
  verificationStatus: VerificationCaseRow["status"] | null,
  excluded: boolean,
  hasPublishedPage: boolean,
  packageStatus: EventFactoryPackageStatus | null,
): EventFactoryStage {
  if (excluded) return "excluded";
  if (packageStatus === "published") return "live";
  const diligenceReady = ["exists", "annual", "dates", "location", "sources"].every(
    (key) => gates[key as EventFactoryGateKey] === "ready",
  );
  if (!diligenceReady) return hasCanonicalEvent ? "due_diligence" : "discovery_review";
  const outputReady = ["map", "page"].every((key) => gates[key as EventFactoryGateKey] === "ready");
  if (!outputReady) return "production";
  if (hasCanonicalEvent && hasPublishedPage) return "live";
  if (verificationStatus !== "verified") return "due_diligence";
  return "ready_for_approval";
}

function blockersFor(gates: Record<EventFactoryGateKey, EventFactoryGateState>) {
  const blockers: string[] = [];
  if (gates.exists !== "ready") blockers.push("Official identity confirmation");
  if (gates.annual !== "ready") blockers.push("Annual recurrence proof");
  if (gates.dates !== "ready") blockers.push("Current event dates");
  if (gates.location !== "ready") blockers.push("Verified map coordinates");
  if (gates.sources !== "ready") blockers.push("Official source evidence");
  if (gates.map !== "ready") blockers.push("Public map record");
  if (gates.page !== "ready") blockers.push("Approved Event Hub page");
  return blockers;
}

function emptyOverview(message: string): EventFactoryOverview {
  return {
    generatedAt: new Date().toISOString(),
    state: "unavailable",
    counts: {
      discoveryCandidates: 0,
      canonicalEvents: 0,
      registeredSources: 0,
      coveredCounties: 0,
      dueDiligenceReady: 0,
      mapReady: 0,
      pageReady: 0,
      approvalReady: 0,
    },
    items: [],
    warnings: [message],
  };
}

export async function getEventFactoryOverview(): Promise<EventFactoryOverview> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return emptyOverview("Atlas Control Plane configuration is incomplete.");

  const [eventResult, candidateResult, sourceRegistryResult] = await Promise.all([
    supabase
      .from("events")
      .select("id,name,slug,event_type,city,county,official_website,recurrence_pattern,verification_status,confidence_score,latitude,longitude,location_verified,short_description", { count: "exact" })
      .eq("state", "Michigan")
      .order("name")
      .limit(250),
    supabase
      .from("event_candidates")
      .select("id,candidate_name,slug_candidate,event_type,city,county,start_date,end_date,probable_recurrence,description,official_website_candidate,discovery_confidence,verification_status,duplicate_status,matched_event_id", { count: "exact" })
      .eq("state", "Michigan")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase.from("discovery_sources").select("id", { count: "exact" }).eq("state", "Michigan").eq("is_active", true).limit(1),
  ]);

  if (eventResult.error || candidateResult.error || sourceRegistryResult.error) {
    return emptyOverview("The Michigan discovery and canonical event records are not reachable.");
  }

  const events = (eventResult.data ?? []) as EventRow[];
  const candidates = (candidateResult.data ?? []) as CandidateRow[];
  const eventIds = events.map((event) => event.id);
  const candidateIds = candidates.map((candidate) => candidate.id);
  const eventFilter = eventIds.length ? eventIds : ["00000000-0000-0000-0000-000000000000"];
  const candidateFilter = candidateIds.length ? candidateIds : ["00000000-0000-0000-0000-000000000000"];

  const [candidateSourcesResult, eventSourcesResult, mediaResult, bundlesResult, synthesesResult, pagesResult, verificationCasesResult, packagesResult, visualWorkflowsResult] = await Promise.all([
    supabase.from("event_candidate_sources").select("candidate_id,source_url,trust_score").in("candidate_id", candidateFilter).limit(2000),
    supabase.from("event_sources").select("event_id,source_url,trust_score").in("event_id", eventFilter).limit(2000),
    supabase.from("event_media").select("event_id,media_role,status").in("event_id", eventFilter).limit(1000),
    supabase.from("event_source_bundles").select("id,candidate_id,canonical_event_id,event_key,status").or(`candidate_id.in.(${candidateFilter.join(",")}),canonical_event_id.in.(${eventFilter.join(",")})`).limit(1000),
    supabase.from("event_source_syntheses").select("bundle_id,status,is_manifest_valid,manifest_proposal,reconciled_profile").eq("status", "accepted").eq("is_manifest_valid", true).limit(1000),
    supabase.from("event_page_versions").select("status,is_valid,event_pages!event_page_versions_event_page_id_fkey!inner(event_id,event_key,slug)").limit(1000),
    supabase.from("event_verification_cases").select("id,candidate_id,event_id,target_year,status,existence_status,recurrence_status,dates_status,location_status,official_source_count,supporting_source_count").or(`candidate_id.in.(${candidateFilter.join(",")}),event_id.in.(${eventFilter.join(",")})`).order("target_year", { ascending: false }).limit(1000),
    supabase.from("event_factory_packages").select("id,candidate_id,event_id,status,readiness_checks,package_version,page_manifest,art_asset,published_at,updated_at").or(`candidate_id.in.(${candidateFilter.join(",")}),event_id.in.(${eventFilter.join(",")})`).order("package_version", { ascending: false }).order("updated_at", { ascending: false }).limit(1000),
    supabase.from("event_visual_workflows").select("id,candidate_id,event_id,event_key,lane,status,asset,generation_brief,revision_number,updated_at").or(`candidate_id.in.(${candidateFilter.join(",")}),event_id.in.(${eventFilter.join(",")})`).order("revision_number", { ascending: false }).order("updated_at", { ascending: false }).limit(1000),
  ]);

  const warnings: string[] = [];
  for (const result of [candidateSourcesResult, eventSourcesResult, mediaResult, bundlesResult, synthesesResult, pagesResult, verificationCasesResult, packagesResult, visualWorkflowsResult]) {
    if (result.error) warnings.push(result.error.message);
  }

  const candidateSources = (candidateSourcesResult.data ?? []) as CandidateSourceRow[];
  const eventSources = (eventSourcesResult.data ?? []) as EventSourceRow[];
  const media = (mediaResult.data ?? []) as MediaRow[];
  const bundles = (bundlesResult.data ?? []) as BundleRow[];
  const syntheses = (synthesesResult.data ?? []) as SynthesisRow[];
  const pages = (pagesResult.data ?? []) as unknown as PageVersionRow[];
  const verificationCases = (verificationCasesResult.data ?? []) as VerificationCaseRow[];
  const packages = (packagesResult.data ?? []) as PackageRow[];
  const visualWorkflows = (visualWorkflowsResult.data ?? []) as VisualWorkflowRow[];
  const candidateByEvent = new Map(candidates.filter((candidate) => candidate.matched_event_id).map((candidate) => [candidate.matched_event_id as string, candidate]));
  const eventById = new Map(events.map((event) => [event.id, event]));
  const localEventByName = new Map(ATLAS_EVENTS.map((event) => [normalized(event.name), event]));
  const localEventById = new Map(ATLAS_EVENTS.map((event) => [event.id, event]));

  function createItem(event: EventRow | undefined, candidate: CandidateRow | undefined): EventFactoryItem {
    const eventId = event?.id ?? null;
    const candidateId = candidate?.id ?? null;
    const name = event?.name ?? candidate?.candidate_name ?? "Unnamed event";
    const slug = event?.slug ?? candidate?.slug_candidate ?? normalized(name).replaceAll(" ", "-");
    const officialWebsite = event?.official_website ?? candidate?.official_website_candidate ?? null;
    const identity = { candidateId, eventId, eventKey: slug };
    const relatedCandidateSources = candidateSources.filter((source) => sharesEventFactoryIdentity(
      identity,
      { candidateId: source.candidate_id },
    ));
    const relatedEventSources = eventSources.filter((source) => sharesEventFactoryIdentity(
      identity,
      { eventId: source.event_id },
    ));
    const sourceUrls = new Set([...relatedCandidateSources, ...relatedEventSources].map((source) => source.source_url));
    if (officialWebsite) sourceUrls.add(officialWebsite);
    const localEvent = localEventById.get(slug) ?? localEventByName.get(normalized(name));
    const relatedBundles = bundles.filter((bundle) => sharesEventFactoryIdentity(identity, {
      candidateId: bundle.candidate_id,
      eventId: bundle.canonical_event_id,
      eventKey: bundle.event_key,
    }));
    const relatedBundleIds = new Set(relatedBundles.map((bundle) => bundle.id));
    const relatedAcceptedSyntheses = syntheses.filter((synthesis) => relatedBundleIds.has(synthesis.bundle_id));
    const acceptedManifest = relatedAcceptedSyntheses.flatMap((synthesis) => {
      const validation = validateEventPageManifest(synthesis.manifest_proposal);
      if (!validation.ok || validation.value.eventId !== slug || validation.value.slug !== slug) return [];
      return [validation.value];
    })[0];
    const hasAcceptedMap = relatedAcceptedSyntheses.some((synthesis) => hasVerifiedSynthesisMap(synthesis.reconciled_profile));
    const relatedPages = pages.filter((page) => {
      const owner = pageOwner(page);
      return Boolean(owner)
        && (
          sharesEventFactoryIdentity(identity, {
            eventId: owner?.event_id,
            eventKey: owner?.event_key,
          })
          || sharesEventFactoryIdentity(identity, { eventKey: owner?.slug })
        );
    });
    const relatedMedia = media.filter((item) => (
      sharesEventFactoryIdentity(identity, { eventId: item.event_id })
      && item.status === "approved"
      && PRODUCTION_MEDIA_ROLES.has(item.media_role)
    ));
    const verificationCase = verificationCases.find((item) => sharesEventFactoryIdentity(identity, {
      candidateId: item.candidate_id,
      eventId: item.event_id,
    }));
    const eventPackage = packages.find((item) => sharesEventFactoryIdentity(identity, {
      candidateId: item.candidate_id,
      eventId: item.event_id,
    }));
    const publishedPackage = packages.find((item) => item.status === "published" && sharesEventFactoryIdentity(identity, {
      candidateId: item.candidate_id,
      eventId: item.event_id,
    }));
    const visualWorkflow = visualWorkflows.find((item) => sharesEventFactoryIdentity(identity, {
      candidateId: item.candidate_id,
      eventId: item.event_id,
      eventKey: item.event_key,
    }));
    const localManifest = getEventPageManifest(slug);
    const localArt = localEvent ? resolveExplicitEventThumbnail(localEvent) : null;
    const hasLocalCoordinates = Boolean(
      localEvent
      && Number.isFinite(localEvent.latitude)
      && Number.isFinite(localEvent.longitude),
    );
    const hasPublishedPage = relatedPages.some((page) => page.status === "published" && page.is_valid);
    const fallbackAnnual = recurrenceGate(event, candidate);
    const excluded = /^test-|\b(?:write|seed) test\b/i.test(slug) || /\b(?:write|seed) test\b/i.test(name);

    const gates: Record<EventFactoryGateKey, EventFactoryGateState> = {
      exists: verificationCase?.existence_status === "confirmed" ? "ready" : verificationCase?.existence_status === "likely" ? "claimed" : officialWebsite && (event?.verification_status === "verified" || Number(candidate?.discovery_confidence ?? 0) >= 0.8) ? "ready" : officialWebsite ? "claimed" : "missing",
      annual: verificationCase?.recurrence_status === "confirmed" ? "ready" : verificationCase?.recurrence_status === "likely" ? "claimed" : fallbackAnnual,
      dates: verificationCase?.target_year === CURRENT_YEAR && verificationCase.dates_status === "announced" ? "ready" : verificationCase?.target_year === CURRENT_YEAR && verificationCase.dates_status === "not_announced" ? "claimed" : hasCurrentDates(candidate) ? "ready" : "missing",
      location: verificationCase?.location_status === "confirmed" && ((event?.location_verified && event.latitude !== null && event.longitude !== null) || hasAcceptedMap || hasLocalCoordinates) ? "ready" : verificationCase?.location_status === "confirmed" || verificationCase?.location_status === "likely" || event?.city || candidate?.city ? "claimed" : "missing",
      sources: verificationCase && verificationCase.official_source_count >= 1 ? "ready" : Boolean(officialWebsite) ? "claimed" : sourceUrls.size > 0 ? "claimed" : "missing",
      map: (event?.location_verified && event.latitude !== null && event.longitude !== null) || hasAcceptedMap || Boolean(localEvent) ? "ready" : "missing",
      page: hasPublishedPage || relatedPages.some((page) => page.is_valid) || Boolean(acceptedManifest) || Boolean(localManifest) ? "ready" : "missing",
      art: visualWorkflow?.status === "approved" || relatedMedia.length > 0
        ? "ready"
        : visualWorkflow || localArt || acceptedManifest?.hero.imageSrc || localManifest?.hero.imageSrc
          ? "claimed"
          : "missing",
    };
    for (const gate of Object.keys(eventPackage?.readiness_checks ?? {}) as EventFactoryGateKey[]) {
      if (eventPackage?.readiness_checks[gate]) gates[gate] = "ready";
    }
    const stage = stageFor(gates, Boolean(event), verificationCase?.status ?? null, excluded, hasPublishedPage, eventPackage?.status ?? null);
    const publishedHasArt = Boolean(
      typeof publishedPackage?.art_asset?.publicUrl === "string"
        ? publishedPackage.art_asset.publicUrl.trim()
        : typeof publishedPackage?.art_asset?.src === "string"
          ? publishedPackage.art_asset.src.trim()
          : "",
    );
    const pendingUploadedArt = Boolean(
      visualWorkflow
      && ["ready_for_review", "approved"].includes(visualWorkflow.status)
      && typeof visualWorkflow.asset?.publicUrl === "string"
      && visualWorkflow.asset.publicUrl.trim()
      && visualWorkflow.generation_brief?.style === "Externally supplied finished asset"
      && publishedPackage?.art_asset?.visualWorkflowId !== visualWorkflow.id,
    );
    const nonArtReady = (["exists", "annual", "dates", "location", "sources", "map", "page"] as EventFactoryGateKey[])
      .every((gate) => gates[gate] === "ready");
    const publicationArtState: EventFactoryItem["publicationArtState"] = publishedPackage
      ? publishedHasArt
        ? "published_with_approved_art"
        : pendingUploadedArt
          ? "image_uploaded_awaiting_approval"
          : "published_without_art"
      : verificationCase?.status !== "verified"
        ? "private_awaiting_verification"
        : nonArtReady
          ? "private_awaiting_verification"
          : "blocked_non_art";
    return {
      key: eventId ?? candidateId ?? slug,
      candidateId,
      eventId,
      verificationCaseId: verificationCase?.id ?? null,
      targetYear: verificationCase?.target_year ?? null,
      packageId: eventPackage?.id ?? null,
      publishedPackageId: publishedPackage?.id ?? null,
      packageStatus: eventPackage?.status ?? null,
      publicationArtState,
      visualWorkflowId: visualWorkflow?.id ?? null,
      visualWorkflowStatus: visualWorkflow?.status ?? null,
      visualLane: visualWorkflow?.lane ?? null,
      visualWorkflowRevisionNumber: visualWorkflow?.revision_number ?? null,
      verificationStatus: verificationCase?.status ?? null,
      name,
      slug,
      city: event?.city ?? candidate?.city ?? null,
      county: event?.county ?? candidate?.county ?? null,
      eventType: event?.event_type ?? candidate?.event_type ?? "unknown",
      officialWebsite,
      confidenceScore: Number(event?.confidence_score ?? candidate?.discovery_confidence ?? 0),
      stage,
      readinessScore: scoreGates(gates),
      sourceCount: Math.max(sourceUrls.size, (verificationCase?.official_source_count ?? 0) + (verificationCase?.supporting_source_count ?? 0)) + relatedBundles.length,
      gates,
      blockers: excluded ? ["Remove test data from the production catalog"] : blockersFor(gates),
    };
  }

  const items = events.map((event) => createItem(event, candidateByEvent.get(event.id)));
  for (const candidate of candidates) {
    if (!candidate.matched_event_id || !eventById.has(candidate.matched_event_id)) items.push(createItem(undefined, candidate));
  }
  items.sort((a, b) => {
    const stageOrder: Record<EventFactoryStage, number> = { canonical_review: 0, discovery_review: 1, due_diligence: 2, production: 3, ready_for_approval: 4, live: 5, excluded: 6 };
    return stageOrder[a.stage] - stageOrder[b.stage] || b.readinessScore - a.readinessScore || a.name.localeCompare(b.name);
  });

  const productionItems = items.filter((item) => item.stage !== "excluded");
  const counties = new Set(productionItems.map((item) => item.county).filter((county): county is string => Boolean(county)));
  if ((eventResult.count ?? events.length) > events.length || (candidateResult.count ?? candidates.length) > candidates.length) {
    warnings.push("The queue preview is limited to 250 canonical events and 250 candidates; totals remain exact.");
  }

  return {
    generatedAt: new Date().toISOString(),
    state: "ready",
    counts: {
      discoveryCandidates: candidateResult.count ?? candidates.length,
      canonicalEvents: productionItems.filter((item) => item.eventId).length,
      registeredSources: sourceRegistryResult.count ?? 0,
      coveredCounties: counties.size,
      dueDiligenceReady: productionItems.filter((item) => ["exists", "annual", "dates", "location", "sources"].every((key) => item.gates[key as EventFactoryGateKey] === "ready")).length,
      mapReady: productionItems.filter((item) => item.gates.map === "ready").length,
      pageReady: productionItems.filter((item) => item.gates.page === "ready").length,
      approvalReady: productionItems.filter((item) => item.stage === "ready_for_approval").length,
    },
    items: items.slice(0, 80),
    warnings,
  };
}
