-- Allow an already-approved base visual to be attached after an event was
-- intentionally published without art. This creates a new immutable package
-- revision and preserves the independent page review because only hero fields
-- change. It never approves or publishes the revision.

begin;

create or replace function public.atlas_create_event_factory_first_hero_revision(
  p_source_package_id uuid,
  p_visual_workflow_id uuid,
  p_content_hash text,
  p_actor_identity text,
  p_notes text
)
returns table (
  package_id uuid,
  status text,
  readiness_score numeric,
  package_version integer,
  event_key text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.event_factory_packages%rowtype;
  v_visual public.event_visual_workflows%rowtype;
  v_package public.event_factory_packages%rowtype;
  v_case public.event_verification_cases%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_package_version integer;
  v_manifest jsonb;
  v_art_brief jsonb;
  v_art_asset jsonb;
  v_checks jsonb;
  v_checks_complete boolean;
  v_provenance_category text;
begin
  perform public.atlas_assert_service_role();

  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 package content hash is required.' using errcode = '22023';
  end if;

  select package.* into v_source
  from public.event_factory_packages as package
  where package.id = p_source_package_id
  for update;
  if not found or v_source.status <> 'published' or v_source.event_id is null then
    raise exception 'A published Event Factory package is required for a first-hero revision.'
      using errcode = '22023';
  end if;
  if coalesce(
    nullif(pg_catalog.btrim(v_source.art_asset->>'publicUrl'), ''),
    nullif(pg_catalog.btrim(v_source.art_asset->>'src'), '')
  ) is not null
     or coalesce(nullif(pg_catalog.btrim(v_source.page_manifest#>>'{hero,imageSrc}'), ''), '') <> '' then
    raise exception 'The published package already retains hero art.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'event-package-first-hero:' || v_source.candidate_id::text || ':' || v_source.target_year::text,
      0
    )
  );
  if v_source.id is distinct from (
    select package.id
    from public.event_factory_packages as package
    where package.candidate_id = v_source.candidate_id
      and package.target_year = v_source.target_year
      and package.status = 'published'
    order by package.published_at desc nulls last, package.id desc
    limit 1
  ) then
    raise exception 'First-hero revisions must start from the latest published package.'
      using errcode = '22023';
  end if;

  select verification.* into v_case
  from public.event_verification_cases as verification
  where verification.id = v_source.verification_case_id
  for share;
  if not found then
    raise exception 'Verification case was not found.' using errcode = 'P0002';
  end if;
  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = v_source.candidate_id
  for share;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;
  if v_case.status is distinct from 'verified'
     or v_candidate.duplicate_status is distinct from 'unique_candidate'
     or v_candidate.needs_review is distinct from false
     or (
       v_source.readiness_checks->>'exists' = 'true'
       and v_source.readiness_checks->>'annual' = 'true'
       and v_source.readiness_checks->>'dates' = 'true'
       and v_source.readiness_checks->>'location' = 'true'
       and v_source.readiness_checks->>'sources' = 'true'
       and v_source.readiness_checks->>'map' = 'true'
       and v_source.readiness_checks->>'page' = 'true'
     ) is not true then
    raise exception 'First-hero revision cannot bypass identity, verification, or non-art safeguards.'
      using errcode = '22023';
  end if;

  select workflow.* into v_visual
  from public.event_visual_workflows as workflow
  where workflow.id = p_visual_workflow_id
  for share;
  if not found
     or v_visual.status <> 'approved'
     or v_visual.supersedes_workflow_id is not null
     or v_visual.candidate_id <> v_source.candidate_id
     or (v_visual.event_id is not null and v_visual.event_id <> v_source.event_id)
     or v_visual.target_year <> v_source.target_year
     or v_visual.event_key <> v_source.event_key
     or v_visual.reviewed_by is null
     or v_visual.reviewed_at is null then
    raise exception 'An approved base visual for this exact published event is required.'
      using errcode = '22023';
  end if;

  v_checks_complete := v_visual.qa_checks->>'visualElementsVerified' = 'true'
    and v_visual.qa_checks->>'independentComposition' = 'true'
    and v_visual.qa_checks->>'noInventedTextOrMarks' = 'true'
    and v_visual.qa_checks->>'mobileCropVerified' = 'true'
    and v_visual.qa_checks->>'publicAssetVerified' = 'true';
  if v_visual.asset->>'sourceKind' <> 'supabase'
     or v_visual.asset->>'storageBucket' <> 'celebration-atlas-media'
     or coalesce(v_visual.asset->>'publicUrl', '') !~ '^https://'
     or nullif(pg_catalog.btrim(v_visual.asset->>'storagePath'), '') is null
     or nullif(pg_catalog.btrim(v_visual.asset->>'altText'), '') is null
     or not v_checks_complete then
    raise exception 'The approved first hero must be publicly hosted and fully checked.'
      using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.supersedes_package_id = v_source.id
    and package.content_hash = p_content_hash
  order by package.package_version desc
  limit 1
  for update;
  if found then
    return query
      select v_package.id, v_package.status, v_package.readiness_score,
        v_package.package_version, v_package.event_key, false;
    return;
  end if;

  v_provenance_category := coalesce(
    nullif(v_visual.asset->>'provenanceCategory', ''),
    nullif(v_source.art_brief->>'provenanceCategory', ''),
    'unknown'
  );
  v_manifest := jsonb_set(
    jsonb_set(
      jsonb_set(
        v_source.page_manifest,
        '{hero,imageSrc}',
        to_jsonb(v_visual.asset->>'publicUrl'),
        false
      ),
      '{hero,imageAlt}',
      to_jsonb(v_visual.asset->>'altText'),
      false
    ),
    '{hero,credit}',
    to_jsonb(coalesce(nullif(v_visual.asset->>'credit', ''), 'Celebration Atlas artwork')),
    true
  );
  v_art_brief := jsonb_build_object(
    'workflowVersion', 'visual-signature-v1',
    'visualWorkflowId', v_visual.id,
    'lane', v_visual.lane,
    'eventName', v_visual.event_name,
    'place', v_visual.location_label,
    'searchQuery', v_visual.search_query,
    'reviewedThumbnailCount', v_visual.reviewed_thumbnail_count,
    'referenceSources', v_visual.reference_sources,
    'visualSignature', v_visual.visual_signature,
    'generationBrief', v_visual.generation_brief,
    'provenanceCategory', v_provenance_category,
    'requiredPlacements', jsonb_build_array('event-hub hero', 'map card', 'social preview')
  );
  v_art_asset := jsonb_build_object(
    'workflowVersion', 'visual-signature-v1',
    'visualWorkflowId', v_visual.id,
    'src', v_visual.asset->>'publicUrl',
    'publicUrl', v_visual.asset->>'publicUrl',
    'alt', v_visual.asset->>'altText',
    'credit', coalesce(nullif(v_visual.asset->>'credit', ''), 'Celebration Atlas artwork'),
    'sourceKind', 'supabase',
    'storageBucket', v_visual.asset->>'storageBucket',
    'storagePath', v_visual.asset->>'storagePath',
    'reviewState', 'approved',
    'provenanceCategory', v_provenance_category,
    'qaChecks', v_visual.qa_checks
  );
  v_checks := jsonb_set(v_source.readiness_checks, '{art}', 'true'::jsonb, true);

  select coalesce(max(package.package_version), 0) + 1
    into v_package_version
  from public.event_factory_packages as package
  where package.candidate_id = v_source.candidate_id
    and package.target_year = v_source.target_year;

  insert into public.event_factory_packages (
    verification_case_id,
    candidate_id,
    event_id,
    source_bundle_id,
    synthesis_id,
    target_year,
    event_key,
    slug,
    status,
    package_version,
    canonical_profile,
    map_record,
    page_manifest,
    scout_context,
    art_brief,
    art_asset,
    readiness_checks,
    readiness_score,
    content_hash,
    created_by,
    ready_at,
    supersedes_package_id,
    page_review_status,
    page_review_manifest,
    page_reviewed_by,
    page_review_notes,
    page_reviewed_at
  ) values (
    v_source.verification_case_id,
    v_source.candidate_id,
    v_source.event_id,
    v_source.source_bundle_id,
    v_source.synthesis_id,
    v_source.target_year,
    v_source.event_key,
    v_source.slug,
    'ready_for_review',
    v_package_version,
    v_source.canonical_profile,
    v_source.map_record,
    v_manifest,
    v_source.scout_context,
    v_art_brief,
    v_art_asset,
    v_checks,
    1,
    p_content_hash,
    pg_catalog.btrim(p_actor_identity),
    now(),
    v_source.id,
    v_source.page_review_status,
    v_source.page_review_manifest,
    v_source.page_reviewed_by,
    v_source.page_review_notes,
    v_source.page_reviewed_at
  )
  returning * into v_package;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, notes, metadata
  ) values (
    v_package.id,
    'created',
    pg_catalog.btrim(p_actor_identity),
    null,
    'ready_for_review',
    nullif(pg_catalog.btrim(p_notes), ''),
    jsonb_build_object(
      'supersedes_package_id', v_source.id,
      'visual_workflow_id', v_visual.id,
      'package_version', v_package_version,
      'revision_scope', 'first_approved_hero',
      'page_review_preserved', v_source.page_review_status = 'approved',
      'publication_authorized', false
    )
  );

  return query
    select v_package.id, v_package.status, v_package.readiness_score,
      v_package.package_version, v_package.event_key, true;
end;
$$;

revoke all on function public.atlas_create_event_factory_first_hero_revision(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.atlas_create_event_factory_first_hero_revision(uuid, uuid, text, text, text)
  to service_role;

comment on function public.atlas_create_event_factory_first_hero_revision(uuid, uuid, text, text, text) is
  'Creates a private immutable first-hero revision from an approved base visual after an image-free Event Factory publication; preserves the independent page review and never publishes.';

commit;
