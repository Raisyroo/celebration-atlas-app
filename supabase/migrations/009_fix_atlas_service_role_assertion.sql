-- Keep migration 004 control-plane RPCs compatible with current PostgREST JWT claims.

create or replace function public.atlas_assert_service_role()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_legacy_role text := coalesce(current_setting('request.jwt.claim.role', true), '');
  v_claims_text text := coalesce(current_setting('request.jwt.claims', true), '');
  v_claims_role text := '';
begin
  if v_claims_text <> '' then
    begin
      v_claims_role := coalesce((v_claims_text::jsonb)->>'role', '');
    exception when others then
      v_claims_role := '';
    end;
  end if;

  if session_user in ('postgres', 'service_role')
     or v_legacy_role = 'service_role'
     or v_claims_role = 'service_role' then
    return;
  end if;

  raise exception 'Atlas Control Plane mutations require server-side service role access'
    using errcode = '42501';
end;
$$;

revoke execute on function public.atlas_assert_service_role() from public, anon, authenticated;
