-- 3FS production authentication, roles and live shared data
-- Run this entire file in Supabase SQL Editor.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '3FS Team Member',
  role text not null default 'admin' check (role = 'admin'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.current_3fs_role() returns text language sql stable security definer set search_path=public as $$ select role from public.profiles where id=auth.uid() and is_active $$;
create or replace function public.current_3fs_active() returns boolean language sql stable security definer set search_path=public as $$ select coalesce((select is_active from public.profiles where id=auth.uid()),false) $$;

drop policy if exists "profiles self read" on public.profiles;
drop policy if exists "admin read profiles" on public.profiles;
drop policy if exists "admin update profiles" on public.profiles;
drop policy if exists "admin insert profiles" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated using (id=auth.uid());
create policy "admin read profiles" on public.profiles for select to authenticated using (public.current_3fs_role()='admin');
create policy "admin update profiles" on public.profiles for update to authenticated using (public.current_3fs_role()='admin') with check (role='admin');

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,email,full_name,role,is_active)
  values(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name','3FS Team Member'),'admin',true)
  on conflict(id) do update set email=excluded.email, full_name=excluded.full_name;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create table if not exists public.threefs_state (
  id bigint primary key check (id=1),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.threefs_state enable row level security;
drop policy if exists "team can read 3fs state" on public.threefs_state;
drop policy if exists "team can insert 3fs state" on public.threefs_state;
drop policy if exists "team can update 3fs state" on public.threefs_state;
create policy "team can read 3fs state" on public.threefs_state for select to authenticated using (public.current_3fs_active());
create policy "managers can insert 3fs state" on public.threefs_state for insert to authenticated with check (id=1 and public.current_3fs_role()='admin');
create policy "managers can update 3fs state" on public.threefs_state for update to authenticated using (id=1 and public.current_3fs_role()='admin') with check (id=1 and updated_by=auth.uid());

alter table public.threefs_state replica identity full;
do $$ begin alter publication supabase_realtime add table public.threefs_state; exception when duplicate_object then null; end $$;

-- All newly created accounts are Admin Team Members automatically. No promotion step is required.

-- 3FS access model:
-- Every active 3FS team member is an admin with full access.
-- There are no owner, CEO, manager, member, or viewer permission levels.
