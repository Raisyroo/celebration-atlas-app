-- Event Hub page publishing foundation.
-- Apply after migration 004 (Atlas Control Plane).

create table public.event_pages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null unique references public.events(id) on delete cascade,
  event_key text not null unique check (event_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_page_versions (
  id uuid primary key default gen_random_uuid(),
  event_page_id uuid not null references public.event_pages(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  schema_version integer not null check (schema_version > 0),
  status text not null default 'draft' check (
    status in ('draft', 'in_review', 'approved', 'published', 'rejected', 'archived')
  ),
  manifest jsonb not null check (jsonb_typeof(manifest) = 'object'),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  is_valid boolean not null default false,
  validation_report jsonb not null default '{"errors":[],"warnings":[]}'::jsonb,
  source_kind text not null default 'operator' check (
    source_kind in ('local_seed', 'operator', 'import', 'ai_assisted')
  ),
  change_summary text,
  review_notes text,
  created_by text not null,
  reviewed_by text,
  published_by text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  published_at timestamptz,
  unique (event_page_id, version_number),
  unique (event_page_id, content_hash)
);

alter table public.event_pages
  add constraint event_pages_published_version_fk
  foreign key (published_version_id)
  references public.event_page_versions(id)
  on delete set null
  deferrable initially deferred;

create table public.event_page_version_transitions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.event_page_versions(id) on delete cascade,
  from_status text check (
    from_status is null or from_status in ('draft', 'in_review', 'approved', 'published', 'rejected', 'archived')
  ),
  to_status text not null check (
    to_status in ('draft', 'in_review', 'approved', 'published', 'rejected', 'archived')
  ),
  actor_identity text not null,
  notes text,
  created_at timestamptz not null default now()
);

create unique index event_page_versions_one_published
  on public.event_page_versions (event_page_id)
  where status = 'published';

create index event_page_versions_page_created
  on public.event_page_versions (event_page_id, created_at desc);

create index event_page_version_transitions_version_created
  on public.event_page_version_transitions (version_id, created_at desc);

alter table public.event_pages enable row level security;
alter table public.event_page_versions enable row level security;
alter table public.event_page_version_transitions enable row level security;

revoke all on table public.event_pages from public, anon, authenticated, service_role;
revoke all on table public.event_page_versions from public, anon, authenticated, service_role;
revoke all on table public.event_page_version_transitions from public, anon, authenticated, service_role;

grant select on table public.event_pages to service_role;
grant select on table public.event_page_versions to service_role;
grant select on table public.event_page_version_transitions to service_role;

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
  where page.event_key = p_identifier or page.slug = p_identifier
  limit 1;
$$;

create or replace function public.atlas_create_event_page_draft(
  p_event_key text,
  p_slug text,
  p_schema_version integer,
  p_manifest jsonb,
  p_content_hash text,
  p_validation_report jsonb,
  p_source_kind text,
  p_change_summary text,
  p_actor_identity text
)
returns table (
  version_id uuid,
  event_page_id uuid,
  version_number integer,
  status text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_page_id uuid;
  v_existing_id uuid;
  v_existing_number integer;
  v_existing_status text;
  v_version_id uuid;
  v_version_number integer;
begin
  if p_event_key is null or p_event_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event key is required.' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event slug is required.' using errcode = '22023';
  end if;
  if p_schema_version is null or p_schema_version < 1 then
    raise exception 'A positive schema version is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_manifest) is distinct from 'object' then
    raise exception 'Manifest must be a JSON object.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 content hash is required.' using errcode = '22023';
  end if;
  if p_source_kind not in ('local_seed', 'operator', 'import', 'ai_assisted') then
    raise exception 'Unsupported event page source kind.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('event-page:' || p_event_key, 0));

  select event_row.id
    into v_event_id
  from public.events as event_row
  where event_row.slug = p_slug
  limit 1;

  if v_event_id is null then
    raise exception 'No canonical event exists for slug %.', p_slug using errcode = 'P0002';
  end if;

  insert into public.event_pages (event_id, event_key, slug)
  values (v_event_id, p_event_key, p_slug)
  on conflict (event_key) do update
    set event_id = excluded.event_id,
        slug = excluded.slug,
        updated_at = now()
  returning id into v_page_id;

  select version.id, version.version_number, version.status
    into v_existing_id, v_existing_number, v_existing_status
  from public.event_page_versions as version
  where version.event_page_id = v_page_id
    and version.content_hash = p_content_hash
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, v_page_id, v_existing_number, v_existing_status, false;
    return;
  end if;

  select coalesce(max(version.version_number), 0) + 1
    into v_version_number
  from public.event_page_versions as version
  where version.event_page_id = v_page_id;

  insert into public.event_page_versions (
    event_page_id,
    version_number,
    schema_version,
    status,
    manifest,
    content_hash,
    is_valid,
    validation_report,
    source_kind,
    change_summary,
    created_by
  ) values (
    v_page_id,
    v_version_number,
    p_schema_version,
    'draft',
    p_manifest,
    p_content_hash,
    true,
    coalesce(p_validation_report, '{"errors":[],"warnings":[]}'::jsonb),
    p_source_kind,
    nullif(btrim(p_change_summary), ''),
    p_actor_identity
  )
  returning id into v_version_id;

  insert into public.event_page_version_transitions (
    version_id, from_status, to_status, actor_identity, notes
  ) values (
    v_version_id, null, 'draft', p_actor_identity, nullif(btrim(p_change_summary), '')
  );

  return query select v_version_id, v_page_id, v_version_number, 'draft'::text, true;
end;
$$;

create or replace function public.atlas_submit_event_page_version(
  p_version_id uuid,
  p_actor_identity text
)
returns table (version_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_page_versions as version
  set status = 'in_review'
  where version.id = p_version_id
    and version.status = 'draft'
    and version.is_valid = true;

  if not found then
    raise exception 'Only a valid draft can be submitted for review.' using errcode = 'P0001';
  end if;

  insert into public.event_page_version_transitions (
    version_id, from_status, to_status, actor_identity
  ) values (p_version_id, 'draft', 'in_review', p_actor_identity);

  return query select p_version_id, 'in_review'::text;
end;
$$;

create or replace function public.atlas_review_event_page_version(
  p_version_id uuid,
  p_actor_identity text,
  p_decision text,
  p_notes text
)
returns table (version_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  if p_decision not in ('approve', 'reject') then
    raise exception 'Review decision must be approve or reject.' using errcode = '22023';
  end if;

  v_status := case when p_decision = 'approve' then 'approved' else 'rejected' end;

  update public.event_page_versions as version
  set status = v_status,
      review_notes = nullif(btrim(p_notes), ''),
      reviewed_by = p_actor_identity,
      reviewed_at = now()
  where version.id = p_version_id
    and version.status = 'in_review';

  if not found then
    raise exception 'Only an in-review version can be approved or rejected.' using errcode = 'P0001';
  end if;

  insert into public.event_page_version_transitions (
    version_id, from_status, to_status, actor_identity, notes
  ) values (
    p_version_id, 'in_review', v_status, p_actor_identity, nullif(btrim(p_notes), '')
  );

  return query select p_version_id, v_status;
end;
$$;

create or replace function public.atlas_publish_event_page_version(
  p_version_id uuid,
  p_actor_identity text
)
returns table (
  version_id uuid,
  event_page_id uuid,
  event_key text,
  slug text,
  version_number integer,
  status text,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_page_id uuid;
  v_old_version_id uuid;
  v_event_key text;
  v_slug text;
  v_version_number integer;
  v_published_at timestamptz := now();
begin
  select version.event_page_id, version.version_number
    into v_page_id, v_version_number
  from public.event_page_versions as version
  where version.id = p_version_id
    and version.status = 'approved'
    and version.is_valid = true
  for update;

  if v_page_id is null then
    raise exception 'Only an approved, valid version can be published.' using errcode = 'P0001';
  end if;

  select page.published_version_id, page.event_key, page.slug
    into v_old_version_id, v_event_key, v_slug
  from public.event_pages as page
  where page.id = v_page_id
  for update;

  if v_old_version_id is not null and v_old_version_id <> p_version_id then
    update public.event_page_versions as version
    set status = 'archived'
    where version.id = v_old_version_id
      and version.status = 'published';

    if found then
      insert into public.event_page_version_transitions (
        version_id, from_status, to_status, actor_identity, notes
      ) values (
        v_old_version_id,
        'published',
        'archived',
        p_actor_identity,
        'Replaced by event page version ' || v_version_number::text
      );
    end if;
  end if;

  update public.event_page_versions as version
  set status = 'published',
      published_by = p_actor_identity,
      published_at = v_published_at
  where version.id = p_version_id;

  insert into public.event_page_version_transitions (
    version_id, from_status, to_status, actor_identity
  ) values (p_version_id, 'approved', 'published', p_actor_identity);

  update public.event_pages as page
  set published_version_id = p_version_id,
      updated_at = v_published_at
  where page.id = v_page_id;

  return query
    select
      p_version_id,
      v_page_id,
      v_event_key,
      v_slug,
      v_version_number,
      'published'::text,
      v_published_at;
end;
$$;

revoke all on function public.atlas_get_published_event_page(text) from public, anon, authenticated;
revoke all on function public.atlas_create_event_page_draft(text, text, integer, jsonb, text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_submit_event_page_version(uuid, text) from public, anon, authenticated;
revoke all on function public.atlas_review_event_page_version(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_publish_event_page_version(uuid, text) from public, anon, authenticated;

grant execute on function public.atlas_get_published_event_page(text) to service_role;
grant execute on function public.atlas_create_event_page_draft(text, text, integer, jsonb, text, jsonb, text, text, text) to service_role;
grant execute on function public.atlas_submit_event_page_version(uuid, text) to service_role;
grant execute on function public.atlas_review_event_page_version(uuid, text, text, text) to service_role;
grant execute on function public.atlas_publish_event_page_version(uuid, text) to service_role;

comment on table public.event_pages is
  'Stable Event Hub identity and atomic pointer to the currently published immutable version.';
comment on table public.event_page_versions is
  'Immutable Event Hub manifests moving through draft, review, approval, and publication.';
comment on table public.event_page_version_transitions is
  'Append-only audit trail for Event Hub manifest lifecycle transitions.';
