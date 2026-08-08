-- Keep Ultra in charge of event-specific content while enforcing the durable,
-- concise Event Hub navigation and footer-only official-link contract.

begin;

create or replace function public.atlas_event_factory_content_ready_v4(
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
  v_plan jsonb;
  v_first_nav jsonb;
  v_second_nav jsonb;
  v_third_nav jsonb;
  v_fourth_nav jsonb;
  v_official_hosts text[] := array[]::text[];
  v_summary_words integer := 0;
begin
  if jsonb_typeof(p_manifest) is distinct from 'object'
     or jsonb_typeof(p_manifest->'modules') is distinct from 'array'
     or jsonb_typeof(p_manifest->'navigation') is distinct from 'array' then
    return false;
  end if;

  v_modules := p_manifest->'modules';
  v_navigation := p_manifest->'navigation';
  if jsonb_array_length(v_modules) <> 4
     or jsonb_array_length(v_navigation) <> 4
     or public.atlas_event_factory_content_ready_v3(p_manifest) is not true then
    return false;
  end if;

  select navigation into v_first_nav
  from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal)
  where ordinal = 1;
  select navigation into v_second_nav
  from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal)
  where ordinal = 2;
  select navigation into v_third_nav
  from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal)
  where ordinal = 3;
  select navigation into v_fourth_nav
  from jsonb_array_elements(v_navigation) with ordinality as entry(navigation, ordinal)
  where ordinal = 4;

  if v_first_nav->>'label' <> 'Why Go'
     or v_second_nav->>'label' <> 'Schedule'
     or v_fourth_nav->>'label' <> 'Plan'
     or not exists (
       select 1 from jsonb_array_elements(v_modules) as module
       where module->>'id' = v_first_nav->>'targetModuleId' and module->>'type' = 'whyGo'
     )
     or not exists (
       select 1 from jsonb_array_elements(v_modules) as module
       where module->>'id' = v_second_nav->>'targetModuleId' and module->>'type' = 'schedule'
     )
     or not exists (
       select 1 from jsonb_array_elements(v_modules) as module
       where module->>'id' = v_third_nav->>'targetModuleId' and module->>'type' in ('highlights', 'traditions')
     )
     or not exists (
       select 1 from jsonb_array_elements(v_modules) as module
       where module->>'id' = v_fourth_nav->>'targetModuleId' and module->>'type' = 'planVisit'
     ) then
    return false;
  end if;

  if btrim(coalesce(v_third_nav->>'label', '')) = ''
     or btrim(v_third_nav->>'label') ~* '^(highlights?|traditions?|experience|what to expect|three days|weekend rhythm)$' then
    return false;
  end if;

  select module into v_why_go
  from jsonb_array_elements(v_modules) as module
  where module->>'type' = 'whyGo';
  v_summary_words := coalesce(
    array_length(regexp_split_to_array(btrim(coalesce(v_why_go->>'summary', '')), '\s+'), 1),
    0
  );
  if v_summary_words not between 30 and 45
     or (coalesce(v_why_go->>'headline', '') || ' ' || coalesce(v_why_go->>'summary', '')) ~*
        '(this year|this edition|current edition|has ended|is over|was held|ran from|returned for|concluded|wrapped up)' then
    return false;
  end if;

  select module into v_plan
  from jsonb_array_elements(v_modules) as module
  where module->>'type' = 'planVisit';
  if not exists (
    select 1
    from jsonb_array_elements(v_plan->'details') as detail
    where coalesce(detail->>'label', '') !~* '(address|location|venue|where|grounds|map)'
  ) then
    return false;
  end if;

  if coalesce(jsonb_typeof(p_manifest->'primaryAction'), 'null') <> 'null' then
    return false;
  end if;

  select coalesce(array_agg(distinct lower(regexp_replace(
    split_part(regexp_replace(source->>'url', '^https?://', '', 'i'), '/', 1),
    '^www\.',
    ''
  ))), array[]::text[])
    into v_official_hosts
  from jsonb_array_elements(p_manifest->'sources') as source
  where source->>'type' in ('officialWebsite', 'officialSocial', 'organizer')
    and coalesce(source->>'url', '') ~* '^https?://';

  if exists (
    select 1
    from jsonb_array_elements(v_modules) as module
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(module->'links') = 'array' then module->'links' else '[]'::jsonb end
    ) as link
    cross join lateral (
      select lower(regexp_replace(
        split_part(regexp_replace(link->>'href', '^https?://', '', 'i'), '/', 1),
        '^www\.',
        ''
      )) as host
    ) as target
    where exists (
      select 1 from unnest(v_official_hosts) as official_host
      where target.host = official_host
         or target.host like '%.' || official_host
         or official_host like '%.' || target.host
    )
  ) then
    return false;
  end if;

  if jsonb_typeof(p_manifest->'scoutSuggestions') = 'array' and exists (
    select 1
    from jsonb_array_elements(p_manifest->'scoutSuggestions') as suggestion
    cross join lateral (
      select lower(regexp_replace(
        split_part(regexp_replace(suggestion#>>'{command,href}', '^https?://', '', 'i'), '/', 1),
        '^www\.',
        ''
      )) as host
    ) as target
    where suggestion#>>'{command,type}' = 'openExternal'
      and exists (
        select 1 from unnest(v_official_hosts) as official_host
        where target.host = official_host
           or target.host like '%.' || official_host
           or official_host like '%.' || target.host
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
     or (
       tg_op = 'UPDATE'
       and old.status in ('published', 'archived')
     ) then
    return new;
  end if;
  if new.status in ('assembling', 'ready_for_review', 'approved', 'publishing', 'published')
     and public.atlas_event_factory_content_ready_v4(new.page_manifest) is not true then
    raise exception
      'New Event Factory packages require exactly four concise topics; official-site links may appear only in the source footer.'
      using errcode = '22023';
  end if;
  return new;
end;
$$;

revoke all on function public.atlas_event_factory_content_ready_v4(jsonb)
  from public, anon, authenticated;
revoke all on function public.atlas_guard_new_event_factory_content()
  from public, anon, authenticated;
grant execute on function public.atlas_event_factory_content_ready_v4(jsonb)
  to service_role;

comment on function public.atlas_event_factory_content_ready_v4(jsonb) is
  'Validates the concise four-topic Event Hub, evergreen Why Go, useful Plan, and footer-only official-link contract.';
comment on function public.atlas_guard_new_event_factory_content() is
  'Blocks new root Event Factory packages from private review and publication states when the concise Event Hub contract is incomplete.';

commit;
