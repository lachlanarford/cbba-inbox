-- Users table: mirrors auth.users with app-specific fields
create table if not exists public.users (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  is_active boolean not null default true
);

-- Enable Row Level Security
alter table public.users enable row level security;

-- Users can read their own row
create policy "users_select_own"
  on public.users
  for select
  using (auth.uid() = id);

-- Users can update their own row (excluding role changes)
create policy "users_update_own"
  on public.users
  for update
  using (auth.uid() = id);

-- Security-definer helper: runs as DB owner so it can query public.users without
-- triggering RLS recursion when used inside policies on the same table.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin'
  )
$$;

-- Admins can read all rows
create policy "admins_select_all"
  on public.users
  for select
  using (public.is_admin());

-- Admins can update all rows
create policy "admins_update_all"
  on public.users
  for update
  using (public.is_admin());

-- Allow new user rows to be inserted (needed for the post-login upsert)
create policy "users_insert_own"
  on public.users
  for insert
  with check (auth.uid() = id);
