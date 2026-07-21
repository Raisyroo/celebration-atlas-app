begin;

-- Access audit (2026-07-21):
--
-- * Browser clients use the anon key only for Supabase Auth. They do not query
--   or mutate public-schema relations.
-- * Public Atlas and Event Hub pages read reviewed data from server-only code
--   with the service-role client.
-- * Atlas Control authenticates an allowlisted administrator in its server
--   routes, then performs database reads and mutations with the service role
--   and the fixed atlas_* RPCs.
-- * No application code references the legacy festival_* intelligence tables
--   or the festival_overview view.
--
-- The least-privilege policy set is therefore intentionally empty for anon
-- and authenticated. RLS's no-policy behavior is default deny. Granting direct
-- authenticated writes would grant them to every signed-in user, not just an
-- ATLAS_ADMIN_EMAILS allowlisted operator, and would bypass the existing
-- server authorization boundary.

-- PUBLIC grants can contribute to the service role's effective privileges.
-- Snapshot those privileges before removing browser-role access, then restore
-- the same effective privileges explicitly so service-role behavior is
-- unchanged. The fixed list is the complete PostgreSQL 17 table privilege set.
create temporary table atlas_service_table_privileges
on commit drop
as
select
  namespace.nspname as schema_name,
  relation.relname as relation_name,
  privilege.privilege_type
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
cross join (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('DELETE'),
    ('TRUNCATE'),
    ('REFERENCES'),
    ('TRIGGER'),
    ('MAINTAIN')
) as privilege(privilege_type)
where namespace.nspname = 'public'
  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  and pg_catalog.has_table_privilege(
    'service_role',
    relation.oid,
    privilege.privilege_type
  );

-- Preserve any effective service-role column grants that are not already
-- covered by a table-level privilege.
create temporary table atlas_service_column_privileges
on commit drop
as
select
  namespace.nspname as schema_name,
  relation.relname as relation_name,
  attribute.attname as column_name,
  privilege.privilege_type
from pg_catalog.pg_class as relation
join pg_catalog.pg_namespace as namespace
  on namespace.oid = relation.relnamespace
join pg_catalog.pg_attribute as attribute
  on attribute.attrelid = relation.oid
cross join (
  values
    ('SELECT'),
    ('INSERT'),
    ('UPDATE'),
    ('REFERENCES')
) as privilege(privilege_type)
where namespace.nspname = 'public'
  and relation.relkind in ('r', 'p', 'v', 'm', 'f')
  and attribute.attnum > 0
  and not attribute.attisdropped
  and pg_catalog.has_column_privilege(
    'service_role',
    relation.oid,
    attribute.attnum,
    privilege.privilege_type
  )
  and not pg_catalog.has_table_privilege(
    'service_role',
    relation.oid,
    privilege.privilege_type
  );

-- Preserve the service role's effective EXECUTE privilege on every public
-- application and extension routine. Extension-owned routines are recorded for
-- the final invariant check but are otherwise left unchanged. The stale
-- atlas_record_event_verification function is deliberately excluded because it
-- is removed below.
create temporary table atlas_service_routine_privileges
on commit drop
as
select
  routine.oid as routine_oid,
  namespace.nspname as schema_name,
  routine.proname as routine_name,
  pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments,
  exists (
    select 1
    from pg_catalog.pg_depend as dependency
    where dependency.classid = 'pg_catalog.pg_proc'::regclass
      and dependency.objid = routine.oid
      and dependency.deptype = 'e'
  ) as is_extension_owned
from pg_catalog.pg_proc as routine
join pg_catalog.pg_namespace as namespace
  on namespace.oid = routine.pronamespace
where namespace.nspname = 'public'
  and routine.prokind in ('f', 'p', 'w')
  and routine.proname <> 'atlas_record_event_verification'
  and pg_catalog.has_function_privilege(
    'service_role',
    routine.oid,
    'EXECUTE'
  );

