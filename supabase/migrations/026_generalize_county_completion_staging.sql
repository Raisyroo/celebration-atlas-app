-- Extend the guarded county-seed staging contract for reviewed county
-- completion manifests. Historical pilot values remain valid only for their
-- retained immutable payloads. The new value additionally requires explicit
-- private-write authorization and an immutable reviewed-inventory hash.

begin;

do $migration$
declare
  v_function regprocedure := to_regprocedure(
    'public.atlas_stage_county_seed_candidate(text,text,text,text,text,jsonb,jsonb)'
  );
  v_definition text;
  v_old_scope_check constant text := $old$
  if coalesce(
    p_candidate #>> '{county_seed,resolved_decision,phase_c1_disposition}',
    ''
  ) not in (
    'provisional_batch_1_manifest_only',
    'revised_three_event_pilot_manifest_only'
  ) then
    raise exception 'County staging requires an approved county-seed manifest disposition.'
      using errcode = '22023';
  end if;$old$;
  v_new_scope_check constant text := $new$
  if coalesce(
    p_candidate #>> '{county_seed,resolved_decision,phase_c1_disposition}',
    ''
  ) not in (
    'provisional_batch_1_manifest_only',
    'revised_three_event_pilot_manifest_only',
    'reviewed_county_completion_manifest'
  ) then
    raise exception 'County staging requires an approved county-seed manifest disposition.'
      using errcode = '22023';
  end if;
  if p_candidate #>> '{county_seed,resolved_decision,phase_c1_disposition}'
       = 'reviewed_county_completion_manifest'
     and (
       p_candidate #>> '{county_seed,resolved_decision,execution_approval}'
         is distinct from 'private_writes_explicitly_authorized'
       or coalesce(
         p_candidate #>> '{county_seed,resolved_decision,reviewed_inventory_hash}',
         ''
       ) !~ '^[0-9a-f]{64}$'
     ) then
    raise exception
      'Reviewed county completion staging requires explicit private authorization and an immutable inventory hash.'
      using errcode = '22023';
  end if;$new$;
  v_match_count integer;
begin
  if v_function is null then
    raise exception 'Migration 026 requires the guarded county staging RPC.'
      using errcode = '55000';
  end if;

  select pg_get_functiondef(v_function)
    into v_definition;

  v_match_count := (
    length(v_definition) - length(replace(v_definition, v_old_scope_check, ''))
  ) / length(v_old_scope_check);
  if v_match_count <> 1 then
    raise exception
      'Migration 026 expected exactly one migration-019 staging predicate; found %.',
      v_match_count
      using errcode = '55000';
  end if;
  if position('reviewed_county_completion_manifest' in v_definition) > 0 then
    raise exception 'Migration 026 county-completion scope is already present.'
      using errcode = '55000';
  end if;

  v_definition := replace(v_definition, v_old_scope_check, v_new_scope_check);
  execute v_definition;

  select pg_get_functiondef(v_function)
    into v_definition;
  if position('provisional_batch_1_manifest_only' in v_definition) = 0
     or position('revised_three_event_pilot_manifest_only' in v_definition) = 0
     or position('reviewed_county_completion_manifest' in v_definition) = 0
     or position('private_writes_explicitly_authorized' in v_definition) = 0
     or position('reviewed_inventory_hash' in v_definition) = 0
     or position(v_old_scope_check in v_definition) > 0 then
    raise exception 'Migration 026 failed to install the reviewed county scope.'
      using errcode = '55000';
  end if;
end;
$migration$;

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

create unique index atlas_county_completion_identity_clearance_run_candidate_uidx
  on public.atlas_operation_actions (operation_run_id, target_entity_id)
  where action_type = 'michigan_completion_candidate_identity_cleared'
    and target_entity_type = 'event_candidate';

