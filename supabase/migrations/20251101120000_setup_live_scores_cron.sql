-- ============================================================================
-- LIVE SCORES TICKER - AUTOMATED SCORE FETCHING
-- ============================================================================
-- This migration sets up automated live score fetching that runs every minute
-- to ensure the live scores ticker always has fresh data.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================================
-- CREATE FUNCTION TO INVOKE MONITOR-LIVE-BETS EDGE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION invoke_monitor_live_bets()
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
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not available, use defaults
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co';
  END IF;

  -- Make async HTTP POST request to monitor-live-bets edge function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/monitor-live-bets',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
    ),
    body := '{}'::jsonb
  ) INTO v_request_id;

  -- Log the request
  RAISE NOTICE 'monitor-live-bets invoked with request ID: %', v_request_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error invoking monitor-live-bets: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_monitor_live_bets IS 'Invokes the monitor-live-bets edge function to fetch live scores for all sports';

-- ============================================================================
-- SCHEDULE CRON JOB TO RUN EVERY MINUTE
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('populate-live-scores') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'populate-live-scores'
);

-- Schedule the job to run every minute to keep live scores fresh
SELECT cron.schedule(
  'populate-live-scores',              -- job name
  '* * * * *',                          -- every minute
  $$SELECT invoke_monitor_live_bets();$$ -- command to run
);

-- ============================================================================
-- CREATE MANUAL TRIGGER FUNCTION (OPTIONAL)
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_live_scores_update()
RETURNS TABLE(
  success BOOLEAN,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Invoke the monitor function
  PERFORM invoke_monitor_live_bets();

  RETURN QUERY SELECT
    true AS success,
    'Live scores update triggered successfully' AS message;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error triggering live scores update: ' || SQLERRM AS message;
END;
$$;

COMMENT ON FUNCTION trigger_live_scores_update IS 'Manually trigger live scores update';

-- ============================================================================
-- LOG CRON JOB CREATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'LIVE SCORES TICKER - AUTOMATED FETCHING CONFIGURED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Job Name: populate-live-scores';
  RAISE NOTICE 'Schedule: Every minute (* * * * *)';
  RAISE NOTICE 'Function: invoke_monitor_live_bets()';
  RAISE NOTICE 'Edge Function: monitor-live-bets';
  RAISE NOTICE '';
  RAISE NOTICE 'The system will now automatically:';
  RAISE NOTICE '1. Fetch live scores for ALL sports every minute';
  RAISE NOTICE '   - NBA, NFL, NCAAF, MLB, NHL, WNBA, MLS';
  RAISE NOTICE '2. Update the live_score_cache table';
  RAISE NOTICE '3. Update bet tracking for active bets';
  RAISE NOTICE '4. Populate the live scores ticker with fresh data';
  RAISE NOTICE '';
  RAISE NOTICE 'To manually trigger: SELECT trigger_live_scores_update();';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
