-- Allow reviewed Event Factory publication without hero art and retain finished
-- externally supplied hero assets in the existing visual/package revision chain.
-- This migration creates no tables and performs no publication or approval.

begin;

create or replace function public.atlas_finalize_art_optional_event_factory_package(
  p_package_id uuid,
  p_actor_identity text
)
returns table (
  package_id uuid,
  status text,
  readiness_score numeric,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
  v_case public.event_verification_cases%rowtype;
  v_candidate public.event_candidates%rowtype;
begin
  perform public.atlas_assert_service_role();
  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;

  select verification.* into v_case
  from public.event_verification_cases as verification
  where verification.id = v_package.verification_case_id
  for share;
  if not found then
    raise exception 'Verification case was not found.' using errcode = 'P0002';
  end if;
  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = v_package.candidate_id
  for share;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;

  if v_package.status <> 'assembling'
     or v_case.status is distinct from 'verified'
     or v_candidate.duplicate_status is distinct from 'unique_candidate'
     or v_candidate.needs_review is distinct from false then
    raise exception 'Only an identity-cleared, verified assembling package can become art-optional review ready.'
      using errcode = '22023';
  end if;
  if coalesce(v_package.page_manifest#>>'{hero,imageSrc}', '') <> ''
     or coalesce(v_package.page_manifest#>>'{hero,imageAlt}', '') <> ''
     or coalesce(v_package.art_asset->>'src', '') <> ''
     or coalesce(v_package.art_asset->>'publicUrl', '') <> '' then
    raise exception 'Art-optional finalization requires a genuinely image-free package.'
      using errcode = '22023';
  end if;
  if (
    v_package.readiness_checks->>'exists' = 'true'
    and v_package.readiness_checks->>'annual' = 'true'
    and v_package.readiness_checks->>'dates' = 'true'
    and v_package.readiness_checks->>'location' = 'true'
    and v_package.readiness_checks->>'sources' = 'true'
    and v_package.readiness_checks->>'map' = 'true'
    and v_package.readiness_checks->>'page' = 'true'
  ) is not true then
    raise exception 'Every non-art package requirement must pass before art-optional review.'
      using errcode = '22023';
  end if;

  update public.event_factory_packages
    set status = 'ready_for_review',
        readiness_score = 1,
        ready_at = now(),
        updated_at = now()
  where id = v_package.id;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, metadata
  ) values (
    v_package.id,
    'rebuilt',
    pg_catalog.btrim(p_actor_identity),
    'assembling',
    'ready_for_review',
    jsonb_build_object(
      'art_optional', true,
      'art_gate', false,
      'non_art_checks_retained', true
    )
  );

  return query select v_package.id, 'ready_for_review'::text, 1::numeric, false;
end;
$$;

create or replace function public.atlas_create_manual_event_visual_workflow(
  p_source_package_id uuid,
  p_asset jsonb,
  p_confirmations jsonb,
  p_content_hash text,
  p_actor_identity text
)
returns table (
  workflow_id uuid,
  status text,
  revision_number integer,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.event_factory_packages%rowtype;
  v_workflow public.event_visual_workflows%rowtype;
  v_revision_number integer;
  v_supersedes uuid;
  v_old_workflow_text text;
begin
  perform public.atlas_assert_service_role();
  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 visual workflow content hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_confirmations) is distinct from 'object'
     or not (
       p_confirmations->>'correctEvent' = 'true'
       and p_confirmations->>'rightsConfirmed' = 'true'
       and p_confirmations->>'noInventedMarks' = 'true'
       and p_confirmations->>'fullFrameReviewed' = 'true'
     ) then
    raise exception 'Every finished-image review confirmation is required.'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_asset) is distinct from 'object'
     or p_asset->>'sourceKind' <> 'supabase'
     or p_asset->>'storageBucket' <> 'celebration-atlas-media'
     or p_asset->>'provenanceCategory' <> 'externally_supplied'
     or coalesce(p_asset->>'publicUrl', '') !~ '^https://'
     or nullif(pg_catalog.btrim(p_asset->>'storagePath'), '') is null
     or nullif(pg_catalog.btrim(p_asset->>'altText'), '') is null
     or nullif(pg_catalog.btrim(p_asset->>'sourceFilename'), '') is null
     or nullif(pg_catalog.btrim(p_asset->>'uploadedBy'), '') is null
     or nullif(pg_catalog.btrim(p_asset->>'uploadedAt'), '') is null
     or coalesce((p_asset->>'width')::integer, 0) <> 1024
     or coalesce((p_asset->>'height')::integer, 0) <> 1536
     or coalesce((p_asset->>'byteSize')::bigint, 0) <= 0
     or coalesce((p_asset->>'byteSize')::bigint, 0) > 8388608
     or p_asset->>'contentType' not in ('image/jpeg', 'image/png', 'image/webp')
     or p_asset->>'contentType' is null then
    raise exception 'A complete 1024 x 1536 externally supplied Supabase asset is required.'
      using errcode = '22023';
  end if;

  select package.* into v_source
  from public.event_factory_packages as package
  where package.id = p_source_package_id
  for update;
  if not found or v_source.status <> 'published' or v_source.event_id is null then
    raise exception 'A published Event Factory package is required for finished-image upload.'
      using errcode = '22023';
  end if;
  if v_source.id is distinct from (
    select package.id
    from public.event_factory_packages as package
    where package.candidate_id = v_source.candidate_id
      and package.target_year = v_source.target_year
      and package.status = 'published'
    order by package.published_at desc nulls last, package.id desc
    limit 1
  ) then
    raise exception 'Finished art must start from the latest published package.'
      using errcode = '22023';
  end if;

  v_old_workflow_text := v_source.art_asset->>'visualWorkflowId';
  if v_old_workflow_text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    v_supersedes := v_old_workflow_text::uuid;
  end if;
  select coalesce(max(workflow.revision_number), 0) + 1
    into v_revision_number
  from public.event_visual_workflows as workflow
  where workflow.candidate_id = v_source.candidate_id
    and workflow.target_year = v_source.target_year;

  insert into public.event_visual_workflows (
    candidate_id,
    event_id,
    source_bundle_id,
    target_year,
    event_key,
    event_name,
    location_label,
    lane,
    status,
    search_query,
    reviewed_thumbnail_count,
    reference_sources,
    visual_signature,
    generation_brief,
    asset,
    qa_checks,
    content_hash,
    created_by,
    revision_number,
    supersedes_workflow_id,
    ready_at
  ) values (
    v_source.candidate_id,
    v_source.event_id,
    v_source.source_bundle_id,
    v_source.target_year,
    v_source.event_key,
    coalesce(nullif(v_source.page_manifest#>>'{identity,name}', ''), v_source.event_key),
    coalesce(nullif(v_source.page_manifest#>>'{identity,location}', ''), 'Michigan'),
    'editorial',
    'ready_for_review',
    'Externally supplied finished asset',
    0,
    '[]'::jsonb,
    jsonb_build_object(
      'motifs', '[]'::jsonb,
      'heroMoment', 'Externally supplied finished image; no generated art direction used.'
    ),
    jsonb_build_object(
      'prompt', 'No model or image-generation action was used.',
      'aspectRatio', '2:3',
      'textPolicy', 'no_generated_text',
      'style', 'Externally supplied finished asset'
    ),
    p_asset,
    jsonb_build_object(
      'visualElementsVerified', true,
      'independentComposition', true,
      'noInventedTextOrMarks', true,
      'mobileCropVerified', true,
      'publicAssetVerified', true
    ),
    p_content_hash,
    pg_catalog.btrim(p_actor_identity),
    v_revision_number,
    v_supersedes,
    now()
  )
  returning * into v_workflow;

  insert into public.event_visual_workflow_actions (
    workflow_id, action_type, actor_identity, from_status, to_status, metadata
  ) values (
    v_workflow.id,
    'created',
    pg_catalog.btrim(p_actor_identity),
    null,
    'ready_for_review',
    jsonb_build_object(
      'pathway', 'externally_supplied_finished_asset',
      'source_package_id', v_source.id,
      'source_filename', p_asset->>'sourceFilename',
      'uploaded_at', p_asset->>'uploadedAt',
      'dimensions', jsonb_build_object('width', 1024, 'height', 1536),
      'confirmations', p_confirmations,
      'model_actions', 0,
      'image_generation_actions', 0
    )
  );

  return query
    select v_workflow.id, v_workflow.status, v_workflow.revision_number, true;
end;
$$;

create or replace function public.atlas_create_event_factory_art_revision(
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
  v_old_workflow_text text;
  v_scope text;
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
    raise exception 'A published Event Factory package is required for an art revision.'
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
  if v_source.id is distinct from (
    select package.id
    from public.event_factory_packages as package
    where package.candidate_id = v_source.candidate_id
      and package.target_year = v_source.target_year
      and package.status = 'published'
    order by package.published_at desc nulls last, package.id desc
    limit 1
  ) then
    raise exception 'Art revisions must start from the latest published package.'
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
    raise exception 'Art revision cannot bypass identity, verification, or non-art safeguards.'
      using errcode = '22023';
  end if;

  v_old_workflow_text := v_source.art_asset->>'visualWorkflowId';
  if p_visual_workflow_id is not null then
    select workflow.* into v_visual
    from public.event_visual_workflows as workflow
    where workflow.id = p_visual_workflow_id
    for update;
    if not found
       or v_visual.status <> 'approved'
       or v_visual.generation_brief->>'style' <> 'Externally supplied finished asset'
       or v_visual.candidate_id <> v_source.candidate_id
       or v_visual.event_id is distinct from v_source.event_id
       or v_visual.target_year <> v_source.target_year
       or v_visual.event_key <> v_source.event_key then
      raise exception 'An approved externally supplied visual for this exact event is required.'
        using errcode = '22023';
    end if;
    if (v_old_workflow_text is null and v_visual.supersedes_workflow_id is not null)
       or (v_old_workflow_text is not null and v_visual.supersedes_workflow_id::text is distinct from v_old_workflow_text) then
      raise exception 'The approved visual does not directly revise the currently published art.'
        using errcode = '22023';
    end if;
    if coalesce((v_visual.asset->>'width')::integer, 0) <> 1024
       or coalesce((v_visual.asset->>'height')::integer, 0) <> 1536
       or coalesce((v_visual.asset->>'byteSize')::bigint, 0) <= 0
       or coalesce((v_visual.asset->>'byteSize')::bigint, 0) > 8388608
       or v_visual.asset->>'provenanceCategory' <> 'externally_supplied'
       or v_visual.asset->>'sourceKind' <> 'supabase'
       or coalesce(v_visual.asset->>'publicUrl', '') !~ '^https://'
       or nullif(pg_catalog.btrim(v_visual.asset->>'altText'), '') is null
       or nullif(pg_catalog.btrim(v_visual.asset->>'uploadedBy'), '') is null
       or nullif(pg_catalog.btrim(v_visual.asset->>'uploadedAt'), '') is null
       or v_visual.reviewed_by is null
       or v_visual.reviewed_at is null then
      raise exception 'Approved visual provenance, dimensions, upload, and review records are required.'
        using errcode = '22023';
    end if;
    v_scope := case when v_old_workflow_text is null then 'first_hero' else 'replace_hero' end;
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
      'pathway', 'externally_supplied_finished_asset',
      'generationBrief', v_visual.generation_brief,
      'provenanceCategory', 'externally_supplied'
    );
    v_art_asset := v_visual.asset || jsonb_build_object(
      'workflowVersion', 'visual-signature-v1',
      'visualWorkflowId', v_visual.id,
      'src', v_visual.asset->>'publicUrl',
      'alt', v_visual.asset->>'altText',
      'reviewState', 'approved',
      'approvedBy', v_visual.reviewed_by,
      'approvedAt', v_visual.reviewed_at,
      'qaChecks', v_visual.qa_checks
    );
    v_checks := jsonb_set(v_source.readiness_checks, '{art}', 'true'::jsonb, true);
  else
    if coalesce(v_source.art_asset->>'src', v_source.art_asset->>'publicUrl', '') = '' then
      raise exception 'The published package is already image-free.' using errcode = '22023';
    end if;
    v_scope := 'remove_hero';
    v_manifest := (
      jsonb_set(
        jsonb_set(v_source.page_manifest, '{hero,imageSrc}', '""'::jsonb, false),
        '{hero,imageAlt}',
        '""'::jsonb,
        false
      ) #- '{hero,credit}'
    );
    v_art_brief := jsonb_build_object(
      'workflowVersion', 'visual-signature-v1',
      'readinessState', 'art_pending',
      'imageActionAuthorized', false
    );
    v_art_asset := jsonb_build_object(
      'workflowVersion', 'visual-signature-v1',
      'reviewState', 'pending',
      'imageActionAuthorized', false
    );
    v_checks := jsonb_set(v_source.readiness_checks, '{art}', 'false'::jsonb, true);
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'event-package-art-revision:' || v_source.candidate_id::text || ':' || v_source.target_year::text,
      0
    )
  );
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
    supersedes_package_id
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
    v_source.id
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
      'visual_workflow_id', p_visual_workflow_id,
      'package_version', v_package_version,
      'revision_scope', v_scope,
      'event_id_retained', v_source.event_id,
      'public_url_retained', '/events/' || v_source.slug
    )
  );

  return query
    select v_package.id, v_package.status, v_package.readiness_score,
      v_package.package_version, v_package.event_key, true;
end;
$$;

create or replace function public.atlas_activate_event_factory_publication(
  p_package_id uuid,
  p_version_id uuid,
  p_media_id uuid,
  p_actor_identity text,
  p_notes text
)
returns table (
  package_id uuid,
  status text,
  event_id uuid,
  version_id uuid,
  media_id uuid,
  previous_version_id uuid,
  activated boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
  v_page public.event_pages%rowtype;
  v_version public.event_page_versions%rowtype;
  v_media public.event_media%rowtype;
  v_previous_version_id uuid;
  v_published_at timestamptz := now();
  v_expected_media_url text;
  v_has_art boolean;
begin
  perform public.atlas_assert_service_role();
  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_package_id is null or p_version_id is null then
    raise exception 'Package and Event Hub version identifiers are required.'
      using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;
  if v_package.event_id is null then
    raise exception 'A materialized canonical event is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('event-factory-publication:' || v_package.event_id::text, 0)
  );

  select version.* into v_version
  from public.event_page_versions as version
  where version.id = p_version_id
  for update;
  if not found then
    raise exception 'Event Hub version was not found.' using errcode = 'P0002';
  end if;
  select page.* into v_page
  from public.event_pages as page
  where page.id = v_version.event_page_id
  for update;
  if not found then
    raise exception 'Event Hub page was not found.' using errcode = 'P0002';
  end if;

  v_expected_media_url := coalesce(
    nullif(v_package.art_asset->>'publicUrl', ''),
    nullif(v_package.art_asset->>'src', '')
  );
  v_has_art := coalesce(v_package.page_manifest#>>'{hero,imageSrc}', '') <> ''
    or coalesce(v_package.page_manifest#>>'{hero,imageAlt}', '') <> '';
  if (coalesce(v_package.page_manifest#>>'{hero,imageSrc}', '') = '')
     is distinct from
     (coalesce(v_package.page_manifest#>>'{hero,imageAlt}', '') = '') then
    raise exception 'Hero image source and alt text must both be supplied or both be empty.'
      using errcode = '22023';
  end if;

  if v_has_art then
    if p_media_id is null then
      raise exception 'Approved hero media is required when the package has art.'
        using errcode = '22023';
    end if;
    select media.* into v_media
    from public.event_media as media
    where media.id = p_media_id
    for update;
    if not found then
      raise exception 'Approved package media was not found.' using errcode = 'P0002';
    end if;
    if v_media.event_id <> v_package.event_id
       or v_media.media_role <> 'hero'
       or v_media.status <> 'approved'
       or v_expected_media_url is null
       or v_media.public_url is distinct from v_expected_media_url then
      raise exception 'Approved media does not match the frozen package art.'
        using errcode = '22023';
    end if;
  else
    if p_media_id is not null
       or v_expected_media_url is not null
       or (
         v_package.readiness_checks->>'exists' = 'true'
         and v_package.readiness_checks->>'annual' = 'true'
         and v_package.readiness_checks->>'dates' = 'true'
         and v_package.readiness_checks->>'location' = 'true'
         and v_package.readiness_checks->>'sources' = 'true'
         and v_package.readiness_checks->>'map' = 'true'
         and v_package.readiness_checks->>'page' = 'true'
       ) is not true then
      raise exception 'Image-free activation requires no media and every non-art safeguard.'
        using errcode = '22023';
    end if;
  end if;

  if v_page.event_id <> v_package.event_id
     or v_page.event_key <> v_package.event_key
     or v_page.slug <> v_package.slug then
    raise exception 'Event Hub page and package identities do not match.'
      using errcode = '22023';
  end if;
  if v_version.event_page_id <> v_page.id
     or v_version.manifest is distinct from v_package.page_manifest
     or v_version.manifest->>'eventId' is distinct from v_package.event_key
     or v_version.manifest->>'slug' is distinct from v_package.slug then
    raise exception 'Event Hub version does not contain the frozen package manifest.'
      using errcode = '22023';
  end if;

  if v_package.status = 'published' then
    if v_page.published_version_id <> p_version_id or v_version.status <> 'published' then
      raise exception 'Published package replay does not match the active Event Hub version.'
        using errcode = '22023';
    end if;
    return query
      select v_package.id, v_package.status, v_package.event_id, v_version.id,
        p_media_id, null::uuid, false;
    return;
  end if;
  if v_package.status <> 'publishing'
     or v_package.readiness_score <> 1
     or v_package.reviewed_by is null then
    raise exception 'Only a complete, reviewed, publishing package can be activated.'
      using errcode = '22023';
  end if;
  if v_version.status <> 'approved' or not v_version.is_valid then
    raise exception 'Only an approved, valid Event Hub version can be activated.'
      using errcode = '22023';
  end if;
  if v_package.supersedes_package_id is not null
     and v_package.supersedes_package_id is distinct from (
       select prior.id
       from public.event_factory_packages as prior
       where prior.candidate_id = v_package.candidate_id
         and prior.target_year = v_package.target_year
         and prior.status = 'published'
       order by prior.published_at desc nulls last, prior.id desc
       limit 1
     ) then
    raise exception 'A revision can replace only the latest published package.'
      using errcode = '22023';
  end if;

  v_previous_version_id := v_page.published_version_id;
  update public.event_factory_packages
    set status = 'published',
        published_by = pg_catalog.btrim(p_actor_identity),
        published_at = v_published_at,
        review_notes = coalesce(nullif(pg_catalog.btrim(p_notes), ''), review_notes),
        updated_at = v_published_at
  where id = v_package.id;

  if v_previous_version_id is not null and v_previous_version_id <> p_version_id then
    update public.event_page_versions as version
      set status = 'archived'
    where version.id = v_previous_version_id
      and version.event_page_id = v_page.id
      and version.status = 'published';
    if found then
      insert into public.event_page_version_transitions (
        version_id, from_status, to_status, actor_identity, notes
      ) values (
        v_previous_version_id,
        'published',
        'archived',
        pg_catalog.btrim(p_actor_identity),
        'Replaced by Event Factory page version ' || v_version.version_number::text
      );
    end if;
  end if;

  update public.event_page_versions as version
    set status = 'published',
        published_by = pg_catalog.btrim(p_actor_identity),
        published_at = v_published_at
  where version.id = p_version_id
    and version.status = 'approved'
    and version.is_valid = true;
  if not found then
    raise exception 'Event Hub version activation lost its approved state.' using errcode = '40001';
  end if;

  insert into public.event_page_version_transitions (
    version_id, from_status, to_status, actor_identity, notes
  ) values (
    p_version_id,
    'approved',
    'published',
    pg_catalog.btrim(p_actor_identity),
    nullif(pg_catalog.btrim(p_notes), '')
  );
  update public.event_pages
    set published_version_id = p_version_id,
        updated_at = v_published_at
  where id = v_page.id;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, notes, metadata
  ) values (
    v_package.id,
    'published',
    pg_catalog.btrim(p_actor_identity),
    'publishing',
    'published',
    nullif(pg_catalog.btrim(p_notes), ''),
    jsonb_build_object(
      'event_id', v_package.event_id,
      'event_page_version_id', p_version_id,
      'event_media_id', p_media_id,
      'previous_event_page_version_id', v_previous_version_id,
      'image_free', not v_has_art
    )
  );

  return query
    select v_package.id, 'published'::text, v_package.event_id, v_version.id,
      p_media_id, v_previous_version_id, true;
end;
$$;

revoke all on function public.atlas_finalize_art_optional_event_factory_package(uuid, text)
  from public, anon, authenticated;
revoke all on function public.atlas_create_manual_event_visual_workflow(uuid, jsonb, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_create_event_factory_art_revision(uuid, uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_activate_event_factory_publication(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;

grant execute on function public.atlas_finalize_art_optional_event_factory_package(uuid, text)
  to service_role;
grant execute on function public.atlas_create_manual_event_visual_workflow(uuid, jsonb, jsonb, text, text)
  to service_role;
grant execute on function public.atlas_create_event_factory_art_revision(uuid, uuid, text, text, text)
  to service_role;
grant execute on function public.atlas_activate_event_factory_publication(uuid, uuid, uuid, text, text)
  to service_role;

comment on function public.atlas_finalize_art_optional_event_factory_package(uuid, text) is
  'Marks an image-free package review-ready only after all retained non-art gates, verified diligence, and identity clearance pass.';
comment on function public.atlas_create_manual_event_visual_workflow(uuid, jsonb, jsonb, text, text) is
  'Retains a specification-valid externally supplied finished image for human visual review without model or image-generation work.';
comment on function public.atlas_create_event_factory_art_revision(uuid, uuid, text, text, text) is
  'Creates an immutable review-ready hero attachment, replacement, or removal package revision while preserving event identity and URL.';
comment on function public.atlas_activate_event_factory_publication(uuid, uuid, uuid, text, text) is
  'Atomically activates a reviewed Event Hub package, requiring approved matching media when art exists and complete non-art safeguards when art is absent.';

commit;
