import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { EVENT_PAGE_MANIFESTS } from "../data/eventPageManifests.ts";
import { validateEventPageContentReadiness } from "../data/eventPageContentReadiness.ts";
import { validateEventPageManifest } from "../data/eventPageManifestValidation.ts";
import {
  EVENT_HERO_UPLOAD_SPEC,
  validateEventHeroUploadMetadata,
} from "../lib/event-factory/heroUploadSpec.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file: string) => readFile(path.join(root, file), "utf8");

function migrationFunction(source: string, name: string) {
  const match = source.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\n\\$\\$;`),
  );
  assert(match, `migration 027 must define ${name}`);
  return match[0];
}

async function validateMigrationServices(migration: string) {
  const db = new PGlite();
  const id = (value: number) => `00000000-0000-4000-8000-${String(value).padStart(12, "0")}`;
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create or replace function public.atlas_assert_service_role()
      returns void language plpgsql security definer set search_path = ''
      as $$ begin return; end; $$;

      create table public.event_candidates (
        id uuid primary key,
        duplicate_status text not null,
        needs_review boolean not null
      );
      create table public.event_verification_cases (
        id uuid primary key,
        status text not null
      );
      create table public.event_factory_packages (
        id uuid primary key default gen_random_uuid(),
        verification_case_id uuid not null,
        candidate_id uuid not null,
        event_id uuid,
        source_bundle_id uuid,
        synthesis_id uuid,
        target_year integer not null,
        event_key text not null,
        slug text not null,
        status text not null,
        package_version integer not null,
        canonical_profile jsonb not null default '{}'::jsonb,
        map_record jsonb not null default '{}'::jsonb,
        page_manifest jsonb not null,
        scout_context jsonb not null default '{}'::jsonb,
        art_brief jsonb not null default '{}'::jsonb,
        art_asset jsonb not null default '{}'::jsonb,
        readiness_checks jsonb not null,
        readiness_score numeric not null,
        content_hash text not null,
        created_by text not null,
        reviewed_by text,
        review_notes text,
        published_by text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        ready_at timestamptz,
        reviewed_at timestamptz,
        published_at timestamptz,
        supersedes_package_id uuid
      );
      create table public.event_factory_package_actions (
        id uuid primary key default gen_random_uuid(),
        package_id uuid not null,
        action_type text not null,
        actor_identity text not null,
        from_status text,
        to_status text not null,
        notes text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
      create table public.event_visual_workflows (
        id uuid primary key default gen_random_uuid(),
        candidate_id uuid not null,
        event_id uuid,
        source_bundle_id uuid,
        target_year integer not null,
        event_key text not null,
        event_name text not null,
        location_label text not null,
        lane text not null,
        status text not null,
        search_query text not null,
        reviewed_thumbnail_count integer not null,
        reference_sources jsonb not null,
        visual_signature jsonb not null,
        generation_brief jsonb not null,
        asset jsonb not null,
        qa_checks jsonb not null,
        content_hash text not null,
        created_by text not null,
        reviewed_by text,
        review_notes text,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now(),
        ready_at timestamptz,
        reviewed_at timestamptz,
        revision_number integer not null,
        supersedes_workflow_id uuid
      );
      create table public.event_visual_workflow_actions (
        id uuid primary key default gen_random_uuid(),
        workflow_id uuid not null,
        action_type text not null,
        actor_identity text not null,
        from_status text,
        to_status text not null,
        notes text,
        metadata jsonb not null default '{}'::jsonb,
        created_at timestamptz not null default now()
      );
    `);
    await db.exec(migrationFunction(migration, "atlas_finalize_art_optional_event_factory_package"));
    await db.exec(migrationFunction(migration, "atlas_create_manual_event_visual_workflow"));
    await db.exec(migrationFunction(migration, "atlas_create_event_factory_art_revision"));

    const candidateId = id(1);
    const caseId = id(2);
    const eventId = id(3);
    const packageId = id(4);
    const checks = {
      exists: true,
      annual: true,
      dates: true,
      location: true,
      sources: true,
      map: true,
      page: true,
      art: false,
    };
    const manifest = {
      eventId: "fixture-event",
      slug: "fixture-event",
      identity: { name: "Fixture Event", location: "Fixture, Michigan" },
      hero: { imageSrc: "", imageAlt: "" },
    };
    await db.query(
      `insert into public.event_candidates values ($1::uuid, 'unique_candidate', false)`,
      [candidateId],
    );
    await db.query(
      `insert into public.event_verification_cases values ($1::uuid, 'verified')`,
      [caseId],
    );
    await db.query(`
      insert into public.event_factory_packages (
        id, verification_case_id, candidate_id, event_id, target_year, event_key,
        slug, status, package_version, page_manifest, readiness_checks,
        readiness_score, content_hash, created_by, published_at
      ) values (
        $1::uuid, $2::uuid, $3::uuid, $4::uuid, 2026, 'fixture-event',
        'fixture-event', 'published', 1, $5::jsonb, $6::jsonb,
        1, $7::text, 'fixture', now()
      )
    `, [packageId, caseId, candidateId, eventId, JSON.stringify(manifest), JSON.stringify(checks), "1".padStart(64, "0")]);

    const reviewReadyCandidateId = id(10);
    const reviewReadyCaseId = id(11);
    const reviewReadyPackageId = id(12);
    await db.query(`insert into public.event_candidates values ($1::uuid, 'unique_candidate', false)`, [reviewReadyCandidateId]);
    await db.query(`insert into public.event_verification_cases values ($1::uuid, 'verified')`, [reviewReadyCaseId]);
    await db.query(`
      insert into public.event_factory_packages (
        id, verification_case_id, candidate_id, target_year, event_key, slug,
        status, package_version, page_manifest, readiness_checks, readiness_score,
        content_hash, created_by
      ) values (
        $1::uuid, $2::uuid, $3::uuid, 2026, 'review-ready-fixture',
        'review-ready-fixture', 'assembling', 1, $4::jsonb, $5::jsonb,
        0.875, $6::text, 'fixture'
      )
    `, [
      reviewReadyPackageId,
      reviewReadyCaseId,
      reviewReadyCandidateId,
      JSON.stringify({ ...manifest, eventId: "review-ready-fixture", slug: "review-ready-fixture" }),
      JSON.stringify(checks),
      "5".padStart(64, "0"),
    ]);
    const finalized = await db.query<{ status: string; readiness_score: string }>(`
      select * from public.atlas_finalize_art_optional_event_factory_package(
        $1::uuid, 'operator@example.test'
      )
    `, [reviewReadyPackageId]);
    assert.equal(finalized.rows[0]?.status, "ready_for_review");
    assert.equal(Number(finalized.rows[0]?.readiness_score), 1);

    const disputedCandidateId = id(13);
    const disputedCaseId = id(14);
    const disputedPackageId = id(15);
    await db.query(`insert into public.event_candidates values ($1::uuid, 'unchecked', true)`, [disputedCandidateId]);
    await db.query(`insert into public.event_verification_cases values ($1::uuid, 'verified')`, [disputedCaseId]);
    await db.query(`
      insert into public.event_factory_packages (
        id, verification_case_id, candidate_id, target_year, event_key, slug,
        status, package_version, page_manifest, readiness_checks, readiness_score,
        content_hash, created_by
      ) values (
        $1::uuid, $2::uuid, $3::uuid, 2026, 'disputed-fixture',
        'disputed-fixture', 'assembling', 1, $4::jsonb, $5::jsonb,
        0.875, $6::text, 'fixture'
      )
    `, [
      disputedPackageId,
      disputedCaseId,
      disputedCandidateId,
      JSON.stringify({ ...manifest, eventId: "disputed-fixture", slug: "disputed-fixture" }),
      JSON.stringify(checks),
      "6".padStart(64, "0"),
    ]);
    await assert.rejects(
      db.query(`select * from public.atlas_finalize_art_optional_event_factory_package($1::uuid, 'operator@example.test')`, [disputedPackageId]),
      /identity-cleared, verified assembling package/,
    );

    const asset = {
      publicUrl: "https://example.test/fixture.webp",
      altText: "Fixture event artwork",
      credit: "Celebration Atlas artwork",
      sourceKind: "supabase",
      storageBucket: "celebration-atlas-media",
      storagePath: "events/fixture-event/hero/fixture.webp",
      contentType: "image/webp",
      byteSize: 1_000_000,
      width: 1024,
      height: 1536,
      sourceFilename: "fixture.webp",
      uploadedBy: "operator@example.test",
      uploadedAt: "2026-07-29T12:00:00.000Z",
      provenanceCategory: "externally_supplied",
    };
    const manual = await db.query<{ workflow_id: string }>(`
      select * from public.atlas_create_manual_event_visual_workflow(
        $1::uuid, $2::jsonb, $3::jsonb, $4::text, 'operator@example.test'
      )
    `, [
      packageId,
      JSON.stringify(asset),
      JSON.stringify({
        correctEvent: true,
        rightsConfirmed: true,
        noInventedMarks: true,
        fullFrameReviewed: true,
      }),
      "2".padStart(64, "0"),
    ]);
    assert.equal(manual.rows[0]?.workflow_id.length, 36);
    const workflowId = manual.rows[0]!.workflow_id;
    await db.query(`
      update public.event_visual_workflows
      set status = 'approved',
          reviewed_by = 'operator@example.test',
          reviewed_at = now()
      where id = $1::uuid
    `, [workflowId]);

    const attachment = await db.query<{ package_id: string; event_key: string }>(`
      select * from public.atlas_create_event_factory_art_revision(
        $1::uuid, $2::uuid, $3::text, 'operator@example.test', 'fixture attach'
      )
    `, [packageId, workflowId, "3".padStart(64, "0")]);
    assert.equal(attachment.rows[0]?.event_key, "fixture-event");
    const attachedPackageId = attachment.rows[0]!.package_id;
    const attached = await db.query<{ event_id: string; image_src: string }>(`
      select event_id::text, page_manifest#>>'{hero,imageSrc}' as image_src
      from public.event_factory_packages where id = $1::uuid
    `, [attachedPackageId]);
    assert.equal(attached.rows[0]?.event_id, eventId);
    assert.equal(attached.rows[0]?.image_src, asset.publicUrl);

    await db.query(`
      update public.event_factory_packages
      set status = 'published', published_at = now()
      where id = $1::uuid
    `, [attachedPackageId]);
    const removal = await db.query<{ package_id: string }>(`
      select * from public.atlas_create_event_factory_art_revision(
        $1::uuid, null, $2::text, 'operator@example.test', 'fixture removal'
      )
    `, [attachedPackageId, "4".padStart(64, "0")]);
    const removed = await db.query<{ event_id: string; image_src: string; art_ready: boolean }>(`
      select event_id::text,
             page_manifest#>>'{hero,imageSrc}' as image_src,
             (readiness_checks->>'art')::boolean as art_ready
      from public.event_factory_packages where id = $1::uuid
    `, [removal.rows[0]!.package_id]);
    assert.equal(removed.rows[0]?.event_id, eventId);
    assert.equal(removed.rows[0]?.image_src, "");
    assert.equal(removed.rows[0]?.art_ready, false);
  } finally {
    await db.close();
  }
}

