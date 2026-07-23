begin;

-- Audit the roles that own Celebration Atlas objects in public. These are the
-- roles whose default privileges can affect objects created by migrations.
create temporary table atlas_public_object_creator_roles
on commit drop
as
select distinct owner_role.oid as role_oid, owner_role.rolname as role_name
from (
  select relation.relowner as owner_oid
  from pg_catalog.pg_class as relation
  join pg_catalog.pg_namespace as namespace
    on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind in ('r', 'p', 'v', 'm', 'f', 'S')
    and not exists (
      select 1
      from pg_catalog.pg_depend as dependency
      where dependency.classid = 'pg_catalog.pg_class'::regclass
        and dependency.objid = relation.oid
        and dependency.deptype = 'e'
    )

  union

  select routine.proowner as owner_oid
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
) as application_owner
join pg_catalog.pg_roles as owner_role
  on owner_role.oid = application_owner.owner_oid;

do $migration$
begin
  if not exists (select 1 from atlas_public_object_creator_roles) then
    raise exception 'Security guardrail failed: no public application object creator role was found';
  end if;
end
$migration$;

-- PostgreSQL's built-in routine defaults grant EXECUTE to PUBLIC. Supabase also
-- supplies schema-scoped browser-role defaults. Remove both global and public
-- schema browser defaults for every role that creates Celebration Atlas
-- objects. Existing and default service_role privileges are not changed.
do $migration$
declare
  creator record;
begin
  for creator in
    select role_name
    from atlas_public_object_creator_roles
    order by role_name
  loop
    execute format(
      'alter default privileges for role %I revoke execute on functions from public, anon, authenticated',
      creator.role_name
    );
    execute format(
      'alter default privileges for role %I in schema public revoke execute on functions from public, anon, authenticated',
      creator.role_name
    );
    execute format(
      'alter default privileges for role %I revoke all privileges on tables from public, anon, authenticated',
      creator.role_name
    );
    execute format(
      'alter default privileges for role %I in schema public revoke all privileges on tables from public, anon, authenticated',
      creator.role_name
    );
  end loop;
end
$migration$;

-- Fail closed if any creator role still gives browsers default access, or if a
-- later edit has reintroduced an unsafe live public object before deployment.
do $migration$
begin
  if exists (
    select 1
    from atlas_public_object_creator_roles as creator
    join pg_catalog.pg_default_acl as default_acl
      on default_acl.defaclrole = creator.role_oid
    left join pg_catalog.pg_namespace as namespace
      on namespace.oid = default_acl.defaclnamespace
    cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) as privilege
    where default_acl.defaclobjtype = 'f'
      and (default_acl.defaclnamespace = 0 or namespace.nspname = 'public')
      and privilege.privilege_type = 'EXECUTE'
      and (
        privilege.grantee = 0
        or privilege.grantee in (
          select role.oid
          from pg_catalog.pg_roles as role
          where role.rolname in ('anon', 'authenticated')
        )
      )
  ) then
    raise exception 'Security guardrail failed: a migration creator role still grants default routine execution to a browser role';
  end if;

  if exists (
    select 1
    from atlas_public_object_creator_roles as creator
    join pg_catalog.pg_default_acl as default_acl
      on default_acl.defaclrole = creator.role_oid
    left join pg_catalog.pg_namespace as namespace
      on namespace.oid = default_acl.defaclnamespace
    cross join lateral pg_catalog.aclexplode(default_acl.defaclacl) as privilege
    where default_acl.defaclobjtype = 'r'
      and (default_acl.defaclnamespace = 0 or namespace.nspname = 'public')
      and (
        privilege.grantee = 0
        or privilege.grantee in (
          select role.oid
          from pg_catalog.pg_roles as role
          where role.rolname in ('anon', 'authenticated')
        )
      )
  ) then
    raise exception 'Security guardrail failed: a migration creator role still grants default table privileges to a browser role';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and not relation.relrowsecurity
  ) then
    raise exception 'Security guardrail failed: a public table lacks RLS';
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
        or pg_catalog.has_function_privilege('anon', routine.oid, 'EXECUTE')
        or pg_catalog.has_function_privilege('authenticated', routine.oid, 'EXECUTE')
      )
  ) then
    raise exception 'Security guardrail failed: an application routine is browser-executable';
  end if;
end
$migration$;

commit;
