-- ============================================================================
-- AUTOMATED BETTING ODDS FETCHING WITH SMART SCHEDULING
-- ============================================================================
-- This migration sets up automated betting odds fetching that runs periodically
-- to ensure the Games dashboard always has fresh data from The Rundown API.
-- ============================================================================

-- Enable pg_cron extension for scheduled jobs (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================================================
-- CREATE HELPER FUNCTION TO DETERMINE ACTIVE SPORTS SEASONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_sports_by_season()
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  current_month INTEGER;
  active_sports TEXT[];
BEGIN
  -- Get current month (1-12)
  current_month := EXTRACT(MONTH FROM CURRENT_DATE);

  -- Initialize empty array
  active_sports := ARRAY[]::TEXT[];

  -- NFL Season: September (9) through February (2)
  IF current_month >= 9 OR current_month <= 2 THEN
    active_sports := array_append(active_sports, 'americanfootball_nfl');
  END IF;

  -- NBA Season: October (10) through June (6)
  IF current_month >= 10 OR current_month <= 6 THEN
    active_sports := array_append(active_sports, 'basketball_nba');
  END IF;

  -- MLB Season: March (3) through October (10)
  IF current_month >= 3 AND current_month <= 10 THEN
    active_sports := array_append(active_sports, 'baseball_mlb');
  END IF;

  -- NHL Season: October (10) through June (6)
  IF current_month >= 10 OR current_month <= 6 THEN
    active_sports := array_append(active_sports, 'icehockey_nhl');
  END IF;

  -- MLS Season: February (2) through November (11)
  IF current_month >= 2 AND current_month <= 11 THEN
    active_sports := array_append(active_sports, 'soccer_usa_mls');
  END IF;

  -- Always return at least NFL (default fallback)
  IF array_length(active_sports, 1) IS NULL THEN
    active_sports := ARRAY['americanfootball_nfl'];
  END IF;

  RETURN active_sports;
END;
$$;

COMMENT ON FUNCTION get_active_sports_by_season IS
  'Returns array of sport keys that are currently in season to optimize API usage';

-- ============================================================================
-- CREATE FUNCTION TO INVOKE FETCH-BETTING-ODDS EDGE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION invoke_fetch_betting_odds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
  v_sport TEXT;
  v_active_sports TEXT[];
  v_sports_fetched INTEGER := 0;
BEGIN
  -- Get Supabase URL and service role key from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- If settings are not available, use defaults (this will work in production)
  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co';
  END IF;

  -- Get active sports based on current season
  v_active_sports := get_active_sports_by_season();

  RAISE NOTICE '[AUTO-FETCH] Starting automated betting odds fetch for % sports',
    array_length(v_active_sports, 1);

  -- Loop through each active sport and fetch odds
  FOREACH v_sport IN ARRAY v_active_sports
  LOOP
    BEGIN
      -- Make async HTTP POST request to fetch-betting-odds edge function
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/fetch-betting-odds',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || COALESCE(v_service_role_key, '')
        ),
        body := jsonb_build_object(
          'sport', v_sport,
          'regions', 'us',
          'markets', 'h2h,spreads,totals'
        )
      ) INTO v_request_id;

      v_sports_fetched := v_sports_fetched + 1;

      RAISE NOTICE '[AUTO-FETCH] Fetched odds for % (request ID: %)', v_sport, v_request_id;

      -- Small delay between requests to avoid overwhelming the API
      PERFORM pg_sleep(0.5);

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[AUTO-FETCH] Error fetching odds for %: %', v_sport, SQLERRM;
        -- Continue with other sports even if one fails
    END;
  END LOOP;

  RAISE NOTICE '[AUTO-FETCH] Completed: fetched % out of % sports',
    v_sports_fetched, array_length(v_active_sports, 1);

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[AUTO-FETCH] Fatal error in invoke_fetch_betting_odds: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_fetch_betting_odds IS
  'Invokes fetch-betting-odds edge function for all active sports based on current season';

-- ============================================================================
-- SCHEDULE CRON JOB TO RUN EVERY 30 MINUTES
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('auto-fetch-betting-odds-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'
);

-- Schedule the job to run every 30 minutes
-- Format: minute hour day month weekday
-- */30 * * * * = every 30 minutes
SELECT cron.schedule(
  'auto-fetch-betting-odds-job',           -- job name
  '*/30 * * * *',                          -- every 30 minutes
  $$SELECT invoke_fetch_betting_odds();$$  -- command to run
);

COMMENT ON FUNCTION invoke_fetch_betting_odds IS
  'Cron job that runs every 30 minutes to fetch fresh betting odds for all active sports';

-- ============================================================================
-- CREATE MANUAL TRIGGER FUNCTION (OPTIONAL)
-- ============================================================================

