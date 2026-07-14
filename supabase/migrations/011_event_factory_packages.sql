-- Complete Event Factory packages and audited editorial approval.
-- Apply after migration 010 (candidate intake compatibility).

create table public.event_factory_packages (
  id uuid primary key default gen_random_uuid(),
  verification_case_id uuid not null unique references public.event_verification_cases(id) on delete restrict,
  candidate_id uuid not null references public.event_candidates(id) on delete restrict,
  event_id uuid references public.events(id) on delete set null,
  source_bundle_id uuid references public.event_source_bundles(id) on delete set null,
  synthesis_id uuid references public.event_source_syntheses(id) on delete set null,
  target_year integer not null check (target_year between 2000 and 2100),
  event_key text not null check (event_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'assembling' check (
    status in ('assembling', 'ready_for_review', 'approved', 'rejected', 'publishing', 'published', 'failed', 'archived')
  ),
  package_version integer not null default 1 check (package_version > 0),
  canonical_profile jsonb not null check (jsonb_typeof(canonical_profile) = 'object'),
  map_record jsonb not null check (jsonb_typeof(map_record) = 'object'),
  page_manifest jsonb not null check (jsonb_typeof(page_manifest) = 'object'),
  scout_context jsonb not null check (jsonb_typeof(scout_context) = 'object'),
  art_brief jsonb not null check (jsonb_typeof(art_brief) = 'object'),
  art_asset jsonb not null check (jsonb_typeof(art_asset) = 'object'),
  readiness_checks jsonb not null default '{}'::jsonb check (jsonb_typeof(readiness_checks) = 'object'),
  readiness_score numeric(4,3) not null default 0 check (readiness_score between 0 and 1),
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  created_by text not null,
  reviewed_by text,
  review_notes text,
  published_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ready_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  unique (candidate_id, target_year),
  unique (event_key, target_year),
  unique (slug, target_year)
);

create index event_factory_packages_status_updated
  on public.event_factory_packages (status, updated_at desc);

create table public.event_factory_package_actions (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references public.event_factory_packages(id) on delete cascade,
  action_type text not null check (
    action_type in ('created', 'rebuilt', 'submitted', 'approved', 'rejected', 'reopened', 'materialized', 'publication_failed', 'published', 'archived')
  ),
  actor_identity text not null,
  from_status text,
  to_status text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index event_factory_package_actions_package_created
  on public.event_factory_package_actions (package_id, created_at desc);

alter table public.event_factory_packages enable row level security;
alter table public.event_factory_package_actions enable row level security;

revoke all on table public.event_factory_packages from public, anon, authenticated, service_role;
revoke all on table public.event_factory_package_actions from public, anon, authenticated, service_role;

grant select on table public.event_factory_packages to service_role;
grant select on table public.event_factory_package_actions to service_role;

create or replace function public.atlas_upsert_event_factory_package(
  p_verification_case_id uuid,
  p_source_bundle_id uuid,
  p_synthesis_id uuid,
  p_event_key text,
  p_slug text,
  p_canonical_profile jsonb,
  p_map_record jsonb,
  p_page_manifest jsonb,
  p_scout_context jsonb,
  p_art_brief jsonb,
  p_art_asset jsonb,
  p_content_hash text,
  p_actor_identity text
)
returns table (
  package_id uuid,
  status text,
  readiness_score numeric,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.event_verification_cases%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_package public.event_factory_packages%rowtype;
  v_checks jsonb;
  v_ready_count integer;
  v_score numeric(4,3);
  v_status text;
  v_previous_status text;
  v_created boolean := false;
  v_latitude double precision;
  v_longitude double precision;
begin
  perform public.atlas_assert_service_role();

  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  if p_event_key is null or p_event_key !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event key is required.' using errcode = '22023';
  end if;
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'A valid event slug is required.' using errcode = '22023';
  end if;
  if p_content_hash is null or p_content_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 package content hash is required.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_canonical_profile) is distinct from 'object'
     or jsonb_typeof(p_map_record) is distinct from 'object'
     or jsonb_typeof(p_page_manifest) is distinct from 'object'
     or jsonb_typeof(p_scout_context) is distinct from 'object'
     or jsonb_typeof(p_art_brief) is distinct from 'object'
     or jsonb_typeof(p_art_asset) is distinct from 'object' then
    raise exception 'Every package output must be a JSON object.' using errcode = '22023';
  end if;
  if p_page_manifest->>'eventId' is distinct from p_event_key
     or p_page_manifest->>'slug' is distinct from p_slug then
    raise exception 'Event Page manifest identity does not match the package.' using errcode = '22023';
  end if;
  if p_page_manifest::text ~* '\msponsor' then
    raise exception 'Event sponsor references are not allowed in Celebration Atlas package copy.' using errcode = '22023';
  end if;

  select verification.* into v_case
  from public.event_verification_cases as verification
  where verification.id = p_verification_case_id
  for update;
  if not found then
    raise exception 'Verification case was not found.' using errcode = 'P0002';
  end if;
  if v_case.status <> 'verified' or v_case.candidate_id is null then
    raise exception 'A verified candidate case is required before package assembly.' using errcode = '22023';
  end if;

  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = v_case.candidate_id;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;
  if v_candidate.slug_candidate is distinct from p_slug then
    raise exception 'Package slug does not match the verified candidate.' using errcode = '22023';
  end if;

  if p_source_bundle_id is not null and not exists (
    select 1 from public.event_source_bundles as bundle
    where bundle.id = p_source_bundle_id
      and (bundle.candidate_id = v_case.candidate_id or bundle.event_key = p_event_key)
  ) then
    raise exception 'Source bundle does not belong to this candidate.' using errcode = '22023';
  end if;
  if p_synthesis_id is not null and not exists (
    select 1 from public.event_source_syntheses as synthesis
    join public.event_source_bundles as bundle on bundle.id = synthesis.bundle_id
    where synthesis.id = p_synthesis_id
      and (bundle.candidate_id = v_case.candidate_id or bundle.event_key = p_event_key)
  ) then
    raise exception 'Source synthesis does not belong to this candidate.' using errcode = '22023';
  end if;

  begin
    v_latitude := (p_map_record->>'latitude')::double precision;
    v_longitude := (p_map_record->>'longitude')::double precision;
  exception when others then
    v_latitude := null;
    v_longitude := null;
  end;

  v_checks := jsonb_build_object(
    'exists', v_case.existence_status = 'confirmed',
    'annual', v_case.recurrence_status = 'confirmed',
    'dates', v_case.dates_status = 'announced',
    'location', v_case.location_status = 'confirmed'
      and v_latitude between -90 and 90
      and v_longitude between -180 and 180
      and nullif(btrim(p_map_record->>'sourceUrl'), '') is not null,
    'sources', v_case.official_source_count >= 1 and v_case.supporting_source_count >= 1,
    'map', v_latitude between -90 and 90 and v_longitude between -180 and 180,
    'page', jsonb_typeof(p_page_manifest->'modules') = 'array'
      and jsonb_array_length(p_page_manifest->'modules') > 0,
    'art', nullif(btrim(p_art_asset->>'src'), '') is not null
      and nullif(btrim(p_art_asset->>'alt'), '') is not null
  );

  select count(*) into v_ready_count
  from jsonb_each_text(v_checks) as gate
  where gate.value = 'true';
  v_score := round((v_ready_count::numeric / 8), 3);
  v_status := case when v_ready_count = 8 then 'ready_for_review' else 'assembling' end;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.verification_case_id = p_verification_case_id
  for update;

  if found and v_package.status in ('approved', 'publishing', 'published', 'archived') then
    if v_package.content_hash = p_content_hash then
      return query select v_package.id, v_package.status, v_package.readiness_score, false;
      return;
    end if;
    raise exception 'Approved or published packages cannot be rebuilt.' using errcode = '22023';
  end if;

  if v_package.id is null then
    insert into public.event_factory_packages (
      verification_case_id, candidate_id, event_id, source_bundle_id, synthesis_id,
      target_year, event_key, slug, status, canonical_profile, map_record,
      page_manifest, scout_context, art_brief, art_asset, readiness_checks,
      readiness_score, content_hash, created_by, ready_at
    ) values (
      v_case.id, v_case.candidate_id, v_case.event_id, p_source_bundle_id, p_synthesis_id,
      v_case.target_year, p_event_key, p_slug, v_status, p_canonical_profile, p_map_record,
      p_page_manifest, p_scout_context, p_art_brief, p_art_asset, v_checks,
      v_score, p_content_hash, btrim(p_actor_identity),
      case when v_status = 'ready_for_review' then now() else null end
    ) returning * into v_package;
    v_created := true;

    insert into public.event_factory_package_actions (
      package_id, action_type, actor_identity, from_status, to_status, metadata
    ) values (
      v_package.id, 'created', btrim(p_actor_identity), null, v_status,
      jsonb_build_object('content_hash', p_content_hash, 'readiness_checks', v_checks)
    );
  else
    v_previous_status := v_package.status;
    update public.event_factory_packages
      set source_bundle_id = p_source_bundle_id,
          synthesis_id = p_synthesis_id,
          event_key = p_event_key,
          slug = p_slug,
          status = v_status,
          package_version = package_version + 1,
          canonical_profile = p_canonical_profile,
          map_record = p_map_record,
          page_manifest = p_page_manifest,
          scout_context = p_scout_context,
          art_brief = p_art_brief,
          art_asset = p_art_asset,
          readiness_checks = v_checks,
          readiness_score = v_score,
          content_hash = p_content_hash,
          reviewed_by = null,
          review_notes = null,
          reviewed_at = null,
          ready_at = case when v_status = 'ready_for_review' then now() else null end,
          updated_at = now()
    where id = v_package.id
    returning * into v_package;

    insert into public.event_factory_package_actions (
      package_id, action_type, actor_identity, from_status, to_status, metadata
    ) values (
      v_package.id, 'rebuilt', btrim(p_actor_identity), v_previous_status, v_status,
      jsonb_build_object('content_hash', p_content_hash, 'readiness_checks', v_checks)
    );
  end if;

  return query select v_package.id, v_package.status, v_package.readiness_score, v_created;
end;
$$;

create or replace function public.atlas_review_event_factory_package(
  p_package_id uuid,
  p_decision text,
  p_actor_identity text,
  p_notes text
)
returns table (
  package_id uuid,
  status text,
  event_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
  v_status text;
  v_action text;
begin
  perform public.atlas_assert_service_role();
  if p_decision not in ('approve', 'reject', 'reopen') then
    raise exception 'Unsupported package review decision.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;

  if p_decision = 'approve' then
    if v_package.status <> 'ready_for_review' or v_package.readiness_score <> 1 then
      raise exception 'Only complete, review-ready packages can be approved.' using errcode = '22023';
    end if;
    v_status := 'approved';
    v_action := 'approved';
  elsif p_decision = 'reject' then
    if v_package.status <> 'ready_for_review' then
      raise exception 'Only review-ready packages can be rejected.' using errcode = '22023';
    end if;
    v_status := 'rejected';
    v_action := 'rejected';
  else
    if v_package.status not in ('rejected', 'failed') then
      raise exception 'Only rejected or failed packages can be reopened.' using errcode = '22023';
    end if;
    v_status := 'assembling';
    v_action := 'reopened';
  end if;

  update public.event_factory_packages
    set status = v_status,
        reviewed_by = case when p_decision in ('approve', 'reject') then btrim(p_actor_identity) else null end,
        review_notes = nullif(btrim(p_notes), ''),
        reviewed_at = case when p_decision in ('approve', 'reject') then now() else null end,
        updated_at = now()
  where id = p_package_id;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, notes
  ) values (
    p_package_id, v_action, btrim(p_actor_identity), v_package.status, v_status, nullif(btrim(p_notes), '')
  );

  return query select p_package_id, v_status, v_package.event_key;
end;
$$;

create or replace function public.atlas_materialize_event_factory_package(
  p_package_id uuid,
  p_actor_identity text
)
returns table (
  package_id uuid,
  event_id uuid,
  status text,
  event_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
  v_candidate public.event_candidates%rowtype;
  v_event_id uuid;
  v_existing_event_id uuid;
begin
  perform public.atlas_assert_service_role();
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;
  if v_package.status not in ('approved', 'publishing', 'failed') then
    raise exception 'The event package must be approved before materialization.' using errcode = '22023';
  end if;

  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = v_package.candidate_id
  for update;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;

  v_event_id := coalesce(v_package.event_id, v_candidate.matched_event_id);
  select event_row.id into v_existing_event_id
  from public.events as event_row
  where event_row.slug = v_package.slug
  limit 1;

  if v_event_id is null and v_existing_event_id is not null then
    raise exception 'A canonical event already owns this slug; resolve the duplicate before approval.' using errcode = '23505';
  end if;
  if v_event_id is not null and v_existing_event_id is not null and v_event_id <> v_existing_event_id then
    raise exception 'Candidate and slug point to different canonical events.' using errcode = '23505';
  end if;

  if v_event_id is null then
    insert into public.events (
      name, slug, event_type, category, subcategory, city, county, state, country,
      venue_name, official_website, typical_month, typical_season, recurrence_pattern,
      short_description, long_description, status, verification_status, confidence_score,
      first_discovered_at, last_verified_at, latitude, longitude, location_confidence,
      location_source, geocoded_at, location_verified, updated_at
    ) values (
      coalesce(nullif(v_package.canonical_profile->>'name', ''), v_candidate.candidate_name),
      v_package.slug,
      coalesce(nullif(v_package.canonical_profile->>'eventType', ''), v_candidate.event_type, 'unknown'),
      coalesce(nullif(v_package.canonical_profile->>'category', ''), v_candidate.category),
      coalesce(nullif(v_package.canonical_profile->>'subcategory', ''), v_candidate.subcategory),
      coalesce(nullif(v_package.canonical_profile->>'city', ''), v_candidate.city),
      coalesce(nullif(v_package.canonical_profile->>'county', ''), v_candidate.county),
      coalesce(nullif(v_package.canonical_profile->>'state', ''), v_candidate.state, 'Michigan'),
      coalesce(nullif(v_package.canonical_profile->>'country', ''), v_candidate.country, 'USA'),
      coalesce(nullif(v_package.canonical_profile->>'venueName', ''), v_candidate.venue_name),
      coalesce(nullif(v_package.canonical_profile->>'officialWebsite', ''), v_candidate.official_website_candidate),
      coalesce(nullif(v_package.canonical_profile->>'typicalMonth', ''), v_candidate.typical_month),
      coalesce(nullif(v_package.canonical_profile->>'typicalSeason', ''), v_candidate.typical_season),
      'annual',
      coalesce(nullif(v_package.canonical_profile->>'shortDescription', ''), v_candidate.description),
      nullif(v_package.canonical_profile->>'longDescription', ''),
      'active',
      'verified',
      greatest(coalesce((v_package.canonical_profile->>'confidenceScore')::numeric, 0), v_candidate.discovery_confidence),
      coalesce(v_candidate.created_at, now()),
      now(),
      (v_package.map_record->>'latitude')::double precision,
      (v_package.map_record->>'longitude')::double precision,
      coalesce((v_package.map_record->>'confidenceScore')::numeric, 0.95),
      v_package.map_record->>'sourceUrl',
      now(),
      true,
      now()
    ) returning id into v_event_id;
  else
    update public.events
      set name = coalesce(nullif(v_package.canonical_profile->>'name', ''), name),
          official_website = coalesce(nullif(v_package.canonical_profile->>'officialWebsite', ''), official_website),
          recurrence_pattern = 'annual',
          verification_status = 'verified',
          confidence_score = greatest(coalesce(confidence_score, 0), coalesce((v_package.canonical_profile->>'confidenceScore')::numeric, 0)),
          last_verified_at = now(),
          latitude = (v_package.map_record->>'latitude')::double precision,
          longitude = (v_package.map_record->>'longitude')::double precision,
          location_confidence = coalesce((v_package.map_record->>'confidenceScore')::numeric, location_confidence, 0.95),
          location_source = coalesce(nullif(v_package.map_record->>'sourceUrl', ''), location_source),
          geocoded_at = now(),
          location_verified = true,
          updated_at = now()
    where id = v_event_id;
  end if;

  insert into public.event_sources (
    event_id, source_name, source_url, source_type, source_notes, trust_score, last_accessed
  )
  select distinct on (evidence.source_url)
    v_event_id,
    coalesce(evidence.source_title, evidence.source_kind),
    evidence.source_url,
    evidence.source_kind,
    evidence.excerpt,
    coalesce(evidence.confidence_score, case when evidence.is_official then 0.95 else 0.82 end),
    now()
  from public.event_verification_evidence as evidence
  where evidence.verification_case_id = v_package.verification_case_id
    and evidence.review_status <> 'rejected'
    and not exists (
      select 1 from public.event_sources as existing
      where existing.event_id = v_event_id and existing.source_url = evidence.source_url
    )
  order by evidence.source_url, evidence.is_official desc, evidence.created_at desc;

  update public.event_candidates
    set matched_event_id = v_event_id,
        verification_status = 'promoted',
        duplicate_status = 'unique_candidate',
        needs_review = false,
        updated_at = now()
  where id = v_package.candidate_id;

  update public.event_verification_cases
    set event_id = v_event_id,
        updated_at = now()
  where id = v_package.verification_case_id;

  update public.event_source_bundles
    set canonical_event_id = v_event_id,
        updated_at = now()
  where id = v_package.source_bundle_id;

  update public.event_factory_packages
    set event_id = v_event_id,
        status = 'publishing',
        updated_at = now()
  where id = p_package_id;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, metadata
  ) values (
    p_package_id, 'materialized', btrim(p_actor_identity), v_package.status, 'publishing',
    jsonb_build_object('event_id', v_event_id)
  );

  return query select p_package_id, v_event_id, 'publishing'::text, v_package.event_key;
end;
$$;

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
  v_status text;
begin
  perform public.atlas_assert_service_role();
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;
  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;
  if v_package.status <> 'publishing' then
    raise exception 'Only publishing packages can be completed.' using errcode = '22023';
  end if;
  if v_package.event_id is null then
    raise exception 'A materialized canonical event is required.' using errcode = '22023';
  end if;
  if p_succeeded and not exists (
    select 1
    from public.event_pages as page
    join public.event_page_versions as version on version.id = page.published_version_id
    where page.event_id = v_package.event_id and version.status = 'published'
  ) then
    raise exception 'A published Event Hub version is required.' using errcode = '22023';
  end if;

  v_status := case when p_succeeded then 'published' else 'failed' end;
  update public.event_factory_packages
    set status = v_status,
        published_by = case when p_succeeded then btrim(p_actor_identity) else published_by end,
        published_at = case when p_succeeded then now() else published_at end,
        review_notes = coalesce(nullif(btrim(p_notes), ''), review_notes),
        updated_at = now()
  where id = p_package_id;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, notes
  ) values (
    p_package_id,
    case when p_succeeded then 'published' else 'publication_failed' end,
    btrim(p_actor_identity),
    v_package.status,
    v_status,
    nullif(btrim(p_notes), '')
  );

  return query select p_package_id, v_status, v_package.event_id;
end;
$$;

create or replace function public.atlas_list_event_factory_packages(p_limit integer default 100)
returns table (
  package_id uuid,
  verification_case_id uuid,
  candidate_id uuid,
  event_id uuid,
  event_key text,
  slug text,
  event_name text,
  target_year integer,
  status text,
  package_version integer,
  readiness_checks jsonb,
  readiness_score numeric,
  content_hash text,
  map_record jsonb,
  art_asset jsonb,
  reviewed_by text,
  review_notes text,
  created_at timestamptz,
  updated_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    package.id,
    package.verification_case_id,
    package.candidate_id,
    package.event_id,
    package.event_key,
    package.slug,
    coalesce(package.canonical_profile->>'name', candidate.candidate_name),
    package.target_year,
    package.status,
    package.package_version,
    package.readiness_checks,
    package.readiness_score,
    package.content_hash,
    package.map_record,
    package.art_asset,
    package.reviewed_by,
    package.review_notes,
    package.created_at,
    package.updated_at,
    package.reviewed_at,
    package.published_at
  from public.event_factory_packages as package
  join public.event_candidates as candidate on candidate.id = package.candidate_id
  order by
    case package.status
      when 'ready_for_review' then 0
      when 'failed' then 1
      when 'assembling' then 2
      when 'approved' then 3
      when 'publishing' then 4
      when 'published' then 5
      else 6
    end,
    package.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.atlas_upsert_event_factory_package(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.atlas_review_event_factory_package(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_materialize_event_factory_package(uuid, text) from public, anon, authenticated;
revoke all on function public.atlas_finish_event_factory_publication(uuid, boolean, text, text) from public, anon, authenticated;
revoke all on function public.atlas_list_event_factory_packages(integer) from public, anon, authenticated;

grant execute on function public.atlas_upsert_event_factory_package(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) to service_role;
grant execute on function public.atlas_review_event_factory_package(uuid, text, text, text) to service_role;
grant execute on function public.atlas_materialize_event_factory_package(uuid, text) to service_role;
grant execute on function public.atlas_finish_event_factory_publication(uuid, boolean, text, text) to service_role;
grant execute on function public.atlas_list_event_factory_packages(integer) to service_role;
