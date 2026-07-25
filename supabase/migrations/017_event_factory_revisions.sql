-- Immutable same-edition visual and package corrections.
-- Apply after migration 016.

alter table public.event_visual_workflows
  add column if not exists revision_number integer not null default 1
    check (revision_number > 0),
  add column if not exists supersedes_workflow_id uuid
    references public.event_visual_workflows(id) on delete restrict;

alter table public.event_visual_workflows
  drop constraint if exists event_visual_workflows_candidate_id_target_year_key,
  drop constraint if exists event_visual_workflows_event_key_target_year_key;

alter table public.event_visual_workflows
  add constraint event_visual_workflows_candidate_year_revision_key
    unique (candidate_id, target_year, revision_number),
  add constraint event_visual_workflows_event_key_year_revision_key
    unique (event_key, target_year, revision_number);

create index event_visual_workflows_supersedes
  on public.event_visual_workflows (supersedes_workflow_id)
  where supersedes_workflow_id is not null;

alter table public.event_factory_packages
  add column if not exists supersedes_package_id uuid
    references public.event_factory_packages(id) on delete restrict;

alter table public.event_factory_packages
  drop constraint if exists event_factory_packages_verification_case_id_key,
  drop constraint if exists event_factory_packages_candidate_id_target_year_key,
  drop constraint if exists event_factory_packages_event_key_target_year_key,
  drop constraint if exists event_factory_packages_slug_target_year_key;

alter table public.event_factory_packages
  add constraint event_factory_packages_verification_revision_key
    unique (verification_case_id, package_version),
  add constraint event_factory_packages_candidate_year_revision_key
    unique (candidate_id, target_year, package_version),
  add constraint event_factory_packages_event_key_year_revision_key
    unique (event_key, target_year, package_version),
  add constraint event_factory_packages_slug_year_revision_key
    unique (slug, target_year, package_version);

create index event_factory_packages_supersedes
  on public.event_factory_packages (supersedes_package_id)
  where supersedes_package_id is not null;

