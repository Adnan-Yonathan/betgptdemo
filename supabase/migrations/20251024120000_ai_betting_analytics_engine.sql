-- Migration: AI Betting Analytics Engine
-- Comprehensive schema for alert system, predictive models, props analytics,
-- sharp money detection, and portfolio management

-- ============================================================================
-- 2.1 & 2.2: ALERT INFRASTRUCTURE & INTELLIGENT ALERTS
-- ============================================================================

-- User alert preferences
CREATE TABLE IF NOT EXISTS user_alert_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert types enabled
  line_movement_alerts BOOLEAN DEFAULT TRUE,
  steam_move_alerts BOOLEAN DEFAULT TRUE,
  ev_discrepancy_alerts BOOLEAN DEFAULT TRUE,
  closing_line_alerts BOOLEAN DEFAULT TRUE,
  injury_alerts BOOLEAN DEFAULT TRUE,
  best_line_alerts BOOLEAN DEFAULT TRUE,
  sharp_money_alerts BOOLEAN DEFAULT TRUE,

  -- Thresholds
  min_ev_percentage DECIMAL DEFAULT 3.0, -- Minimum EV % to trigger alert
  min_line_move_points DECIMAL DEFAULT 1.0, -- Minimum line movement in points
  min_steam_velocity INTEGER DEFAULT 3, -- Number of books moving in X minutes
  closing_time_threshold INTEGER DEFAULT 60, -- Minutes before game start

  -- Favorite teams/sports for priority alerts
  favorite_sports TEXT[] DEFAULT ARRAY[]::TEXT[],
  favorite_teams TEXT[] DEFAULT ARRAY[]::TEXT[],
  favorite_bookmakers TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- Delivery preferences
  in_app_notifications BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT FALSE,

  -- Alert frequency management
  max_alerts_per_day INTEGER DEFAULT 50,
  quiet_hours_start TIME,
  quiet_hours_end TIME,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert type and metadata
  alert_type TEXT NOT NULL, -- 'line_movement', 'steam_move', 'ev_discrepancy', etc.
  priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'

  -- Game/event information
  event_id TEXT,
  sport TEXT,
  league TEXT,
  home_team TEXT,
  away_team TEXT,
  game_date TIMESTAMPTZ,

  -- Alert content
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT, -- Deep link to specific game/bet

  -- Alert data (JSON for flexibility)
  data JSONB, -- Contains specific alert details (EV %, line movement, etc.)

  -- Status
  read BOOLEAN DEFAULT FALSE,
  dismissed BOOLEAN DEFAULT FALSE,
  acted_upon BOOLEAN DEFAULT FALSE, -- User took action (clicked, placed bet)

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- Some alerts expire after game starts
);

-- Alert execution log (for debugging and analytics)
CREATE TABLE IF NOT EXISTS alert_execution_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  alert_type TEXT NOT NULL,
  execution_time TIMESTAMPTZ DEFAULT NOW(),
  alerts_generated INTEGER DEFAULT 0,
  users_notified INTEGER DEFAULT 0,
  execution_duration_ms INTEGER,
  errors JSONB,
  metadata JSONB
);

-- ============================================================================
-- 3.2: PREDICTIVE MODELS
-- ============================================================================

-- Model configurations and metadata
CREATE TABLE IF NOT EXISTS prediction_models (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_name TEXT NOT NULL UNIQUE, -- e.g., 'nfl_spread_v1', 'nba_total_v2'
  sport TEXT NOT NULL,
  model_type TEXT NOT NULL, -- 'spread', 'moneyline', 'total', 'props'
  version TEXT NOT NULL,

  -- Model performance metrics
  accuracy DECIMAL,
  roi DECIMAL,
  sharpe_ratio DECIMAL,
  clv_average DECIMAL,
  sample_size INTEGER,

  -- Model configuration
  features JSONB, -- Feature list and weights
  hyperparameters JSONB,
  training_data_period TEXT, -- e.g., '2020-2024'

  -- Model status
  is_active BOOLEAN DEFAULT TRUE,
  last_trained_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Model predictions
CREATE TABLE IF NOT EXISTS model_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES prediction_models(id) ON DELETE CASCADE,

  -- Game identification
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,

  -- Predictions
  prediction_type TEXT NOT NULL, -- 'spread', 'moneyline', 'total', 'props'

  -- For spreads
  predicted_spread DECIMAL,
  predicted_home_score DECIMAL,
  predicted_away_score DECIMAL,

  -- For totals
  predicted_total DECIMAL,

  -- For moneyline
  home_win_probability DECIMAL,
  away_win_probability DECIMAL,

  -- Model confidence and fair odds
  confidence_score DECIMAL, -- 0-100
  fair_odds_home DECIMAL,
  fair_odds_away DECIMAL,
  fair_odds_over DECIMAL,
  fair_odds_under DECIMAL,

  -- Market comparison
  market_odds_home DECIMAL,
  market_odds_away DECIMAL,
  market_spread DECIMAL,
  market_total DECIMAL,

  -- Edge detection
  edge_percentage DECIMAL, -- Model edge vs market
  edge_side TEXT, -- 'home', 'away', 'over', 'under'

  -- Feature values used
  feature_values JSONB,

  -- Outcome tracking
  actual_home_score INTEGER,
  actual_away_score INTEGER,
  prediction_correct BOOLEAN,
  prediction_error DECIMAL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  game_started BOOLEAN DEFAULT FALSE,
  game_completed BOOLEAN DEFAULT FALSE,

  UNIQUE(model_id, event_id, prediction_type)
);

