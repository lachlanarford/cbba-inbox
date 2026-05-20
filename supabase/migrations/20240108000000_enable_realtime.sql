-- Enable realtime publication for live-updating tables
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;

-- REPLICA IDENTITY FULL lets Supabase filter UPDATE/DELETE events by any column
-- (default only exposes primary key on UPDATE, which breaks column-based filters)
alter table conversations replica identity full;
alter table messages replica identity full;
alter table notifications replica identity full;
