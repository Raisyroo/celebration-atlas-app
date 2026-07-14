-- Event source intelligence and provenance foundation.
-- Apply after migrations 004 (Control Plane) and 005 (Event Hub publishing).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'event-source-archive',
  'event-source-archive',
  false,
  3000000,
  array['application/gzip']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table public.event_source_bundles (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 200),
  status text not null default 'collecting' check (
    status in ('collecting', 'ready_for_synthesis', 'synthesis_in_progress', 'draft_ready', 'archived')
  ),
  event_key text check (
    event_key is null or event_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  ),
  canonical_event_id uuid references public.events(id) on delete set null,
  candidate_id uuid,
  event_page_version_id uuid references public.event_page_versions(id) on delete set null,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  archived_at timestamptz
);

create table public.event_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  sequence_number integer not null check (sequence_number > 0),
  source_url text not null check (source_url ~ '^https?://'),
  final_url text not null check (final_url ~ '^https?://'),
  canonical_url text not null check (canonical_url ~ '^https?://'),
  source_kind text not null default 'other' check (
    source_kind in ('official_home', 'schedule', 'lineup', 'tickets', 'registration', 'plan', 'faq', 'rules', 'other')
  ),
  page_title text,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  storage_bucket text not null check (storage_bucket = 'event-source-archive'),
  storage_path text not null,
  content_type text not null default 'text/html',
  content_encoding text not null default 'gzip' check (content_encoding = 'gzip'),
  downloaded_bytes bigint not null check (downloaded_bytes between 0 and 5000000),
  inspection jsonb not null check (jsonb_typeof(inspection) = 'object'),
  fetch_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(fetch_metadata) = 'object'),
  fetched_at timestamptz not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (bundle_id, sequence_number),
  unique (bundle_id, content_hash)
);

create table public.event_source_claims (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  source_snapshot_id uuid not null references public.event_source_snapshots(id) on delete cascade,
  field_path text not null check (
    char_length(field_path) between 1 and 200
    and field_path ~ '^[A-Za-z][A-Za-z0-9_.\[\]-]*$'
  ),
  value jsonb not null,
  normalized_text text not null check (char_length(normalized_text) between 1 and 4000),
  confidence text not null check (confidence in ('unknown', 'low', 'medium', 'high', 'verified')),
  confidence_score numeric(4,3) check (confidence_score between 0 and 1),
  extraction_method text not null check (
    extraction_method in ('json_ld', 'metadata', 'html', 'operator', 'ai_assisted')
  ),
  source_locator jsonb not null default '{}'::jsonb check (jsonb_typeof(source_locator) = 'object'),
  review_status text not null default 'unreviewed' check (
    review_status in ('unreviewed', 'accepted', 'rejected', 'superseded')
  ),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (source_snapshot_id, field_path, normalized_text)
);

create table public.event_source_links (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  discovered_from_snapshot_id uuid not null references public.event_source_snapshots(id) on delete cascade,
  linked_snapshot_id uuid references public.event_source_snapshots(id) on delete set null,
  label text not null check (char_length(label) between 1 and 300),
  url text not null check (url ~ '^https?://'),
  link_kind text not null check (
    link_kind in ('schedule', 'lineup', 'tickets', 'registration', 'plan', 'faq', 'rules', 'other')
  ),
  crawl_status text not null default 'discovered' check (
    crawl_status in ('discovered', 'inspected', 'skipped', 'failed')
  ),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bundle_id, url)
);

