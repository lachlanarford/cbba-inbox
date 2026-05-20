-- ── Notifications ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text        NOT NULL CHECK (type IN ('assignment', 'live_chat', 'app_update')),
  title           text        NOT NULL,
  body            text,
  read            boolean     NOT NULL DEFAULT false,
  conversation_id uuid        REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Service role can insert notifications (used by API routes)
CREATE POLICY "service_insert_notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- Trigger: notify assigned user when conversation.assigned_to changes
CREATE OR REPLACE FUNCTION public.notify_on_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    INSERT INTO public.notifications (user_id, type, title, body, conversation_id)
    VALUES (
      NEW.assigned_to,
      'assignment',
      'Conversation assigned to you',
      COALESCE(NEW.subject, 'No subject'),
      NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_conversation_assigned ON public.conversations;
CREATE TRIGGER on_conversation_assigned
  AFTER UPDATE OF assigned_to ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_assignment();

-- ── Bug reports ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.bug_reports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by  uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  title         text        NOT NULL,
  description   text        NOT NULL,
  status        text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  priority      text        NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bug_reports ENABLE ROW LEVEL SECURITY;

-- All authenticated staff can submit and read their own; admins see all
CREATE POLICY "staff_insert_bugs" ON public.bug_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "staff_read_bugs" ON public.bug_reports
  FOR SELECT USING (submitted_by = auth.uid() OR public.is_admin());

CREATE POLICY "admin_update_bugs" ON public.bug_reports
  FOR UPDATE USING (public.is_admin());
