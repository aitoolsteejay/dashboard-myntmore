-- Aha moments: admin-posted milestone callouts visible to clients
create table if not exists myntmore.aha_moments (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references myntmore.clients(id) on delete cascade,
  title       text not null,
  description text,
  emoji       text default '🎉',
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

alter table myntmore.aha_moments enable row level security;

-- Admins can do everything
create policy "Admins manage aha moments"
  on myntmore.aha_moments for all
  using (
    exists (
      select 1 from myntmore.user_roles
      where user_id = auth.uid() and role = 'admin'
    )
  );

-- Clients can read their own
create policy "Clients read their aha moments"
  on myntmore.aha_moments for select
  using (
    client_id = (
      select id from myntmore.clients where user_id = auth.uid() limit 1
    )
  );
