-- Phase 6: Advanced Analytics & Performance Dashboard
-- Part 1: Bankroll History Tracking

-- Table for tracking daily bankroll snapshots
CREATE TABLE IF NOT EXISTS public.bankroll_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Snapshot data
  date DATE NOT NULL,
  bankroll NUMERIC NOT NULL,
  total_wagered NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,

  -- Daily stats
  daily_bets INTEGER DEFAULT 0,
  daily_wins INTEGER DEFAULT 0,
  daily_losses INTEGER DEFAULT 0,
  daily_pushes INTEGER DEFAULT 0,
  daily_profit_loss NUMERIC DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, date)
);

-- Enable RLS
ALTER TABLE public.bankroll_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own bankroll history"
ON public.bankroll_history
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own bankroll history"
ON public.bankroll_history
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role can manage all bankroll history"
ON public.bankroll_history
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create indexes
CREATE INDEX idx_bankroll_history_user_date ON public.bankroll_history(user_id, date DESC);
CREATE INDEX idx_bankroll_history_date ON public.bankroll_history(date DESC);

-- Function to calculate daily bankroll snapshot
CREATE OR REPLACE FUNCTION public.calculate_daily_bankroll_snapshot(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_current_bankroll NUMERIC;
  v_daily_bets INTEGER;
  v_daily_wins INTEGER;
  v_daily_losses INTEGER;
  v_daily_pushes INTEGER;
  v_daily_profit_loss NUMERIC;
  v_total_wagered NUMERIC;
  v_total_profit_loss NUMERIC;
BEGIN
  -- Get current bankroll from user preferences
  SELECT current_bankroll INTO v_current_bankroll
  FROM public.user_preferences
  WHERE user_id = p_user_id;

  -- If no bankroll found, use default
  v_current_bankroll := COALESCE(v_current_bankroll, 1000);

  -- Calculate daily stats from bets
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE result = 'won'),
    COUNT(*) FILTER (WHERE result = 'lost'),
    COUNT(*) FILTER (WHERE result = 'push'),
    COALESCE(SUM(profit_loss), 0)
  INTO
    v_daily_bets,
    v_daily_wins,
    v_daily_losses,
    v_daily_pushes,
    v_daily_profit_loss
  FROM public.bets
  WHERE user_id = p_user_id
    AND DATE(placed_at) = p_date
    AND result IS NOT NULL;

  -- Calculate total wagered and P/L up to this date
  SELECT
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(profit_loss), 0)
  INTO
    v_total_wagered,
    v_total_profit_loss
  FROM public.bets
  WHERE user_id = p_user_id
    AND DATE(placed_at) <= p_date
    AND result IS NOT NULL;

  -- Return as JSONB
  RETURN jsonb_build_object(
    'bankroll', v_current_bankroll,
    'total_wagered', v_total_wagered,
    'total_profit_loss', v_total_profit_loss,
    'daily_bets', v_daily_bets,
    'daily_wins', v_daily_wins,
    'daily_losses', v_daily_losses,
    'daily_pushes', v_daily_pushes,
    'daily_profit_loss', v_daily_profit_loss
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create/update bankroll snapshot
CREATE OR REPLACE FUNCTION public.update_bankroll_snapshot(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS UUID AS $$
DECLARE
  v_snapshot JSONB;
  v_snapshot_id UUID;
BEGIN
  -- Calculate snapshot data
  v_snapshot := calculate_daily_bankroll_snapshot(p_user_id, p_date);

  -- Upsert into bankroll_history
  INSERT INTO public.bankroll_history (
    user_id,
    date,
    bankroll,
    total_wagered,
    total_profit_loss,
    daily_bets,
    daily_wins,
    daily_losses,
    daily_pushes,
    daily_profit_loss
  ) VALUES (
    p_user_id,
    p_date,
    (v_snapshot->>'bankroll')::numeric,
    (v_snapshot->>'total_wagered')::numeric,
    (v_snapshot->>'total_profit_loss')::numeric,
    (v_snapshot->>'daily_bets')::integer,
    (v_snapshot->>'daily_wins')::integer,
    (v_snapshot->>'daily_losses')::integer,
    (v_snapshot->>'daily_pushes')::integer,
    (v_snapshot->>'daily_profit_loss')::numeric
  )
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    bankroll = EXCLUDED.bankroll,
    total_wagered = EXCLUDED.total_wagered,
    total_profit_loss = EXCLUDED.total_profit_loss,
    daily_bets = EXCLUDED.daily_bets,
    daily_wins = EXCLUDED.daily_wins,
    daily_losses = EXCLUDED.daily_losses,
    daily_pushes = EXCLUDED.daily_pushes,
    daily_profit_loss = EXCLUDED.daily_profit_loss
  RETURNING id INTO v_snapshot_id;

  RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get bankroll history for a date range
CREATE OR REPLACE FUNCTION public.get_bankroll_history(
  p_user_id UUID,
  p_start_date DATE DEFAULT (CURRENT_DATE - INTERVAL '30 days')::DATE,
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  date DATE,
  bankroll NUMERIC,
  total_profit_loss NUMERIC,
  daily_profit_loss NUMERIC,
  daily_bets INTEGER,
  daily_wins INTEGER,
  daily_losses INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bh.date,
    bh.bankroll,
    bh.total_profit_loss,
    bh.daily_profit_loss,
    bh.daily_bets,
    bh.daily_wins,
    bh.daily_losses
  FROM public.bankroll_history bh
  WHERE bh.user_id = p_user_id
    AND bh.date >= p_start_date
    AND bh.date <= p_end_date
  ORDER BY bh.date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update bankroll snapshot when bet result is set
CREATE OR REPLACE FUNCTION public.trigger_update_bankroll_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if result changed from NULL to a value
  IF NEW.result IS NOT NULL AND (OLD.result IS NULL OR OLD.result IS DISTINCT FROM NEW.result) THEN
    PERFORM update_bankroll_snapshot(NEW.user_id, DATE(NEW.placed_at));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on bets table
DROP TRIGGER IF EXISTS update_bankroll_snapshot_on_bet_result ON public.bets;
CREATE TRIGGER update_bankroll_snapshot_on_bet_result
AFTER UPDATE ON public.bets
FOR EACH ROW
EXECUTE FUNCTION trigger_update_bankroll_snapshot();

-- Grant permissions
GRANT SELECT ON public.bankroll_history TO authenticated;
GRANT INSERT ON public.bankroll_history TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_daily_bankroll_snapshot(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_bankroll_snapshot(UUID, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_bankroll_history(UUID, DATE, DATE) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.bankroll_history IS
'Tracks daily bankroll snapshots for analytics and visualization. Updated automatically when bet results change.';

COMMENT ON FUNCTION public.update_bankroll_snapshot(UUID, DATE) IS
'Creates or updates a bankroll snapshot for a specific date. Automatically called when bets are settled.';

COMMENT ON FUNCTION public.get_bankroll_history(UUID, DATE, DATE) IS
'Retrieves bankroll history for a date range. Used for charts and analytics.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 6 Part 1: Bankroll History Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Daily bankroll snapshots with P/L tracking';
  RAISE NOTICE '  - Automatic updates when bets are settled';
  RAISE NOTICE '  - Historical data for charts and analytics';
  RAISE NOTICE '  - Fast queries with proper indexing';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  -- Get last 30 days of bankroll history:';
  RAISE NOTICE '  SELECT * FROM get_bankroll_history(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Manually update todays snapshot:';
  RAISE NOTICE '  SELECT update_bankroll_snapshot(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
