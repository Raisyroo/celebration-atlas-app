-- Align the Approved-List Fast Track with the existing private Event Factory
-- gates. This adds an audited, deterministic identity-clearance operation and
-- permits a source-backed edition date when no current-edition start time was
-- retained. It performs no approval, canonicalization, or publication.

begin;

create or replace function public.atlas_clear_fast_track_candidate_identity(
  p_operation_run_id uuid,
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
  v_candidate public.event_candidates%rowtype;
  v_action public.atlas_operation_actions%rowtype;
  v_url_identity text;
  v_existing_hash text;
begin
  perform public.atlas_assert_service_role();
  if nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception 'Actor identity and reason are required.' using errcode = '22023';
  end if;
  if p_identity_input_hash is null or p_identity_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'A SHA-256 identity input hash is required.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.atlas_operation_runs as operation
    where operation.id = p_operation_run_id
      and operation.operation_type = 'candidate_intake'
  ) then
    raise exception 'The Fast Track identity action requires its candidate intake operation.'
      using errcode = '22023';
  end if;

  select candidate.* into v_candidate
  from public.event_candidates as candidate
  where candidate.id = p_candidate_id
  for update;
  if not found then
    raise exception 'Event candidate was not found.' using errcode = 'P0002';
  end if;
  if v_candidate.matched_event_id is not null
     or v_candidate.verification_status = 'promoted' then
    raise exception 'Fast Track identity clearance cannot canonicalize or merge a candidate.'
      using errcode = '22023';
  end if;

  v_existing_hash := v_candidate.raw_payload #>> '{fast_track,identity_clearance,identity_input_hash}';
  if v_candidate.duplicate_status = 'unique_candidate'
     and v_candidate.needs_review = false
     and v_existing_hash = p_identity_input_hash then
    return pg_catalog.jsonb_build_object(
      'candidate_id', p_candidate_id,
      'identity_cleared', true,
      'exact_replay', true,
      'canonical_event_id', null
    );
  end if;
  if v_candidate.duplicate_status not in ('unchecked', 'unique_candidate') then
    raise exception 'Candidate duplicate status requires human review.' using errcode = '22023';
  end if;

  v_url_identity := pg_catalog.regexp_replace(
    pg_catalog.regexp_replace(
      pg_catalog.lower(coalesce(v_candidate.official_website_candidate, '')),
      '^https?://(www\.)?',
      ''
    ),
    '/+$',
    ''
  );

  if exists (
    select 1
    from public.events as event
    where event.slug = v_candidate.slug_candidate
       or (
         pg_catalog.lower(event.name) = pg_catalog.lower(v_candidate.candidate_name)
         and pg_catalog.lower(coalesce(event.city, '')) =
             pg_catalog.lower(coalesce(v_candidate.city, ''))
       )
       or (
         v_url_identity <> ''
         and pg_catalog.regexp_replace(
           pg_catalog.regexp_replace(
             pg_catalog.lower(coalesce(event.official_website, '')),
             '^https?://(www\.)?',
             ''
           ),
           '/+$',
           ''
         ) = v_url_identity
       )
  ) then
    raise exception 'Canonical event identity collision requires human review.' using errcode = '23505';
  end if;

  if exists (
    select 1
    from public.event_candidates as candidate
    where candidate.id <> p_candidate_id
      and (
        candidate.slug_candidate = v_candidate.slug_candidate
        or (
          pg_catalog.lower(candidate.normalized_name) = pg_catalog.lower(v_candidate.normalized_name)
          and pg_catalog.lower(coalesce(candidate.city, '')) =
              pg_catalog.lower(coalesce(v_candidate.city, ''))
        )
        or (
          v_url_identity <> ''
          and pg_catalog.regexp_replace(
            pg_catalog.regexp_replace(
              pg_catalog.lower(coalesce(candidate.official_website_candidate, '')),
              '^https?://(www\.)?',
              ''
            ),
            '/+$',
            ''
          ) = v_url_identity
        )
      )
  ) then
    raise exception 'Candidate identity collision requires human review.' using errcode = '23505';
  end if;

  update public.event_candidates
  set duplicate_status = 'unique_candidate',
      needs_review = false,
      raw_payload = coalesce(raw_payload, '{}'::jsonb)
        || pg_catalog.jsonb_build_object(
          'fast_track',
          coalesce(raw_payload->'fast_track', '{}'::jsonb)
            || pg_catalog.jsonb_build_object(
              'identity_clearance',
              pg_catalog.jsonb_build_object(
                'contract_version', 1,
                'disposition', 'deterministic_clean_no_collision',
                'operation_run_id', p_operation_run_id,
                'identity_input_hash', p_identity_input_hash,
                'actor_identity', pg_catalog.btrim(p_actor_identity),
                'reason', pg_catalog.btrim(p_reason),
                'cleared_at', now(),
                'canonical_event_id', null,
                'merge_attempted', false,
                'canonicalization_attempted', false
              )
            )
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
    p_operation_run_id,
    'fast_track_candidate_identity_cleared',
    'event_candidate',
    p_candidate_id,
    'applied',
    pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object(
        'officialSourceIdentity', v_url_identity,
        'eventKey', v_candidate.slug_candidate
      )
    ),
    pg_catalog.jsonb_build_object(
      'identityInputHash', p_identity_input_hash,
      'ruleVersion', 'approved-list-fast-track-clean-identity/1',
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
  ) returning * into v_action;

  return pg_catalog.jsonb_build_object(
    'candidate_id', p_candidate_id,
    'action_id', v_action.id,
    'identity_cleared', true,
    'exact_replay', false,
    'canonical_event_id', null
  );