create table public.event_schedule_candidates (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  source_snapshot_id uuid not null references public.event_source_snapshots(id) on delete cascade,
  dedupe_key text not null check (dedupe_key ~ '^[0-9a-f]{64}$'),
  title text not null check (char_length(title) between 1 and 300),
  starts_at timestamptz,
  ends_at timestamptz,
  date_text text,
  timezone text,
  venue text,
  category text,
  tags text[] not null default '{}',
  details text,
  confidence text not null check (confidence in ('unknown', 'low', 'medium', 'high', 'verified')),
  confidence_score numeric(4,3) check (confidence_score between 0 and 1),
  source_locator jsonb not null default '{}'::jsonb check (jsonb_typeof(source_locator) = 'object'),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  review_status text not null default 'unreviewed' check (
    review_status in ('unreviewed', 'accepted', 'rejected', 'superseded')
  ),
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz not null default now(),
  unique (bundle_id, dedupe_key),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create table public.event_source_bundle_actions (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references public.event_source_bundles(id) on delete cascade,
  action_type text not null check (
    action_type in ('created', 'source_added', 'ready_for_synthesis', 'reopened', 'archived', 'candidate_attached', 'page_version_attached')
  ),
  actor_identity text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index event_source_bundles_status_updated
  on public.event_source_bundles (status, updated_at desc);
create index event_source_bundles_event_key
  on public.event_source_bundles (event_key)
  where event_key is not null;
create index event_source_snapshots_bundle_created
  on public.event_source_snapshots (bundle_id, created_at desc);
create index event_source_snapshots_canonical_url
  on public.event_source_snapshots (canonical_url);
create index event_source_claims_bundle_field
  on public.event_source_claims (bundle_id, field_path, review_status);
create index event_source_links_bundle_status
  on public.event_source_links (bundle_id, crawl_status, link_kind);
create index event_schedule_candidates_bundle_status
  on public.event_schedule_candidates (bundle_id, review_status, starts_at);
create index event_source_bundle_actions_bundle_created
  on public.event_source_bundle_actions (bundle_id, created_at desc);

alter table public.event_source_bundles enable row level security;
alter table public.event_source_snapshots enable row level security;
alter table public.event_source_claims enable row level security;
alter table public.event_source_links enable row level security;
alter table public.event_schedule_candidates enable row level security;
alter table public.event_source_bundle_actions enable row level security;

revoke all on table public.event_source_bundles from public, anon, authenticated, service_role;
revoke all on table public.event_source_snapshots from public, anon, authenticated, service_role;
revoke all on table public.event_source_claims from public, anon, authenticated, service_role;
revoke all on table public.event_source_links from public, anon, authenticated, service_role;
revoke all on table public.event_schedule_candidates from public, anon, authenticated, service_role;
revoke all on table public.event_source_bundle_actions from public, anon, authenticated, service_role;

grant select on table public.event_source_bundles to service_role;
grant select on table public.event_source_snapshots to service_role;
grant select on table public.event_source_claims to service_role;
grant select on table public.event_source_links to service_role;
grant select on table public.event_schedule_candidates to service_role;
grant select on table public.event_source_bundle_actions to service_role;

create or replace function public.atlas_create_event_source_bundle(
  p_name text,
  p_event_key text,
  p_actor_identity text
)
returns table (bundle_id uuid, status text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_id uuid;
  v_event_id uuid;
  v_created_at timestamptz := now();
begin
  if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 200 then
    raise exception 'A bundle name between 1 and 200 characters is required.' using errcode = '22023';
  end if;
  if p_event_key is not null and p_event_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Event key must be lowercase kebab-case.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  if p_event_key is not null then
    select event_row.id
      into v_event_id
    from public.events as event_row
    where event_row.slug = p_event_key
    limit 1;
  end if;

  insert into public.event_source_bundles (
    name, event_key, canonical_event_id, created_by, created_at, updated_at
  ) values (
    btrim(p_name), p_event_key, v_event_id, p_actor_identity, v_created_at, v_created_at
  ) returning id into v_bundle_id;

  insert into public.event_source_bundle_actions (
    bundle_id, action_type, actor_identity
  ) values (v_bundle_id, 'created', p_actor_identity);

  return query select v_bundle_id, 'collecting'::text, v_created_at;
end;
$$;

create or replace function public.atlas_add_event_source_snapshot(
  p_bundle_id uuid,
  p_source_url text,
  p_final_url text,
  p_canonical_url text,
  p_source_kind text,
  p_page_title text,
  p_content_hash text,
  p_storage_bucket text,
  p_storage_path text,
  p_content_type text,
  p_content_encoding text,
  p_downloaded_bytes bigint,
  p_inspection jsonb,
  p_fetch_metadata jsonb,
  p_claims jsonb,
  p_links jsonb,
  p_schedule_items jsonb,
  p_fetched_at timestamptz,
  p_actor_identity text
)
returns table (
  snapshot_id uuid,
  sequence_number integer,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bundle_status text;
  v_existing_id uuid;
  v_existing_sequence integer;
  v_snapshot_id uuid;
  v_sequence integer;
  v_claim_count integer := 0;
  v_link_count integer := 0;
  v_schedule_count integer := 0;
begin
  if p_source_url !~ '^https?://' or p_final_url !~ '^https?://' or p_canonical_url !~ '^https?://' then
    raise exception 'Source URLs must use http:// or https://.' using errcode = '22023';
  end if;
  if p_source_kind not in ('official_home', 'schedule', 'lineup', 'tickets', 'registration', 'plan', 'faq', 'rules', 'other') then
    raise exception 'Unsupported source kind.' using errcode = '22023';
  end if;
  if p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 content hash is required.' using errcode = '22023';
  end if;
  if p_storage_bucket is distinct from 'event-source-archive' then
    raise exception 'Source snapshots must use the private event source archive.' using errcode = '22023';
  end if;
  if p_storage_path not like 'bundles/' || p_bundle_id::text || '/%' then
    raise exception 'Source archive path does not match the bundle.' using errcode = '22023';
  end if;
  if p_content_encoding is distinct from 'gzip' then
    raise exception 'Source archive content must be gzip encoded.' using errcode = '22023';
  end if;
  if p_downloaded_bytes is null or p_downloaded_bytes < 0 or p_downloaded_bytes > 5000000 then
    raise exception 'Downloaded byte count is outside the accepted range.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_inspection) is distinct from 'object'
    or jsonb_typeof(coalesce(p_fetch_metadata, '{}'::jsonb)) is distinct from 'object'
    or jsonb_typeof(coalesce(p_claims, '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_links, '[]'::jsonb)) is distinct from 'array'
    or jsonb_typeof(coalesce(p_schedule_items, '[]'::jsonb)) is distinct from 'array' then
    raise exception 'Snapshot inspection and collection payloads have invalid JSON shapes.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select bundle.status
    into v_bundle_status
  from public.event_source_bundles as bundle
  where bundle.id = p_bundle_id
  for update;

  if v_bundle_status is null then
    raise exception 'Source bundle was not found.' using errcode = 'P0002';
  end if;
  if v_bundle_status <> 'collecting' then
    raise exception 'Sources can only be added to a collecting bundle.' using errcode = 'P0001';
  end if;

  select snapshot.id, snapshot.sequence_number
    into v_existing_id, v_existing_sequence
  from public.event_source_snapshots as snapshot
  where snapshot.bundle_id = p_bundle_id
    and snapshot.content_hash = p_content_hash
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, v_existing_sequence, false;
    return;
  end if;

  select coalesce(max(snapshot.sequence_number), 0) + 1
    into v_sequence
  from public.event_source_snapshots as snapshot
  where snapshot.bundle_id = p_bundle_id;

  insert into public.event_source_snapshots (
    bundle_id,
    sequence_number,
    source_url,
    final_url,
    canonical_url,
    source_kind,
    page_title,
    content_hash,
    storage_bucket,
    storage_path,
    content_type,
    content_encoding,
    downloaded_bytes,
    inspection,
    fetch_metadata,
    fetched_at,
    created_by
  ) values (
    p_bundle_id,
    v_sequence,
    p_source_url,
    p_final_url,
    p_canonical_url,
    p_source_kind,
    nullif(btrim(p_page_title), ''),
    p_content_hash,
    p_storage_bucket,
    p_storage_path,
    coalesce(nullif(btrim(p_content_type), ''), 'text/html'),
    p_content_encoding,
    p_downloaded_bytes,
    p_inspection,
    coalesce(p_fetch_metadata, '{}'::jsonb),
    coalesce(p_fetched_at, now()),
    p_actor_identity
  ) returning id into v_snapshot_id;

  insert into public.event_source_claims (
    bundle_id,
    source_snapshot_id,
    field_path,
    value,
    normalized_text,
    confidence,
    confidence_score,
    extraction_method,
    source_locator
  )
  select
    p_bundle_id,
    v_snapshot_id,
    claim->>'fieldPath',
    coalesce(claim->'value', 'null'::jsonb),
    left(claim->>'normalizedText', 4000),
    claim->>'confidence',
    nullif(claim->>'confidenceScore', '')::numeric,
    claim->>'method',
    case when jsonb_typeof(claim->'sourceLocator') = 'object' then claim->'sourceLocator' else '{}'::jsonb end
  from jsonb_array_elements(coalesce(p_claims, '[]'::jsonb)) as claim
  where claim->>'fieldPath' ~ '^[A-Za-z][A-Za-z0-9_.\[\]-]{0,199}$'
    and char_length(coalesce(claim->>'normalizedText', '')) between 1 and 4000
    and claim->>'confidence' in ('unknown', 'low', 'medium', 'high', 'verified')
    and claim->>'method' in ('json_ld', 'metadata', 'html', 'operator', 'ai_assisted')
  on conflict (source_snapshot_id, field_path, normalized_text) do nothing;
  get diagnostics v_claim_count = row_count;

  insert into public.event_source_links (
    bundle_id,
    discovered_from_snapshot_id,
    label,
    url,
    link_kind
  )
  select
    p_bundle_id,
    v_snapshot_id,
    left(link->>'label', 300),
    link->>'url',
    link->>'kind'
  from jsonb_array_elements(coalesce(p_links, '[]'::jsonb)) as link
  where char_length(coalesce(link->>'label', '')) between 1 and 300
    and link->>'url' ~ '^https?://'
    and link->>'kind' in ('schedule', 'lineup', 'tickets', 'registration', 'plan', 'faq', 'rules', 'other')
  on conflict (bundle_id, url) do update
  set label = excluded.label,
      link_kind = excluded.link_kind,
      updated_at = now();
  get diagnostics v_link_count = row_count;

  update public.event_source_links as link
  set linked_snapshot_id = v_snapshot_id,
      crawl_status = 'inspected',
      last_error = null,
      updated_at = now()
  where link.bundle_id = p_bundle_id
    and link.url in (p_source_url, p_final_url, p_canonical_url);

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
    p_bundle_id,
    v_snapshot_id,
    item->>'dedupeKey',
    left(item->>'title', 300),
    nullif(item->>'startsAt', '')::timestamptz,
    nullif(item->>'endsAt', '')::timestamptz,
    item->>'dateText',
    item->>'timezone',
    item->>'venue',
    item->>'category',
    case
      when jsonb_typeof(item->'tags') = 'array'
        then array(select jsonb_array_elements_text(item->'tags'))
      else '{}'
    end,
    item->>'details',
    item->>'confidence',
    nullif(item->>'confidenceScore', '')::numeric,
    case when jsonb_typeof(item->'sourceLocator') = 'object' then item->'sourceLocator' else '{}'::jsonb end,
    item
  from jsonb_array_elements(coalesce(p_schedule_items, '[]'::jsonb)) as item
  where item->>'dedupeKey' ~ '^[0-9a-f]{64}$'
    and char_length(coalesce(item->>'title', '')) between 1 and 300
    and item->>'confidence' in ('unknown', 'low', 'medium', 'high', 'verified')
  on conflict (bundle_id, dedupe_key) do nothing;
  get diagnostics v_schedule_count = row_count;

  update public.event_source_bundles as bundle
  set updated_at = now()
  where bundle.id = p_bundle_id;

  insert into public.event_source_bundle_actions (
    bundle_id, action_type, actor_identity, metadata
  ) values (
    p_bundle_id,
    'source_added',
    p_actor_identity,
    jsonb_build_object(
      'snapshot_id', v_snapshot_id,
      'sequence_number', v_sequence,
      'claim_count', v_claim_count,
      'link_count', v_link_count,
      'schedule_count', v_schedule_count
    )
  );

  return query select v_snapshot_id, v_sequence, true;
end;
$$;

create or replace function public.atlas_transition_event_source_bundle(
  p_bundle_id uuid,
  p_action text,
  p_actor_identity text,
  p_notes text
)
returns table (bundle_id uuid, status text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_status text;
  v_next_status text;
  v_action_type text;
  v_updated_at timestamptz := now();
begin
  select bundle.status
    into v_current_status
  from public.event_source_bundles as bundle
  where bundle.id = p_bundle_id
  for update;

  if v_current_status is null then
    raise exception 'Source bundle was not found.' using errcode = 'P0002';
  end if;

  if p_action = 'ready' and v_current_status = 'collecting' then
    if not exists (
      select 1 from public.event_source_snapshots as snapshot where snapshot.bundle_id = p_bundle_id
    ) then
      raise exception 'A bundle needs at least one source before synthesis.' using errcode = 'P0001';
    end if;
    v_next_status := 'ready_for_synthesis';
    v_action_type := 'ready_for_synthesis';
  elsif p_action = 'reopen' and v_current_status in ('ready_for_synthesis', 'draft_ready') then
    v_next_status := 'collecting';
    v_action_type := 'reopened';
  elsif p_action = 'archive' and v_current_status <> 'archived' then
    v_next_status := 'archived';
    v_action_type := 'archived';
  else
    raise exception 'The requested bundle transition is not allowed from status %.', v_current_status using errcode = 'P0001';
  end if;

  update public.event_source_bundles as bundle
  set status = v_next_status,
      updated_at = v_updated_at,
      ready_at = case when v_next_status = 'ready_for_synthesis' then v_updated_at else bundle.ready_at end,
      archived_at = case when v_next_status = 'archived' then v_updated_at else bundle.archived_at end
  where bundle.id = p_bundle_id;

  insert into public.event_source_bundle_actions (
    bundle_id, action_type, actor_identity, notes, metadata
  ) values (
    p_bundle_id,
    v_action_type,
    p_actor_identity,
    nullif(btrim(p_notes), ''),
    jsonb_build_object('from_status', v_current_status, 'to_status', v_next_status)
  );

  return query select p_bundle_id, v_next_status, v_updated_at;
end;
$$;

create or replace function public.atlas_attach_event_source_bundle_candidate(
  p_bundle_id uuid,
  p_candidate_id uuid,
  p_actor_identity text
)
returns table (bundle_id uuid, candidate_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.event_source_bundles as bundle
  set candidate_id = p_candidate_id,
      updated_at = now()
  where bundle.id = p_bundle_id
    and bundle.status <> 'archived';

  if not found then
    raise exception 'An active source bundle was not found.' using errcode = 'P0002';
  end if;

  insert into public.event_source_bundle_actions (
    bundle_id, action_type, actor_identity, metadata
  ) values (
    p_bundle_id,
    'candidate_attached',
    p_actor_identity,
    jsonb_build_object('candidate_id', p_candidate_id)
  );

  return query select p_bundle_id, p_candidate_id;
end;
$$;

create or replace function public.atlas_list_event_source_bundles(p_limit integer default 30)
returns table (
  bundle_id uuid,
  name text,
  status text,
  event_key text,
  candidate_id uuid,
  event_page_version_id uuid,
  source_count bigint,
  claim_count bigint,
  unresolved_claim_count bigint,
  discovered_link_count bigint,
  inspected_link_count bigint,
  schedule_candidate_count bigint,
  created_by text,
  created_at timestamptz,
  updated_at timestamptz,
  ready_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    bundle.id,
    bundle.name,
    bundle.status,
    bundle.event_key,
    bundle.candidate_id,
    bundle.event_page_version_id,
    (select count(*) from public.event_source_snapshots as snapshot where snapshot.bundle_id = bundle.id),
    (select count(*) from public.event_source_claims as claim where claim.bundle_id = bundle.id),
    (select count(*) from public.event_source_claims as claim where claim.bundle_id = bundle.id and claim.review_status = 'unreviewed'),
    (select count(*) from public.event_source_links as link where link.bundle_id = bundle.id and link.crawl_status = 'discovered'),
    (select count(*) from public.event_source_links as link where link.bundle_id = bundle.id and link.crawl_status = 'inspected'),
    (select count(*) from public.event_schedule_candidates as schedule where schedule.bundle_id = bundle.id),
    bundle.created_by,
    bundle.created_at,
    bundle.updated_at,
    bundle.ready_at
  from public.event_source_bundles as bundle
  order by bundle.updated_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

revoke all on function public.atlas_create_event_source_bundle(text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_add_event_source_snapshot(uuid, text, text, text, text, text, text, text, text, text, text, bigint, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text) from public, anon, authenticated;
revoke all on function public.atlas_transition_event_source_bundle(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_attach_event_source_bundle_candidate(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.atlas_list_event_source_bundles(integer) from public, anon, authenticated;

grant execute on function public.atlas_create_event_source_bundle(text, text, text) to service_role;
grant execute on function public.atlas_add_event_source_snapshot(uuid, text, text, text, text, text, text, text, text, text, text, bigint, jsonb, jsonb, jsonb, jsonb, jsonb, timestamptz, text) to service_role;
grant execute on function public.atlas_transition_event_source_bundle(uuid, text, text, text) to service_role;
grant execute on function public.atlas_attach_event_source_bundle_candidate(uuid, uuid, text) to service_role;
grant execute on function public.atlas_list_event_source_bundles(integer) to service_role;

comment on table public.event_source_bundles is
  'Multi-page official-source evidence packages used to produce reviewed Event Hub drafts.';
comment on table public.event_source_snapshots is
  'Immutable sanitized source inspections with private Storage pointers to compressed raw HTML.';
comment on table public.event_source_claims is
  'Field-level claims with provenance, extraction method, confidence, and human review state.';
comment on table public.event_source_links is
  'First-party links discovered during collection and their crawl lifecycle.';
comment on table public.event_schedule_candidates is
  'Source-backed schedule candidates retained separately until reviewed and normalized.';
comment on table public.event_source_bundle_actions is
  'Append-only source bundle lifecycle and attachment audit records.';
