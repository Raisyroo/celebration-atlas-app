-- Versioned, review-gated synthesis proposals for Event Hub source bundles.
-- Apply after migration 006. Accepted synthesis proposals never publish directly.

alter table public.event_source_bundle_actions
  drop constraint if exists event_source_bundle_actions_action_type_check;

alter table public.event_source_bundle_actions
  add constraint event_source_bundle_actions_action_type_check check (
    action_type in (
      'created',
      'source_added',
      'ready_for_synthesis',
      'reopened',
      'archived',
      'candidate_attached',
      'page_version_attached',
      'synthesis_generated',
      'synthesis_accepted'
    )
  );

create table public.event_source_syntheses (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  status text not null default 'generated' check (
    status in ('generated', 'in_review', 'accepted', 'rejected', 'superseded')
  ),
  engine_kind text not null check (engine_kind in ('deterministic', 'model_assisted')),
  engine_version text not null check (char_length(engine_version) between 1 and 100),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  reconciled_profile jsonb not null check (jsonb_typeof(reconciled_profile) = 'object'),
  conflicts jsonb not null default '[]'::jsonb check (jsonb_typeof(conflicts) = 'array'),
  manifest_proposal jsonb not null check (jsonb_typeof(manifest_proposal) = 'object'),
  validation_report jsonb not null check (jsonb_typeof(validation_report) = 'object'),
  is_manifest_valid boolean not null default false,
  quality_score numeric(4,3) not null check (quality_score between 0 and 1),
  model_provider text,
  model_name text,
  model_response_id text,
  created_by text not null,
  reviewed_by text,
  review_notes text,
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  unique (bundle_id, version_number),
  unique (bundle_id, engine_kind, engine_version, input_hash),
  check (
    engine_kind = 'model_assisted'
    or (model_provider is null and model_name is null and model_response_id is null)
  )
);

