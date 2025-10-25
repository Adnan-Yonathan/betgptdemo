-- ============================================================================
-- BALLDONTLIE API INTEGRATION - DATABASE SCHEMA UPDATES
-- ============================================================================
-- This migration adds support for tracking data sources and API health
-- Created: 2025-10-24
-- ============================================================================

-- ============================================================================
-- ADD DATA SOURCE TRACKING TO PLAYER PERFORMANCE HISTORY
-- ============================================================================

-- Add data_source column to track where stats came from
ALTER TABLE player_performance_history
ADD COLUMN IF NOT EXISTS data_source TEXT DEFAULT 'espn'
  CHECK (data_source IN ('balldontlie', 'espn', 'manual'));

-- Create index for faster queries by source
CREATE INDEX IF NOT EXISTS idx_player_perf_source
ON player_performance_history(data_source);

-- Create composite index for common queries
CREATE INDEX IF NOT EXISTS idx_player_perf_name_date_source
ON player_performance_history(player_name, game_date DESC, data_source);

COMMENT ON COLUMN player_performance_history.data_source IS
  'Source of the stats data: balldontlie (primary), espn (fallback), or manual';

-- ============================================================================
-- CREATE API SOURCE LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_source_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source TEXT NOT NULL CHECK (source IN ('balldontlie', 'espn', 'odds-api', 'openai')),
  endpoint TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  error_message TEXT,
  request_params JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for monitoring queries
CREATE INDEX IF NOT EXISTS idx_api_log_source_date
ON api_source_log(source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_log_success
ON api_source_log(success, created_at DESC);

COMMENT ON TABLE api_source_log IS
  'Logs all API requests to external services for monitoring and debugging';

-- ============================================================================
-- CREATE API HEALTH MONITORING FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_api_health_stats(
  p_source TEXT DEFAULT NULL,
  p_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  source TEXT,
  total_requests BIGINT,
  success_rate DECIMAL,
  avg_response_time INTEGER,
  error_count BIGINT,
  last_success TIMESTAMPTZ,
  last_error TIMESTAMPTZ
)
LANGUAGE SQL
AS $$
  SELECT
    source,
    COUNT(*) as total_requests,
    ROUND(AVG(CASE WHEN success THEN 1 ELSE 0 END) * 100, 2) as success_rate,
    AVG(response_time_ms)::INTEGER as avg_response_time,
    SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) as error_count,
    MAX(CASE WHEN success THEN created_at END) as last_success,
    MAX(CASE WHEN NOT success THEN created_at END) as last_error
  FROM api_source_log
  WHERE created_at >= NOW() - (p_hours || ' hours')::INTERVAL
    AND (p_source IS NULL OR source = p_source)
  GROUP BY source
  ORDER BY source;
$$;

COMMENT ON FUNCTION get_api_health_stats IS
  'Get API health statistics for monitoring dashboard';

-- ============================================================================
-- CREATE DATA SOURCE USAGE VIEW
-- ============================================================================

CREATE OR REPLACE VIEW v_data_source_usage AS
SELECT
  data_source,
  COUNT(*) as stat_entries,
  COUNT(DISTINCT player_name) as unique_players,
  COUNT(DISTINCT game_date) as unique_games,
  COUNT(DISTINCT team) as unique_teams,
  MIN(game_date) as earliest_game,
  MAX(game_date) as latest_game,
  MAX(created_at) as last_updated
FROM player_performance_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY data_source
ORDER BY stat_entries DESC;

COMMENT ON VIEW v_data_source_usage IS
  'Summary of data source usage over the last 30 days';

-- ============================================================================
-- CREATE BALLDONTLIE SYNC LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS balldontlie_sync_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sync_date DATE NOT NULL,
  total_games INTEGER,
  completed_games INTEGER,
  successful_syncs INTEGER,
  failed_syncs INTEGER,
  stats_synced INTEGER,
  execution_time_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_balldontlie_sync_date
ON balldontlie_sync_log(sync_date DESC);

COMMENT ON TABLE balldontlie_sync_log IS
  'Logs each execution of the daily BALLDONTLIE sync job';

-- ============================================================================
-- CREATE FUNCTION TO LOG API REQUESTS
-- ============================================================================

