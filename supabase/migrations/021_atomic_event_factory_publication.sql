-- Make Event Factory public activation one transactional boundary.
-- Apply after migration 020.

create or replace function public.atlas_guard_event_factory_page_activation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status <> 'published'
     and new.status = 'published'
     and exists (
       select 1
       from public.event_factory_packages as package
       join public.event_pages as page
         on page.id = new.event_page_id
        and page.event_id = package.event_id
       where package.page_manifest = new.manifest
         and package.status <> 'published'
     ) then
    raise exception 'Event Factory page versions must be activated with their published package.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists event_factory_page_activation_guard
  on public.event_page_versions;
create trigger event_factory_page_activation_guard
before update of status on public.event_page_versions
for each row
execute function public.atlas_guard_event_factory_page_activation();

create or replace function public.atlas_activate_event_factory_publication(
  p_package_id uuid,
  p_version_id uuid,
  p_media_id uuid,
  p_actor_identity text,
  p_notes text
)
returns table (
  package_id uuid,
  status text,
  event_id uuid,
  version_id uuid,
  media_id uuid,
  previous_version_id uuid,
  activated boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
  v_page public.event_pages%rowtype;
  v_version public.event_page_versions%rowtype;
  v_media public.event_media%rowtype;
  v_previous_version_id uuid;
  v_published_at timestamptz := now();
  v_expected_media_url text;
begin
  perform public.atlas_assert_service_role();

  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_package_id is null or p_version_id is null or p_media_id is null then
    raise exception 'Package, Event Hub version, and media identifiers are required.'
      using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;
  if v_package.event_id is null then
    raise exception 'A materialized canonical event is required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'event-factory-publication:' || v_package.event_id::text,
      0
    )
  );

  select version.* into v_version
  from public.event_page_versions as version
  where version.id = p_version_id
  for update;
  if not found then
    raise exception 'Event Hub version was not found.' using errcode = 'P0002';
  end if;

  select page.* into v_page
  from public.event_pages as page
  where page.id = v_version.event_page_id
  for update;
  if not found then
    raise exception 'Event Hub page was not found.' using errcode = 'P0002';
  end if;

  select media.* into v_media
  from public.event_media as media
  where media.id = p_media_id
  for update;
  if not found then
    raise exception 'Approved package media was not found.' using errcode = 'P0002';
  end if;

  v_expected_media_url := coalesce(
    nullif(v_package.art_asset->>'publicUrl', ''),
    nullif(v_package.art_asset->>'src', '')
  );

  if v_page.event_id <> v_package.event_id
     or v_page.event_key <> v_package.event_key
     or v_page.slug <> v_package.slug then
    raise exception 'Event Hub page and package identities do not match.'
      using errcode = '22023';
  end if;
  if v_version.event_page_id <> v_page.id
     or v_version.manifest is distinct from v_package.page_manifest
     or v_version.manifest->>'eventId' is distinct from v_package.event_key
     or v_version.manifest->>'slug' is distinct from v_package.slug then
    raise exception 'Event Hub version does not contain the frozen package manifest.'
      using errcode = '22023';
  end if;
  if v_media.event_id <> v_package.event_id
     or v_media.media_role <> 'hero'
     or v_media.status <> 'approved'
     or v_expected_media_url is null
     or v_media.public_url is distinct from v_expected_media_url then
    raise exception 'Approved media does not match the frozen package art.'
      using errcode = '22023';
  end if;

  if v_package.status = 'published' then
    if v_page.published_version_id <> p_version_id
       or v_version.status <> 'published' then
      raise exception 'Published package replay does not match the active Event Hub version.'
        using errcode = '22023';
    end if;

    return query
      select
        v_package.id,
        v_package.status,
        v_package.event_id,
        v_version.id,
        v_media.id,
        null::uuid,
        false;
    return;
  end if;

  if v_package.status <> 'publishing'
     or v_package.readiness_score <> 1
     or v_package.reviewed_by is null then
    raise exception 'Only a complete, reviewed, publishing package can be activated.'
      using errcode = '22023';
  end if;
  if v_version.status <> 'approved' or not v_version.is_valid then
    raise exception 'Only an approved, valid Event Hub version can be activated.'
      using errcode = '22023';
  end if;

  if v_package.supersedes_package_id is not null
     and v_package.supersedes_package_id is distinct from (
       select prior.id
       from public.event_factory_packages as prior
       where prior.candidate_id = v_package.candidate_id
         and prior.target_year = v_package.target_year
         and prior.status = 'published'
       order by prior.published_at desc nulls last, prior.id desc
       limit 1
     ) then
    raise exception 'A revision can replace only the latest published package.'
      using errcode = '22023';
  end if;

  v_previous_version_id := v_page.published_version_id;

  -- The package changes first so the trigger below can distinguish this
  -- transaction from an independent Event Page publication. Nothing is
  -- externally visible until the transaction commits.
  update public.event_factory_packages
    set status = 'published',
        published_by = pg_catalog.btrim(p_actor_identity),
        published_at = v_published_at,
        review_notes = coalesce(
          nullif(pg_catalog.btrim(p_notes), ''),
          review_notes
        ),
        updated_at = v_published_at
  where id = v_package.id;

  if v_previous_version_id is not null
     and v_previous_version_id <> p_version_id then
    update public.event_page_versions as version
      set status = 'archived'
    where version.id = v_previous_version_id
      and version.event_page_id = v_page.id
      and version.status = 'published';

    if found then
      insert into public.event_page_version_transitions (
        version_id,
        from_status,
        to_status,
        actor_identity,
        notes
      ) values (
        v_previous_version_id,
        'published',
        'archived',
        pg_catalog.btrim(p_actor_identity),
        'Replaced by Event Factory page version ' || v_version.version_number::text
      );
    end if;
  end if;

  update public.event_page_versions as version
    set status = 'published',
        published_by = pg_catalog.btrim(p_actor_identity),
        published_at = v_published_at
  where version.id = p_version_id
    and version.status = 'approved'
    and version.is_valid = true;
  if not found then
    raise exception 'Event Hub version activation lost its approved state.'
      using errcode = '40001';
  end if;

  insert into public.event_page_version_transitions (
    version_id,
    from_status,
    to_status,
    actor_identity,
    notes
  ) values (
    p_version_id,
    'approved',
    'published',
    pg_catalog.btrim(p_actor_identity),
    nullif(pg_catalog.btrim(p_notes), '')
  );

  update public.event_pages as page
    set published_version_id = p_version_id,
        updated_at = v_published_at
  where page.id = v_page.id;

  insert into public.event_factory_package_actions (
    package_id,
    action_type,
    actor_identity,
    from_status,
    to_status,
    notes,
    metadata
  ) values (
    v_package.id,
    'published',
    pg_catalog.btrim(p_actor_identity),
    'publishing',
    'published',
    nullif(pg_catalog.btrim(p_notes), ''),
    jsonb_build_object(
      'event_id', v_package.event_id,
      'event_page_version_id', p_version_id,
      'event_media_id', p_media_id,
      'previous_event_page_version_id', v_previous_version_id
    )
  );

  return query
    select
      v_package.id,
      'published'::text,
      v_package.event_id,
      v_version.id,
      v_media.id,
      v_previous_version_id,
      true;