async function validateContentGuardMigration(migration: string) {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin;
      create or replace function public.atlas_assert_service_role()
      returns void language plpgsql security definer set search_path = ''
      as $$ begin return; end; $$;
      create table public.event_factory_packages (
        id uuid primary key default gen_random_uuid(),
        status text not null,
        supersedes_package_id uuid,
        page_manifest jsonb not null,
        readiness_checks jsonb not null default '{}'::jsonb
      );
    `);
    const strictManifest = {
      schemaVersion: 1,
      id: "event-page-content-guard",
      eventId: "content-guard",
      slug: "content-guard",
      recipe: "simpleEvent",
      lifecycle: "upcoming",
      identity: {
        name: "Content Guard Art Fair",
        shortName: "Content Guard",
        location: "River Park, Michigan",
        dateText: "August 8-9, 2026",
        startsOn: "2026-08-08",
        endsOn: "2026-08-09",
        timezone: "America/Detroit",
      },
      hero: {
        imageSrc: "",
        imageAlt: "",
        eyebrow: "Event Hub",
        tagline: "Artists, live music, and family activities fill a weekend at River Park.",
      },
      navigation: [
        { id: "nav-why", targetModuleId: "why-go" },
        { id: "nav-schedule", targetModuleId: "schedule" },
        { id: "nav-highlights", targetModuleId: "highlights" },
        { id: "nav-plan", targetModuleId: "plan" },
      ],
      modules: [
        {
          id: "why-go",
          type: "whyGo",
          headline: "Build a day around artists, music, and hands-on activities.",
          summary: "Content Guard Art Fair brings artists, live music, and family activities together for a practical weekend visit.",
          metrics: [],
          audienceGroups: [{ id: "audience", sourceIds: ["official"] }],
        },
        {
          id: "schedule",
          type: "schedule",
        },
        {
          id: "highlights",
          type: "highlights",
          items: [
            { id: "artists", sourceIds: ["official"] },
            { id: "music", sourceIds: ["official"] },
            { id: "family", sourceIds: ["official"] },
          ],
        },
        {
          id: "plan",
          type: "planVisit",
          details: [
            { id: "location", sourceIds: ["official"] },
            { id: "dates", sourceIds: ["official"] },
          ],
        },
      ],
      scheduleItems: [{ id: "hours", sourceIds: ["official"] }],
      sources: [{ id: "official" }],
    };
    const shellManifest = structuredClone(strictManifest);
    shellManifest.navigation = shellManifest.navigation.filter(
      (item) => item.targetModuleId !== "highlights",
    );
    shellManifest.modules = shellManifest.modules.filter(
      (module) => module.type !== "highlights",
    );
    const legacyPublished = await db.query<{ id: string }>(`
      insert into public.event_factory_packages (status, page_manifest)
      values ('published', $1::jsonb)
      returning id::text
    `, [JSON.stringify(shellManifest)]);

    await db.exec(migration);

    const ready = await db.query<{ ready: boolean }>(
      "select public.atlas_event_factory_content_ready_v2($1::jsonb) as ready",
      [JSON.stringify(strictManifest)],
    );
    assert.equal(ready.rows[0]?.ready, true);
    await assert.rejects(
      db.query(`
        insert into public.event_factory_packages (status, page_manifest)
        values ('assembling', $1::jsonb)
      `, [JSON.stringify(shellManifest)]),
      /four substantive, source-backed Event Hub topics/,
    );
    await db.query(`
      insert into public.event_factory_packages (status, page_manifest)
      values ('assembling', $1::jsonb)
    `, [JSON.stringify(strictManifest)]);
    await assert.rejects(
      db.query(`
        insert into public.event_factory_packages (status, page_manifest)
        values ('published', $1::jsonb)
      `, [JSON.stringify(shellManifest)]),
      /four substantive, source-backed Event Hub topics/,
    );
    await db.query(`
      update public.event_factory_packages
      set readiness_checks = '{"legacyChecked": true}'::jsonb
      where id = $1::uuid
    `, [legacyPublished.rows[0]?.id]);
  } finally {
    await db.close();
  }
}

async function main() {
  assert.deepEqual(
    {
      width: EVENT_HERO_UPLOAD_SPEC.width,
      height: EVENT_HERO_UPLOAD_SPEC.height,
      aspectRatio: EVENT_HERO_UPLOAD_SPEC.aspectRatio,
      maxBytes: EVENT_HERO_UPLOAD_SPEC.maxBytes,
    },
    { width: 1024, height: 1536, aspectRatio: "2:3", maxBytes: 8_388_608 },
  );

  const validMetadata = {
    width: 1024,
    height: 1536,
    byteSize: 1_000_000,
    mimeType: "image/webp",
    format: "webp",
    pages: 1,
  };
  assert.equal(validateEventHeroUploadMetadata(validMetadata).ok, true);
  assert.equal(validateEventHeroUploadMetadata({ ...validMetadata, width: 1023 }).ok, false);
  assert.equal(validateEventHeroUploadMetadata({ ...validMetadata, height: 1535 }).ok, false);
  assert.equal(validateEventHeroUploadMetadata({ ...validMetadata, mimeType: "image/gif", format: "gif" }).ok, false);
  assert.equal(validateEventHeroUploadMetadata({ ...validMetadata, byteSize: EVENT_HERO_UPLOAD_SPEC.maxBytes + 1 }).ok, false);
  assert.equal(validateEventHeroUploadMetadata({ ...validMetadata, pages: 2 }).ok, false);

  const imageFreeManifest = structuredClone(EVENT_PAGE_MANIFESTS[0]);
  imageFreeManifest.hero.imageSrc = "";
  imageFreeManifest.hero.imageAlt = "";
  delete imageFreeManifest.hero.credit;
  const strictValidation = validateEventPageManifest(imageFreeManifest);
  const contentValidation = validateEventPageContentReadiness(
    imageFreeManifest,
    { allowLegacyStructure: true },
  );
  assert.equal(strictValidation.ok, true, "a complete manifest must remain valid with a deliberately empty hero pair");
  assert.equal(contentValidation.ok, true);
  assert.equal(contentValidation.ok && contentValidation.artPending, true);
  const mismatchedHero = structuredClone(imageFreeManifest);
  mismatchedHero.hero.imageSrc = "https://example.test/hero.webp";
  assert.equal(validateEventPageManifest(mismatchedHero).ok, false, "partial hero metadata must fail");

  const [
    eventHub,
    eventHubCss,
    publishedResolver,
    publicRoute,
    uploadRoute,
    heroOptimization,
    visualRoute,
    factoryRoute,
    manualControl,
    packages,
    runtime,
    stages,
    countyOperator,
    migration,
    contentGuardMigration,
    specification,
  ] = await Promise.all([
    read("components/EventHub.tsx"),
    read("components/EventHub.module.css"),
    read("lib/event-pages/publishedManifest.ts"),
    read("app/events/[id]/page.tsx"),
    read("app/api/atlas-control/event-visuals/upload/route.ts"),
    read("lib/event-factory/heroOptimization.ts"),
    read("app/api/atlas-control/event-visuals/route.ts"),
    read("app/api/atlas-control/event-factory/route.ts"),
    read("app/atlas-control/ManualEventHeroUpload.tsx"),
    read("lib/event-factory/packages.ts"),
    read("lib/michigan-completion/runtime.ts"),
    read("lib/michigan-completion/stageRegistry.ts"),
    read("lib/michigan-completion/countyOperator.ts"),
    read("supabase/migrations/027_art_optional_event_hubs.sql"),
    read("supabase/migrations/030_enforce_new_event_content_readiness.sql"),
    read("docs/EVENT_IMAGE_SPECIFICATION.md"),
  ]);

  assert(eventHub.includes("imageFreeHero = artPending || !manifest.hero.imageSrc.trim()"));
  assert(eventHub.includes('data-image-free-hero="true"'));
  assert(eventHub.includes("imageFreeHero ? ("));
  assert(eventHubCss.includes("object-fit: contain"), "the complete prepared canvas must not be cropped");
  assert(!eventHub.includes("generated placeholder"), "the image-free hero must not request placeholder art");
  assert(publishedResolver.includes("artPending: !validation.value.hero.imageSrc.trim()"));
  assert(publicRoute.includes("artPending={resolvedEventPage.artPending}"));

  assert(uploadRoute.includes("optimizeEventHeroUpload"));
  assert(heroOptimization.includes("sharp(input"));
  assert(heroOptimization.includes("validateEventHeroUploadMetadata"));
  assert(uploadRoute.includes("sourceFilename: file.name"));
  assert(uploadRoute.includes("uploadedBy: auth.admin.email"));
  assert(uploadRoute.includes('provenanceCategory: "externally_supplied"'));
  assert(manualControl.includes("Upload for approval"));
  assert(manualControl.includes("Approve and attach"));
  assert(manualControl.includes("Remove current image"));
  assert(manualControl.includes("data-complete-canvas-preview"));
  assert(visualRoute.includes('action === "approve_manual_and_attach"'));
  assert(visualRoute.includes("createEventFactoryArtRevision"));
  assert(visualRoute.includes("approveAndPublishEventFactoryPackage"));
  assert(visualRoute.includes("revalidatePath(`/events/${workflow.eventKey}`)"));
  assert(factoryRoute.includes('action === "remove_art_and_publish"'));
  assert(factoryRoute.includes('revalidatePath("/")'));
  assert(packages.includes("validation.artPending"));
  assert(packages.includes("mediaId = validation.artPending"));
  assert(packages.includes("atlas_finalize_art_optional_event_factory_package"));

  assert(runtime.includes("visualOutput.provenanceBlocked !== true"));
  assert(!stages.includes('exceptionCodes: ["missing_approved_image"'));
  for (const state of [
    "published_with_approved_art",
    "published_without_art",
    "image_uploaded_awaiting_approval",
    "blocked_non_art",
    "private_awaiting_verification",
  ]) {
    assert(countyOperator.includes(state), `county report must expose ${state}`);
  }

  assert(migration.trimStart().startsWith("-- Allow reviewed Event Factory publication"));
  assert(/(?:^|\r?\n)begin;\r?\n/.test(migration));
  assert(migration.trimEnd().endsWith("commit;"));
  assert(!/\bcreate\s+table\b/i.test(migration), "migration 027 must add no table");
  assert(migration.includes("perform public.atlas_assert_service_role();"));
  assert(migration.includes("to service_role;"));
  assert(migration.includes("from public, anon, authenticated;"));
  assert(migration.includes("Every non-art package requirement must pass"));
  assert(migration.includes("v_case.status is distinct from 'verified'"));
  assert(migration.includes("v_candidate.duplicate_status is distinct from 'unique_candidate'"));
  assert(migration.includes("v_candidate.needs_review is distinct from false"));
  assert(migration.includes("p_media_id is not null"));
  assert(migration.includes("'event_id_retained', v_source.event_id"));
  assert(migration.includes("'public_url_retained', '/events/' || v_source.slug"));
  assert(!/\bdelete\s+from\s+public\.(events|event_pages|event_media)\b/i.test(migration));
  assert(!/\binsert\s+into\s+public\.events\b/i.test(migration));
  assert(!migration.includes("atlas_materialize_event_factory_package("));
  assert(!migration.includes("atlas_review_event_factory_package("));
  assert(contentGuardMigration.includes("atlas_event_factory_content_ready_v2"));
  assert(contentGuardMigration.includes("atlas_guard_new_event_factory_content_trigger"));
  assert(contentGuardMigration.includes("perform public.atlas_assert_service_role();"));
  assert(contentGuardMigration.includes("from public, anon, authenticated;"));
  assert(!/\bcreate\s+table\b/i.test(contentGuardMigration), "migration 030 must add no table");
  assert(!/\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?public\.(?:events|event_pages|event_page_versions|event_media)\b/i.test(contentGuardMigration));

  assert(specification.includes("Exactly 1024 x 1536 pixels"));
  assert(specification.includes("never cropped"));
  assert(specification.includes("same contract"));
  assert(migration.includes("'model_actions', 0"));
  assert(migration.includes("'image_generation_actions', 0"));
  for (const source of [uploadRoute, visualRoute, manualControl, migration]) {
    assert(!/image_gen\.|imagegen\(|generateImage\(/i.test(source), "manual art pathway must not invoke generation tools");
  }
  await validateMigrationServices(migration);
  await validateContentGuardMigration(contentGuardMigration);

  console.log(
    "Art-optional Event Hub validations passed: non-art safeguards, image-free rendering, exact asset validation, audited attachment/removal, stable URL, county projection, and zero model/image-generation actions.",
  );
}

await main();