-- Model training history
CREATE TABLE IF NOT EXISTS model_training_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  model_id UUID NOT NULL REFERENCES prediction_models(id) ON DELETE CASCADE,
  training_start TIMESTAMPTZ NOT NULL,
  training_end TIMESTAMPTZ NOT NULL,

  -- Training metrics
  training_accuracy DECIMAL,
  validation_accuracy DECIMAL,
  test_accuracy DECIMAL,

  -- Data used
  training_samples INTEGER,
  validation_samples INTEGER,
  test_samples INTEGER,

  -- Model artifacts
  model_weights JSONB, -- Simplified model weights
  feature_importance JSONB,

  status TEXT DEFAULT 'completed', -- 'running', 'completed', 'failed'
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4.2: PROPS ANALYTICS
-- ============================================================================

-- Player prop markets
CREATE TABLE IF NOT EXISTS player_props (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game context
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,

  -- Player information
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  position TEXT,

  -- Prop details
  prop_type TEXT NOT NULL, -- 'points', 'rebounds', 'assists', 'passing_yards', etc.
  line DECIMAL NOT NULL,
  over_odds INTEGER,
  under_odds INTEGER,

  -- Bookmaker
  bookmaker TEXT NOT NULL,

  -- Market metadata
  last_updated TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, player_name, prop_type, bookmaker)
);

-- Player prop predictions
CREATE TABLE IF NOT EXISTS player_prop_predictions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Links to prop
  prop_id UUID REFERENCES player_props(id) ON DELETE CASCADE,

  -- Game and player context
  event_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  prop_type TEXT NOT NULL,

  -- Prediction
  predicted_value DECIMAL NOT NULL,
  confidence_score DECIMAL, -- 0-100

  -- Market comparison
  market_line DECIMAL,
  edge_percentage DECIMAL,
  recommended_side TEXT, -- 'over', 'under', 'no_bet'

  -- Features used
  season_average DECIMAL,
  last_5_games_average DECIMAL,
  vs_opponent_average DECIMAL,
  home_away_split DECIMAL,
  minutes_expected DECIMAL,
  injury_impact_factor DECIMAL,

  feature_values JSONB,

  -- Outcome tracking
  actual_value DECIMAL,
  prediction_correct BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, player_name, prop_type)
);

-- Player prop correlation matrix
CREATE TABLE IF NOT EXISTS prop_correlation_matrix (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sport TEXT NOT NULL,
  league TEXT NOT NULL,

  -- Prop types being correlated
  prop_type_1 TEXT NOT NULL,
  prop_type_2 TEXT NOT NULL,

  -- Correlation data
  correlation_coefficient DECIMAL NOT NULL, -- -1 to 1
  sample_size INTEGER NOT NULL,

  -- Context
  same_player BOOLEAN DEFAULT FALSE,
  same_team BOOLEAN DEFAULT FALSE,
  same_game BOOLEAN DEFAULT FALSE,

  last_calculated TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(sport, prop_type_1, prop_type_2, same_player, same_team)
);

-- Player performance history (for model training)
CREATE TABLE IF NOT EXISTS player_performance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Player identification
  player_name TEXT NOT NULL,
  team TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,

  -- Game context
  game_date DATE NOT NULL,
  opponent TEXT,
  home_away TEXT, -- 'home' or 'away'

  -- Performance stats (JSON for flexibility across sports)
  stats JSONB NOT NULL,

  -- Common stats extracted for easy querying
  points INTEGER,
  minutes_played DECIMAL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(player_name, game_date)
);

-- ============================================================================
-- 5.2: SHARP MONEY ANALYSIS
-- ============================================================================

