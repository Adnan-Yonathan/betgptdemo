-- Migration: Remove Prediction System
-- Description: Drop all prediction-related tables, views, and functions to pivot to value-based odds comparison
-- Date: 2025-11-02

-- Drop views first (depend on tables)
DROP VIEW IF EXISTS high_probability_predictions CASCADE;
DROP VIEW IF EXISTS high_probability_props CASCADE;

-- Drop prediction feedback and logging tables
DROP TABLE IF EXISTS prediction_feedback CASCADE;
DROP TABLE IF EXISTS prediction_job_log CASCADE;

-- Drop prediction output tables
DROP TABLE IF EXISTS player_prop_predictions CASCADE;
DROP TABLE IF EXISTS model_predictions CASCADE;
DROP TABLE IF EXISTS game_predictions CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;

-- Drop player props table (prediction-related)
DROP TABLE IF EXISTS player_props CASCADE;

-- Drop prediction infrastructure tables
DROP TABLE IF EXISTS prediction_models CASCADE;
DROP TABLE IF EXISTS model_training_history CASCADE;
DROP TABLE IF EXISTS team_ratings CASCADE;

-- Note: smart_alerts table is kept as it may contain non-prediction alerts
-- If smart_alerts only contains prediction-based alerts, uncomment the line below:
-- DROP TABLE IF EXISTS smart_alerts CASCADE;

-- Drop Elo and prediction-related functions
DROP FUNCTION IF EXISTS calculate_elo_win_probability(numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS update_elo_rating(numeric, numeric, numeric) CASCADE;
DROP FUNCTION IF EXISTS predict_game_with_elo(text, text, text, numeric) CASCADE;
DROP FUNCTION IF EXISTS initialize_team_ratings(text, integer) CASCADE;
DROP FUNCTION IF EXISTS generate_predictions(uuid) CASCADE;
DROP FUNCTION IF EXISTS validate_predictions() CASCADE;

-- Remove daily predictions cron job
SELECT cron.unschedule('daily-ai-predictions') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-ai-predictions'
);

-- Clean up any remaining references (optional)
-- This ensures no orphaned data remains

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Prediction system successfully removed. The app now focuses on value-based odds comparison.';
END $$;
