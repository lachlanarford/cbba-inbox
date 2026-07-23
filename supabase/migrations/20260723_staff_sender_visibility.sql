-- Allow authenticated staff to read active teammate profiles (needed for message sender names,
-- assignee lists, and live-chat presence). Admins already have full select via admins_select_all.
create policy "users_select_active_teammates"
  on public.users
  for select
  using (auth.uid() is not null and is_active = true);

-- Track which inbox address an outbound staff email was sent from
alter table public.messages
  add column if not exists from_address text;
