-- Prevent a structurally valid but editorially empty Event Hub shell from
-- entering the private review/publishing lifecycle. Existing published
-- packages and their immutable correction revisions remain compatibility
-- fixtures.

begin;

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
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
     or jsonb_typeof(p_manifest->'modules') is distinct from 'array'
     or jsonb_typeof(p_manifest->'navigation') is distinct from 'array'
     or jsonb_typeof(p_manifest->'scheduleItems') is distinct from 'array'
     or jsonb_typeof(p_manifest->'sources') is distinct from 'array' then
    return false;
  end if;

  v_modules := p_manifest->'modules';
  v_navigation := p_manifest->'navigation';
  if jsonb_array_length(v_modules) <> 4
     or jsonb_array_length(v_navigation) <> 4
     or jsonb_array_length(p_manifest->'sources') < 1 then
    return false;
  end if;

  if (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' = 'whyGo') <> 1
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' = 'schedule') <> 1
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' = 'planVisit') <> 1
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' in ('highlights', 'traditions')) <> 1 then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_modules) as module
    where not exists (
      select 1
      from jsonb_array_elements(v_navigation) as navigation
      where navigation->>'targetModuleId' = module->>'id'
    )
  ) then
    return false;
  end if;

  select module into v_why_go
  from jsonb_array_elements(v_modules) as module
  where module->>'type' = 'whyGo';
  select module into v_schedule
  from jsonb_array_elements(v_modules) as module
  where module->>'type' = 'schedule';
  select module into v_experience
  from jsonb_array_elements(v_modules) as module
  where module->>'type' in ('highlights', 'traditions');
  select module into v_plan
  from jsonb_array_elements(v_modules) as module
  where module->>'type' = 'planVisit';

  v_name := btrim(lower(regexp_replace(coalesce(p_manifest#>>'{identity,name}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_short_name := btrim(lower(regexp_replace(coalesce(p_manifest#>>'{identity,shortName}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_location := btrim(lower(regexp_replace(coalesce(p_manifest#>>'{identity,location}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_date_text := btrim(lower(regexp_replace(coalesce(p_manifest#>>'{identity,dateText}', ''), '[^a-z0-9]+', ' ', 'gi')));
  v_tagline := btrim(coalesce(p_manifest#>>'{hero,tagline}', ''));
  v_summary := btrim(coalesce(v_why_go->>'summary', ''));

  if coalesce(array_length(regexp_split_to_array(v_tagline, '\s+'), 1), 0) < 8
     or btrim(lower(regexp_replace(v_tagline, '[^a-z0-9]+', ' ', 'gi'))) in (v_name, v_short_name, v_location, v_date_text)
     or v_tagline ~* '(start with the moments that define|start with the essentials|plan your visit to|daily details are still being confirmed|location details need review)' then
    return false;
  end if;

  if coalesce(array_length(regexp_split_to_array(v_summary, '\s+'), 1), 0) < 10
     or btrim(lower(regexp_replace(v_summary, '[^a-z0-9]+', ' ', 'gi'))) in (v_name, v_short_name, v_location, v_date_text)
     or (coalesce(v_why_go->>'headline', '') || ' ' || v_summary) ~*
        '(start with the moments that define|start with the essentials|plan your visit to|daily details are still being confirmed|location details need review)' then
    return false;
  end if;

  if jsonb_typeof(v_why_go->'metrics') is distinct from 'array'
     or jsonb_typeof(v_why_go->'audienceGroups') is distinct from 'array'
     or (
       jsonb_array_length(v_why_go->'metrics')
       + jsonb_array_length(v_why_go->'audienceGroups')
       + case when jsonb_typeof(v_why_go->'spotlight') = 'object' then 1 else 0 end
     ) < 1 then
    return false;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(
      (v_why_go->'metrics') || (v_why_go->'audienceGroups')
        || case
             when jsonb_typeof(v_why_go->'spotlight') = 'object'
               then jsonb_build_array(v_why_go->'spotlight')
             else '[]'::jsonb
           end
    ) as item
    where jsonb_typeof(item->'sourceIds') is distinct from 'array'
       or jsonb_array_length(item->'sourceIds') < 1
  ) then
    return false;
  end if;

  if jsonb_typeof(v_experience->'items') is distinct from 'array'
     or (
       v_experience->>'type' = 'highlights'
       and jsonb_array_length(v_experience->'items') < 3
     )
     or (
       v_experience->>'type' = 'traditions'
       and jsonb_array_length(v_experience->'items') < 2
     )
     or exists (
       select 1
       from jsonb_array_elements(v_experience->'items') as item
       where jsonb_typeof(item->'sourceIds') is distinct from 'array'
          or jsonb_array_length(item->'sourceIds') < 1
     ) then
    return false;
  end if;

  v_current_schedule_count := jsonb_array_length(p_manifest->'scheduleItems');
  if jsonb_typeof(v_schedule#>'{recurringEvents,items}') = 'array' then
    v_recurring_schedule_count := jsonb_array_length(v_schedule#>'{recurringEvents,items}');
  end if;
  if jsonb_typeof(v_schedule#>'{referenceSchedule,groups}') = 'array' then
    select coalesce(sum(jsonb_array_length(group_row->'items')), 0)::integer
      into v_reference_schedule_count
    from jsonb_array_elements(v_schedule#>'{referenceSchedule,groups}') as group_row
    where jsonb_typeof(group_row->'items') = 'array';
  end if;
  if v_current_schedule_count + v_recurring_schedule_count + v_reference_schedule_count < 1 then
    return false;
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_manifest->'scheduleItems') as item
    where jsonb_typeof(item->'sourceIds') is distinct from 'array'
       or jsonb_array_length(item->'sourceIds') < 1
  ) then
    return false;
  end if;

  if jsonb_typeof(v_plan->'details') is distinct from 'array'
     or jsonb_array_length(v_plan->'details') < 2
     or exists (
       select 1
       from jsonb_array_elements(v_plan->'details') as detail
       where jsonb_typeof(detail->'sourceIds') is distinct from 'array'
          or jsonb_array_length(detail->'sourceIds') < 1
     ) then
    return false;
  end if;

  return true;
exception when others then
  return false;
end;
$$;

create or replace function public.atlas_guard_new_event_factory_content()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.atlas_assert_service_role();

  if new.supersedes_package_id is not null
     or new.status in ('rejected', 'failed')
     or (
       tg_op = 'UPDATE'
       and old.status in ('published', 'archived')
     ) then
    return new;
  end if;
  if new.status in ('assembling', 'ready_for_review', 'approved', 'publishing', 'published')
     and public.atlas_event_factory_content_ready_v2(new.page_manifest) is not true then
    raise exception
      'New Event Factory packages require four substantive, source-backed Event Hub topics before private review.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists atlas_guard_new_event_factory_content_trigger
  on public.event_factory_packages;
create trigger atlas_guard_new_event_factory_content_trigger
before insert or update of status, page_manifest, readiness_checks
on public.event_factory_packages
for each row
execute function public.atlas_guard_new_event_factory_content();

revoke all on function public.atlas_event_factory_content_ready_v2(jsonb)
  from public, anon, authenticated;
revoke all on function public.atlas_guard_new_event_factory_content()
  from public, anon, authenticated;
grant execute on function public.atlas_event_factory_content_ready_v2(jsonb)
  to service_role;

comment on function public.atlas_event_factory_content_ready_v2(jsonb) is
  'Validates the v2 four-topic content contract for new Event Factory packages without changing legacy published fixtures.';
comment on function public.atlas_guard_new_event_factory_content() is
  'Blocks new root Event Factory packages from private review and publication states when the v2 content contract is incomplete.';

commit;
