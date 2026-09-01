-- The `clients_internal_all` policy (secure_dashboard_rls.sql) intentionally
-- grants every internal team member (not just admins) full read/write on the
-- `clients` table, so any internal member can edit a client's name, company,
-- managers, etc. But `clients.user_id` is special: it's what determines which
-- login owns that client's portal access — reassigning it is meant to be an
-- admin-only action (see the comments already in ClientSettingsPage.tsx's
-- handleLinkTeamMember/handleUnlinkPortalUser), and today nothing server-side
-- actually enforces that. Any internal `member`-role account can call
-- `supabase.from('clients').update({ user_id: ... })` directly (bypassing the
-- UI's isAdmin check entirely, e.g. via devtools or a direct API call) to
-- hijack or sever a client's portal linkage.
--
-- RLS policies can't restrict individual columns, so this closes the gap with
-- a trigger: any UPDATE that changes `user_id` is rejected unless the acting
-- user is an admin. Every other column stays writable by any internal member,
-- unchanged.

create or replace function myntmore.enforce_admin_only_client_user_id()
returns trigger
language plpgsql
security definer
set search_path = myntmore, pg_temp
as $$
begin
  -- The create-portal-user Edge Function legitimately sets this column using
  -- the service-role key (not a user JWT) when provisioning/linking a portal
  -- account — auth.uid() is null in that context, so it must be exempted
  -- explicitly rather than relying on has_role(null, ...) to fail safe here.
  if auth.role() = 'service_role' then
    return new;
  end if;
  if new.user_id is distinct from old.user_id
     and not myntmore.has_role(auth.uid(), 'admin'::myntmore.app_role) then
    raise exception 'Only admins can change which account owns a client''s portal access.';
  end if;
  return new;
end;
$$;

drop trigger if exists clients_user_id_admin_only on myntmore.clients;
create trigger clients_user_id_admin_only
  before update on myntmore.clients
  for each row execute function myntmore.enforce_admin_only_client_user_id();
