-- Phase 2: Core inbox tables

-- ============================================================
-- CONTACTS
-- ============================================================
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  email text,
  phone text,
  social_id text,
  channel text check (channel in ('gmail', 'whatsapp', 'facebook', 'instagram', 'form', 'chat')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- CONVERSATIONS
-- ============================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  assigned_to uuid references public.users(id) on delete set null,
  channel text not null check (channel in ('gmail', 'whatsapp', 'facebook', 'instagram', 'form', 'chat')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'waiting', 'closed')),
  department text check (department in ('Reps', 'Comps', 'LTP', 'Other')),
  priority text not null default 'low' check (priority in ('low', 'medium', 'high', 'urgent')),
  subject text,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  last_message_at timestamptz not null default now()
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('staff', 'contact', 'ai')),
  sender_id uuid references public.users(id) on delete set null,
  content text not null,
  is_internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- LABELS
-- ============================================================
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  colour text not null,
  type text not null check (type in ('department', 'priority', 'custom')),
  created_at timestamptz not null default now()
);

-- ============================================================
-- CONVERSATION LABELS
-- ============================================================
create table if not exists public.conversation_labels (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  label_id uuid not null references public.labels(id) on delete cascade,
  primary key (conversation_id, label_id)
);

-- ============================================================
-- FEEDBACK
-- ============================================================
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  submitted_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_conversations_status on public.conversations(status);
create index if not exists idx_conversations_last_message_at on public.conversations(last_message_at desc);
create index if not exists idx_conversations_contact_id on public.conversations(contact_id);
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);
create index if not exists idx_messages_created_at on public.messages(created_at);
create index if not exists idx_contacts_email on public.contacts(email);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger contacts_updated_at
  before update on public.contacts
  for each row execute function public.update_updated_at_column();

create trigger conversations_updated_at
  before update on public.conversations
  for each row execute function public.update_updated_at_column();

-- Trigger: update conversation last_message_at when a message is inserted
create or replace function public.update_conversation_last_message_at()
returns trigger as $$
begin
  update public.conversations
  set last_message_at = new.created_at,
      updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$ language plpgsql;

create trigger messages_update_conversation
  after insert on public.messages
  for each row execute function public.update_conversation_last_message_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- contacts
alter table public.contacts enable row level security;

create policy "contacts_select" on public.contacts
  for select using (auth.uid() is not null);
create policy "contacts_insert" on public.contacts
  for insert with check (auth.uid() is not null);
create policy "contacts_update" on public.contacts
  for update using (auth.uid() is not null);
create policy "contacts_delete" on public.contacts
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- conversations
alter table public.conversations enable row level security;

create policy "conversations_select" on public.conversations
  for select using (auth.uid() is not null);
create policy "conversations_insert" on public.conversations
  for insert with check (auth.uid() is not null);
create policy "conversations_update" on public.conversations
  for update using (auth.uid() is not null);
create policy "conversations_delete" on public.conversations
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- messages
alter table public.messages enable row level security;

create policy "messages_select" on public.messages
  for select using (auth.uid() is not null);
create policy "messages_insert" on public.messages
  for insert with check (auth.uid() is not null);
create policy "messages_update" on public.messages
  for update using (auth.uid() is not null);
create policy "messages_delete" on public.messages
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- labels
alter table public.labels enable row level security;

create policy "labels_select" on public.labels
  for select using (auth.uid() is not null);
create policy "labels_insert" on public.labels
  for insert with check (auth.uid() is not null);
create policy "labels_update" on public.labels
  for update using (auth.uid() is not null);
create policy "labels_delete" on public.labels
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- conversation_labels
alter table public.conversation_labels enable row level security;

create policy "conv_labels_select" on public.conversation_labels
  for select using (auth.uid() is not null);
create policy "conv_labels_insert" on public.conversation_labels
  for insert with check (auth.uid() is not null);
create policy "conv_labels_delete" on public.conversation_labels
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- feedback
alter table public.feedback enable row level security;

create policy "feedback_select" on public.feedback
  for select using (auth.uid() is not null);
create policy "feedback_insert" on public.feedback
  for insert with check (auth.uid() is not null);
create policy "feedback_update" on public.feedback
  for update using (auth.uid() is not null);
create policy "feedback_delete" on public.feedback
  for delete using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- REALTIME
-- Full replica identity so UPDATE and DELETE events carry the full row.
-- ============================================================
alter table public.conversations replica identity full;
alter table public.messages replica identity full;

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
