-- Allow authenticated users to read all feature requests (admin panel)
CREATE POLICY "Authenticated users can read feature requests"
  ON feature_requests FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to update status (approve/reject)
CREATE POLICY "Authenticated users can update feature requests"
  ON feature_requests FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete feature requests
CREATE POLICY "Authenticated users can delete feature requests"
  ON feature_requests FOR DELETE
  TO authenticated
  USING (true);
