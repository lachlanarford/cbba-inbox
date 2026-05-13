-- Phase 3: channel_configs table + conversations extensions

-- channel_configs: stores credentials and state for each connected channel account
create table public.channel_configs (
  id          uuid        primary key default gen_random_uuid(),
  channel_type text       not null check (channel_type in ('gmail', 'whatsapp', 'facebook', 'instagram', 'form', 'chat')),
  display_name text       not null,
  identifier   text       not null,
  credentials  jsonb      not null default '{}',
  is_active    boolean    not null default false,
  metadata     jsonb      not null default '{}',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.channel_configs enable row level security;

-- Only admins can read or write channel configs
create policy "admins_manage_channel_configs"
  on public.channel_configs
  for all
  using (public.is_admin())
  with check (public.is_admin());

create trigger channel_configs_updated_at
  before update on public.channel_configs
  for each row execute function public.update_updated_at_column();

-- Seed the website form config (always present; activated via the toggle in settings)
insert into public.channel_configs (channel_type, display_name, identifier, is_active)
values ('form', 'Website Form', 'website-form', false)
on conflict do nothing;

-- conversations: add external_thread_id for linking to Gmail threads etc.
alter table public.conversations
  add column if not exists external_thread_id text,
  add column if not exists channel_config_id uuid references public.channel_configs(id) on delete set null;

create index if not exists conversations_external_thread_id_idx
  on public.conversations(external_thread_id)
  where external_thread_id is not null;
