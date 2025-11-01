-- Phase 3: User Preferences and Intelligence System
-- Part 4: User Insights System
-- Generates actionable insights based on betting patterns

CREATE TABLE IF NOT EXISTS public.user_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Insight details
  insight_type TEXT NOT NULL CHECK (insight_type IN ('strength', 'weakness', 'warning', 'recommendation', 'milestone')),
  insight_text TEXT NOT NULL,
  confidence_score NUMERIC DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 1), -- 0-1 scale
  priority INTEGER DEFAULT 0, -- Higher = more important to show

  -- Supporting data
  supporting_data JSONB DEFAULT '{}'::jsonb, -- Stats, examples, etc.

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_dismissed BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ, -- Some insights expire (e.g., "on losing streak")

  -- Indexes for performance
  INDEX idx_user_insights_user_active (user_id, is_active) WHERE is_active = true
);

-- Enable RLS
ALTER TABLE public.user_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own insights"
ON public.user_insights
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own insights"
ON public.user_insights
FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_user_insights_user_id ON public.user_insights(user_id);
CREATE INDEX idx_user_insights_created_at ON public.user_insights(created_at DESC);

-- Function to generate user insights from betting patterns
CREATE OR REPLACE FUNCTION public.generate_user_insights(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  patterns RECORD;
  insights_created INTEGER := 0;
  insight_id UUID;
  best_league_data JSONB;
  worst_league_data JSONB;
  best_team_data JSONB;
  worst_team_data JSONB;
BEGIN
  -- Get betting patterns
  SELECT * INTO patterns
  FROM public.betting_patterns
  WHERE user_id = p_user_id;

  -- If no patterns exist, calculate them first
  IF NOT FOUND THEN
    PERFORM calculate_user_betting_patterns(p_user_id);
    SELECT * INTO patterns FROM public.betting_patterns WHERE user_id = p_user_id;
  END IF;

  -- Clear old non-dismissed insights
  DELETE FROM public.user_insights
  WHERE user_id = p_user_id
    AND is_dismissed = false
    AND (expires_at < now() OR expires_at IS NULL);

  -- INSIGHT 1: Current winning streak
  IF patterns.current_win_streak >= 3 THEN
    INSERT INTO public.user_insights (
      user_id, insight_type, insight_text, confidence_score, priority, supporting_data, expires_at
    ) VALUES (
      p_user_id,
      'milestone',
      'You''re on a ' || patterns.current_win_streak || '-bet winning streak! Keep up the disciplined betting.',
      1.0,
      90,
      jsonb_build_object('streak_count', patterns.current_win_streak, 'streak_type', 'win'),
      now() + INTERVAL '7 days'
    ) ON CONFLICT DO NOTHING;
    insights_created := insights_created + 1;
  END IF;

  -- INSIGHT 2: Current losing streak (warning)
  IF patterns.current_loss_streak >= 3 THEN
    INSERT INTO public.user_insights (
      user_id, insight_type, insight_text, confidence_score, priority, supporting_data, expires_at
    ) VALUES (
      p_user_id,
      'warning',
      'You''re on a ' || patterns.current_loss_streak || '-bet losing streak. Consider taking a break and reviewing your strategy.',
      1.0,
      95,
      jsonb_build_object('streak_count', patterns.current_loss_streak, 'streak_type', 'loss'),
      now() + INTERVAL '7 days'
    );
    insights_created := insights_created + 1;
  END IF;

  -- INSIGHT 3: High tilt score (warning)
  IF patterns.tilt_score >= 60 THEN
    INSERT INTO public.user_insights (
      user_id, insight_type, insight_text, confidence_score, priority, supporting_data, expires_at
    ) VALUES (
      p_user_id,
      'warning',
      'Your betting patterns suggest you may be on tilt (score: ' || patterns.tilt_score || '/100). Your bet sizes are inconsistent. Stick to your unit size.',
      0.8,
      100,
      jsonb_build_object(
        'tilt_score', patterns.tilt_score,
        'bet_variance', patterns.recent_bet_size_variance,
        'chase_multiplier', patterns.bet_size_after_loss_multiplier
      ),
      now() + INTERVAL '3 days'
    );
    insights_created := insights_created + 1;
  END IF;

  -- INSIGHT 4: Best league performance (strength)
  IF patterns.performance_by_league IS NOT NULL AND patterns.performance_by_league != '{}'::jsonb THEN
    -- Find league with best ROI (min 10 bets)
    SELECT
      key as league,
      value as stats
    INTO best_league_data
    FROM jsonb_each(patterns.performance_by_league)
    WHERE (value->>'total_bets')::int >= 10
    ORDER BY (value->>'roi')::numeric DESC
    LIMIT 1;

    IF best_league_data IS NOT NULL AND (best_league_data->>'roi')::numeric > 5 THEN
      INSERT INTO public.user_insights (
        user_id, insight_type, insight_text, confidence_score, priority, supporting_data
      ) VALUES (
        p_user_id,
        'strength',
        'You excel at ' || best_league_data || ' betting with ' ||
        ROUND((best_league_data->>'win_rate')::numeric, 1) || '% win rate and +' ||
        ROUND((best_league_data->>'roi')::numeric, 1) || '% ROI.',
        0.9,
        70,
        best_league_data
      ) ON CONFLICT DO NOTHING;
      insights_created := insights_created + 1;
    END IF;
  END IF;

  -- INSIGHT 5: Worst league performance (weakness)
  IF patterns.performance_by_league IS NOT NULL AND patterns.performance_by_league != '{}'::jsonb THEN
    SELECT
      key as league,
      value as stats
    INTO worst_league_data
    FROM jsonb_each(patterns.performance_by_league)
    WHERE (value->>'total_bets')::int >= 10
    ORDER BY (value->>'roi')::numeric ASC
    LIMIT 1;

    IF worst_league_data IS NOT NULL AND (worst_league_data->>'roi')::numeric < -5 THEN
      INSERT INTO public.user_insights (
        user_id, insight_type, insight_text, confidence_score, priority, supporting_data
      ) VALUES (
        p_user_id,
        'weakness',
        'Consider avoiding ' || worst_league_data || ' bets. Your ROI is ' ||
        ROUND((worst_league_data->>'roi')::numeric, 1) || '% with ' ||
        ROUND((worst_league_data->>'win_rate')::numeric, 1) || '% win rate.',
        0.85,
        65,
        worst_league_data
      ) ON CONFLICT DO NOTHING;
      insights_created := insights_created + 1;
    END IF;
  END IF;

  -- INSIGHT 6: Best team performance
  IF patterns.performance_by_team IS NOT NULL AND patterns.performance_by_team != '{}'::jsonb THEN
    SELECT
      key as team,
      value as stats
    INTO best_team_data
    FROM jsonb_each(patterns.performance_by_team)
    WHERE (value->>'total_bets')::int >= 5
    ORDER BY (value->>'win_rate')::numeric DESC
    LIMIT 1;

    IF best_team_data IS NOT NULL AND (best_team_data->>'win_rate')::numeric >= 70 THEN
      INSERT INTO public.user_insights (
        user_id, insight_type, insight_text, confidence_score, priority, supporting_data
      ) VALUES (
        p_user_id,
        'strength',
        'You have strong success betting on the ' || best_team_data || ' (' ||
        ROUND((best_team_data->>'win_rate')::numeric, 0) || '% win rate across ' ||
        (best_team_data->>'total_bets') || ' bets).',
        0.8,
        60,
        best_team_data
      ) ON CONFLICT DO NOTHING;
      insights_created := insights_created + 1;
    END IF;
  END IF;

  -- INSIGHT 7: Day of week performance
  IF patterns.performance_by_day IS NOT NULL AND patterns.performance_by_day != '{}'::jsonb THEN
    DECLARE
      best_day_name TEXT;
      best_day_roi NUMERIC;
      best_day_bets INTEGER;
    BEGIN
      SELECT
        key,
        (value->>'roi')::numeric,
        (value->>'total_bets')::int
      INTO best_day_name, best_day_roi, best_day_bets
      FROM jsonb_each(patterns.performance_by_day)
      WHERE (value->>'total_bets')::int >= 5
      ORDER BY (value->>'roi')::numeric DESC
      LIMIT 1;

      IF best_day_roi > 10 THEN
        INSERT INTO public.user_insights (
          user_id, insight_type, insight_text, confidence_score, priority, supporting_data
        ) VALUES (
          p_user_id,
          'recommendation',
          'Your ' || TRIM(best_day_name) || ' bets perform best (+' ||
          ROUND(best_day_roi, 1) || '% ROI). Consider focusing more bets on this day.',
          0.75,
          50,
          jsonb_build_object('day', best_day_name, 'roi', best_day_roi, 'total_bets', best_day_bets)
        ) ON CONFLICT DO NOTHING;
        insights_created := insights_created + 1;
      END IF;
    END;
  END IF;

  -- INSIGHT 8: Parlay warning
  IF patterns.performance_by_bet_type ? 'parlay' THEN
    DECLARE
      parlay_stats JSONB;
      parlay_win_rate NUMERIC;
    BEGIN
      parlay_stats := patterns.performance_by_bet_type->'parlay';
      parlay_win_rate := (parlay_stats->>'win_rate')::numeric;

      IF parlay_win_rate < 35 AND (parlay_stats->>'total_bets')::int >= 10 THEN
        INSERT INTO public.user_insights (
          user_id, insight_type, insight_text, confidence_score, priority, supporting_data
        ) VALUES (
          p_user_id,
          'recommendation',
          'Your parlay bets have only a ' || ROUND(parlay_win_rate, 0) ||
          '% win rate. Consider focusing on straight bets where you perform better.',
          0.9,
          75,
          parlay_stats
        ) ON CONFLICT DO NOTHING;
        insights_created := insights_created + 1;
      END IF;
    END;
  END IF;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'insights_created', insights_created,
    'total_active_insights', (
      SELECT COUNT(*)
      FROM public.user_insights
      WHERE user_id = p_user_id AND is_active = true AND is_dismissed = false
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active insights for a user
CREATE OR REPLACE FUNCTION public.get_active_user_insights(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  insight_type TEXT,
  insight_text TEXT,
  confidence_score NUMERIC,
  priority INTEGER,
  supporting_data JSONB,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.id,
    i.insight_type,
    i.insight_text,
    i.confidence_score,
    i.priority,
    i.supporting_data,
    i.created_at
  FROM public.user_insights i
  WHERE i.user_id = p_user_id
    AND i.is_active = true
    AND i.is_dismissed = false
    AND (i.expires_at IS NULL OR i.expires_at > now())
  ORDER BY i.priority DESC, i.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT, UPDATE ON public.user_insights TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_user_insights(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_user_insights(UUID) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.user_insights IS
'Stores actionable insights generated from betting patterns. Helps users understand strengths, weaknesses, and get personalized recommendations.';

COMMENT ON FUNCTION public.generate_user_insights(UUID) IS
'Analyzes betting patterns and generates actionable insights for a user. Call this after calculating patterns.';

COMMENT ON FUNCTION public.get_active_user_insights(UUID) IS
'Retrieves all active, non-dismissed insights for a user, ordered by priority.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 3 Part 4: User Insights System Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Generates insights from betting patterns';
  RAISE NOTICE '  - Identifies strengths and weaknesses';
  RAISE NOTICE '  - Warns about tilt and losing streaks';
  RAISE NOTICE '  - Recommends focus areas';
  RAISE NOTICE '  - Priority-based insight delivery';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT generate_user_insights(user_id);';
  RAISE NOTICE '  SELECT * FROM get_active_user_insights(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
