-- Create model_predictions table for ML predictions
CREATE TABLE IF NOT EXISTS public.model_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  prediction_type TEXT NOT NULL, -- 'moneyline', 'spread', 'total', etc.
  predicted_outcome TEXT,
  predicted_value NUMERIC,
  edge_percentage NUMERIC DEFAULT 0,
  confidence_score NUMERIC DEFAULT 0,
  model_version TEXT,
  feature_values JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  game_date TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_model_predictions_event_id ON public.model_predictions(event_id);
CREATE INDEX idx_model_predictions_sport ON public.model_predictions(sport);
CREATE INDEX idx_model_predictions_created_at ON public.model_predictions(created_at DESC);

ALTER TABLE public.model_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view model predictions"
  ON public.model_predictions
  FOR SELECT
  USING (true);

-- Create sharp_money_signals table for sharp money tracking
CREATE TABLE IF NOT EXISTS public.sharp_money_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT,
  sharp_percentage NUMERIC DEFAULT 50,
  public_percentage NUMERIC DEFAULT 50,
  line_movement_indicator TEXT,
  signal_strength TEXT, -- 'weak', 'moderate', 'strong'
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_sharp_signals_event_id ON public.sharp_money_signals(event_id);
CREATE INDEX idx_sharp_signals_detected_at ON public.sharp_money_signals(detected_at DESC);

ALTER TABLE public.sharp_money_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view sharp money signals"
  ON public.sharp_money_signals
  FOR SELECT
  USING (true);

-- Create line_movement_history table for tracking line changes
CREATE TABLE IF NOT EXISTS public.line_movement_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_key TEXT NOT NULL DEFAULT 'h2h',
  spread NUMERIC,
  total NUMERIC,
  moneyline_home NUMERIC,
  moneyline_away NUMERIC,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_line_movement_event_id ON public.line_movement_history(event_id);
CREATE INDEX idx_line_movement_recorded_at ON public.line_movement_history(recorded_at DESC);

ALTER TABLE public.line_movement_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view line movement history"
  ON public.line_movement_history
  FOR SELECT
  USING (true);

-- Create opening_closing_lines table
CREATE TABLE IF NOT EXISTS public.opening_closing_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  sport TEXT NOT NULL,
  league TEXT,
  opening_spread NUMERIC,
  closing_spread NUMERIC,
  opening_total NUMERIC,
  closing_total NUMERIC,
  opening_moneyline_home NUMERIC,
  opening_moneyline_away NUMERIC,
  closing_moneyline_home NUMERIC,
  closing_moneyline_away NUMERIC,
  opened_at TIMESTAMP WITH TIME ZONE,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_opening_closing_event_id ON public.opening_closing_lines(event_id);

ALTER TABLE public.opening_closing_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view opening/closing lines"
  ON public.opening_closing_lines
  FOR SELECT
  USING (true);

-- Create betting_odds_fetch_log table
CREATE TABLE IF NOT EXISTS public.betting_odds_fetch_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sports_fetched TEXT[] NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  events_count INTEGER DEFAULT 0,
  odds_count INTEGER DEFAULT 0,
  api_requests_remaining INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_fetch_log_created_at ON public.betting_odds_fetch_log(created_at DESC);

ALTER TABLE public.betting_odds_fetch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view fetch logs"
  ON public.betting_odds_fetch_log
  FOR SELECT
  USING (true);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info', -- 'info', 'success', 'warning', 'error', 'bet_alert'
  read BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications"
  ON public.notifications
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create user_alert_preferences table
CREATE TABLE IF NOT EXISTS public.user_alert_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  sharp_money_alerts BOOLEAN DEFAULT true,
  line_movement_alerts BOOLEAN DEFAULT true,
  arbitrage_alerts BOOLEAN DEFAULT true,
  injury_alerts BOOLEAN DEFAULT true,
  value_bet_alerts BOOLEAN DEFAULT true,
  min_edge_threshold NUMERIC DEFAULT 3.0,
  notification_methods JSONB DEFAULT '{"email": true, "push": false}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_prefs_user_id ON public.user_alert_preferences(user_id);

ALTER TABLE public.user_alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own alert preferences"
  ON public.user_alert_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert preferences"
  ON public.user_alert_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert preferences"
  ON public.user_alert_preferences
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create trigger for updating updated_at columns
CREATE TRIGGER update_opening_closing_lines_updated_at
  BEFORE UPDATE ON public.opening_closing_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_alert_preferences_updated_at
  BEFORE UPDATE ON public.user_alert_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();