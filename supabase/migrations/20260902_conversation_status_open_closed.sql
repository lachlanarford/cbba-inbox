-- Simplify conversation statuses to open and closed only
UPDATE public.conversations
SET status = 'open'
WHERE status IN ('in_progress', 'waiting');

ALTER TABLE public.conversations DROP CONSTRAINT IF EXISTS conversations_status_check;
ALTER TABLE public.conversations ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('open', 'closed'));

CREATE INDEX IF NOT EXISTS conversations_assigned_to_last_message_idx
  ON public.conversations (assigned_to, last_message_at DESC)
  WHERE assigned_to IS NOT NULL;
