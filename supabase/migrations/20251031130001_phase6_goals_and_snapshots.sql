-- Phase 6: Advanced Analytics & Performance Dashboard
-- Part 2: User Goals and Performance Snapshots

-- Table for user-defined betting goals
CREATE TABLE IF NOT EXISTS public.user_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Goal details
  goal_type TEXT NOT NULL, -- 'profit', 'win_rate', 'roi', 'volume', 'bankroll', 'discipline'
  goal_name TEXT NOT NULL,
  goal_description TEXT,

  -- Target values
  target_value NUMERIC NOT NULL,
  current_value NUMERIC DEFAULT 0,
  unit TEXT, -- 'dollars', 'percentage', 'count'

  -- Time range
  start_date DATE NOT NULL,
  end_date DATE,
  time_period TEXT, -- 'daily', 'weekly', 'monthly', 'yearly', 'custom'

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_achieved BOOLEAN DEFAULT false,
  achieved_at TIMESTAMPTZ,
  progress_percentage NUMERIC DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own goals"
ON public.user_goals
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals"
ON public.user_goals
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
ON public.user_goals
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
ON public.user_goals
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_user_goals_user_active ON public.user_goals(user_id, is_active);
CREATE INDEX idx_user_goals_type ON public.user_goals(user_id, goal_type);

-- Table for pre-calculated performance snapshots
CREATE TABLE IF NOT EXISTS public.performance_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot date
  snapshot_date DATE NOT NULL,

  -- Aggregate stats
  total_bets INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_pushes INTEGER DEFAULT 0,
  win_rate NUMERIC,
  roi NUMERIC,
  total_profit_loss NUMERIC,
  sharpe_ratio NUMERIC,
  avg_clv NUMERIC,
  kelly_efficiency NUMERIC,

  -- Current streak
  current_win_streak INTEGER DEFAULT 0,
  current_loss_streak INTEGER DEFAULT 0,
  longest_win_streak INTEGER DEFAULT 0,
  longest_loss_streak INTEGER DEFAULT 0,

  -- Breakdown data (JSONB for flexibility)
  by_league JSONB DEFAULT '{}'::jsonb,
  by_bet_type JSONB DEFAULT '{}'::jsonb,
  by_team JSONB DEFAULT '{}'::jsonb,
  by_day_of_week JSONB DEFAULT '{}'::jsonb,
  by_odds_range JSONB DEFAULT '{}'::jsonb,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, snapshot_date)
);

-- Enable RLS
ALTER TABLE public.performance_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own performance snapshots"
ON public.performance_snapshots
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all performance snapshots"
ON public.performance_snapshots
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX idx_performance_snapshots_user_date ON public.performance_snapshots(user_id, snapshot_date DESC);
CREATE INDEX idx_performance_snapshots_date ON public.performance_snapshots(snapshot_date DESC);

