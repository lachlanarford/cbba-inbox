-- Phase 6: Canned responses (reply templates)
CREATE TABLE IF NOT EXISTS public.canned_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed to pick templates in reply box)
CREATE POLICY "authenticated_read_canned_responses"
  ON public.canned_responses
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Only admins can create/update/delete
CREATE POLICY "admins_manage_canned_responses"
  ON public.canned_responses
  FOR ALL
  USING (public.is_admin());
