-- Event Factory due-diligence foundation.
-- Apply after migration 007 (event source synthesis).

create table public.event_verification_cases (
  id uuid primary key default gen_random_uuid(),
  candidate_id uuid references public.event_candidates(id) on delete set null,
  event_id uuid references public.events(id) on delete set null,
  target_year integer not null check (target_year between 2000 and 2100),
  status text not null default 'collecting' check (
    status in ('collecting', 'needs_review', 'verified', 'rejected', 'stale')
  ),
  existence_status text not null default 'unverified' check (
    existence_status in ('unverified', 'likely', 'confirmed', 'rejected')
  ),
  recurrence_status text not null default 'unverified' check (
    recurrence_status in ('unverified', 'likely', 'confirmed', 'rejected')
  ),
  dates_status text not null default 'unknown' check (
    dates_status in ('unknown', 'announced', 'not_announced', 'conflicting')
  ),
  location_status text not null default 'unknown' check (
    location_status in ('unknown', 'likely', 'confirmed', 'conflicting')
  ),
  official_source_count integer not null default 0 check (official_source_count >= 0),
  supporting_source_count integer not null default 0 check (supporting_source_count >= 0),
  historical_occurrence_count integer not null default 0 check (historical_occurrence_count >= 0),
  verification_score numeric(4,3) not null default 0 check (verification_score between 0 and 1),
  summary text,
  checks jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),
  created_by text not null,
  submitted_by text,
  verified_by text,
  rejected_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  verified_at timestamptz,
  rejected_at timestamptz,
  check (candidate_id is not null or event_id is not null)
);

create unique index event_verification_cases_candidate_year
  on public.event_verification_cases (candidate_id, target_year)
  where candidate_id is not null;

create unique index event_verification_cases_event_year
  on public.event_verification_cases (event_id, target_year)
  where event_id is not null;

create table public.event_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  verification_case_id uuid not null references public.event_verification_cases(id) on delete cascade,
  source_snapshot_id uuid references public.event_source_snapshots(id) on delete set null,
  proof_kind text not null check (
    proof_kind in (
      'official_identity',
      'current_occurrence',
      'current_dates',
      'annual_language',
      'prior_occurrence',
      'venue',
      'location',
      'independent_listing',
      'cancellation_status',
      'other'
    )
  ),
  source_kind text not null check (
    source_kind in (
      'official_event',
      'organizer',
      'government',
      'tourism',
      'venue',
      'archive',
      'news',
      'social',
      'directory',
      'other'
    )
  ),
  source_url text not null check (source_url ~ '^https?://'),
  source_title text,
  excerpt text not null check (char_length(excerpt) between 1 and 4000),
  occurrence_year integer check (occurrence_year between 1900 and 2100),
  is_official boolean not null default false,
  confidence text not null check (confidence in ('unknown', 'low', 'medium', 'high', 'verified')),
  confidence_score numeric(4,3) check (confidence_score between 0 and 1),
  content_hash text check (content_hash is null or content_hash ~ '^[0-9a-f]{64}$'),
  review_status text not null default 'unreviewed' check (
    review_status in ('unreviewed', 'accepted', 'rejected', 'superseded')
  ),
  created_by text not null,
  reviewed_by text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  review_notes text
);

create unique index event_verification_evidence_dedupe
  on public.event_verification_evidence (
    verification_case_id,
    proof_kind,
    source_url,
    coalesce(occurrence_year, 0),
    coalesce(content_hash, '')
  );

create index event_verification_evidence_case_kind
  on public.event_verification_evidence (verification_case_id, proof_kind, review_status);