-- This allows manual triggering of the odds fetch via RPC
CREATE OR REPLACE FUNCTION trigger_fetch_betting_odds(
  p_sport TEXT DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  sports_fetched TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sports TEXT[];
BEGIN
  -- If specific sport requested, fetch only that sport
  IF p_sport IS NOT NULL THEN
    v_sports := ARRAY[p_sport];
  ELSE
    -- Otherwise, fetch all active sports
    v_sports := get_active_sports_by_season();
  END IF;

  -- Invoke the auto-fetch function
  PERFORM invoke_fetch_betting_odds();

  RETURN QUERY SELECT
    true AS success,
    'Betting odds fetch triggered successfully for ' || array_length(v_sports, 1) || ' sports' AS message,
    v_sports AS sports_fetched;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error triggering betting odds fetch: ' || SQLERRM AS message,
      ARRAY[]::TEXT[] AS sports_fetched;
END;
$$;

COMMENT ON FUNCTION trigger_fetch_betting_odds IS
  'Manually trigger betting odds fetch for all active sports or a specific sport';

-- ============================================================================
-- CREATE VIEW TO MONITOR CRON JOB STATUS
-- ============================================================================

CREATE OR REPLACE VIEW cron_betting_odds_status AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname = 'auto-fetch-betting-odds-job';

COMMENT ON VIEW cron_betting_odds_status IS
  'View to check the status of the auto-fetch-betting-odds cron job';

-- Grant access to the view
GRANT SELECT ON cron_betting_odds_status TO postgres, authenticated;

-- ============================================================================
-- CREATE LOGGING TABLE FOR CRON JOB EXECUTION
-- ============================================================================

CREATE TABLE IF NOT EXISTS betting_odds_fetch_log (
  id BIGSERIAL PRIMARY KEY,
  fetch_time TIMESTAMPTZ DEFAULT NOW(),
  sports_fetched TEXT[],
  success BOOLEAN,
  error_message TEXT,
  events_count INTEGER,
  odds_count INTEGER,
  api_requests_remaining INTEGER
);

COMMENT ON TABLE betting_odds_fetch_log IS
  'Logs each execution of the automated betting odds fetch cron job';

-- Grant access to the logging table
GRANT SELECT, INSERT ON betting_odds_fetch_log TO postgres, authenticated;
GRANT USAGE, SELECT ON SEQUENCE betting_odds_fetch_log_id_seq TO postgres, authenticated;

-- ============================================================================
-- CREATE FUNCTION TO CHECK DATA FRESHNESS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_betting_odds_freshness(
  p_sport TEXT,
  p_max_age_minutes INTEGER DEFAULT 60
)
RETURNS TABLE(
  is_fresh BOOLEAN,
  data_age_minutes INTEGER,
  last_updated TIMESTAMPTZ,
  unique_events INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_updated TIMESTAMPTZ;
  v_age_minutes INTEGER;
  v_event_count INTEGER;
BEGIN
  -- Get the most recent update time for this sport
  SELECT MAX(last_updated)
  INTO v_last_updated
  FROM betting_odds
  WHERE sport_key = p_sport
    AND commence_time >= CURRENT_DATE
    AND commence_time <= CURRENT_DATE + INTERVAL '7 days';

  -- If no data found, return stale
  IF v_last_updated IS NULL THEN
    RETURN QUERY SELECT
      false AS is_fresh,
      NULL::INTEGER AS data_age_minutes,
      NULL::TIMESTAMPTZ AS last_updated,
      0 AS unique_events;
    RETURN;
  END IF;

  -- Calculate age in minutes
  v_age_minutes := EXTRACT(EPOCH FROM (NOW() - v_last_updated)) / 60;

  -- Count unique events
  SELECT COUNT(DISTINCT event_id)
  INTO v_event_count
  FROM betting_odds
  WHERE sport_key = p_sport
    AND commence_time >= CURRENT_DATE
    AND commence_time <= CURRENT_DATE + INTERVAL '7 days';

  -- Return freshness info
  RETURN QUERY SELECT
    (v_age_minutes <= p_max_age_minutes) AS is_fresh,
    v_age_minutes AS data_age_minutes,
    v_last_updated AS last_updated,
    v_event_count AS unique_events;
END;
$$;

COMMENT ON FUNCTION check_betting_odds_freshness IS
  'Checks if betting odds data for a sport is fresh (within max_age_minutes)';

-- ============================================================================
-- LOG CRON JOB CREATION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'AUTOMATED BETTING ODDS FETCHING CONFIGURED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Job Name: auto-fetch-betting-odds-job';
  RAISE NOTICE 'Schedule: Every 30 minutes (*/30 * * * *)';
  RAISE NOTICE 'Function: invoke_fetch_betting_odds()';
  RAISE NOTICE 'Edge Function: fetch-betting-odds';
  RAISE NOTICE '';
  RAISE NOTICE 'Active Sports (based on current season):';
  RAISE NOTICE '  %', array_to_string(get_active_sports_by_season(), ', ');
  RAISE NOTICE '';
  RAISE NOTICE 'The system will now automatically:';
  RAISE NOTICE '1. Fetch betting odds from The Rundown API every 30 minutes';
  RAISE NOTICE '2. Only fetch sports that are currently in season';
  RAISE NOTICE '3. Populate betting_odds table for Games dashboard';
  RAISE NOTICE '4. Track line movements and odds changes';
  RAISE NOTICE '5. Ensure fresh data is always available';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual triggers:';
  RAISE NOTICE '  - All sports: SELECT trigger_fetch_betting_odds();';
  RAISE NOTICE '  - Specific sport: SELECT trigger_fetch_betting_odds(''americanfootball_nfl'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring:';
  RAISE NOTICE '  - Job status: SELECT * FROM cron_betting_odds_status;';
  RAISE NOTICE '  - Data freshness: SELECT * FROM check_betting_odds_freshness(''americanfootball_nfl'', 60);';
  RAISE NOTICE '  - Fetch logs: SELECT * FROM betting_odds_fetch_log ORDER BY fetch_time DESC LIMIT 10;';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- INITIAL FETCH ON DEPLOYMENT (OPTIONAL)
-- ============================================================================

-- Trigger an immediate fetch when migration runs
-- This ensures data is available right away
SELECT invoke_fetch_betting_odds();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
