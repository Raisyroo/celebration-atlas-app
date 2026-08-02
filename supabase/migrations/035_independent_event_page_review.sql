-- Allow Event Hub content/layout review to finish while hero review remains
-- pending. The package publication lifecycle and visual workflow lifecycle stay
-- independent, and neither decision publishes or materializes an event.

begin;

alter table public.event_factory_packages
  add column if not exists page_review_status text not null default 'pending'
    check (page_review_status in ('pending', 'approved', 'rejected')),
  add column if not exists page_review_manifest jsonb
    check (page_review_manifest is null or jsonb_typeof(page_review_manifest) = 'object'),
  add column if not exists page_reviewed_by text,
  add column if not exists page_review_notes text,
  add column if not exists page_reviewed_at timestamptz;

alter table public.event_factory_package_actions
  drop constraint if exists event_factory_package_actions_action_type_check;

alter table public.event_factory_package_actions
  add constraint event_factory_package_actions_action_type_check check (
    action_type in (
      'created', 'rebuilt', 'submitted', 'approved', 'rejected', 'reopened',
      'materialized', 'publication_failed', 'published', 'archived',
      'page_approved', 'page_rejected', 'page_reopened'
    )
  );

create or replace function public.atlas_event_factory_page_review_manifest(
  p_manifest jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_manifest, '{}'::jsonb)
    #- '{hero,imageSrc}'
    #- '{hero,imageAlt}'
    #- '{hero,credit}';
$$;

create or replace function public.atlas_preserve_event_factory_page_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if public.atlas_event_factory_page_review_manifest(old.page_manifest)
     is distinct from public.atlas_event_factory_page_review_manifest(new.page_manifest) then
    new.page_review_status := 'pending';
    new.page_review_manifest := null;
    new.page_reviewed_by := null;
    new.page_review_notes := null;
    new.page_reviewed_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists event_factory_preserve_page_review
  on public.event_factory_packages;

create trigger event_factory_preserve_page_review
before update of page_manifest on public.event_factory_packages
for each row
execute function public.atlas_preserve_event_factory_page_review();

create or replace function public.atlas_review_event_factory_page(
  p_package_id uuid,
  p_decision text,
  p_actor_identity text,
  p_notes text
)
returns table (
  package_id uuid,
  page_review_status text,
  package_status text,
  event_key text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.event_factory_packages%rowtype;
  v_from_status text;
  v_to_status text;
  v_action text;
  v_review_manifest jsonb;
begin
  perform public.atlas_assert_service_role();
  if p_decision not in ('approve', 'reject', 'reopen') then
    raise exception 'Unsupported Event Hub page review decision.' using errcode = '22023';
  end if;
  if nullif(pg_catalog.btrim(p_actor_identity), '') is null then
    raise exception 'Actor identity is required.' using errcode = '22023';
  end if;

  select package.* into v_package
  from public.event_factory_packages as package
  where package.id = p_package_id
  for update;
  if not found then
    raise exception 'Event package was not found.' using errcode = 'P0002';
  end if;
  if v_package.status <> 'ready_for_review' then
    raise exception 'Only a review-ready private package can receive a page decision.'
      using errcode = '22023';
  end if;
  if (
    v_package.readiness_checks->>'exists' = 'true'
    and v_package.readiness_checks->>'annual' = 'true'
    and v_package.readiness_checks->>'dates' = 'true'
    and v_package.readiness_checks->>'location' = 'true'
    and v_package.readiness_checks->>'sources' = 'true'
    and v_package.readiness_checks->>'map' = 'true'
    and v_package.readiness_checks->>'page' = 'true'
  ) is not true then
    raise exception 'Every non-art package requirement must pass before page review.'
      using errcode = '22023';
  end if;

  v_from_status := v_package.page_review_status;
  v_review_manifest := public.atlas_event_factory_page_review_manifest(v_package.page_manifest);

  if p_decision = 'approve' then
    if v_package.page_review_status <> 'pending' then
      raise exception 'Only a pending Event Hub page can be approved.' using errcode = '22023';
    end if;
    v_to_status := 'approved';
    v_action := 'page_approved';
  elsif p_decision = 'reject' then
    if v_package.page_review_status <> 'pending' then
      raise exception 'Only a pending Event Hub page can be rejected.' using errcode = '22023';
    end if;
    v_to_status := 'rejected';
    v_action := 'page_rejected';
  else
    if v_package.page_review_status not in ('approved', 'rejected') then
      raise exception 'Only an approved or rejected Event Hub page can be reopened.'
        using errcode = '22023';
    end if;
    v_to_status := 'pending';
    v_action := 'page_reopened';
  end if;

  update public.event_factory_packages
    set page_review_status = v_to_status,
        page_review_manifest = case when p_decision = 'reopen' then null else v_review_manifest end,
        page_reviewed_by = case when p_decision = 'reopen' then null else pg_catalog.btrim(p_actor_identity) end,
        page_review_notes = nullif(pg_catalog.btrim(p_notes), ''),
        page_reviewed_at = case when p_decision = 'reopen' then null else now() end,
        updated_at = now()
  where id = p_package_id;

  insert into public.event_factory_package_actions (
    package_id, action_type, actor_identity, from_status, to_status, notes, metadata
  ) values (
    p_package_id,
    v_action,
    pg_catalog.btrim(p_actor_identity),
    v_package.status,
    v_package.status,
    nullif(pg_catalog.btrim(p_notes), ''),
    jsonb_build_object(
      'review_dimension', 'event_page_content_and_layout',
      'from_page_review_status', v_from_status,
      'to_page_review_status', v_to_status,
      'hero_fields_excluded', true,
      'publication_authorized', false,
      'review_manifest', case when p_decision = 'reopen' then null else v_review_manifest end
    )
  );

  return query
    select p_package_id, v_to_status, v_package.status, v_package.event_key;
end;
$$;

revoke all on function public.atlas_event_factory_page_review_manifest(jsonb)
  from public, anon, authenticated;
revoke all on function public.atlas_preserve_event_factory_page_review()
  from public, anon, authenticated;
revoke all on function public.atlas_review_event_factory_page(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.atlas_review_event_factory_page(uuid, text, text, text)
  to service_role;

comment on function public.atlas_review_event_factory_page(uuid, text, text, text) is
  'Records an independent human Event Hub content/layout decision. It cannot approve hero art, approve a package, materialize an event, or publish.';

commit;
