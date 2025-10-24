-- Migration: Schedule Daily Predictions
-- Sets up pg_cron job to run predictions daily at 6 AM ET

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant usage on cron schema to postgres
GRANT USAGE ON SCHEMA cron TO postgres;

-- Drop existing job if it exists
SELECT cron.unschedule('daily-ai-predictions');

-- Schedule the daily predictions job
-- Runs every day at 6:00 AM ET (10:00 AM UTC during EST, 11:00 AM UTC during EDT)
-- For simplicity, we'll run at 10:00 AM UTC year-round
-- Adjust as needed based on your timezone requirements
SELECT cron.schedule(
  'daily-ai-predictions', -- Job name
  '0 10 * * *',           -- Cron expression: Every day at 10:00 AM UTC (6:00 AM ET)
  $$
  SELECT
    net.http_post(
      url := current_setting('app.supabase_url') || '/functions/v1/run-daily-predictions',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key')
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Create a table to log prediction job runs
CREATE TABLE IF NOT EXISTS prediction_job_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_name TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT, -- 'success', 'failed', 'running'
  predictions_generated INTEGER,
  error_message TEXT,
  metadata JSONB
);

-- Add comment explaining the job
COMMENT ON TABLE prediction_job_log IS 'Logs for scheduled prediction jobs. Tracks when predictions are generated and any errors that occur.';

-- Create index on started_at for faster queries
CREATE INDEX IF NOT EXISTS idx_prediction_job_log_started_at ON prediction_job_log(started_at DESC);

-- Create a function to log job executions
CREATE OR REPLACE FUNCTION log_prediction_job(
  p_job_name TEXT,
  p_status TEXT,
  p_predictions_generated INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO prediction_job_log (
    job_name,
    status,
    predictions_generated,
    error_message,
    metadata,
    completed_at
  ) VALUES (
    p_job_name,
    p_status,
    p_predictions_generated,
    p_error_message,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Add RLS policies for prediction_job_log
ALTER TABLE prediction_job_log ENABLE ROW LEVEL SECURITY;

-- Only allow service role to insert logs
CREATE POLICY "Service role can insert prediction logs"
  ON prediction_job_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow authenticated users to view logs (for debugging/transparency)
CREATE POLICY "Authenticated users can view prediction logs"
  ON prediction_job_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Add a view to easily check the last prediction run
CREATE OR REPLACE VIEW last_prediction_run AS
SELECT
  job_name,
  started_at,
  completed_at,
  status,
  predictions_generated,
  error_message
FROM prediction_job_log
WHERE job_name = 'daily-ai-predictions'
ORDER BY started_at DESC
LIMIT 1;

-- Grant access to the view
GRANT SELECT ON last_prediction_run TO authenticated;

COMMENT ON VIEW last_prediction_run IS 'Shows the most recent prediction job run status and results.';