create table public.event_verification_actions (
  id uuid primary key default gen_random_uuid(),
  verification_case_id uuid not null references public.event_verification_cases(id) on delete cascade,
  evidence_id uuid references public.event_verification_evidence(id) on delete set null,
  action_type text not null check (
    action_type in ('created', 'evidence_added', 'submitted', 'verified', 'rejected', 'reopened', 'refreshed')
  ),
  actor_identity text not null,
  notes text,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index event_verification_actions_case_created
  on public.event_verification_actions (verification_case_id, created_at desc);

alter table public.event_verification_cases enable row level security;
alter table public.event_verification_evidence enable row level security;
alter table public.event_verification_actions enable row level security;

revoke all on table public.event_verification_cases from public, anon, authenticated, service_role;
revoke all on table public.event_verification_evidence from public, anon, authenticated, service_role;
revoke all on table public.event_verification_actions from public, anon, authenticated, service_role;

grant select on table public.event_verification_cases to service_role;
grant select on table public.event_verification_evidence to service_role;
grant select on table public.event_verification_actions to service_role;

create or replace function public.atlas_create_event_verification_case(
  p_candidate_id uuid,
  p_event_id uuid,
  p_target_year integer,
  p_actor_identity text
)
returns table (
  verification_case_id uuid,
  status text,
  created boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_event_id uuid := p_event_id;
begin
  if p_candidate_id is null and p_event_id is null then
    raise exception 'A candidate or canonical event is required.' using errcode = '22023';
  end if;
  if p_target_year is null or p_target_year < 2000 or p_target_year > 2100 then
    raise exception 'A target year between 2000 and 2100 is required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  if p_candidate_id is not null then
    select coalesce(v_event_id, candidate.matched_event_id)
      into v_event_id
    from public.event_candidates as candidate
    where candidate.id = p_candidate_id;
    if not found then
      raise exception 'Event candidate was not found.' using errcode = 'P0002';
    end if;
  end if;

  if v_event_id is not null and not exists (select 1 from public.events where id = v_event_id) then
    raise exception 'Canonical event was not found.' using errcode = 'P0002';
  end if;

  select verification.id
    into v_case_id
  from public.event_verification_cases as verification
  where verification.target_year = p_target_year
    and (
      (p_candidate_id is not null and verification.candidate_id = p_candidate_id)
      or (v_event_id is not null and verification.event_id = v_event_id)
    )
  order by (verification.candidate_id is not null) desc
  limit 1;

  if v_case_id is not null then
    update public.event_verification_cases
      set candidate_id = coalesce(candidate_id, p_candidate_id),
          event_id = coalesce(event_id, v_event_id),
          updated_at = now()
    where id = v_case_id;
    return query select v_case_id, verification.status, false
      from public.event_verification_cases as verification
      where verification.id = v_case_id;
    return;
  end if;

  insert into public.event_verification_cases (
    candidate_id, event_id, target_year, created_by
  ) values (
    p_candidate_id, v_event_id, p_target_year, btrim(p_actor_identity)
  ) returning id into v_case_id;

  insert into public.event_verification_actions (
    verification_case_id, action_type, actor_identity
  ) values (
    v_case_id, 'created', btrim(p_actor_identity)
  );

  return query select v_case_id, 'collecting'::text, true;
end;
$$;

create or replace function public.atlas_add_event_verification_evidence(
  p_verification_case_id uuid,
  p_source_snapshot_id uuid,
  p_proof_kind text,
  p_source_kind text,
  p_source_url text,
  p_source_title text,
  p_excerpt text,
  p_occurrence_year integer,
  p_is_official boolean,
  p_confidence text,
  p_confidence_score numeric,
  p_content_hash text,
  p_actor_identity text
)
returns table (
  evidence_id uuid,
  created boolean,
  verification_score numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence_id uuid;
  v_created boolean := false;
  v_case public.event_verification_cases%rowtype;
  v_official_count integer;
  v_supporting_count integer;
  v_occurrence_count integer;
  v_existence text;
  v_recurrence text;
  v_dates text;
  v_location text;
  v_score numeric(4,3);
begin
  select * into v_case
  from public.event_verification_cases
  where id = p_verification_case_id
  for update;
  if not found then
    raise exception 'Verification case was not found.' using errcode = 'P0002';
  end if;
  if v_case.status not in ('collecting', 'needs_review') then
    raise exception 'Evidence can only be added to an open verification case.' using errcode = '22023';
  end if;
  if p_proof_kind not in ('official_identity', 'current_occurrence', 'current_dates', 'annual_language', 'prior_occurrence', 'venue', 'location', 'independent_listing', 'cancellation_status', 'other') then
    raise exception 'Unsupported verification proof kind.' using errcode = '22023';
  end if;
  if p_source_kind not in ('official_event', 'organizer', 'government', 'tourism', 'venue', 'archive', 'news', 'social', 'directory', 'other') then
    raise exception 'Unsupported verification source kind.' using errcode = '22023';
  end if;
  if p_source_url is null or p_source_url !~ '^https?://' then
    raise exception 'A valid source URL is required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_excerpt), '') is null or char_length(btrim(p_excerpt)) > 4000 then
    raise exception 'A source excerpt between 1 and 4000 characters is required.' using errcode = '22023';
  end if;
  if p_confidence not in ('unknown', 'low', 'medium', 'high', 'verified') then
    raise exception 'Unsupported evidence confidence.' using errcode = '22023';
  end if;
  if p_confidence_score is not null and (p_confidence_score < 0 or p_confidence_score > 1) then
    raise exception 'Evidence confidence score must be between 0 and 1.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select evidence.id
    into v_evidence_id
  from public.event_verification_evidence as evidence
  where evidence.verification_case_id = p_verification_case_id
    and evidence.proof_kind = p_proof_kind
    and evidence.source_url = p_source_url
    and coalesce(evidence.occurrence_year, 0) = coalesce(p_occurrence_year, 0)
    and coalesce(evidence.content_hash, '') = coalesce(p_content_hash, '')
  limit 1;

  if v_evidence_id is null then
    insert into public.event_verification_evidence (
      verification_case_id,
      source_snapshot_id,
      proof_kind,
      source_kind,
      source_url,
      source_title,
      excerpt,
      occurrence_year,
      is_official,
      confidence,
      confidence_score,
      content_hash,
      created_by
    ) values (
      p_verification_case_id,
      p_source_snapshot_id,
      p_proof_kind,
      p_source_kind,
      p_source_url,
      nullif(btrim(p_source_title), ''),
      btrim(p_excerpt),
      p_occurrence_year,
      coalesce(p_is_official, false),
      p_confidence,
      p_confidence_score,
      nullif(btrim(p_content_hash), ''),
      btrim(p_actor_identity)
    ) returning id into v_evidence_id;
    v_created := true;

    insert into public.event_verification_actions (
      verification_case_id,
      evidence_id,
      action_type,
      actor_identity,
      metadata
    ) values (
      p_verification_case_id,
      v_evidence_id,
      'evidence_added',
      btrim(p_actor_identity),
      jsonb_build_object('proof_kind', p_proof_kind, 'source_url', p_source_url)
    );
  end if;

  select
    count(distinct evidence.source_url) filter (where evidence.is_official and evidence.review_status <> 'rejected'),
    count(distinct evidence.source_url) filter (where not evidence.is_official and evidence.review_status <> 'rejected'),
    count(distinct evidence.occurrence_year) filter (
      where evidence.proof_kind in ('current_occurrence', 'prior_occurrence')
        and evidence.occurrence_year is not null
        and evidence.review_status <> 'rejected'
    )
  into v_official_count, v_supporting_count, v_occurrence_count
  from public.event_verification_evidence as evidence
  where evidence.verification_case_id = p_verification_case_id;

  v_existence := case
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind in ('official_identity', 'current_occurrence')
        and evidence.is_official
        and evidence.review_status <> 'rejected'
    ) then 'confirmed'
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind in ('official_identity', 'current_occurrence', 'independent_listing')
        and evidence.review_status <> 'rejected'
    ) then 'likely'
    else 'unverified'
  end;

  v_recurrence := case
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind = 'annual_language'
        and evidence.is_official
        and evidence.review_status <> 'rejected'
    ) or v_occurrence_count >= 2 then 'confirmed'
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind in ('annual_language', 'prior_occurrence')
        and evidence.review_status <> 'rejected'
    ) then 'likely'
    else 'unverified'
  end;

  v_dates := case
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind = 'current_dates'
        and coalesce(evidence.occurrence_year, v_case.target_year) = v_case.target_year
        and evidence.review_status <> 'rejected'
    ) then 'announced'
    else v_case.dates_status
  end;

  v_location := case
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind in ('venue', 'location')
        and evidence.is_official
        and evidence.review_status <> 'rejected'
    ) then 'confirmed'
    when exists (
      select 1 from public.event_verification_evidence as evidence
      where evidence.verification_case_id = p_verification_case_id
        and evidence.proof_kind in ('venue', 'location')
        and evidence.review_status <> 'rejected'
    ) then 'likely'
    else 'unknown'
  end;

  v_score := round((
    (case v_existence when 'confirmed' then 0.30 when 'likely' then 0.15 else 0 end)
    + (case v_recurrence when 'confirmed' then 0.30 when 'likely' then 0.15 else 0 end)
    + (case v_dates when 'announced' then 0.15 when 'not_announced' then 0.075 else 0 end)
    + (case v_location when 'confirmed' then 0.15 when 'likely' then 0.075 else 0 end)
    + (case when v_official_count >= 1 and v_supporting_count >= 1 then 0.10 when v_official_count >= 1 then 0.05 else 0 end)
  )::numeric, 3);

  update public.event_verification_cases
    set existence_status = v_existence,
        recurrence_status = v_recurrence,
        dates_status = v_dates,
        location_status = v_location,
        official_source_count = v_official_count,
        supporting_source_count = v_supporting_count,
        historical_occurrence_count = v_occurrence_count,
        verification_score = v_score,
        updated_at = now()
  where id = p_verification_case_id;

  return query select v_evidence_id, v_created, v_score;
