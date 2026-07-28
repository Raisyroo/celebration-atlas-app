-- Preserve deterministic proposals until an editorial child is explicitly accepted.
-- Rejected editorial attempts may be regenerated without weakening deterministic replay.

alter table public.event_source_synthesis_actions
  drop constraint if exists event_source_synthesis_actions_action_type_check;

alter table public.event_source_synthesis_actions
  add constraint event_source_synthesis_actions_action_type_check check (
    action_type in (
      'generated',
      'map_record_attached',
      'submitted_for_review',
      'accepted',
      'rejected',
      'superseded',
      'restored'
    )
  );

do $$
declare
  v_constraint_name text;
begin
  select constraint_record.conname
    into v_constraint_name
  from pg_catalog.pg_constraint as constraint_record
  where constraint_record.conrelid = 'public.event_source_syntheses'::regclass
    and constraint_record.contype = 'u'
    and (
      select array_agg(attribute_record.attname::text order by key_record.ordinality)
      from unnest(constraint_record.conkey) with ordinality as key_record(attnum, ordinality)
      join pg_catalog.pg_attribute as attribute_record
        on attribute_record.attrelid = constraint_record.conrelid
       and attribute_record.attnum = key_record.attnum
    ) = array['bundle_id', 'engine_kind', 'engine_version', 'input_hash']::text[]
  limit 1;

  if v_constraint_name is null then
    raise exception 'The synthesis replay uniqueness constraint was not found.';
  end if;

  execute format(
    'alter table public.event_source_syntheses drop constraint %I',
    v_constraint_name
  );
end;
$$;

create unique index event_source_syntheses_deterministic_replay_uidx
  on public.event_source_syntheses (bundle_id, engine_kind, engine_version, input_hash)
  where engine_kind = 'deterministic';

create unique index event_source_syntheses_model_active_replay_uidx
  on public.event_source_syntheses (bundle_id, engine_kind, engine_version, input_hash)
  where engine_kind = 'model_assisted' and status <> 'rejected';

with repairable_parent as (
  select parent.id, parent.bundle_id
  from public.event_source_syntheses as parent
  join lateral (
    select action.action_type, action.notes
    from public.event_source_synthesis_actions as action
    where action.synthesis_id = parent.id
    order by action.created_at desc, action.id desc
    limit 1
  ) as latest_action on true
  where parent.engine_kind = 'deterministic'
    and parent.status = 'superseded'
    and latest_action.action_type = 'superseded'
    and latest_action.notes = 'Superseded by an evidence-bound editorial proposal.'
    and exists (
      select 1
      from public.event_source_syntheses as child
      where child.parent_synthesis_id = parent.id
        and child.engine_kind = 'model_assisted'
        and child.status in ('generated', 'in_review', 'rejected')
    )
    and not exists (
      select 1
      from public.event_source_syntheses as accepted
      where accepted.bundle_id = parent.bundle_id
        and accepted.status = 'accepted'
    )
),
restored_parent as (
  update public.event_source_syntheses as parent
  set status = 'generated',
      reviewed_at = null,
      reviewed_by = null,
      review_notes = null
  from repairable_parent
  where parent.id = repairable_parent.id
  returning parent.id, parent.bundle_id
)
insert into public.event_source_synthesis_actions (
  synthesis_id,
  bundle_id,
  action_type,
  from_status,
  to_status,
  actor_identity,
  notes
)
select
  restored_parent.id,
  restored_parent.bundle_id,
  'restored',
  'superseded',
  'generated',
  'migration-020',
  'Restored because an editorial proposal had not been accepted.'
from restored_parent;

