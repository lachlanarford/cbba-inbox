-- Prevent duplicate inbound Gmail messages
CREATE UNIQUE INDEX IF NOT EXISTS messages_external_message_id_unique
  ON public.messages (external_message_id)
  WHERE external_message_id IS NOT NULL;

-- Speed up snoozed conversation queries
CREATE INDEX IF NOT EXISTS conversations_snoozed_until_idx
  ON public.conversations (snoozed_until)
  WHERE snoozed_until IS NOT NULL;
