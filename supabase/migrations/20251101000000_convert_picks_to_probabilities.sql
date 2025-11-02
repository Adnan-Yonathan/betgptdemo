-- Migration: Convert Pick Recommendations to Probability Display
-- This migration transforms the app from recommending picks to showing
-- percentage chances of outcomes.

-- ============================================================================
-- PHASE 1: Add new probability columns to model_predictions
-- ============================================================================

-- Add explicit probability breakdowns for spreads and totals
ALTER TABLE model_predictions
  ADD COLUMN IF NOT EXISTS spread_cover_probability_home DECIMAL CHECK (spread_cover_probability_home >= 0 AND spread_cover_probability_home <= 1),
  ADD COLUMN IF NOT EXISTS spread_cover_probability_away DECIMAL CHECK (spread_cover_probability_away >= 0 AND spread_cover_probability_away <= 1),
  ADD COLUMN IF NOT EXISTS total_over_probability DECIMAL CHECK (total_over_probability >= 0 AND total_over_probability <= 1),
  ADD COLUMN IF NOT EXISTS total_under_probability DECIMAL CHECK (total_under_probability >= 0 AND total_under_probability <= 1);

-- Add comments to explain the new columns
COMMENT ON COLUMN model_predictions.spread_cover_probability_home IS 'Probability (0-1) that the home team covers the spread';
COMMENT ON COLUMN model_predictions.spread_cover_probability_away IS 'Probability (0-1) that the away team covers the spread';
COMMENT ON COLUMN model_predictions.total_over_probability IS 'Probability (0-1) that the game total goes OVER';
COMMENT ON COLUMN model_predictions.total_under_probability IS 'Probability (0-1) that the game total goes UNDER';

-- ============================================================================
-- PHASE 2: Add new probability columns to player_prop_predictions
-- ============================================================================

-- Add explicit probability breakdowns for player props
ALTER TABLE player_prop_predictions
  ADD COLUMN IF NOT EXISTS over_probability DECIMAL CHECK (over_probability >= 0 AND over_probability <= 1),
  ADD COLUMN IF NOT EXISTS under_probability DECIMAL CHECK (under_probability >= 0 AND under_probability <= 1);

-- Add comments
COMMENT ON COLUMN player_prop_predictions.over_probability IS 'Probability (0-1) that the player goes OVER the line';
COMMENT ON COLUMN player_prop_predictions.under_probability IS 'Probability (0-1) that the player goes UNDER the line';

-- ============================================================================
-- PHASE 3: Backfill probability data for existing predictions
-- ============================================================================

-- For model_predictions, calculate probabilities from existing data
-- If we have home_win_probability, we can use it for spread cover probability as an approximation
UPDATE model_predictions
SET
  spread_cover_probability_home = CASE
    WHEN home_win_probability IS NOT NULL THEN home_win_probability
    WHEN predicted_spread IS NOT NULL AND predicted_spread > 0 THEN 0.65
    WHEN predicted_spread IS NOT NULL AND predicted_spread < 0 THEN 0.35
    ELSE 0.50
  END,
  spread_cover_probability_away = CASE
    WHEN away_win_probability IS NOT NULL THEN away_win_probability
    WHEN predicted_spread IS NOT NULL AND predicted_spread < 0 THEN 0.65
    WHEN predicted_spread IS NOT NULL AND predicted_spread > 0 THEN 0.35
    ELSE 0.50
  END,
  total_over_probability = CASE
    WHEN edge_side = 'over' AND edge_percentage > 5 THEN 0.60
    WHEN edge_side = 'over' AND edge_percentage > 0 THEN 0.55
    WHEN edge_side = 'under' AND edge_percentage > 5 THEN 0.40
    WHEN edge_side = 'under' AND edge_percentage > 0 THEN 0.45
    ELSE 0.50
  END,
  total_under_probability = CASE
    WHEN edge_side = 'under' AND edge_percentage > 5 THEN 0.60
    WHEN edge_side = 'under' AND edge_percentage > 0 THEN 0.55
    WHEN edge_side = 'over' AND edge_percentage > 5 THEN 0.40
    WHEN edge_side = 'over' AND edge_percentage > 0 THEN 0.45
    ELSE 0.50
  END
WHERE spread_cover_probability_home IS NULL
   OR spread_cover_probability_away IS NULL
   OR total_over_probability IS NULL
   OR total_under_probability IS NULL;

-- For player_prop_predictions, calculate from existing edge data
UPDATE player_prop_predictions
SET
  over_probability = CASE
    WHEN recommended_side = 'over' AND edge_percentage > 10 THEN 0.65
    WHEN recommended_side = 'over' AND edge_percentage > 5 THEN 0.58
    WHEN recommended_side = 'over' AND edge_percentage > 0 THEN 0.52
    WHEN recommended_side = 'under' AND edge_percentage > 10 THEN 0.35
    WHEN recommended_side = 'under' AND edge_percentage > 5 THEN 0.42
    WHEN recommended_side = 'under' AND edge_percentage > 0 THEN 0.48
    WHEN predicted_value > market_line THEN 0.55
    ELSE 0.50
  END,
  under_probability = CASE
    WHEN recommended_side = 'under' AND edge_percentage > 10 THEN 0.65
    WHEN recommended_side = 'under' AND edge_percentage > 5 THEN 0.58
    WHEN recommended_side = 'under' AND edge_percentage > 0 THEN 0.52
    WHEN recommended_side = 'over' AND edge_percentage > 10 THEN 0.35
    WHEN recommended_side = 'over' AND edge_percentage > 5 THEN 0.42
    WHEN recommended_side = 'over' AND edge_percentage > 0 THEN 0.48
    WHEN predicted_value < market_line THEN 0.55
    ELSE 0.50
  END
