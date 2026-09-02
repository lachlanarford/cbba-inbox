-- Notification types for conversation activity (messages and internal notes)
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('assignment', 'live_chat', 'app_update', 'collaborator', 'mention', 'message', 'note'));
