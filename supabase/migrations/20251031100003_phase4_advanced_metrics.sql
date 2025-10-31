-- Phase 4: Advanced Statistical Models & EV Analysis
-- Part 2b: Advanced Metrics System
-- Tracks sophisticated performance metrics beyond basic win rate

CREATE TABLE IF NOT EXISTS public.advanced_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Overall metrics
  total_bets INTEGER DEFAULT 0,
  total_wagered NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,
  roi_percentage NUMERIC DEFAULT 0, -- (Profit / Wagered) * 100
  yield_percentage NUMERIC DEFAULT 0, -- ROI excluding pushes
  sharpe_ratio NUMERIC DEFAULT 0, -- Risk-adjusted returns

  -- CLV metrics (Closing Line Value - #1 predictor of success)
  avg_clv_points NUMERIC DEFAULT 0, -- Average point improvement vs closing
  avg_clv_dollars NUMERIC DEFAULT 0, -- Average dollar value of CLV
  pct_beat_closing_line NUMERIC DEFAULT 0, -- % of bets that beat closing
  total_clv_dollars NUMERIC DEFAULT 0, -- Cumulative CLV value

  -- Kelly metrics
  avg_kelly_efficiency NUMERIC DEFAULT 0, -- How closely user follows Kelly
  pct_overbets INTEGER DEFAULT 0, -- % of bets that exceed recommended size
  pct_underbets INTEGER DEFAULT 0, -- % of bets below recommended size

  -- EV metrics
  estimated_total_ev NUMERIC DEFAULT 0, -- Sum of all expected values
  actual_vs_estimated_ev NUMERIC DEFAULT 0, -- Realization accuracy
  ev_correlation NUMERIC DEFAULT 0, -- How well EV predicts outcomes

  -- Hit rates by odds range
  favorite_hit_rate NUMERIC DEFAULT 0, -- Favorites (odds < -150)
  favorite_bets INTEGER DEFAULT 0,
  slight_favorite_hit_rate NUMERIC DEFAULT 0, -- -150 to -110
  slight_favorite_bets INTEGER DEFAULT 0,
  pick_em_hit_rate NUMERIC DEFAULT 0, -- -110 to +110
  pick_em_bets INTEGER DEFAULT 0,
  slight_underdog_hit_rate NUMERIC DEFAULT 0, -- +110 to +150
  slight_underdog_bets INTEGER DEFAULT 0,
  underdog_hit_rate NUMERIC DEFAULT 0, -- > +150
  underdog_bets INTEGER DEFAULT 0,

  -- Performance by market type
  spread_roi NUMERIC DEFAULT 0,
  spread_bets INTEGER DEFAULT 0,
  total_roi NUMERIC DEFAULT 0,
  total_bets INTEGER DEFAULT 0,
  moneyline_roi NUMERIC DEFAULT 0,
  moneyline_bets INTEGER DEFAULT 0,
  parlay_roi NUMERIC DEFAULT 0,
  parlay_bets INTEGER DEFAULT 0,

  -- Streak analysis
  longest_win_streak INTEGER DEFAULT 0,
  longest_loss_streak INTEGER DEFAULT 0,
  current_streak_type TEXT, -- 'win' or 'loss'
  current_streak_length INTEGER DEFAULT 0,

  -- Time-based patterns
  best_day_of_week TEXT,
  best_day_roi NUMERIC DEFAULT 0,
  worst_day_of_week TEXT,
  worst_day_roi NUMERIC DEFAULT 0,
  weekend_roi NUMERIC DEFAULT 0,
  weekday_roi NUMERIC DEFAULT 0,

  -- Discipline metrics
  avg_bet_size_pct NUMERIC DEFAULT 0, -- Avg bet as % of bankroll
  max_bet_size_pct NUMERIC DEFAULT 0, -- Largest bet as % of bankroll
  bet_size_variance NUMERIC DEFAULT 0, -- Consistency of sizing

  -- Last calculation
  last_calculated_at TIMESTAMPTZ DEFAULT now(),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.advanced_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Users can view their own advanced metrics"
ON public.advanced_metrics
FOR SELECT
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_advanced_metrics_user_id ON public.advanced_metrics(user_id);

-- Function to calculate all advanced metrics for a user
CREATE OR REPLACE FUNCTION public.calculate_advanced_metrics(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_metrics RECORD;
  v_bets RECORD;
  v_roi NUMERIC;
  v_yield NUMERIC;
  v_sharpe NUMERIC;
  v_clv_avg_points NUMERIC;
  v_clv_avg_dollars NUMERIC;
  v_clv_pct NUMERIC;
  v_kelly_efficiency NUMERIC;
  v_ev_correlation NUMERIC;
  v_favorite_hr NUMERIC;
  v_underdog_hr NUMERIC;
  v_spread_roi NUMERIC;
  v_total_roi NUMERIC;
  v_moneyline_roi NUMERIC;
BEGIN
  -- Get overall stats
  SELECT
    COUNT(*) as total_bets,
    SUM(amount) as total_wagered,
    SUM(profit_loss) as total_pl
  INTO v_bets
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss', 'push');

  -- Calculate ROI
  v_roi := CASE
    WHEN v_bets.total_wagered > 0
    THEN (v_bets.total_pl / v_bets.total_wagered) * 100
    ELSE 0
  END;

  -- Calculate Yield (excluding pushes)
  SELECT
    (SUM(profit_loss) / SUM(amount)) * 100
  INTO v_yield
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss');

  -- Calculate Sharpe Ratio (simplified)
  SELECT
    CASE
      WHEN STDDEV(profit_loss) > 0
      THEN AVG(profit_loss) / STDDEV(profit_loss)
      ELSE 0
    END
  INTO v_sharpe
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss');

  -- Calculate CLV metrics
  SELECT
    AVG(clv_points),
    AVG(clv_dollars),
    (COUNT(*) FILTER (WHERE beat_closing_line = true)::NUMERIC / COUNT(*)::NUMERIC) * 100
  INTO
    v_clv_avg_points,
    v_clv_avg_dollars,
    v_clv_pct
  FROM public.bet_ev_analysis
  WHERE user_id = p_user_id
    AND clv_dollars IS NOT NULL;

  -- Calculate Kelly efficiency
  SELECT
    AVG(kelly_efficiency)
  INTO v_kelly_efficiency
  FROM public.bet_ev_analysis
  WHERE user_id = p_user_id
    AND kelly_efficiency IS NOT NULL;

  -- Calculate EV correlation
  SELECT
    CORR(expected_value_dollars, actual_profit_loss)
  INTO v_ev_correlation
  FROM public.bet_ev_analysis
  WHERE user_id = p_user_id
    AND actual_profit_loss IS NOT NULL
    AND expected_value_dollars IS NOT NULL;

  -- Calculate hit rates by odds range
  SELECT
    (COUNT(*) FILTER (WHERE outcome = 'win' AND odds < -150)::NUMERIC /
     NULLIF(COUNT(*) FILTER (WHERE odds < -150), 0)::NUMERIC) * 100,
    (COUNT(*) FILTER (WHERE outcome = 'win' AND odds > 150)::NUMERIC /
     NULLIF(COUNT(*) FILTER (WHERE odds > 150), 0)::NUMERIC) * 100
  INTO
    v_favorite_hr,
    v_underdog_hr
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss');

  -- Calculate ROI by market type
  SELECT
    (SUM(profit_loss) FILTER (WHERE market_key = 'spreads') / NULLIF(SUM(amount) FILTER (WHERE market_key = 'spreads'), 0)) * 100,
    (SUM(profit_loss) FILTER (WHERE market_key = 'totals') / NULLIF(SUM(amount) FILTER (WHERE market_key = 'totals'), 0)) * 100,
    (SUM(profit_loss) FILTER (WHERE market_key = 'h2h' OR market_key IS NULL) / NULLIF(SUM(amount) FILTER (WHERE market_key = 'h2h' OR market_key IS NULL), 0)) * 100
  INTO
    v_spread_roi,
    v_total_roi,
    v_moneyline_roi
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss');

  -- Insert or update advanced metrics
  INSERT INTO public.advanced_metrics (
    user_id,
    total_bets,
    total_wagered,
    total_profit_loss,
    roi_percentage,
    yield_percentage,
    sharpe_ratio,
    avg_clv_points,
    avg_clv_dollars,
    pct_beat_closing_line,
    avg_kelly_efficiency,
    ev_correlation,
    favorite_hit_rate,
    underdog_hit_rate,
    spread_roi,
    total_roi,
    moneyline_roi,
    last_calculated_at
  ) VALUES (
    p_user_id,
    v_bets.total_bets,
    v_bets.total_wagered,
    v_bets.total_pl,
    ROUND(v_roi, 2),
    ROUND(COALESCE(v_yield, 0), 2),
    ROUND(COALESCE(v_sharpe, 0), 2),
    ROUND(COALESCE(v_clv_avg_points, 0), 2),
    ROUND(COALESCE(v_clv_avg_dollars, 0), 2),
    ROUND(COALESCE(v_clv_pct, 0), 2),
    ROUND(COALESCE(v_kelly_efficiency, 1.0), 2),
    ROUND(COALESCE(v_ev_correlation, 0), 2),
    ROUND(COALESCE(v_favorite_hr, 0), 2),
    ROUND(COALESCE(v_underdog_hr, 0), 2),
    ROUND(COALESCE(v_spread_roi, 0), 2),
    ROUND(COALESCE(v_total_roi, 0), 2),
    ROUND(COALESCE(v_moneyline_roi, 0), 2),
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_bets = EXCLUDED.total_bets,
    total_wagered = EXCLUDED.total_wagered,
    total_profit_loss = EXCLUDED.total_profit_loss,
    roi_percentage = EXCLUDED.roi_percentage,
    yield_percentage = EXCLUDED.yield_percentage,
    sharpe_ratio = EXCLUDED.sharpe_ratio,
    avg_clv_points = EXCLUDED.avg_clv_points,
    avg_clv_dollars = EXCLUDED.avg_clv_dollars,
    pct_beat_closing_line = EXCLUDED.pct_beat_closing_line,
    avg_kelly_efficiency = EXCLUDED.avg_kelly_efficiency,
    ev_correlation = EXCLUDED.ev_correlation,
    favorite_hit_rate = EXCLUDED.favorite_hit_rate,
    underdog_hit_rate = EXCLUDED.underdog_hit_rate,
    spread_roi = EXCLUDED.spread_roi,
    total_roi = EXCLUDED.total_roi,
    moneyline_roi = EXCLUDED.moneyline_roi,
    last_calculated_at = EXCLUDED.last_calculated_at;

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'total_bets', v_bets.total_bets,
    'roi_percentage', ROUND(v_roi, 2),
    'avg_clv_points', ROUND(COALESCE(v_clv_avg_points, 0), 2),
    'sharpe_ratio', ROUND(COALESCE(v_sharpe, 0), 2)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's performance summary
CREATE OR REPLACE FUNCTION public.get_user_performance_summary(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_metrics RECORD;
  v_patterns RECORD;
BEGIN
  -- Get advanced metrics
  SELECT * INTO v_metrics
  FROM public.advanced_metrics
  WHERE user_id = p_user_id;

  -- Get betting patterns
  SELECT * INTO v_patterns
  FROM public.betting_patterns
  WHERE user_id = p_user_id;

  -- Return combined summary
  RETURN jsonb_build_object(
    'overall', jsonb_build_object(
      'total_bets', COALESCE(v_metrics.total_bets, 0),
      'roi', COALESCE(v_metrics.roi_percentage, 0),
      'total_profit_loss', COALESCE(v_metrics.total_profit_loss, 0),
      'sharpe_ratio', COALESCE(v_metrics.sharpe_ratio, 0)
    ),
    'clv', jsonb_build_object(
      'avg_points', COALESCE(v_metrics.avg_clv_points, 0),
      'avg_dollars', COALESCE(v_metrics.avg_clv_dollars, 0),
      'pct_beat_closing', COALESCE(v_metrics.pct_beat_closing_line, 0)
    ),
    'kelly', jsonb_build_object(
      'efficiency', COALESCE(v_metrics.avg_kelly_efficiency, 0),
      'pct_overbets', COALESCE(v_metrics.pct_overbets, 0)
    ),
    'by_odds', jsonb_build_object(
      'favorites', COALESCE(v_metrics.favorite_hit_rate, 0),
      'underdogs', COALESCE(v_metrics.underdog_hit_rate, 0)
    ),
    'by_market', jsonb_build_object(
      'spreads', COALESCE(v_metrics.spread_roi, 0),
      'totals', COALESCE(v_metrics.total_roi, 0),
      'moneyline', COALESCE(v_metrics.moneyline_roi, 0)
    ),
    'streaks', jsonb_build_object(
      'current_win_streak', COALESCE(v_patterns.current_win_streak, 0),
      'current_loss_streak', COALESCE(v_patterns.current_loss_streak, 0),
      'tilt_score', COALESCE(v_patterns.tilt_score, 0)
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.advanced_metrics TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_advanced_metrics(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_performance_summary(UUID) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.advanced_metrics IS
'Stores sophisticated performance metrics including CLV, Sharpe ratio, Kelly efficiency, and hit rates by odds range.';

COMMENT ON FUNCTION public.calculate_advanced_metrics(UUID) IS
'Calculates comprehensive advanced metrics for a user. Should be run after bets are settled and CLV is calculated.';

COMMENT ON FUNCTION public.get_user_performance_summary(UUID) IS
'Returns a formatted JSON summary of user performance including metrics from both advanced_metrics and betting_patterns.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 4 Part 2b: Advanced Metrics System Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - ROI and Yield calculations';
  RAISE NOTICE '  - Sharpe ratio (risk-adjusted returns)';
  RAISE NOTICE '  - CLV metrics (avg points, dollars, % beat closing)';
  RAISE NOTICE '  - Kelly efficiency tracking';
  RAISE NOTICE '  - Hit rates by odds range (favorites vs underdogs)';
  RAISE NOTICE '  - ROI by market type (spreads, totals, moneyline)';
  RAISE NOTICE '  - EV correlation (prediction accuracy)';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  -- Calculate metrics for a user:';
  RAISE NOTICE '  SELECT calculate_advanced_metrics(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Get performance summary:';
  RAISE NOTICE '  SELECT get_user_performance_summary(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- View metrics:';
  RAISE NOTICE '  SELECT * FROM advanced_metrics WHERE user_id = user_id;';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