create or replace function public.atlas_clear_county_completion_candidate_identity(
  p_run_id uuid,
  p_candidate_id uuid,
  p_identity_input_hash text,
  p_actor_identity text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_candidate public.event_candidates;
  v_action public.atlas_operation_actions;
  v_county_code text;
  v_clean_id text;
  v_name text;
  v_city text;
  v_slug text;
  v_url_identity text;
  v_shared_url_clean_ids jsonb;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null
     or p_candidate_id is null
     or p_identity_input_hash is null
     or p_identity_input_hash !~ '^[0-9a-f]{64}$'
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception
      'County completion identity clearance requires run, candidate, input hash, actor, and reason.'
      using errcode = '22023';
  end if;
  if pg_catalog.char_length(pg_catalog.btrim(p_reason)) > 2000 then
    raise exception 'County completion identity clearance reason is too long.'
      using errcode = '22023';
  end if;

  select run.*
    into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
  for update;
  if not found
     or v_run.operation_type <> 'michigan_completion_v1'
     or coalesce((v_run.request->>'dryRun')::boolean, true)
     or not coalesce((v_run.request->>'deterministicOnly')::boolean, false) then
    raise exception
      'Identity clearance requires an authorized deterministic private Michigan completion run.'
      using errcode = '42501';
  end if;

  select action.*
    into v_action
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.target_entity_type = 'event_candidate'
    and action.target_entity_id = p_candidate_id::text
    and action.action_type = 'michigan_completion_candidate_identity_cleared'
  for update;
  if found then
    if v_action.requested_payload->>'identityInputHash'
         is distinct from p_identity_input_hash then
      raise exception
        'County completion identity clearance replay conflicts with the retained input hash.'
        using errcode = '23505';
    end if;
    return pg_catalog.jsonb_build_object(
      'candidate_id', p_candidate_id,
      'action_id', v_action.id,
      'identity_cleared', true,
      'exact_replay', true,
      'canonical_event_id', null
    );
  end if;

  select candidate.*
    into v_candidate
  from public.event_candidates as candidate
  where candidate.id = p_candidate_id
  for update;
  if not found then
    raise exception 'County completion identity candidate was not found.'
      using errcode = 'P0002';
  end if;

  v_county_code := lower(nullif(pg_catalog.btrim(
    v_candidate.raw_payload #>> '{county_seed,county_code}'
  ), ''));
  v_clean_id := nullif(pg_catalog.btrim(
    v_candidate.raw_payload #>> '{county_seed,clean_id}'
  ), '');
  v_name := regexp_replace(
    lower(coalesce(v_candidate.normalized_name, v_candidate.candidate_name)),
    '[^a-z0-9]+',
    ' ',
    'g'
  );
  v_city := regexp_replace(
    lower(coalesce(v_candidate.city, '')),
    '[^a-z0-9]+',
    ' ',
    'g'
  );
  v_slug := nullif(pg_catalog.btrim(v_candidate.slug_candidate), '');
  v_url_identity := regexp_replace(
    regexp_replace(
      lower(coalesce(v_candidate.official_website_candidate, '')),
      '^https?://(www\.)?',
      ''
    ),
    '/+$',
    ''
  );
  v_shared_url_clean_ids := coalesce(
    v_candidate.raw_payload
      #> '{county_seed,cohort_relationships,shared_official_url_clean_ids}',
    '[]'::jsonb
  );

  if v_county_code is null
     or v_clean_id is null
     or v_slug is null
     or v_name = ''
     or v_city = ''
     or v_url_identity = '' then
    raise exception 'County completion candidate identity is incomplete.'
      using errcode = '22023';
  end if;
  if v_candidate.raw_payload
       #>> '{county_seed,resolved_decision,phase_c1_disposition}'
       is distinct from 'reviewed_county_completion_manifest'
     or v_candidate.raw_payload
       #>> '{county_seed,resolved_decision,execution_approval}'
       is distinct from 'private_writes_explicitly_authorized'
     or coalesce(
       v_candidate.raw_payload
         #>> '{county_seed,resolved_decision,reviewed_inventory_hash}',
       ''
     ) !~ '^[0-9a-f]{64}$' then
    raise exception
      'Candidate is outside the reviewed county-completion identity scope.'
      using errcode = '42501';
  end if;
  if v_candidate.matched_event_id is not null
     or v_candidate.verification_status = 'promoted'
     or v_candidate.duplicate_status not in ('unchecked', 'unique_candidate') then
    raise exception
      'Candidate identity cannot be cleared from its current canonical or duplicate state.'
      using errcode = '23505';
  end if;
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_run.request->'events') as event
    where event #>> '{countySeed,candidate,county_seed,county_code}'
        = v_county_code
      and event #>> '{countySeed,candidate,county_seed,clean_id}'
        = v_clean_id
      and event #>> '{countySeed,candidate,county_seed,payload_hash}'
        = v_candidate.raw_payload #>> '{county_seed,payload_hash}'
  ) then
    raise exception
      'Candidate is not bound to the immutable county completion run.'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.events as event
    where (
      pg_catalog.jsonb_array_length(v_shared_url_clean_ids) <= 1
      and regexp_replace(
        regexp_replace(
          lower(coalesce(event.official_website, '')),
          '^https?://(www\.)?',
          ''
        ),
        '/+$',
        ''
      ) = v_url_identity
    ) or (
      regexp_replace(lower(event.name), '[^a-z0-9]+', ' ', 'g') = v_name
      and regexp_replace(
        lower(coalesce(event.city, '')),
        '[^a-z0-9]+',
        ' ',
        'g'
      ) = v_city
    ) or event.slug = v_slug
  ) then
    raise exception
      'Deterministic canonical identity collision requires human review.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidates as candidate
    where candidate.id <> p_candidate_id
      and (
        candidate.slug_candidate = v_slug
        or (
          regexp_replace(
            lower(coalesce(candidate.normalized_name, candidate.candidate_name)),
            '[^a-z0-9]+',
            ' ',
            'g'
          ) = v_name
          and regexp_replace(
            lower(coalesce(candidate.city, '')),
            '[^a-z0-9]+',
            ' ',
            'g'
          ) = v_city
        )
        or (
          regexp_replace(
            regexp_replace(
              lower(coalesce(candidate.official_website_candidate, '')),
              '^https?://(www\.)?',
              ''
            ),
            '/+$',
            ''
          ) = v_url_identity
          and not exists (
            select 1
            from pg_catalog.jsonb_array_elements_text(
              v_shared_url_clean_ids
            ) as shared(clean_id)
            where shared.clean_id =
              candidate.raw_payload #>> '{county_seed,clean_id}'
          )
        )
      )
  ) then
    raise exception
      'Deterministic candidate identity collision requires human review.'
      using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidate_sources as source
    join public.event_candidates as owner
      on owner.id = source.candidate_id
    where source.candidate_id <> p_candidate_id
      and regexp_replace(
        regexp_replace(lower(source.source_url), '^https?://(www\.)?', ''),
        '/+$',
        ''
      ) = v_url_identity
      and not exists (
        select 1
        from pg_catalog.jsonb_array_elements_text(
          v_shared_url_clean_ids
        ) as shared(clean_id)
        where shared.clean_id =
          owner.raw_payload #>> '{county_seed,clean_id}'
      )
  ) then
    raise exception
      'Official source ownership collision requires human review.'
      using errcode = '23505';
  end if;

  update public.event_candidates
  set duplicate_status = 'unique_candidate',
      needs_review = false,
      raw_payload = pg_catalog.jsonb_set(
        raw_payload,
        '{county_seed,identity_clearance}',
        pg_catalog.jsonb_build_object(
          'contract_version', 1,
          'disposition', 'deterministic_clean_no_collision',
          'run_id', p_run_id,
          'identity_input_hash', p_identity_input_hash,
          'actor_identity', pg_catalog.btrim(p_actor_identity),
          'reason', pg_catalog.btrim(p_reason),
          'cleared_at', now(),
          'canonical_event_id', null,
          'merge_attempted', false,
          'fuzzy_similarity_used_as_proof', false
        ),
        true
      ),
      updated_at = now()
  where id = p_candidate_id;

  insert into public.atlas_operation_actions (
    operation_run_id,
    action_type,
    target_entity_type,
    target_entity_id,
    lifecycle_state,
    source_references,
    requested_payload,
    applied_payload,
    reason,
    warnings,
    applied_at
  ) values (
    p_run_id,
    'michigan_completion_candidate_identity_cleared',
    'event_candidate',
    p_candidate_id,
    'applied',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'countyCode', v_county_code,
        'cleanId', v_clean_id,
        'officialSourceIdentity', v_url_identity
      )
    ),
    pg_catalog.jsonb_build_object(
      'identityInputHash', p_identity_input_hash,
      'ruleVersion', 'county-completion-clean-identity/1',
      'candidateId', p_candidate_id
    ),
    pg_catalog.jsonb_build_object(
      'identityDisposition', 'deterministic_clean_no_collision',
      'duplicateStatus', 'unique_candidate',
      'needsReview', false,
      'matchedEventId', null,
      'canonicalizationAttempted', false,
      'mergeAttempted', false
    ),
    pg_catalog.btrim(p_reason),
    '[]'::jsonb,
    now()
  )
  returning * into v_action;

  return pg_catalog.jsonb_build_object(
    'candidate_id', p_candidate_id,
    'action_id', v_action.id,
    'identity_cleared', true,
    'exact_replay', false,
    'canonical_event_id', null
  );
end;
$$;

revoke all on function public.atlas_clear_county_completion_candidate_identity(
  uuid,
  uuid,
  text,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.atlas_clear_county_completion_candidate_identity(
  uuid,
  uuid,
  text,
  text,
  text
) to service_role;

comment on function public.atlas_clear_county_completion_candidate_identity(
  uuid,
  uuid,
  text,
  text,
  text
) is
  'Clears only a reviewed private county candidate whose exact deterministic identity has no collision; never matches, promotes, canonicalizes, merges, or publishes.';

commit;
