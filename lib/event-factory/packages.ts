import "server-only";
import { createHash } from "node:crypto";
import { ATLAS_EVENTS } from "@/data/events";
import type { EventPageManifest } from "@/data/eventPageManifestTypes";
import { validateEventPageManifest } from "@/data/eventPageManifestValidation";
import { getEventPageManifest } from "@/data/eventPageManifests";
import { createAtlasServiceClient } from "@/lib/atlas-control/service";
import {
  createEventPageDraftFromManifest,
  publishEventPageVersion,
  reviewEventPageVersion,
  submitEventPageVersion,
} from "@/lib/event-pages/publishing";
import type { ScoutContentReference } from "@/lib/scout/composerContext";
import { getApprovedEventVisualWorkflow } from "./visuals";
import type {
  EventFactoryGateKey,
  EventFactoryPackageStatus,
  EventFactoryPackageSummary,
} from "./types";

type CandidateRow = {
  id: string;
  candidate_name: string;
  slug_candidate: string;
  event_type: string;
  category: string | null;
  subcategory: string | null;
  city: string | null;
  county: string | null;
  state: string;
  country: string;
  venue_name: string | null;
  start_date: string | null;
  end_date: string | null;
  typical_month: string | null;
  typical_season: string | null;
  description: string | null;
  official_website_candidate: string | null;
  discovery_confidence: number | string;
  matched_event_id: string | null;
};

type CanonicalEventRow = {
  id: string;
  name: string;
  slug: string;
  latitude: number | null;
  longitude: number | null;
  location_source: string | null;
  location_confidence: number | string | null;
  location_verified: boolean;
  short_description: string | null;
};

type AcceptedSynthesisRow = {
  id: string;
  status: string;
  is_manifest_valid: boolean;
  manifest_proposal: unknown;
  reconciled_profile: unknown;
};

type VerifiedMapRecord = {
  latitude: number;
  longitude: number;
  sourceUrl: string;
  sourceLabel: string;
  coordinateMethod: string;
  confidenceScore: number;
};

type PackageRow = {
  id: string;
  verification_case_id: string;
  candidate_id: string;
  event_id: string | null;
  event_key: string;
  slug: string;
  status: EventFactoryPackageStatus;
  package_version: number;
  page_manifest: unknown;
  art_asset: Record<string, unknown>;
};

export type EventFactoryPackagePreview = {
  manifest: EventPageManifest;
  scoutContentReference: ScoutContentReference;
};

type PackageListRow = {
  package_id: string;
  verification_case_id: string;
  candidate_id: string;
  event_id: string | null;
  event_key: string;
  slug: string;
  event_name: string;
  target_year: number;
  status: EventFactoryPackageStatus;
  package_version: number;
  readiness_checks: Record<EventFactoryGateKey, boolean>;
  readiness_score: number | string;
  content_hash: string;
  map_record: Record<string, unknown>;
  art_asset: Record<string, unknown>;
  reviewed_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewed_at: string | null;
  published_at: string | null;
};

function requireServiceClient() {
  const supabase = createAtlasServiceClient();
  if (!supabase) throw new Error("Atlas Control Plane configuration is incomplete.");
  return supabase;
}

function firstRpcRow(data: unknown) {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("Event package operation returned no result.");
  return row as Record<string, unknown>;
}

function contentHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function synthesisMapRecord(value: unknown): VerifiedMapRecord | null {
  const profile = record(value);
  const map = record(profile?.mapRecord);
  const latitude = Number(map?.latitude);
  const longitude = Number(map?.longitude);
  const sourceUrl = typeof map?.sourceUrl === "string" ? map.sourceUrl.trim() : "";
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!/^https?:\/\//i.test(sourceUrl)) return null;
  const rawConfidence = Number(map?.confidenceScore ?? 0.95);
  return {
    latitude,
    longitude,
    sourceUrl,
    sourceLabel: typeof map?.sourceLabel === "string" && map.sourceLabel.trim()
      ? map.sourceLabel.trim()
      : "Accepted source synthesis location",
    coordinateMethod: typeof map?.coordinateMethod === "string" && map.coordinateMethod.trim()
      ? map.coordinateMethod.trim()
      : "manual-verification",
    confidenceScore: Number.isFinite(rawConfidence)
      ? Math.min(1, Math.max(0, rawConfidence))
      : 0.95,
  };
}