-- Keep the migration-014 upsert scoped to the editable base workflow. Correction
-- rows are changed only through the revision-specific RPCs below.
create or replace function public.atlas_upsert_event_visual_workflow(
  p_candidate_id uuid,
  p_source_bundle_id uuid,
  p_target_year integer,
  p_event_key text,
  p_event_name text,
  p_location_label text,
  p_lane text,
  p_search_query text,
  p_reviewed_thumbnail_count integer,
  p_reference_sources jsonb,
  p_visual_signature jsonb,
  p_generation_brief jsonb,
  p_asset jsonb,
  p_qa_checks jsonb,
  p_content_hash text,
  p_actor_identity text
)
returns table (
  workflow_id uuid,
  status text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate public.event_candidates%rowtype;
  v_workflow public.event_visual_workflows%rowtype;
  v_previous_status text;
  v_status text;
  v_reference_count integer;
  v_motif_count integer;
  v_research_ready boolean;
  v_asset_ready boolean;
  v_qa_ready boolean;
  v_created boolean := false;
begin
  perform public.atlas_assert_service_role();

  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_target_year not between 2000 and 2100 then
    raise exception 'A valid target year is required.' using errcode = '22023';
  end if;
  if p_event_key is null or p_event_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event key is required.' using errcode = '22023';
  end if;
  if p_lane not in ('fast_visual', 'editorial') then
    raise exception 'A supported visual lane is required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_event_name), '') is null
     or nullif(btrim(p_location_label), '') is null
     or nullif(btrim(p_search_query), '') is null then
    raise exception 'Event name, location, and image search query are required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 visual workflow content hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_reference_sources) is distinct from 'array'
     or jsonb_typeof(p_visual_signature) is distinct from 'object'
     or jsonb_typeof(p_generation_brief) is distinct from 'object'
     or jsonb_typeof(p_asset) is distinct from 'object'
     or jsonb_typeof(p_qa_checks) is distinct from 'object' then
    raise exception 'Visual workflow evidence, brief, asset, and checks must use structured JSON.' using errcode = '22023';
  end if;

  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = p_candidate_id;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;
  if v_candidate.slug_candidate is distinct from p_event_key then
    raise exception 'Visual workflow event key does not match the candidate.' using errcode = '22023';
  end if;
  if p_source_bundle_id is not null and not exists (
    select 1 from public.event_source_bundles as bundle
    where bundle.id = p_source_bundle_id
      and (bundle.candidate_id = p_candidate_id or bundle.event_key = p_event_key)
  ) then
    raise exception 'Source bundle does not belong to this candidate.' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_reference_sources) as reference
    where jsonb_typeof(reference) <> 'object'
      or coalesce(reference->>'url', '') !~ '^https?://'
  ) then
    raise exception 'Representative visual references must contain public source URLs.' using errcode = '22023';
  end if;

  v_reference_count := jsonb_array_length(p_reference_sources);
  v_motif_count := case
    when jsonb_typeof(p_visual_signature->'motifs') = 'array'
      then jsonb_array_length(p_visual_signature->'motifs')
    else 0
  end;
  v_research_ready := p_reviewed_thumbnail_count between 15 and 30
    and v_reference_count between 3 and 12
    and v_motif_count between 3 and 5
    and nullif(btrim(p_visual_signature->>'heroMoment'), '') is not null
    and nullif(btrim(p_generation_brief->>'prompt'), '') is not null
    and p_generation_brief->>'aspectRatio' = '2:3'
    and p_generation_brief->>'textPolicy' = 'no_generated_text';
  v_asset_ready := p_asset->>'sourceKind' = 'supabase'
    and p_asset->>'storageBucket' = 'celebration-atlas-media'
    and nullif(btrim(p_asset->>'storagePath'), '') is not null
    and coalesce(p_asset->>'publicUrl', '') ~ '^https://'
    and nullif(btrim(p_asset->>'altText'), '') is not null;
  v_qa_ready := p_qa_checks->>'visualElementsVerified' = 'true'
    and p_qa_checks->>'independentComposition' = 'true'
    and p_qa_checks->>'noInventedTextOrMarks' = 'true'
    and p_qa_checks->>'mobileCropVerified' = 'true'
    and p_qa_checks->>'publicAssetVerified' = 'true';

  v_status := case
    when v_research_ready and v_asset_ready and v_qa_ready then 'ready_for_review'
    when v_research_ready then 'draft'
    else 'researching'
  end;

  select workflow.* into v_workflow
  from public.event_visual_workflows as workflow
  where workflow.candidate_id = p_candidate_id
    and workflow.target_year = p_target_year
    and workflow.supersedes_workflow_id is null
  for update;

  if found and v_workflow.status in ('approved', 'archived') then
    if v_workflow.content_hash = p_content_hash then
      return query select v_workflow.id, v_workflow.status, false;
      return;
    end if;
    raise exception 'Approved or archived visual workflows must be reopened before revision.' using errcode = '22023';
  end if;

  if v_workflow.id is null then
    insert into public.event_visual_workflows (
      candidate_id, event_id, source_bundle_id, target_year, event_key, event_name,
      location_label, lane, status, search_query, reviewed_thumbnail_count,
      reference_sources, visual_signature, generation_brief, asset, qa_checks,
      content_hash, created_by, ready_at, revision_number, supersedes_workflow_id
    ) values (
      p_candidate_id, v_candidate.matched_event_id, p_source_bundle_id, p_target_year,
      p_event_key, btrim(p_event_name), btrim(p_location_label), p_lane, v_status,
      btrim(p_search_query), p_reviewed_thumbnail_count, p_reference_sources,
      p_visual_signature, p_generation_brief, p_asset, p_qa_checks, p_content_hash,
      btrim(p_actor_identity), case when v_status = 'ready_for_review' then now() else null end,
      1, null
    ) returning * into v_workflow;
    v_created := true;

    insert into public.event_visual_workflow_actions (
      workflow_id, action_type, actor_identity, from_status, to_status, metadata
    ) values (
      v_workflow.id, 'created', btrim(p_actor_identity), null, v_status,
      jsonb_build_object(
        'reviewed_thumbnail_count', p_reviewed_thumbnail_count,
        'reference_count', v_reference_count,
        'motif_count', v_motif_count,
        'asset_ready', v_asset_ready,
        'qa_ready', v_qa_ready
      )
    );
  else
    v_previous_status := v_workflow.status;
    update public.event_visual_workflows
      set event_id = coalesce(v_candidate.matched_event_id, event_id),
          source_bundle_id = p_source_bundle_id,
          event_key = p_event_key,
          event_name = btrim(p_event_name),
          location_label = btrim(p_location_label),
          lane = p_lane,
          status = v_status,
          search_query = btrim(p_search_query),
          reviewed_thumbnail_count = p_reviewed_thumbnail_count,
          reference_sources = p_reference_sources,
          visual_signature = p_visual_signature,
          generation_brief = p_generation_brief,
          asset = p_asset,
          qa_checks = p_qa_checks,
          content_hash = p_content_hash,
          reviewed_by = null,
          review_notes = null,
          reviewed_at = null,
          ready_at = case when v_status = 'ready_for_review' then now() else null end,
          updated_at = now()
    where id = v_workflow.id
    returning * into v_workflow;

    insert into public.event_visual_workflow_actions (
      workflow_id, action_type, actor_identity, from_status, to_status, metadata
    ) values (
      v_workflow.id, 'rebuilt', btrim(p_actor_identity), v_previous_status, v_status,
      jsonb_build_object(
        'reviewed_thumbnail_count', p_reviewed_thumbnail_count,
        'reference_count', v_reference_count,
        'motif_count', v_motif_count,
        'asset_ready', v_asset_ready,
        'qa_ready', v_qa_ready
      )
    );
  end if;

  return query select v_workflow.id, v_workflow.status, v_created;
