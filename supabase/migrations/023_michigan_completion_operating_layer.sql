-- Michigan Completion Operating Layer v1.
--
-- This migration deliberately reuses the Atlas Control operation ledger and
-- review queue. It does not create a second run, event, checkpoint, exception,
-- model, Event Factory, or publication system. Completion work is private,
-- service-role-only, resumable, and incapable of publishing or materializing
-- an event.

do $$
begin
  if pg_catalog.to_regclass('public.atlas_operation_runs') is null
     or pg_catalog.to_regclass('public.atlas_operation_actions') is null
     or pg_catalog.to_regclass('public.atlas_review_items') is null then
    raise exception
      'Michigan completion requires the deployed Atlas Control Plane from migration 004.'
      using errcode = '55000';
  end if;

  if pg_catalog.to_regprocedure('public.atlas_assert_service_role()') is null then
    raise exception
      'Michigan completion requires public.atlas_assert_service_role().'
      using errcode = '55000';
  end if;
end;
$$;

create table public.atlas_review_item_actions (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid not null
    references public.atlas_review_items(id) on delete cascade,
  operation_run_id uuid not null
    references public.atlas_operation_runs(id) on delete cascade,
  operation_action_id uuid not null
    references public.atlas_operation_actions(id) on delete restrict,
  action_type text not null check (
    action_type in ('created', 'acknowledged', 'resolved', 'waived', 'superseded')
  ),
  from_status text check (
    from_status is null
    or from_status in ('open', 'acknowledged', 'resolved', 'waived', 'superseded')
  ),
  to_status text not null check (
    to_status in ('open', 'acknowledged', 'resolved', 'waived', 'superseded')
  ),
  actor_identity text not null check (
    nullif(pg_catalog.btrim(actor_identity), '') is not null
  ),
  idempotency_key text not null check (
    nullif(pg_catalog.btrim(idempotency_key), '') is not null
  ),
  reason text,
  details jsonb not null default '{}'::jsonb check (
    pg_catalog.jsonb_typeof(details) = 'object'
  ),
  created_at timestamptz not null default now(),
  unique (review_item_id, idempotency_key)
);

create index atlas_review_item_actions_item_created_idx
  on public.atlas_review_item_actions (review_item_id, created_at desc, id desc);

create index atlas_review_item_actions_run_created_idx
  on public.atlas_review_item_actions (operation_run_id, created_at desc, id desc);

create unique index atlas_operation_actions_completion_checkpoint_transition_uidx
  on public.atlas_operation_actions (
    operation_run_id,
    (requested_payload->>'actionIdempotencyKey')
  )
  where action_type = 'michigan_completion_checkpoint'
    and nullif(pg_catalog.btrim(requested_payload->>'actionIdempotencyKey'), '') is not null;

create unique index atlas_operation_actions_completion_model_charge_uidx
  on public.atlas_operation_actions (
    operation_run_id,
    (requested_payload->>'chargeKey')
  )
  where action_type in (
    'michigan_completion_model_reserved',
    'michigan_completion_model_budget_blocked',
    'michigan_completion_model_rejected'
  )
    and nullif(pg_catalog.btrim(requested_payload->>'chargeKey'), '') is not null;

create unique index atlas_operation_actions_completion_model_finish_uidx
  on public.atlas_operation_actions (
    operation_run_id,
    (requested_payload->>'reservationActionId')
  )
  where action_type = 'michigan_completion_model_finished'
    and nullif(pg_catalog.btrim(requested_payload->>'reservationActionId'), '') is not null;

create unique index atlas_review_items_completion_exception_dedupe_uidx
  on public.atlas_review_items (
    operation_run_id,
    (evidence->>'dedupeKey')
  )
  where review_type = 'michigan_completion_exception'
    and nullif(pg_catalog.btrim(evidence->>'dedupeKey'), '') is not null;

alter table public.atlas_review_item_actions enable row level security;

revoke all on table public.atlas_review_item_actions
  from public, anon, authenticated, service_role;
grant select on table public.atlas_review_item_actions to service_role;

create or replace function public.atlas_guard_michigan_completion_run_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if old.operation_type = 'michigan_completion_v1' then
      raise exception 'Michigan completion run history is immutable.'
        using errcode = '55000';
    end if;
    return old;
  end if;

  if old.operation_type = 'michigan_completion_v1'
     and (
       new.operation_type is distinct from old.operation_type
       or new.idempotency_key is distinct from old.idempotency_key
       or new.actor_type is distinct from old.actor_type
       or new.actor_identity is distinct from old.actor_identity
       or new.request is distinct from old.request
       or new.created_at is distinct from old.created_at
     ) then
    raise exception 'Michigan completion run identity and request are immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_guard_michigan_completion_run_history
  on public.atlas_operation_runs;
create trigger atlas_guard_michigan_completion_run_history
before update or delete on public.atlas_operation_runs
for each row
execute function public.atlas_guard_michigan_completion_run_history();

create or replace function public.atlas_guard_michigan_completion_action_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.action_type like 'michigan_completion_%' then
    raise exception 'Michigan completion operation actions are append-only.'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_guard_michigan_completion_action_history
  on public.atlas_operation_actions;
create trigger atlas_guard_michigan_completion_action_history
before update or delete on public.atlas_operation_actions
for each row
execute function public.atlas_guard_michigan_completion_action_history();

create or replace function public.atlas_guard_michigan_completion_review_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.review_type <> 'michigan_completion_exception' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then
    raise exception 'Michigan completion review items cannot be deleted.'
      using errcode = '55000';
  end if;

  if new.operation_run_id is distinct from old.operation_run_id
     or new.operation_action_id is distinct from old.operation_action_id
     or new.review_type is distinct from old.review_type
     or new.event_id is distinct from old.event_id
     or new.candidate_id is distinct from old.candidate_id
     or new.priority is distinct from old.priority
     or new.evidence is distinct from old.evidence
     or new.recommended_action is distinct from old.recommended_action
     or new.created_at is distinct from old.created_at then
    raise exception 'Michigan completion exception evidence and identity are immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

drop trigger if exists atlas_guard_michigan_completion_review_history
  on public.atlas_review_items;
create trigger atlas_guard_michigan_completion_review_history
before update or delete on public.atlas_review_items
for each row
execute function public.atlas_guard_michigan_completion_review_history();

create or replace function public.atlas_guard_review_item_action_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception 'Atlas review item actions are append-only.'
    using errcode = '55000';
end;
$$;

drop trigger if exists atlas_guard_review_item_action_history
  on public.atlas_review_item_actions;
create trigger atlas_guard_review_item_action_history
before update or delete on public.atlas_review_item_actions
for each row
execute function public.atlas_guard_review_item_action_history();

