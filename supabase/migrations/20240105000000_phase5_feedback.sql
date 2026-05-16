-- Phase 5: Feedback request system
CREATE TABLE IF NOT EXISTS public.feedback_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  contact_email text,
  contact_name text,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  comment text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT feedback_requests_conversation_id_unique UNIQUE (conversation_id)
);

ALTER TABLE public.feedback_requests ENABLE ROW LEVEL SECURITY;

-- Staff and admins can read all feedback requests
CREATE POLICY "staff_can_read_feedback_requests"
  ON public.feedback_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role IN ('admin', 'staff')
    )
  );
