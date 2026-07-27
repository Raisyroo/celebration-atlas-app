-- Allow the separately approved three-event pilot scope without weakening any
-- migration-018 staging guard. This migration intentionally replaces only the
-- exact manifest-disposition predicate in the deployed wrapper definition.

do $migration$
declare
  v_function regprocedure := to_regprocedure(
    'public.atlas_stage_county_seed_candidate(text,text,text,text,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old_scope_check constant text := $old$
  if not jsonb_path_exists(
    p_candidate,
    '$.county_seed.resolved_decision ? (@.phase_c1_disposition == "provisional_batch_1_manifest_only")'
  ) then
    raise exception 'County staging requires the reviewed Batch 1 disposition.' using errcode = '22023';
  end if;$old$;
  v_new_scope_check constant text := $new$
  if coalesce(
    p_candidate #>> '{county_seed,resolved_decision,phase_c1_disposition}',
    ''
  ) not in (
    'provisional_batch_1_manifest_only',
    'revised_three_event_pilot_manifest_only'
  ) then
    raise exception 'County staging requires an approved county-seed manifest disposition.'
      using errcode = '22023';
  end if;$new$;
  v_match_count integer;
begin
  if v_function is null then
    raise exception 'Migration 019 requires the migration-018 county staging RPC.'
      using errcode = '55000';
  end if;

  select pg_get_functiondef(v_function)
    into v_definition;

  v_match_count := (
    length(v_definition) - length(replace(v_definition, v_old_scope_check, ''))
  ) / length(v_old_scope_check);

  if v_match_count <> 1 then
    raise exception
      'Migration 019 expected exactly one migration-018 manifest-scope predicate; found %.',
      v_match_count
      using errcode = '55000';
  end if;

  if position('revised_three_event_pilot_manifest_only' in v_definition) > 0 then
    raise exception 'Migration 019 compatibility scope is already present.'
      using errcode = '55000';
  end if;

  v_definition := replace(v_definition, v_old_scope_check, v_new_scope_check);
  execute v_definition;

  select pg_get_functiondef(v_function)
    into v_definition;

  if position('provisional_batch_1_manifest_only' in v_definition) = 0
     or position('revised_three_event_pilot_manifest_only' in v_definition) = 0
     or position('approved county-seed manifest disposition' in v_definition) = 0
     or position(v_old_scope_check in v_definition) > 0 then
    raise exception 'Migration 019 failed to install the exact two-value scope contract.'
      using errcode = '55000';
  end if;
end;
$migration$;

revoke execute on function public.atlas_stage_county_seed_candidate(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) from public, anon, authenticated;

grant execute on function public.atlas_stage_county_seed_candidate(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) to service_role;