create or replace function public.atlas_refresh_michigan_completion_summary(
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_stage_counts jsonb := '{}'::jsonb;
  v_event_counts jsonb := '{}'::jsonb;
  v_readiness_counts jsonb := '{}'::jsonb;
  v_exception_count integer := 0;
  v_publication_eligibility_count integer := 0;
  v_reserved_input bigint := 0;
  v_reserved_output bigint := 0;
  v_reserved_cost bigint := 0;
  v_used_input bigint := 0;
  v_used_output bigint := 0;
  v_used_cost bigint := 0;
  v_operation_status text;
begin
  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;

  if not found then
    raise exception 'Michigan completion run was not found.'
      using errcode = 'P0002';
  end if;

  with latest_checkpoints as (
    select distinct on (
      action.requested_payload->>'eventKey',
      action.requested_payload->>'checkpointKey'
    )
      action.requested_payload->>'status' as status
    from public.atlas_operation_actions as action
    where action.operation_run_id = p_run_id
      and action.action_type = 'michigan_completion_checkpoint'
    order by
      action.requested_payload->>'eventKey',
      action.requested_payload->>'checkpointKey',
      action.created_at desc,
      action.id desc
  ),
  counts as (
    select status, count(*)::integer as count
    from latest_checkpoints
    group by status
  )
  select coalesce(pg_catalog.jsonb_object_agg(status, count), '{}'::jsonb)
    into v_stage_counts
  from counts;

  with event_progress as (
    select value
    from pg_catalog.jsonb_each(
      coalesce(v_run.summary->'eventProgress', '{}'::jsonb)
    )
  ),
  counts as (
    select coalesce(value->>'status', 'queued') as status, count(*)::integer as count
    from event_progress
    group by coalesce(value->>'status', 'queued')
  )
  select coalesce(pg_catalog.jsonb_object_agg(status, count), '{}'::jsonb)
    into v_event_counts
  from counts;

  with event_progress as (
    select value
    from pg_catalog.jsonb_each(
      coalesce(v_run.summary->'eventProgress', '{}'::jsonb)
    )
  ),
  counts as (
    select
      coalesce(value->>'readinessStatus', 'publication_blocked') as status,
      count(*)::integer as count
    from event_progress
    group by coalesce(value->>'readinessStatus', 'publication_blocked')
  )
  select coalesce(pg_catalog.jsonb_object_agg(status, count), '{}'::jsonb)
    into v_readiness_counts
  from counts;

  select count(*)::integer into v_publication_eligibility_count
  from pg_catalog.jsonb_each(
    coalesce(v_run.summary->'eventProgress', '{}'::jsonb)
  ) as progress
  where coalesce((progress.value->>'publicationEligible')::boolean, false);

  with completion_items as (
    select item.id
    from public.atlas_review_items as item
    where item.operation_run_id = p_run_id
      and item.review_type = 'michigan_completion_exception'
  ),
  latest_states as (
    select
      item.id,
      coalesce((
        select action.to_status
        from public.atlas_review_item_actions as action
        where action.review_item_id = item.id
        order by action.created_at desc, action.id desc
        limit 1
      ), 'open') as status
    from completion_items as item
  )
  select count(*)::integer into v_exception_count
  from latest_states
  where status in ('open', 'acknowledged');

  with reservations as (
    select
      action.id,
      coalesce((action.requested_payload->>'estimatedInputUsage')::bigint, 0) as input_usage,
      coalesce((action.requested_payload->>'estimatedOutputUsage')::bigint, 0) as output_usage,
      coalesce((action.requested_payload->>'estimatedCostMicros')::bigint, 0) as cost_micros
    from public.atlas_operation_actions as action
    where action.operation_run_id = p_run_id
      and action.action_type = 'michigan_completion_model_reserved'
  ),
  finished as (
    select distinct on (action.requested_payload->>'reservationActionId')
      (action.requested_payload->>'reservationActionId')::uuid as reservation_id,
      coalesce((action.requested_payload->>'actualInputUsage')::bigint, 0) as input_usage,
      coalesce((action.requested_payload->>'actualOutputUsage')::bigint, 0) as output_usage,
      coalesce((action.requested_payload->>'actualCostMicros')::bigint, 0) as cost_micros
    from public.atlas_operation_actions as action
    where action.operation_run_id = p_run_id
      and action.action_type = 'michigan_completion_model_finished'
    order by action.requested_payload->>'reservationActionId',
      action.created_at desc,
      action.id desc
  )
  select
    coalesce(sum(case when finished.reservation_id is null then reservations.input_usage else 0 end), 0),
    coalesce(sum(case when finished.reservation_id is null then reservations.output_usage else 0 end), 0),
    coalesce(sum(case when finished.reservation_id is null then reservations.cost_micros else 0 end), 0),
    coalesce(sum(case when finished.reservation_id is not null then finished.input_usage else 0 end), 0),
    coalesce(sum(case when finished.reservation_id is not null then finished.output_usage else 0 end), 0),
    coalesce(sum(case when finished.reservation_id is not null then finished.cost_micros else 0 end), 0)
  into
    v_reserved_input,
    v_reserved_output,
    v_reserved_cost,
    v_used_input,
    v_used_output,
    v_used_cost
  from reservations
  left join finished on finished.reservation_id = reservations.id;

  v_operation_status := case v_run.summary->>'completionStatus'
    when 'queued' then 'planned'
    when 'validating' then 'running'
    when 'running' then 'running'
    when 'waiting_for_exceptions' then 'partial'
    when 'ready_for_review' then 'partial'
    when 'completed' then 'succeeded'
    when 'failed' then 'failed'
    when 'cancelled' then 'cancelled'
    else v_run.status
  end;

  update public.atlas_operation_runs
  set
    status = v_operation_status,
    summary = v_run.summary || pg_catalog.jsonb_build_object(
      'stageCounts', v_stage_counts,
      'eventCounts', v_event_counts,
      'readinessCounts', v_readiness_counts,
      'exceptionCount', v_exception_count,
      'publicationEligibilityCount', v_publication_eligibility_count,
      'modelUsage', pg_catalog.jsonb_build_object(
        'reservedInputUsage', v_reserved_input,
        'reservedOutputUsage', v_reserved_output,
        'reservedTotalTokens', v_reserved_input + v_reserved_output,
        'reservedCostMicros', v_reserved_cost,
        'actualInputUsage', v_used_input,
        'actualOutputUsage', v_used_output,
        'actualTotalTokens', v_used_input + v_used_output,
        'actualCostMicros', v_used_cost
      )
    ),
    updated_at = now()
  where id = p_run_id;
end;
$$;

revoke all on function public.atlas_refresh_michigan_completion_summary(uuid)
  from public, anon, authenticated;

create or replace function public.atlas_start_michigan_completion_run(
  p_actor_type text,
  p_actor_identity text,
  p_state_id text,
  p_county_identity text,
  p_batch_identity text,
  p_manifest_version text,
  p_input_hash text,
  p_orchestrator_version text,
  p_dry_run boolean,
  p_deterministic_only boolean,
  p_max_concurrency integer,
  p_run_budget jsonb,
  p_per_event_budget jsonb,
  p_events jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_request jsonb;
  v_summary jsonb;
  v_event_progress jsonb;
  v_identity_key text;
  v_run_budget jsonb;
  v_per_event_budget jsonb;
  v_action_id uuid;
begin
  perform public.atlas_assert_service_role();

  if p_actor_type not in ('human', 'automation', 'system') then
    raise exception 'Unsupported Atlas actor type.' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or nullif(pg_catalog.btrim(p_state_id), '') is null
     or nullif(pg_catalog.btrim(p_batch_identity), '') is null
     or nullif(pg_catalog.btrim(p_manifest_version), '') is null
     or nullif(pg_catalog.btrim(p_orchestrator_version), '') is null then
    raise exception 'Completion run identity and version fields are required.'
      using errcode = '22023';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Completion input hash must be a lowercase SHA-256 digest.'
      using errcode = '22023';
  end if;
  if p_max_concurrency is null or p_max_concurrency < 1 or p_max_concurrency > 16 then
    raise exception 'Completion concurrency must be between 1 and 16.'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_run_budget) <> 'object'
     or pg_catalog.jsonb_typeof(p_per_event_budget) <> 'object' then
    raise exception 'Completion model budgets must be JSON objects.'
      using errcode = '22023';
  end if;
  if coalesce(p_run_budget->>'inputTokens', '0') !~ '^[0-9]+$'
     or coalesce(p_run_budget->>'outputTokens', '0') !~ '^[0-9]+$'
     or coalesce(p_run_budget->>'totalTokens', '0') !~ '^[0-9]+$'
     or coalesce(p_run_budget->>'costMicros', '0') !~ '^[0-9]+$'
     or coalesce(p_per_event_budget->>'inputTokens', '0') !~ '^[0-9]+$'
     or coalesce(p_per_event_budget->>'outputTokens', '0') !~ '^[0-9]+$'
     or coalesce(p_per_event_budget->>'totalTokens', '0') !~ '^[0-9]+$'
     or coalesce(p_per_event_budget->>'costMicros', '0') !~ '^[0-9]+$' then
    raise exception 'Completion model budget values must be non-negative integers.'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_events) <> 'array'
     or pg_catalog.jsonb_array_length(p_events) = 0 then
    raise exception 'Completion events must be a non-empty JSON array.'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_events) as event
    where pg_catalog.jsonb_typeof(event) <> 'object'
      or nullif(pg_catalog.btrim(event->>'eventKey'), '') is null
      or (
        event ? 'inputHash'
        and coalesce(event->>'inputHash', '') !~ '^[0-9a-f]{64}$'
      )
      or (
        event ? 'readinessStatus'
        and event->>'readinessStatus' not in (
          'publication_blocked', 'content_ready', 'art_pending', 'review_ready'
        )
      )
      or (
        event ? 'artProvenance'
        and event->>'artProvenance' not in (
          'ray_provided', 'organizer_provided', 'licensed',
          'generated', 'legacy', 'unknown'
        )
      )
  ) then
    raise exception 'Every completion event needs a valid eventKey and optional versioned fields.'
      using errcode = '22023';
  end if;
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(p_events) as event
    group by event->>'eventKey'
    having count(*) > 1
  ) then
    raise exception 'Completion event keys must be unique inside a run.'
      using errcode = '23505';
  end if;

  v_run_budget := pg_catalog.jsonb_build_object(
    'totalTokens', coalesce(
      (p_run_budget->>'totalTokens')::bigint,
      coalesce((p_run_budget->>'inputTokens')::bigint, 0)
        + coalesce((p_run_budget->>'outputTokens')::bigint, 0)
    ),
    'inputTokens', coalesce(
      (p_run_budget->>'inputTokens')::bigint,
      (p_run_budget->>'totalTokens')::bigint,
      0
    ),
    'outputTokens', coalesce(
      (p_run_budget->>'outputTokens')::bigint,
      (p_run_budget->>'totalTokens')::bigint,
      0
    ),
    'costMicros', coalesce((p_run_budget->>'costMicros')::bigint, 0)
  );
  v_per_event_budget := pg_catalog.jsonb_build_object(
    'totalTokens', coalesce(
      (p_per_event_budget->>'totalTokens')::bigint,
      coalesce((p_per_event_budget->>'inputTokens')::bigint, 0)
        + coalesce((p_per_event_budget->>'outputTokens')::bigint, 0)
    ),
    'inputTokens', coalesce(
      (p_per_event_budget->>'inputTokens')::bigint,
      (p_per_event_budget->>'totalTokens')::bigint,
      0
    ),
    'outputTokens', coalesce(
      (p_per_event_budget->>'outputTokens')::bigint,
      (p_per_event_budget->>'totalTokens')::bigint,
      0
    ),
    'costMicros', coalesce((p_per_event_budget->>'costMicros')::bigint, 0)
  );

  select pg_catalog.jsonb_object_agg(
    event->>'eventKey',
    pg_catalog.jsonb_build_object(
      'status', 'queued',
      'currentStageId', null,
      'currentStageVersion', null,
      'lastSuccessfulStageId', null,
      'lastSuccessfulStageVersion', null,
      'readinessStatus', coalesce(event->>'readinessStatus', 'publication_blocked'),
      'artProvenance', coalesce(event->>'artProvenance', 'unknown'),
      'publicationEligible', false,
      'retryCount', 0,
      'updatedAt', now()
    )
  )
  into v_event_progress
  from pg_catalog.jsonb_array_elements(p_events) as event;

  v_request := pg_catalog.jsonb_build_object(
    'contractVersion', 'michigan-completion-v1',
    'stateId', pg_catalog.btrim(p_state_id),
    'countyIdentity', nullif(pg_catalog.btrim(p_county_identity), ''),
    'batchIdentity', pg_catalog.btrim(p_batch_identity),
    'manifestVersion', pg_catalog.btrim(p_manifest_version),
    'inputHash', p_input_hash,
    'orchestratorVersion', pg_catalog.btrim(p_orchestrator_version),
    'dryRun', coalesce(p_dry_run, true),
    'deterministicOnly', coalesce(p_deterministic_only, false),
    'maxConcurrency', p_max_concurrency,
    'maxRetries', 3,
    'runBudget', v_run_budget,
    'perEventBudget', v_per_event_budget,
    'events', p_events
  );
  v_identity_key :=
    lower(pg_catalog.btrim(p_state_id)) || ':' || pg_catalog.btrim(p_batch_identity);

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'michigan_completion_v1:' || v_identity_key,
      0
    )
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.operation_type = 'michigan_completion_v1'
    and run.idempotency_key = v_identity_key
  for update;

  if found then
    if v_run.request is distinct from v_request then
      raise exception
        'Completion replay conflict: state and batch identity have different immutable input.'
        using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'runId', v_run.id,
      'operationRunId', v_run.id,
      'status', v_run.summary->>'completionStatus',
      'exactReplay', true
    );
  end if;

  v_summary := pg_catalog.jsonb_build_object(
    'completionStatus', 'queued',
    'stageCounts', '{}'::jsonb,
    'eventCounts', pg_catalog.jsonb_build_object(
      'queued', pg_catalog.jsonb_array_length(p_events)
    ),
    'readinessCounts', pg_catalog.jsonb_build_object(
      'publication_blocked',
      pg_catalog.jsonb_array_length(p_events)
    ),
    'eventProgress', v_event_progress,
    'retryCount', 0,
    'exceptionCount', 0,
    'publicationEligibilityCount', 0,
    'modelUsage', pg_catalog.jsonb_build_object(
      'reservedInputUsage', 0,
      'reservedOutputUsage', 0,
      'reservedTotalTokens', 0,
      'reservedCostMicros', 0,
      'actualInputUsage', 0,
      'actualOutputUsage', 0,
      'actualTotalTokens', 0,
      'actualCostMicros', 0
    )
  );

  insert into public.atlas_operation_runs (
    operation_type,
    actor_type,
    actor_identity,
    status,
    idempotency_key,
    request,
    summary
  ) values (
    'michigan_completion_v1',
    p_actor_type,
    pg_catalog.btrim(p_actor_identity),
    'planned',
    v_identity_key,
    v_request,
    v_summary
  )
  returning * into v_run;

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
    v_run.id,
    'michigan_completion_run_started',
    'michigan_completion_run',
    v_run.id,
    'applied',
    '[]'::jsonb,
    v_request,
    pg_catalog.jsonb_build_object(
      'completionStatus', 'queued',
      'eventCount', pg_catalog.jsonb_array_length(p_events)
    ),
    'Created a private Michigan completion run. No publication is authorized.',
    '[]'::jsonb,
    now()
  )
  returning id into v_action_id;

  return pg_catalog.jsonb_build_object(
    'runId', v_run.id,
    'operationRunId', v_run.id,
    'status', 'queued',
    'actionId', v_action_id,
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_resume_michigan_completion_run(
  p_run_id uuid,
  p_actor_identity text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_retry_count integer;
  v_action_id uuid;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null or nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Run and actor identities are required.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('michigan_completion_run:' || p_run_id::text, 0)
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;
  if v_run.summary->>'completionStatus' in ('completed', 'cancelled') then
    raise exception 'Completed or cancelled completion runs cannot be resumed.'
      using errcode = '55000';
  end if;

  v_retry_count := coalesce((v_run.summary->>'retryCount')::integer, 0) + 1;
  if v_retry_count > coalesce((v_run.request->>'maxRetries')::integer, 3) then
    raise exception 'Completion run retry limit has been reached.'
      using errcode = '54000';
  end if;

  update public.atlas_operation_runs
  set
    status = 'running',
    started_at = coalesce(started_at, now()),
    completed_at = null,
    error = null,
    summary = summary || pg_catalog.jsonb_build_object(
      'completionStatus', 'running',
      'retryCount', v_retry_count,
      'lastResumedAt', now()
    ),
    updated_at = now()
  where id = p_run_id
  returning * into v_run;

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
    'michigan_completion_run_resumed',
    'michigan_completion_run',
    p_run_id,
    'applied',
    '[]'::jsonb,
    pg_catalog.jsonb_build_object(
      'actorIdentity', pg_catalog.btrim(p_actor_identity),
      'retryCount', v_retry_count
    ),
    pg_catalog.jsonb_build_object('completionStatus', 'running'),
    'Resumed from retained append-only checkpoints.',
    '[]'::jsonb,
    now()
  )
  returning id into v_action_id;

  return pg_catalog.jsonb_build_object(
    'runId', p_run_id,
    'operationRunId', p_run_id,
    'status', 'running',
    'retryCount', v_retry_count,
    'actionId', v_action_id,
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_record_michigan_completion_checkpoint(
  p_run_id uuid,
  p_actor_identity text,
  p_event_key text,
  p_stage_id text,
  p_stage_version text,
  p_input_hash text,
  p_checkpoint_key text,
  p_action_idempotency_key text,
  p_status text,
  p_output jsonb,
  p_links jsonb,
  p_warnings jsonb,
  p_failure jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_existing public.atlas_operation_actions;
  v_previous jsonb;
  v_requested jsonb;
  v_applied jsonb;
  v_action public.atlas_operation_actions;
  v_lifecycle text;
  v_progress jsonb;
  v_event_status text;
  v_readiness_status text;
  v_art_provenance text;
  v_publication_eligible boolean;
  v_summary jsonb;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or nullif(pg_catalog.btrim(p_event_key), '') is null
     or nullif(pg_catalog.btrim(p_stage_id), '') is null
     or nullif(pg_catalog.btrim(p_stage_version), '') is null
     or nullif(pg_catalog.btrim(p_checkpoint_key), '') is null
     or nullif(pg_catalog.btrim(p_action_idempotency_key), '') is null then
    raise exception 'Checkpoint run, event, stage, and idempotency fields are required.'
      using errcode = '22023';
  end if;
  if p_input_hash is null or p_input_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Checkpoint input hash must be a lowercase SHA-256 digest.'
      using errcode = '22023';
  end if;
  if p_status not in ('queued', 'running', 'succeeded', 'skipped', 'blocked', 'failed') then
    raise exception 'Unsupported completion checkpoint status.' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_output) <> 'object'
     or pg_catalog.jsonb_typeof(p_links) <> 'object'
     or pg_catalog.jsonb_typeof(p_warnings) <> 'array'
     or (p_failure is not null and pg_catalog.jsonb_typeof(p_failure) <> 'object') then
    raise exception 'Checkpoint output, links, warnings, or failure has an invalid shape.'
      using errcode = '22023';
  end if;
  if p_status = 'failed' and p_failure is null then
    raise exception 'Failed checkpoints require a failure object.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'michigan_completion_checkpoint:' || p_run_id::text || ':' ||
      pg_catalog.btrim(p_action_idempotency_key),
      0
    )
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;
  if v_run.summary->>'completionStatus' in ('completed', 'failed', 'cancelled') then
    raise exception 'Terminal completion runs cannot accept checkpoints.'
      using errcode = '55000';
  end if;
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_run.request->'events') as event
    where event->>'eventKey' = pg_catalog.btrim(p_event_key)
  ) then
    raise exception 'Checkpoint event is not part of the immutable run manifest.'
      using errcode = '22023';
  end if;

  v_requested := pg_catalog.jsonb_build_object(
    'eventKey', pg_catalog.btrim(p_event_key),
    'stageId', pg_catalog.btrim(p_stage_id),
    'stageVersion', pg_catalog.btrim(p_stage_version),
    'inputHash', p_input_hash,
    'checkpointKey', pg_catalog.btrim(p_checkpoint_key),
    'actionIdempotencyKey', pg_catalog.btrim(p_action_idempotency_key),
    'status', p_status
  );
  v_applied := pg_catalog.jsonb_build_object(
    'output', p_output,
    'links', p_links
  );

  select action.* into v_existing
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type = 'michigan_completion_checkpoint'
    and action.requested_payload->>'actionIdempotencyKey' =
      pg_catalog.btrim(p_action_idempotency_key)
  for share;

  if found then
    if v_existing.requested_payload is distinct from v_requested
       or v_existing.applied_payload is distinct from v_applied
       or v_existing.warnings is distinct from p_warnings
       or v_existing.failure is distinct from p_failure then
      raise exception 'Checkpoint replay conflicts with the retained action.'
        using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'actionId', v_existing.id,
      'runId', p_run_id,
      'eventKey', p_event_key,
      'stageId', p_stage_id,
      'stageVersion', p_stage_version,
      'checkpointKey', p_checkpoint_key,
      'status', p_status,
      'output', p_output,
      'links', p_links,
      'exactReplay', true
    );
  end if;

  select pg_catalog.jsonb_build_object(
    'actionId', action.id,
    'status', action.requested_payload->>'status',
    'output', action.applied_payload->'output',
    'links', action.applied_payload->'links',
    'createdAt', action.created_at
  )
  into v_previous
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type = 'michigan_completion_checkpoint'
    and action.requested_payload->>'eventKey' = pg_catalog.btrim(p_event_key)
    and action.requested_payload->>'checkpointKey' = pg_catalog.btrim(p_checkpoint_key)
  order by action.created_at desc, action.id desc
  limit 1;

  v_lifecycle := case p_status
    when 'queued' then 'proposed'
    when 'running' then 'proposed'
    when 'succeeded' then 'applied'
    when 'skipped' then 'skipped'
    when 'blocked' then 'blocked'
    when 'failed' then 'failed'
  end;

  insert into public.atlas_operation_actions (
    operation_run_id,
    action_type,
    target_entity_type,
    lifecycle_state,
    source_references,
    requested_payload,
    before_snapshot,
    applied_payload,
    after_snapshot,
    reason,
    warnings,
    failure,
    applied_at
  ) values (
    p_run_id,
    'michigan_completion_checkpoint',
    'michigan_completion_event',
    v_lifecycle,
    '[]'::jsonb,
    v_requested,
    v_previous,
    v_applied,
    pg_catalog.jsonb_build_object(
      'eventKey', pg_catalog.btrim(p_event_key),
      'checkpointKey', pg_catalog.btrim(p_checkpoint_key),
      'status', p_status
    ),
    'Recorded an immutable Michigan completion stage checkpoint.',
    p_warnings,
    p_failure,
    case when p_status in ('succeeded', 'skipped') then now() else null end
  )
  returning * into v_action;

  v_progress := coalesce(
    v_run.summary #> array['eventProgress', pg_catalog.btrim(p_event_key)],
    pg_catalog.jsonb_build_object(
      'status', 'queued',
      'readinessStatus', 'publication_blocked',
      'artProvenance', 'unknown',
      'publicationEligible', false,
      'retryCount', 0
    )
  );
  v_event_status := coalesce(
    nullif(p_output->>'eventStatus', ''),
    case p_status
      when 'queued' then 'queued'
      when 'running' then 'running'
      when 'blocked' then 'waiting_for_exception'
      when 'failed' then 'failed'
      else 'running'
    end
  );
  if v_event_status not in (
    'queued', 'running', 'waiting_for_exception',
    'ready_for_review', 'completed', 'failed'
  ) then
    raise exception 'Unsupported completion event status.' using errcode = '22023';
  end if;
  v_readiness_status := coalesce(
    nullif(p_output->>'readinessStatus', ''),
    v_progress->>'readinessStatus',
    'publication_blocked'
  );
  v_art_provenance := coalesce(
    nullif(p_output->>'artProvenance', ''),
    v_progress->>'artProvenance',
    'unknown'
  );
  if v_readiness_status not in (
    'publication_blocked', 'content_ready', 'art_pending', 'review_ready'
  ) then
    raise exception 'Unsupported completion readiness status.' using errcode = '22023';
  end if;
  if v_art_provenance not in (
    'ray_provided', 'organizer_provided', 'licensed',
    'generated', 'legacy', 'unknown'
  ) then
    raise exception 'Unsupported completion art provenance.' using errcode = '22023';
  end if;
  v_publication_eligible := coalesce(
    (p_output->>'publicationEligible')::boolean,
    (v_progress->>'publicationEligible')::boolean,
    false
  );
  if v_readiness_status <> 'review_ready' then
    v_publication_eligible := false;
  end if;

  v_progress := v_progress || pg_catalog.jsonb_build_object(
    'status', v_event_status,
    'currentStageId', pg_catalog.btrim(p_stage_id),
    'currentStageVersion', pg_catalog.btrim(p_stage_version),
    'readinessStatus', v_readiness_status,
    'artProvenance', v_art_provenance,
    'publicationEligible', v_publication_eligible,
    'updatedAt', now()
  );
  if p_status in ('succeeded', 'skipped') then
    v_progress := v_progress || pg_catalog.jsonb_build_object(
      'lastSuccessfulStageId', pg_catalog.btrim(p_stage_id),
      'lastSuccessfulStageVersion', pg_catalog.btrim(p_stage_version),
      'lastSuccessfulCheckpointKey', pg_catalog.btrim(p_checkpoint_key)
    );
  end if;

  v_summary := pg_catalog.jsonb_set(
    v_run.summary,
    array['eventProgress', pg_catalog.btrim(p_event_key)],
    v_progress,
    true
  );
  v_summary := v_summary || pg_catalog.jsonb_build_object(
    'completionStatus',
    case
      when p_status = 'blocked' then 'waiting_for_exceptions'
      when v_run.summary->>'completionStatus' in ('queued', 'validating')
        then 'running'
      else v_run.summary->>'completionStatus'
    end
  );

  update public.atlas_operation_runs
  set
    status = case when p_status = 'blocked' then 'partial' else 'running' end,
    started_at = coalesce(started_at, now()),
    summary = v_summary,
    updated_at = now()
  where id = p_run_id;

  perform public.atlas_refresh_michigan_completion_summary(p_run_id);

  return pg_catalog.jsonb_build_object(
    'actionId', v_action.id,
    'runId', p_run_id,
    'eventKey', pg_catalog.btrim(p_event_key),
    'stageId', pg_catalog.btrim(p_stage_id),
    'stageVersion', pg_catalog.btrim(p_stage_version),
    'checkpointKey', pg_catalog.btrim(p_checkpoint_key),
    'status', p_status,
    'output', p_output,
    'links', p_links,
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_record_michigan_completion_exception(
  p_run_id uuid,
  p_actor_identity text,
  p_event_key text,
  p_stage_id text,
  p_exception_code text,
  p_classification text,
  p_dedupe_key text,
  p_message text,
  p_evidence jsonb,
  p_related_ids jsonb,
  p_recommended_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_existing public.atlas_review_items;
  v_review_id uuid := gen_random_uuid();
  v_operation_action_id uuid;
  v_evidence jsonb;
  v_priority integer;
  v_event_id uuid;
  v_candidate_id uuid;
  v_progress jsonb;
  v_summary jsonb;
  v_retryable boolean;
  v_model_review_eligible boolean;
  v_human_review_required boolean;
  v_publication_blocking boolean;
  v_fatal boolean;
  v_workflow_blocking boolean;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or nullif(pg_catalog.btrim(p_stage_id), '') is null
     or nullif(pg_catalog.btrim(p_exception_code), '') is null
     or nullif(pg_catalog.btrim(p_dedupe_key), '') is null
     or nullif(pg_catalog.btrim(p_message), '') is null then
    raise exception 'Exception run, stage, code, dedupe, message, and actor are required.'
      using errcode = '22023';
  end if;
  if p_classification not in (
    'informational',
    'retryable',
    'model_review_eligible',
    'human_review_required',
    'publication_blocking',
    'fatal'
  ) then
    raise exception 'Unsupported completion exception classification.'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_evidence) <> 'object'
     or pg_catalog.jsonb_typeof(p_related_ids) <> 'object' then
    raise exception 'Exception evidence and related IDs must be JSON objects.'
      using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_event_key), '') is null
     and p_classification <> 'fatal' then
    raise exception 'Non-fatal completion exceptions require an event key.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'michigan_completion_exception:' || p_run_id::text || ':' ||
      pg_catalog.btrim(p_dedupe_key),
      0
    )
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;
  if nullif(pg_catalog.btrim(p_event_key), '') is not null
     and not exists (
       select 1
       from pg_catalog.jsonb_array_elements(v_run.request->'events') as event
       where event->>'eventKey' = pg_catalog.btrim(p_event_key)
     ) then
    raise exception 'Exception event is not part of the immutable run manifest.'
      using errcode = '22023';
  end if;

  if nullif(p_related_ids->>'eventId', '') is not null then
    v_event_id := (p_related_ids->>'eventId')::uuid;
  end if;
  if nullif(p_related_ids->>'candidateId', '') is not null then
    v_candidate_id := (p_related_ids->>'candidateId')::uuid;
  end if;

  v_retryable := coalesce(
    (p_evidence->>'retryable')::boolean,
    p_classification = 'retryable'
  );
  v_model_review_eligible := coalesce(
    (p_evidence->>'modelReviewEligible')::boolean,
    p_classification = 'model_review_eligible'
  );
  v_human_review_required := coalesce(
    (p_evidence->>'humanReviewRequired')::boolean,
    p_classification = 'human_review_required'
  );
  v_publication_blocking := coalesce(
    (p_evidence->>'publicationBlocking')::boolean,
    p_classification in ('publication_blocking', 'fatal')
  );
  v_fatal := coalesce(
    (p_evidence->>'fatal')::boolean,
    p_classification = 'fatal'
  );
  v_workflow_blocking := coalesce(
    (p_evidence->>'workflowBlocking')::boolean,
    v_human_review_required or v_fatal
  );

  v_priority := case p_classification
    when 'fatal' then 5
    when 'publication_blocking' then 4
    when 'human_review_required' then 4
    when 'model_review_eligible' then 3
    when 'retryable' then 2
    else 1
  end;
  v_evidence := p_evidence || pg_catalog.jsonb_build_object(
    'contractVersion', 'michigan-completion-exception-v1',
    'eventKey', nullif(pg_catalog.btrim(p_event_key), ''),
    'stageId', pg_catalog.btrim(p_stage_id),
    'exceptionCode', pg_catalog.btrim(p_exception_code),
    'classification', p_classification,
    'dedupeKey', pg_catalog.btrim(p_dedupe_key),
    'message', pg_catalog.btrim(p_message),
    'relatedIds', p_related_ids,
    'retryable', v_retryable,
    'modelReviewEligible', v_model_review_eligible,
    'humanReviewRequired', v_human_review_required,
    'publicationBlocking', v_publication_blocking,
    'fatal', v_fatal,
    'workflowBlocking', v_workflow_blocking
  );

  select item.* into v_existing
  from public.atlas_review_items as item
  where item.operation_run_id = p_run_id
    and item.review_type = 'michigan_completion_exception'
    and item.evidence->>'dedupeKey' = pg_catalog.btrim(p_dedupe_key)
  for share;

  if found then
    if v_existing.evidence is distinct from v_evidence
       or v_existing.event_id is distinct from v_event_id
       or v_existing.candidate_id is distinct from v_candidate_id
       or v_existing.priority is distinct from v_priority
       or v_existing.recommended_action is distinct from
         coalesce(
           nullif(pg_catalog.btrim(p_recommended_action), ''),
           'Review retained evidence and resolve the completion exception.'
         ) then
      raise exception 'Exception replay conflicts with the retained review item.'
        using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'reviewItemId', v_existing.id,
      'runId', p_run_id,
      'eventKey', p_event_key,
      'stageId', p_stage_id,
      'exceptionCode', p_exception_code,
      'classification', p_classification,
      'status', coalesce((
        select action.to_status
        from public.atlas_review_item_actions as action
        where action.review_item_id = v_existing.id
        order by action.created_at desc, action.id desc
        limit 1
      ), 'open'),
      'exactReplay', true
    );
  end if;

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
    'michigan_completion_exception_opened',
    'atlas_review_item',
    v_review_id,
    'blocked',
    '[]'::jsonb,
    pg_catalog.jsonb_build_object(
      'eventKey', nullif(pg_catalog.btrim(p_event_key), ''),
      'stageId', pg_catalog.btrim(p_stage_id),
      'exceptionCode', pg_catalog.btrim(p_exception_code),
      'classification', p_classification,
      'dedupeKey', pg_catalog.btrim(p_dedupe_key),
      'relatedIds', p_related_ids
    ),
    pg_catalog.jsonb_build_object(
      'reviewItemId', v_review_id,
      'status', 'open'
    ),
    pg_catalog.btrim(p_message),
    '[]'::jsonb,
    now()
  )
  returning id into v_operation_action_id;

  insert into public.atlas_review_items (
    id,
    operation_run_id,
    operation_action_id,
    review_type,
    event_id,
    candidate_id,
    priority,
    status,
    evidence,
    recommended_action,
    resolution_details
  ) values (
    v_review_id,
    p_run_id,
    v_operation_action_id,
    'michigan_completion_exception',
    v_event_id,
    v_candidate_id,
    v_priority,
    'open',
    v_evidence,
    coalesce(
      nullif(pg_catalog.btrim(p_recommended_action), ''),
      'Review retained evidence and resolve the completion exception.'
    ),
    '{}'::jsonb
  );

  insert into public.atlas_review_item_actions (
    review_item_id,
    operation_run_id,
    operation_action_id,
    action_type,
    from_status,
    to_status,
    actor_identity,
    idempotency_key,
    reason,
    details
  ) values (
    v_review_id,
    p_run_id,
    v_operation_action_id,
    'created',
    null,
    'open',
    pg_catalog.btrim(p_actor_identity),
    'created:' || pg_catalog.btrim(p_dedupe_key),
    pg_catalog.btrim(p_message),
    pg_catalog.jsonb_build_object(
      'exceptionCode', pg_catalog.btrim(p_exception_code),
      'classification', p_classification
    )
  );

  if nullif(pg_catalog.btrim(p_event_key), '') is not null then
    v_progress := coalesce(
      v_run.summary #> array['eventProgress', pg_catalog.btrim(p_event_key)],
      '{}'::jsonb
    );
    if v_workflow_blocking then
      v_progress := v_progress || pg_catalog.jsonb_build_object(
        'status', 'waiting_for_exception',
        'publicationEligible', false,
        'updatedAt', now()
      );
    elsif v_publication_blocking then
      v_progress := v_progress || pg_catalog.jsonb_build_object(
        'publicationEligible', false,
        'updatedAt', now()
      );
    end if;

    v_summary := pg_catalog.jsonb_set(
      v_run.summary,
      array['eventProgress', pg_catalog.btrim(p_event_key)],
      v_progress,
      true
    );
  else
    v_summary := v_run.summary;
  end if;
  if v_workflow_blocking then
    v_summary := v_summary || pg_catalog.jsonb_build_object(
      'completionStatus', 'waiting_for_exceptions'
    );
  end if;

  update public.atlas_operation_runs
  set
    status = case
      when v_workflow_blocking then 'partial'
      else status
    end,
    summary = v_summary,
    updated_at = now()
  where id = p_run_id;

  perform public.atlas_refresh_michigan_completion_summary(p_run_id);

  return pg_catalog.jsonb_build_object(
    'reviewItemId', v_review_id,
    'operationActionId', v_operation_action_id,
    'runId', p_run_id,
    'eventKey', nullif(pg_catalog.btrim(p_event_key), ''),
    'stageId', pg_catalog.btrim(p_stage_id),
    'exceptionCode', pg_catalog.btrim(p_exception_code),
    'classification', p_classification,
    'status', 'open',
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_transition_michigan_completion_exception(
  p_review_item_id uuid,
  p_actor_identity text,
  p_to_status text,
  p_reason text,
  p_resolution_details jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.atlas_review_items;
  v_run public.atlas_operation_runs;
  v_from_status text;
  v_latest_action public.atlas_review_item_actions;
  v_operation_action_id uuid;
  v_review_action_id uuid;
  v_event_key text;
  v_progress jsonb;
  v_has_blocker boolean;
begin
  perform public.atlas_assert_service_role();

  if p_review_item_id is null
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or p_to_status not in ('acknowledged', 'resolved', 'waived', 'superseded') then
    raise exception 'Review item, actor, and supported target status are required.'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_resolution_details) <> 'object' then
    raise exception 'Exception resolution details must be a JSON object.'
      using errcode = '22023';
  end if;
  if p_to_status in ('waived', 'superseded')
     and nullif(pg_catalog.btrim(p_reason), '') is null then
    raise exception 'Waived and superseded exceptions require a reason.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'michigan_completion_review:' || p_review_item_id::text,
      0
    )
  );

  select item.* into v_item
  from public.atlas_review_items as item
  where item.id = p_review_item_id
    and item.review_type = 'michigan_completion_exception'
  for update;
  if not found then
    raise exception 'Michigan completion exception was not found.'
      using errcode = 'P0002';
  end if;

  select action.* into v_latest_action
  from public.atlas_review_item_actions as action
  where action.review_item_id = p_review_item_id
  order by action.created_at desc, action.id desc
  limit 1;
  v_from_status := coalesce(v_latest_action.to_status, 'open');

  if v_from_status = p_to_status then
    if coalesce(v_latest_action.reason, '') is distinct from coalesce(
         nullif(pg_catalog.btrim(p_reason), ''),
         ''
       )
       or v_latest_action.details is distinct from p_resolution_details then
      raise exception 'Exception transition replay conflicts with retained resolution.'
        using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'reviewItemId', p_review_item_id,
      'runId', v_item.operation_run_id,
      'fromStatus', v_from_status,
      'toStatus', p_to_status,
      'exactReplay', true
    );
  end if;
  if v_from_status in ('resolved', 'waived', 'superseded') then
    raise exception 'Terminal completion exceptions cannot transition again.'
      using errcode = '55000';
  end if;
  if v_from_status = 'acknowledged' and p_to_status = 'acknowledged' then
    raise exception 'Exception is already acknowledged.' using errcode = '55000';
  end if;

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = v_item.operation_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;

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
    v_item.operation_run_id,
    'michigan_completion_exception_transitioned',
    'atlas_review_item',
    p_review_item_id,
    'applied',
    '[]'::jsonb,
    pg_catalog.jsonb_build_object(
      'reviewItemId', p_review_item_id,
      'fromStatus', v_from_status,
      'toStatus', p_to_status,
      'reason', nullif(pg_catalog.btrim(p_reason), ''),
      'resolutionDetails', p_resolution_details
    ),
    pg_catalog.jsonb_build_object('status', p_to_status),
    coalesce(
      nullif(pg_catalog.btrim(p_reason), ''),
      'Completion exception state updated.'
    ),
    '[]'::jsonb,
    now()
  )
  returning id into v_operation_action_id;

  insert into public.atlas_review_item_actions (
    review_item_id,
    operation_run_id,
    operation_action_id,
    action_type,
    from_status,
    to_status,
    actor_identity,
    idempotency_key,
    reason,
    details
  ) values (
    p_review_item_id,
    v_item.operation_run_id,
    v_operation_action_id,
    p_to_status,
    v_from_status,
    p_to_status,
    pg_catalog.btrim(p_actor_identity),
    p_to_status || ':' || v_operation_action_id::text,
    nullif(pg_catalog.btrim(p_reason), ''),
    p_resolution_details
  )
  returning id into v_review_action_id;

  update public.atlas_review_items
  set
    status = case
      when p_to_status = 'acknowledged' then 'open'
      else 'resolved'
    end,
    resolution_details = case
      when p_to_status = 'acknowledged' then resolution_details
      else p_resolution_details || pg_catalog.jsonb_build_object(
        'completionStatus', p_to_status,
        'reason', nullif(pg_catalog.btrim(p_reason), '')
      )
    end,
    resolved_by = case
      when p_to_status = 'acknowledged' then null
      else pg_catalog.btrim(p_actor_identity)
    end,
    resolved_at = case
      when p_to_status = 'acknowledged' then null
      else now()
    end,
    updated_at = now()
  where id = p_review_item_id;

  v_event_key := v_item.evidence->>'eventKey';
  if nullif(v_event_key, '') is not null
     and p_to_status in ('resolved', 'waived', 'superseded') then
    select exists (
      select 1
      from public.atlas_review_items as item
      where item.operation_run_id = v_item.operation_run_id
        and item.review_type = 'michigan_completion_exception'
        and item.id <> p_review_item_id
        and item.evidence->>'eventKey' = v_event_key
        and coalesce((item.evidence->>'workflowBlocking')::boolean, false)
        and coalesce((
          select action.to_status
          from public.atlas_review_item_actions as action
          where action.review_item_id = item.id
          order by action.created_at desc, action.id desc
          limit 1
        ), 'open') in ('open', 'acknowledged')
    ) into v_has_blocker;

    if not v_has_blocker then
      v_progress := coalesce(
        v_run.summary #> array['eventProgress', v_event_key],
        '{}'::jsonb
      );
      if v_progress->>'status' = 'waiting_for_exception' then
        v_progress := v_progress || pg_catalog.jsonb_build_object(
          'status', 'running',
          'updatedAt', now()
        );
        update public.atlas_operation_runs
        set
          status = 'running',
          summary = pg_catalog.jsonb_set(
            summary || pg_catalog.jsonb_build_object(
              'completionStatus', 'running'
            ),
            array['eventProgress', v_event_key],
            v_progress,
            true
          ),
          updated_at = now()
        where id = v_item.operation_run_id;
      end if;
    end if;
  end if;

  perform public.atlas_refresh_michigan_completion_summary(v_item.operation_run_id);

  return pg_catalog.jsonb_build_object(
    'reviewItemId', p_review_item_id,
    'reviewActionId', v_review_action_id,
    'operationActionId', v_operation_action_id,
    'runId', v_item.operation_run_id,
    'fromStatus', v_from_status,
    'toStatus', p_to_status,
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_reserve_michigan_completion_model_action(
  p_run_id uuid,
  p_actor_identity text,
  p_event_key text,
  p_stage_id text,
  p_charge_key text,
  p_processor text,
  p_route_id text,
  p_reason text,
  p_deterministic_preconditions jsonb,
  p_model_family text,
  p_configured_model text,
  p_reasoning_level text,
  p_max_attempts integer,
  p_attempt_number integer,
  p_estimated_input_usage bigint,
  p_estimated_output_usage bigint,
  p_estimated_cost_micros bigint,
  p_fallback_behavior text,
  p_failure_blocking boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_existing public.atlas_operation_actions;
  v_action public.atlas_operation_actions;
  v_requested jsonb;
  v_run_budget jsonb;
  v_event_budget jsonb;
  v_run_input bigint := 0;
  v_run_output bigint := 0;
  v_run_cost bigint := 0;
  v_event_input bigint := 0;
  v_event_output bigint := 0;
  v_event_cost bigint := 0;
  v_event_total_budget bigint := 0;
  v_status text;
  v_lifecycle text;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or nullif(pg_catalog.btrim(p_event_key), '') is null
     or nullif(pg_catalog.btrim(p_stage_id), '') is null
     or nullif(pg_catalog.btrim(p_charge_key), '') is null
     or nullif(pg_catalog.btrim(p_processor), '') is null
     or nullif(pg_catalog.btrim(p_route_id), '') is null
     or nullif(pg_catalog.btrim(p_reason), '') is null
     or nullif(pg_catalog.btrim(p_model_family), '') is null
     or nullif(pg_catalog.btrim(p_configured_model), '') is null
     or nullif(pg_catalog.btrim(p_fallback_behavior), '') is null then
    raise exception 'Model reservation routing and identity fields are required.'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_deterministic_preconditions) <> 'object' then
    raise exception 'Deterministic model preconditions must be a JSON object.'
      using errcode = '22023';
  end if;
  if p_max_attempts is null or p_max_attempts < 1 or p_max_attempts > 10
     or p_attempt_number is null
     or p_attempt_number < 1
     or p_attempt_number > p_max_attempts then
    raise exception 'Model attempt number must fit the bounded maximum attempts.'
      using errcode = '22023';
  end if;
  if p_estimated_input_usage is null or p_estimated_input_usage < 0
     or p_estimated_output_usage is null or p_estimated_output_usage < 0
     or p_estimated_cost_micros is null or p_estimated_cost_micros < 0
     or p_estimated_input_usage + p_estimated_output_usage = 0 then
    raise exception 'Estimated model usage must be non-negative and include tokens.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'michigan_completion_model:' || p_run_id::text || ':' ||
      pg_catalog.btrim(p_charge_key),
      0
    )
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;
  if v_run.summary->>'completionStatus' in ('completed', 'failed', 'cancelled') then
    raise exception 'Terminal completion runs cannot reserve model work.'
      using errcode = '55000';
  end if;
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_run.request->'events') as event
    where event->>'eventKey' = pg_catalog.btrim(p_event_key)
  ) then
    raise exception 'Model action event is not part of the immutable run manifest.'
      using errcode = '22023';
  end if;

  v_run_budget := v_run.request->'runBudget';
  v_event_budget := v_run.request->'perEventBudget';
  select coalesce(
    (event->>'perEventModelBudgetTokens')::bigint,
    (v_event_budget->>'totalTokens')::bigint,
    0
  )
  into v_event_total_budget
  from pg_catalog.jsonb_array_elements(v_run.request->'events') as event
  where event->>'eventKey' = pg_catalog.btrim(p_event_key);
  v_event_budget := v_event_budget || pg_catalog.jsonb_build_object(
    'totalTokens', v_event_total_budget
  );

  v_requested := pg_catalog.jsonb_build_object(
    'eventKey', pg_catalog.btrim(p_event_key),
    'stageId', pg_catalog.btrim(p_stage_id),
    'chargeKey', pg_catalog.btrim(p_charge_key),
    'processor', pg_catalog.btrim(p_processor),
    'routeId', pg_catalog.btrim(p_route_id),
    'reason', pg_catalog.btrim(p_reason),
    'deterministicPreconditions', p_deterministic_preconditions,
    'modelFamily', pg_catalog.btrim(p_model_family),
    'configuredModel', pg_catalog.btrim(p_configured_model),
    'reasoningLevel', nullif(pg_catalog.btrim(p_reasoning_level), ''),
    'maxAttempts', p_max_attempts,
    'attemptNumber', p_attempt_number,
    'estimatedInputUsage', p_estimated_input_usage,
    'estimatedOutputUsage', p_estimated_output_usage,
    'estimatedCostMicros', p_estimated_cost_micros,
    'runBudget', v_run_budget,
    'eventBudget', v_event_budget,
    'fallbackBehavior', pg_catalog.btrim(p_fallback_behavior),
    'failureBlocking', coalesce(p_failure_blocking, true)
  );

  select action.* into v_existing
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type in (
      'michigan_completion_model_reserved',
      'michigan_completion_model_budget_blocked',
      'michigan_completion_model_rejected'
    )
    and action.requested_payload->>'chargeKey' = pg_catalog.btrim(p_charge_key)
  for share;

  if found then
    if (v_existing.requested_payload - 'modelStatus') is distinct from v_requested then
      raise exception 'Model charge replay conflicts with the retained reservation.'
        using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'actionId', v_existing.id,
      'runId', p_run_id,
      'eventKey', pg_catalog.btrim(p_event_key),
      'chargeKey', pg_catalog.btrim(p_charge_key),
      'status', v_existing.requested_payload->>'modelStatus',
      'reserved',
        v_existing.action_type = 'michigan_completion_model_reserved',
      'exactReplay', true
    );
  end if;

  with reservations as (
    select
      action.id,
      action.requested_payload->>'eventKey' as event_key,
      coalesce((action.requested_payload->>'estimatedInputUsage')::bigint, 0) as input_usage,
      coalesce((action.requested_payload->>'estimatedOutputUsage')::bigint, 0) as output_usage,
      coalesce((action.requested_payload->>'estimatedCostMicros')::bigint, 0) as cost_micros
    from public.atlas_operation_actions as action
    where action.operation_run_id = p_run_id
      and action.action_type = 'michigan_completion_model_reserved'
  ),
  finished as (
    select
      (action.requested_payload->>'reservationActionId')::uuid as reservation_id,
      coalesce((action.requested_payload->>'actualInputUsage')::bigint, 0) as input_usage,
      coalesce((action.requested_payload->>'actualOutputUsage')::bigint, 0) as output_usage,
      coalesce((action.requested_payload->>'actualCostMicros')::bigint, 0) as cost_micros
    from public.atlas_operation_actions as action
    where action.operation_run_id = p_run_id
      and action.action_type = 'michigan_completion_model_finished'
  )
  select
    coalesce(sum(coalesce(finished.input_usage, reservations.input_usage)), 0),
    coalesce(sum(coalesce(finished.output_usage, reservations.output_usage)), 0),
    coalesce(sum(coalesce(finished.cost_micros, reservations.cost_micros)), 0),
    coalesce(sum(
      case when reservations.event_key = pg_catalog.btrim(p_event_key)
        then coalesce(finished.input_usage, reservations.input_usage)
        else 0
      end
    ), 0),
    coalesce(sum(
      case when reservations.event_key = pg_catalog.btrim(p_event_key)
        then coalesce(finished.output_usage, reservations.output_usage)
        else 0
      end
    ), 0),
    coalesce(sum(
      case when reservations.event_key = pg_catalog.btrim(p_event_key)
        then coalesce(finished.cost_micros, reservations.cost_micros)
        else 0
      end
    ), 0)
  into
    v_run_input,
    v_run_output,
    v_run_cost,
    v_event_input,
    v_event_output,
    v_event_cost
  from reservations
  left join finished on finished.reservation_id = reservations.id;

  if coalesce((v_run.request->>'deterministicOnly')::boolean, false) then
    v_status := 'rejected';
    v_lifecycle := 'blocked';
  elsif v_run_input + p_estimated_input_usage >
          coalesce((v_run_budget->>'inputTokens')::bigint, 0)
     or v_run_output + p_estimated_output_usage >
          coalesce((v_run_budget->>'outputTokens')::bigint, 0)
     or v_run_input + v_run_output
          + p_estimated_input_usage + p_estimated_output_usage >
          coalesce((v_run_budget->>'totalTokens')::bigint, 0)
     or v_run_cost + p_estimated_cost_micros >
          coalesce((v_run_budget->>'costMicros')::bigint, 0)
     or v_event_input + p_estimated_input_usage >
          coalesce((v_event_budget->>'inputTokens')::bigint, 0)
     or v_event_output + p_estimated_output_usage >
          coalesce((v_event_budget->>'outputTokens')::bigint, 0)
     or v_event_input + v_event_output
          + p_estimated_input_usage + p_estimated_output_usage >
          v_event_total_budget
     or v_event_cost + p_estimated_cost_micros >
          coalesce((v_event_budget->>'costMicros')::bigint, 0) then
    v_status := 'budget_blocked';
    v_lifecycle := 'blocked';
  else
    v_status := 'reserved';
    v_lifecycle := 'proposed';
  end if;

  v_requested := v_requested || pg_catalog.jsonb_build_object(
    'modelStatus', v_status
  );

  insert into public.atlas_operation_actions (
    operation_run_id,
    action_type,
    target_entity_type,
    lifecycle_state,
    source_references,
    requested_payload,
    applied_payload,
    reason,
    warnings,
    failure,
    applied_at
  ) values (
    p_run_id,
    case v_status
      when 'reserved' then 'michigan_completion_model_reserved'
      when 'budget_blocked' then 'michigan_completion_model_budget_blocked'
      else 'michigan_completion_model_rejected'
    end,
    'michigan_completion_event',
    v_lifecycle,
    '[]'::jsonb,
    v_requested,
    pg_catalog.jsonb_build_object(
      'status', v_status,
      'reserved', v_status = 'reserved',
      'budgetBefore', pg_catalog.jsonb_build_object(
        'runInputUsage', v_run_input,
        'runOutputUsage', v_run_output,
        'runCostMicros', v_run_cost,
        'eventInputUsage', v_event_input,
        'eventOutputUsage', v_event_output,
        'eventCostMicros', v_event_cost
      )
    ),
    case v_status
      when 'reserved' then 'Reserved bounded model usage before a provider call.'
      when 'budget_blocked' then 'Rejected model work because a run or event budget would be exceeded.'
      else 'Rejected model work because this run is deterministic-only.'
    end,
    '[]'::jsonb,
    case
      when v_status = 'reserved' then null
      else pg_catalog.jsonb_build_object(
        'code',
          case
            when v_status = 'budget_blocked' then 'model_budget_exceeded'
            else 'deterministic_only_model_rejected'
          end,
        'fallbackBehavior', pg_catalog.btrim(p_fallback_behavior)
      )
    end,
    case when v_status = 'reserved' then null else now() end
  )
  returning * into v_action;

  perform public.atlas_refresh_michigan_completion_summary(p_run_id);

  return pg_catalog.jsonb_build_object(
    'actionId', v_action.id,
    'runId', p_run_id,
    'eventKey', pg_catalog.btrim(p_event_key),
    'chargeKey', pg_catalog.btrim(p_charge_key),
    'status', v_status,
    'reserved', v_status = 'reserved',
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_finish_michigan_completion_model_action(
  p_run_id uuid,
  p_reservation_action_id uuid,
  p_actor_identity text,
  p_status text,
  p_actual_input_usage bigint,
  p_actual_output_usage bigint,
  p_actual_cost_micros bigint,
  p_provider_response_id text,
  p_failure jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_reservation public.atlas_operation_actions;
  v_existing public.atlas_operation_actions;
  v_action public.atlas_operation_actions;
  v_requested jsonb;
  v_lifecycle text;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null
     or p_reservation_action_id is null
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or p_status not in ('succeeded', 'failed', 'rejected') then
    raise exception 'Model completion run, reservation, actor, and status are required.'
      using errcode = '22023';
  end if;
  if p_actual_input_usage is null or p_actual_input_usage < 0
     or p_actual_output_usage is null or p_actual_output_usage < 0
     or p_actual_cost_micros is null or p_actual_cost_micros < 0 then
    raise exception 'Actual model usage must be non-negative.'
      using errcode = '22023';
  end if;
  if p_status = 'failed'
     and (p_failure is null or pg_catalog.jsonb_typeof(p_failure) <> 'object') then
    raise exception 'Failed model actions require a failure object.'
      using errcode = '22023';
  end if;
  if p_failure is not null and pg_catalog.jsonb_typeof(p_failure) <> 'object' then
    raise exception 'Model failure must be a JSON object.' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'michigan_completion_model_finish:' || p_reservation_action_id::text,
      0
    )
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;

  select action.* into v_reservation
  from public.atlas_operation_actions as action
  where action.id = p_reservation_action_id
    and action.operation_run_id = p_run_id
    and action.action_type = 'michigan_completion_model_reserved'
  for share;
  if not found then
    raise exception 'Bounded model reservation was not found.'
      using errcode = 'P0002';
  end if;

  if p_actual_input_usage >
       (v_reservation.requested_payload->>'estimatedInputUsage')::bigint
     or p_actual_output_usage >
       (v_reservation.requested_payload->>'estimatedOutputUsage')::bigint
     or p_actual_cost_micros >
       (v_reservation.requested_payload->>'estimatedCostMicros')::bigint then
    raise exception 'Actual model usage exceeds the amount reserved before the call.'
      using errcode = '54000';
  end if;

  v_requested := pg_catalog.jsonb_build_object(
    'reservationActionId', p_reservation_action_id,
    'eventKey', v_reservation.requested_payload->>'eventKey',
    'chargeKey', v_reservation.requested_payload->>'chargeKey',
    'modelStatus', p_status,
    'actualInputUsage', p_actual_input_usage,
    'actualOutputUsage', p_actual_output_usage,
    'actualCostMicros', p_actual_cost_micros,
    'providerResponseId', nullif(pg_catalog.btrim(p_provider_response_id), '')
  );

  select action.* into v_existing
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type = 'michigan_completion_model_finished'
    and action.requested_payload->>'reservationActionId' =
      p_reservation_action_id::text
  for share;
  if found then
    if v_existing.requested_payload is distinct from v_requested
       or v_existing.failure is distinct from p_failure then
      raise exception 'Model usage replay conflicts with retained usage.'
        using errcode = '23505';
    end if;

    return pg_catalog.jsonb_build_object(
      'actionId', v_existing.id,
      'reservationActionId', p_reservation_action_id,
      'runId', p_run_id,
      'status', p_status,
      'usage', pg_catalog.jsonb_build_object(
        'inputUsage', p_actual_input_usage,
        'outputUsage', p_actual_output_usage,
        'costMicros', p_actual_cost_micros
      ),
      'exactReplay', true
    );
  end if;

  v_lifecycle := case p_status
    when 'succeeded' then 'applied'
    when 'failed' then 'failed'
    else 'blocked'
  end;

  insert into public.atlas_operation_actions (
    operation_run_id,
    action_type,
    target_entity_type,
    lifecycle_state,
    source_references,
    requested_payload,
    before_snapshot,
    applied_payload,
    after_snapshot,
    reason,
    warnings,
    failure,
    applied_at
  ) values (
    p_run_id,
    'michigan_completion_model_finished',
    'michigan_completion_event',
    v_lifecycle,
    '[]'::jsonb,
    v_requested,
    pg_catalog.jsonb_build_object(
      'reservationActionId', p_reservation_action_id,
      'status', 'reserved'
    ),
    pg_catalog.jsonb_build_object(
      'providerResponseId', nullif(pg_catalog.btrim(p_provider_response_id), ''),
      'usage', pg_catalog.jsonb_build_object(
        'inputUsage', p_actual_input_usage,
        'outputUsage', p_actual_output_usage,
        'costMicros', p_actual_cost_micros
      )
    ),
    pg_catalog.jsonb_build_object('status', p_status),
    case p_status
      when 'succeeded' then 'Recorded bounded model usage.'
      when 'failed' then 'Recorded bounded model failure without discarding deterministic content.'
      else 'Recorded rejected model output without replacing deterministic content.'
    end,
    '[]'::jsonb,
    p_failure,
    now()
  )
  returning * into v_action;

  perform public.atlas_refresh_michigan_completion_summary(p_run_id);

  return pg_catalog.jsonb_build_object(
    'actionId', v_action.id,
    'reservationActionId', p_reservation_action_id,
    'runId', p_run_id,
    'eventKey', v_reservation.requested_payload->>'eventKey',
    'chargeKey', v_reservation.requested_payload->>'chargeKey',
    'status', p_status,
    'usage', pg_catalog.jsonb_build_object(
      'inputUsage', p_actual_input_usage,
      'outputUsage', p_actual_output_usage,
      'costMicros', p_actual_cost_micros
    ),
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_finalize_michigan_completion_run(
  p_run_id uuid,
  p_actor_identity text,
  p_status text,
  p_stage_counts jsonb,
  p_event_counts jsonb,
  p_readiness_counts jsonb,
  p_error jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_existing public.atlas_operation_actions;
  v_action_id uuid;
  v_requested jsonb;
  v_operation_status text;
  v_active_blockers integer := 0;
  v_completed_at timestamptz;
begin
  perform public.atlas_assert_service_role();

  if p_run_id is null
     or nullif(pg_catalog.btrim(p_actor_identity), '') is null
     or p_status not in (
       'waiting_for_exceptions',
       'ready_for_review',
       'completed',
       'failed',
       'cancelled'
     ) then
    raise exception 'Run, actor, and supported completion status are required.'
      using errcode = '22023';
  end if;
  if pg_catalog.jsonb_typeof(p_stage_counts) <> 'object'
     or pg_catalog.jsonb_typeof(p_event_counts) <> 'object'
     or pg_catalog.jsonb_typeof(p_readiness_counts) <> 'object'
     or (p_error is not null and pg_catalog.jsonb_typeof(p_error) <> 'object') then
    raise exception 'Completion final counts and error have an invalid shape.'
      using errcode = '22023';
  end if;
  if p_status = 'failed' and p_error is null then
    raise exception 'Failed completion runs require an error object.'
      using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('michigan_completion_run:' || p_run_id::text, 0)
  );

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1'
  for update;
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;

  v_requested := pg_catalog.jsonb_build_object(
    'completionStatus', p_status,
    'stageCounts', p_stage_counts,
    'eventCounts', p_event_counts,
    'readinessCounts', p_readiness_counts,
    'error', p_error
  );

  select action.* into v_existing
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type = 'michigan_completion_run_finalized'
  order by action.created_at desc, action.id desc
  limit 1
  for share;

  if found and v_existing.requested_payload = v_requested then
    return pg_catalog.jsonb_build_object(
      'runId', p_run_id,
      'operationRunId', p_run_id,
      'status', p_status,
      'actionId', v_existing.id,
      'exactReplay', true
    );
  end if;
  if v_run.summary->>'completionStatus' in ('completed', 'failed', 'cancelled') then
    raise exception 'Terminal completion run finalization conflicts with retained state.'
      using errcode = '23505';
  end if;

  with completion_items as (
    select item.id, item.evidence
    from public.atlas_review_items as item
    where item.operation_run_id = p_run_id
      and item.review_type = 'michigan_completion_exception'
  )
  select count(*)::integer into v_active_blockers
  from completion_items as item
  where (
      coalesce((item.evidence->>'humanReviewRequired')::boolean, false)
      or coalesce((item.evidence->>'publicationBlocking')::boolean, false)
      or coalesce((item.evidence->>'fatal')::boolean, false)
    )
    and coalesce((
      select action.to_status
      from public.atlas_review_item_actions as action
      where action.review_item_id = item.id
      order by action.created_at desc, action.id desc
      limit 1
    ), 'open') in ('open', 'acknowledged');

  if p_status = 'completed' and v_active_blockers > 0 then
    raise exception 'A completion run with active blocking exceptions cannot complete.'
      using errcode = '55000';
  end if;
  if p_status = 'completed' and exists (
    select 1
    from pg_catalog.jsonb_each(
      coalesce(v_run.summary->'eventProgress', '{}'::jsonb)
    ) as progress
    where coalesce(progress.value->>'status', 'queued')
      not in ('ready_for_review', 'completed')
  ) then
    raise exception 'Every event must finish or reach review before run completion.'
      using errcode = '55000';
  end if;

  v_operation_status := case p_status
    when 'waiting_for_exceptions' then 'partial'
    when 'ready_for_review' then 'partial'
    when 'completed' then 'succeeded'
    when 'failed' then 'failed'
    when 'cancelled' then 'cancelled'
  end;
  v_completed_at := case
    when p_status in ('completed', 'failed', 'cancelled') then now()
    else null
  end;

  update public.atlas_operation_runs
  set
    status = v_operation_status,
    summary = summary || pg_catalog.jsonb_build_object(
      'completionStatus', p_status,
      'stageCounts', p_stage_counts,
      'eventCounts', p_event_counts,
      'readinessCounts', p_readiness_counts,
      'finalizedAt', now()
    ),
    error = p_error,
    completed_at = v_completed_at,
    updated_at = now()
  where id = p_run_id;

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
    failure,
    applied_at
  ) values (
    p_run_id,
    'michigan_completion_run_finalized',
    'michigan_completion_run',
    p_run_id,
    case p_status
      when 'completed' then 'applied'
      when 'failed' then 'failed'
      when 'cancelled' then 'skipped'
      else 'blocked'
    end,
    '[]'::jsonb,
    v_requested,
    pg_catalog.jsonb_build_object(
      'operationStatus', v_operation_status,
      'publicationPerformed', false
    ),
    'Finalized private completion state without publishing or materializing an event.',
    '[]'::jsonb,
    p_error,
    now()
  )
  returning id into v_action_id;

  perform public.atlas_refresh_michigan_completion_summary(p_run_id);

  return pg_catalog.jsonb_build_object(
    'runId', p_run_id,
    'operationRunId', p_run_id,
    'status', p_status,
    'operationStatus', v_operation_status,
    'actionId', v_action_id,
    'publicationPerformed', false,
    'exactReplay', false
  );
end;
$$;

create or replace function public.atlas_get_michigan_completion_run(
  p_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_run public.atlas_operation_runs;
  v_events jsonb;
  v_checkpoints jsonb;
  v_exceptions jsonb;
  v_model_actions jsonb;
  v_audit jsonb;
begin
  perform public.atlas_assert_service_role();

  select run.* into v_run
  from public.atlas_operation_runs as run
  where run.id = p_run_id
    and run.operation_type = 'michigan_completion_v1';
  if not found then
    raise exception 'Michigan completion run was not found.' using errcode = 'P0002';
  end if;

  select coalesce(pg_catalog.jsonb_agg(
    event.value || pg_catalog.jsonb_build_object(
      'progress',
      coalesce(
        v_run.summary #> array['eventProgress', event.value->>'eventKey'],
        '{}'::jsonb
      )
    )
    order by event.ordinality
  ), '[]'::jsonb)
  into v_events
  from pg_catalog.jsonb_array_elements(v_run.request->'events')
    with ordinality as event(value, ordinality);

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'actionId', action.id,
      'eventKey', action.requested_payload->>'eventKey',
      'stageId', action.requested_payload->>'stageId',
      'stageVersion', action.requested_payload->>'stageVersion',
      'inputHash', action.requested_payload->>'inputHash',
      'checkpointKey', action.requested_payload->>'checkpointKey',
      'actionIdempotencyKey', action.requested_payload->>'actionIdempotencyKey',
      'status', action.requested_payload->>'status',
      'output', action.applied_payload->'output',
      'links', action.applied_payload->'links',
      'warnings', action.warnings,
      'failure', action.failure,
      'createdAt', action.created_at
    )
    order by action.created_at, action.id
  ), '[]'::jsonb)
  into v_checkpoints
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type = 'michigan_completion_checkpoint';

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'reviewItemId', item.id,
      'operationActionId', item.operation_action_id,
      'eventId', item.event_id,
      'candidateId', item.candidate_id,
      'eventKey', item.evidence->>'eventKey',
      'stageId', item.evidence->>'stageId',
      'exceptionCode', item.evidence->>'exceptionCode',
      'classification', item.evidence->>'classification',
      'retryable', coalesce((item.evidence->>'retryable')::boolean, false),
      'modelReviewEligible',
        coalesce((item.evidence->>'modelReviewEligible')::boolean, false),
      'humanReviewRequired',
        coalesce((item.evidence->>'humanReviewRequired')::boolean, false),
      'publicationBlocking',
        coalesce((item.evidence->>'publicationBlocking')::boolean, false),
      'fatal', coalesce((item.evidence->>'fatal')::boolean, false),
      'workflowBlocking',
        coalesce((item.evidence->>'workflowBlocking')::boolean, false),
      'dedupeKey', item.evidence->>'dedupeKey',
      'status', coalesce((
        select review_action.to_status
        from public.atlas_review_item_actions as review_action
        where review_action.review_item_id = item.id
        order by review_action.created_at desc, review_action.id desc
        limit 1
      ), 'open'),
      'priority', item.priority,
      'message', item.evidence->>'message',
      'evidence', item.evidence,
      'recommendedAction', item.recommended_action,
      'resolutionDetails', item.resolution_details,
      'resolvedBy', item.resolved_by,
      'resolvedAt', item.resolved_at,
      'createdAt', item.created_at,
      'updatedAt', item.updated_at
    )
    order by item.priority desc, item.created_at, item.id
  ), '[]'::jsonb)
  into v_exceptions
  from public.atlas_review_items as item
  where item.operation_run_id = p_run_id
    and item.review_type = 'michigan_completion_exception';

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'actionId', action.id,
      'actionType', action.action_type,
      'eventKey', action.requested_payload->>'eventKey',
      'stageId', coalesce(
        action.requested_payload->>'stageId',
        reservation.requested_payload->>'stageId'
      ),
      'chargeKey', action.requested_payload->>'chargeKey',
      'reservationActionId', action.requested_payload->>'reservationActionId',
      'status', coalesce(
        action.requested_payload->>'modelStatus',
        action.applied_payload->>'status'
      ),
      'request', action.requested_payload,
      'result', action.applied_payload,
      'failure', action.failure,
      'createdAt', action.created_at
    )
    order by action.created_at, action.id
  ), '[]'::jsonb)
  into v_model_actions
  from public.atlas_operation_actions as action
  left join public.atlas_operation_actions as reservation
    on action.action_type = 'michigan_completion_model_finished'
   and reservation.id = (action.requested_payload->>'reservationActionId')::uuid
  where action.operation_run_id = p_run_id
    and action.action_type in (
      'michigan_completion_model_reserved',
      'michigan_completion_model_budget_blocked',
      'michigan_completion_model_rejected',
      'michigan_completion_model_finished'
    );

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'actionId', action.id,
      'actionType', action.action_type,
      'lifecycleState', action.lifecycle_state,
      'targetEntityType', action.target_entity_type,
      'targetEntityId', action.target_entity_id,
      'requestedPayload', action.requested_payload,
      'beforeSnapshot', action.before_snapshot,
      'appliedPayload', action.applied_payload,
      'afterSnapshot', action.after_snapshot,
      'reason', action.reason,
      'warnings', action.warnings,
      'failure', action.failure,
      'createdAt', action.created_at,
      'appliedAt', action.applied_at
    )
    order by action.created_at, action.id
  ), '[]'::jsonb)
  into v_audit
  from public.atlas_operation_actions as action
  where action.operation_run_id = p_run_id
    and action.action_type like 'michigan_completion_%';

  return pg_catalog.jsonb_build_object(
    'run', pg_catalog.jsonb_build_object(
      'runId', v_run.id,
      'operationRunId', v_run.id,
      'operationType', v_run.operation_type,
      'actorType', v_run.actor_type,
      'actorIdentity', v_run.actor_identity,
      'operationStatus', v_run.status,
      'status', v_run.summary->>'completionStatus',
      'stateId', v_run.request->>'stateId',
      'countyIdentity', v_run.request->>'countyIdentity',
      'batchIdentity', v_run.request->>'batchIdentity',
      'manifestVersion', v_run.request->>'manifestVersion',
      'inputHash', v_run.request->>'inputHash',
      'orchestratorVersion', v_run.request->>'orchestratorVersion',
      'dryRun', (v_run.request->>'dryRun')::boolean,
      'deterministicOnly', (v_run.request->>'deterministicOnly')::boolean,
      'maxConcurrency', (v_run.request->>'maxConcurrency')::integer,
      'runBudget', v_run.request->'runBudget',
      'perEventBudget', v_run.request->'perEventBudget',
      'modelBudgetTokens',
        coalesce((v_run.request #>> '{runBudget,totalTokens}')::bigint, 0),
      'perEventModelBudgetTokens',
        coalesce((v_run.request #>> '{perEventBudget,totalTokens}')::bigint, 0),
      'stageCounts', v_run.summary->'stageCounts',
      'eventCounts', v_run.summary->'eventCounts',
      'readinessCounts', v_run.summary->'readinessCounts',
      'retryCount', coalesce((v_run.summary->>'retryCount')::integer, 0),
      'modelUsage', v_run.summary->'modelUsage',
      'modelReservedTokens',
        coalesce((v_run.summary #>> '{modelUsage,reservedTotalTokens}')::bigint, 0),
      'modelUsageTokens',
        coalesce((v_run.summary #>> '{modelUsage,actualTotalTokens}')::bigint, 0),
      'estimatedModelInputTokens',
        coalesce((v_run.summary #>> '{modelUsage,reservedInputUsage}')::bigint, 0)
        + coalesce((v_run.summary #>> '{modelUsage,actualInputUsage}')::bigint, 0),
      'estimatedModelOutputTokens',
        coalesce((v_run.summary #>> '{modelUsage,reservedOutputUsage}')::bigint, 0)
        + coalesce((v_run.summary #>> '{modelUsage,actualOutputUsage}')::bigint, 0),
      'actualModelInputTokens',
        coalesce((v_run.summary #>> '{modelUsage,actualInputUsage}')::bigint, 0),
      'actualModelOutputTokens',
        coalesce((v_run.summary #>> '{modelUsage,actualOutputUsage}')::bigint, 0),
      'exceptionCount', coalesce((v_run.summary->>'exceptionCount')::integer, 0),
      'publicationEligibilityCount',
        coalesce((v_run.summary->>'publicationEligibilityCount')::integer, 0),
      'createdAt', v_run.created_at,
      'startedAt', v_run.started_at,
      'updatedAt', v_run.updated_at,
      'completedAt', v_run.completed_at,
      'error', v_run.error
    ),
    'manifest', v_run.request,
    'events', v_events,
    'checkpoints', v_checkpoints,
    'exceptions', v_exceptions,
    'modelActions', v_model_actions,
    'audit', v_audit
  );
end;
$$;

create or replace function public.atlas_list_michigan_completion_runs(
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.atlas_assert_service_role();

  select coalesce(pg_catalog.jsonb_agg(
    pg_catalog.jsonb_build_object(
      'runId', run.id,
      'operationRunId', run.id,
      'status', run.summary->>'completionStatus',
      'operationStatus', run.status,
      'stateId', run.request->>'stateId',
      'countyIdentity', run.request->>'countyIdentity',
      'batchIdentity', run.request->>'batchIdentity',
      'manifestVersion', run.request->>'manifestVersion',
      'inputHash', run.request->>'inputHash',
      'orchestratorVersion', run.request->>'orchestratorVersion',
      'dryRun', (run.request->>'dryRun')::boolean,
      'deterministicOnly', (run.request->>'deterministicOnly')::boolean,
      'maxConcurrency', (run.request->>'maxConcurrency')::integer,
      'stageCounts', run.summary->'stageCounts',
      'eventCounts', run.summary->'eventCounts',
      'readinessCounts', run.summary->'readinessCounts',
      'retryCount', coalesce((run.summary->>'retryCount')::integer, 0),
      'modelUsage', run.summary->'modelUsage',
      'exceptionCount', coalesce((run.summary->>'exceptionCount')::integer, 0),
      'publicationEligibilityCount',
        coalesce((run.summary->>'publicationEligibilityCount')::integer, 0),
      'createdAt', run.created_at,
      'startedAt', run.started_at,
      'updatedAt', run.updated_at,
      'completedAt', run.completed_at
    )
    order by run.created_at desc, run.id desc
  ), '[]'::jsonb)
  into v_result
  from (
    select operation.*
    from public.atlas_operation_runs as operation
    where operation.operation_type = 'michigan_completion_v1'
    order by operation.created_at desc, operation.id desc
    limit pg_catalog.greatest(1, pg_catalog.least(coalesce(p_limit, 50), 200))
  ) as run;

  return v_result;
end;
$$;

revoke all on function public.atlas_guard_michigan_completion_run_history()
  from public, anon, authenticated, service_role;
revoke all on function public.atlas_guard_michigan_completion_action_history()
  from public, anon, authenticated, service_role;
revoke all on function public.atlas_guard_michigan_completion_review_history()
  from public, anon, authenticated, service_role;
revoke all on function public.atlas_guard_review_item_action_history()
  from public, anon, authenticated, service_role;
revoke all on function public.atlas_refresh_michigan_completion_summary(uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.atlas_start_michigan_completion_run(
  text, text, text, text, text, text, text, text,
  boolean, boolean, integer, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.atlas_resume_michigan_completion_run(uuid, text)
  from public, anon, authenticated;
revoke all on function public.atlas_record_michigan_completion_checkpoint(
  uuid, text, text, text, text, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.atlas_record_michigan_completion_exception(
  uuid, text, text, text, text, text, text, text, jsonb, jsonb, text
) from public, anon, authenticated;
revoke all on function public.atlas_transition_michigan_completion_exception(
  uuid, text, text, text, jsonb
) from public, anon, authenticated;
revoke all on function public.atlas_reserve_michigan_completion_model_action(
  uuid, text, text, text, text, text, text, text, jsonb, text, text, text,
  integer, integer, bigint, bigint, bigint, text, boolean
) from public, anon, authenticated;
revoke all on function public.atlas_finish_michigan_completion_model_action(
  uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) from public, anon, authenticated;
revoke all on function public.atlas_finalize_michigan_completion_run(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function public.atlas_get_michigan_completion_run(uuid)
  from public, anon, authenticated;
revoke all on function public.atlas_list_michigan_completion_runs(integer)
  from public, anon, authenticated;

grant execute on function public.atlas_start_michigan_completion_run(
  text, text, text, text, text, text, text, text,
  boolean, boolean, integer, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.atlas_resume_michigan_completion_run(uuid, text)
  to service_role;
grant execute on function public.atlas_record_michigan_completion_checkpoint(
  uuid, text, text, text, text, text, text, text, text,
  jsonb, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.atlas_record_michigan_completion_exception(
  uuid, text, text, text, text, text, text, text, jsonb, jsonb, text
) to service_role;
grant execute on function public.atlas_transition_michigan_completion_exception(
  uuid, text, text, text, jsonb
) to service_role;
grant execute on function public.atlas_reserve_michigan_completion_model_action(
  uuid, text, text, text, text, text, text, text, jsonb, text, text, text,
  integer, integer, bigint, bigint, bigint, text, boolean
) to service_role;
grant execute on function public.atlas_finish_michigan_completion_model_action(
  uuid, uuid, text, text, bigint, bigint, bigint, text, jsonb
) to service_role;
grant execute on function public.atlas_finalize_michigan_completion_run(
  uuid, text, text, jsonb, jsonb, jsonb, jsonb
) to service_role;
grant execute on function public.atlas_get_michigan_completion_run(uuid)
  to service_role;
grant execute on function public.atlas_list_michigan_completion_runs(integer)
  to service_role;

comment on table public.atlas_review_item_actions is
  'Append-only lifecycle audit for Atlas review items, introduced for Michigan completion exceptions.';
comment on function public.atlas_start_michigan_completion_run(
  text, text, text, text, text, text, text, text,
  boolean, boolean, integer, jsonb, jsonb, jsonb
) is
  'Starts or exactly replays one private Michigan completion run without calling publication or materialization RPCs.';
