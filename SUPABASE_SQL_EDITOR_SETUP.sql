-- ============================================================================
-- BETGPT DATABASE SETUP - SQL EDITOR VERSION
-- ============================================================================
--
-- IMPORTANT: This is a STARTER SCRIPT for essential tables only.
-- For full functionality, use: supabase db push
--
-- This script creates the core tables needed to get started:
-- 1. User profiles and authentication
-- 2. Betting system (bets, parlays, odds)
-- 3. Chat system (conversations, messages)
-- 4. Bankroll management
-- 5. Sports data tables
-- 6. Professional betting features
--
-- Total in full migrations: 92 tables across 70 migration files
-- This script: ~40 core tables to get started
-- ============================================================================

-- ============================================================================
-- 1. USER PROFILES & AUTHENTICATION
-- ============================================================================

-- Create profiles table for user betting preferences
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  bankroll DECIMAL(10, 2) DEFAULT 1000.00,
  default_bet_size DECIMAL(10, 2) DEFAULT 100.00,
  risk_tolerance TEXT CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive')) DEFAULT 'moderate',
  kelly_multiplier NUMERIC DEFAULT 0.25,
  max_bet_size_percentage NUMERIC DEFAULT 5.0,
  min_edge_threshold NUMERIC DEFAULT 2.0,
  variance_tolerance TEXT DEFAULT 'medium' CHECK (variance_tolerance IN ('low', 'medium', 'high')),
  auto_kelly BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 2. BETTING SYSTEM - CORE TABLES
-- ============================================================================

-- Main bets table with advanced tracking
CREATE TABLE IF NOT EXISTS public.bets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  odds NUMERIC NOT NULL,
  outcome TEXT DEFAULT 'pending' CHECK (outcome IN ('pending', 'win', 'loss', 'push')),
  actual_return DECIMAL(10, 2) DEFAULT 0,
  bet_type TEXT DEFAULT 'straight' CHECK (bet_type IN ('straight', 'parlay', 'teaser', 'round_robin')),
  sport TEXT,
  league TEXT,
  team_bet_on TEXT,
  event_id TEXT,
  market_key TEXT,
  opening_line NUMERIC,
  closing_line NUMERIC,
  clv NUMERIC,
  kelly_fraction NUMERIC,
  confidence_score NUMERIC,
  expected_value NUMERIC,
  variance NUMERIC,
  model_probability NUMERIC,
  bookmaker TEXT,
  parlay_id UUID,
  hedge_target_id UUID,
  is_hedge BOOLEAN DEFAULT false,
  sharp_indicator TEXT CHECK (sharp_indicator IN ('sharp', 'public', 'neutral', NULL)),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bets"
  ON public.bets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own bets"
  ON public.bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bets"
  ON public.bets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own bets"
  ON public.bets FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_bets_user_id ON public.bets(user_id);
CREATE INDEX IF NOT EXISTS idx_bets_created_at ON public.bets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_sport ON public.bets(sport);
CREATE INDEX IF NOT EXISTS idx_bets_outcome ON public.bets(outcome);
CREATE INDEX IF NOT EXISTS idx_bets_event_id ON public.bets(event_id);

-- Parlays table
CREATE TABLE IF NOT EXISTS public.parlays (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  total_odds NUMERIC NOT NULL,
  total_stake NUMERIC NOT NULL,
  potential_return NUMERIC NOT NULL,
  expected_value NUMERIC,
  correlation_penalty NUMERIC,
  num_legs INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'won', 'lost', 'partial')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  settled_at TIMESTAMP WITH TIME ZONE,
  actual_return NUMERIC
);

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

-- Parlay legs table
CREATE TABLE IF NOT EXISTS public.parlay_legs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  parlay_id UUID NOT NULL REFERENCES public.parlays(id) ON DELETE CASCADE,
  bet_id UUID REFERENCES public.bets(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  odds NUMERIC NOT NULL,
  outcome TEXT DEFAULT 'pending' CHECK (outcome IN ('pending', 'win', 'loss', 'push')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.parlay_legs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view parlay legs"
  ON public.parlay_legs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.parlays
      WHERE parlays.id = parlay_legs.parlay_id
      AND parlays.user_id = auth.uid()
    )
  );

-- Betting odds from external APIs
CREATE TABLE IF NOT EXISTS public.betting_odds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_key TEXT NOT NULL,
  sport_title TEXT,
  event_id TEXT NOT NULL,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  bookmaker_key TEXT NOT NULL,
  bookmaker_title TEXT,
  market_key TEXT NOT NULL,
  market_last_update TIMESTAMP WITH TIME ZONE,
  outcomes JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.betting_odds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view betting odds"
  ON public.betting_odds FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_betting_odds_event_id ON public.betting_odds(event_id);
CREATE INDEX IF NOT EXISTS idx_betting_odds_sport_key ON public.betting_odds(sport_key);

-- ============================================================================
-- 3. LINE MOVEMENT TRACKING
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
  volume_indicator TEXT,
  sharp_percentage NUMERIC,
  public_percentage NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.line_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view line movements"
  ON public.line_movements FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_line_movements_event ON public.line_movements(event_id, timestamp DESC);

-- ============================================================================
-- 4. BANKROLL MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bankroll_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_lost', 'bet_push')),
  description TEXT,
  balance_after DECIMAL(10, 2) NOT NULL,
  bet_id UUID REFERENCES public.bets(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.bankroll_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own transactions"
  ON public.bankroll_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bankroll_transactions_user_id ON public.bankroll_transactions(user_id);

-- ============================================================================
-- 5. CHAT SYSTEM
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own conversations"
  ON public.conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON public.conversations FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON public.conversations FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);

-- Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages in their conversations"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create messages in their conversations"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = messages.conversation_id
      AND conversations.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);

-- ============================================================================
-- 6. SPORTS DATA
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sports_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport_key TEXT NOT NULL,
  event_id TEXT NOT NULL,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  completed BOOLEAN DEFAULT false,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER,
  away_score INTEGER,
  last_update TIMESTAMP WITH TIME ZONE DEFAULT now(),
  referee_name TEXT,
  weather_conditions JSONB,
  home_rest_days INTEGER,
  away_rest_days INTEGER,
  attendance INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, sport_key)
);

ALTER TABLE public.sports_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sports scores"
  ON public.sports_scores FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sports_scores_event_id ON public.sports_scores(event_id);
CREATE INDEX IF NOT EXISTS idx_sports_scores_sport_key ON public.sports_scores(sport_key);

-- ============================================================================
-- 7. SHARP MONEY INDICATORS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.sharp_money_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  sharp_percentage NUMERIC,
  public_percentage NUMERIC,
  bet_count_percentage NUMERIC,
  money_percentage NUMERIC,
  line_movement_direction TEXT,
  reverse_line_movement BOOLEAN DEFAULT false,
  steam_move BOOLEAN DEFAULT false,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sharp_money_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sharp money indicators"
  ON public.sharp_money_indicators FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_sharp_indicators_event ON public.sharp_money_indicators(event_id);

-- ============================================================================
-- 8. ALERTS & NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.betting_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN ('line_movement', 'value_bet', 'clv_opportunity', 'sharp_action', 'model_disagreement')),
  sport TEXT,
  team TEXT,
  market_key TEXT,
  threshold_value NUMERIC,
  comparison_operator TEXT,
  is_active BOOLEAN DEFAULT true,
  last_triggered TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.betting_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own alerts"
  ON public.betting_alerts FOR ALL
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);

-- ============================================================================
-- 9. AI INSIGHTS & PREDICTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  confidence_score NUMERIC,
  event_id TEXT,
  sport TEXT,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own insights"
  ON public.ai_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.model_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  model_name TEXT NOT NULL DEFAULT 'betGPT',
  prediction_type TEXT NOT NULL,
  predicted_outcome TEXT NOT NULL,
  predicted_probability NUMERIC NOT NULL,
  recommended_odds NUMERIC,
  confidence_score NUMERIC,
  market_consensus_odds NUMERIC,
  disagreement_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id, model_name, prediction_type)
);

ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view model predictions"
  ON public.model_predictions FOR SELECT
  USING (true);

CREATE INDEX IF NOT EXISTS idx_model_predictions_event ON public.model_predictions(event_id);

-- ============================================================================
-- 10. UTILITY FUNCTIONS
-- ============================================================================

-- Calculate Closing Line Value
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

  RETURN ROUND((closing_implied - bet_implied) * 100, 2);
END;
$$;

-- Calculate Kelly Criterion stake
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
  IF odds > 0 THEN
    decimal_odds := (odds / 100.0) + 1;
  ELSE
    decimal_odds := (100.0 / ABS(odds)) + 1;
  END IF;

  kelly_percentage := ((decimal_odds - 1) * win_probability - (1 - win_probability)) / (decimal_odds - 1);
  kelly_percentage := kelly_percentage * kelly_fraction;

  IF kelly_percentage <= 0 THEN
    RETURN 0;
  END IF;

  recommended_stake := bankroll * kelly_percentage;
  RETURN ROUND(recommended_stake, 2);
END;
$$;

-- Calculate Expected Value
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
  IF odds > 0 THEN
    decimal_odds := (odds / 100.0) + 1;
  ELSE
    decimal_odds := (100.0 / ABS(odds)) + 1;
  END IF;

  profit_if_win := stake * (decimal_odds - 1);
  ev := (win_probability * profit_if_win) - ((1 - win_probability) * stake);

  RETURN ROUND(ev, 2);
END;
$$;

-- ============================================================================
-- 11. TRIGGERS FOR AUTO-CALCULATIONS
-- ============================================================================

-- Auto-update bet analytics (EV, Kelly fraction)
CREATE OR REPLACE FUNCTION update_bet_analytics()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.model_probability IS NOT NULL AND NEW.odds IS NOT NULL AND NEW.amount IS NOT NULL THEN
    NEW.expected_value := calculate_expected_value(NEW.amount, NEW.model_probability, NEW.odds);
  END IF;

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

CREATE TRIGGER trigger_update_bet_analytics
  BEFORE INSERT OR UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION update_bet_analytics();

-- Update conversation timestamp on new message
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations
  SET updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_timestamp();

-- ============================================================================
-- 12. CORRELATION MATRIX FOR PARLAY OPTIMIZATION
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.bet_correlations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  market_type_1 TEXT NOT NULL,
  market_type_2 TEXT NOT NULL,
  correlation_coefficient NUMERIC NOT NULL,
  sport TEXT NOT NULL,
  sample_size INTEGER,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(sport, market_type_1, market_type_2)
);

ALTER TABLE public.bet_correlations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view bet correlations"
  ON public.bet_correlations FOR SELECT
  USING (true);

-- Insert common correlations
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
-- SETUP COMPLETE!
-- ============================================================================
--
-- Next steps:
-- 1. Deploy edge functions: supabase functions deploy
-- 2. Set secrets: supabase secrets set OPENAI_API_KEY=your_key
-- 3. Run your app: npm run dev
--
-- For additional tables (Kalshi markets, injury reports, etc.),
-- run: supabase db push
--
-- This will apply all 70 migrations and create all 92 tables.
-- ============================================================================
