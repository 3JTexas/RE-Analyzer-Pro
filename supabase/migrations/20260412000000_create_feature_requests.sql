CREATE TABLE IF NOT EXISTS feature_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  user_email text,
  status text DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);

-- Allow service role full access (edge function uses service role key)
ALTER TABLE feature_requests ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert
CREATE POLICY "Users can submit feature requests"
  ON feature_requests FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow service role to read all (for admin)
CREATE POLICY "Service role can read all"
  ON feature_requests FOR SELECT
  TO service_role
  USING (true);
