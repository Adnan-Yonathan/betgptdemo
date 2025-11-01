-- Phase 4: Advanced Statistical Models & EV Analysis
-- Part 2: Team Ratings & Game Predictions
-- Implements Elo ratings and statistical models for win probability estimation

CREATE TABLE IF NOT EXISTS public.team_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_name TEXT NOT NULL,
  league TEXT NOT NULL,

  -- Elo Rating System
  elo_rating NUMERIC DEFAULT 1500, -- Standard starting Elo
  elo_peak NUMERIC DEFAULT 1500, -- Highest Elo this season
  elo_low NUMERIC DEFAULT 1500, -- Lowest Elo this season

  -- Offensive/Defensive Ratings (points per 100 possessions)
  offensive_rating NUMERIC,
  defensive_rating NUMERIC,
  net_rating NUMERIC, -- offensive - defensive

  -- Pace and efficiency
  pace_rating NUMERIC, -- Possessions per game
  true_shooting_pct NUMERIC, -- Shooting efficiency
  effective_fg_pct NUMERIC,

  -- Recent form (last 10 games)
  last_10_record TEXT, -- e.g., "7-3"
  last_10_wins INTEGER DEFAULT 0,
  last_10_losses INTEGER DEFAULT 0,

  -- Home/Away splits
  home_rating_adjustment NUMERIC DEFAULT 0, -- Elo adjustment for home games
  away_rating_adjustment NUMERIC DEFAULT 0,

  -- Rest and fatigue
  avg_rest_days NUMERIC DEFAULT 2.0,
  back_to_back_performance_impact NUMERIC DEFAULT -50, -- Elo penalty on back-to-backs

  -- Season stats
  season_wins INTEGER DEFAULT 0,
  season_losses INTEGER DEFAULT 0,
  season_win_pct NUMERIC DEFAULT 0.0,

  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT now(),
  season_year TEXT,

  UNIQUE(team_name, league, season_year)
);

-- Enable RLS
ALTER TABLE public.team_ratings ENABLE ROW LEVEL SECURITY;

-- RLS Policy (public read)
CREATE POLICY "Anyone can view team ratings"
ON public.team_ratings
FOR SELECT
USING (true);

-- Create indexes
CREATE INDEX idx_team_ratings_team_league ON public.team_ratings(team_name, league);
CREATE INDEX idx_team_ratings_elo ON public.team_ratings(elo_rating DESC);
CREATE INDEX idx_team_ratings_updated ON public.team_ratings(last_updated DESC);

-- Table for storing game predictions
CREATE TABLE IF NOT EXISTS public.game_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,

  -- Elo-based prediction
  home_elo_rating NUMERIC,
  away_elo_rating NUMERIC,
  elo_win_probability NUMERIC CHECK (elo_win_probability BETWEEN 0 AND 1), -- Home team win prob

  -- Regression model prediction
  regression_win_probability NUMERIC CHECK (regression_win_probability BETWEEN 0 AND 1),

  -- Market-based prediction
  market_win_probability NUMERIC CHECK (market_win_probability BETWEEN 0 AND 1),

  -- Ensemble prediction (weighted average of all models)
  ensemble_win_probability NUMERIC CHECK (ensemble_win_probability BETWEEN 0 AND 1),
  ensemble_confidence NUMERIC DEFAULT 0.5 CHECK (ensemble_confidence BETWEEN 0 AND 1),

  -- Confidence intervals (90% confidence by default)
  confidence_lower NUMERIC CHECK (confidence_lower BETWEEN 0 AND 1),
  confidence_upper NUMERIC CHECK (confidence_upper BETWEEN 0 AND 1),

  -- Predicted scores
  predicted_home_score NUMERIC,
  predicted_away_score NUMERIC,
  predicted_total NUMERIC,
  predicted_margin NUMERIC, -- Home team margin

  -- Key factors
  home_court_advantage NUMERIC DEFAULT 3.0, -- Points
  rest_advantage TEXT, -- 'home', 'away', 'neutral'
  injury_impact TEXT, -- 'major_home', 'minor_home', 'neutral', 'minor_away', 'major_away'

  -- Market comparison
  market_spread NUMERIC,
  market_total NUMERIC,
  model_edge_spread NUMERIC, -- Our predicted spread - market spread
  model_edge_total NUMERIC, -- Our predicted total - market total

  -- Actual result (filled after game)
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  actual_home_won BOOLEAN,
  prediction_correct BOOLEAN,

  -- Model accuracy tracking
  elo_model_error NUMERIC, -- |predicted_prob - actual_result|
  ensemble_model_error NUMERIC,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policy (public read)
