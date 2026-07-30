-- Run once in the Supabase SQL editor.
-- Separates internal team members from client portal accounts.
-- Both use the "member" enum, so the profile department/client link is used
-- to determine whether the authenticated user belongs to the internal team.

create or replace function public.is_internal_user()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    left join public.profiles p on p.id = ur.user_id
    where ur.user_id = auth.uid()
      and coalesce(p.disabled, false) = false
      and (
        ur.role = 'admin'
        or (
          ur.role = 'member'
          and coalesce(p.department, '') <> 'client'
          and not exists (
            select 1 from public.clients c where c.user_id = ur.user_id
          )
        )
      )
  )
$$;

grant execute on function public.is_internal_user() to authenticated;

-- Operational tables: internal members can use the dashboard and enter data.
-- Existing admin and client-portal policies remain in place.
do $$
declare
  t text;
begin
  foreach t in array array[
    'clients', 'weekly_data', 'campaigns', 'campaign_weekly_data',
    'high_scores', 'targets', 'actionables', 'mm_weekly_data',
    'sales_weekly_data', 'tj_weekly_data', 'finance_data', 'expenses',
    'growth_initiatives', 'growth_initiative_comments', 'myntmore_processes',
    'process_weekly_updates', 'client_context_notes', 'client_alerts',
    'client_notifications', 'client_health_scores', 'hot_leads', 'initiatives'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "internal_team_access" on public.%I', t);
    execute format(
      'create policy "internal_team_access" on public.%I for all using (public.is_internal_user()) with check (public.is_internal_user())',
      t
    );
  end loop;
end $$;

-- Assignment/configuration data is visible to members, but remains writable
-- only by admins through the existing admin_full_access policies.
do $$
declare
  t text;
begin
  foreach t in array array[
    'client_assignments', 'client_settings', 'tj_channel_assignments'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "internal_team_read" on public.%I', t);
    execute format(
      'create policy "internal_team_read" on public.%I for select using (public.is_internal_user())',
      t
    );
  end loop;
end $$;

-- Members need colleague names for assignments, comments, and ownership labels.
drop policy if exists "internal_team_read_profiles" on public.profiles;
create policy "internal_team_read_profiles" on public.profiles
  for select using (public.is_internal_user());

-- A user must be able to resolve their own role during app startup.
drop policy if exists "self_read_role" on public.user_roles;
create policy "self_read_role" on public.user_roles
  for select using (user_id = auth.uid());