end;
$$;

-- Keep the migration-011 upsert scoped to the editable base package. Released
-- corrections are separate immutable rows created by the hero-correction RPC.
create or replace function public.atlas_upsert_event_factory_package(
  p_verification_case_id uuid,
  p_source_bundle_id uuid,
  p_synthesis_id uuid,
  p_event_key text,
  p_slug text,
  p_canonical_profile jsonb,
  p_map_record jsonb,
  p_page_manifest jsonb,
  p_scout_context jsonb,
  p_art_brief jsonb,
  p_art_asset jsonb,
  p_content_hash text,
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
  v_case public.event_verification_cases%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_package public.event_factory_packages%rowtype;
  v_checks jsonb;
  v_ready_count integer;
  v_score numeric(4,3);
  v_status text;
  v_previous_status text;
  v_created boolean := false;
  v_latitude double precision;
  v_longitude double precision;
begin
  perform public.atlas_assert_service_role();

  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_event_key is null or p_event_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event key is required.' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event slug is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 package content hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_canonical_profile) is distinct from 'object'
     or jsonb_typeof(p_map_record) is distinct from 'object'
     or jsonb_typeof(p_page_manifest) is distinct from 'object'
     or jsonb_typeof(p_scout_context) is distinct from 'object'
     or jsonb_typeof(p_art_brief) is distinct from 'object'
     or jsonb_typeof(p_art_asset) is distinct from 'object' then
    raise exception 'Every package output must be a JSON object.' using errcode = '22023';
  end if;
  if p_page_manifest->>'eventId' is distinct from p_event_key
     or p_page_manifest->>'slug' is distinct from p_slug then
    raise exception 'Event Page manifest identity does not match the package.' using errcode = '22023';
  end if;
  if p_page_manifest::text ~* '\msponsor' then
    raise exception 'Event sponsor references are not allowed in Celebration Atlas package copy.' using errcode = '22023';
  end if;

  select verification.* into v_case
  from public.event_verification_cases as verification
  where verification.id = p_verification_case_id
  for update;
  if not found then
    raise exception 'Verification case was not found.' using errcode = 'P0002';
  end if;
  if v_case.status <> 'verified' or v_case.candidate_id is null then
    raise exception 'A verified candidate case is required before package assembly.' using errcode = '22023';
  end if;

  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = v_case.candidate_id;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;
  if v_candidate.slug_candidate is distinct from p_slug then
    raise exception 'Package slug does not match the verified candidate.' using errcode = '22023';
  end if;

  if p_source_bundle_id is not null and not exists (
    select 1 from public.event_source_bundles as bundle
    where bundle.id = p_source_bundle_id
      and (bundle.candidate_id = v_case.candidate_id or bundle.event_key = p_event_key)
  ) then
    raise exception 'Source bundle does not belong to this candidate.' using errcode = '22023';
  end if;
  if p_synthesis_id is not null and not exists (
    select 1 from public.event_source_syntheses as synthesis
    join public.event_source_bundles as bundle on bundle.id = synthesis.bundle_id
    where synthesis.id = p_synthesis_id
      and (bundle.candidate_id = v_case.candidate_id or bundle.event_key = p_event_key)
  ) then
    raise exception 'Source synthesis does not belong to this candidate.' using errcode = '22023';
  end if;

  begin
    v_latitude := (p_map_record->>'latitude')::double precision;
    v_longitude := (p_map_record->>'longitude')::double precision;
  exception when others then
    v_latitude := null;
    v_longitude := null;
  end;

  v_checks := jsonb_build_object(
    'exists', v_case.existence_status = 'confirmed',
    'annual', v_case.recurrence_status = 'confirmed',
    'dates', v_case.dates_status = 'announced',
    'location', v_case.location_status = 'confirmed'
      and v_latitude between -90 and 90
      and v_longitude between -180 and 180
      and nullif(btrim(p_map_record->>'sourceUrl'), '') is not null,
    'sources', v_case.official_source_count >= 1 and v_case.supporting_source_count >= 1,
    'map', v_latitude between -90 and 90 and v_longitude between -180 and 180,
    'page', jsonb_typeof(p_page_manifest->'modules') = 'array'
      and jsonb_array_length(p_page_manifest->'modules') > 0,
    'art', nullif(btrim(p_art_asset->>'src'), '') is not null
      and nullif(btrim(p_art_asset->>'alt'), '') is not null
  );

  select count(*) into v_ready_count
  from jsonb_each_text(v_checks) as gate
  where gate.value = 'true';
  v_score := round((v_ready_count::numeric / 8), 3);
  v_status := case when v_ready_count = 8 then 'ready_for_review' else 'assembling' end;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.verification_case_id = p_verification_case_id
    and package.supersedes_package_id is null
  for update;

  if found and v_package.status in ('approved', 'publishing', 'published', 'archived') then
    if v_package.content_hash = p_content_hash then
      return query select v_package.id, v_package.status, v_package.readiness_score, false;
      return;
    end if;
    raise exception 'Approved or published packages cannot be rebuilt.' using errcode = '22023';
  end if;

  if v_package.id is null then
    insert into public.event_factory_packages (
      verification_case_id, candidate_id, event_id, source_bundle_id, synthesis_id,
      target_year, event_key, slug, status, package_version, canonical_profile, map_record,
      page_manifest, scout_context, art_brief, art_asset, readiness_checks,
      readiness_score, content_hash, created_by, ready_at, supersedes_package_id
    ) values (
      v_case.id, v_case.candidate_id, v_case.event_id, p_source_bundle_id, p_synthesis_id,
      v_case.target_year, p_event_key, p_slug, v_status, 1, p_canonical_profile, p_map_record,
      p_page_manifest, p_scout_context, p_art_brief, p_art_asset, v_checks,
      v_score, p_content_hash, btrim(p_actor_identity),
      case when v_status = 'ready_for_review' then now() else null end, null
    ) returning * into v_package;
    v_created := true;

    insert into public.event_factory_package_actions (
      package_id, action_type, actor_identity, from_status, to_status, metadata
    ) values (
      v_package.id, 'created', btrim(p_actor_identity), null, v_status,
      jsonb_build_object('content_hash', p_content_hash, 'readiness_checks', v_checks)
    );
  else
    v_previous_status := v_package.status;
    update public.event_factory_packages
      set source_bundle_id = p_source_bundle_id,
          synthesis_id = p_synthesis_id,
          event_key = p_event_key,
          slug = p_slug,
          status = v_status,
          package_version = package_version + 1,
          canonical_profile = p_canonical_profile,
          map_record = p_map_record,
          page_manifest = p_page_manifest,
          scout_context = p_scout_context,
          art_brief = p_art_brief,
          art_asset = p_art_asset,
          readiness_checks = v_checks,
          readiness_score = v_score,
          content_hash = p_content_hash,
          reviewed_by = null,
          review_notes = null,
          reviewed_at = null,
          ready_at = case when v_status = 'ready_for_review' then now() else null end,
          updated_at = now()
    where id = v_package.id
    returning * into v_package;

    insert into public.event_factory_package_actions (
      package_id, action_type, actor_identity, from_status, to_status, metadata
    ) values (
      v_package.id, 'rebuilt', btrim(p_actor_identity), v_previous_status, v_status,
      jsonb_build_object('content_hash', p_content_hash, 'readiness_checks', v_checks)
    );
  end if;

  return query select v_package.id, v_package.status, v_package.readiness_score, v_created;
end;
$$;

create or replace function public.atlas_guard_frozen_visual_workflow()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'approved'
     and new.status <> 'approved'
     and exists (
       select 1
       from public.event_factory_packages as package
       where package.art_asset->>'visualWorkflowId' = old.id::text
     ) then
    raise exception 'This approved visual is retained by a frozen package and cannot be reopened.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists event_visual_workflow_frozen_guard
  on public.event_visual_workflows;
create trigger event_visual_workflow_frozen_guard
before update on public.event_visual_workflows
for each row
execute function public.atlas_guard_frozen_visual_workflow();

create or replace function public.atlas_create_event_visual_workflow_revision(
  p_workflow_id uuid,
  p_content_hash text,
  p_actor_identity text,
  p_notes text
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
  v_source public.event_visual_workflows%rowtype;
  v_revision public.event_visual_workflows%rowtype;
  v_revision_number integer;
begin
  perform public.atlas_assert_service_role();
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 visual workflow content hash is required.' using errcode = '22023';
  end if;

  select workflow.* into v_source
  from public.event_visual_workflows as workflow
  where workflow.id = p_workflow_id
  for update;
  if not found then
    raise exception 'Visual workflow was not found.' using errcode = 'P0002';
  end if;
  if v_source.status <> 'approved' then
    raise exception 'Only an approved visual workflow can start a correction revision.' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.event_factory_packages as package
    where package.art_asset->>'visualWorkflowId' = v_source.id::text
  ) or not exists (
    select 1
    from public.event_factory_packages as package
    where package.candidate_id = v_source.candidate_id
      and package.target_year = v_source.target_year
      and package.status = 'published'
  ) then
    raise exception 'Only a visual retained by a frozen package in a published event can start a correction revision.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'event-visual-revision:' || v_source.candidate_id::text || ':' || v_source.target_year::text,
      0
    )
  );

  select workflow.* into v_revision
  from public.event_visual_workflows as workflow
  where workflow.supersedes_workflow_id = v_source.id
  order by workflow.revision_number desc
  limit 1
  for update;
  if found and v_revision.status <> 'archived' then
    return query
      select v_revision.id, v_revision.status, v_revision.revision_number, false;
    return;
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
    supersedes_workflow_id
  ) values (
    v_source.candidate_id,
    v_source.event_id,
    v_source.source_bundle_id,
    v_source.target_year,
    v_source.event_key,
    v_source.event_name,
    v_source.location_label,
    v_source.lane,
    'draft',
    v_source.search_query,
    v_source.reviewed_thumbnail_count,
    v_source.reference_sources,
    v_source.visual_signature,
    v_source.generation_brief,
    '{}'::jsonb,
    jsonb_build_object(
      'visualElementsVerified', false,
      'independentComposition', false,
      'noInventedTextOrMarks', false,
      'mobileCropVerified', false,
      'publicAssetVerified', false
    ),
    p_content_hash,
    btrim(p_actor_identity),
    v_revision_number,
    v_source.id
  )
  returning * into v_revision;

  insert into public.event_visual_workflow_actions (
    workflow_id,
    action_type,
    actor_identity,
    from_status,
    to_status,
    notes,
    metadata
  ) values (
    v_revision.id,
    'created',
    btrim(p_actor_identity),
    null,
    'draft',
    nullif(btrim(p_notes), ''),
    jsonb_build_object(
      'supersedes_workflow_id', v_source.id,
      'revision_number', v_revision_number,
      'qa_reset', true
    )
  );

  return query select v_revision.id, v_revision.status, v_revision.revision_number, true;