-- Line movement tracking (enhanced from existing betting_odds)
CREATE TABLE IF NOT EXISTS line_movement_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game identification
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,

  -- Market type
  market_key TEXT NOT NULL, -- 'h2h', 'spreads', 'totals'

  -- Line data
  bookmaker TEXT NOT NULL,

  -- Spread/Total specific
  line_value DECIMAL, -- The spread or total line
  home_odds INTEGER,
  away_odds INTEGER,

  -- Metadata
  timestamp TIMESTAMPTZ DEFAULT NOW(),

  -- Movement indicators
  line_move_from_open DECIMAL, -- How much line moved from opening
  odds_move_from_open INTEGER,

  -- Volume indicators (if available)
  bet_percentage_home DECIMAL,
  bet_percentage_away DECIMAL,
  money_percentage_home DECIMAL,
  money_percentage_away DECIMAL
);

-- Sharp money indicators
CREATE TABLE IF NOT EXISTS sharp_money_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game identification
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  market_key TEXT NOT NULL,

  -- Signal type
  signal_type TEXT NOT NULL, -- 'reverse_line_movement', 'steam_move', 'sharp_book_lead', 'consensus_sharp'

  -- Signal strength
  strength TEXT, -- 'weak', 'moderate', 'strong', 'very_strong'
  confidence_score DECIMAL, -- 0-100

  -- Sharp side
  sharp_side TEXT, -- 'home', 'away', 'over', 'under'

  -- Supporting data
  line_movement DECIMAL,
  number_of_books_moved INTEGER,
  movement_velocity INTEGER, -- Books moved per minute

  -- Reverse line movement specifics
  public_bet_percentage DECIMAL,
  money_percentage DECIMAL,
  rlm_divergence DECIMAL, -- How much line moved opposite to public %

  -- Metadata
  data JSONB,

  detected_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, market_key, signal_type, detected_at)
);

-- Steam moves log
CREATE TABLE IF NOT EXISTS steam_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game identification
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  market_key TEXT NOT NULL,

  -- Steam move details
  side TEXT NOT NULL, -- Which side the steam is on
  books_moved TEXT[], -- Array of bookmakers that moved
  line_before DECIMAL,
  line_after DECIMAL,

  -- Velocity
  movement_window_minutes INTEGER, -- Time window of movement
  books_moved_count INTEGER,

  -- Impact
  average_odds_change INTEGER,

  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opening vs closing line tracking
CREATE TABLE IF NOT EXISTS opening_closing_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Game identification
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  market_key TEXT NOT NULL,

  -- Opening line (earliest available)
  opening_line DECIMAL,
  opening_home_odds INTEGER,
  opening_away_odds INTEGER,
  opening_timestamp TIMESTAMPTZ,

  -- Closing line (last available before game)
  closing_line DECIMAL,
  closing_home_odds INTEGER,
  closing_away_odds INTEGER,
  closing_timestamp TIMESTAMPTZ,

  -- Movement analysis
  total_line_movement DECIMAL,
  movement_direction TEXT, -- 'toward_home', 'toward_away', 'over', 'under'

  -- Sharp money indicators
  sharp_side TEXT,
  rlm_detected BOOLEAN DEFAULT FALSE,
  steam_detected BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(event_id, market_key)
);

-- ============================================================================
-- 6.1: PORTFOLIO MANAGEMENT
-- ============================================================================