-- Function to update goal progress
CREATE OR REPLACE FUNCTION public.update_goal_progress(p_goal_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_goal RECORD;
  v_current_value NUMERIC;
  v_progress NUMERIC;
BEGIN
  -- Get goal details
  SELECT * INTO v_goal FROM public.user_goals WHERE id = p_goal_id;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Calculate current value based on goal type
  CASE v_goal.goal_type
    WHEN 'profit' THEN
      SELECT COALESCE(SUM(profit_loss), 0) INTO v_current_value
      FROM public.bets
      WHERE user_id = v_goal.user_id
        AND placed_at >= v_goal.start_date
        AND (v_goal.end_date IS NULL OR placed_at <= v_goal.end_date)
        AND result IS NOT NULL;

    WHEN 'win_rate' THEN
      SELECT COALESCE(
        (COUNT(*) FILTER (WHERE result = 'won')::numeric / NULLIF(COUNT(*), 0)) * 100,
        0
      ) INTO v_current_value
      FROM public.bets
      WHERE user_id = v_goal.user_id
        AND placed_at >= v_goal.start_date
        AND (v_goal.end_date IS NULL OR placed_at <= v_goal.end_date)
        AND result IS NOT NULL;

    WHEN 'roi' THEN
      SELECT COALESCE(
        (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100,
        0
      ) INTO v_current_value
      FROM public.bets
      WHERE user_id = v_goal.user_id
        AND placed_at >= v_goal.start_date
        AND (v_goal.end_date IS NULL OR placed_at <= v_goal.end_date)
        AND result IS NOT NULL;

    WHEN 'volume' THEN
      SELECT COUNT(*) INTO v_current_value
      FROM public.bets
      WHERE user_id = v_goal.user_id
        AND placed_at >= v_goal.start_date
        AND (v_goal.end_date IS NULL OR placed_at <= v_goal.end_date);

    WHEN 'bankroll' THEN
      SELECT current_bankroll INTO v_current_value
      FROM public.user_preferences
      WHERE user_id = v_goal.user_id;

    ELSE
      v_current_value := 0;
  END CASE;

  -- Calculate progress percentage
  v_progress := (v_current_value / NULLIF(v_goal.target_value, 0)) * 100;
  v_progress := LEAST(v_progress, 100); -- Cap at 100%

  -- Check if goal is achieved
  IF v_current_value >= v_goal.target_value AND NOT v_goal.is_achieved THEN
    UPDATE public.user_goals
    SET
      current_value = v_current_value,
      progress_percentage = v_progress,
      is_achieved = true,
      achieved_at = now(),
      updated_at = now()
    WHERE id = p_goal_id;
  ELSE
    UPDATE public.user_goals
    SET
      current_value = v_current_value,
      progress_percentage = v_progress,
      updated_at = now()
    WHERE id = p_goal_id;
  END IF;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active goals for user
CREATE OR REPLACE FUNCTION public.get_active_goals(p_user_id UUID)
RETURNS TABLE (
  goal_id UUID,
  goal_type TEXT,
  goal_name TEXT,
  goal_description TEXT,
  target_value NUMERIC,
  current_value NUMERIC,
  progress_percentage NUMERIC,
  unit TEXT,
  start_date DATE,
  end_date DATE,
  is_achieved BOOLEAN,
  days_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ug.id,
    ug.goal_type,
    ug.goal_name,
    ug.goal_description,
    ug.target_value,
    ug.current_value,
    ug.progress_percentage,
    ug.unit,
    ug.start_date,
    ug.end_date,
    ug.is_achieved,
    CASE
      WHEN ug.end_date IS NULL THEN NULL
      ELSE (ug.end_date - CURRENT_DATE)::integer
    END AS days_remaining
  FROM public.user_goals ug
  WHERE ug.user_id = p_user_id
    AND ug.is_active = true
    AND (ug.end_date IS NULL OR ug.end_date >= CURRENT_DATE)
  ORDER BY ug.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to calculate performance breakdown
CREATE OR REPLACE FUNCTION public.get_performance_breakdown(
  p_user_id UUID,
  p_breakdown_type TEXT, -- 'league', 'bet_type', 'team', 'day_of_week', 'odds_range'
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  breakdown_key TEXT,
  total_bets BIGINT,
  wins BIGINT,
  losses BIGINT,
  pushes BIGINT,
  win_rate NUMERIC,
  roi NUMERIC,
  total_profit_loss NUMERIC,
  avg_stake NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  EXECUTE format('
    SELECT
      %I::text AS breakdown_key,
      COUNT(*)::bigint AS total_bets,
      COUNT(*) FILTER (WHERE result = ''won'')::bigint AS wins,
      COUNT(*) FILTER (WHERE result = ''lost'')::bigint AS losses,
      COUNT(*) FILTER (WHERE result = ''push'')::bigint AS pushes,
      ROUND(
        (COUNT(*) FILTER (WHERE result = ''won'')::numeric / NULLIF(COUNT(*), 0)) * 100,
        2
      ) AS win_rate,
      ROUND(
        (SUM(profit_loss) / NULLIF(SUM(amount), 0)) * 100,
        2
      ) AS roi,
      COALESCE(SUM(profit_loss), 0) AS total_profit_loss,
      ROUND(AVG(amount), 2) AS avg_stake
    FROM public.bets
    WHERE user_id = $1
      AND result IS NOT NULL
      AND ($2::date IS NULL OR placed_at >= $2)
      AND ($3::date IS NULL OR placed_at <= $3)
    GROUP BY %I
    ORDER BY total_bets DESC
  ', p_breakdown_type, p_breakdown_type)
  USING p_user_id, p_start_date, p_end_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update goals when bets are settled
CREATE OR REPLACE FUNCTION public.trigger_update_goals_on_bet_result()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if result changed from NULL to a value
  IF NEW.result IS NOT NULL AND (OLD.result IS NULL OR OLD.result IS DISTINCT FROM NEW.result) THEN
    -- Update all active goals for this user
    PERFORM update_goal_progress(id)
    FROM public.user_goals
    WHERE user_id = NEW.user_id
      AND is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bets table
DROP TRIGGER IF EXISTS update_goals_on_bet_result ON public.bets;
CREATE TRIGGER update_goals_on_bet_result
AFTER UPDATE ON public.bets
FOR EACH ROW
EXECUTE FUNCTION trigger_update_goals_on_bet_result();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_goals TO authenticated;
GRANT SELECT ON public.performance_snapshots TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_goal_progress(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_active_goals(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_performance_breakdown(UUID, TEXT, DATE, DATE) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.user_goals IS
'User-defined betting goals with automatic progress tracking. Goals can be profit targets, win rates, ROI, volume, etc.';

COMMENT ON TABLE public.performance_snapshots IS
'Pre-calculated daily performance snapshots for fast dashboard loading. Updated by nightly job.';

COMMENT ON FUNCTION public.update_goal_progress(UUID) IS
'Updates the progress of a goal based on current betting data. Called automatically when bets are settled.';

COMMENT ON FUNCTION public.get_active_goals(UUID) IS
'Retrieves all active goals for a user with current progress. Used in goal tracking dashboard.';

COMMENT ON FUNCTION public.get_performance_breakdown(UUID, TEXT, DATE, DATE) IS
'Breaks down betting performance by league, bet type, team, day of week, or odds range. Used for analytics charts.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 6 Part 2: Goals & Snapshots Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - User goal tracking with automatic progress updates';
  RAISE NOTICE '  - Performance breakdown by multiple dimensions';
  RAISE NOTICE '  - Pre-calculated snapshots for fast queries';
  RAISE NOTICE '  - Automatic goal achievement detection';
  RAISE NOTICE '';
  RAISE NOTICE 'Goal Types:';
  RAISE NOTICE '  - profit: Dollar amount targets';
  RAISE NOTICE '  - win_rate: Win percentage targets';
  RAISE NOTICE '  - roi: Return on investment targets';
  RAISE NOTICE '  - volume: Number of bets targets';
  RAISE NOTICE '  - bankroll: Bankroll milestone targets';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  -- Get active goals:';
  RAISE NOTICE '  SELECT * FROM get_active_goals(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Get performance by league:';
  RAISE NOTICE '  SELECT * FROM get_performance_breakdown(user_id, ''league'');';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
