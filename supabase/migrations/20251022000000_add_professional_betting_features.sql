-- ============================================================================
-- PROFESSIONAL BETTING ANALYTICS MIGRATION
-- ============================================================================
-- This migration adds support for:
-- 1. Line movement tracking and CLV calculations
-- 2. Parlay optimizer with correlation tracking
-- 3. Hedge calculator support
-- 4. Advanced performance analytics
-- 5. Custom alerts system
-- 6. Referee/umpire tendencies
-- 7. Sharp vs public money indicators
-- 8. Kelly Criterion bankroll management
-- ============================================================================

-- ============================================================================
-- 1. ENHANCE BETS TABLE FOR ADVANCED FEATURES
-- ============================================================================

-- Add fields for advanced bet tracking
ALTER TABLE public.bets
ADD COLUMN IF NOT EXISTS bet_type TEXT DEFAULT 'straight',
ADD COLUMN IF NOT EXISTS sport TEXT,
ADD COLUMN IF NOT EXISTS league TEXT,
ADD COLUMN IF NOT EXISTS team_bet_on TEXT,
ADD COLUMN IF NOT EXISTS event_id TEXT,
ADD COLUMN IF NOT EXISTS market_key TEXT,
ADD COLUMN IF NOT EXISTS opening_line NUMERIC,
ADD COLUMN IF NOT EXISTS closing_line NUMERIC,
ADD COLUMN IF NOT EXISTS clv NUMERIC,
ADD COLUMN IF NOT EXISTS kelly_fraction NUMERIC,
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC,
ADD COLUMN IF NOT EXISTS expected_value NUMERIC,
ADD COLUMN IF NOT EXISTS variance NUMERIC,
ADD COLUMN IF NOT EXISTS model_probability NUMERIC,
ADD COLUMN IF NOT EXISTS bookmaker TEXT,
ADD COLUMN IF NOT EXISTS parlay_id UUID,
ADD COLUMN IF NOT EXISTS hedge_target_id UUID,
ADD COLUMN IF NOT EXISTS is_hedge BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sharp_indicator TEXT;

-- Add check constraints
ALTER TABLE public.bets
ADD CONSTRAINT valid_bet_type CHECK (bet_type IN ('straight', 'parlay', 'teaser', 'round_robin')),
ADD CONSTRAINT valid_sharp_indicator CHECK (sharp_indicator IN ('sharp', 'public', 'neutral', NULL));

-- Add indexes for performance analytics
CREATE INDEX IF NOT EXISTS idx_bets_sport ON public.bets(sport);
CREATE INDEX IF NOT EXISTS idx_bets_league ON public.bets(league);
CREATE INDEX IF NOT EXISTS idx_bets_team ON public.bets(team_bet_on);
CREATE INDEX IF NOT EXISTS idx_bets_event_id ON public.bets(event_id);
CREATE INDEX IF NOT EXISTS idx_bets_outcome ON public.bets(outcome);
CREATE INDEX IF NOT EXISTS idx_bets_parlay_id ON public.bets(parlay_id);
CREATE INDEX IF NOT EXISTS idx_bets_pending_with_event ON public.bets(outcome, event_id) WHERE outcome = 'pending';

-- Add comments
COMMENT ON COLUMN public.bets.clv IS 'Closing Line Value - difference between bet odds and closing odds (positive = beat closing line)';
COMMENT ON COLUMN public.bets.kelly_fraction IS 'Recommended bet size using Kelly Criterion';
COMMENT ON COLUMN public.bets.confidence_score IS 'AI model confidence (0-100)';
COMMENT ON COLUMN public.bets.expected_value IS 'Expected value in dollars';
COMMENT ON COLUMN public.bets.model_probability IS 'AI model win probability (0-1)';
COMMENT ON COLUMN public.bets.sharp_indicator IS 'Whether bet aligned with sharp money movement';

-- ============================================================================
-- 2. LINE MOVEMENT TRACKING (Historical Odds)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.line_movements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  odds NUMERIC NOT NULL,
  point NUMERIC,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  volume_indicator TEXT, -- 'high', 'medium', 'low'
  sharp_percentage NUMERIC, -- Percentage of sharp money on this side
  public_percentage NUMERIC, -- Percentage of public money
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.line_movements ENABLE ROW LEVEL SECURITY;

