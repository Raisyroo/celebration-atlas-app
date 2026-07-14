-- Evidence-bound model editorial proposals derived from immutable deterministic syntheses.
-- A model-assisted proposal can improve allowlisted copy, but it remains review-gated and cannot publish.

alter table public.event_source_syntheses
  add column if not exists parent_synthesis_id uuid references public.event_source_syntheses(id) on delete restrict;

create index if not exists event_source_syntheses_parent
  on public.event_source_syntheses (parent_synthesis_id)
  where parent_synthesis_id is not null;

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
  v_old record;
begin
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
    and synthesis.engine_kind = 'model_assisted'
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
  where bundle.id = v_bundle_id
  for update;

  if v_bundle_status <> 'draft_ready' then
    raise exception 'The evidence bundle is not ready for editorial assistance.' using errcode = 'P0001';
  end if;

  select coalesce(max(synthesis.version_number), 0) + 1
    into v_version_number
  from public.event_source_syntheses as synthesis
  where synthesis.bundle_id = v_bundle_id;

  for v_old in
    select synthesis.id, synthesis.status
    from public.event_source_syntheses as synthesis
    where synthesis.bundle_id = v_bundle_id
      and synthesis.status in ('generated', 'in_review')
    for update
  loop
    update public.event_source_syntheses as synthesis
    set status = 'superseded',
        reviewed_at = now(),
        reviewed_by = p_actor_identity,
        review_notes = 'Superseded by an evidence-bound editorial proposal.'
    where synthesis.id = v_old.id;

    insert into public.event_source_synthesis_actions (
      synthesis_id, bundle_id, action_type, from_status, to_status, actor_identity, notes
    ) values (
      v_old.id,
      v_bundle_id,
      'superseded',
      v_old.status,
      'superseded',
      p_actor_identity,
      'Superseded by an evidence-bound editorial proposal.'
    );
  end loop;

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

revoke all on function public.atlas_create_model_assisted_synthesis(uuid, text, text, jsonb, jsonb, jsonb, jsonb, boolean, numeric, text, text, text, text) from public, anon, authenticated;
grant execute on function public.atlas_create_model_assisted_synthesis(uuid, text, text, jsonb, jsonb, jsonb, jsonb, boolean, numeric, text, text, text, text) to service_role;

comment on column public.event_source_syntheses.parent_synthesis_id is
  'The immutable deterministic proposal from which a model-assisted editorial proposal was derived.';
