-- Let evidence-bound Ultra authorship choose the Event Hub's useful topic
-- count and schedule organization while preserving the existing fact and
-- publication gates.

begin;

create or replace function public.atlas_event_factory_content_ready_v3(
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
  v_core_manifest jsonb;
  v_core_module_ids text[];
  v_presented_count integer := 0;
  v_presented_distinct_count integer := 0;
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
  if jsonb_array_length(v_modules) not between 4 and 6
     or jsonb_array_length(v_navigation) <> jsonb_array_length(v_modules)
     or jsonb_array_length(p_manifest->'sources') < 1 then
    return false;
  end if;

  if (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' = 'whyGo') <> 1
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' = 'schedule') <> 1
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' = 'planVisit') <> 1
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' in ('highlights', 'traditions')) not between 1 and 3
     or (select count(*) from jsonb_array_elements(v_modules) as module where module->>'type' in ('whyGo', 'schedule', 'planVisit', 'highlights', 'traditions')) <> jsonb_array_length(v_modules) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_modules) as module
    where (
      select count(*)
      from jsonb_array_elements(v_navigation) as navigation
      where navigation->>'targetModuleId' = module->>'id'
    ) <> 1
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
  where module->>'type' in ('highlights', 'traditions')
  limit 1;
  select module into v_plan
  from jsonb_array_elements(v_modules) as module
  where module->>'type' = 'planVisit';

  v_core_module_ids := array[
    v_why_go->>'id',
    v_schedule->>'id',
    v_experience->>'id',
    v_plan->>'id'
  ];
  v_core_manifest := jsonb_set(
    jsonb_set(
      p_manifest,
      '{modules}',
      jsonb_build_array(v_why_go, v_schedule, v_experience, v_plan)
    ),
    '{navigation}',
    coalesce((
      select jsonb_agg(navigation)
      from jsonb_array_elements(v_navigation) as navigation
      where navigation->>'targetModuleId' = any(v_core_module_ids)
    ), '[]'::jsonb)
  );

  if public.atlas_event_factory_content_ready_v2(v_core_manifest) is not true then
    return false;
  end if;

  if coalesce(array_length(regexp_split_to_array(btrim(coalesce(v_why_go->>'summary', '')), '\s+'), 1), 0) < 30
     or (
       jsonb_array_length(v_why_go->'metrics')
       + jsonb_array_length(v_why_go->'audienceGroups')
       + case when jsonb_typeof(v_why_go->'spotlight') = 'object' then 1 else 0 end
     ) < 2 then
    return false;
  end if;
  if jsonb_typeof(v_why_go->'spotlight') = 'object'
     and (
       coalesce(array_length(regexp_split_to_array(btrim(coalesce(v_why_go#>>'{spotlight,body}', '')), '\s+'), 1), 0) < 18
       or (coalesce(v_why_go#>>'{spotlight,title}', '') || ' ' || coalesce(v_why_go#>>'{spotlight,body}', '')) ~*
          '(arrive early|check the (official )?(site|website|schedule)|plan ahead|before you go|details (can|may) change|something for everyone)'
     ) then
    return false;
  end if;

  if exists (
    select 1
    from jsonb_array_elements(v_modules) as experience
    where experience->>'type' in ('highlights', 'traditions')
      and (
        jsonb_typeof(experience->'items') is distinct from 'array'
        or (experience->>'type' = 'highlights' and jsonb_array_length(experience->'items') < 3)
        or (experience->>'type' = 'traditions' and jsonb_array_length(experience->'items') < 2)
        or exists (
          select 1
          from jsonb_array_elements(experience->'items') as item
          where jsonb_typeof(item->'sourceIds') is distinct from 'array'
             or jsonb_array_length(item->'sourceIds') < 1
        )
      )
  ) then
    return false;
  end if;

  if v_schedule ? 'presentationGroups' then
    if jsonb_typeof(v_schedule->'presentationGroups') is distinct from 'array'
       or jsonb_array_length(v_schedule->'presentationGroups') < 1
       or exists (
         select 1
         from jsonb_array_elements(v_schedule->'presentationGroups') as presentation_group
         where jsonb_typeof(presentation_group->'itemIds') is distinct from 'array'
            or jsonb_array_length(presentation_group->'itemIds') < 1
            or jsonb_typeof(presentation_group->'sourceIds') is distinct from 'array'
            or jsonb_array_length(presentation_group->'sourceIds') < 1
       ) then
      return false;
    end if;

    select count(*), count(distinct item_id)
      into v_presented_count, v_presented_distinct_count
    from jsonb_array_elements(v_schedule->'presentationGroups') as presentation_group,
         jsonb_array_elements_text(presentation_group->'itemIds') as item_id;

    if v_presented_count <> jsonb_array_length(p_manifest->'scheduleItems')
       or v_presented_distinct_count <> v_presented_count
       or exists (
         select 1
         from jsonb_array_elements(v_schedule->'presentationGroups') as presentation_group,
              jsonb_array_elements_text(presentation_group->'itemIds') as item_id
         where not exists (
           select 1
           from jsonb_array_elements(p_manifest->'scheduleItems') as schedule_item
           where schedule_item->>'id' = item_id
         )
       ) then
      return false;
    end if;
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
     and public.atlas_event_factory_content_ready_v3(new.page_manifest) is not true then
    raise exception
      'New Event Factory packages require four to six substantive, source-backed Event Hub topics before private review.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.atlas_event_factory_content_ready_v3(jsonb)
  from public, anon, authenticated;
revoke all on function public.atlas_guard_new_event_factory_content()
  from public, anon, authenticated;
grant execute on function public.atlas_event_factory_content_ready_v3(jsonb)
  to service_role;

comment on function public.atlas_event_factory_content_ready_v3(jsonb) is
  'Validates the Ultra-first four-to-six-topic Event Hub content contract while retaining the v2 fact and provenance gates.';
comment on function public.atlas_guard_new_event_factory_content() is
  'Blocks new root Event Factory packages from private review and publication states when the Ultra-first content contract is incomplete.';

commit;
