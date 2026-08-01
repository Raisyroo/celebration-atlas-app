-- Forward-only correction for migration 031: qualify the schedule-candidate
-- replay target by its unique constraint so PL/pgSQL output-column names cannot
-- collide with ON CONFLICT inference.

begin;

create or replace function public.atlas_reprocess_event_source_schedule(
  p_snapshot_id uuid,
  p_expected_content_hash text,
  p_schedule_items jsonb,
  p_parser_version text,
  p_actor_identity text
)
returns table (
  snapshot_id uuid,
  bundle_id uuid,
  created_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_id uuid;
  v_content_hash text;
  v_bundle_status text;
  v_created_count integer := 0;
begin
  perform public.atlas_assert_service_role();

  if p_snapshot_id is null then
    raise exception 'A retained source snapshot is required.' using errcode = '22023';
  end if;
  if p_expected_content_hash is null
     or p_expected_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'The exact retained source SHA-256 is required.' using errcode = '22023';
  end if;
  if p_parser_version is null
     or char_length(btrim(p_parser_version)) not between 1 and 100
     or p_parser_version !~ '^[a-z0-9][a-z0-9._-]*$' then
    raise exception 'A bounded parser version is required.' using errcode = '22023';
  end if;
  if p_actor_identity is null
     or char_length(btrim(p_actor_identity)) not between 1 and 320 then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_schedule_items) is distinct from 'array' then
    raise exception 'Deterministic schedule items must be a JSON array.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_schedule_items) not between 1 and 400 then
    raise exception 'One to 400 deterministic schedule items are required.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_schedule_items) as item
    where coalesce(item->>'dedupeKey', '') !~ '^[0-9a-f]{64}$'
       or char_length(coalesce(item->>'title', '')) not between 1 and 300
       or coalesce(item->>'confidence', '') not in ('unknown', 'low', 'medium', 'high', 'verified')
       or jsonb_typeof(coalesce(item->'tags', '[]'::jsonb)) is distinct from 'array'
       or (
         jsonb_typeof(coalesce(item->'tags', '[]'::jsonb)) = 'array'
         and jsonb_array_length(coalesce(item->'tags', '[]'::jsonb)) > 20
       )
       or jsonb_typeof(coalesce(item->'sourceLocator', '{}'::jsonb)) is distinct from 'object'
       or char_length(coalesce(item->>'venue', '')) > 220
       or char_length(coalesce(item->>'category', '')) > 80
       or char_length(coalesce(item->>'details', '')) > 600
  ) then
    raise exception 'A deterministic schedule item has an invalid shape.' using errcode = '22023';
  end if;

  select snapshot.bundle_id, snapshot.content_hash, bundle.status
    into v_bundle_id, v_content_hash, v_bundle_status
  from public.event_source_snapshots as snapshot
  join public.event_source_bundles as bundle on bundle.id = snapshot.bundle_id
  where snapshot.id = p_snapshot_id
  for update of bundle;

  if v_bundle_id is null then
    raise exception 'The retained source snapshot was not found.' using errcode = 'P0002';
  end if;
  if v_content_hash is distinct from p_expected_content_hash then
    raise exception 'The retained source content hash does not match.' using errcode = 'P0001';
  end if;
  if v_bundle_status <> 'collecting' then
    raise exception 'Schedule candidates can be reprocessed only while the source bundle is collecting.' using errcode = 'P0001';
  end if;

  insert into public.event_schedule_candidates (
    bundle_id,
    source_snapshot_id,
    dedupe_key,
    title,
    starts_at,
    ends_at,
    date_text,
    timezone,
    venue,
    category,
    tags,
    details,
    confidence,
    confidence_score,
    source_locator,
    payload
  )
  select
    v_bundle_id,
    p_snapshot_id,
    item->>'dedupeKey',
    left(item->>'title', 300),
    nullif(item->>'startsAt', '')::timestamptz,
    nullif(item->>'endsAt', '')::timestamptz,
    nullif(item->>'dateText', ''),
    nullif(item->>'timezone', ''),
    nullif(item->>'venue', ''),
    nullif(item->>'category', ''),
    case
      when jsonb_typeof(item->'tags') = 'array'
        then array(select jsonb_array_elements_text(item->'tags'))
      else '{}'
    end,
    nullif(item->>'details', ''),
    item->>'confidence',
    nullif(item->>'confidenceScore', '')::numeric,
    coalesce(item->'sourceLocator', '{}'::jsonb) || jsonb_build_object(
      'reprocessedFromSnapshot', p_snapshot_id,
      'parserVersion', p_parser_version
    ),
    item
  from jsonb_array_elements(p_schedule_items) as item
  on conflict on constraint event_schedule_candidates_bundle_id_dedupe_key_key do nothing;
  get diagnostics v_created_count = row_count;

  update public.event_source_bundles
  set updated_at = now()
  where id = v_bundle_id;

  insert into public.event_source_bundle_actions (
    bundle_id,
    action_type,
    actor_identity,
    notes,
    metadata
  ) values (
    v_bundle_id,
    'schedule_reprocessed',
    btrim(p_actor_identity),
    'Attached newly derived deterministic schedule candidates to an immutable retained source snapshot.',
    jsonb_build_object(
      'snapshot_id', p_snapshot_id,
      'content_hash', p_expected_content_hash,
      'parser_version', p_parser_version,
      'provided_count', jsonb_array_length(p_schedule_items),
      'created_count', v_created_count
    )
  );

  return query select p_snapshot_id, v_bundle_id, v_created_count;
end;
$$;

revoke all on function public.atlas_reprocess_event_source_schedule(uuid, text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.atlas_reprocess_event_source_schedule(uuid, text, jsonb, text, text)
  to service_role;

commit;
