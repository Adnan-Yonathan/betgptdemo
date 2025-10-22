-- ============================================================================
-- AUTOMATED BET SETTLEMENT WITH LIVE SCORE MONITORING
-- ============================================================================
-- This migration sets up automated bet settlement that runs periodically
-- to fetch live scores and settle pending bets in real-time.
-- ============================================================================

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================================
-- CREATE FUNCTION TO INVOKE AUTO-MONITOR-BETS EDGE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION invoke_auto_monitor_bets()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
BEGIN
  -- Get Supabase URL and service role key from environment
  -- These will be set by Supabase automatically
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not available, use defaults (this will work in production)
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co';
  END IF;

  -- Make async HTTP POST request to auto-monitor-bets edge function
  -- We use pg_net's http_post function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/auto-monitor-bets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  -- Log the request
  RAISE NOTICE 'Auto-monitor-bets invoked with request ID: %', v_request_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error invoking auto-monitor-bets: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_auto_monitor_bets IS 'Invokes the auto-monitor-bets edge function to fetch scores and settle bets';

-- ============================================================================
-- SCHEDULE CRON JOB TO RUN EVERY 10 MINUTES
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('auto-monitor-bets-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-monitor-bets-job'
);

-- Schedule the job to run every 10 minutes
-- Format: minute hour day month weekday
-- */10 * * * * = every 10 minutes
SELECT cron.schedule(
  'auto-monitor-bets-job',                    -- job name
  '*/10 * * * *',                              -- every 10 minutes
  $$SELECT invoke_auto_monitor_bets();$$      -- command to run
);

-- ============================================================================
-- CREATE MANUAL TRIGGER FUNCTION (OPTIONAL)
-- ============================================================================

-- This allows manual triggering of the auto-monitor process via RPC
CREATE OR REPLACE FUNCTION trigger_auto_monitor()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Invoke the auto-monitor function
  PERFORM invoke_auto_monitor_bets();

  RETURN QUERY SELECT
    true AS success,
    'Auto-monitor process triggered successfully' AS message;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error triggering auto-monitor: ' || SQLERRM AS message;
END;
$$;

COMMENT ON FUNCTION trigger_auto_monitor IS 'Manually trigger the auto-monitor-bets process';

-- ============================================================================
-- CREATE VIEW TO MONITOR CRON JOB STATUS
-- ============================================================================

CREATE OR REPLACE VIEW cron_job_status AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname = 'auto-monitor-bets-job';

COMMENT ON VIEW cron_job_status IS 'View to check the status of the auto-monitor-bets cron job';

-- Grant access to the view
GRANT SELECT ON cron_job_status TO postgres, authenticated;

-- ============================================================================
-- LOG CRON JOB CREATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'AUTO BET SETTLEMENT CRON JOB CONFIGURED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Job Name: auto-monitor-bets-job';
  RAISE NOTICE 'Schedule: Every 10 minutes (*/10 * * * *)';
  RAISE NOTICE 'Function: invoke_auto_monitor_bets()';
  RAISE NOTICE 'Edge Function: auto-monitor-bets';
  RAISE NOTICE '';
  RAISE NOTICE 'The system will now automatically:';
  RAISE NOTICE '1. Fetch live scores from ESPN every 10 minutes';
  RAISE NOTICE '2. Check all pending bets against completed games';
  RAISE NOTICE '3. Settle bets and update user bankrolls in real-time';
  RAISE NOTICE '4. Update CRM statistics via database triggers';
  RAISE NOTICE '';
  RAISE NOTICE 'To manually trigger: SELECT trigger_auto_monitor();';
  RAISE NOTICE 'To view job status: SELECT * FROM cron_job_status;';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
