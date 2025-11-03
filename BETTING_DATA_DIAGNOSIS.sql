-- ============================================================================
-- BETTING DATA PIPELINE DIAGNOSTIC SCRIPT
-- ============================================================================
-- Purpose: Comprehensive diagnosis of betting odds data pipeline
-- Run this in Supabase SQL Editor to identify failure points
-- ============================================================================

-- ============================================================================
-- SECTION 1: CRON JOB STATUS
-- ============================================================================
\echo '=== SECTION 1: CRON JOB STATUS ==='

-- Check if the betting odds cron job exists and is active
SELECT
  '1.1 - Cron Job Configuration' as check_name,
  jobid,
  jobname,
  schedule,
  active,
  database
FROM cron.job
WHERE jobname LIKE '%betting%odds%';

-- Check last run status from pg_cron logs (if available)
-- Note: pg_cron may not have a job_run_details table in all versions
-- SELECT
--   '1.2 - Recent Cron Job Runs' as check_name,
--   jobid,
--   runid,
--   status,
--   start_time,
--   end_time,
--   return_message
-- FROM cron.job_run_details
-- WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname LIKE '%betting%odds%')
-- ORDER BY start_time DESC
-- LIMIT 10;

\echo ''
\echo '=== SECTION 2: FETCH LOGS ANALYSIS ==='

-- ============================================================================
-- SECTION 2: FETCH LOGS ANALYSIS
-- ============================================================================

-- Check if betting_odds_fetch_log table exists
SELECT
  '2.1 - Fetch Log Table Status' as check_name,
  COUNT(*) as total_log_entries,
  MAX(fetch_time) as last_fetch_time,
  EXTRACT(MINUTES FROM NOW() - MAX(fetch_time))::INTEGER as minutes_since_last_fetch
FROM betting_odds_fetch_log;

-- Recent fetch attempts (last 24 hours)
SELECT
  '2.2 - Recent Fetch Attempts (Last 24h)' as check_name,
  fetch_time,
  sports_fetched,
  success,
  events_count,
  odds_count,
  error_message,
  EXTRACT(MINUTES FROM NOW() - fetch_time)::INTEGER as minutes_ago
FROM betting_odds_fetch_log
WHERE fetch_time > NOW() - INTERVAL '24 hours'
ORDER BY fetch_time DESC
LIMIT 20;

-- Fetch success rate summary (last 7 days)
SELECT
  '2.3 - Fetch Success Rate (Last 7 Days)' as check_name,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE success = true) as successful,
  COUNT(*) FILTER (WHERE success = false) as failed,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / NULLIF(COUNT(*), 0), 2) as success_rate_pct
FROM betting_odds_fetch_log
WHERE fetch_time > NOW() - INTERVAL '7 days';

-- Most recent errors
SELECT
  '2.4 - Recent Errors (Last 48h)' as check_name,
  fetch_time,
  sports_fetched,
  error_message,
  EXTRACT(MINUTES FROM NOW() - fetch_time)::INTEGER as minutes_ago
FROM betting_odds_fetch_log
WHERE success = false
  AND fetch_time > NOW() - INTERVAL '48 hours'
ORDER BY fetch_time DESC
LIMIT 10;

\echo ''
\echo '=== SECTION 3: BETTING ODDS TABLE STATUS ==='

-- ============================================================================
-- SECTION 3: BETTING ODDS TABLE STATUS
-- ============================================================================

-- Check if betting_odds table has any data
SELECT
  '3.1 - Betting Odds Table Overview' as check_name,
  COUNT(*) as total_odds_entries,
  COUNT(DISTINCT event_id) as unique_events,
  COUNT(DISTINCT sport_key) as sports_covered,
  COUNT(DISTINCT bookmaker) as bookmakers_available,
  MIN(last_updated) as oldest_entry,
  MAX(last_updated) as newest_entry,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_since_newest
FROM betting_odds;

-- Data freshness per sport
SELECT
  '3.2 - Data Freshness by Sport' as check_name,
  sport_key,
  COUNT(DISTINCT event_id) as events,
  COUNT(DISTINCT bookmaker) as bookmakers,
  MAX(last_updated) as most_recent_update,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old,
  CASE
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 120 THEN '❌ CRITICAL (>2h)'
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 60 THEN '⚠️ STALE (>1h)'
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 30 THEN '⚠️ MODERATELY STALE (>30min)'
    WHEN EXTRACT(MINUTES FROM NOW() - MAX(last_updated)) > 15 THEN '✅ RECENT'
    ELSE '✅ FRESH'
  END as status
FROM betting_odds
WHERE commence_time >= CURRENT_DATE
GROUP BY sport_key
ORDER BY MAX(last_updated) DESC;

-- Upcoming games with odds (next 7 days)
SELECT
  '3.3 - Upcoming Games with Odds' as check_name,
  sport_key,
  home_team,
  away_team,
  commence_time,
  COUNT(DISTINCT bookmaker) as bookmakers_with_odds,
  MAX(last_updated) as odds_last_updated,
  EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
FROM betting_odds
WHERE commence_time BETWEEN NOW() AND NOW() + INTERVAL '7 days'
GROUP BY sport_key, home_team, away_team, commence_time
ORDER BY commence_time ASC
LIMIT 20;

-- Check for completely empty table
SELECT
  '3.4 - Empty Table Check' as check_name,
  CASE
    WHEN COUNT(*) = 0 THEN '❌ CRITICAL: betting_odds table is EMPTY'
    ELSE '✅ Table has ' || COUNT(*) || ' entries'
  END as status