-- Enable RLS on every current public base or partitioned table. This includes
-- legacy tables created before the checked-in migration history as well as the
-- Event Factory tables that already have RLS enabled.
do $migration$
declare
  target record;
begin
  for target in
    select namespace.nspname as schema_name, relation.relname as table_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
    order by relation.relname
  loop
    execute format(
      'alter table %I.%I enable row level security',
      target.schema_name,
      target.table_name
    );
  end loop;
end
$migration$;

-- Remove historical policies before establishing the audited default-deny
-- posture. Service-role requests continue to bypass RLS as before.
do $migration$
declare
  target record;
begin
  for target in
    select schemaname, tablename, policyname
    from pg_catalog.pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  loop
    execute format(
      'drop policy %I on %I.%I',
      target.policyname,
      target.schemaname,
      target.tablename
    );
  end loop;
end
$migration$;

-- Remove relation and column privileges inherited through PUBLIC or granted
-- directly to the two Data API browser roles. REVOKE on a table also removes
-- that grantee's column privileges on the table.
revoke all privileges on all tables in schema public
from public, anon, authenticated;

-- festival_overview is retained for compatibility, but it must not evaluate
-- its underlying legacy festival relations with the view owner's privileges.
-- PostgreSQL calls this a security-invoker view. Guard the ALTER so the
-- migration also remains replayable in environments that lack the legacy view.
do $migration$
begin
  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'festival_overview'
      and relation.relkind = 'v'
  ) then
    alter view public.festival_overview set (security_invoker = true);
  end if;
end
$migration$;

-- Restore exactly the service role's pre-migration effective table privileges.
do $migration$
declare
  preserved record;
begin
  for preserved in
    select schema_name, relation_name, privilege_type
    from atlas_service_table_privileges
    order by schema_name, relation_name, privilege_type
  loop
    execute format(
      'grant %s on table %I.%I to service_role',
      preserved.privilege_type,
      preserved.schema_name,
      preserved.relation_name
    );
  end loop;
end
$migration$;

-- Restore any service-role privileges that existed only at column scope.
do $migration$
declare
  preserved record;
begin
  for preserved in
    select schema_name, relation_name, column_name, privilege_type
    from atlas_service_column_privileges
    order by schema_name, relation_name, column_name, privilege_type
  loop
    execute format(
      'grant %s (%I) on table %I.%I to service_role',
      preserved.privilege_type,
      preserved.column_name,
      preserved.schema_name,
      preserved.relation_name
    );
  end loop;
end
$migration$;

-- atlas_record_event_verification belongs to the superseded pre-Event-Factory
-- verification model. It references public.event_verifications, which does not
-- exist, has no application or routine callers, and has been replaced by the
-- event_verification_cases/evidence/actions workflow. Drop every overload with
-- RESTRICT so an unexpected dependency aborts and rolls back the migration.
do $migration$
declare
  stale record;
begin
  for stale in
    select
      namespace.nspname as schema_name,
      routine.proname as routine_name,
      pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'atlas_record_event_verification'
      and routine.prokind in ('f', 'p', 'w')
  loop
    execute format(
      'drop routine %I.%I(%s) restrict',
      stale.schema_name,
      stale.routine_name,
      stale.identity_arguments
    );
  end loop;
end
$migration$;

-- Revoke browser execution from every application-owned public routine. Do not
-- change routines installed by extensions such as vector: those are type and
-- operator support functions, not Celebration Atlas RPCs.
do $migration$
declare
  target record;
begin
  for target in
    select
      namespace.nspname as schema_name,
      routine.proname as routine_name,
      pg_catalog.pg_get_function_identity_arguments(routine.oid) as identity_arguments
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.prokind in ('f', 'p', 'w')
      and not exists (
        select 1
        from pg_catalog.pg_depend as dependency
        where dependency.classid = 'pg_catalog.pg_proc'::regclass
          and dependency.objid = routine.oid
          and dependency.deptype = 'e'
      )
    order by routine.proname, routine.oid
  loop
    execute format(
      'revoke execute on routine %I.%I(%s) from public, anon, authenticated',
      target.schema_name,
      target.routine_name,
      target.identity_arguments
    );

    -- Every audited application routine uses schema-qualified application
    -- objects, so an empty search path preserves behavior and removes object
    -- shadowing risk from SECURITY DEFINER and trigger functions alike.
    execute format(
      'alter routine %I.%I(%s) set search_path = %L',
      target.schema_name,
      target.routine_name,
      target.identity_arguments,
      ''
    );
  end loop;
