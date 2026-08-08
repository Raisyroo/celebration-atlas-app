-- Preserve the four-topic Ultra-authored Event Hub while restoring the
-- Detroit Jazz value-density pattern and useful task-specific Plan links.

begin;

create or replace function public.atlas_event_factory_content_ready_v5(
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
  v_plan jsonb;
  v_first_nav jsonb;
  v_second_nav jsonb;
  v_third_nav jsonb;
  v_fourth_nav jsonb;
  v_official_hosts text[] := array[]::text[];
  v_summary_words integer := 0;
  v_presented_count integer := 0;
  v_presented_distinct_count integer := 0;
begin
  if public.atlas_event_factory_content_ready_v2(p_manifest) is not true then
    return false;
  end if;

  v_modules := p_manifest->'modules';
  v_navigation := p_manifest->'navigation';
  select navigation into v_first_nav from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal) where ordinal = 1;
  select navigation into v_second_nav from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal) where ordinal = 2;
  select navigation into v_third_nav from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal) where ordinal = 3;
  select navigation into v_fourth_nav from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal) where ordinal = 4;

  if v_first_nav->>'label' <> 'Why Go'
     or v_second_nav->>'label' <> 'Schedule'
     or v_fourth_nav->>'label' <> 'Plan'
     or not exists (select 1 from jsonb_array_elements(v_modules) as module where module->>'id' = v_first_nav->>'targetModuleId' and module->>'type' = 'whyGo')
     or not exists (select 1 from jsonb_array_elements(v_modules) as module where module->>'id' = v_second_nav->>'targetModuleId' and module->>'type' = 'schedule')
     or not exists (select 1 from jsonb_array_elements(v_modules) as module where module->>'id' = v_third_nav->>'targetModuleId' and module->>'type' in ('highlights', 'traditions'))
     or not exists (select 1 from jsonb_array_elements(v_modules) as module where module->>'id' = v_fourth_nav->>'targetModuleId' and module->>'type' = 'planVisit') then
    return false;
  end if;

  if btrim(coalesce(v_third_nav->>'label', '')) = ''
     or btrim(v_third_nav->>'label') ~* '^(highlights?|traditions?|experience|what to expect|three days|weekend rhythm)$' then
    return false;
  end if;

  select module into v_why_go from jsonb_array_elements(v_modules) as module where module->>'type' = 'whyGo';
  v_summary_words := coalesce(array_length(regexp_split_to_array(btrim(coalesce(v_why_go->>'summary', '')), '\s+'), 1), 0);
  if v_summary_words not between 18 and 60
     or (coalesce(v_why_go->>'headline', '') || ' ' || coalesce(v_why_go->>'summary', '')) ~*
        '(this year|this edition|current edition|has ended|is over|was held|ran from|returned for|concluded|wrapped up)'
     or jsonb_array_length(v_why_go->'metrics') < 2
     or jsonb_array_length(v_why_go->'audienceGroups') < 2
     or jsonb_typeof(v_why_go->'spotlight') is distinct from 'object' then
    return false;
  end if;

  if exists (
    select 1 from jsonb_array_elements(v_why_go->'audienceGroups') as audience_group
    where jsonb_typeof(audience_group->'items') is distinct from 'array'
       or jsonb_array_length(audience_group->'items') < 2
       or exists (
         select 1 from jsonb_array_elements_text(audience_group->'items') as item
         where coalesce(array_length(regexp_split_to_array(btrim(item), '\s+'), 1), 0) < 5
       )
  ) then
    return false;
  end if;

  if coalesce(array_length(regexp_split_to_array(btrim(coalesce(v_why_go#>>'{spotlight,body}', '')), '\s+'), 1), 0) < 18
     or jsonb_typeof(v_why_go#>'{spotlight,sourceIds}') is distinct from 'array'
     or jsonb_array_length(v_why_go#>'{spotlight,sourceIds}') < 1
     or (coalesce(v_why_go#>>'{spotlight,title}', '') || ' ' || coalesce(v_why_go#>>'{spotlight,body}', '')) ~*
        '(arrive early|check the (official )?(site|website|schedule)|plan ahead|before you go|details (can|may) change|something for everyone)' then
    return false;
  end if;

  select module into v_schedule from jsonb_array_elements(v_modules) as module where module->>'type' = 'schedule';
  if v_schedule ? 'presentationGroups' then
    if jsonb_typeof(v_schedule->'presentationGroups') is distinct from 'array'
       or jsonb_array_length(v_schedule->'presentationGroups') < 1
       or exists (
         select 1 from jsonb_array_elements(v_schedule->'presentationGroups') as presentation_group
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
         select 1 from jsonb_array_elements(v_schedule->'presentationGroups') as presentation_group,
              jsonb_array_elements_text(presentation_group->'itemIds') as item_id
         where not exists (select 1 from jsonb_array_elements(p_manifest->'scheduleItems') as schedule_item where schedule_item->>'id' = item_id)
       ) then
      return false;
    end if;
  end if;

  select module into v_plan from jsonb_array_elements(v_modules) as module where module->>'type' = 'planVisit';
  if not exists (
    select 1 from jsonb_array_elements(v_plan->'details') as detail
    where coalesce(detail->>'label', '') !~* '(address|location|venue|where|grounds|map)'
  ) or coalesce(jsonb_typeof(p_manifest->'primaryAction'), 'null') <> 'null' then
    return false;
  end if;

  select coalesce(array_agg(distinct lower(regexp_replace(split_part(regexp_replace(source->>'url', '^https?://', '', 'i'), '/', 1), '^www\.', ''))), array[]::text[])
    into v_official_hosts
  from jsonb_array_elements(p_manifest->'sources') as source
  where source->>'type' in ('officialWebsite', 'officialSocial', 'organizer')
    and coalesce(source->>'url', '') ~* '^https?://';

  if exists (
    select 1
    from jsonb_array_elements(v_modules) as module
    cross join lateral jsonb_array_elements(case when jsonb_typeof(module->'links') = 'array' then module->'links' else '[]'::jsonb end) as link
    cross join lateral (
      select
        lower(regexp_replace(split_part(regexp_replace(link->>'href', '^https?://', '', 'i'), '/', 1), '^www\.', '')) as host,
        regexp_replace(link->>'href', '^https?://[^/]+/?', '', 'i') as path
    ) as target
    where exists (
      select 1 from unnest(v_official_hosts) as official_host
      where target.host = official_host or target.host like '%.' || official_host or official_host like '%.' || target.host
    ) and (
      module->>'type' <> 'planVisit'
      or btrim(target.path, '/') = ''
      or coalesce(link->>'label', '') ~* '(official\s+)?(website|site|homepage|home page|information|info)'
      or coalesce(link->>'label', '') !~* '(schedule|program|faq|frequently asked|register|registration|ticket|livestream|live stream|watch|parking|direction|route|map|road closure|shuttle|accessib|rule|vendor|application)'
    )
  ) then
    return false;
  end if;

  if jsonb_typeof(p_manifest->'scoutSuggestions') = 'array' and exists (
    select 1
    from jsonb_array_elements(p_manifest->'scoutSuggestions') as suggestion
    cross join lateral (select lower(regexp_replace(split_part(regexp_replace(suggestion#>>'{command,href}', '^https?://', '', 'i'), '/', 1), '^www\.', '')) as host) as target
    where suggestion#>>'{command,type}' = 'openExternal'
      and exists (
        select 1 from unnest(v_official_hosts) as official_host
        where target.host = official_host or target.host like '%.' || official_host or official_host like '%.' || target.host
      )
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
     or (tg_op = 'UPDATE' and old.status in ('published', 'archived')) then
    return new;
  end if;
  if new.status in ('assembling', 'ready_for_review', 'approved', 'publishing', 'published')
     and public.atlas_event_factory_content_ready_v5(new.page_manifest) is not true then
    raise exception
      'New Event Factory packages require four substantive topics, a Detroit Jazz-density Why Go, and only useful task links in Plan.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.atlas_event_factory_content_ready_v5(jsonb) from public, anon, authenticated;
revoke all on function public.atlas_guard_new_event_factory_content() from public, anon, authenticated;
grant execute on function public.atlas_event_factory_content_ready_v5(jsonb) to service_role;

comment on function public.atlas_event_factory_content_ready_v5(jsonb) is
  'Validates four-topic Event Hubs with a Detroit Jazz-density Why Go and task-specific Plan deep links.';
comment on function public.atlas_guard_new_event_factory_content() is
  'Blocks new root Event Factory packages whose visitor content or link placement is incomplete.';

commit;
