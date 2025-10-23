-- ============================================================================
-- SMART SCHEDULING UPDATE: NFL, NCAAF, NBA Only with Peak Hours
-- ============================================================================
-- This migration updates the automated betting odds fetching to:
-- 1. Only fetch NFL, NCAAF, and NBA (removing MLB, NHL, MLS)
-- 2. Run 5 times per day at peak betting hours (conserve API quota)
-- 3. Add NCAAF season support (August through January)
--
-- API Quota Management:
-- - 5 fetches/day × 3 sports = 15 calls/day = ~450 calls/month
-- - Monthly quota: 500 calls
-- - Buffer: 50 calls for manual refreshes and testing
-- ============================================================================

-- ============================================================================
-- UPDATE HELPER FUNCTION TO ONLY RETURN NFL, NCAAF, NBA
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

  -- NCAAF Season: August (8) through January (1)
  -- College football starts earlier and ends with bowl season
  IF current_month >= 8 OR current_month = 1 THEN
    active_sports := array_append(active_sports, 'americanfootball_ncaaf');
  END IF;

  -- NBA Season: October (10) through June (6)
  IF current_month >= 10 OR current_month <= 6 THEN
    active_sports := array_append(active_sports, 'basketball_nba');
  END IF;

  -- Always return at least NFL (default fallback)
  IF array_length(active_sports, 1) IS NULL THEN
    active_sports := ARRAY['americanfootball_nfl'];
  END IF;

  RETURN active_sports;
END;
$$;

COMMENT ON FUNCTION get_active_sports_by_season IS
  'Returns array of sport keys for NFL, NCAAF, and NBA based on current season';

-- ============================================================================
-- REMOVE OLD CRON JOB (every 30 minutes)
-- ============================================================================

SELECT cron.unschedule('auto-fetch-betting-odds-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'
);

-- ============================================================================
-- CREATE NEW SMART SCHEDULING CRON JOBS (5x per day at peak hours)
-- ============================================================================
-- Schedule times in UTC (EST + 4/5 hours depending on DST)
-- Current EST times: 9am, 12pm, 3pm, 6pm, 9pm
-- Assuming EST (UTC-5): 2pm, 5pm, 8pm, 11pm UTC, 2am UTC next day

-- Peak Hour 1: 9:00 AM EST (2:00 PM UTC)
SELECT cron.schedule(
  'betting-odds-9am-est',
  '0 14 * * *',  -- 2:00 PM UTC = 9:00 AM EST
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Peak Hour 2: 12:00 PM EST (5:00 PM UTC)
SELECT cron.schedule(
  'betting-odds-12pm-est',
  '0 17 * * *',  -- 5:00 PM UTC = 12:00 PM EST
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Peak Hour 3: 3:00 PM EST (8:00 PM UTC)
SELECT cron.schedule(
  'betting-odds-3pm-est',
  '0 20 * * *',  -- 8:00 PM UTC = 3:00 PM EST
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Peak Hour 4: 6:00 PM EST (11:00 PM UTC)
SELECT cron.schedule(
  'betting-odds-6pm-est',
  '0 23 * * *',  -- 11:00 PM UTC = 6:00 PM EST
  $$SELECT invoke_fetch_betting_odds();$$
);

-- Peak Hour 5: 9:00 PM EST (2:00 AM UTC next day)
SELECT cron.schedule(
  'betting-odds-9pm-est',
  '0 2 * * *',  -- 2:00 AM UTC = 9:00 PM EST previous day
  $$SELECT invoke_fetch_betting_odds();$$
);

-- ============================================================================
-- UPDATE VIEW TO MONITOR ALL CRON JOBS
-- ============================================================================

DROP VIEW IF EXISTS cron_betting_odds_status;

CREATE OR REPLACE VIEW cron_betting_odds_status AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname LIKE 'betting-odds-%'
ORDER BY jobname;

COMMENT ON VIEW cron_betting_odds_status IS
  'View to check the status of all betting odds cron jobs (5 peak hour jobs)';

-- Grant access to the view
GRANT SELECT ON cron_betting_odds_status TO postgres, authenticated;

-- ============================================================================
-- LOG CRON JOB UPDATES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'SMART SCHEDULING CONFIGURED - API QUOTA OPTIMIZED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Sports: NFL, NCAAF, NBA only';
  RAISE NOTICE 'Schedule: 5 times per day at peak betting hours (EST):';
  RAISE NOTICE '  - 9:00 AM EST (pre-market analysis)';
  RAISE NOTICE '  - 12:00 PM EST (lunch hour)';
  RAISE NOTICE '  - 3:00 PM EST (afternoon)';
  RAISE NOTICE '  - 6:00 PM EST (evening games start)';
  RAISE NOTICE '  - 9:00 PM EST (night games)';
  RAISE NOTICE '';
  RAISE NOTICE 'API Usage Calculation:';
  RAISE NOTICE '  - 5 fetches/day × 3 sports = 15 API calls/day';
  RAISE NOTICE '  - Monthly: ~450 calls (leaves 50 call buffer)';
  RAISE NOTICE '  - Quota: 500 calls/month';
  RAISE NOTICE '';
  RAISE NOTICE 'Active Sports (based on current season):';
  RAISE NOTICE '  %', array_to_string(get_active_sports_by_season(), ', ');
  RAISE NOTICE '';
  RAISE NOTICE 'Season Coverage:';
  RAISE NOTICE '  - NFL: September - February';
  RAISE NOTICE '  - NCAAF: August - January';
  RAISE NOTICE '  - NBA: October - June';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual triggers:';
  RAISE NOTICE '  - All sports: SELECT trigger_fetch_betting_odds();';
  RAISE NOTICE '  - NFL: SELECT trigger_fetch_betting_odds(''americanfootball_nfl'');';
  RAISE NOTICE '  - NCAAF: SELECT trigger_fetch_betting_odds(''americanfootball_ncaaf'');';
  RAISE NOTICE '  - NBA: SELECT trigger_fetch_betting_odds(''basketball_nba'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring:';
  RAISE NOTICE '  - Job status: SELECT * FROM cron_betting_odds_status;';
  RAISE NOTICE '  - Data freshness: SELECT * FROM check_betting_odds_freshness(''americanfootball_nfl'', 60);';
  RAISE NOTICE '  - Fetch logs: SELECT * FROM betting_odds_fetch_log ORDER BY fetch_time DESC LIMIT 10;';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- TRIGGER IMMEDIATE FETCH FOR ALL SPORTS
-- ============================================================================

SELECT invoke_fetch_betting_odds();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