CREATE POLICY "Anyone can view game predictions"
ON public.game_predictions
FOR SELECT
USING (true);

-- Create indexes
CREATE INDEX idx_game_predictions_game_id ON public.game_predictions(game_id);
CREATE INDEX idx_game_predictions_date ON public.game_predictions(game_date DESC);
CREATE INDEX idx_game_predictions_league ON public.game_predictions(league);
CREATE INDEX idx_game_predictions_edge ON public.game_predictions(ABS(model_edge_spread) DESC);

-- Function to calculate Elo win probability
CREATE OR REPLACE FUNCTION public.calculate_elo_win_probability(
  p_team_a_elo NUMERIC,
  p_team_b_elo NUMERIC,
  p_home_advantage NUMERIC DEFAULT 100 -- Elo points for home court
)
RETURNS NUMERIC AS $$
DECLARE
  elo_diff NUMERIC;
  win_prob NUMERIC;
BEGIN
  -- Adjust team A rating for home advantage if applicable
  elo_diff := p_team_a_elo + p_home_advantage - p_team_b_elo;

  -- Standard Elo formula: 1 / (1 + 10^((Elo_B - Elo_A) / 400))
  win_prob := 1.0 / (1.0 + POWER(10, -elo_diff / 400.0));

  RETURN ROUND(win_prob, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update Elo ratings after a game
CREATE OR REPLACE FUNCTION public.update_elo_rating(
  p_current_elo NUMERIC,
  p_opponent_elo NUMERIC,
  p_actual_result NUMERIC, -- 1 for win, 0.5 for tie, 0 for loss
  p_k_factor NUMERIC DEFAULT 32 -- How much ratings change (higher = more volatile)
)
RETURNS NUMERIC AS $$
DECLARE
  expected_result NUMERIC;
  new_elo NUMERIC;
BEGIN
  -- Calculate expected result
  expected_result := calculate_elo_win_probability(p_current_elo, p_opponent_elo, 0);

  -- Update Elo: New = Old + K * (Actual - Expected)
  new_elo := p_current_elo + p_k_factor * (p_actual_result - expected_result);

  RETURN ROUND(new_elo, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to predict game outcome using Elo
CREATE OR REPLACE FUNCTION public.predict_game_with_elo(
  p_home_team TEXT,
  p_away_team TEXT,
  p_league TEXT,
  p_home_advantage_points NUMERIC DEFAULT 100
)
RETURNS JSONB AS $$
DECLARE
  v_home_elo NUMERIC;
  v_away_elo NUMERIC;
  v_home_win_prob NUMERIC;
  v_away_win_prob NUMERIC;
  v_predicted_margin NUMERIC;
BEGIN
  -- Get current Elo ratings
  SELECT elo_rating INTO v_home_elo
  FROM public.team_ratings
  WHERE team_name = p_home_team AND league = p_league
  ORDER BY last_updated DESC
  LIMIT 1;

  SELECT elo_rating INTO v_away_elo
  FROM public.team_ratings
  WHERE team_name = p_away_team AND league = p_league
  ORDER BY last_updated DESC
  LIMIT 1;

  -- Default to 1500 if no rating found
  v_home_elo := COALESCE(v_home_elo, 1500);
  v_away_elo := COALESCE(v_away_elo, 1500);

  -- Calculate win probability
  v_home_win_prob := calculate_elo_win_probability(v_home_elo, v_away_elo, p_home_advantage_points);
  v_away_win_prob := 1.0 - v_home_win_prob;

  -- Estimate point margin (roughly 25 Elo points = 1 point in score)
  v_predicted_margin := (v_home_elo - v_away_elo + p_home_advantage_points) / 25.0;

  RETURN jsonb_build_object(
    'home_team', p_home_team,
    'away_team', p_away_team,
    'home_elo', v_home_elo,
    'away_elo', v_away_elo,
    'home_win_probability', ROUND(v_home_win_prob, 4),
    'away_win_probability', ROUND(v_away_win_prob, 4),
    'predicted_margin', ROUND(v_predicted_margin, 1),
    'elo_difference', v_home_elo - v_away_elo
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize/update team ratings from recent games
CREATE OR REPLACE FUNCTION public.initialize_team_ratings(
  p_league TEXT,
  p_season_year TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  team_record RECORD;
  teams_initialized INTEGER := 0;
  current_season TEXT;
BEGIN
  current_season := COALESCE(p_season_year, TO_CHAR(NOW(), 'YYYY'));

  -- Get all teams from recent games
  FOR team_record IN
    SELECT DISTINCT
      COALESCE(home_team, away_team) as team_name,
      p_league as league
    FROM public.sports_scores
    WHERE league = p_league
      AND game_date > NOW() - INTERVAL '365 days'
  LOOP
    -- Insert or update team rating
    INSERT INTO public.team_ratings (
      team_name,
      league,
      season_year,
      elo_rating,
      last_updated
    ) VALUES (
      team_record.team_name,
      team_record.league,
      current_season,
      1500, -- Starting Elo
      NOW()
    )
    ON CONFLICT (team_name, league, season_year)
    DO UPDATE SET
      last_updated = NOW();

    teams_initialized := teams_initialized + 1;
  END LOOP;

  RETURN teams_initialized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.team_ratings TO authenticated, anon;
GRANT SELECT ON public.game_predictions TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_elo_win_probability(NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_elo_rating(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.predict_game_with_elo(TEXT, TEXT, TEXT, NUMERIC) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.initialize_team_ratings(TEXT, TEXT) TO service_role;

-- Add comments
COMMENT ON TABLE public.team_ratings IS
'Stores Elo ratings and statistical ratings for all teams. Updated after each game.';

COMMENT ON TABLE public.game_predictions IS
'Stores model predictions for upcoming games including Elo, regression, and ensemble models.';

COMMENT ON FUNCTION public.calculate_elo_win_probability(NUMERIC, NUMERIC, NUMERIC) IS
'Calculates win probability given two Elo ratings. Standard Elo formula: 1 / (1 + 10^((Elo_B - Elo_A) / 400)).';

COMMENT ON FUNCTION public.predict_game_with_elo(TEXT, TEXT, TEXT, NUMERIC) IS
'Predicts game outcome using Elo ratings. Returns win probabilities and predicted margin.';

COMMENT ON FUNCTION public.initialize_team_ratings(TEXT, TEXT) IS
'Initializes Elo ratings for all teams in a league. Run this once per season or when adding new league.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 4 Part 2: Team Ratings & Predictions Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Elo rating system for all teams';
  RAISE NOTICE '  - Win probability calculations';
  RAISE NOTICE '  - Game prediction storage';
  RAISE NOTICE '  - Model accuracy tracking';
  RAISE NOTICE '  - Offensive/defensive ratings';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage Examples:';
  RAISE NOTICE '  -- Initialize ratings for NBA:';
  RAISE NOTICE '  SELECT initialize_team_ratings(''NBA'', ''2025'');';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Predict a game:';
  RAISE NOTICE '  SELECT predict_game_with_elo(''Lakers'', ''Celtics'', ''NBA'', 100);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Calculate win probability:';
  RAISE NOTICE '  SELECT calculate_elo_win_probability(1600, 1500, 100);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