end;
$$;

create or replace function public.atlas_attach_event_visual_revision_asset(
  p_workflow_id uuid,
  p_asset jsonb,
  p_content_hash text,
  p_actor_identity text
)
returns table (
  workflow_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.event_visual_workflows%rowtype;
  v_previous_status text;
begin
  perform public.atlas_assert_service_role();
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 visual workflow content hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_asset) is distinct from 'object'
     or p_asset->>'sourceKind' <> 'supabase'
     or p_asset->>'storageBucket' <> 'celebration-atlas-media'
     or nullif(btrim(p_asset->>'storagePath'), '') is null
     or coalesce(p_asset->>'publicUrl', '') !~ '^https://'
     or nullif(btrim(p_asset->>'altText'), '') is null then
    raise exception 'A complete public Supabase hero asset is required.' using errcode = '22023';
  end if;

  select workflow.* into v_workflow
  from public.event_visual_workflows as workflow
  where workflow.id = p_workflow_id
  for update;
  if not found then
    raise exception 'Visual workflow revision was not found.' using errcode = 'P0002';
  end if;
  if v_workflow.supersedes_workflow_id is null then
    raise exception 'Only a visual correction revision can use this asset operation.' using errcode = '22023';
  end if;
  if v_workflow.status in ('approved', 'archived') then
    raise exception 'Approved or archived visual revisions cannot replace artwork.' using errcode = '22023';
  end if;

  v_previous_status := v_workflow.status;
  update public.event_visual_workflows
    set asset = p_asset,
        qa_checks = jsonb_build_object(
          'visualElementsVerified', false,
          'independentComposition', false,
          'noInventedTextOrMarks', false,
          'mobileCropVerified', false,
          'publicAssetVerified', true
        ),
        status = 'draft',
        content_hash = p_content_hash,
        reviewed_by = null,
        review_notes = null,
        reviewed_at = null,
        ready_at = null,
        updated_at = now()
  where id = p_workflow_id;

  insert into public.event_visual_workflow_actions (
    workflow_id,
    action_type,
    actor_identity,
    from_status,
    to_status,
    metadata
  ) values (
    p_workflow_id,
    'rebuilt',
    btrim(p_actor_identity),
    v_previous_status,
    'draft',
    jsonb_build_object(
      'asset_replaced', true,
      'public_asset_verified', true,
      'qa_reset', true
    )
  );

  return query select p_workflow_id, 'draft'::text;
