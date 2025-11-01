-- Create missing tables for intelligence features
CREATE TABLE IF NOT EXISTS public.pattern_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pattern_type TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  sport TEXT,
  league TEXT,
  affected_bets JSONB,
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  confidence_level NUMERIC NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  sport TEXT,
  league TEXT,
  metadata JSONB,
  is_read BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.smart_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  sport TEXT,
  league TEXT,
  event_id TEXT,
  market_ticker TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  dismissed BOOLEAN NOT NULL DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.live_score_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  game_status TEXT NOT NULL,
  game_time TEXT,
  period TEXT,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(event_id)
);

CREATE TABLE IF NOT EXISTS public.betting_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pattern_name TEXT NOT NULL,
  win_rate NUMERIC NOT NULL DEFAULT 0,
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_profit NUMERIC NOT NULL DEFAULT 0,
  avg_odds NUMERIC NOT NULL DEFAULT 0,
  sport TEXT,
  league TEXT,
  bet_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.advanced_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  metric_date DATE NOT NULL,
  sharp_ratio NUMERIC NOT NULL DEFAULT 0,
  closing_line_value NUMERIC NOT NULL DEFAULT 0,
  roi_by_sport JSONB,
  best_bet_types JSONB,
  worst_bet_types JSONB,
  time_analysis JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, metric_date)
);

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  theme TEXT NOT NULL DEFAULT 'dark',
  notification_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_settle_bets BOOLEAN NOT NULL DEFAULT false,
  default_stake_unit NUMERIC NOT NULL DEFAULT 1,
  favorite_sports JSONB,
  favorite_leagues JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS public.bankroll_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL,
  bankroll NUMERIC NOT NULL DEFAULT 0,
  daily_profit_loss NUMERIC NOT NULL DEFAULT 0,
  bets_placed INTEGER NOT NULL DEFAULT 0,
  bets_won INTEGER NOT NULL DEFAULT 0,
  bets_lost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  goal_type TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.pattern_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_score_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.betting_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advanced_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bankroll_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pattern_detections
CREATE POLICY "Users can view their own pattern detections"
  ON public.pattern_detections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pattern detections"
  ON public.pattern_detections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for ai_insights
CREATE POLICY "Users can view their own ai insights"
  ON public.ai_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ai insights"
  ON public.ai_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ai insights"
  ON public.ai_insights FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for smart_alerts
CREATE POLICY "Users can view their own smart alerts"
  ON public.smart_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own smart alerts"
  ON public.smart_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own smart alerts"
  ON public.smart_alerts FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for live_score_cache (public read)
CREATE POLICY "Anyone can view live scores"
  ON public.live_score_cache FOR SELECT
  USING (true);

-- Create RLS policies for betting_patterns
CREATE POLICY "Users can view their own betting patterns"
  ON public.betting_patterns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own betting patterns"
  ON public.betting_patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own betting patterns"
  ON public.betting_patterns FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for advanced_metrics
CREATE POLICY "Users can view their own advanced metrics"
  ON public.advanced_metrics FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own advanced metrics"
  ON public.advanced_metrics FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own advanced metrics"
  ON public.advanced_metrics FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for user_preferences
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Create RLS policies for bankroll_history
CREATE POLICY "Users can view their own bankroll history"
  ON public.bankroll_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bankroll history"
  ON public.bankroll_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Create RLS policies for user_goals
CREATE POLICY "Users can view their own goals"
  ON public.user_goals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own goals"
  ON public.user_goals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
  ON public.user_goals FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
  ON public.user_goals FOR DELETE
  USING (auth.uid() = user_id);