-- Public read access (needed for all users to see line movements)
CREATE POLICY "Anyone can view line movements"
  ON public.line_movements FOR SELECT
  USING (true);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_line_movements_event ON public.line_movements(event_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movements_bookmaker ON public.line_movements(bookmaker, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movements_timestamp ON public.line_movements(timestamp DESC);

COMMENT ON TABLE public.line_movements IS 'Historical odds tracking for line movement analysis and CLV calculations';

-- ============================================================================
-- 3. PARLAY OPTIMIZER TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.parlays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  total_odds NUMERIC NOT NULL,
  total_stake NUMERIC NOT NULL,
  potential_return NUMERIC NOT NULL,
  expected_value NUMERIC,
  correlation_penalty NUMERIC, -- Reduction in EV due to correlated outcomes
  num_legs INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE,
  actual_return NUMERIC,
  CONSTRAINT valid_parlay_status CHECK (status IN ('pending', 'won', 'lost', 'partial'))
);

-- Enable RLS
ALTER TABLE public.parlays ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own parlays"
  ON public.parlays FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own parlays"
  ON public.parlays FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own parlays"
  ON public.parlays FOR UPDATE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parlays_user_id ON public.parlays(user_id);
CREATE INDEX IF NOT EXISTS idx_parlays_created_at ON public.parlays(created_at DESC);

COMMENT ON TABLE public.parlays IS 'Parlay bet groups with correlation analysis';
COMMENT ON COLUMN public.parlays.correlation_penalty IS 'EV reduction due to correlated outcomes (e.g., same game parlays)';

-- ============================================================================
-- 4. CORRELATION MATRIX (for parlay optimization)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bet_correlations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_type_1 TEXT NOT NULL,
  market_type_2 TEXT NOT NULL,
  correlation_coefficient NUMERIC NOT NULL, -- -1 to 1
  sport TEXT NOT NULL,
  sample_size INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport, market_type_1, market_type_2)
);

-- Enable RLS
ALTER TABLE public.bet_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bet correlations"
  ON public.bet_correlations FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bet_correlations_sport ON public.bet_correlations(sport);

COMMENT ON TABLE public.bet_correlations IS 'Historical correlation coefficients between bet types (e.g., spread + total in same game)';

-- Insert common correlations (to be updated with real data)
INSERT INTO public.bet_correlations (sport, market_type_1, market_type_2, correlation_coefficient, sample_size)
VALUES
  ('NFL', 'spread', 'total', 0.35, 1000),
  ('NFL', 'moneyline', 'spread', 0.85, 1000),
  ('NBA', 'spread', 'total', 0.42, 1000),
  ('NBA', 'moneyline', 'spread', 0.88, 1000),
  ('MLB', 'moneyline', 'total', 0.28, 1000),
  ('NHL', 'moneyline', 'total', 0.31, 1000)
ON CONFLICT (sport, market_type_1, market_type_2) DO NOTHING;

-- ============================================================================
-- 5. CUSTOM ALERTS SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.betting_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  sport TEXT,
  team TEXT,
  market_key TEXT,
  threshold_value NUMERIC,
  comparison_operator TEXT, -- 'greater_than', 'less_than', 'equals', 'moves_by'
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_alert_type CHECK (alert_type IN ('line_movement', 'value_bet', 'clv_opportunity', 'sharp_action', 'model_disagreement'))
);

-- Enable RLS
ALTER TABLE public.betting_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own alerts"
  ON public.betting_alerts FOR ALL
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alerts_user_active ON public.betting_alerts(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON public.betting_alerts(alert_type);

COMMENT ON TABLE public.betting_alerts IS 'User-configured alerts for betting opportunities and line movements';

-- ============================================================================
-- 6. REFEREE/UMPIRE TENDENCIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.referee_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referee_name TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  games_officiated INTEGER DEFAULT 0,
  avg_total_deviation NUMERIC, -- How much totals deviate from expected
  home_cover_rate NUMERIC, -- Home team ATS cover rate
  over_rate NUMERIC, -- Over percentage
  avg_penalties_per_game NUMERIC,
  avg_game_duration_minutes NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(referee_name, sport, league)
);

