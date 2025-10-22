-- ============================================================================
-- TEST SCRIPT FOR ATOMIC BET SETTLEMENT
-- ============================================================================
-- This script verifies that the atomic bet settlement function works correctly
-- Run this after deploying the migration to verify everything is working
-- ============================================================================

-- Step 1: Verify the function exists
SELECT
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('settle_bet_atomic', 'settle_pending_bets_batch', 'sync_user_betting_profile')
ORDER BY routine_name;

-- Expected output: 3 functions (settle_bet_atomic, settle_pending_bets_batch, sync_user_betting_profile)

-- Step 2: Check for any pending bets that should be settled
SELECT
  b.id,
  b.user_id,
  b.amount,
  b.odds,
  b.outcome,
  b.team_bet_on,
  b.event_id,
  s.game_status,
  s.home_team,
  s.away_team,
  s.home_score,
  s.away_score
FROM bets b
LEFT JOIN sports_scores s ON b.event_id = s.event_id
WHERE b.outcome = 'pending'
  AND b.event_id IS NOT NULL
ORDER BY b.created_at DESC
LIMIT 10;

-- Step 3: Test atomic settlement with a sample bet (if any exist)
-- NOTE: Replace 'sample-bet-id' with an actual bet ID from step 2
-- Uncomment and run only if you have a pending bet to test

/*
SELECT * FROM settle_bet_atomic(
  'sample-bet-id'::UUID,    -- Replace with actual bet ID
  'win',                     -- or 'loss' or 'push'
  250.00,                    -- actual_return (e.g., $250 for a winning $100 bet at +150)
  -110,                      -- closing_line (optional)
  2.5                        -- clv (optional, e.g., +2.5%)
);
*/

-- Step 4: Verify CRM stats are updating
SELECT
  id,
  bankroll,
  total_bets_placed,
  total_bets_won,
  total_bets_lost,
  win_rate,
  roi,
  total_profit,
  current_streak,
  last_sync_at
FROM profiles
WHERE total_bets_placed > 0
ORDER BY last_sync_at DESC
LIMIT 5;

-- Step 5: Check recent bet settlements
SELECT
  id,
  user_id,
  amount,
  outcome,
  actual_return,
  settled_at,
  clv
FROM bets
WHERE outcome IN ('win', 'loss', 'push')
  AND settled_at IS NOT NULL
ORDER BY settled_at DESC
LIMIT 10;

-- Step 6: Verify bankroll changes match bet outcomes
-- This query shows if bankroll changes are consistent with bet results
WITH bet_summary AS (
  SELECT
    user_id,
    COUNT(*) FILTER (WHERE outcome = 'win') as wins,
    COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
    COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
    COALESCE(SUM(actual_return - amount) FILTER (WHERE outcome = 'win'), 0) as win_profit,
    COALESCE(SUM(amount) FILTER (WHERE outcome = 'loss'), 0) as loss_amount,
    COALESCE(SUM(actual_return - amount) FILTER (WHERE outcome = 'win'), 0) -
    COALESCE(SUM(amount) FILTER (WHERE outcome = 'loss'), 0) as net_profit
  FROM bets
  WHERE outcome IN ('win', 'loss', 'push')
  GROUP BY user_id
)
SELECT
  p.id as user_id,
  p.initial_bankroll,
  p.bankroll as current_bankroll,
  p.bankroll - p.initial_bankroll as bankroll_change,
  bs.net_profit as calculated_profit,
  (p.bankroll - p.initial_bankroll) - bs.net_profit as discrepancy,
  bs.wins,
  bs.losses,
  bs.pushes,
  CASE
    WHEN ABS((p.bankroll - p.initial_bankroll) - bs.net_profit) < 0.01 THEN '✓ OK'
    ELSE '✗ MISMATCH'
  END as status
FROM profiles p
JOIN bet_summary bs ON p.id = bs.user_id
ORDER BY ABS((p.bankroll - p.initial_bankroll) - bs.net_profit) DESC;

-- Expected: All rows should show '✓ OK' status (discrepancy < 0.01)

-- Step 7: Monitor cron job status
SELECT
  jobname,
  schedule,
  active,
  command
FROM cron.job
WHERE jobname = 'auto-monitor-bets-job';

-- Expected: One row showing active job running every 10 minutes

-- Step 8: Check recent cron job runs (if pg_cron logging is enabled)
SELECT
  jobid,
  runid,
  job_pid,
  database,
  username,
  command,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'auto-monitor-bets-job')
ORDER BY start_time DESC
LIMIT 5;

-- ============================================================================
-- MANUAL TEST SCENARIOS
-- ============================================================================

-- Scenario 1: Test settling a winning bet
-- 1. Create a test bet
-- 2. Create a completed game in sports_scores
-- 3. Run settle_bet_atomic
-- 4. Verify bankroll increased by profit
-- 5. Verify CRM stats updated

-- Scenario 2: Test settling a losing bet
-- Same as above but verify bankroll decreased by stake

-- Scenario 3: Test settling a push
-- Same as above but verify bankroll unchanged

-- Scenario 4: Test concurrent settlement (should be blocked by row lock)
-- Attempt to settle the same bet twice simultaneously
-- Second attempt should wait for first to complete

-- Scenario 5: Test error handling
-- Try to settle non-existent bet - should return error
-- Try to settle already-settled bet - should return error

-- ============================================================================
-- CLEANUP (run only if needed for testing)
-- ============================================================================

/*
-- Reset test data (CAUTION: This will delete data!)
DELETE FROM bets WHERE description LIKE '%TEST%';
UPDATE profiles SET
  bankroll = initial_bankroll,
  total_bets_placed = 0,
  total_bets_won = 0,
  total_bets_lost = 0,
  total_profit = 0
WHERE id = 'test-user-id'::UUID;
*/
