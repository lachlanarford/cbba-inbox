-- Conversation collaborators (staff watching/participating beyond assignee)
CREATE TABLE IF NOT EXISTS public.conversation_collaborators (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  added_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS conversation_collaborators_user_id_idx
  ON public.conversation_collaborators (user_id);

ALTER TABLE public.conversation_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_read_collaborators"
  ON public.conversation_collaborators FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Extend notification types for collaborators and @mentions
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('assignment', 'live_chat', 'app_update', 'collaborator', 'mention'));
