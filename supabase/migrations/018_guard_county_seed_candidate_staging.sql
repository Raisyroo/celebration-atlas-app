-- REVIEW-ONLY IN PHASE C1. Do not apply until an explicit schema-change approval.
--
-- Fresh read-only scan on 2026-07-27:
--   event_candidates: 23, duplicate non-null slugs: 0
--   event_candidate_sources: 40, duplicate candidate/source pairs: 0
--   atlas_operation_runs: 7, duplicate operation identities: 0
--   exact county-seed identities: 0
--
-- The DO block is a deployment-time precondition. It fails before any index or
-- function change if the deployed data has changed since the review snapshot.

do $$
begin
  if exists (
    select 1
    from public.event_candidates
    where nullif(btrim(slug_candidate), '') is not null
    group by slug_candidate
    having count(*) > 1
  ) then
    raise exception 'Cannot guard county staging: duplicate candidate slugs exist.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidate_sources
    group by candidate_id, source_url
    having count(*) > 1
  ) then
    raise exception 'Cannot guard county staging: duplicate candidate/source associations exist.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidates
    where nullif(btrim(raw_payload #>> '{county_seed,county_code}'), '') is not null
      and nullif(btrim(raw_payload #>> '{county_seed,clean_id}'), '') is not null
    group by
      lower(raw_payload #>> '{county_seed,county_code}'),
      raw_payload #>> '{county_seed,clean_id}'
    having count(*) > 1
  ) then
    raise exception 'Cannot guard county staging: duplicate exact county-seed identities exist.'
      using errcode = '23505';
  end if;
end;
$$;

create unique index event_candidates_slug_candidate_uidx
  on public.event_candidates (slug_candidate)
  where nullif(btrim(slug_candidate), '') is not null;

create unique index event_candidate_sources_candidate_url_uidx
  on public.event_candidate_sources (candidate_id, source_url);

create unique index event_candidates_county_seed_identity_uidx
  on public.event_candidates (
    lower(raw_payload #>> '{county_seed,county_code}'),
    (raw_payload #>> '{county_seed,clean_id}')
  )
  where nullif(btrim(raw_payload #>> '{county_seed,county_code}'), '') is not null
    and nullif(btrim(raw_payload #>> '{county_seed,clean_id}'), '') is not null;

create or replace function public.atlas_stage_county_seed_candidate(
  p_actor_identity text,
  p_batch_id text,
  p_manifest_hash text,
  p_payload_hash text,
  p_idempotency_key text,
  p_candidate jsonb,
  p_sources jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_run public.atlas_operation_runs;
  v_existing_candidate public.event_candidates;
  v_candidate jsonb;
  v_county_code text := lower(nullif(btrim(p_candidate #>> '{county_seed,county_code}'), ''));
  v_clean_id text := nullif(btrim(p_candidate #>> '{county_seed,clean_id}'), '');
  v_slug text := nullif(btrim(p_candidate->>'slug_candidate'), '');
  v_name text := lower(nullif(btrim(p_candidate->>'normalized_name'), ''));
  v_city text := lower(nullif(btrim(p_candidate->>'city'), ''));
  v_shared_url_clean_ids jsonb := coalesce(
    p_candidate #> '{county_seed,cohort_relationships,shared_official_url_clean_ids}',
    '[]'::jsonb
  );
  v_url_identity text := regexp_replace(
    regexp_replace(lower(nullif(btrim(p_candidate->>'official_website_candidate'), '')), '^https?://(www\.)?', ''),
    '/+$',
    ''
  );
begin
  perform public.atlas_assert_service_role();
  perform public.atlas_require_source_evidence(p_sources);

  if nullif(btrim(p_actor_identity), '') is null then
    raise exception 'County staging requires an actor identity.' using errcode = '22023';
  end if;
  if nullif(btrim(p_batch_id), '') is null
     or p_batch_id is distinct from p_candidate #>> '{county_seed,batch_id}' then
    raise exception 'County staging batch identity mismatch.' using errcode = '22023';
  end if;
  if p_manifest_hash !~ '^[0-9a-f]{64}$'
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'County staging requires lowercase SHA-256 manifest and payload hashes.'
      using errcode = '22023';
  end if;
  if p_payload_hash is distinct from p_candidate #>> '{county_seed,payload_hash}' then
    raise exception 'County staging payload hash field mismatch.' using errcode = '22023';
  end if;
  if v_county_code is null or v_clean_id is null or v_slug is null or v_name is null or v_city is null then
    raise exception 'County staging identity fields are incomplete.' using errcode = '22023';
  end if;
  if not jsonb_path_exists(
    p_candidate,
    '$.county_seed.resolved_decision ? (@.phase_c1_disposition == "provisional_batch_1_manifest_only")'
  ) then
    raise exception 'County staging requires the reviewed Batch 1 disposition.' using errcode = '22023';
  end if;

  -- Serialize all guarded attempts for this idempotency identity.
  perform pg_advisory_xact_lock(hashtextextended('county_seed:' || p_idempotency_key, 0));

  select *
    into v_existing_run
  from public.atlas_operation_runs
  where operation_type = 'candidate_intake'
    and idempotency_key = p_idempotency_key
  for update;

  if v_existing_run.id is not null then
    if v_existing_run.request #>> '{candidate,county_seed,payload_hash}' is distinct from p_payload_hash then
      raise exception 'County staging equivalence conflict: idempotency key has a different payload hash.'
        using errcode = '23505';
    end if;
    if v_existing_run.status <> 'succeeded' then
      raise exception 'County staging outcome is uncertain for existing operation % (%).',
        v_existing_run.id,
        v_existing_run.status
        using errcode = '55000';
    end if;
  end if;

  select *
    into v_existing_candidate
  from public.event_candidates
  where lower(raw_payload #>> '{county_seed,county_code}') = v_county_code
    and raw_payload #>> '{county_seed,clean_id}' = v_clean_id
  for update;

  if v_existing_candidate.id is not null then
    if v_existing_candidate.raw_payload #>> '{county_seed,payload_hash}' is distinct from p_payload_hash
       or v_existing_candidate.slug_candidate is distinct from v_slug then
      raise exception 'County staging equivalence conflict: exact county identity has a different payload.'
        using errcode = '23505';
    end if;
    if v_existing_candidate.matched_event_id is not null
       or v_existing_candidate.verification_status = 'promoted' then
      raise exception 'County staging rejected: the equivalent candidate is already promoted.'
        using errcode = '23505';
    end if;
    if v_existing_run.id is null then
      return jsonb_build_object(
        'operation_run_id', null,
        'candidate_id', v_existing_candidate.id,
        'status', 'updated',
        'idempotent_replay', true
      );
    end if;
  end if;

  if exists (
    select 1
    from public.events as event
    where (
      v_url_identity <> ''
      and jsonb_array_length(v_shared_url_clean_ids) <= 1
      and regexp_replace(
        regexp_replace(lower(coalesce(event.official_website, '')), '^https?://(www\.)?', ''),
        '/+$',
        ''
      ) = v_url_identity
    ) or (
      lower(event.name) = v_name
      and lower(coalesce(event.city, '')) = v_city
    ) or (
      lower(coalesce(event.city, '')) = v_city
      and exists (
        select 1
        from jsonb_array_elements_text(coalesce(p_candidate #> '{county_seed,normalized_aliases}', '[]'::jsonb)) as alias(value)
        where alias.value = lower(event.name)
      )
    )
  ) then
    raise exception 'County staging rejected: deterministic canonical identity exists.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidates as candidate
    where candidate.id is distinct from v_existing_candidate.id
      and (
        candidate.slug_candidate = v_slug
        or (
          v_url_identity <> ''
          and regexp_replace(
            regexp_replace(lower(coalesce(candidate.official_website_candidate, '')), '^https?://(www\.)?', ''),
            '/+$',
            ''
          ) = v_url_identity
          and not exists (
            select 1
            from jsonb_array_elements_text(v_shared_url_clean_ids) as shared(clean_id)
            where shared.clean_id = candidate.raw_payload #>> '{county_seed,clean_id}'
          )
        )
        or (
          lower(coalesce(candidate.normalized_name, candidate.candidate_name)) = v_name
          and lower(coalesce(candidate.city, '')) = v_city
        )
        or (
          lower(coalesce(candidate.city, '')) = v_city
          and exists (
            select 1
            from jsonb_array_elements_text(coalesce(p_candidate #> '{county_seed,normalized_aliases}', '[]'::jsonb)) as alias(value)
            where alias.value = lower(coalesce(candidate.normalized_name, candidate.candidate_name))
          )
        )
      )
  ) then
    raise exception 'County staging rejected: deterministic candidate identity exists.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidate_sources as source
    join public.event_candidates as owner on owner.id = source.candidate_id
    where regexp_replace(
      regexp_replace(lower(source.source_url), '^https?://(www\.)?', ''),
      '/+$',
      ''
    ) = v_url_identity
      and source.candidate_id is distinct from v_existing_candidate.id
      and not exists (
        select 1
        from jsonb_array_elements_text(v_shared_url_clean_ids) as shared(clean_id)
        where shared.clean_id = owner.raw_payload #>> '{county_seed,clean_id}'
      )
  ) then
    raise exception 'County staging rejected: official source is attached to another candidate.'
      using errcode = '23505';
  end if;

  v_candidate := jsonb_set(
    p_candidate,
    '{county_seed,manifest_hash}',
    to_jsonb(p_manifest_hash),
    true
  );

  return public.atlas_intake_event_candidate(
    'human',
    p_actor_identity,
    p_idempotency_key,
    v_candidate,
    p_sources
  );
end;
$$;

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

-- Rollback (review and execute only in a separately approved schema task):
--   drop function public.atlas_stage_county_seed_candidate(text,text,text,text,text,jsonb,jsonb);
--   drop index public.event_candidates_county_seed_identity_uidx;
--   drop index public.event_candidate_sources_candidate_url_uidx;
--   drop index public.event_candidates_slug_candidate_uidx;