FROM betting_odds;

\echo ''
\echo '=== SECTION 4: ACTIVE SPORTS DETECTION ==='

-- ============================================================================
-- SECTION 4: ACTIVE SPORTS DETECTION
-- ============================================================================

-- Check which sports should be active based on current season
SELECT
  '4.1 - Active Sports for Current Season' as check_name,
  *
FROM get_active_sports_by_season();

\echo ''
\echo '=== SECTION 5: DATA PIPELINE HEALTH SUMMARY ==='

-- ============================================================================
-- SECTION 5: DATA PIPELINE HEALTH SUMMARY
-- ============================================================================

WITH cron_status AS (
  SELECT
    jobname,
    active,
    schedule
  FROM cron.job
  WHERE jobname LIKE '%betting%odds%'
),
fetch_health AS (
  SELECT
    COUNT(*) as total_fetches,
    COUNT(*) FILTER (WHERE success = true) as successful_fetches,
    COUNT(*) FILTER (WHERE success = false) as failed_fetches,
    MAX(fetch_time) as last_fetch_time,
    EXTRACT(MINUTES FROM NOW() - MAX(fetch_time))::INTEGER as minutes_since_last_fetch
  FROM betting_odds_fetch_log
  WHERE fetch_time > NOW() - INTERVAL '24 hours'
),
data_health AS (
  SELECT
    COUNT(*) as total_odds,
    COUNT(DISTINCT event_id) as unique_events,
    MAX(last_updated) as newest_data,
    EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER as minutes_old
  FROM betting_odds
  WHERE commence_time >= CURRENT_DATE
)
SELECT
  '5.1 - OVERALL SYSTEM HEALTH' as check_name,
  CASE
    WHEN NOT EXISTS (SELECT 1 FROM cron_status WHERE active = true) THEN '❌ CRITICAL: Cron job not active'
    WHEN (SELECT minutes_since_last_fetch FROM fetch_health) > 60 THEN '❌ CRITICAL: No fetch in >1 hour'
    WHEN (SELECT minutes_old FROM data_health) > 120 THEN '❌ CRITICAL: Data >2 hours old'
    WHEN (SELECT failed_fetches FROM fetch_health) > (SELECT successful_fetches FROM fetch_health) THEN '⚠️ WARNING: More failures than successes'
    WHEN (SELECT minutes_old FROM data_health) > 60 THEN '⚠️ WARNING: Data >1 hour old'
    WHEN (SELECT total_odds FROM data_health) = 0 THEN '❌ CRITICAL: No betting odds data'
    ELSE '✅ HEALTHY'
  END as system_status,
  (SELECT active FROM cron_status LIMIT 1) as cron_active,
  (SELECT minutes_since_last_fetch FROM fetch_health) as minutes_since_fetch,
  (SELECT successful_fetches FROM fetch_health) as fetches_success_24h,
  (SELECT failed_fetches FROM fetch_health) as fetches_failed_24h,
  (SELECT unique_events FROM data_health) as events_available,
  (SELECT minutes_old FROM data_health) as data_age_minutes;

\echo ''
\echo '=== SECTION 6: RECOMMENDED ACTIONS ==='

-- ============================================================================
-- SECTION 6: RECOMMENDED ACTIONS
-- ============================================================================

WITH diagnostics AS (
  SELECT
    (SELECT active FROM cron.job WHERE jobname LIKE '%betting%odds%' LIMIT 1) as cron_active,
    (SELECT EXTRACT(MINUTES FROM NOW() - MAX(fetch_time))::INTEGER
     FROM betting_odds_fetch_log) as minutes_since_fetch,
    (SELECT COUNT(*) FILTER (WHERE success = false AND fetch_time > NOW() - INTERVAL '24 hours')
     FROM betting_odds_fetch_log) as recent_failures,
    (SELECT COUNT(*) FROM betting_odds WHERE commence_time >= CURRENT_DATE) as total_odds,
    (SELECT EXTRACT(MINUTES FROM NOW() - MAX(last_updated))::INTEGER
     FROM betting_odds WHERE commence_time >= CURRENT_DATE) as data_age
)
SELECT
  '6.1 - RECOMMENDED ACTIONS' as check_name,
  CASE
    WHEN cron_active IS NULL OR cron_active = false THEN
      '1. CRITICAL: Enable cron job with: SELECT cron.schedule(...)'
    WHEN minutes_since_fetch IS NULL OR minutes_since_fetch > 60 THEN
      '2. CRITICAL: Trigger manual fetch with: SELECT trigger_fetch_betting_odds();'
    WHEN recent_failures > 5 THEN
      '3. ERROR: Check error_message in betting_odds_fetch_log - likely API key issue'
    WHEN total_odds = 0 THEN
      '4. CRITICAL: Database is empty - check if API keys are configured in Supabase secrets'
    WHEN data_age > 120 THEN
      '5. WARNING: Data is stale - investigate why cron job is not updating data'
    ELSE
      '✅ System appears healthy - check fetch logs for intermittent issues'
  END as action_needed
FROM diagnostics;

\echo ''
\echo '=== SECTION 7: MANUAL TRIGGER TEST ==='
\echo 'To manually test the fetch pipeline, run:'
\echo 'SELECT trigger_fetch_betting_odds();'
\echo ''
\echo 'To test a specific sport:'
\echo 'SELECT trigger_fetch_betting_odds(''americanfootball_nfl'');'

-- ============================================================================
-- END OF DIAGNOSTIC SCRIPT
-- ============================================================================
