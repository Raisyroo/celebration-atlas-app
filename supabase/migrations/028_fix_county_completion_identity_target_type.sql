-- Correct the county-completion identity-clearance replay lookup to compare
-- the deployed UUID action target with the UUID candidate parameter.

begin;

do $migration$
declare
  v_function regprocedure := to_regprocedure(
    'public.atlas_clear_county_completion_candidate_identity(uuid,uuid,text,text,text)'
  );
  v_definition text;
  v_old_comparison constant text :=
    'action.target_entity_id = p_candidate_id::text';
  v_new_comparison constant text :=
    'action.target_entity_id = p_candidate_id';
  v_match_count integer;
begin
  if v_function is null then
    raise exception
      'Migration 028 requires the county-completion identity-clearance RPC.'
      using errcode = '55000';
  end if;

  select pg_get_functiondef(v_function)
    into v_definition;

  v_match_count := (
    length(v_definition) - length(replace(v_definition, v_old_comparison, ''))
  ) / length(v_old_comparison);
  if v_match_count <> 1 then
    raise exception
      'Migration 028 expected exactly one text-cast identity target comparison; found %.',
      v_match_count
      using errcode = '55000';
  end if;

  v_definition := replace(
    v_definition,
    v_old_comparison,
    v_new_comparison
  );
  execute v_definition;

  select pg_get_functiondef(v_function)
    into v_definition;
  if position(v_old_comparison in v_definition) > 0
     or position(v_new_comparison in v_definition) = 0 then
    raise exception
      'Migration 028 failed to install the UUID identity target comparison.'
      using errcode = '55000';
  end if;
end;
$migration$;

revoke all on function public.atlas_clear_county_completion_candidate_identity(
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.atlas_clear_county_completion_candidate_identity(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

comment on function public.atlas_clear_county_completion_candidate_identity(
  uuid,
  uuid,
  text,
  text,
  text
) is
  'Clears only a reviewed private county candidate whose exact deterministic identity has no collision; compares UUID action targets without canonicalizing, merging, or publishing.';

commit;