WHERE over_probability IS NULL
   OR under_probability IS NULL;

-- ============================================================================
-- PHASE 4: Remove recommendation-related columns (after backfill complete)
-- ============================================================================

-- Note: We're keeping edge_percentage and edge_side columns for now
-- They will be removed after the prediction functions are updated
-- This allows for a safe migration without breaking existing functionality

-- Create indexes for the new probability columns
CREATE INDEX IF NOT EXISTS idx_predictions_spread_probability_home
  ON model_predictions(spread_cover_probability_home DESC)
  WHERE spread_cover_probability_home > 0.60;

CREATE INDEX IF NOT EXISTS idx_predictions_total_probability
  ON model_predictions(total_over_probability DESC)
  WHERE total_over_probability > 0.60 OR total_under_probability > 0.60;

CREATE INDEX IF NOT EXISTS idx_prop_predictions_probability
  ON player_prop_predictions(over_probability DESC)
  WHERE over_probability > 0.60 OR under_probability > 0.60;

-- ============================================================================
-- PHASE 5: Update table comments
-- ============================================================================

COMMENT ON TABLE model_predictions IS 'Game predictions from ML models with probability breakdowns for all outcomes';
COMMENT ON TABLE player_prop_predictions IS 'ML predictions for player props with probability percentages for over/under outcomes';

-- ============================================================================
-- PHASE 6: Create helper view for probability display
-- ============================================================================

-- Create a view that makes it easy to query high-probability scenarios
CREATE OR REPLACE VIEW high_probability_predictions AS
SELECT
  mp.id,
  mp.event_id,
  mp.sport,
  mp.league,
  mp.home_team,
  mp.away_team,
  mp.game_date,
  mp.prediction_type,

  -- Spread probabilities
  mp.predicted_spread,
  mp.spread_cover_probability_home,
  mp.spread_cover_probability_away,
  CASE
    WHEN mp.spread_cover_probability_home > mp.spread_cover_probability_away
    THEN 'home'
    ELSE 'away'
  END as higher_probability_spread_side,
  GREATEST(mp.spread_cover_probability_home, mp.spread_cover_probability_away) as max_spread_probability,

  -- Total probabilities
  mp.predicted_total,
  mp.total_over_probability,
  mp.total_under_probability,
  CASE
    WHEN mp.total_over_probability > mp.total_under_probability
    THEN 'over'
    ELSE 'under'
  END as higher_probability_total_side,
  GREATEST(mp.total_over_probability, mp.total_under_probability) as max_total_probability,

  -- Moneyline probabilities
  mp.home_win_probability,
  mp.away_win_probability,

  -- Model info
  mp.confidence_score,
  pm.model_name,
  pm.accuracy as model_accuracy,

  mp.created_at
FROM model_predictions mp
JOIN prediction_models pm ON mp.model_id = pm.id
WHERE
  pm.is_active = TRUE
  AND mp.game_completed = FALSE
  AND (
    mp.spread_cover_probability_home > 0.60
    OR mp.spread_cover_probability_away > 0.60
    OR mp.total_over_probability > 0.60
    OR mp.total_under_probability > 0.60
    OR mp.home_win_probability > 0.60
    OR mp.away_win_probability > 0.60
  )
ORDER BY
  GREATEST(
    COALESCE(mp.spread_cover_probability_home, 0),
    COALESCE(mp.spread_cover_probability_away, 0),
    COALESCE(mp.total_over_probability, 0),
    COALESCE(mp.total_under_probability, 0),
    COALESCE(mp.home_win_probability, 0),
    COALESCE(mp.away_win_probability, 0)
  ) DESC;

COMMENT ON VIEW high_probability_predictions IS 'Shows predictions with high probability (>60%) for any outcome, useful for identifying strong scenarios';

-- Create similar view for player props
CREATE OR REPLACE VIEW high_probability_props AS
SELECT
  pp.id,
  pp.event_id,
  pp.player_name,
  pp.prop_type,
  pp.predicted_value,
  pp.market_line,
  pp.over_probability,
  pp.under_probability,
  CASE
    WHEN pp.over_probability > pp.under_probability
    THEN 'over'
    ELSE 'under'
  END as higher_probability_side,
  GREATEST(pp.over_probability, pp.under_probability) as max_probability,
  pp.confidence_score,
  pp.season_average,
  pp.last_5_games_average,
  pp.created_at
FROM player_prop_predictions pp
WHERE
  pp.over_probability > 0.55
  OR pp.under_probability > 0.55
ORDER BY
  GREATEST(pp.over_probability, pp.under_probability) DESC;

COMMENT ON VIEW high_probability_props IS 'Shows player prop predictions with probability >55% for over or under';

-- ============================================================================
-- Migration Complete
-- ============================================================================

-- This migration adds probability columns while keeping existing recommendation
-- columns intact. The next step is to update the prediction functions to
-- populate these new probability columns. After all functions are updated,
-- a follow-up migration will remove the deprecated edge_side and edge_percentage
-- columns.