-- Enable RLS
ALTER TABLE public.referee_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view referee stats"
  ON public.referee_stats FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referee_sport_league ON public.referee_stats(sport, league);
CREATE INDEX IF NOT EXISTS idx_referee_name ON public.referee_stats(referee_name);

COMMENT ON TABLE public.referee_stats IS 'Historical tendencies of referees/umpires affecting game outcomes';

-- ============================================================================
-- 7. TRAVEL AND REST ANALYSIS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_schedule_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  team TEXT NOT NULL,
  sport TEXT NOT NULL,
  is_back_to_back BOOLEAN DEFAULT false,
  days_rest INTEGER,
  travel_distance_miles INTEGER,
  time_zone_change INTEGER, -- Hours difference
  is_road_trip BOOLEAN DEFAULT false,
  games_in_last_7_days INTEGER,
  home_stand_game_num INTEGER, -- Which game in homestand (1, 2, 3...)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, team)
);

-- Enable RLS
ALTER TABLE public.team_schedule_factors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view schedule factors"
  ON public.team_schedule_factors FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_schedule_event ON public.team_schedule_factors(event_id);
CREATE INDEX IF NOT EXISTS idx_schedule_team ON public.team_schedule_factors(team);

COMMENT ON TABLE public.team_schedule_factors IS 'Travel, rest, and scheduling factors affecting team performance';

-- ============================================================================
-- 8. PERFORMANCE ANALYTICS MATERIALIZED VIEW
-- ============================================================================

-- Create materialized view for fast performance analytics queries
CREATE MATERIALIZED VIEW IF NOT EXISTS public.bet_performance_analytics AS
SELECT
  user_id,
  sport,
  league,
  bet_type,
  market_key,
  team_bet_on,
  bookmaker,
  COUNT(*) as total_bets,
  COUNT(*) FILTER (WHERE outcome = 'win') as wins,
  COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
  COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'win')::numeric / NULLIF(COUNT(*) FILTER (WHERE outcome IN ('win', 'loss')), 0) * 100, 2) as win_rate,
  ROUND(SUM(actual_return)::numeric - SUM(amount)::numeric, 2) as total_profit,
  ROUND(AVG(clv)::numeric, 2) as avg_clv,
  ROUND(AVG(expected_value)::numeric, 2) as avg_ev,
  ROUND(SUM(expected_value)::numeric, 2) as total_ev,
  ROUND(STDDEV(actual_return - amount)::numeric, 2) as profit_std_dev,
  MAX(created_at) as last_bet_date,
  COUNT(*) FILTER (WHERE clv > 0) as positive_clv_bets,
  COUNT(*) FILTER (WHERE sharp_indicator = 'sharp') as sharp_aligned_bets
FROM public.bets
WHERE outcome IN ('win', 'loss', 'push')
GROUP BY user_id, sport, league, bet_type, market_key, team_bet_on, bookmaker;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_bet_performance_unique
  ON public.bet_performance_analytics(user_id, COALESCE(sport, ''), COALESCE(league, ''), COALESCE(bet_type, ''), COALESCE(market_key, ''), COALESCE(team_bet_on, ''), COALESCE(bookmaker, ''));

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_bet_performance_analytics()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.bet_performance_analytics;
END;
$$;

COMMENT ON MATERIALIZED VIEW public.bet_performance_analytics IS 'Pre-aggregated performance metrics by sport, bet type, team, etc.';

-- ============================================================================
-- 9. ENHANCE SPORTS_SCORES TABLE
-- ============================================================================

ALTER TABLE public.sports_scores
ADD COLUMN IF NOT EXISTS referee_name TEXT,
ADD COLUMN IF NOT EXISTS weather_conditions JSONB,
ADD COLUMN IF NOT EXISTS home_rest_days INTEGER,
ADD COLUMN IF NOT EXISTS away_rest_days INTEGER,
ADD COLUMN IF NOT EXISTS attendance INTEGER;

-- Add index for referee queries
CREATE INDEX IF NOT EXISTS idx_sports_scores_referee ON public.sports_scores(referee_name);

