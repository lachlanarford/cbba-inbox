-- Auto-unsnooze conversations when a customer sends a new message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET last_message_at = NEW.created_at,
      updated_at = now(),
      snoozed_until = CASE
        WHEN NEW.sender_type = 'contact' THEN NULL
        ELSE snoozed_until
      END
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
