-- Let one retained official source clear a deterministic private verification
-- case when it proves identity, current dates, location, and annual recurrence.
-- Supporting sources remain useful evidence but are not a mandatory gate.

begin;

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
  v_refreshed_id uuid;
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
  perform public.atlas_assert_service_role();

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
  else
    update public.event_verification_evidence as evidence
      set source_snapshot_id = coalesce(evidence.source_snapshot_id, p_source_snapshot_id),
          source_kind = case
            when coalesce(p_is_official, false) then p_source_kind
            else evidence.source_kind
          end,
          source_title = coalesce(evidence.source_title, nullif(btrim(p_source_title), '')),
          excerpt = case
            when coalesce(p_is_official, false) and not evidence.is_official
              then btrim(p_excerpt)
            else evidence.excerpt
          end,
          is_official = evidence.is_official or coalesce(p_is_official, false),
          confidence = case
            when array_position(
              array['unknown', 'low', 'medium', 'high', 'verified'],
              p_confidence
            ) > array_position(
              array['unknown', 'low', 'medium', 'high', 'verified'],
              evidence.confidence
            ) then p_confidence
            else evidence.confidence
          end,
          confidence_score = case
            when evidence.confidence_score is null then p_confidence_score
            when p_confidence_score is null then evidence.confidence_score
            else greatest(evidence.confidence_score, p_confidence_score)
          end
    where evidence.id = v_evidence_id
      and (
        (coalesce(p_is_official, false) and not evidence.is_official)
        or (evidence.source_snapshot_id is null and p_source_snapshot_id is not null)
        or (
          array_position(
            array['unknown', 'low', 'medium', 'high', 'verified'],
            p_confidence
          ) > array_position(
            array['unknown', 'low', 'medium', 'high', 'verified'],
            evidence.confidence
          )
        )
        or (
          p_confidence_score is not null
          and (
            evidence.confidence_score is null
            or p_confidence_score > evidence.confidence_score
          )
        )
      )
    returning evidence.id into v_refreshed_id;

    if v_refreshed_id is not null then
      insert into public.event_verification_actions (
        verification_case_id,
        evidence_id,
        action_type,
        actor_identity,
        metadata
      ) values (
        p_verification_case_id,
        v_evidence_id,
        'refreshed',
        btrim(p_actor_identity),
        jsonb_build_object(
          'proof_kind', p_proof_kind,
          'source_url', p_source_url,
          'official', coalesce(p_is_official, false)
        )
      );
    end if;
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
    )
    or v_occurrence_count >= 2
    or (
      exists (
        select 1 from public.event_verification_evidence as evidence
        where evidence.verification_case_id = p_verification_case_id
          and evidence.proof_kind = 'annual_language'
          and evidence.confidence in ('high', 'verified')
          and evidence.review_status <> 'rejected'
      )
      and exists (
        select 1 from public.event_verification_evidence as evidence
        where evidence.verification_case_id = p_verification_case_id
          and evidence.proof_kind = 'current_occurrence'
          and evidence.is_official
          and coalesce(evidence.occurrence_year, v_case.target_year) = v_case.target_year
          and evidence.review_status <> 'rejected'
      )
    ) then 'confirmed'
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
  perform public.atlas_assert_service_role();

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
       or v_case.dates_status <> 'announced'
       or v_case.location_status <> 'confirmed'
       or v_case.official_source_count < 1 then
      raise exception 'Official identity, annual recurrence, current dates, location, and one official source must be confirmed.' using errcode = '22023';
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
    'sources', v_case.official_source_count >= 1,
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
    and package.supersedes_package_id is null
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
      target_year, event_key, slug, status, package_version, canonical_profile, map_record,
      page_manifest, scout_context, art_brief, art_asset, readiness_checks,
      readiness_score, content_hash, created_by, ready_at, supersedes_package_id
    ) values (
      v_case.id, v_case.candidate_id, v_case.event_id, p_source_bundle_id, p_synthesis_id,
      v_case.target_year, p_event_key, p_slug, v_status, 1, p_canonical_profile, p_map_record,
      p_page_manifest, p_scout_context, p_art_brief, p_art_asset, v_checks,
      v_score, p_content_hash, btrim(p_actor_identity),
      case when v_status = 'ready_for_review' then now() else null end, null
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

revoke all on function public.atlas_add_event_verification_evidence(uuid, uuid, text, text, text, text, text, integer, boolean, text, numeric, text, text) from public, anon, authenticated;
revoke all on function public.atlas_transition_event_verification_case(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.atlas_upsert_event_factory_package(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) from public, anon, authenticated;

grant execute on function public.atlas_add_event_verification_evidence(uuid, uuid, text, text, text, text, text, integer, boolean, text, numeric, text, text) to service_role;
grant execute on function public.atlas_transition_event_verification_case(uuid, text, text, text) to service_role;
grant execute on function public.atlas_upsert_event_factory_package(uuid, uuid, uuid, text, text, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, text, text) to service_role;

commit;
