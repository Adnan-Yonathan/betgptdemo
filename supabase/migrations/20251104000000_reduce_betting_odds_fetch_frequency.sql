-- ============================================================================
-- MIGRATION: Update Betting Odds Fetch Frequency to Every Hour
-- ============================================================================
-- Date: November 4, 2025
-- Purpose: Update cron job schedule to fetch every 1 hour to ensure data
--          is never more than 1 hour old (critical business requirement)
--
-- Rate Limit Analysis:
-- - The Odds API free tier: 500 calls/month
-- - Peak season active sports: 5 (NFL, NBA, NHL, MLS, MLB)
-- - NEW schedule: Every 1 hour = 24 cron runs/day
-- - API calls: 24 runs/day × 5 sports = 120 calls/day
-- - Monthly usage: 120 × 30 = 3,600 calls/month
--
-- ⚠️ IMPORTANT: This EXCEEDS free tier limits (7.2x over 500 calls/month)
-- REQUIRES: Paid API plan upgrade
-- - Recommended: $49/month for 50,000 calls (plenty of headroom)
-- - Link: https://the-odds-api.com/pricing
--
-- Trade-off: Data will be 0-60 minutes old (acceptable for betting)
-- ============================================================================

-- Remove existing job
SELECT cron.unschedule('auto-fetch-betting-odds-job') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job'
);

-- Schedule the job to run every hour (at the top of each hour)
-- Format: minute hour day month weekday
-- 0 * * * * = at minute 0 of every hour (00:00, 01:00, 02:00, etc.)
SELECT cron.schedule(
  'auto-fetch-betting-odds-job',           -- job name
  '0 * * * *',                             -- every hour (at :00)
  $$SELECT invoke_fetch_betting_odds();$$  -- command to run
);

COMMENT ON FUNCTION invoke_fetch_betting_odds IS
  'Cron job that runs every hour to fetch fresh betting odds for all active sports. Ensures data is never more than 1 hour old. Requires paid API plan.';

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
-- - API calls: 48/day → 240 API calls if 5 sports → 7,200/month (14.4x over limit!)
-- - User experience: Always very fresh data

-- NEW BEHAVIOR:
-- - Fetches every 1 hour (at :00 of each hour)
-- - Data freshness: 0-60 minutes old (acceptable)
-- - API calls: 24/day → 120 API calls if 5 sports → 3,600/month (7.2x over limit!)
-- - User experience:
--   * Data may be up to 1 hour old
--   * System will show warnings if >30 minutes old
--   * Chat guardrails will reject data >60 minutes old
--   * Overall: Good balance between freshness and cost

-- ⚠️ REQUIREMENT: Must upgrade to paid API plan
-- - Free tier: 500 calls/month (insufficient)
-- - Paid tier: $49/month for 50,000 calls (recommended)
-- - Alternative: Enterprise plans available for higher volume

-- ============================================================================
-- ROLLBACK PLAN
-- ============================================================================

-- To revert to every 30 minutes:
-- SELECT cron.unschedule('auto-fetch-betting-odds-job');
-- SELECT cron.schedule('auto-fetch-betting-odds-job', '*/30 * * * *', $$SELECT invoke_fetch_betting_odds();$$);

-- ============================================================================
-- NEXT STEPS
-- ============================================================================

-- 1. CRITICAL: Upgrade The Odds API plan to paid tier
--    Visit: https://the-odds-api.com/pricing
--    Select: $49/month plan (50,000 calls)
--    This is REQUIRED before applying this migration
--
-- 2. Apply this migration:
--    Run this SQL file in Supabase SQL Editor
--
-- 3. Verify the change:
--    SELECT * FROM cron.job WHERE jobname = 'auto-fetch-betting-odds-job';
--    Expected: schedule = '0 * * * *', active = true
--
-- 4. Update chat guardrails (already done in chat/index.ts):
--    - Reject threshold: 60 minutes (1 hour)
--    - Staleness warnings adjusted for hourly fetches
--
-- 5. Monitor API usage:
--    Check The Odds API dashboard weekly
--    Expected: ~3,600 calls/month (well under 50,000 limit)
--
-- 6. Test end-to-end:
--    - Trigger manual fetch: SELECT trigger_fetch_betting_odds()
--    - Verify data appears: SELECT COUNT(*) FROM betting_odds
--    - Test chat: Ask for betting recommendations

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
