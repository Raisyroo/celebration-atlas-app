-- Attach reviewed coordinate provenance to a generated synthesis before human review.

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
      'superseded'
    )
  );

create or replace function public.atlas_attach_source_synthesis_map_record(
  p_synthesis_id uuid,
  p_map_record jsonb,
  p_actor_identity text,
  p_notes text default null
)
returns table (
  synthesis_id uuid,
  bundle_id uuid,
  status text,
  map_record jsonb,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_id uuid;
  v_status text;
  v_latitude double precision;
  v_longitude double precision;
  v_confidence numeric;
  v_map_record jsonb;
  v_updated_at timestamptz := now();
begin
  perform public.atlas_assert_service_role();

  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_notes is not null and char_length(p_notes) > 2000 then
    raise exception 'Map review notes must be 2,000 characters or fewer.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_map_record) is distinct from 'object' then
    raise exception 'A map record object is required.' using errcode = '22023';
  end if;

  begin
    v_latitude := (p_map_record->>'latitude')::double precision;
    v_longitude := (p_map_record->>'longitude')::double precision;
    v_confidence := coalesce((p_map_record->>'confidenceScore')::numeric, 0.95);
  exception when others then
    raise exception 'Map coordinates and confidence must be numeric.' using errcode = '22023';
  end;

  if v_latitude is null or v_latitude < -90 or v_latitude > 90
    or v_longitude is null or v_longitude < -180 or v_longitude > 180 then
    raise exception 'Map coordinates are outside valid latitude or longitude ranges.' using errcode = '22023';
  end if;
  if v_confidence < 0 or v_confidence > 1 then
    raise exception 'Map confidence must be between 0 and 1.' using errcode = '22023';
  end if;
  if nullif(btrim(p_map_record->>'sourceUrl'), '') is null
    or p_map_record->>'sourceUrl' !~* '^https?://' then
    raise exception 'A public coordinate source URL is required.' using errcode = '22023';
  end if;

  select synthesis.bundle_id, synthesis.status
    into v_bundle_id, v_status
  from public.event_source_syntheses as synthesis
  where synthesis.id = p_synthesis_id
  for update;

  if v_bundle_id is null then
    raise exception 'Synthesis proposal was not found.' using errcode = 'P0002';
  end if;
  if v_status <> 'generated' then
    raise exception 'Map provenance can only be attached before synthesis review.' using errcode = 'P0001';
  end if;

  v_map_record := jsonb_build_object(
    'latitude', v_latitude,
    'longitude', v_longitude,
    'sourceUrl', btrim(p_map_record->>'sourceUrl'),
    'sourceLabel', coalesce(nullif(btrim(p_map_record->>'sourceLabel'), ''), 'Reviewed coordinate source'),
    'coordinateMethod', coalesce(nullif(btrim(p_map_record->>'coordinateMethod'), ''), 'manual-verification'),
    'confidenceScore', v_confidence
  );

  update public.event_source_syntheses as synthesis
  set reconciled_profile = synthesis.reconciled_profile || jsonb_build_object('mapRecord', v_map_record)
  where synthesis.id = p_synthesis_id;

  insert into public.event_source_synthesis_actions (
    synthesis_id,
    bundle_id,
    action_type,
    from_status,
    to_status,
    actor_identity,
    notes,
    metadata
  ) values (
    p_synthesis_id,
    v_bundle_id,
    'map_record_attached',
    v_status,
    v_status,
    p_actor_identity,
    nullif(btrim(p_notes), ''),
    jsonb_build_object('mapRecord', v_map_record)
  );

  return query select p_synthesis_id, v_bundle_id, v_status, v_map_record, v_updated_at;
end;
$$;

revoke execute on function public.atlas_attach_source_synthesis_map_record(uuid, jsonb, text, text) from public, anon, authenticated;
grant execute on function public.atlas_attach_source_synthesis_map_record(uuid, jsonb, text, text) to service_role;
