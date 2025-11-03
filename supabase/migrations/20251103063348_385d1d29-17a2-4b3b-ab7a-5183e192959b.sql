-- Create API health tracking table
CREATE TABLE IF NOT EXISTS api_health_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('healthy', 'rate_limited', 'down')),
  last_successful_call TIMESTAMPTZ,
  last_failed_call TIMESTAMPTZ,
  rate_limit_reset_at TIMESTAMPTZ,
  consecutive_failures INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_health_status_api_name ON api_health_status(api_name);
CREATE INDEX IF NOT EXISTS idx_api_health_status_status ON api_health_status(status);
CREATE INDEX IF NOT EXISTS idx_api_health_status_updated ON api_health_status(updated_at DESC);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_api_health_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER api_health_status_updated_at
BEFORE UPDATE ON api_health_status
FOR EACH ROW
EXECUTE FUNCTION update_api_health_updated_at();