end;
$$;

create or replace function public.atlas_update_event_visual_revision_qa(
  p_workflow_id uuid,
  p_qa_checks jsonb,
  p_content_hash text,
  p_actor_identity text
)
returns table (
  workflow_id uuid,
  status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.event_visual_workflows%rowtype;
  v_previous_status text;
  v_status text;
  v_qa_checks jsonb;
  v_research_ready boolean;
  v_asset_ready boolean;
  v_qa_ready boolean;
  v_motif_count integer;
begin
  perform public.atlas_assert_service_role();
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 visual workflow content hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_qa_checks) is distinct from 'object' then
    raise exception 'Visual QA checks must use structured JSON.' using errcode = '22023';
  end if;

  select workflow.* into v_workflow
  from public.event_visual_workflows as workflow
  where workflow.id = p_workflow_id
  for update;
  if not found then
    raise exception 'Visual workflow revision was not found.' using errcode = 'P0002';
  end if;
  if v_workflow.supersedes_workflow_id is null then
    raise exception 'Only a visual correction revision can use this QA operation.' using errcode = '22023';
  end if;
  if v_workflow.status in ('approved', 'archived') then
    raise exception 'Approved or archived visual revisions cannot change QA.' using errcode = '22023';
  end if;

  v_qa_checks := jsonb_build_object(
    'visualElementsVerified', p_qa_checks->>'visualElementsVerified' = 'true',
    'independentComposition', p_qa_checks->>'independentComposition' = 'true',
    'noInventedTextOrMarks', p_qa_checks->>'noInventedTextOrMarks' = 'true',
    'mobileCropVerified', p_qa_checks->>'mobileCropVerified' = 'true',
    'publicAssetVerified', v_workflow.qa_checks->>'publicAssetVerified' = 'true'
  );
  v_motif_count := case
    when jsonb_typeof(v_workflow.visual_signature->'motifs') = 'array'
      then jsonb_array_length(v_workflow.visual_signature->'motifs')
    else 0
  end;
  v_research_ready := v_workflow.reviewed_thumbnail_count between 15 and 30
    and jsonb_array_length(v_workflow.reference_sources) between 3 and 12
    and v_motif_count between 3 and 5
    and nullif(btrim(v_workflow.visual_signature->>'heroMoment'), '') is not null
    and nullif(btrim(v_workflow.generation_brief->>'prompt'), '') is not null
    and v_workflow.generation_brief->>'aspectRatio' = '2:3'
    and v_workflow.generation_brief->>'textPolicy' = 'no_generated_text';
  v_asset_ready := v_workflow.asset->>'sourceKind' = 'supabase'
    and v_workflow.asset->>'storageBucket' = 'celebration-atlas-media'
    and nullif(btrim(v_workflow.asset->>'storagePath'), '') is not null
    and coalesce(v_workflow.asset->>'publicUrl', '') ~ '^https://'
    and nullif(btrim(v_workflow.asset->>'altText'), '') is not null;
  v_qa_ready := v_qa_checks->>'visualElementsVerified' = 'true'
    and v_qa_checks->>'independentComposition' = 'true'
    and v_qa_checks->>'noInventedTextOrMarks' = 'true'
    and v_qa_checks->>'mobileCropVerified' = 'true'
    and v_qa_checks->>'publicAssetVerified' = 'true';
  v_status := case
    when v_research_ready and v_asset_ready and v_qa_ready then 'ready_for_review'
    when v_research_ready then 'draft'
    else 'researching'
  end;
  v_previous_status := v_workflow.status;

  update public.event_visual_workflows
    set qa_checks = v_qa_checks,
        status = v_status,
        content_hash = p_content_hash,
        reviewed_by = null,
        review_notes = null,
        reviewed_at = null,
        ready_at = case when v_status = 'ready_for_review' then now() else null end,
        updated_at = now()
  where id = p_workflow_id;

  insert into public.event_visual_workflow_actions (
    workflow_id,
    action_type,
    actor_identity,
    from_status,
    to_status,
    metadata
  ) values (
    p_workflow_id,
    'rebuilt',
    btrim(p_actor_identity),
    v_previous_status,
    v_status,
    jsonb_build_object('qa_ready', v_qa_ready, 'asset_ready', v_asset_ready)
  );

  return query select p_workflow_id, v_status;
