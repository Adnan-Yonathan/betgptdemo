-- Phase 7: Smart Alerts and Predictive Analytics
-- This migration creates tables for intelligent alerts and performance predictions

-- =====================================================
-- TABLE: smart_alerts
-- PURPOSE: Store context-aware intelligent alerts for users
-- =====================================================

CREATE TABLE IF NOT EXISTS public.smart_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert details
  alert_type TEXT NOT NULL CHECK (alert_type IN ('opportunity', 'warning', 'goal', 'strategy', 'market', 'achievement')),
  priority TEXT NOT NULL CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,

  -- Actions
  is_actionable BOOLEAN DEFAULT false,
  actions JSONB DEFAULT '[]'::JSONB,
  /*
  Example actions structure:
  [
    {"label": "View Bet", "action": "view_bet", "params": {"betId": "123"}},
    {"label": "Adjust Strategy", "action": "open_playbook", "params": {"playbookId": "456"}}
  ]
  */

  -- Related entities
  related_bet_id UUID REFERENCES public.bets(id),
  related_goal_id UUID REFERENCES public.user_goals(id),
  related_insight_id UUID REFERENCES public.ai_insights(id),
  related_playbook_id UUID REFERENCES public.betting_playbooks(id),

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Status
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'acted', 'dismissed')),
  viewed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,

  -- Expiration
  expires_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_smart_alerts_user_status ON public.smart_alerts(user_id, status, created_at DESC);
CREATE INDEX idx_smart_alerts_priority ON public.smart_alerts(user_id, priority, created_at DESC);
CREATE INDEX idx_smart_alerts_type ON public.smart_alerts(user_id, alert_type);
CREATE INDEX idx_smart_alerts_expires ON public.smart_alerts(expires_at) WHERE expires_at IS NOT NULL AND status = 'unread';

-- Enable RLS
ALTER TABLE public.smart_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own alerts"
  ON public.smart_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own alerts"
  ON public.smart_alerts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can create alerts"
  ON public.smart_alerts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- TABLE: predictions
-- PURPOSE: Store performance predictions and forecasts
-- =====================================================

CREATE TABLE IF NOT EXISTS public.predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Prediction details
  prediction_type TEXT NOT NULL CHECK (prediction_type IN ('performance', 'streak', 'bankroll', 'strategy', 'goal')),
  metric TEXT NOT NULL, -- 'win_rate', 'roi', 'bankroll', 'profit_loss', etc.

  -- Values
  current_value NUMERIC NOT NULL,
  predicted_value NUMERIC NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

  -- Range
  confidence_interval_lower NUMERIC,
  confidence_interval_upper NUMERIC,

  -- Context
  timeframe TEXT NOT NULL, -- '7_days', '30_days', '90_days', 'season'
  methodology TEXT, -- 'time_series', 'regression', 'moving_average', 'trend_analysis'
  assumptions JSONB DEFAULT '[]'::JSONB,

  -- Validation (filled in when prediction period completes)
  actual_value NUMERIC,
  prediction_error NUMERIC,
  was_accurate BOOLEAN,

  -- Metadata
  metadata JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  prediction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  target_date TIMESTAMPTZ NOT NULL,
  validated_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_predictions_user_date ON public.predictions(user_id, prediction_date DESC);
CREATE INDEX idx_predictions_validation ON public.predictions(user_id, target_date) WHERE validated_at IS NULL;
CREATE INDEX idx_predictions_user_type ON public.predictions(user_id, prediction_type, metric);

-- Enable RLS
ALTER TABLE public.predictions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own predictions"
  ON public.predictions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage predictions"
  ON public.predictions FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTION: generate_smart_alerts