function mapPackageRow(row: PackageListRow): EventFactoryPackageSummary {
  return {
    id: row.package_id,
    verificationCaseId: row.verification_case_id,
    candidateId: row.candidate_id,
    eventId: row.event_id,
    eventKey: row.event_key,
    slug: row.slug,
    eventName: row.event_name,
    targetYear: row.target_year,
    status: row.status,
    packageVersion: row.package_version,
    readinessChecks: row.readiness_checks,
    readinessScore: Number(row.readiness_score),
    contentHash: row.content_hash,
    mapRecord: row.map_record,
    artAsset: row.art_asset,
    reviewedBy: row.reviewed_by,
    reviewNotes: row.review_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
  };
}

export async function listEventFactoryPackages(): Promise<{ items: EventFactoryPackageSummary[]; error: string | null }> {
  const supabase = createAtlasServiceClient();
  if (!supabase) return { items: [], error: "Atlas Control Plane configuration is incomplete." };
  const { data, error } = await supabase.rpc("atlas_list_event_factory_packages", { p_limit: 200 });
  if (error) return { items: [], error: error.message };
  return { items: ((data ?? []) as PackageListRow[]).map(mapPackageRow), error: null };
}

export async function prepareEventFactoryPackage(args: {
  verificationCaseId: string;
  candidateId: string;
  actorIdentity: string;
}) {
  const supabase = requireServiceClient();
  const [candidateResult, verificationResult] = await Promise.all([
    supabase
      .from("event_candidates")
      .select("id,candidate_name,slug_candidate,event_type,category,subcategory,city,county,state,country,venue_name,start_date,end_date,typical_month,typical_season,description,official_website_candidate,discovery_confidence,matched_event_id")
      .eq("id", args.candidateId)
      .single(),
    supabase
      .from("event_verification_cases")
      .select("id,candidate_id,status,target_year")
      .eq("id", args.verificationCaseId)
      .single(),
  ]);
  if (candidateResult.error || !candidateResult.data) throw new Error(candidateResult.error?.message ?? "Event candidate was not found.");
  if (verificationResult.error || !verificationResult.data) throw new Error(verificationResult.error?.message ?? "Verification case was not found.");
  if (verificationResult.data.candidate_id !== args.candidateId || verificationResult.data.status !== "verified") {
    throw new Error("The package requires a verified case for this candidate.");
  }

  const candidate = candidateResult.data as CandidateRow;
  const localEvent = ATLAS_EVENTS.find(
    (event) => event.id === candidate.slug_candidate || event.name.toLowerCase() === candidate.candidate_name.toLowerCase(),
  );
  const localManifest = getEventPageManifest(candidate.slug_candidate);
  const canonicalResult = candidate.matched_event_id
    ? await supabase
        .from("events")
        .select("id,name,slug,latitude,longitude,location_source,location_confidence,location_verified,short_description")
        .eq("id", candidate.matched_event_id)
        .maybeSingle()
    : { data: null, error: null };
  if (canonicalResult.error) throw new Error(canonicalResult.error.message);
  const canonicalEvent = canonicalResult.data as CanonicalEventRow | null;

  const bundleResult = await supabase
    .from("event_source_bundles")
    .select("id")
    .or(`candidate_id.eq.${candidate.id},event_key.eq.${candidate.slug_candidate}`)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bundleResult.error) throw new Error(bundleResult.error.message);

  let synthesisId: string | null = null;
  let acceptedManifest: EventPageManifest | undefined;
  let acceptedMapRecord: VerifiedMapRecord | null = null;
  if (bundleResult.data?.id) {
    const synthesisResult = await supabase
      .from("event_source_syntheses")
      .select("id,status,is_manifest_valid,manifest_proposal,reconciled_profile")
      .eq("bundle_id", bundleResult.data.id)
      .eq("status", "accepted")
      .eq("is_manifest_valid", true)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (synthesisResult.error) throw new Error(synthesisResult.error.message);
    const synthesis = synthesisResult.data as AcceptedSynthesisRow | null;
    if (synthesis) {
      const validation = validateEventPageManifest(synthesis.manifest_proposal);
      if (!validation.ok) {
        throw new Error(`Accepted Event Hub proposal is invalid: ${validation.errors.join(" ")}`);
      }
      synthesisId = synthesis.id;
      acceptedManifest = validation.value;
      acceptedMapRecord = synthesisMapRecord(synthesis.reconciled_profile);
    }
  }

  const manifestSource = acceptedManifest ?? localManifest;
  if (!manifestSource) {
    throw new Error("An accepted source synthesis or a complete local Event Hub manifest is required before package review.");
  }
  const approvedVisual = await getApprovedEventVisualWorkflow({
    candidateId: candidate.id,
    eventKey: candidate.slug_candidate,
  });
  if (!approvedVisual?.asset) {
    throw new Error("An approved visual-signature workflow with cloud-hosted hero art is required before package review.");
  }
  const manifest = structuredClone(manifestSource);
  manifest.hero.imageSrc = approvedVisual.asset.publicUrl;
  manifest.hero.imageAlt = approvedVisual.asset.altText;
  manifest.hero.credit = approvedVisual.asset.credit;
  const validation = validateEventPageManifest(manifest);
  if (!validation.ok) throw new Error(`Event Hub preview is invalid: ${validation.errors.join(" ")}`);
  if (/\bsponsor/i.test(JSON.stringify(manifest))) throw new Error("Remove event sponsor references before package review.");

  const hasCanonicalCoordinates = Boolean(
    canonicalEvent?.location_verified
      && canonicalEvent.location_source
      && canonicalEvent.latitude !== null
      && canonicalEvent.longitude !== null,
  );
  const hasLocalCoordinates = Boolean(localEvent?.coordinateSource);
  if (!hasCanonicalCoordinates && !acceptedMapRecord && !hasLocalCoordinates) {
    throw new Error("Verified coordinate provenance is required before package review.");
  }
  const latitude = hasCanonicalCoordinates
    ? canonicalEvent!.latitude!
    : acceptedMapRecord?.latitude ?? localEvent!.latitude;
  const longitude = hasCanonicalCoordinates
    ? canonicalEvent!.longitude!
    : acceptedMapRecord?.longitude ?? localEvent!.longitude;
  const coordinateSourceUrl = hasCanonicalCoordinates
    ? canonicalEvent!.location_source!
    : acceptedMapRecord?.sourceUrl ?? localEvent!.coordinateSource!.url;
  const coordinateSourceLabel = hasCanonicalCoordinates
    ? "Verified canonical event location"
    : acceptedMapRecord?.sourceLabel ?? localEvent!.coordinateSource!.label;
  const coordinateMethod = hasCanonicalCoordinates
    ? "manual-verification"
    : acceptedMapRecord?.coordinateMethod ?? localEvent!.coordinateSource!.method;

  const canonicalProfile = {
    name: manifest.identity.name,
    shortName: manifest.identity.shortName,
    eventType: candidate.event_type,
    category: candidate.category,
    subcategory: candidate.subcategory,
    city: candidate.city,
    county: candidate.county,
    state: candidate.state,
    country: candidate.country,
    venueName: candidate.venue_name ?? manifest.identity.venue,
    startsOn: candidate.start_date ?? manifest.identity.startsOn,
    endsOn: candidate.end_date ?? manifest.identity.endsOn,
    typicalMonth: candidate.typical_month,
    typicalSeason: candidate.typical_season,
    recurrencePattern: "annual",
    officialWebsite: candidate.official_website_candidate,
    shortDescription: candidate.description ?? canonicalEvent?.short_description ?? localEvent?.blurb ?? manifest.hero.tagline,
    longDescription: manifest.hero.tagline,
    confidenceScore: Number(candidate.discovery_confidence),
  };
  const mapRecord = {
    latitude,
    longitude,
    locationLabel: localEvent?.location ?? manifest.identity.location,
    venueName: candidate.venue_name ?? manifest.identity.venue,
    sourceUrl: coordinateSourceUrl,
    sourceLabel: coordinateSourceLabel,
    coordinateMethod,
    confidenceScore: hasCanonicalCoordinates
      ? Number(canonicalEvent?.location_confidence ?? 0.95)
      : acceptedMapRecord?.confidenceScore ?? 0.97,
  };
  const scoutContext = {
    eventKey: manifest.eventId,
    sourceIds: manifest.sources.map((source) => source.id),
    suggestions: manifest.scoutSuggestions,
  };
  const artBrief = {
    workflowVersion: "visual-signature-v1",
    visualWorkflowId: approvedVisual.id,
    lane: approvedVisual.lane,
    eventName: manifest.identity.name,
    place: manifest.identity.location,
    venue: manifest.identity.venue,
    season: candidate.typical_season,
    searchQuery: approvedVisual.searchQuery,
    reviewedThumbnailCount: approvedVisual.reviewedThumbnailCount,
    referenceSources: approvedVisual.referenceSources,
    visualSignature: approvedVisual.visualSignature,
    generationBrief: approvedVisual.generationBrief,
    factualExclusions: ["third-party sponsor marks", "unverified performers", "unsupported landmarks", "invented lettering"],
    requiredPlacements: ["event-hub hero", "map card", "social preview"],
  };
  const artAsset = {
    workflowVersion: "visual-signature-v1",
    visualWorkflowId: approvedVisual.id,
    src: approvedVisual.asset.publicUrl,
    publicUrl: approvedVisual.asset.publicUrl,
    alt: approvedVisual.asset.altText,
    credit: approvedVisual.asset.credit,
    sourceKind: "supabase",
    storageBucket: approvedVisual.asset.storageBucket,
    storagePath: approvedVisual.asset.storagePath,
    reviewState: "approved",
    qaChecks: approvedVisual.qaChecks,
  };
  const packagePayload = {
    canonicalProfile,
    mapRecord,
    pageManifest: manifest,
    scoutContext,
    artBrief,
    artAsset,
  };

  if (approvedVisual.supersedesWorkflowId) {
    const sourcePackagesResult = await supabase
      .from("event_factory_packages")
      .select("id,content_hash,art_asset")
      .eq("candidate_id", candidate.id)
      .eq("target_year", verificationResult.data.target_year)
      .eq("status", "published")
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(20);
    if (sourcePackagesResult.error) throw new Error(sourcePackagesResult.error.message);
    const sourcePackage = (sourcePackagesResult.data ?? []).find((item) => (
      record(item.art_asset)?.visualWorkflowId === approvedVisual.supersedesWorkflowId
    ));
    if (!sourcePackage) {
      throw new Error("The approved visual correction does not match a released Event Factory package.");
    }
    const correctionHash = contentHash({
      sourcePackageId: sourcePackage.id,
      sourcePackageHash: sourcePackage.content_hash,
      visualWorkflowId: approvedVisual.id,
      visualWorkflowHash: approvedVisual.contentHash,
      scope: "hero_only",
    });
    const correction = await supabase.rpc("atlas_create_event_factory_hero_correction", {
      p_source_package_id: sourcePackage.id,
      p_visual_workflow_id: approvedVisual.id,
      p_content_hash: correctionHash,
      p_actor_identity: args.actorIdentity,
      p_notes: "Prepared from an approved same-edition hero correction.",
    });
    if (correction.error) throw new Error(correction.error.message);
    return firstRpcRow(correction.data);
  }

  const { data, error } = await supabase.rpc("atlas_upsert_event_factory_package", {
    p_verification_case_id: args.verificationCaseId,
    p_source_bundle_id: bundleResult.data?.id ?? null,
    p_synthesis_id: synthesisId,
    p_event_key: manifest.eventId,
    p_slug: manifest.slug,
    p_canonical_profile: canonicalProfile,
    p_map_record: mapRecord,
    p_page_manifest: manifest,
    p_scout_context: scoutContext,
    p_art_brief: artBrief,
    p_art_asset: artAsset,
    p_content_hash: contentHash(packagePayload),
    p_actor_identity: args.actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

async function getPackage(packageId: string): Promise<PackageRow> {
  const supabase = requireServiceClient();
  const { data, error } = await supabase
    .from("event_factory_packages")
    .select("id,verification_case_id,candidate_id,event_id,event_key,slug,status,package_version,page_manifest,art_asset")
    .eq("id", packageId)
    .single();
  if (error || !data) throw new Error(error?.message ?? "Event package was not found.");
  return data as PackageRow;
}

export async function getEventFactoryPackagePreview(
  packageId: string,
): Promise<EventFactoryPackagePreview> {
  const packageRow = await getPackage(packageId);
  const validation = validateEventPageManifest(packageRow.page_manifest);
  if (!validation.ok) {
    throw new Error(`Event package preview is invalid: ${validation.errors.join(" ")}`);
  }
  return {
    manifest: validation.value,
    scoutContentReference: {
      sourceKind: "event-factory-package",
      packageId: packageRow.id,
      packageVersion: String(packageRow.package_version),
    },
  };
}

const PUBLIC_PREVIEW_STATUSES = new Set<EventFactoryPackageStatus>([
  "ready_for_review",
  "approved",
  "publishing",
  "published",
  "failed",
]);

export async function getPublicEventFactoryPackagePreview(
  packageId: string,
): Promise<EventFactoryPackagePreview> {
  const packageRow = await getPackage(packageId);
  if (!PUBLIC_PREVIEW_STATUSES.has(packageRow.status)) {
    throw new Error("This event package is not available for read-only review.");
  }
  const validation = validateEventPageManifest(packageRow.page_manifest);
  if (!validation.ok) {
    throw new Error(`Event package preview is invalid: ${validation.errors.join(" ")}`);
  }
  return {
    manifest: validation.value,
    scoutContentReference: {
      sourceKind: "event-factory-package",
      packageId: packageRow.id,
      packageVersion: String(packageRow.package_version),
    },
  };
}

export async function reviewEventFactoryPackage(args: {
  packageId: string;
  decision: "approve" | "reject" | "reopen";
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_review_event_factory_package", {
    p_package_id: args.packageId,
    p_decision: args.decision,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

async function materializeEventFactoryPackage(packageId: string, actorIdentity: string) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_materialize_event_factory_package", {
    p_package_id: packageId,
    p_actor_identity: actorIdentity,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

async function finishEventFactoryPublication(args: {
  packageId: string;
  succeeded: boolean;
  actorIdentity: string;
  notes?: string;
}) {
  const supabase = requireServiceClient();
  const { data, error } = await supabase.rpc("atlas_finish_event_factory_publication", {
    p_package_id: args.packageId,
    p_succeeded: args.succeeded,
    p_actor_identity: args.actorIdentity,
    p_notes: args.notes ?? null,
  });
  if (error) throw new Error(error.message);
  return firstRpcRow(data);
}

async function registerApprovedPackageArt(eventId: string, eventKey: string, artAsset: Record<string, unknown>) {
  const supabase = requireServiceClient();
  const src = typeof artAsset.src === "string" ? artAsset.src : "";
  const alt = typeof artAsset.alt === "string" ? artAsset.alt : "";
  if (!src || !alt) throw new Error("The approved package does not contain usable art.");
  const source = artAsset.sourceKind === "supabase" ? "supabase" : "local";
  const storageBucket = typeof artAsset.storageBucket === "string" ? artAsset.storageBucket : null;
  const storagePath = typeof artAsset.storagePath === "string" ? artAsset.storagePath : null;

  const existing = await supabase
    .from("event_media")
    .select("id")
    .eq("event_id", eventId)
    .eq("media_role", "hero")
    .eq("source", source)
    .eq("public_url", src)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message);
  if (existing.data?.id) {
    const update = await supabase.from("event_media").update({ status: "approved", alt_text: alt, updated_at: new Date().toISOString() }).eq("id", existing.data.id);
    if (update.error) throw new Error(update.error.message);
    return existing.data.id;
  }

  const insert = await supabase.from("event_media").insert({
    event_id: eventId,
    media_role: "hero",
    source,
    status: "approved",
    storage_bucket: storageBucket,
    storage_path: storagePath,
    public_url: src,
    title: `${eventKey} Celebration Atlas hero art`,
    alt_text: alt,
    updated_at: new Date().toISOString(),
  }).select("id").single();
  if (insert.error) throw new Error(insert.error.message);
  return insert.data.id;
}

function assertReviewedVisualAsset(artAsset: Record<string, unknown>) {
  if (artAsset.workflowVersion !== "visual-signature-v1") return;
  const qa = record(artAsset.qaChecks);
  const publicUrl = typeof artAsset.publicUrl === "string" ? artAsset.publicUrl : "";
  const checksComplete = qa?.visualElementsVerified === true
    && qa.independentComposition === true
    && qa.noInventedTextOrMarks === true
    && qa.mobileCropVerified === true
    && qa.publicAssetVerified === true;
  if (artAsset.reviewState !== "approved" || artAsset.sourceKind !== "supabase" || !/^https:\/\//i.test(publicUrl) || !checksComplete) {
    throw new Error("The visual-signature workflow must be approved, publicly hosted, and fully checked before publication.");
  }
}

async function publishReviewedManifest(manifest: EventPageManifest, actorIdentity: string) {
  const draft = await createEventPageDraftFromManifest({
    manifest,
    actorIdentity,
    sourceKind: "ai_assisted",
    changeSummary: "Approved complete Event Factory package",
  });
  const versionId = String(draft.version_id ?? "");
  let status = String(draft.status ?? "");
  if (!versionId) throw new Error("The Event Hub draft did not return a version id.");
  if (status === "draft") status = String((await submitEventPageVersion(versionId, actorIdentity)).status ?? "");
  if (status === "in_review") status = String((await reviewEventPageVersion({ versionId, actorIdentity, decision: "approve", notes: "Approved with the complete Event Factory package." })).status ?? "");
  if (status === "approved") status = String((await publishEventPageVersion(versionId, actorIdentity)).status ?? "");
  if (status !== "published") throw new Error(`Event Hub publication stopped in ${status || "an unknown state"}.`);
  return versionId;
}

export async function approveAndPublishEventFactoryPackage(args: {
  packageId: string;
  actorIdentity: string;
  notes?: string;
}) {
  let packageRow = await getPackage(args.packageId);
  if (packageRow.status === "ready_for_review") {
    await reviewEventFactoryPackage({
      packageId: args.packageId,
      decision: "approve",
      actorIdentity: args.actorIdentity,
      notes: args.notes,
    });
    packageRow = await getPackage(args.packageId);
  }
  if (!["approved", "publishing", "failed"].includes(packageRow.status)) {
    throw new Error("This package is not ready for approval and publication.");
  }

  const validation = validateEventPageManifest(packageRow.page_manifest);
  if (!validation.ok) throw new Error(`Reviewed Event Hub manifest is invalid: ${validation.errors.join(" ")}`);
  assertReviewedVisualAsset(packageRow.art_asset);

  let materialized = packageRow.status === "publishing";
  try {
    const materialization = await materializeEventFactoryPackage(args.packageId, args.actorIdentity);
    materialized = true;
    const eventId = String(materialization.event_id ?? "");
    if (!eventId) throw new Error("Canonical event materialization did not return an event id.");
    const [versionId, mediaId] = await Promise.all([
      publishReviewedManifest(validation.value, args.actorIdentity),
      registerApprovedPackageArt(eventId, packageRow.event_key, packageRow.art_asset),
    ]);
    const finished = await finishEventFactoryPublication({
      packageId: args.packageId,
      succeeded: true,
      actorIdentity: args.actorIdentity,
      notes: args.notes,
    });
    return { ...finished, versionId, mediaId };
  } catch (error) {
    if (materialized) {
      await finishEventFactoryPublication({
        packageId: args.packageId,
        succeeded: false,
        actorIdentity: args.actorIdentity,
        notes: error instanceof Error ? error.message : "Package publication failed.",
      }).catch(() => undefined);
    }
    throw error;
  }
}
