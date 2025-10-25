-- ============================================================================
-- HOURLY DATA REFRESH UPDATE
-- ============================================================================
-- This migration updates the betting odds cron job to run every hour instead
-- of 5x per day at peak hours. This ensures data is always fresh and updated.
-- ============================================================================

-- ============================================================================
-- REMOVE OLD PEAK HOURS CRON JOBS
-- ============================================================================

-- Remove all 5 peak hour jobs
SELECT cron.unschedule('betting-odds-9am-est') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'betting-odds-9am-est'
);

SELECT cron.unschedule('betting-odds-12pm-est') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'betting-odds-12pm-est'
);

SELECT cron.unschedule('betting-odds-3pm-est') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'betting-odds-3pm-est'
);

SELECT cron.unschedule('betting-odds-6pm-est') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'betting-odds-6pm-est'
);

SELECT cron.unschedule('betting-odds-9pm-est') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'betting-odds-9pm-est'
);

-- ============================================================================
-- CREATE NEW HOURLY CRON JOB FOR BETTING ODDS
-- ============================================================================

-- Schedule betting odds fetch to run every hour (at the top of each hour)
SELECT cron.schedule(
  'betting-odds-hourly',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT invoke_fetch_betting_odds();$$
);

-- ============================================================================
-- UPDATE SPORTS SCORES CRON TO ENSURE IT'S RUNNING
-- ============================================================================

-- Remove old job if it exists
SELECT cron.unschedule('espn-scores-auto-fetch') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'espn-scores-auto-fetch'
);

-- Re-schedule to run every hour (on the 5-minute mark to stagger with betting odds)
SELECT cron.schedule(
  'espn-scores-hourly',
  '5 * * * *',  -- Every hour at minute 5
  $$SELECT public.invoke_fetch_espn_scores();$$
);

-- ============================================================================
-- UPDATE AUTO MONITOR BETS TO ENSURE IT'S RUNNING
-- ============================================================================

-- Remove old job if it exists
SELECT cron.unschedule('auto-monitor-bets-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-monitor-bets-job'
);

-- Re-schedule to run every 10 minutes (to quickly settle bets)
SELECT cron.schedule(
  'auto-monitor-bets-every-10min',
  '*/10 * * * *',  -- Every 10 minutes
  $$SELECT invoke_auto_monitor_bets();$$
);

-- ============================================================================
-- CREATE VIEW TO MONITOR ALL DATA REFRESH CRON JOBS
-- ============================================================================

CREATE OR REPLACE VIEW public.data_refresh_cron_status AS
SELECT
  jobid,
  jobname,
  schedule,
  command,
  active,
  database
FROM cron.job
WHERE jobname IN (
  'betting-odds-hourly',
  'espn-scores-hourly',
  'auto-monitor-bets-every-10min',
  'daily-ai-predictions'
)
ORDER BY jobname;

COMMENT ON VIEW public.data_refresh_cron_status IS
  'View to check the status of all data refresh cron jobs';

-- Grant access to the view
GRANT SELECT ON public.data_refresh_cron_status TO postgres, authenticated;

-- ============================================================================
-- LOG CRON JOB UPDATES
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'HOURLY DATA REFRESH CONFIGURED';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Updated Cron Jobs:';
  RAISE NOTICE '  1. betting-odds-hourly: Runs every hour at :00';
  RAISE NOTICE '  2. espn-scores-hourly: Runs every hour at :05';
  RAISE NOTICE '  3. auto-monitor-bets-every-10min: Runs every 10 minutes';
  RAISE NOTICE '';
  RAISE NOTICE 'Data Refresh Schedule:';
  RAISE NOTICE '  - Betting Odds: Every hour (changed from 5x per day)';
  RAISE NOTICE '  - ESPN Scores: Every hour (all major sports)';
  RAISE NOTICE '  - Bet Settlement: Every 10 minutes';
  RAISE NOTICE '  - Daily Predictions: Once daily at 6:00 AM ET';
  RAISE NOTICE '';
  RAISE NOTICE 'This ensures:';
  RAISE NOTICE '  ✓ Fresh data is always available';
  RAISE NOTICE '  ✓ No 20-hour gaps in data refresh';
  RAISE NOTICE '  ✓ Hourly updates across all data sources';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitor status:';
  RAISE NOTICE '  SELECT * FROM data_refresh_cron_status;';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- TRIGGER IMMEDIATE DATA REFRESH
-- ============================================================================

-- Fetch ESPN scores immediately
SELECT public.invoke_fetch_espn_scores();

-- Fetch betting odds immediately
SELECT invoke_fetch_betting_odds();

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
