-- Return one lightweight, publication-gated discovery document per state query.
-- Apply after migration 021.

create or replace function public.atlas_get_published_event_discovery(
  p_state_values text[]
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
begin
  perform public.atlas_assert_service_role();

  if p_state_values is null
     or pg_catalog.cardinality(p_state_values) = 0 then
    return pg_catalog.jsonb_build_object(
      'schemaVersion', 1,
      'items', '[]'::jsonb
    );
  end if;

  select pg_catalog.jsonb_build_object(
    'schemaVersion', 1,
    'items',
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(discovery)
        order by discovery.event_name, discovery.canonical_event_id
      ),
      '[]'::jsonb
    )
  )
  into v_payload
  from (
    select
      event.id as canonical_event_id,
      event.slug,
      event.name as event_name,
      nullif(publication.page_manifest #>> '{identity,name}', '') as manifest_name,
      nullif(publication.page_manifest #>> '{identity,shortName}', '') as manifest_short_name,
      nullif(publication.page_manifest #>> '{identity,location}', '') as manifest_location,
      event.city,
      event.state,
      event.event_type,
      event.category,
      event.subcategory,
      event.short_description,
      case
        when event.official_website ~ '^https://'
          then event.official_website
        else null
      end as official_url,
      event.latitude,
      event.longitude,
      event.location_source,
      event.status as lifecycle_state,
      event.verification_status as verification_state,
      publication.page_manifest #>> '{identity,startsOn}' as starts_on,
      nullif(publication.page_manifest #>> '{identity,endsOn}', '') as ends_on,
      nullif(publication.page_manifest #>> '{identity,timezone}', '') as time_zone,
      publication.package_id,
      publication.package_version,
      publication.target_year,
      publication.package_status,
      publication.package_published_at,
      publication.event_page_version_id,
      publication.event_page_version_number,
      publication.event_page_version_status,
      publication.event_page_published_at,
      coalesce(
        nullif(publication.art_asset->>'publicUrl', ''),
        nullif(publication.art_asset->>'src', ''),
        nullif(publication.page_manifest #>> '{hero,imageSrc}', '')
      ) as thumbnail_url,
      coalesce(
        nullif(publication.art_asset->>'alt', ''),
        nullif(publication.page_manifest #>> '{hero,imageAlt}', '')
      ) as thumbnail_alt
    from public.events as event
    join lateral (
      select
        package.id as package_id,
        package.package_version,
        package.target_year,
        package.status as package_status,
        package.published_at as package_published_at,
        package.page_manifest,
        package.art_asset,
        version.id as event_page_version_id,
        version.version_number as event_page_version_number,
        version.status as event_page_version_status,
        version.published_at as event_page_published_at
      from public.event_factory_packages as package
      join public.event_pages as page
        on page.event_id = package.event_id
       and page.event_key = package.event_key
       and page.slug = package.slug
      join public.event_page_versions as version
        on version.id = page.published_version_id
       and version.event_page_id = page.id
       and version.status = 'published'
       and version.is_valid = true
       and version.manifest = package.page_manifest
      where package.event_id = event.id
        and package.status = 'published'
        and package.event_key = event.slug
        and package.slug = event.slug
        and package.page_manifest->>'eventId' = event.slug
        and package.page_manifest->>'slug' = event.slug
        and nullif(package.page_manifest #>> '{identity,startsOn}', '') is not null
      order by
        package.target_year desc,
        package.published_at desc nulls last,
        package.id desc
      limit 1
    ) as publication on true
    where event.state = any (p_state_values)
      and event.status = 'active'
      and event.verification_status = 'verified'
      and event.location_verified = true
      and event.latitude is not null
      and event.longitude is not null
  ) as discovery;

  return v_payload;
end;
$$;

revoke all on function public.atlas_get_published_event_discovery(text[])
  from public, anon, authenticated;
grant execute on function public.atlas_get_published_event_discovery(text[])
  to service_role;

comment on function public.atlas_get_published_event_discovery(text[]) is
  'Returns one lightweight state-scoped discovery document for active verified events whose exact Event Factory package and Event Hub version are both published.';
