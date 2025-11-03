-- Enable RLS on api_health_status table
ALTER TABLE api_health_status ENABLE ROW LEVEL SECURITY;

-- Create policy: Service role can manage all records
CREATE POLICY "Service role can manage api_health_status"
  ON api_health_status
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create policy: Authenticated users can view api health status
CREATE POLICY "Authenticated users can view api_health_status"
  ON api_health_status
  FOR SELECT
  TO authenticated
  USING (true);