create table public.event_source_synthesis_actions (
  id uuid primary key default gen_random_uuid(),
  synthesis_id uuid not null references public.event_source_syntheses(id) on delete cascade,
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  action_type text not null check (
    action_type in ('generated', 'submitted_for_review', 'accepted', 'rejected', 'superseded')
  ),
  from_status text,
  to_status text not null,
  actor_identity text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index event_source_syntheses_bundle_created
  on public.event_source_syntheses (bundle_id, created_at desc);
create index event_source_syntheses_status_created
  on public.event_source_syntheses (status, created_at desc);
create unique index event_source_syntheses_one_accepted_per_bundle
  on public.event_source_syntheses (bundle_id)
  where status = 'accepted';
create index event_source_synthesis_actions_synthesis_created
  on public.event_source_synthesis_actions (synthesis_id, created_at desc);

alter table public.event_source_syntheses enable row level security;
alter table public.event_source_synthesis_actions enable row level security;

revoke all on table public.event_source_syntheses from public, anon, authenticated, service_role;
revoke all on table public.event_source_synthesis_actions from public, anon, authenticated, service_role;

grant select on table public.event_source_syntheses to service_role;
grant select on table public.event_source_synthesis_actions to service_role;

create or replace function public.atlas_create_event_source_synthesis(
  p_bundle_id uuid,
  p_engine_kind text,
  p_engine_version text,
  p_input_hash text,
  p_reconciled_profile jsonb,
  p_conflicts jsonb,
  p_manifest_proposal jsonb,
  p_validation_report jsonb,
  p_is_manifest_valid boolean,
  p_quality_score numeric,
  p_model_provider text,
  p_model_name text,
  p_model_response_id text,
  p_actor_identity text
)
returns table (
  synthesis_id uuid,
  version_number integer,
  status text,
  created_at timestamptz,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_status text;
  v_synthesis_id uuid;
  v_version_number integer;
  v_status text;
  v_created_at timestamptz;
  v_old record;
begin
  if p_engine_kind not in ('deterministic', 'model_assisted') then
    raise exception 'Unsupported synthesis engine kind.' using errcode = '22023';
  end if;
  if nullif(btrim(p_engine_version), '') is null or char_length(p_engine_version) > 100 then
    raise exception 'A synthesis engine version is required.' using errcode = '22023';
  end if;
  if p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 synthesis input hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_reconciled_profile) is distinct from 'object'
    or jsonb_typeof(p_conflicts) is distinct from 'array'
    or jsonb_typeof(p_manifest_proposal) is distinct from 'object'
    or jsonb_typeof(p_validation_report) is distinct from 'object' then
    raise exception 'Synthesis payloads have invalid JSON shapes.' using errcode = '22023';
  end if;
  if p_quality_score is null or p_quality_score < 0 or p_quality_score > 1 then
    raise exception 'Synthesis quality score must be between 0 and 1.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_engine_kind = 'deterministic'
    and (p_model_provider is not null or p_model_name is not null or p_model_response_id is not null) then
    raise exception 'Deterministic synthesis cannot record model metadata.' using errcode = '22023';
  end if;

  select synthesis.id, synthesis.version_number, synthesis.status, synthesis.created_at
    into v_synthesis_id, v_version_number, v_status, v_created_at
  from public.event_source_syntheses as synthesis
  where synthesis.bundle_id = p_bundle_id
    and synthesis.engine_kind = p_engine_kind
    and synthesis.engine_version = p_engine_version
    and synthesis.input_hash = p_input_hash
  limit 1;

  if v_synthesis_id is not null then
    return query select v_synthesis_id, v_version_number, v_status, v_created_at, false;
    return;
  end if;

  select bundle.status
    into v_bundle_status
  from public.event_source_bundles as bundle
  where bundle.id = p_bundle_id
  for update;

  if v_bundle_status is null then
    raise exception 'Source bundle was not found.' using errcode = 'P0002';
  end if;
  if v_bundle_status = 'draft_ready' then
    select synthesis.id, synthesis.version_number, synthesis.status, synthesis.created_at
      into v_synthesis_id, v_version_number, v_status, v_created_at
    from public.event_source_syntheses as synthesis
    where synthesis.bundle_id = p_bundle_id
      and synthesis.engine_kind = p_engine_kind
      and synthesis.engine_version = p_engine_version
      and synthesis.input_hash = p_input_hash
    limit 1;

    if v_synthesis_id is not null then
      return query select v_synthesis_id, v_version_number, v_status, v_created_at, false;
      return;
    end if;
  end if;
  if v_bundle_status <> 'ready_for_synthesis' then
    raise exception 'Only a ready source bundle can produce a new synthesis proposal.' using errcode = 'P0001';
  end if;

  select coalesce(max(synthesis.version_number), 0) + 1
    into v_version_number
  from public.event_source_syntheses as synthesis
  where synthesis.bundle_id = p_bundle_id;

  for v_old in
    select synthesis.id, synthesis.status
    from public.event_source_syntheses as synthesis
    where synthesis.bundle_id = p_bundle_id
      and synthesis.status in ('generated', 'in_review')
    for update
  loop
    update public.event_source_syntheses as synthesis
    set status = 'superseded',
        reviewed_at = now(),
        reviewed_by = p_actor_identity,
        review_notes = 'Superseded by a newer evidence synthesis.'
    where synthesis.id = v_old.id;

    insert into public.event_source_synthesis_actions (
      synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, notes
    ) values (
      v_old.id, p_bundle_id, 'superseded', v_old.status, 'superseded', p_actor_identity,
      'Superseded by a newer evidence synthesis.'
    );
  end loop;

  insert into public.event_source_syntheses (
    bundle_id,
    version_number,
    engine_kind,
    engine_version,
    input_hash,
    reconciled_profile,
    conflicts,
    manifest_proposal,
    validation_report,
    is_manifest_valid,
    quality_score,
    model_provider,
    model_name,
    model_response_id,
    created_by
  ) values (
    p_bundle_id,
    v_version_number,
    p_engine_kind,
    btrim(p_engine_version),
    p_input_hash,
    p_reconciled_profile,
    p_conflicts,
    p_manifest_proposal,
    p_validation_report,
    p_is_manifest_valid,
    p_quality_score,
    nullif(btrim(p_model_provider), ''),
    nullif(btrim(p_model_name), ''),
    nullif(btrim(p_model_response_id), ''),
    p_actor_identity
  )
  returning event_source_syntheses.id, event_source_syntheses.created_at
    into v_synthesis_id, v_created_at;

  update public.event_source_bundles as bundle
  set status = 'draft_ready',
      updated_at = now()
  where bundle.id = p_bundle_id;

  insert into public.event_source_synthesis_actions (
    synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, metadata
  ) values (
    v_synthesis_id,
    p_bundle_id,
    'generated',
    null,
    'generated',
    p_actor_identity,
    jsonb_build_object(
      'engine_kind', p_engine_kind,
      'engine_version', p_engine_version,
      'input_hash', p_input_hash,
      'is_manifest_valid', p_is_manifest_valid,
      'quality_score', p_quality_score
    )
  );

  insert into public.event_source_bundle_actions (
    bundle_id, action_type, actor_identity, metadata
  ) values (
    p_bundle_id,
    'synthesis_generated',
    p_actor_identity,
    jsonb_build_object('synthesis_id', v_synthesis_id, 'version_number', v_version_number)
  );

  return query select v_synthesis_id, v_version_number, 'generated'::text, v_created_at, true;
end;
$$;

create or replace function public.atlas_transition_event_source_synthesis(
  p_synthesis_id uuid,
  p_action text,
  p_actor_identity text,
  p_notes text
)
returns table (
  synthesis_id uuid,
  bundle_id uuid,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_id uuid;
  v_current_status text;
  v_next_status text;
  v_action_type text;
  v_is_manifest_valid boolean;
  v_updated_at timestamptz := now();
  v_old record;
begin
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'Review notes must be 2,000 characters or fewer.' using errcode = '22023';
  end if;

  select synthesis.bundle_id, synthesis.status, synthesis.is_manifest_valid
    into v_bundle_id, v_current_status, v_is_manifest_valid
  from public.event_source_syntheses as synthesis
  where synthesis.id = p_synthesis_id
  for update;

  if v_bundle_id is null then
    raise exception 'Synthesis proposal was not found.' using errcode = 'P0002';
  end if;

  if p_action = 'submit' and v_current_status = 'generated' then
    v_next_status := 'in_review';
    v_action_type := 'submitted_for_review';
  elsif p_action = 'accept' and v_current_status = 'in_review' then
    if not v_is_manifest_valid then
      raise exception 'An invalid manifest proposal cannot be accepted.' using errcode = 'P0001';
    end if;
    v_next_status := 'accepted';
    v_action_type := 'accepted';
  elsif p_action = 'reject' and v_current_status = 'in_review' then
    v_next_status := 'rejected';
    v_action_type := 'rejected';
  else
    raise exception 'The requested synthesis transition is not allowed from status %.', v_current_status using errcode = 'P0001';
  end if;

  if v_next_status = 'accepted' then
    for v_old in
      select synthesis.id, synthesis.status
      from public.event_source_syntheses as synthesis
      where synthesis.bundle_id = v_bundle_id
        and synthesis.id <> p_synthesis_id
        and synthesis.status = 'accepted'
      for update
    loop
      update public.event_source_syntheses as synthesis
      set status = 'superseded',
          reviewed_at = v_updated_at,
          reviewed_by = p_actor_identity,
          review_notes = 'Superseded by a newly accepted synthesis proposal.'
      where synthesis.id = v_old.id;

      insert into public.event_source_synthesis_actions (
        synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, notes
      ) values (
        v_old.id, v_bundle_id, 'superseded', v_old.status, 'superseded', p_actor_identity,
        'Superseded by a newly accepted synthesis proposal.'
      );
    end loop;
  end if;

  update public.event_source_syntheses as synthesis
  set status = v_next_status,
      submitted_at = case when v_next_status = 'in_review' then v_updated_at else synthesis.submitted_at end,
      reviewed_at = case when v_next_status in ('accepted', 'rejected') then v_updated_at else synthesis.reviewed_at end,
      reviewed_by = case when v_next_status in ('accepted', 'rejected') then p_actor_identity else synthesis.reviewed_by end,
      review_notes = case when v_next_status in ('accepted', 'rejected') then nullif(btrim(p_notes), '') else synthesis.review_notes end
  where synthesis.id = p_synthesis_id;

  insert into public.event_source_synthesis_actions (
    synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, notes
  ) values (
    p_synthesis_id,
    v_bundle_id,
    v_action_type,
    v_current_status,
    v_next_status,
    p_actor_identity,
    nullif(btrim(p_notes), '')
  );

  if v_next_status = 'accepted' then
    insert into public.event_source_bundle_actions (
      bundle_id, action_type, actor_identity, metadata
    ) values (
      v_bundle_id,
      'synthesis_accepted',
      p_actor_identity,
      jsonb_build_object('synthesis_id', p_synthesis_id)
    );
  end if;

  return query select p_synthesis_id, v_bundle_id, v_next_status, v_updated_at;
end;
$$;

create or replace function public.atlas_list_event_source_syntheses(p_limit integer default 40)
returns table (
  synthesis_id uuid,
  bundle_id uuid,
  bundle_name text,
  event_key text,
  version_number integer,
  status text,
  engine_kind text,
  engine_version text,
  input_hash text,
  is_manifest_valid boolean,
  quality_score numeric,
  conflict_count integer,
  missing_field_count integer,
  validation_report jsonb,
  review_notes text,
  created_by text,
  reviewed_by text,
  created_at timestamptz,
  reviewed_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    synthesis.id,
    synthesis.bundle_id,
    bundle.name,
    bundle.event_key,
    synthesis.version_number,
    synthesis.status,
    synthesis.engine_kind,
    synthesis.engine_version,
    synthesis.input_hash,
    synthesis.is_manifest_valid,
    synthesis.quality_score,
    jsonb_array_length(synthesis.conflicts),
    case
      when jsonb_typeof(synthesis.validation_report->'missingFields') = 'array'
        then jsonb_array_length(synthesis.validation_report->'missingFields')
      else 0
    end,
    synthesis.validation_report,
    synthesis.review_notes,
    synthesis.created_by,
    synthesis.reviewed_by,
    synthesis.created_at,
    synthesis.reviewed_at
  from public.event_source_syntheses as synthesis
  join public.event_source_bundles as bundle on bundle.id = synthesis.bundle_id
  order by synthesis.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;

revoke all on function public.atlas_create_event_source_synthesis(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, boolean, numeric, text, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_transition_event_source_synthesis(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_list_event_source_syntheses(integer) from public, anon, authenticated;

grant execute on function public.atlas_create_event_source_synthesis(uuid, text, text, text, jsonb, jsonb, jsonb, jsonb, boolean, numeric, text, text, text, text) to service_role;
grant execute on function public.atlas_transition_event_source_synthesis(uuid, text, text, text) to service_role;
grant execute on function public.atlas_list_event_source_syntheses(integer) to service_role;

comment on table public.event_source_syntheses is
  'Immutable, versioned evidence reconciliations and Event Hub manifest proposals. Acceptance does not publish.';
comment on table public.event_source_synthesis_actions is
  'Append-only audit history for synthesis generation and human review transitions.';