-- User bankroll tracking (enhanced)
CREATE TABLE IF NOT EXISTS user_bankroll (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Current bankroll
  current_amount DECIMAL NOT NULL DEFAULT 1000.00,
  starting_amount DECIMAL NOT NULL DEFAULT 1000.00,

  -- High water marks
  all_time_high DECIMAL,
  all_time_high_date DATE,

  -- Risk settings
  max_bet_percentage DECIMAL DEFAULT 5.0, -- Max % of bankroll per bet
  max_daily_exposure DECIMAL DEFAULT 20.0, -- Max % exposed per day
  kelly_multiplier DECIMAL DEFAULT 0.25, -- Fractional Kelly (0.25 = quarter Kelly)

  -- Portfolio settings
  diversification_target INTEGER DEFAULT 5, -- Target number of active bets
  max_correlation_allowed DECIMAL DEFAULT 0.5, -- Max correlation between active bets

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Daily risk exposure tracking
CREATE TABLE IF NOT EXISTS daily_risk_exposure (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,

  -- Exposure metrics
  total_amount_risked DECIMAL DEFAULT 0,
  total_potential_win DECIMAL DEFAULT 0,
  total_potential_loss DECIMAL DEFAULT 0,

  -- Open bets
  active_bets_count INTEGER DEFAULT 0,
  active_bets_ids UUID[],

  -- Risk breakdown by sport
  exposure_by_sport JSONB,
  exposure_by_market JSONB,

  -- Correlation risk
  portfolio_correlation_score DECIMAL, -- Weighted average correlation
  high_correlation_warning BOOLEAN DEFAULT FALSE,

  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

-- Bet correlation warnings
CREATE TABLE IF NOT EXISTS bet_correlation_warnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Bets involved
  bet_id_1 UUID REFERENCES bets(id) ON DELETE CASCADE,
  bet_id_2 UUID REFERENCES bets(id) ON DELETE CASCADE,

  -- Correlation details
  correlation_type TEXT, -- 'same_game', 'same_team', 'division_rival', 'parlay_leg'
  correlation_coefficient DECIMAL, -- Estimated correlation

  -- Warning level
  severity TEXT, -- 'low', 'medium', 'high'

  -- User action
  acknowledged BOOLEAN DEFAULT FALSE,
  user_proceeded BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(bet_id_1, bet_id_2)
);

-- Kelly criterion recommendations log
CREATE TABLE IF NOT EXISTS kelly_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Bet context
  event_id TEXT,
  market_key TEXT,
  odds INTEGER NOT NULL,

  -- Kelly inputs
  win_probability DECIMAL NOT NULL,
  bankroll DECIMAL NOT NULL,
  edge_percentage DECIMAL NOT NULL,

  -- Kelly outputs
  full_kelly_stake DECIMAL NOT NULL,
  fractional_kelly_stake DECIMAL NOT NULL,
  kelly_multiplier DECIMAL NOT NULL,

  -- Risk metrics
  variance DECIMAL,
  risk_of_ruin DECIMAL,

  -- User action
  recommended_stake DECIMAL NOT NULL,
  actual_stake DECIMAL,
  user_followed_kelly BOOLEAN,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_event ON notifications(event_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at) WHERE expires_at IS NOT NULL;

-- Alert preferences
CREATE INDEX IF NOT EXISTS idx_alert_prefs_user ON user_alert_preferences(user_id);

-- Model predictions
CREATE INDEX IF NOT EXISTS idx_predictions_event ON model_predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_predictions_model ON model_predictions(model_id);
CREATE INDEX IF NOT EXISTS idx_predictions_game_date ON model_predictions(game_date);
CREATE INDEX IF NOT EXISTS idx_predictions_edge ON model_predictions(edge_percentage DESC) WHERE edge_percentage > 3;

-- Player props
CREATE INDEX IF NOT EXISTS idx_player_props_event ON player_props(event_id);
CREATE INDEX IF NOT EXISTS idx_player_props_player ON player_props(player_name);
CREATE INDEX IF NOT EXISTS idx_player_props_game_date ON player_props(game_date);

-- Player prop predictions
CREATE INDEX IF NOT EXISTS idx_prop_predictions_event ON player_prop_predictions(event_id);
CREATE INDEX IF NOT EXISTS idx_prop_predictions_player ON player_prop_predictions(player_name);
CREATE INDEX IF NOT EXISTS idx_prop_predictions_edge ON player_prop_predictions(edge_percentage DESC) WHERE edge_percentage > 5;

-- Line movement
CREATE INDEX IF NOT EXISTS idx_line_movement_event ON line_movement_history(event_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_line_movement_bookmaker ON line_movement_history(bookmaker);

-- Sharp money signals
CREATE INDEX IF NOT EXISTS idx_sharp_signals_event ON sharp_money_signals(event_id);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_detected ON sharp_money_signals(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_sharp_signals_strength ON sharp_money_signals(confidence_score DESC);

-- Steam moves
CREATE INDEX IF NOT EXISTS idx_steam_moves_event ON steam_moves(event_id);
CREATE INDEX IF NOT EXISTS idx_steam_moves_detected ON steam_moves(detected_at DESC);

-- Portfolio management
CREATE INDEX IF NOT EXISTS idx_daily_exposure_user_date ON daily_risk_exposure(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_bet_correlation_user ON bet_correlation_warnings(user_id) WHERE acknowledged = FALSE;
CREATE INDEX IF NOT EXISTS idx_kelly_recs_user ON kelly_recommendations(user_id, created_at DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE user_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_training_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_props ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_prop_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE prop_correlation_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_performance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_movement_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE sharp_money_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE opening_closing_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_bankroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_risk_exposure ENABLE ROW LEVEL SECURITY;
ALTER TABLE bet_correlation_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelly_recommendations ENABLE ROW LEVEL SECURITY;

-- User-specific data policies
CREATE POLICY "Users can view their own alert preferences"
  ON user_alert_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert preferences"
  ON user_alert_preferences FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own bankroll"
  ON user_bankroll FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own bankroll"
  ON user_bankroll FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own exposure"
  ON daily_risk_exposure FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own correlation warnings"
  ON bet_correlation_warnings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own Kelly recommendations"
  ON kelly_recommendations FOR SELECT
  USING (auth.uid() = user_id);

-- Public read access for models and predictions
CREATE POLICY "Allow public read on prediction_models"
  ON prediction_models FOR SELECT
  USING (is_active = TRUE);

CREATE POLICY "Allow public read on model_predictions"
  ON model_predictions FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on player_props"
  ON player_props FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on player_prop_predictions"
  ON player_prop_predictions FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on sharp_money_signals"
  ON sharp_money_signals FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on steam_moves"
  ON steam_moves FOR SELECT
  USING (true);

CREATE POLICY "Allow public read on line_movement_history"
  ON line_movement_history FOR SELECT
  USING (true);

-- Service role policies for system operations
CREATE POLICY "Service role can manage all notifications"
  ON notifications FOR ALL
  USING (true);

CREATE POLICY "Service role can manage alert logs"
  ON alert_execution_log FOR ALL
  USING (true);

CREATE POLICY "Service role can manage models"
  ON prediction_models FOR ALL
  USING (true);

CREATE POLICY "Service role can manage predictions"
  ON model_predictions FOR ALL
  USING (true);

CREATE POLICY "Service role can manage props"
  ON player_props FOR ALL
  USING (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create default alert preferences for new users
CREATE OR REPLACE FUNCTION create_default_alert_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_alert_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initialize bankroll for new users
CREATE OR REPLACE FUNCTION initialize_user_bankroll()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_bankroll (user_id, current_amount, starting_amount)
  VALUES (NEW.id, 1000.00, 1000.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS create_alert_preferences_on_signup ON auth.users;
CREATE TRIGGER create_alert_preferences_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_alert_preferences();

DROP TRIGGER IF EXISTS initialize_bankroll_on_signup ON auth.users;
CREATE TRIGGER initialize_bankroll_on_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_bankroll();

-- Function to update daily exposure
CREATE OR REPLACE FUNCTION update_daily_exposure()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_date DATE;
BEGIN
  -- Get user_id and current date
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  v_date := CURRENT_DATE;

  -- Recalculate exposure
  INSERT INTO daily_risk_exposure (user_id, date, total_amount_risked, active_bets_count, active_bets_ids)
  SELECT
    v_user_id,
    v_date,
    COALESCE(SUM(amount), 0),
    COUNT(*),
    ARRAY_AGG(id)
  FROM bets
  WHERE user_id = v_user_id
    AND outcome IS NULL -- Only pending bets
    AND created_at::DATE <= v_date
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    total_amount_risked = EXCLUDED.total_amount_risked,
    active_bets_count = EXCLUDED.active_bets_count,
    active_bets_ids = EXCLUDED.active_bets_ids,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update exposure on bet changes
DROP TRIGGER IF EXISTS update_exposure_on_bet_change ON bets;
CREATE TRIGGER update_exposure_on_bet_change
  AFTER INSERT OR UPDATE OR DELETE ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_daily_exposure();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE user_alert_preferences IS 'User preferences for alert types and thresholds';
COMMENT ON TABLE notifications IS 'In-app notifications for betting alerts and updates';
COMMENT ON TABLE prediction_models IS 'ML model configurations and performance metrics';
COMMENT ON TABLE model_predictions IS 'Game predictions from ML models with edge detection';
COMMENT ON TABLE player_props IS 'Player prop betting lines from various bookmakers';
COMMENT ON TABLE player_prop_predictions IS 'ML predictions for player props with EV calculation';
COMMENT ON TABLE sharp_money_signals IS 'Detected sharp money indicators and reverse line movements';
COMMENT ON TABLE steam_moves IS 'Rapid line movements across multiple bookmakers';
COMMENT ON TABLE user_bankroll IS 'User bankroll tracking with risk management settings';
COMMENT ON TABLE daily_risk_exposure IS 'Daily portfolio risk exposure and diversification metrics';
COMMENT ON TABLE bet_correlation_warnings IS 'Warnings for highly correlated bets in portfolio';
COMMENT ON TABLE kelly_recommendations IS 'Kelly criterion bet sizing recommendations';
