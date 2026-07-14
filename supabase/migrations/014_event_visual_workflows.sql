-- Evidence-backed hero art workflows and cloud media approval.
-- Apply after migration 013.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'celebration-atlas-media',
  'celebration-atlas-media',
  true,
  16777216,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']::text[]
)
on conflict (id) do update
set public = true,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.event_visual_workflows (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid not null references public.event_candidates(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  source_bundle_id uuid references public.event_source_bundles(id) on delete set null,
  target_year integer not null check (target_year between 2000 and 2100),
  event_key text not null check (event_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  event_name text not null check (char_length(event_name) between 1 and 200),
  location_label text not null check (char_length(location_label) between 1 and 300),
  lane text not null default 'fast_visual' check (lane in ('fast_visual', 'editorial')),
  status text not null default 'researching' check (
    status in ('researching', 'draft', 'ready_for_review', 'approved', 'rejected', 'archived')
  ),
  search_query text not null check (char_length(search_query) between 3 and 500),
  reviewed_thumbnail_count integer not null default 0 check (reviewed_thumbnail_count between 0 and 60),
  reference_sources jsonb not null default '[]'::jsonb check (jsonb_typeof(reference_sources) = 'array'),
  visual_signature jsonb not null default '{}'::jsonb check (jsonb_typeof(visual_signature) = 'object'),
  generation_brief jsonb not null default '{}'::jsonb check (jsonb_typeof(generation_brief) = 'object'),
  asset jsonb not null default '{}'::jsonb check (jsonb_typeof(asset) = 'object'),
  qa_checks jsonb not null default '{}'::jsonb check (jsonb_typeof(qa_checks) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_by text not null,
  reviewed_by text,
  review_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  reviewed_at timestamptz,
  unique (candidate_id, target_year),
  unique (event_key, target_year)
);

create index event_visual_workflows_status_updated
  on public.event_visual_workflows (status, updated_at desc);

create table public.event_visual_workflow_actions (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.event_visual_workflows(id) on delete cascade,
  action_type text not null check (
    action_type in ('created', 'rebuilt', 'approved', 'rejected', 'reopened', 'archived')
  ),
  actor_identity text not null,
  from_status text,
  to_status text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index event_visual_workflow_actions_workflow_created
  on public.event_visual_workflow_actions (workflow_id, created_at desc);

alter table public.event_visual_workflows enable row level security;
alter table public.event_visual_workflow_actions enable row level security;

revoke all on table public.event_visual_workflows from public, anon, authenticated, service_role;
revoke all on table public.event_visual_workflow_actions from public, anon, authenticated, service_role;

grant select on table public.event_visual_workflows to service_role;
grant select on table public.event_visual_workflow_actions to service_role;

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
  where workflow.candidate_id = p_candidate_id and workflow.target_year = p_target_year
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
      content_hash, created_by, ready_at
    ) values (
      p_candidate_id, v_candidate.matched_event_id, p_source_bundle_id, p_target_year,
      p_event_key, btrim(p_event_name), btrim(p_location_label), p_lane, v_status,
      btrim(p_search_query), p_reviewed_thumbnail_count, p_reference_sources,
      p_visual_signature, p_generation_brief, p_asset, p_qa_checks, p_content_hash,
      btrim(p_actor_identity), case when v_status = 'ready_for_review' then now() else null end
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

create or replace function public.atlas_review_event_visual_workflow(
  p_workflow_id uuid,
  p_decision text,
  p_actor_identity text,
  p_notes text
)
returns table (
  workflow_id uuid,
  status text,
  event_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workflow public.event_visual_workflows%rowtype;
  v_status text;
  v_action text;
begin
  perform public.atlas_assert_service_role();
  if p_decision not in ('approve', 'reject', 'reopen') then
    raise exception 'Unsupported visual workflow decision.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select workflow.* into v_workflow
  from public.event_visual_workflows as workflow
  where workflow.id = p_workflow_id
  for update;
  if not found then
    raise exception 'Visual workflow was not found.' using errcode = 'P0002';
  end if;

  if p_decision = 'approve' then
    if v_workflow.status <> 'ready_for_review' then
      raise exception 'Only a complete visual workflow can be approved.' using errcode = '22023';
    end if;
    v_status := 'approved';
    v_action := 'approved';
  elsif p_decision = 'reject' then
    if v_workflow.status <> 'ready_for_review' then
      raise exception 'Only a review-ready visual workflow can be rejected.' using errcode = '22023';
    end if;
    v_status := 'rejected';
    v_action := 'rejected';
  else
    if v_workflow.status not in ('approved', 'rejected') then
      raise exception 'Only approved or rejected visual workflows can be reopened.' using errcode = '22023';
    end if;
    if v_workflow.status = 'approved' and exists (
      select 1 from public.event_factory_packages as package
      where package.art_asset->>'visualWorkflowId' = p_workflow_id::text
        and package.status in ('approved', 'publishing', 'published', 'archived')
    ) then
      raise exception 'This approved visual is retained by a released package and cannot be reopened.' using errcode = '22023';
    end if;
    v_status := 'draft';
    v_action := 'reopened';
  end if;

  update public.event_visual_workflows
    set status = v_status,
        reviewed_by = case when p_decision in ('approve', 'reject') then btrim(p_actor_identity) else null end,
        review_notes = nullif(btrim(p_notes), ''),
        reviewed_at = case when p_decision in ('approve', 'reject') then now() else null end,
        updated_at = now()
  where id = p_workflow_id;

  insert into public.event_visual_workflow_actions (
    workflow_id, action_type, actor_identity, from_status, to_status, notes
  ) values (
    p_workflow_id, v_action, btrim(p_actor_identity), v_workflow.status, v_status,
    nullif(btrim(p_notes), '')
  );

  return query select p_workflow_id, v_status, v_workflow.event_key;
end;
$$;

create or replace function public.atlas_list_event_visual_workflows(p_limit integer default 100)
returns table (
  workflow_id uuid,
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
  order by
    case workflow.status
      when 'ready_for_review' then 0
      when 'draft' then 1
      when 'researching' then 2
      when 'rejected' then 3
      when 'approved' then 4
      else 5
    end,
    workflow.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.atlas_upsert_event_visual_workflow(uuid, uuid, integer, text, text, text, text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.atlas_review_event_visual_workflow(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_list_event_visual_workflows(integer) from public, anon, authenticated;

grant execute on function public.atlas_upsert_event_visual_workflow(uuid, uuid, integer, text, text, text, text, text, integer, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) to service_role;
grant execute on function public.atlas_review_event_visual_workflow(uuid, text, text, text) to service_role;
grant execute on function public.atlas_list_event_visual_workflows(integer) to service_role;