end;
$$;

drop function public.atlas_list_event_visual_workflows(integer);

create function public.atlas_list_event_visual_workflows(p_limit integer default 100)
returns table (
  workflow_id uuid,
  revision_number integer,
  supersedes_workflow_id uuid,
  candidate_id uuid,
  event_id uuid,
  source_bundle_id uuid,
  target_year integer,
  event_key text,
  event_name text,
  location_label text,
  lane text,
  status text,
  search_query text,
  reviewed_thumbnail_count integer,
  reference_sources jsonb,
  visual_signature jsonb,
  generation_brief jsonb,
  asset jsonb,
  qa_checks jsonb,
  content_hash text,
  reviewed_by text,
  review_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    workflow.id,
    workflow.revision_number,
    workflow.supersedes_workflow_id,
    workflow.candidate_id,
    workflow.event_id,
    workflow.source_bundle_id,
    workflow.target_year,
    workflow.event_key,
    workflow.event_name,
    workflow.location_label,
    workflow.lane,
    workflow.status,
    workflow.search_query,
    workflow.reviewed_thumbnail_count,
    workflow.reference_sources,
    workflow.visual_signature,
    workflow.generation_brief,
    workflow.asset,
    workflow.qa_checks,
    workflow.content_hash,
    workflow.reviewed_by,
    workflow.review_notes,
    workflow.created_at,
    workflow.updated_at,
    workflow.reviewed_at
  from public.event_visual_workflows as workflow
  order by workflow.revision_number desc, workflow.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

create or replace function public.atlas_create_event_factory_hero_correction(
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
  v_package_version integer;
  v_manifest jsonb;
  v_art_brief jsonb;
  v_art_asset jsonb;
  v_old_visual_workflow_id text;
  v_checks_complete boolean;
begin
  perform public.atlas_assert_service_role();
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 package content hash is required.' using errcode = '22023';
  end if;

  select package.* into v_source
  from public.event_factory_packages as package
  where package.id = p_source_package_id
  for update;
  if not found then
    raise exception 'Released source package was not found.' using errcode = 'P0002';
  end if;
  if v_source.status <> 'published' then
    raise exception 'Only a published package can start a hero correction.' using errcode = '22023';
  end if;

  select workflow.* into v_visual
  from public.event_visual_workflows as workflow
  where workflow.id = p_visual_workflow_id
  for update;
  if not found then
    raise exception 'Approved visual revision was not found.' using errcode = 'P0002';
  end if;
  if v_visual.status <> 'approved' or v_visual.supersedes_workflow_id is null then
    raise exception 'An approved visual correction revision is required.' using errcode = '22023';
  end if;
  if v_visual.candidate_id <> v_source.candidate_id
     or v_visual.target_year <> v_source.target_year
     or v_visual.event_key <> v_source.event_key then
    raise exception 'Visual revision and released package identities do not match.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'event-package-correction:' || v_source.candidate_id::text || ':' || v_source.target_year::text,
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
    raise exception 'Hero corrections must start from the latest published package.' using errcode = '22023';
  end if;

  v_old_visual_workflow_id := v_source.art_asset->>'visualWorkflowId';
  if v_old_visual_workflow_id is null or not exists (
    with recursive visual_lineage as (
      select workflow.id, workflow.supersedes_workflow_id
      from public.event_visual_workflows as workflow
      where workflow.id = v_visual.id
      union all
      select parent.id, parent.supersedes_workflow_id
      from public.event_visual_workflows as parent
      join visual_lineage as child on child.supersedes_workflow_id = parent.id
    )
    select 1
    from visual_lineage
    where visual_lineage.id::text = v_old_visual_workflow_id
  ) then
    raise exception 'Visual revision does not descend from the released package art.' using errcode = '22023';
  end if;
  v_checks_complete := v_visual.qa_checks->>'visualElementsVerified' = 'true'
    and v_visual.qa_checks->>'independentComposition' = 'true'
    and v_visual.qa_checks->>'noInventedTextOrMarks' = 'true'
    and v_visual.qa_checks->>'mobileCropVerified' = 'true'
    and v_visual.qa_checks->>'publicAssetVerified' = 'true';
  if v_visual.asset->>'sourceKind' <> 'supabase'
     or v_visual.asset->>'storageBucket' <> 'celebration-atlas-media'
     or coalesce(v_visual.asset->>'publicUrl', '') !~ '^https://'
     or nullif(btrim(v_visual.asset->>'storagePath'), '') is null
     or nullif(btrim(v_visual.asset->>'altText'), '') is null
     or not v_checks_complete then
    raise exception 'The corrected hero must be publicly hosted and fully checked.' using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.supersedes_package_id = v_source.id
    and package.art_asset->>'visualWorkflowId' = v_visual.id::text
  order by package.package_version desc
  limit 1
  for update;
  if found and v_package.content_hash <> p_content_hash then
    raise exception 'The existing hero correction has different frozen content.' using errcode = '22023';
  end if;
  if found and v_package.status = 'assembling' then
    update public.event_factory_packages
      set status = 'ready_for_review',
          readiness_checks = v_source.readiness_checks,
          readiness_score = v_source.readiness_score,
          ready_at = now(),
          updated_at = now()
    where id = v_package.id
    returning * into v_package;

    insert into public.event_factory_package_actions (
      package_id, action_type, actor_identity, from_status, to_status, notes, metadata
    ) values (
      v_package.id, 'rebuilt', btrim(p_actor_identity), 'assembling', 'ready_for_review',
      nullif(btrim(p_notes), ''),
      jsonb_build_object('content_hash', p_content_hash, 'correction_scope', 'hero_only')
    );
  end if;
  if found then
    return query
      select v_package.id, v_package.status, v_package.readiness_score,
        v_package.package_version, false;
    return;
  end if;

  select coalesce(max(package.package_version), 0) + 1
    into v_package_version
  from public.event_factory_packages as package
  where package.candidate_id = v_source.candidate_id
    and package.target_year = v_source.target_year;

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
    false
  );
  v_art_brief := v_source.art_brief || jsonb_build_object(
    'visualWorkflowId', v_visual.id,
    'lane', v_visual.lane,
    'searchQuery', v_visual.search_query,
    'reviewedThumbnailCount', v_visual.reviewed_thumbnail_count,
    'referenceSources', v_visual.reference_sources,
    'visualSignature', v_visual.visual_signature,
    'generationBrief', v_visual.generation_brief
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
    'qaChecks', v_visual.qa_checks
  );

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
    v_source.readiness_checks,
    v_source.readiness_score,
    p_content_hash,
    btrim(p_actor_identity),
    now(),
    v_source.id
  )
  returning * into v_package;

  insert into public.event_factory_package_actions (
    package_id,
    action_type,
    actor_identity,
    from_status,
    to_status,
    notes,
    metadata
  ) values (
    v_package.id,
    'created',
    btrim(p_actor_identity),
    null,
    'ready_for_review',
    nullif(btrim(p_notes), ''),
    jsonb_build_object(
      'supersedes_package_id', v_source.id,
      'visual_workflow_id', v_visual.id,
      'package_version', v_package_version,
      'correction_scope', 'hero_only'
    )
  );

  return query
    select v_package.id, v_package.status, v_package.readiness_score,
      v_package.package_version, true;
end;
$$;

revoke all on function public.atlas_create_event_visual_workflow_revision(uuid, text, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_guard_frozen_visual_workflow()
  from public, anon, authenticated;
revoke all on function public.atlas_attach_event_visual_revision_asset(uuid, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_update_event_visual_revision_qa(uuid, jsonb, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_list_event_visual_workflows(integer)
  from public, anon, authenticated;
revoke all on function public.atlas_create_event_factory_hero_correction(uuid, uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.atlas_create_event_visual_workflow_revision(uuid, text, text, text)
  to service_role;
grant execute on function public.atlas_attach_event_visual_revision_asset(uuid, jsonb, text, text)
  to service_role;
grant execute on function public.atlas_update_event_visual_revision_qa(uuid, jsonb, text, text)
  to service_role;
grant execute on function public.atlas_list_event_visual_workflows(integer)
  to service_role;
grant execute on function public.atlas_create_event_factory_hero_correction(uuid, uuid, text, text, text)
  to service_role;