end;
$$;

-- Failure finalization remains available for the server catch path, but success
-- must use atlas_activate_event_factory_publication so page and package state
-- cannot commit independently.
create or replace function public.atlas_finish_event_factory_publication(
  p_package_id uuid,
  p_succeeded boolean,
  p_actor_identity text,
  p_notes text
)
returns table (
  package_id uuid,
  status text,
  event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
begin
  perform public.atlas_assert_service_role();

  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_succeeded then
    raise exception 'Successful publication requires the atomic Event Factory activation RPC.'
      using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;

  if v_package.status = 'failed' then
    return query select v_package.id, v_package.status, v_package.event_id;
    return;
  end if;
  if v_package.status <> 'publishing' then
    raise exception 'Only publishing packages can be marked failed.'
      using errcode = '22023';
  end if;

  update public.event_factory_packages
    set status = 'failed',
        review_notes = coalesce(
          nullif(pg_catalog.btrim(p_notes), ''),
          review_notes
        ),
        updated_at = now()
  where id = v_package.id;

  insert into public.event_factory_package_actions (
    package_id,
    action_type,
    actor_identity,
    from_status,
    to_status,
    notes
  ) values (
    v_package.id,
    'publication_failed',
    pg_catalog.btrim(p_actor_identity),
    'publishing',
    'failed',
    nullif(pg_catalog.btrim(p_notes), '')
  );

  return query select v_package.id, 'failed'::text, v_package.event_id;
end;
$$;

-- A factory-backed pointer is public only when the exact frozen package is
-- published. Standalone Event Page versions and checked-in fallbacks keep their
-- existing behavior because they have no matching factory package.
create or replace function public.atlas_get_published_event_page(p_identifier text)
returns table (
  event_key text,
  slug text,
  version_id uuid,
  version_number integer,
  manifest jsonb,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    page.event_key,
    page.slug,
    version.id,
    version.version_number,
    version.manifest,
    version.published_at
  from public.event_pages as page
  join public.event_page_versions as version
    on version.id = page.published_version_id
   and version.event_page_id = page.id
   and version.status = 'published'
  where (page.event_key = p_identifier or page.slug = p_identifier)
    and (
      not exists (
        select 1
        from public.event_factory_packages as package
        where package.event_id = page.event_id
          and package.page_manifest = version.manifest
      )
      or exists (
        select 1
        from public.event_factory_packages as package
        where package.event_id = page.event_id
          and package.page_manifest = version.manifest
          and package.status = 'published'
      )
    )
  limit 1;
$$;

revoke all on function public.atlas_guard_event_factory_page_activation()
  from public, anon, authenticated;
revoke all on function public.atlas_activate_event_factory_publication(uuid, uuid, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_finish_event_factory_publication(uuid, boolean, text, text)
  from public, anon, authenticated;
revoke all on function public.atlas_get_published_event_page(text)
  from public, anon, authenticated;

grant execute on function public.atlas_activate_event_factory_publication(uuid, uuid, uuid, text, text)
  to service_role;
grant execute on function public.atlas_finish_event_factory_publication(uuid, boolean, text, text)
  to service_role;
grant execute on function public.atlas_get_published_event_page(text)
  to service_role;

comment on function public.atlas_activate_event_factory_publication(uuid, uuid, uuid, text, text) is
  'Atomically activates an approved Event Hub version and finalizes its reviewed Event Factory package after verifying approved hero media.';
