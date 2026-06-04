ALTER TABLE conversations ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
