-- Persisted Dev Chat sessions (admin-only chat with Claude).
-- Each row stores one ongoing conversation; messages is the full transcript.

CREATE TABLE IF NOT EXISTS dev_chat_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New chat',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dev_chat_sessions_user_updated_idx
  ON dev_chat_sessions (user_id, updated_at DESC);

ALTER TABLE dev_chat_sessions ENABLE ROW LEVEL SECURITY;

-- Each user can only see / mutate their own sessions.
CREATE POLICY "Users read own dev chat sessions"
  ON dev_chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own dev chat sessions"
  ON dev_chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dev chat sessions"
  ON dev_chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own dev chat sessions"
  ON dev_chat_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
