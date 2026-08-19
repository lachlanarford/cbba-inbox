-- Per-message sender identity (CC replies) and RFC Message-ID for cross-inbox threading
alter table public.messages
  add column if not exists from_name text;

alter table public.messages
  add column if not exists rfc_message_id text;