-- ============================================================================
-- 10. MODEL CONSENSUS TRACKING
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.model_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  model_name TEXT NOT NULL DEFAULT 'betGPT',
  prediction_type TEXT NOT NULL, -- 'moneyline', 'spread', 'total'
  predicted_outcome TEXT NOT NULL,
  predicted_probability NUMERIC NOT NULL,
  recommended_odds NUMERIC, -- What odds would make this +EV
  confidence_score NUMERIC,
  market_consensus_odds NUMERIC,
  disagreement_score NUMERIC, -- How much model differs from market
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, model_name, prediction_type)
);

-- Enable RLS
ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view model predictions"
  ON public.model_predictions FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_model_predictions_event ON public.model_predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_model_predictions_disagreement ON public.model_predictions(disagreement_score DESC NULLS LAST);

COMMENT ON TABLE public.model_predictions IS 'AI model predictions with market comparison for disagreement detection';
COMMENT ON COLUMN public.model_predictions.disagreement_score IS 'Absolute difference between model probability and implied market probability';

-- ============================================================================
-- 11. SHARP MONEY INDICATORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sharp_money_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  sharp_percentage NUMERIC, -- % of sharp money
  public_percentage NUMERIC, -- % of public bets
  bet_count_percentage NUMERIC, -- % of bet count
  money_percentage NUMERIC, -- % of money wagered
  line_movement_direction TEXT, -- 'toward_sharp', 'toward_public', 'neutral'
  reverse_line_movement BOOLEAN DEFAULT false, -- Line moves opposite to public %
  steam_move BOOLEAN DEFAULT false, -- Sudden sharp line movement
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, market_key, outcome_name, timestamp)
);

-- Enable RLS
ALTER TABLE public.sharp_money_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sharp money indicators"
  ON public.sharp_money_indicators FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sharp_indicators_event ON public.sharp_money_indicators(event_id);
CREATE INDEX IF NOT EXISTS idx_sharp_indicators_rlm ON public.sharp_money_indicators(reverse_line_movement) WHERE reverse_line_movement = true;
CREATE INDEX IF NOT EXISTS idx_sharp_indicators_steam ON public.sharp_money_indicators(steam_move) WHERE steam_move = true;

COMMENT ON TABLE public.sharp_money_indicators IS 'Sharp vs public money distribution for identifying professional betting patterns';
COMMENT ON COLUMN public.sharp_money_indicators.reverse_line_movement IS 'When line moves opposite to public betting percentage (sharp indicator)';

-- ============================================================================
-- 12. BANKROLL MANAGEMENT SETTINGS
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS kelly_multiplier NUMERIC DEFAULT 0.25,
ADD COLUMN IF NOT EXISTS max_bet_size_percentage NUMERIC DEFAULT 5.0,
ADD COLUMN IF NOT EXISTS min_edge_threshold NUMERIC DEFAULT 2.0,
ADD COLUMN IF NOT EXISTS variance_tolerance TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS auto_kelly BOOLEAN DEFAULT false;

-- Add constraint
ALTER TABLE public.profiles
ADD CONSTRAINT valid_variance_tolerance CHECK (variance_tolerance IN ('low', 'medium', 'high'));

COMMENT ON COLUMN public.profiles.kelly_multiplier IS 'Fraction of Kelly Criterion to use (0.25 = quarter Kelly, conservative)';
COMMENT ON COLUMN public.profiles.max_bet_size_percentage IS 'Maximum percentage of bankroll for a single bet';
COMMENT ON COLUMN public.profiles.min_edge_threshold IS 'Minimum edge percentage required to suggest a bet';
COMMENT ON COLUMN public.profiles.auto_kelly IS 'Automatically calculate bet sizes using Kelly Criterion';

-- ============================================================================
-- 13. FUNCTIONS FOR ANALYTICS
-- ============================================================================