CREATE OR REPLACE FUNCTION log_api_request(
  p_source TEXT,
  p_endpoint TEXT,
  p_success BOOLEAN,
  p_response_time_ms INTEGER DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_request_params JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO api_source_log (
    source,
    endpoint,
    success,
    response_time_ms,
    error_message,
    request_params
  ) VALUES (
    p_source,
    p_endpoint,
    p_success,
    p_response_time_ms,
    p_error_message,
    p_request_params
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

COMMENT ON FUNCTION log_api_request IS
  'Helper function to log API requests from edge functions';

-- ============================================================================
-- CREATE CRON JOB FOR DAILY BALLDONTLIE SYNC
-- ============================================================================

-- Remove existing job if it exists
SELECT cron.unschedule('balldontlie-daily-sync')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'balldontlie-daily-sync'
);

-- Create function to invoke sync
CREATE OR REPLACE FUNCTION invoke_balldontlie_daily_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_request_id BIGINT;
  v_yesterday DATE;
BEGIN
  -- Get Supabase URL
  v_supabase_url := current_setting('app.settings.supabase_url', true);

  IF v_supabase_url IS NULL THEN
    v_supabase_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co';
  END IF;

  -- Calculate yesterday's date
  v_yesterday := CURRENT_DATE - INTERVAL '1 day';

  RAISE NOTICE '[BALLDONTLIE-SYNC] Starting daily sync for %', v_yesterday;

  -- Make HTTP request to sync function
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/sync-balldontlie-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object(
      'sync_date', v_yesterday::TEXT
    )
  ) INTO v_request_id;

  RAISE NOTICE '[BALLDONTLIE-SYNC] Sync request initiated (ID: %)', v_request_id;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[BALLDONTLIE-SYNC] Error: %', SQLERRM;
END;
$$;

-- Schedule daily sync at 3 AM ET (after games complete)
SELECT cron.schedule(
  'balldontlie-daily-sync',
  '0 3 * * *',  -- 3 AM daily
  $$SELECT invoke_balldontlie_daily_sync();$$
);

COMMENT ON FUNCTION invoke_balldontlie_daily_sync IS
  'Triggers daily sync of BALLDONTLIE stats for completed games';

-- ============================================================================
-- CREATE FUNCTION TO CHECK DATA FRESHNESS
-- ============================================================================

CREATE OR REPLACE FUNCTION check_stats_freshness(
  p_source TEXT DEFAULT 'balldontlie',
  p_max_age_hours INTEGER DEFAULT 24
)
RETURNS TABLE(
  is_fresh BOOLEAN,
  data_age_hours INTEGER,
  last_updated TIMESTAMPTZ,
  unique_players INTEGER,
  unique_games INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_last_updated TIMESTAMPTZ;
  v_age_hours INTEGER;
  v_player_count INTEGER;
  v_game_count INTEGER;
BEGIN
  -- Get the most recent update time for this source
  SELECT MAX(created_at)
  INTO v_last_updated
  FROM player_performance_history
  WHERE data_source = p_source
    AND game_date >= CURRENT_DATE - INTERVAL '7 days';

  -- If no data found, return stale
  IF v_last_updated IS NULL THEN
    RETURN QUERY SELECT
      false AS is_fresh,
      NULL::INTEGER AS data_age_hours,
      NULL::TIMESTAMPTZ AS last_updated,
      0 AS unique_players,
      0 AS unique_games;
    RETURN;
  END IF;

  -- Calculate age in hours
  v_age_hours := EXTRACT(EPOCH FROM (NOW() - v_last_updated)) / 3600;

  -- Count unique players and games
  SELECT
    COUNT(DISTINCT player_name),
    COUNT(DISTINCT game_date)
  INTO v_player_count, v_game_count
  FROM player_performance_history
  WHERE data_source = p_source
    AND game_date >= CURRENT_DATE - INTERVAL '7 days';

  -- Return freshness info
  RETURN QUERY SELECT
    (v_age_hours <= p_max_age_hours) AS is_fresh,
    v_age_hours AS data_age_hours,
    v_last_updated AS last_updated,
    v_player_count AS unique_players,
    v_game_count AS unique_games;
END;
$$;

COMMENT ON FUNCTION check_stats_freshness IS
  'Checks if stats data from a source is fresh (within max_age_hours)';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT, INSERT ON api_source_log TO postgres, authenticated;
GRANT USAGE, SELECT ON SEQUENCE api_source_log_id_seq TO postgres, authenticated;

GRANT SELECT, INSERT ON balldontlie_sync_log TO postgres, authenticated;
GRANT USAGE, SELECT ON SEQUENCE balldontlie_sync_log_id_seq TO postgres, authenticated;

GRANT SELECT ON v_data_source_usage TO postgres, authenticated;

-- ============================================================================
-- LOG MIGRATION COMPLETION
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'BALLDONTLIE INTEGRATION - MIGRATION COMPLETE';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Changes applied:';
  RAISE NOTICE '  ✅ Added data_source column to player_performance_history';
  RAISE NOTICE '  ✅ Created api_source_log table for monitoring';
  RAISE NOTICE '  ✅ Created balldontlie_sync_log table';
  RAISE NOTICE '  ✅ Created monitoring functions and views';
  RAISE NOTICE '  ✅ Scheduled daily sync cron job (3 AM ET)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Deploy edge functions:';
  RAISE NOTICE '     - fetch-balldontlie-stats';
  RAISE NOTICE '     - sync-balldontlie-daily';
  RAISE NOTICE '  2. Test API access with BALLDONTLIE_API_KEY';
  RAISE NOTICE '  3. Run manual sync: SELECT invoke_balldontlie_daily_sync();';
  RAISE NOTICE '  4. Monitor with: SELECT * FROM get_api_health_stats();';
  RAISE NOTICE '=================================================================';
END $$;
