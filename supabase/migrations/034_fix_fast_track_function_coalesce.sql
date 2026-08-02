-- Correct the schema-qualified COALESCE special form in migration 033's two
-- function bodies. The definitions are retained exactly otherwise.

begin;

do $$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef(
    'public.atlas_clear_fast_track_candidate_identity(uuid,uuid,text,text,text)'::pg_catalog.regprocedure
  ) into v_definition;
  execute pg_catalog.replace(v_definition, 'pg_catalog.coalesce', 'coalesce');

  select pg_catalog.pg_get_functiondef(
    'public.atlas_event_factory_content_ready_v2(jsonb)'::pg_catalog.regprocedure
  ) into v_definition;
  execute pg_catalog.replace(v_definition, 'pg_catalog.coalesce', 'coalesce');
end;
$$;

commit;
