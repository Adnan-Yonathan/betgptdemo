-- Phase 7: AI Insights and Pattern Detection Tables
-- This migration creates tables for storing AI-generated insights and detected betting patterns

-- =====================================================
-- TABLE: ai_insights
-- PURPOSE: Store AI-generated insights about user betting patterns
-- =====================================================

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Insight details
  insight_type TEXT NOT NULL CHECK (insight_type IN ('strength', 'weakness', 'opportunity', 'risk', 'pattern')),
  category TEXT NOT NULL CHECK (category IN ('league', 'bet_type', 'timing', 'bankroll', 'strategy', 'team', 'odds')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation TEXT,

  -- Confidence scoring
  confidence_score NUMERIC NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  confidence_factors JSONB DEFAULT '{}'::JSONB,

  -- Impact metrics
  potential_impact TEXT CHECK (potential_impact IN ('high', 'medium', 'low')),
  impact_metrics JSONB DEFAULT '{}'::JSONB,

  -- Supporting data
  supporting_data JSONB DEFAULT '{}'::JSONB,
  sample_size INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'acted_upon', 'expired')),
  priority INTEGER DEFAULT 0,

  -- User interaction
  viewed_at TIMESTAMPTZ,
  acted_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  feedback TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_ai_insights_user_status ON public.ai_insights(user_id, status, created_at DESC);
CREATE INDEX idx_ai_insights_priority ON public.ai_insights(user_id, priority DESC, created_at DESC);
CREATE INDEX idx_ai_insights_type ON public.ai_insights(user_id, insight_type);
CREATE INDEX idx_ai_insights_expires ON public.ai_insights(expires_at) WHERE expires_at IS NOT NULL AND status = 'active';

-- Enable RLS
ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own insights"
  ON public.ai_insights FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
  ON public.ai_insights FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert insights"
  ON public.ai_insights FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- TABLE: pattern_detections
-- PURPOSE: Store detected betting patterns (strengths, weaknesses, anomalies)
-- =====================================================

CREATE TABLE IF NOT EXISTS public.pattern_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Pattern details
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('strength', 'weakness', 'anomaly')),
  pattern_name TEXT NOT NULL,
  pattern_description TEXT NOT NULL,

  -- Detection data
  occurrences INTEGER NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0 AND confidence <= 100),

  -- Impact analysis
  impact_metrics JSONB DEFAULT '{}'::JSONB,

  -- Examples
  example_bets JSONB DEFAULT '[]'::JSONB,

  -- Recommendation
  recommendation TEXT NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'dismissed', 'resolved')),

  -- First and last occurrence
  first_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_patterns_user_type ON public.pattern_detections(user_id, pattern_type, status);
CREATE INDEX idx_patterns_user_active ON public.pattern_detections(user_id, status) WHERE status = 'active';

-- Enable RLS
ALTER TABLE public.pattern_detections ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own patterns"
  ON public.pattern_detections FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own patterns"
  ON public.pattern_detections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage patterns"
  ON public.pattern_detections FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTION: generate_ai_insights
-- PURPOSE: Generate AI insights for a user based on betting patterns
-- =====================================================

