-- Bring migration 004 candidate intake in line with the current discovery schema.

create or replace function public.atlas_intake_event_candidate(
  p_actor_type text,
  p_actor_identity text,
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
  v_run public.atlas_operation_runs;
  v_action_id uuid;
  v_candidate_id uuid;
  v_discovery_run_id uuid;
  v_source jsonb;
  v_source_urls jsonb;
  v_status text;
begin
  perform public.atlas_assert_service_role();
  perform public.atlas_require_source_evidence(p_sources);

  if p_actor_type not in ('human', 'automation', 'system') then
    raise exception 'Unsupported Atlas actor type.' using errcode = '22023';
  end if;

  v_run := public.atlas_start_operation(
    'candidate_intake',
    p_actor_type,
    p_actor_identity,
    p_idempotency_key,
    jsonb_build_object('candidate', p_candidate, 'sources', p_sources)
  );

  if v_run.completed_at is not null and v_run.status = 'succeeded' then
    return v_run.summary || jsonb_build_object(
      'operation_run_id', v_run.id,
      'idempotent_replay', true
    );
  end if;

  insert into public.atlas_operation_actions (
    operation_run_id,
    action_type,
    lifecycle_state,
    source_references,
    requested_payload,
    reason
  ) values (
    v_run.id,
    'candidate_intake',
    'proposed',
    p_sources,
    p_candidate,
    'Source-backed candidate intake requested.'
  ) returning id into v_action_id;

  select coalesce(jsonb_agg(source->>'source_url'), '[]'::jsonb)
    into v_source_urls
  from jsonb_array_elements(p_sources) as source;

  select candidate.id
    into v_candidate_id
  from public.event_candidates as candidate
  where candidate.slug_candidate = p_candidate->>'slug_candidate'
  order by candidate.created_at desc
  limit 1;

  if v_candidate_id is null then
    insert into public.discovery_runs (
      run_type,
      status,
      started_at,
      completed_at,
      items_found,
      candidates_created,
      duplicates_flagged,
      approval_required,
      approval_status,
      notes,
      run_metadata
    ) values (
      'control_plane_intake',
      'completed',
      now(),
      now(),
      1,
      1,
      0,
      false,
      'not_required',
      'Source-backed candidate created through Atlas Control.',
      jsonb_build_object(
        'operation_run_id', v_run.id,
        'actor_type', p_actor_type,
        'actor_identity', p_actor_identity,
        'state', coalesce(p_candidate->>'state', 'Michigan')
      )
    ) returning id into v_discovery_run_id;

    insert into public.event_candidates (
      discovery_run_id,
      candidate_name,
      normalized_name,
      slug_candidate,
      event_type,
      category,
      subcategory,
      city,
      county,
      state,
      country,
      venue_name,
      start_date,
      end_date,
      typical_month,
      typical_season,
      probable_recurrence,
      description,
      official_website_candidate,
      social_links,
      source_urls,
      discovery_confidence,
      verification_status,
      duplicate_status,
      needs_review,
      semantic_notes,
      raw_payload
    ) values (
      v_discovery_run_id,
      p_candidate->>'candidate_name',
      coalesce(nullif(p_candidate->>'normalized_name', ''), lower(p_candidate->>'candidate_name')),
      p_candidate->>'slug_candidate',
      coalesce(nullif(p_candidate->>'event_type', ''), 'unknown'),
      nullif(p_candidate->>'category', ''),
      nullif(p_candidate->>'subcategory', ''),
      nullif(p_candidate->>'city', ''),
      nullif(p_candidate->>'county', ''),
      coalesce(nullif(p_candidate->>'state', ''), 'Michigan'),
      coalesce(nullif(p_candidate->>'country', ''), 'USA'),
      nullif(p_candidate->>'venue_name', ''),
      nullif(p_candidate->>'start_date', '')::date,
      nullif(p_candidate->>'end_date', '')::date,
      nullif(p_candidate->>'typical_month', ''),
      nullif(p_candidate->>'typical_season', ''),
      nullif(p_candidate->>'probable_recurrence', ''),
      nullif(p_candidate->>'description', ''),
      nullif(p_candidate->>'official_website_candidate', ''),
      coalesce(p_candidate->'social_links', '[]'::jsonb),
      v_source_urls,
      coalesce((p_candidate->>'discovery_confidence')::numeric, 0.70),
      'needs_review',
      coalesce(nullif(p_candidate->>'duplicate_status', ''), 'unchecked'),
      true,
      nullif(p_candidate->>'semantic_notes', ''),
      p_candidate
    ) returning id into v_candidate_id;
    v_status := 'created';
  else
    update public.event_candidates as candidate
      set candidate_name = coalesce(nullif(p_candidate->>'candidate_name', ''), candidate.candidate_name),
          normalized_name = coalesce(nullif(p_candidate->>'normalized_name', ''), candidate.normalized_name),
          event_type = coalesce(nullif(p_candidate->>'event_type', ''), candidate.event_type),
          category = coalesce(nullif(p_candidate->>'category', ''), candidate.category),
          subcategory = coalesce(nullif(p_candidate->>'subcategory', ''), candidate.subcategory),
          city = coalesce(nullif(p_candidate->>'city', ''), candidate.city),
          county = coalesce(nullif(p_candidate->>'county', ''), candidate.county),
          venue_name = coalesce(nullif(p_candidate->>'venue_name', ''), candidate.venue_name),
          start_date = coalesce(nullif(p_candidate->>'start_date', '')::date, candidate.start_date),
          end_date = coalesce(nullif(p_candidate->>'end_date', '')::date, candidate.end_date),
          typical_month = coalesce(nullif(p_candidate->>'typical_month', ''), candidate.typical_month),
          typical_season = coalesce(nullif(p_candidate->>'typical_season', ''), candidate.typical_season),
          probable_recurrence = coalesce(nullif(p_candidate->>'probable_recurrence', ''), candidate.probable_recurrence),
          description = coalesce(nullif(p_candidate->>'description', ''), candidate.description),
          official_website_candidate = coalesce(nullif(p_candidate->>'official_website_candidate', ''), candidate.official_website_candidate),
          social_links = case when p_candidate ? 'social_links' then p_candidate->'social_links' else candidate.social_links end,
          source_urls = coalesce(candidate.source_urls, '[]'::jsonb) || v_source_urls,
          discovery_confidence = greatest(candidate.discovery_confidence, coalesce((p_candidate->>'discovery_confidence')::numeric, candidate.discovery_confidence)),
          raw_payload = coalesce(candidate.raw_payload, '{}'::jsonb) || p_candidate,
          needs_review = true,
          updated_at = now()
    where candidate.id = v_candidate_id;
    v_status := 'updated';
  end if;

  for v_source in select * from jsonb_array_elements(p_sources) loop
    insert into public.event_candidate_sources (
      candidate_id,
      source_name,
      source_url,
      source_type,
      source_excerpt,
      trust_score,
      last_accessed
    )
    select
      v_candidate_id,
      v_source->>'source_name',
      v_source->>'source_url',
      coalesce(v_source->>'source_type', 'official'),
      v_source->>'source_excerpt',
      coalesce((v_source->>'trust_score')::numeric, 0.90),
      now()
    where not exists (
      select 1
      from public.event_candidate_sources as existing
      where existing.candidate_id = v_candidate_id
        and existing.source_url = v_source->>'source_url'
    );
  end loop;

  update public.atlas_operation_actions
    set lifecycle_state = 'applied',
        target_entity_type = 'event_candidate',
        target_entity_id = v_candidate_id,
        applied_payload = jsonb_build_object('candidate_id', v_candidate_id, 'status', v_status),
        after_snapshot = (
          select to_jsonb(candidate)
          from public.event_candidates as candidate
          where candidate.id = v_candidate_id
        ),
        applied_at = now()
  where id = v_action_id;

  update public.atlas_operation_runs
    set status = 'succeeded',
        summary = jsonb_build_object('candidate_id', v_candidate_id, 'status', v_status),
        completed_at = now()
  where id = v_run.id;

  return jsonb_build_object(
    'operation_run_id', v_run.id,
    'action_id', v_action_id,
    'candidate_id', v_candidate_id,
    'status', v_status
  );
exception when others then
  if v_run.id is not null then
    update public.atlas_operation_runs
      set status = 'failed',
          error = jsonb_build_object('message', sqlerrm, 'sqlstate', sqlstate),
          completed_at = now()
    where id = v_run.id;
  end if;
  raise;
end;
$$;

revoke execute on function public.atlas_intake_event_candidate(text, text, text, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.atlas_intake_event_candidate(text, text, text, jsonb, jsonb) to service_role;
