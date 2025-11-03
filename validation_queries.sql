-- Validation Queries for Prediction Model Removal
-- Run these queries to verify the prediction system has been completely removed

-- ============================================
-- 1. CHECK FOR PREDICTION TABLES (should return 0 rows)
-- ============================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%prediction%' OR
    table_name LIKE '%model%' OR
    table_name = 'team_ratings' OR
    table_name = 'player_props' OR
    table_name = 'player_prop_predictions' OR
    table_name = 'game_predictions'
  )
ORDER BY table_name;

-- Expected: 0 rows (all prediction tables should be dropped)

-- ============================================
-- 2. CHECK FOR PREDICTION FUNCTIONS (should return 0 rows)
-- ============================================
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%prediction%' OR
    routine_name LIKE '%elo%' OR
    routine_name = 'validate_predictions' OR
    routine_name = 'generate_predictions' OR
    routine_name = 'predict_game_with_elo' OR
    routine_name = 'initialize_team_ratings' OR
    routine_name = 'update_elo_rating' OR
    routine_name = 'calculate_elo_win_probability'
  )
ORDER BY routine_name;

-- Expected: 0 rows (all prediction functions should be dropped)

-- ============================================
-- 3. CHECK CRON JOBS (should not have daily-ai-predictions)
-- ============================================
SELECT jobname, schedule, command
FROM cron.job
WHERE jobname LIKE '%prediction%';

-- Expected: 0 rows (prediction cron job should be removed)

-- ============================================
-- 4. VERIFY VALUE-BASED TABLES EXIST (should have data)
-- ============================================
SELECT 'betting_odds' as table_name, COUNT(*) as row_count, MAX(last_updated) as latest_update
FROM betting_odds
UNION ALL
SELECT 'odds_discrepancies', COUNT(*), MAX(calculated_at)
FROM odds_discrepancies
UNION ALL
SELECT 'sharp_money_signals', COUNT(*), MAX(detected_at)
FROM sharp_money_signals
UNION ALL
SELECT 'line_movement_history', COUNT(*), MAX(recorded_at)
FROM line_movement_history
UNION ALL
SELECT 'opening_closing_lines', COUNT(*), MAX(updated_at)
FROM opening_closing_lines;

-- Expected: All tables should exist with data (if odds have been fetched)

-- ============================================
-- 5. VERIFY ODDS DATA FRESHNESS (should be recent)
-- ============================================
SELECT
  sport_key,
  COUNT(*) as total_odds,
  MAX(last_updated) as latest_update,
  EXTRACT(EPOCH FROM (NOW() - MAX(last_updated)))/60 as minutes_since_update
FROM betting_odds
GROUP BY sport_key
ORDER BY latest_update DESC;

-- Expected: latest_update should be within last 30-60 minutes

-- ============================================
-- 6. CHECK DISCREPANCY ANALYSIS (should have recent data)
-- ============================================
SELECT
  sport,
  COUNT(*) as discrepancies_found,
  MAX(calculated_at) as latest_calculation,
  AVG(probability_difference * 100) as avg_probability_diff_percent,
  MAX(probability_difference * 100) as max_probability_diff_percent
FROM odds_discrepancies
WHERE calculated_at > NOW() - INTERVAL '24 hours'
GROUP BY sport
ORDER BY discrepancies_found DESC;

-- Expected: Recent discrepancies if analyze-odds-discrepancies has run

-- ============================================
-- 7. CHECK SHARP MONEY SIGNALS (should have recent data)
-- ============================================
SELECT
  signal_type,
  COUNT(*) as signals_detected,
  MAX(detected_at) as latest_signal
FROM sharp_money_signals
WHERE detected_at > NOW() - INTERVAL '24 hours'
GROUP BY signal_type
ORDER BY signals_detected DESC;

-- Expected: Signals if detect-sharp-money has run recently

-- ============================================
-- 8. VERIFY SMART ALERTS (should only have value-based alerts)
-- ============================================
SELECT
  alert_type,
  COUNT(*) as alert_count
FROM smart_alerts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY alert_type
ORDER BY alert_count DESC;

-- Expected: Only line_movement, steam_move, best_line, injury alerts
-- Should NOT have: high_probability, closing_line, ev_discrepancy (prediction-based)

-- ============================================
-- 9. CHECK FOR ORPHANED DATA
-- ============================================
-- Check if any tables reference non-existent prediction tables
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name IN (
    'model_predictions',
    'player_prop_predictions',
    'prediction_models',
    'team_ratings',
    'game_predictions',
    'predictions'
  );

-- Expected: 0 rows (no foreign keys should reference deleted tables)

-- ============================================
-- SUMMARY VALIDATION REPORT
-- ============================================
SELECT
  'Validation Complete' as status,
  'All prediction infrastructure should be removed' as message,
  'Value-based features should be operational' as next_step;