CREATE OR REPLACE FUNCTION public.generate_ai_insights(p_user_id UUID)
RETURNS TABLE (
  insight_type TEXT,
  category TEXT,
  title TEXT,
  description TEXT,
  recommendation TEXT,
  confidence_score NUMERIC,
  potential_impact TEXT,
  supporting_data JSONB,
  sample_size INTEGER
) AS $$
BEGIN
  -- =============================
  -- STRENGTH: High ROI Leagues
  -- =============================
  RETURN QUERY
  SELECT
    'strength'::TEXT AS insight_type,
    'league'::TEXT AS category,
    format('%s Betting Excellence', league_name) AS title,
    format('Your %s betting has a %s%% win rate and %s%% ROI over %s bets',
           league_name,
           ROUND(win_rate::NUMERIC, 1),
           ROUND(roi::NUMERIC, 1),
           total_bets) AS description,
    format('Continue focusing on %s bets. This is your strongest category.', league_name) AS recommendation,
    CASE
      WHEN total_bets >= 50 THEN 95.0
      WHEN total_bets >= 30 THEN 85.0
      WHEN total_bets >= 15 THEN 70.0
      ELSE 55.0
    END AS confidence_score,
    CASE
      WHEN roi >= 15 THEN 'high'
      WHEN roi >= 8 THEN 'medium'
      ELSE 'low'
    END::TEXT AS potential_impact,
    jsonb_build_object(
      'league', league_name,
      'totalBets', total_bets,
      'winRate', ROUND(win_rate::NUMERIC, 2),
      'roi', ROUND(roi::NUMERIC, 2),
      'profitLoss', ROUND(total_profit_loss::NUMERIC, 2),
      'avgStake', ROUND(avg_stake::NUMERIC, 2)
    ) AS supporting_data,
    total_bets AS sample_size
  FROM (
    SELECT
      league AS league_name,
      COUNT(*)::INTEGER AS total_bets,
      (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
      (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100 AS roi,
      SUM(profit_loss) AS total_profit_loss,
      AVG(amount) AS avg_stake
    FROM bets
    WHERE user_id = p_user_id
      AND result IS NOT NULL
      AND league IS NOT NULL
    GROUP BY league
  ) league_stats
  WHERE total_bets >= 10
    AND win_rate > 55
    AND roi > 5;

  -- =============================
  -- WEAKNESS: Low ROI Leagues
  -- =============================
  RETURN QUERY
  SELECT
    'weakness'::TEXT AS insight_type,
    'league'::TEXT AS category,
    format('Struggling with %s Bets', league_name) AS title,
    format('Your %s betting has a %s%% win rate and %s%% ROI over %s bets. You''re losing money in this category.',
           league_name,
           ROUND(win_rate::NUMERIC, 1),
           ROUND(roi::NUMERIC, 1),
           total_bets) AS description,
    format('Consider avoiding %s bets or reducing stake size until you identify what''s working.', league_name) AS recommendation,
    CASE
      WHEN total_bets >= 50 THEN 95.0
      WHEN total_bets >= 30 THEN 85.0
      WHEN total_bets >= 15 THEN 70.0
      ELSE 55.0
    END AS confidence_score,
    CASE
      WHEN roi <= -15 THEN 'high'
      WHEN roi <= -8 THEN 'medium'
      ELSE 'low'
    END::TEXT AS potential_impact,
    jsonb_build_object(
      'league', league_name,
      'totalBets', total_bets,
      'winRate', ROUND(win_rate::NUMERIC, 2),
      'roi', ROUND(roi::NUMERIC, 2),
      'profitLoss', ROUND(total_profit_loss::NUMERIC, 2),
      'avgStake', ROUND(avg_stake::NUMERIC, 2)
    ) AS supporting_data,
    total_bets AS sample_size
  FROM (
    SELECT
      league AS league_name,
      COUNT(*)::INTEGER AS total_bets,
      (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
      (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100 AS roi,
      SUM(profit_loss) AS total_profit_loss,
      AVG(amount) AS avg_stake
    FROM bets
    WHERE user_id = p_user_id
      AND result IS NOT NULL
      AND league IS NOT NULL
    GROUP BY league
  ) league_stats
  WHERE total_bets >= 10
    AND roi < -3;

  -- =============================
  -- STRENGTH: Bet Type Excellence
  -- =============================
  RETURN QUERY
  SELECT
    'strength'::TEXT AS insight_type,
    'bet_type'::TEXT AS category,
    format('%s Betting Mastery', bet_type_name) AS title,
    format('You excel at %s bets with %s%% win rate and %s%% ROI',
           bet_type_name,
           ROUND(win_rate::NUMERIC, 1),
           ROUND(roi::NUMERIC, 1)) AS description,
    format('Double down on %s bets - this is where you shine!', bet_type_name) AS recommendation,
    CASE
      WHEN total_bets >= 40 THEN 90.0
      WHEN total_bets >= 20 THEN 75.0
      ELSE 60.0
    END AS confidence_score,
    CASE
      WHEN roi >= 12 THEN 'high'
      WHEN roi >= 6 THEN 'medium'
      ELSE 'low'
    END::TEXT AS potential_impact,
    jsonb_build_object(
      'betType', bet_type_name,
      'totalBets', total_bets,
      'winRate', ROUND(win_rate::NUMERIC, 2),
      'roi', ROUND(roi::NUMERIC, 2),
      'profitLoss', ROUND(total_profit_loss::NUMERIC, 2)
    ) AS supporting_data,
    total_bets AS sample_size
  FROM (
    SELECT
      bet_type AS bet_type_name,
      COUNT(*)::INTEGER AS total_bets,
      (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
      (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100 AS roi,
      SUM(profit_loss) AS total_profit_loss
    FROM bets
    WHERE user_id = p_user_id
      AND result IS NOT NULL
      AND bet_type IS NOT NULL
    GROUP BY bet_type
  ) bet_type_stats
  WHERE total_bets >= 8
    AND win_rate > 56
    AND roi > 7;

  -- =============================
  -- OPPORTUNITY: Underutilized Strengths
  -- =============================
  RETURN QUERY
  SELECT
    'opportunity'::TEXT AS insight_type,
    'strategy'::TEXT AS category,
    format('Underutilizing %s Betting', league_name) AS title,
    format('You have great results in %s (%s%% win rate, %s%% ROI) but only %s bets placed. Consider increasing exposure.',
           league_name,
           ROUND(win_rate::NUMERIC, 1),
           ROUND(roi::NUMERIC, 1),
           total_bets) AS description,
    format('Look for more %s betting opportunities - you''re profitable here but not betting enough.', league_name) AS recommendation,
    CASE
      WHEN total_bets >= 15 THEN 75.0
      WHEN total_bets >= 10 THEN 65.0
      ELSE 50.0
    END AS confidence_score,
    CASE
      WHEN roi >= 15 THEN 'high'
      WHEN roi >= 10 THEN 'medium'
      ELSE 'low'
    END::TEXT AS potential_impact,
    jsonb_build_object(
      'league', league_name,
      'totalBets', total_bets,
      'winRate', ROUND(win_rate::NUMERIC, 2),
      'roi', ROUND(roi::NUMERIC, 2),
      'potentialIncrease', '2x-3x volume recommended'
    ) AS supporting_data,
    total_bets AS sample_size
  FROM (
    SELECT
      league AS league_name,
      COUNT(*)::INTEGER AS total_bets,
      (COUNT(*) FILTER (WHERE result = 'won')::NUMERIC / NULLIF(COUNT(*), 0)) * 100 AS win_rate,
      (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100 AS roi
    FROM bets
    WHERE user_id = p_user_id
      AND result IS NOT NULL
      AND league IS NOT NULL
    GROUP BY league
  ) league_stats
  WHERE total_bets >= 10
    AND total_bets < 25
    AND win_rate > 58
    AND roi > 10;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: detect_betting_patterns
-- PURPOSE: Detect specific betting patterns (tilt, revenge bets, etc.)
-- =====================================================

CREATE OR REPLACE FUNCTION public.detect_betting_patterns(p_user_id UUID)
RETURNS TABLE (
  pattern_type TEXT,
  pattern_name TEXT,
  description TEXT,
  confidence NUMERIC,
  occurrences INTEGER,
  impact JSONB,
  recommendation TEXT
) AS $$
BEGIN
  -- =============================
  -- PATTERN: Tilt Betting (increased stakes after losses)
  -- =============================
  RETURN QUERY
  WITH loss_sequences AS (
    SELECT
      b1.id AS bet_id,
      b1.amount AS current_amount,
      LAG(b1.amount) OVER (ORDER BY b1.placed_at) AS previous_amount,
      LAG(b1.result) OVER (ORDER BY b1.placed_at) AS previous_result,
      b1.placed_at,
      LAG(b1.placed_at) OVER (ORDER BY b1.placed_at) AS previous_placed_at
    FROM bets b1
    WHERE b1.user_id = p_user_id
      AND b1.result IS NOT NULL
  )
  SELECT
    'weakness'::TEXT AS pattern_type,
    'Tilt Betting'::TEXT AS pattern_name,
    format('Detected %s instances where you increased stakes by 50%%+ within 2 hours after a loss. This is often a sign of emotional betting.',
           COUNT(*)) AS description,
    CASE
      WHEN COUNT(*) >= 10 THEN 90.0
      WHEN COUNT(*) >= 5 THEN 75.0
      WHEN COUNT(*) >= 3 THEN 60.0
      ELSE 45.0
    END AS confidence,
    COUNT(*)::INTEGER AS occurrences,
    jsonb_build_object(
      'avgStakeIncrease', ROUND(AVG(current_amount / NULLIF(previous_amount, 0))::NUMERIC, 2),
      'maxStakeIncrease', ROUND(MAX(current_amount / NULLIF(previous_amount, 0))::NUMERIC, 2),
      'totalOccurrences', COUNT(*)
    ) AS impact,
    'Take a break after losses. Consider implementing a "cooling off" period of at least 2 hours before placing your next bet.' AS recommendation
  FROM loss_sequences
  WHERE previous_result = 'lost'
    AND current_amount > previous_amount * 1.5
    AND placed_at < previous_placed_at + INTERVAL '2 hours'
  HAVING COUNT(*) > 0;

  -- =============================
  -- PATTERN: Win Streak Overconfidence
  -- =============================
  RETURN QUERY
  WITH win_streaks AS (
    SELECT
      b.id,
      b.amount,
      b.placed_at,
      COUNT(*) FILTER (
        WHERE b2.result = 'won'
        AND b2.placed_at < b.placed_at
        AND b2.placed_at > b.placed_at - INTERVAL '7 days'
      ) AS recent_wins,
      AVG(b2.amount) FILTER (
        WHERE b2.placed_at < b.placed_at - INTERVAL '7 days'
        AND b2.placed_at > b.placed_at - INTERVAL '14 days'
      ) AS baseline_stake
    FROM bets b
    CROSS JOIN bets b2
    WHERE b.user_id = p_user_id
      AND b2.user_id = p_user_id
      AND b.result IS NOT NULL
    GROUP BY b.id, b.amount, b.placed_at
  )
  SELECT
    'weakness'::TEXT AS pattern_type,
    'Win Streak Overconfidence'::TEXT AS pattern_name,
    format('Found %s bets where you significantly increased stakes during win streaks. While confidence is good, overexposure during hot streaks can be risky.',
           COUNT(*)) AS description,
    CASE
      WHEN COUNT(*) >= 8 THEN 85.0
      WHEN COUNT(*) >= 4 THEN 70.0
      ELSE 55.0
    END AS confidence,
    COUNT(*)::INTEGER AS occurrences,
    jsonb_build_object(
      'avgStakeIncrease', ROUND(AVG(amount / NULLIF(baseline_stake, 0))::NUMERIC, 2),
      'totalOccurrences', COUNT(*)
    ) AS impact,
    'Maintain consistent bet sizing regardless of recent results. Use Kelly Criterion to guide stake sizes.' AS recommendation
  FROM win_streaks
  WHERE recent_wins >= 4
    AND amount > baseline_stake * 1.8
  HAVING COUNT(*) > 0;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: refresh_ai_insights
-- PURPOSE: Regenerate all AI insights for a user
-- =====================================================

CREATE OR REPLACE FUNCTION public.refresh_ai_insights(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_insights_created INTEGER := 0;
BEGIN
  -- Mark old insights as expired
  UPDATE public.ai_insights
  SET status = 'expired'
  WHERE user_id = p_user_id
    AND status = 'active';

  -- Generate new insights
  INSERT INTO public.ai_insights (
    user_id,
    insight_type,
    category,
    title,
    description,
    recommendation,
    confidence_score,
    potential_impact,
    supporting_data,
    sample_size,
    priority
  )
  SELECT
    p_user_id,
    insight_type,
    category,
    title,
    description,
    recommendation,
    confidence_score,
    potential_impact,
    supporting_data,
    sample_size,
    CASE
      WHEN potential_impact = 'high' THEN 100
      WHEN potential_impact = 'medium' THEN 50
      ELSE 25
    END AS priority
  FROM generate_ai_insights(p_user_id);

  GET DIAGNOSTICS v_insights_created = ROW_COUNT;

  -- Update pattern detections
  DELETE FROM public.pattern_detections
  WHERE user_id = p_user_id;

  INSERT INTO public.pattern_detections (
    user_id,
    pattern_type,
    pattern_name,
    pattern_description,
    occurrences,
    confidence,
    impact_metrics,
    recommendation
  )
  SELECT
    p_user_id,
    pattern_type,
    pattern_name,
    description,
    occurrences,
    confidence,
    impact,
    recommendation
  FROM detect_betting_patterns(p_user_id);

  RETURN v_insights_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_ai_insights TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_betting_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_ai_insights TO authenticated;

COMMENT ON TABLE public.ai_insights IS 'Stores AI-generated insights about user betting patterns';
COMMENT ON TABLE public.pattern_detections IS 'Stores detected betting patterns (strengths, weaknesses, anomalies)';
COMMENT ON FUNCTION public.generate_ai_insights IS 'Generates AI insights for a user based on betting history';
COMMENT ON FUNCTION public.detect_betting_patterns IS 'Detects specific betting patterns like tilt and overconfidence';
COMMENT ON FUNCTION public.refresh_ai_insights IS 'Refreshes all AI insights and pattern detections for a user';