-- Create database functions
CREATE OR REPLACE FUNCTION public.get_user_unread_alerts(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  alert_type TEXT,
  title TEXT,
  message TEXT,
  severity TEXT,
  sport TEXT,
  league TEXT,
  event_id TEXT,
  market_ticker TEXT,
  is_read BOOLEAN,
  dismissed BOOLEAN,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT sa.id, sa.alert_type, sa.title, sa.message, sa.severity, 
         sa.sport, sa.league, sa.event_id, sa.market_ticker,
         sa.is_read, sa.dismissed, sa.action_url, sa.metadata, sa.created_at
  FROM public.smart_alerts sa
  WHERE sa.user_id = p_user_id 
    AND sa.is_read = false 
    AND sa.dismissed = false
  ORDER BY sa.created_at DESC
  LIMIT 50;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_alert_as_read(p_alert_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.smart_alerts
  SET is_read = true
  WHERE id = p_alert_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_active_bets_live(p_user_id UUID)
RETURNS TABLE (
  bet_id UUID,
  event_id TEXT,
  sport TEXT,
  league TEXT,
  description TEXT,
  amount NUMERIC,
  odds NUMERIC,
  potential_return NUMERIC,
  team_bet_on TEXT,
  bet_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  home_team TEXT,
  away_team TEXT,
  home_score INTEGER,
  away_score INTEGER,
  game_status TEXT,
  game_time TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.id as bet_id,
    b.event_id,
    b.sport,
    b.league,
    b.description,
    b.amount,
    b.odds,
    b.potential_return,
    b.team_bet_on,
    b.bet_type,
    b.created_at,
    COALESCE(lsc.home_team, ss.home_team) as home_team,
    COALESCE(lsc.away_team, ss.away_team) as away_team,
    COALESCE(lsc.home_score, ss.home_score, 0) as home_score,
    COALESCE(lsc.away_score, ss.away_score, 0) as away_score,
    COALESCE(lsc.game_status, ss.game_status, 'pending') as game_status,
    lsc.game_time
  FROM public.bets b
  LEFT JOIN public.live_score_cache lsc ON b.event_id = lsc.event_id
  LEFT JOIN public.sports_scores ss ON b.event_id = ss.event_id
  WHERE b.user_id = p_user_id 
    AND b.outcome = 'pending'
  ORDER BY b.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_bankroll_history(p_user_id UUID, p_days INTEGER DEFAULT 30)
RETURNS TABLE (
  date DATE,
  bankroll NUMERIC,
  daily_profit_loss NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT bh.date, bh.bankroll, bh.daily_profit_loss
  FROM public.bankroll_history bh
  WHERE bh.user_id = p_user_id 
    AND bh.date >= CURRENT_DATE - p_days
  ORDER BY bh.date ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_active_goals(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  goal_type TEXT,
  target_value NUMERIC,
  current_value NUMERIC,
  deadline TIMESTAMP WITH TIME ZONE,
  status TEXT,
  progress_percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ug.id,
    ug.goal_type,
    ug.target_value,
    ug.current_value,
    ug.deadline,
    ug.status,
    CASE 
      WHEN ug.target_value > 0 THEN (ug.current_value / ug.target_value * 100)
      ELSE 0
    END as progress_percentage
  FROM public.user_goals ug
  WHERE ug.user_id = p_user_id 
    AND ug.status = 'active'
  ORDER BY ug.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_performance_breakdown(p_user_id UUID)
RETURNS TABLE (
  sport TEXT,
  total_bets INTEGER,
  total_won INTEGER,
  total_lost INTEGER,
  win_rate NUMERIC,
  total_profit NUMERIC,
  roi NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    b.sport,
    COUNT(*)::INTEGER as total_bets,
    COUNT(CASE WHEN b.outcome = 'won' THEN 1 END)::INTEGER as total_won,
    COUNT(CASE WHEN b.outcome = 'lost' THEN 1 END)::INTEGER as total_lost,
    CASE 
      WHEN COUNT(CASE WHEN b.outcome IN ('won', 'lost') THEN 1 END) > 0 
      THEN (COUNT(CASE WHEN b.outcome = 'won' THEN 1 END)::NUMERIC / 
            COUNT(CASE WHEN b.outcome IN ('won', 'lost') THEN 1 END)::NUMERIC * 100)
      ELSE 0
    END as win_rate,
    COALESCE(SUM(CASE 
      WHEN b.outcome = 'won' THEN b.actual_return - b.amount
      WHEN b.outcome = 'lost' THEN -b.amount
      ELSE 0
    END), 0) as total_profit,
    CASE 
      WHEN SUM(b.amount) > 0 
      THEN (SUM(CASE 
        WHEN b.outcome = 'won' THEN b.actual_return - b.amount
        WHEN b.outcome = 'lost' THEN -b.amount
        ELSE 0
      END) / SUM(b.amount) * 100)
      ELSE 0
    END as roi
  FROM public.bets b
  WHERE b.user_id = p_user_id
  GROUP BY b.sport
  ORDER BY total_bets DESC;
END;
$$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_pattern_detections_user_id ON public.pattern_detections(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_user_id ON public.ai_insights(user_id);
CREATE INDEX IF NOT EXISTS idx_smart_alerts_user_id ON public.smart_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_live_score_cache_event_id ON public.live_score_cache(event_id);
CREATE INDEX IF NOT EXISTS idx_betting_patterns_user_id ON public.betting_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_advanced_metrics_user_id ON public.advanced_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_bankroll_history_user_id ON public.bankroll_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON public.user_goals(user_id);