end;
$$;

create or replace function public.atlas_transition_event_verification_case(
  p_verification_case_id uuid,
  p_action text,
  p_actor_identity text,
  p_notes text
)
returns table (
  verification_case_id uuid,
  status text,
  verification_score numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.event_verification_cases%rowtype;
  v_status text;
  v_action_type text;
begin
  select * into v_case
  from public.event_verification_cases
  where id = p_verification_case_id
  for update;
  if not found then
    raise exception 'Verification case was not found.' using errcode = 'P0002';
  end if;
  if p_action not in ('submit', 'verify', 'reject', 'reopen') then
    raise exception 'Unsupported verification action.' using errcode = '22023';
  end if;
  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  if p_action = 'submit' then
    if v_case.status <> 'collecting' then
      raise exception 'Only collecting verification cases can be submitted.' using errcode = '22023';
    end if;
    v_status := 'needs_review';
    v_action_type := 'submitted';
    update public.event_verification_cases
      set status = v_status,
          submitted_by = btrim(p_actor_identity),
          submitted_at = now(),
          updated_at = now()
    where id = p_verification_case_id;
  elsif p_action = 'verify' then
    if v_case.status <> 'needs_review' then
      raise exception 'Only submitted verification cases can be verified.' using errcode = '22023';
    end if;
    if v_case.existence_status <> 'confirmed'
       or v_case.recurrence_status <> 'confirmed'
       or v_case.location_status <> 'confirmed'
       or v_case.official_source_count < 1
       or v_case.supporting_source_count < 1 then
      raise exception 'Existence, annual recurrence, location, one official source, and one supporting source must be confirmed.' using errcode = '22023';
    end if;
    v_status := 'verified';
    v_action_type := 'verified';
    update public.event_verification_cases
      set status = v_status,
          verified_by = btrim(p_actor_identity),
          verified_at = now(),
          rejected_by = null,
          rejected_at = null,
          updated_at = now()
    where id = p_verification_case_id;
  elsif p_action = 'reject' then
    if v_case.status not in ('collecting', 'needs_review') then
      raise exception 'Only open verification cases can be rejected.' using errcode = '22023';
    end if;
    v_status := 'rejected';
    v_action_type := 'rejected';
    update public.event_verification_cases
      set status = v_status,
          rejected_by = btrim(p_actor_identity),
          rejected_at = now(),
          updated_at = now()
    where id = p_verification_case_id;
  else
    if v_case.status not in ('needs_review', 'verified', 'rejected', 'stale') then
      raise exception 'This verification case cannot be reopened.' using errcode = '22023';
    end if;
    v_status := 'collecting';
    v_action_type := 'reopened';
    update public.event_verification_cases
      set status = v_status,
          verified_by = null,
          verified_at = null,
          rejected_by = null,
          rejected_at = null,
          updated_at = now()
    where id = p_verification_case_id;
  end if;

  insert into public.event_verification_actions (
    verification_case_id, action_type, actor_identity, notes
  ) values (
    p_verification_case_id, v_action_type, btrim(p_actor_identity), nullif(btrim(p_notes), '')
  );

  return query
  select verification.id, verification.status, verification.verification_score
  from public.event_verification_cases as verification
  where verification.id = p_verification_case_id;
end;
$$;

create or replace function public.atlas_list_event_verification_cases(p_limit integer default 100)
returns table (
  verification_case_id uuid,
  candidate_id uuid,
  event_id uuid,
  event_name text,
  event_slug text,
  target_year integer,
  status text,
  existence_status text,
  recurrence_status text,
  dates_status text,
  location_status text,
  official_source_count integer,
  supporting_source_count integer,
  historical_occurrence_count integer,
  verification_score numeric,
  evidence_count bigint,
  created_at timestamptz,
  updated_at timestamptz,
  verified_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    verification.id,
    verification.candidate_id,
    verification.event_id,
    coalesce(event_row.name, candidate.candidate_name),
    coalesce(event_row.slug, candidate.slug_candidate),
    verification.target_year,
    verification.status,
    verification.existence_status,
    verification.recurrence_status,
    verification.dates_status,
    verification.location_status,
    verification.official_source_count,
    verification.supporting_source_count,
    verification.historical_occurrence_count,
    verification.verification_score,
    count(evidence.id),
    verification.created_at,
    verification.updated_at,
    verification.verified_at
  from public.event_verification_cases as verification
  left join public.event_candidates as candidate on candidate.id = verification.candidate_id
  left join public.events as event_row on event_row.id = verification.event_id
  left join public.event_verification_evidence as evidence
    on evidence.verification_case_id = verification.id
   and evidence.review_status <> 'rejected'
  group by verification.id, candidate.id, event_row.id
  order by
    case verification.status
      when 'needs_review' then 0
      when 'collecting' then 1
      when 'stale' then 2
      when 'verified' then 3
      else 4
    end,
    verification.updated_at desc
  limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

revoke all on function public.atlas_create_event_verification_case(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.atlas_add_event_verification_evidence(uuid, uuid, text, text, text, text, text, integer, boolean, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.atlas_transition_event_verification_case(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_list_event_verification_cases(integer) from public, anon, authenticated;

grant execute on function public.atlas_create_event_verification_case(uuid, uuid, integer, text) to service_role;
grant execute on function public.atlas_add_event_verification_evidence(uuid, uuid, text, text, text, text, text, integer, boolean, text, numeric, text, text) to service_role;
grant execute on function public.atlas_transition_event_verification_case(uuid, text, text, text) to service_role;
grant execute on function public.atlas_list_event_verification_cases(integer) to service_role;