-- Function to calculate CLV for a bet
CREATE OR REPLACE FUNCTION calculate_clv(
  bet_odds NUMERIC,
  closing_odds NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  bet_implied NUMERIC;
  closing_implied NUMERIC;
BEGIN
  -- Convert American odds to implied probability
  IF bet_odds > 0 THEN
    bet_implied := 100.0 / (bet_odds + 100);
  ELSE
    bet_implied := ABS(bet_odds) / (ABS(bet_odds) + 100);
  END IF;

  IF closing_odds > 0 THEN
    closing_implied := 100.0 / (closing_odds + 100);
  ELSE
    closing_implied := ABS(closing_odds) / (ABS(closing_odds) + 100);
  END IF;

  -- CLV is the difference in implied probability
  -- Positive CLV means you got better odds than closing
  RETURN ROUND((closing_implied - bet_implied) * 100, 2);
END;
$$;

COMMENT ON FUNCTION calculate_clv IS 'Calculate Closing Line Value - positive means beat the closing line';

-- Function to calculate Kelly Criterion bet size
CREATE OR REPLACE FUNCTION calculate_kelly_stake(
  bankroll NUMERIC,
  win_probability NUMERIC,
  odds NUMERIC,
  kelly_fraction NUMERIC DEFAULT 0.25
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  decimal_odds NUMERIC;
  kelly_percentage NUMERIC;
  recommended_stake NUMERIC;
BEGIN
  -- Convert American odds to decimal
  IF odds > 0 THEN
    decimal_odds := (odds / 100.0) + 1;
  ELSE
    decimal_odds := (100.0 / ABS(odds)) + 1;
  END IF;

  -- Kelly formula: (bp - q) / b
  -- where b = decimal odds - 1, p = win probability, q = 1 - p
  kelly_percentage := ((decimal_odds - 1) * win_probability - (1 - win_probability)) / (decimal_odds - 1);

  -- Apply fractional Kelly for safety
  kelly_percentage := kelly_percentage * kelly_fraction;

  -- Don't bet if Kelly is negative (no edge)
  IF kelly_percentage <= 0 THEN
    RETURN 0;
  END IF;

  recommended_stake := bankroll * kelly_percentage;

  RETURN ROUND(recommended_stake, 2);
END;
$$;

COMMENT ON FUNCTION calculate_kelly_stake IS 'Calculate optimal bet size using Kelly Criterion with fractional multiplier';

-- Function to calculate expected value
CREATE OR REPLACE FUNCTION calculate_expected_value(
  stake NUMERIC,
  win_probability NUMERIC,
  odds NUMERIC
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  decimal_odds NUMERIC;
  profit_if_win NUMERIC;
  ev NUMERIC;
BEGIN
  -- Convert American odds to decimal
  IF odds > 0 THEN
    decimal_odds := (odds / 100.0) + 1;
  ELSE
    decimal_odds := (100.0 / ABS(odds)) + 1;
  END IF;

  profit_if_win := stake * (decimal_odds - 1);

  -- EV = (win_prob * profit) - (loss_prob * stake)
  ev := (win_probability * profit_if_win) - ((1 - win_probability) * stake);

  RETURN ROUND(ev, 2);
END;
$$;

COMMENT ON FUNCTION calculate_expected_value IS 'Calculate expected value in dollars for a bet';

-- ============================================================================
-- 14. TRIGGER TO AUTO-UPDATE BET ANALYTICS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bet_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Calculate EV if we have model probability and odds
  IF NEW.model_probability IS NOT NULL AND NEW.odds IS NOT NULL AND NEW.amount IS NOT NULL THEN
    NEW.expected_value := calculate_expected_value(NEW.amount, NEW.model_probability, NEW.odds);
  END IF;

  -- Calculate Kelly fraction if we have model probability, bankroll, and odds
  IF NEW.model_probability IS NOT NULL AND NEW.odds IS NOT NULL THEN
    DECLARE
      user_bankroll NUMERIC;
      user_kelly_multiplier NUMERIC;
    BEGIN
      SELECT bankroll, kelly_multiplier INTO user_bankroll, user_kelly_multiplier
      FROM profiles WHERE id = NEW.user_id;

      IF user_bankroll IS NOT NULL THEN
        NEW.kelly_fraction := calculate_kelly_stake(
          user_bankroll,
          NEW.model_probability,
          NEW.odds,
          user_kelly_multiplier
        ) / user_bankroll;
      END IF;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_bet_analytics ON public.bets;
CREATE TRIGGER trigger_update_bet_analytics
  BEFORE INSERT OR UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION update_bet_analytics();

COMMENT ON FUNCTION update_bet_analytics IS 'Auto-calculate EV and Kelly fraction when bets are created/updated';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
