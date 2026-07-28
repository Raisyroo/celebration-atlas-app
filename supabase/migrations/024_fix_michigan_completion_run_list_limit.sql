-- Correct the hosted-Postgres limit expression in the private Michigan
-- completion run projection. PostgreSQL implements LEAST/GREATEST as special
-- expression syntax, so schema-qualifying them as pg_catalog functions fails.
-- This forward-only correction changes no run, event, package, or publication
-- data and preserves the migration-023 service-role boundary.

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
  v_limit integer;
begin
  perform public.atlas_assert_service_role();

  v_limit := case
    when coalesce(p_limit, 50) < 1 then 1
    when coalesce(p_limit, 50) > 200 then 200
    else coalesce(p_limit, 50)
  end;

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
    limit v_limit
  ) as run;

  return v_result;
end;
$$;

revoke all on function public.atlas_list_michigan_completion_runs(integer)
  from public, anon, authenticated;
grant execute on function public.atlas_list_michigan_completion_runs(integer)
  to service_role;

comment on function public.atlas_list_michigan_completion_runs(integer) is
  'Returns a bounded private projection of Michigan completion runs for trusted Atlas Control callers.';
