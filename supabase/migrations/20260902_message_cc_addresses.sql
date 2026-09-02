-- Store CC recipients on messages (inbound and outbound)
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS cc_addresses text[];