create or replace function public.atlas_create_model_assisted_synthesis(
  p_parent_synthesis_id uuid,
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
  v_bundle_id uuid;
  v_bundle_status text;
  v_parent_kind text;
  v_parent_status text;
  v_synthesis_id uuid;
  v_version_number integer;
  v_status text;
  v_created_at timestamptz;
begin
  perform public.atlas_assert_service_role();

  if nullif(btrim(p_engine_version), '') is null or char_length(p_engine_version) > 100 then
    raise exception 'A model editorial engine version is required.' using errcode = '22023';
  end if;
  if p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 editorial input hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_reconciled_profile) is distinct from 'object'
    or jsonb_typeof(p_conflicts) is distinct from 'array'
    or jsonb_typeof(p_manifest_proposal) is distinct from 'object'
    or jsonb_typeof(p_validation_report) is distinct from 'object' then
    raise exception 'Editorial synthesis payloads have invalid JSON shapes.' using errcode = '22023';
  end if;
  if p_quality_score is null or p_quality_score < 0 or p_quality_score > 1 then
    raise exception 'Editorial synthesis quality score must be between 0 and 1.' using errcode = '22023';
  end if;
  if nullif(btrim(p_model_provider), '') is null or nullif(btrim(p_model_name), '') is null then
    raise exception 'Model provider and model name are required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select synthesis.bundle_id, synthesis.engine_kind, synthesis.status
    into v_bundle_id, v_parent_kind, v_parent_status
  from public.event_source_syntheses as synthesis
  where synthesis.id = p_parent_synthesis_id
  for update;

  if v_bundle_id is null then
    raise exception 'Parent synthesis proposal was not found.' using errcode = 'P0002';
  end if;
  if v_parent_kind <> 'deterministic' then
    raise exception 'Editorial assistance must derive from a deterministic synthesis.' using errcode = 'P0001';
  end if;
  if v_parent_status <> 'generated' then
    raise exception 'Only an unsubmitted deterministic proposal can receive editorial assistance.' using errcode = 'P0001';
  end if;

  select synthesis.id, synthesis.version_number, synthesis.status, synthesis.created_at
    into v_synthesis_id, v_version_number, v_status, v_created_at
  from public.event_source_syntheses as synthesis
  where synthesis.bundle_id = v_bundle_id
    and synthesis.parent_synthesis_id = p_parent_synthesis_id
    and synthesis.engine_kind = 'model_assisted'
    and synthesis.engine_version = p_engine_version
    and synthesis.input_hash = p_input_hash
    and synthesis.status <> 'rejected'
  limit 1;

  if v_synthesis_id is not null then
    return query select v_synthesis_id, v_version_number, v_status, v_created_at, false;
    return;
  end if;

  select bundle.status
    into v_bundle_status
  from public.event_source_bundles as bundle
  where bundle.id = v_bundle_id
  for update;

  if v_bundle_status <> 'draft_ready' then
    raise exception 'The evidence bundle is not ready for editorial assistance.' using errcode = 'P0001';
  end if;

  select coalesce(max(synthesis.version_number), 0) + 1
    into v_version_number
  from public.event_source_syntheses as synthesis
  where synthesis.bundle_id = v_bundle_id;

  insert into public.event_source_syntheses (
    bundle_id,
    parent_synthesis_id,
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
    v_bundle_id,
    p_parent_synthesis_id,
    v_version_number,
    'model_assisted',
    btrim(p_engine_version),
    p_input_hash,
    p_reconciled_profile,
    p_conflicts,
    p_manifest_proposal,
    p_validation_report,
    p_is_manifest_valid,
    p_quality_score,
    btrim(p_model_provider),
    btrim(p_model_name),
    nullif(btrim(p_model_response_id), ''),
    p_actor_identity
  )
  returning event_source_syntheses.id, event_source_syntheses.created_at
    into v_synthesis_id, v_created_at;

  insert into public.event_source_synthesis_actions (
    synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, metadata
  ) values (
    v_synthesis_id,
    v_bundle_id,
    'generated',
    null,
    'generated',
    p_actor_identity,
    jsonb_build_object(
      'engine_kind', 'model_assisted',
      'engine_version', p_engine_version,
      'input_hash', p_input_hash,
      'parent_synthesis_id', p_parent_synthesis_id,
      'model_provider', p_model_provider,
      'model_name', p_model_name,
      'is_manifest_valid', p_is_manifest_valid,
      'quality_score', p_quality_score
    )
  );

  insert into public.event_source_bundle_actions (
    bundle_id, action_type, actor_identity, metadata
  ) values (
    v_bundle_id,
    'synthesis_generated',
    p_actor_identity,
    jsonb_build_object(
      'synthesis_id', v_synthesis_id,
      'version_number', v_version_number,
      'engine_kind', 'model_assisted',
      'parent_synthesis_id', p_parent_synthesis_id
    )
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
  v_engine_kind text;
  v_parent_synthesis_id uuid;
  v_is_manifest_valid boolean;
  v_updated_at timestamptz := now();
  v_old record;
  v_parent_status text;
begin
  perform public.atlas_assert_service_role();

  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'Review notes must be 2,000 characters or fewer.' using errcode = '22023';
  end if;

  select
    synthesis.bundle_id,
    synthesis.status,
    synthesis.engine_kind,
    synthesis.parent_synthesis_id,
    synthesis.is_manifest_valid
    into
      v_bundle_id,
      v_current_status,
      v_engine_kind,
      v_parent_synthesis_id,
      v_is_manifest_valid
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

    if v_engine_kind = 'model_assisted' and v_parent_synthesis_id is not null then
      select synthesis.status
        into v_parent_status
      from public.event_source_syntheses as synthesis
      where synthesis.id = v_parent_synthesis_id
      for update;

      if v_parent_status in ('generated', 'in_review') then
        update public.event_source_syntheses as synthesis
        set status = 'superseded',
            reviewed_at = v_updated_at,
            reviewed_by = p_actor_identity,
            review_notes = 'Superseded by its accepted editorial child.'
        where synthesis.id = v_parent_synthesis_id;

        insert into public.event_source_synthesis_actions (
          synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, notes
        ) values (
          v_parent_synthesis_id,
          v_bundle_id,
          'superseded',
          v_parent_status,
          'superseded',
          p_actor_identity,
          'Superseded by its accepted editorial child.'
        );
      end if;
    end if;
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

revoke all on function public.atlas_create_model_assisted_synthesis(uuid, text, text, jsonb, jsonb, jsonb, jsonb, boolean, numeric, text, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_transition_event_source_synthesis(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.atlas_create_model_assisted_synthesis(uuid, text, text, jsonb, jsonb, jsonb, jsonb, boolean, numeric, text, text, text, text) to service_role;
grant execute on function public.atlas_transition_event_source_synthesis(uuid, text, text, text) to service_role;
