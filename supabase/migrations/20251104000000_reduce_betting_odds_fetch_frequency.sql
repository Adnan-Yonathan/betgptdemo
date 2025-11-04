-- ============================================================================
-- MIGRATION: Reduce Betting Odds Fetch Frequency to Match API Rate Limits
-- ============================================================================
-- Date: November 4, 2025
-- Purpose: Update cron job schedule from every 30 minutes to every 2 hours
--          to stay within The Odds API free tier limits (500 calls/month)
--
-- Rate Limit Analysis:
-- - The Odds API free tier: 500 calls/month
-- - Available calls per day: 500 / 30 = ~16.67 calls/day
-- - Peak season active sports: 5 (NFL, NBA, NHL, MLS, MLB)
-- - OLD schedule: Every 30 min = 48 calls/day × 5 sports = 240 calls/day ❌
-- - NEW schedule: Every 2 hours = 12 calls/day × 5 sports = 60 calls/day
-- - Monthly usage: 60 × 30 = 1800 calls/month (still over!)
--
-- CORRECTION: The edge function is called once but makes 5 API calls internally
-- So the calculation should be:
-- - OLD: Every 30 min = 48 cron runs/day → 48 edge function calls → 240 API calls (if 5 sports)
-- - NEW: Every 2 hours = 12 cron runs/day → 12 edge function calls → 60 API calls (if 5 sports)
-- - Monthly: 60 calls/day × 30 days = 1800 calls/month (STILL OVER!)
--
-- BETTER SOLUTION: Every 3 hours
-- - Every 3 hours = 8 cron runs/day → 8 edge function calls → 40 API calls (if 5 sports)
-- - Monthly: 40 calls/day × 30 days = 1200 calls/month (STILL OVER!)
--
-- ACTUAL SOLUTION: We need to reduce frequency much more OR upgrade API plan
-- Let's use every 6 hours as a compromise:
-- - Every 6 hours = 4 cron runs/day → 4 edge function calls → 20 API calls (if 5 sports)
-- - Monthly: 20 calls/day × 30 days = 600 calls/month (slightly over but close)
--
-- For safety, let's use every 8 hours (3 times per day):
-- - Every 8 hours = 3 cron runs/day → 3 edge function calls → 15 API calls (if 5 sports)
-- - Monthly: 15 calls/day × 30 days = 450 calls/month ✅ (within limit!)
--
-- Trade-off: Data will be 0-8 hours old instead of 0-30 minutes old
-- This is acceptable since betting lines don't change drastically every 30 minutes
-- ============================================================================

-- Remove existing job
SELECT cron.unschedule('auto-fetch-betting-odds-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'
);

-- Schedule the job to run every 8 hours (at 00:00, 08:00, 16:00 UTC)
-- Format: minute hour day month weekday
-- 0 */8 * * * = at minute 0 past every 8th hour (00:00, 08:00, 16:00, 00:00...)
SELECT cron.schedule(
  'auto-fetch-betting-odds-job',           -- job name
  '0 */8 * * *',                           -- every 8 hours
  $$SELECT invoke_fetch_betting_odds();$$  -- command to run
);

COMMENT ON FUNCTION invoke_fetch_betting_odds IS
  'Cron job that runs every 8 hours (3x per day) to fetch fresh betting odds for all active sports. Updated frequency to comply with The Odds API free tier limits (500 calls/month).';

-- ============================================================================
-- VERIFICATION QUERY
-- ============================================================================

-- Run this to verify the new schedule:
-- SELECT jobname, schedule, active, jobid FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';

-- Expected result:
-- jobname: auto-fetch-betting-odds-job
-- schedule: 0 */8 * * *
-- active: true

-- ============================================================================
-- IMPACT ANALYSIS
-- ============================================================================

-- OLD BEHAVIOR:
-- - Fetches every 30 minutes
-- - Data freshness: 0-30 minutes old (excellent)
-- - API calls: 48/day → 240 API calls if 5 sports → 7200/month (14.4x over limit!)
-- - User experience: Always fresh data

-- NEW BEHAVIOR:
-- - Fetches every 8 hours (00:00, 08:00, 16:00 UTC)
-- - Data freshness: 0-8 hours old (acceptable)
-- - API calls: 3/day → 15 API calls if 5 sports → 450/month (within limit!)
-- - User experience:
--   * Data may be up to 8 hours old
--   * System will show "stale data" warnings if >2 hours old
--   * Chat guardrails will reject data >2 hours old
--   * Users may see "data unavailable" error more frequently

-- RECOMMENDATION FOR PRODUCTION:
-- Upgrade to paid API plan ($49/month for 50,000 calls) to restore every-30-min schedule

-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================

-- To revert to every 30 minutes (requires paid API plan):
-- SELECT cron.unschedule('auto-fetch-betting-odds-job');
-- SELECT cron.schedule('auto-fetch-betting-odds-job', '*/30 * * * *', $$SELECT invoke_fetch_betting_odds();$$);

-- ============================================================================
-- NEXT STEPS
-- ============================================================================

-- 1. Apply this migration:
--    Run this SQL file in Supabase SQL Editor
--
-- 2. Verify the change:
--    SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
--
-- 3. Monitor API usage:
--    Check The Odds API dashboard to ensure usage stays under 500/month
--
-- 4. Adjust chat guardrails:
--    Consider increasing stale data threshold from 2 hours to 6 hours
--    File: supabase/functions/chat/index.ts, line 1125
--    Change: if (dataAgeMinutes > 120) to if (dataAgeMinutes > 360)
--
-- 5. Consider upgrading API plan if users complain about stale data

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