end
$migration$;

-- Restore exactly the application routines the service role could execute
-- before the migration. Extension routines were not modified.
do $migration$
declare
  preserved record;
begin
  for preserved in
    select schema_name, routine_name, identity_arguments
    from atlas_service_routine_privileges
    where not is_extension_owned
    order by schema_name, routine_name, identity_arguments
  loop
    execute format(
      'grant execute on routine %I.%I(%s) to service_role',
      preserved.schema_name,
      preserved.routine_name,
      preserved.identity_arguments
    );
  end loop;
end
$migration$;

-- Fail closed if a future schema shape prevents complete coverage.
do $migration$
begin
  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ) then
    raise exception 'RLS hardening failed: at least one public table does not have RLS enabled';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join (values ('anon'), ('authenticated')) as app_role(role_name)
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p', 'v', 'm', 'f')
      and (
        pg_catalog.has_table_privilege(
          app_role.role_name,
          relation.oid,
          'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER, MAINTAIN'
        )
        or pg_catalog.has_any_column_privilege(
          app_role.role_name,
          relation.oid,
          'SELECT, INSERT, UPDATE, REFERENCES'
        )
      )
  ) then
    raise exception 'RLS hardening failed: anon or authenticated retains public relation privileges';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policy as policy
    join pg_catalog.pg_class as relation
      on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
  ) then
    raise exception 'RLS hardening failed: an unaudited public-schema policy remains';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.prokind in ('f', 'p', 'w')
      and not exists (
        select 1
        from pg_catalog.pg_depend as dependency
        where dependency.classid = 'pg_catalog.pg_proc'::regclass
          and dependency.objid = routine.oid
          and dependency.deptype = 'e'
      )
      and (
        exists (
          select 1
          from pg_catalog.aclexplode(
            coalesce(
              routine.proacl,
              pg_catalog.acldefault('f', routine.proowner)
            )
          ) as privilege
          where privilege.grantee = 0
            and privilege.privilege_type = 'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'anon',
          routine.oid,
          'EXECUTE'
        )
        or pg_catalog.has_function_privilege(
          'authenticated',
          routine.oid,
          'EXECUTE'
        )
      )
  ) then
    raise exception 'RLS hardening failed: PUBLIC, anon, or authenticated retains application routine execution';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.prokind in ('f', 'p', 'w')
      and not exists (
        select 1
        from pg_catalog.pg_depend as dependency
        where dependency.classid = 'pg_catalog.pg_proc'::regclass
          and dependency.objid = routine.oid
          and dependency.deptype = 'e'
      )
      and not coalesce(
        routine.proconfig @> array['search_path=""'],
        false
      )
  ) then
    raise exception 'RLS hardening failed: an application routine retains a nonempty search path';
  end if;

  if exists (
    select 1
    from atlas_service_routine_privileges as preserved
    where not pg_catalog.has_function_privilege(
      'service_role',
      preserved.routine_oid,
      'EXECUTE'
    )
  ) then
    raise exception 'RLS hardening failed: a service-role routine privilege was not preserved';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_proc as routine
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = routine.pronamespace
    where namespace.nspname = 'public'
      and routine.proname = 'atlas_record_event_verification'
  ) then
    raise exception 'RLS hardening failed: stale atlas_record_event_verification remains';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'festival_overview'
      and relation.relkind = 'v'
      and not coalesce(
        relation.reloptions @> array['security_invoker=true'],
        false
      )
  ) then
    raise exception 'RLS hardening failed: festival_overview is not security invoker';
  end if;
end
$migration$;

commit;