end;
$$;

revoke all on function public.atlas_clear_fast_track_candidate_identity(
  uuid, uuid, text, text, text
) from public, anon, authenticated;
grant execute on function public.atlas_clear_fast_track_candidate_identity(
  uuid, uuid, text, text, text
) to service_role;

create or replace function public.atlas_event_factory_content_ready_v2(
  p_manifest jsonb
)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_modules jsonb;
  v_navigation jsonb;
  v_why_go jsonb;
  v_schedule jsonb;
  v_experience jsonb;
  v_plan jsonb;
  v_name text;
  v_short_name text;
  v_location text;
  v_date_text text;
  v_tagline text;
  v_summary text;
  v_current_schedule_count integer := 0;
  v_recurring_schedule_count integer := 0;
  v_reference_schedule_count integer := 0;
  v_has_source_backed_date_schedule boolean := false;
begin
  if pg_catalog.jsonb_typeof(p_manifest) is distinct from 'object'
     or pg_catalog.jsonb_typeof(p_manifest->'modules') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_manifest->'navigation') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_manifest->'scheduleItems') is distinct from 'array'
     or pg_catalog.jsonb_typeof(p_manifest->'sources') is distinct from 'array' then
    return false;
  end if;

  v_modules := p_manifest->'modules';
  v_navigation := p_manifest->'navigation';
  if pg_catalog.jsonb_array_length(v_modules) <> 4
     or pg_catalog.jsonb_array_length(v_navigation) <> 4
     or pg_catalog.jsonb_array_length(p_manifest->'sources') < 1 then
    return false;
  end if;

  if (select count(*) from pg_catalog.jsonb_array_elements(v_modules) as module where module->>'type' = 'whyGo') <> 1
     or (select count(*) from pg_catalog.jsonb_array_elements(v_modules) as module where module->>'type' = 'schedule') <> 1
     or (select count(*) from pg_catalog.jsonb_array_elements(v_modules) as module where module->>'type' = 'planVisit') <> 1
     or (select count(*) from pg_catalog.jsonb_array_elements(v_modules) as module where module->>'type' in ('highlights', 'traditions')) <> 1 then
    return false;
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_modules) as module
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(v_navigation) as navigation
      where navigation->>'targetModuleId' = module->>'id'
    )
  ) then
    return false;
  end if;

  select module into v_why_go
  from pg_catalog.jsonb_array_elements(v_modules) as module
  where module->>'type' = 'whyGo';
  select module into v_schedule
  from pg_catalog.jsonb_array_elements(v_modules) as module
  where module->>'type' = 'schedule';
  select module into v_experience
  from pg_catalog.jsonb_array_elements(v_modules) as module
  where module->>'type' in ('highlights', 'traditions');
  select module into v_plan
  from pg_catalog.jsonb_array_elements(v_modules) as module
  where module->>'type' = 'planVisit';

  v_name := pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p_manifest#>>'{identity,name}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_short_name := pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p_manifest#>>'{identity,shortName}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_location := pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p_manifest#>>'{identity,location}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_date_text := pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(coalesce(p_manifest#>>'{identity,dateText}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_tagline := pg_catalog.btrim(coalesce(p_manifest#>>'{hero,tagline}', ''));
  v_summary := pg_catalog.btrim(coalesce(v_why_go->>'summary', ''));

  if coalesce(pg_catalog.array_length(pg_catalog.regexp_split_to_array(v_tagline, '\s+'), 1), 0) < 8
     or pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(v_tagline, '[^a-z0-9]+', ' ', 'gi'))) in (v_name, v_short_name, v_location, v_date_text)
     or v_tagline ~* '(start with the moments that define|start with the essentials|plan your visit to|daily details are still being confirmed|location details need review)' then
    return false;
  end if;

  if coalesce(pg_catalog.array_length(pg_catalog.regexp_split_to_array(v_summary, '\s+'), 1), 0) < 10
     or pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(v_summary, '[^a-z0-9]+', ' ', 'gi'))) in (v_name, v_short_name, v_location, v_date_text)
     or (coalesce(v_why_go->>'headline', '') || ' ' || v_summary) ~*
        '(start with the moments that define|start with the essentials|plan your visit to|daily details are still being confirmed|location details need review)' then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(v_why_go->'metrics') is distinct from 'array'
     or pg_catalog.jsonb_typeof(v_why_go->'audienceGroups') is distinct from 'array'
     or (
       pg_catalog.jsonb_array_length(v_why_go->'metrics')
       + pg_catalog.jsonb_array_length(v_why_go->'audienceGroups')
       + case when pg_catalog.jsonb_typeof(v_why_go->'spotlight') = 'object' then 1 else 0 end
     ) < 1 then
    return false;
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(
      (v_why_go->'metrics') || (v_why_go->'audienceGroups')
        || case
             when pg_catalog.jsonb_typeof(v_why_go->'spotlight') = 'object'
               then pg_catalog.jsonb_build_array(v_why_go->'spotlight')
             else '[]'::jsonb
           end
    ) as item
    where pg_catalog.jsonb_typeof(item->'sourceIds') is distinct from 'array'
       or pg_catalog.jsonb_array_length(item->'sourceIds') < 1
  ) then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(v_experience->'items') is distinct from 'array'
     or (v_experience->>'type' = 'highlights' and pg_catalog.jsonb_array_length(v_experience->'items') < 3)
     or (v_experience->>'type' = 'traditions' and pg_catalog.jsonb_array_length(v_experience->'items') < 2)
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_experience->'items') as item
       where pg_catalog.jsonb_typeof(item->'sourceIds') is distinct from 'array'
          or pg_catalog.jsonb_array_length(item->'sourceIds') < 1
     ) then
    return false;
  end if;

  v_current_schedule_count := pg_catalog.jsonb_array_length(p_manifest->'scheduleItems');
  if pg_catalog.jsonb_typeof(v_schedule#>'{recurringEvents,items}') = 'array' then
    v_recurring_schedule_count := pg_catalog.jsonb_array_length(v_schedule#>'{recurringEvents,items}');
  end if;
  if pg_catalog.jsonb_typeof(v_schedule#>'{referenceSchedule,groups}') = 'array' then
    select coalesce(pg_catalog.sum(pg_catalog.jsonb_array_length(group_row->'items')), 0)::integer
      into v_reference_schedule_count
    from pg_catalog.jsonb_array_elements(v_schedule#>'{referenceSchedule,groups}') as group_row
    where pg_catalog.jsonb_typeof(group_row->'items') = 'array';
  end if;
  v_has_source_backed_date_schedule :=
    pg_catalog.jsonb_typeof(v_schedule->'sourceIds') = 'array'
    and pg_catalog.jsonb_array_length(v_schedule->'sourceIds') >= 1
    and coalesce(p_manifest#>>'{identity,startsOn}', '') <> ''
    and coalesce(p_manifest#>>'{identity,endsOn}', '') <> ''
    and coalesce(v_schedule->>'subtitle', '') <> '';
  if v_current_schedule_count + v_recurring_schedule_count + v_reference_schedule_count < 1
     and not v_has_source_backed_date_schedule then
    return false;
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_manifest->'scheduleItems') as item
    where pg_catalog.jsonb_typeof(item->'sourceIds') is distinct from 'array'
       or pg_catalog.jsonb_array_length(item->'sourceIds') < 1
  ) then
    return false;
  end if;

  if pg_catalog.jsonb_typeof(v_plan->'details') is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_plan->'details') < 2
     or exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_plan->'details') as detail
       where pg_catalog.jsonb_typeof(detail->'sourceIds') is distinct from 'array'
          or pg_catalog.jsonb_array_length(detail->'sourceIds') < 1
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

revoke all on function public.atlas_event_factory_content_ready_v2(jsonb)
  from public, anon, authenticated;
grant execute on function public.atlas_event_factory_content_ready_v2(jsonb)
  to service_role;

comment on function public.atlas_clear_fast_track_candidate_identity(
  uuid, uuid, text, text, text
) is 'Audits deterministic exact-identity clearance for a Ray-approved Fast Track candidate without canonicalization or publication.';
comment on function public.atlas_event_factory_content_ready_v2(jsonb) is
  'Validates the v2 four-topic content contract, including source-backed date-only schedule presentations when no current-edition time was retained.';

commit;
