-- One Gmail thread must map to one conversation so follow-up mail can be ingested.
-- Duplicate rows made .maybeSingle() fail, which dropped later emails from the inbox.

CREATE UNIQUE INDEX IF NOT EXISTS conversations_gmail_thread_unique
  ON public.conversations (channel_config_id, external_thread_id)
  WHERE channel = 'gmail' AND external_thread_id IS NOT NULL;