-- PURPOSE: Generate context-aware alerts for a user
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_smart_alerts(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_alerts_created INTEGER := 0;
  v_preferences RECORD;
  v_recent_bets RECORD;
  v_goals RECORD;
BEGIN
  -- Get user preferences
  SELECT * INTO v_preferences
  FROM public.user_preferences
  WHERE user_id = p_user_id;

  -- =============================
  -- OPPORTUNITY ALERT: High Win Rate Pattern
  -- =============================
  FOR v_recent_bets IN
    SELECT
      league,
      bet_type,
      COUNT(*) as total_bets,
      COUNT(*) FILTER (WHERE result = 'won') as wins,
      (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 as win_rate,
      SUM(profit_loss) as profit_loss
    FROM bets
    WHERE user_id = p_user_id
      AND result IS NOT NULL
      AND placed_at >= NOW() - INTERVAL '30 days'
    GROUP BY league, bet_type
    HAVING COUNT(*) >= 5
      AND (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 > 65
  LOOP
    INSERT INTO public.smart_alerts (
      user_id,
      alert_type,
      priority,
      title,
      message,
      is_actionable,
      metadata
    ) VALUES (
      p_user_id,
      'opportunity',
      'high',
      format('Hot Streak in %s %s', v_recent_bets.league, v_recent_bets.bet_type),
      format('You''re %s-%s (%s%% win rate) on %s %s bets in the last 30 days. Consider increasing exposure here.',
        v_recent_bets.wins,
        v_recent_bets.total_bets - v_recent_bets.wins,
        ROUND(v_recent_bets.win_rate, 1),
        v_recent_bets.league,
        v_recent_bets.bet_type),
      true,
      jsonb_build_object(
        'league', v_recent_bets.league,
        'betType', v_recent_bets.bet_type,
        'winRate', ROUND(v_recent_bets.win_rate, 2),
        'profitLoss', ROUND(v_recent_bets.profit_loss, 2)
      )
    )
    ON CONFLICT DO NOTHING;

    v_alerts_created := v_alerts_created + 1;
  END LOOP;

  -- =============================
  -- WARNING ALERT: Tilt Detection
  -- =============================
  WITH recent_losses AS (
    SELECT
      placed_at,
      amount,
      LAG(result) OVER (ORDER BY placed_at) as prev_result,
      LAG(amount) OVER (ORDER BY placed_at) as prev_amount
    FROM bets
    WHERE user_id = p_user_id
      AND placed_at >= NOW() - INTERVAL '24 hours'
      AND result IS NOT NULL
    ORDER BY placed_at DESC
    LIMIT 5
  )
  SELECT COUNT(*) INTO v_recent_bets
  FROM recent_losses
  WHERE prev_result = 'lost'
    AND amount > prev_amount * 1.5;

  IF v_recent_bets >= 2 THEN
    INSERT INTO public.smart_alerts (
      user_id,
      alert_type,
      priority,
      title,
      message,
      is_actionable,
      actions
    ) VALUES (
      p_user_id,
      'warning',
      'critical',
      'Tilt Warning: Increased Stakes After Losses',
      format('Detected %s instances of increased bet sizes after losses in the last 24 hours. Consider taking a break.', v_recent_bets),
      true,
      jsonb_build_array(
        jsonb_build_object('label', 'View Betting Patterns', 'action', 'view_patterns')
      )
    )
    ON CONFLICT DO NOTHING;

    v_alerts_created := v_alerts_created + 1;
  END IF;

  -- =============================
  -- GOAL ALERT: Goal Progress
  -- =============================
  FOR v_goals IN
    SELECT
      id,
      goal_name,
      goal_type,
      target_value,
      current_value,
      end_date,
      ((current_value / NULLIF(target_value, 0)) * 100) as progress_pct
    FROM public.user_goals
    WHERE user_id = p_user_id
      AND is_active = true
      AND is_achieved = false
  LOOP
    -- Alert at 50%, 75%, and 90% progress
    IF v_goals.progress_pct >= 50 AND v_goals.progress_pct < 60 THEN
      INSERT INTO public.smart_alerts (
        user_id,
        alert_type,
        priority,
        title,
        message,
        related_goal_id,
        is_actionable
      ) VALUES (
        p_user_id,
        'goal',
        'medium',
        format('Halfway to "%s"', v_goals.goal_name),
        format('You''re %s%% of the way to your goal. Keep up the great work!', ROUND(v_goals.progress_pct, 0)),
        v_goals.id,
        true
      )
      ON CONFLICT DO NOTHING;

      v_alerts_created := v_alerts_created + 1;
    ELSIF v_goals.progress_pct >= 75 AND v_goals.progress_pct < 80 THEN
      INSERT INTO public.smart_alerts (
        user_id,
        alert_type,
        priority,
        title,
        message,
        related_goal_id,
        is_actionable
      ) VALUES (
        p_user_id,
        'goal',
        'high',
        format('Almost There: "%s"', v_goals.goal_name),
        format('You''re at %s%% - just a little more to reach your goal!', ROUND(v_goals.progress_pct, 0)),
        v_goals.id,
        true
      )
      ON CONFLICT DO NOTHING;

      v_alerts_created := v_alerts_created + 1;
    ELSIF v_goals.progress_pct >= 90 AND v_goals.progress_pct < 100 THEN
      INSERT INTO public.smart_alerts (
        user_id,
        alert_type,
        priority,
        title,
        message,
        related_goal_id,
        is_actionable
      ) VALUES (
        p_user_id,
        'goal',
        'high',
        format('So Close: "%s"', v_goals.goal_name),
        format('You''re at %s%% - almost at your goal!', ROUND(v_goals.progress_pct, 0)),
        v_goals.id,
        true
      )
      ON CONFLICT DO NOTHING;

      v_alerts_created := v_alerts_created + 1;
    END IF;
  END LOOP;

  -- =============================
  -- ACHIEVEMENT ALERT: Milestones
  -- =============================
  DECLARE
    v_total_bets INTEGER;
    v_bankroll NUMERIC;
  BEGIN
    SELECT COUNT(*) INTO v_total_bets
    FROM bets
    WHERE user_id = p_user_id
      AND result IS NOT NULL;

    -- Milestone alerts for bet counts
    IF v_total_bets IN (10, 25, 50, 100, 250, 500, 1000) THEN
      INSERT INTO public.smart_alerts (
        user_id,
        alert_type,
        priority,
        title,
        message,
        is_actionable
      ) VALUES (
        p_user_id,
        'achievement',
        'medium',
        format('Milestone: %s Bets Tracked!', v_total_bets),
        format('Congratulations! You''ve tracked %s bets. Your data is becoming more valuable with each bet.', v_total_bets),
        false
      )
      ON CONFLICT DO NOTHING;

      v_alerts_created := v_alerts_created + 1;
    END IF;

    -- Bankroll milestones
    IF v_preferences.current_bankroll IS NOT NULL THEN
      v_bankroll := v_preferences.current_bankroll;

      IF v_bankroll >= 5000 AND v_bankroll < 5100 THEN
        INSERT INTO public.smart_alerts (
          user_id,
          alert_type,
          priority,
          title,
          message,
          is_actionable
        ) VALUES (
          p_user_id,
          'achievement',
          'high',
          'Bankroll Milestone: $5,000!',
          format('Your bankroll has reached $%s. Great bankroll management!', ROUND(v_bankroll, 0)),
          false
        )
        ON CONFLICT DO NOTHING;

        v_alerts_created := v_alerts_created + 1;
      END IF;
    END IF;
  END;

  RETURN v_alerts_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: generate_predictions
-- PURPOSE: Generate performance predictions for a user
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_predictions(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_predictions_created INTEGER := 0;
  v_stats RECORD;
  v_trend NUMERIC;
  v_predicted_value NUMERIC;
  v_confidence NUMERIC;
BEGIN
  -- =============================
  -- PREDICTION: 30-Day ROI
  -- =============================
  SELECT
    (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100 as current_roi,
    COUNT(*) as total_bets,
    AVG((profit_loss / NULLIF(amount, 0)) * 100) as avg_bet_roi
  INTO v_stats
  FROM bets
  WHERE user_id = p_user_id
    AND result IS NOT NULL
    AND placed_at >= NOW() - INTERVAL '30 days';

  IF v_stats.total_bets >= 10 THEN
    -- Simple trend-based prediction
    v_predicted_value := v_stats.current_roi * 1.05; -- Assume slight improvement
    v_confidence := LEAST(90, 50 + (v_stats.total_bets / 2.0)); -- More bets = higher confidence

    INSERT INTO public.predictions (
      user_id,
      prediction_type,
      metric,
      current_value,
      predicted_value,
      confidence,
      confidence_interval_lower,
      confidence_interval_upper,
      timeframe,
      methodology,
      target_date
    ) VALUES (
      p_user_id,
      'performance',
      'roi',
      ROUND(v_stats.current_roi, 2),
      ROUND(v_predicted_value, 2),
      ROUND(v_confidence, 0),
      ROUND(v_predicted_value * 0.8, 2),
      ROUND(v_predicted_value * 1.2, 2),
      '30_days',
      'trend_analysis',
      NOW() + INTERVAL '30 days'
    )
    ON CONFLICT DO NOTHING;

    v_predictions_created := v_predictions_created + 1;
  END IF;

  -- =============================
  -- PREDICTION: Win Rate Forecast
  -- =============================
  SELECT
    (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 as win_rate,
    COUNT(*) as total_bets
  INTO v_stats
  FROM bets
  WHERE user_id = p_user_id
    AND result IS NOT NULL
    AND placed_at >= NOW() - INTERVAL '60 days';

  IF v_stats.total_bets >= 20 THEN
    -- Predict slight regression to mean
    v_predicted_value := v_stats.win_rate * 0.98 + 50 * 0.02; -- 98% current, 2% regression to 50%
    v_confidence := LEAST(85, 40 + (v_stats.total_bets / 3.0));

    INSERT INTO public.predictions (
      user_id,
      prediction_type,
      metric,
      current_value,
      predicted_value,
      confidence,
      confidence_interval_lower,
      confidence_interval_upper,
      timeframe,
      methodology,
      target_date
    ) VALUES (
      p_user_id,
      'performance',
      'win_rate',
      ROUND(v_stats.win_rate, 2),
      ROUND(v_predicted_value, 2),
      ROUND(v_confidence, 0),
      ROUND(v_predicted_value - 3, 2),
      ROUND(v_predicted_value + 3, 2),
      '30_days',
      'regression_analysis',
      NOW() + INTERVAL '30 days'
    )
    ON CONFLICT DO NOTHING;

    v_predictions_created := v_predictions_created + 1;
  END IF;

  RETURN v_predictions_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: cleanup_expired_alerts
-- PURPOSE: Remove expired alerts
-- =====================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_alerts()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.smart_alerts
  WHERE expires_at IS NOT NULL
    AND expires_at < NOW()
    AND status IN ('unread', 'read');

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: validate_predictions
-- PURPOSE: Validate predictions that have reached their target date
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_predictions()
RETURNS INTEGER AS $$
DECLARE
  v_prediction RECORD;
  v_actual_value NUMERIC;
  v_validated INTEGER := 0;
BEGIN
  FOR v_prediction IN
    SELECT *
    FROM public.predictions
    WHERE validated_at IS NULL
      AND target_date <= NOW()
  LOOP
    -- Calculate actual value based on prediction type and metric
    CASE v_prediction.metric
      WHEN 'roi' THEN
        SELECT (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100
        INTO v_actual_value
        FROM bets
        WHERE user_id = v_prediction.user_id
          AND result IS NOT NULL
          AND placed_at >= v_prediction.prediction_date
          AND placed_at <= v_prediction.target_date;

      WHEN 'win_rate' THEN
        SELECT (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100
        INTO v_actual_value
        FROM bets
        WHERE user_id = v_prediction.user_id
          AND result IS NOT NULL
          AND placed_at >= v_prediction.prediction_date
          AND placed_at <= v_prediction.target_date;

      ELSE
        v_actual_value := NULL;
    END CASE;

    IF v_actual_value IS NOT NULL THEN
      -- Calculate prediction error
      DECLARE
        v_error NUMERIC;
        v_was_accurate BOOLEAN;
      BEGIN
        v_error := ABS(v_actual_value - v_prediction.predicted_value);
        v_was_accurate := v_actual_value BETWEEN v_prediction.confidence_interval_lower AND v_prediction.confidence_interval_upper;

        UPDATE public.predictions
        SET
          actual_value = ROUND(v_actual_value, 2),
          prediction_error = ROUND(v_error, 2),
          was_accurate = v_was_accurate,
          validated_at = NOW()
        WHERE id = v_prediction.id;

        v_validated := v_validated + 1;
      END;
    END IF;
  END LOOP;

  RETURN v_validated;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_smart_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_predictions TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_predictions TO authenticated;

COMMENT ON TABLE public.smart_alerts IS 'Stores context-aware intelligent alerts for users';
COMMENT ON TABLE public.predictions IS 'Stores performance predictions and forecasts';
COMMENT ON FUNCTION public.generate_smart_alerts IS 'Generates context-aware alerts for a user';
COMMENT ON FUNCTION public.generate_predictions IS 'Generates performance predictions for a user';
COMMENT ON FUNCTION public.cleanup_expired_alerts IS 'Removes expired alerts';
COMMENT ON FUNCTION public.validate_predictions IS 'Validates predictions that have reached their target date';
