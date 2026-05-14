-- Phase 4: AI features

-- Add AI columns to existing tables
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS needs_review boolean DEFAULT false;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_ai_suggested boolean DEFAULT false;

-- ai_logs: records every AI action
CREATE TABLE IF NOT EXISTS ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  action text NOT NULL,
  input text NOT NULL,
  output text NOT NULL,
  model text NOT NULL,
  confidence float,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE ai_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_logs_authenticated_read" ON ai_logs
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "ai_logs_service_write" ON ai_logs
  FOR INSERT WITH CHECK (true);

-- knowledge_base: scrapped/manual content for chatbot context
CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  last_scraped_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_base_authenticated_read" ON knowledge_base
  FOR SELECT TO authenticated USING (is_active = true);

CREATE POLICY "knowledge_base_admin_all" ON knowledge_base
  FOR ALL USING (public.is_admin());

-- settings: simple key/value config
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_authenticated_read" ON settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "settings_service_write" ON settings
  FOR ALL WITH CHECK (true);

-- Seed default settings
INSERT INTO settings (key, value) VALUES ('chat_mode', 'ai')
  ON CONFLICT (key) DO NOTHING;

-- chat messages: stores chatbot session messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  role text NOT NULL, -- user | assistant
  content text NOT NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_messages_service_all" ON chat_messages
  FOR ALL WITH CHECK (true);

CREATE POLICY "chat_messages_authenticated_read" ON chat_messages
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id, created_at DESC);
