-- Enable realtime for collaborator add/remove so My Inbox updates live
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_collaborators;
