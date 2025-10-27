-- Migration: Conversational Bankroll Tracking Enhancement
-- Adds cool_off_periods history table and ensures all fields needed for conversational tracking

-- ============================================================================
-- 1. Cool-off Periods History Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS cool_off_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ NOT NULL,
  reason TEXT,
  active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_cooloff_user ON cool_off_periods(user_id);
CREATE INDEX IF NOT EXISTS idx_cooloff_active ON cool_off_periods(active, end_time);

-- RLS policies
ALTER TABLE cool_off_periods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own cool-off periods" ON cool_off_periods;
CREATE POLICY "Users can view their own cool-off periods"
  ON cool_off_periods FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own cool-off periods" ON cool_off_periods;
CREATE POLICY "Users can insert their own cool-off periods"
  ON cool_off_periods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own cool-off periods" ON cool_off_periods;
CREATE POLICY "Users can update their own cool-off periods"
  ON cool_off_periods FOR UPDATE
  USING (auth.uid() = user_id);

COMMENT ON TABLE cool_off_periods IS 'History of user-initiated betting breaks for responsible gambling';

-- ============================================================================
-- 2. Ensure bets table has all necessary fields for conversational tracking
-- ============================================================================

-- Add fields if they don't exist
ALTER TABLE bets
ADD COLUMN IF NOT EXISTS teams JSONB,
ADD COLUMN IF NOT EXISTS final_score TEXT,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'user_pick',
ADD COLUMN IF NOT EXISTS ai_confidence INTEGER,
ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN bets.teams IS 'JSON object with home and away team names';
COMMENT ON COLUMN bets.final_score IS 'Final score string (e.g., "27-38")';
COMMENT ON COLUMN bets.source IS 'Source of bet: ai_recommendation or user_pick';
COMMENT ON COLUMN bets.ai_confidence IS 'AI confidence rating 1-5 stars (null if user pick)';
COMMENT ON COLUMN bets.notes IS 'User notes or additional context about the bet';

-- ============================================================================
-- 3. Ensure bankroll_transactions supports bet settlement tracking
-- ============================================================================

-- Extend bankroll_transactions to track bet-related transactions
ALTER TABLE bankroll_transactions
DROP CONSTRAINT IF EXISTS valid_transaction_type;

ALTER TABLE bankroll_transactions
ADD COLUMN IF NOT EXISTS bet_id UUID REFERENCES bets(id) ON DELETE SET NULL;

ALTER TABLE bankroll_transactions
DROP CONSTRAINT IF EXISTS bankroll_transactions_type_check;

ALTER TABLE bankroll_transactions
ADD CONSTRAINT bankroll_transactions_type_check
CHECK (type IN ('deposit', 'withdrawal', 'bet_placed', 'bet_won', 'bet_lost', 'bet_pushed', 'refund'));

COMMENT ON COLUMN bankroll_transactions.bet_id IS 'Related bet ID for bet-related transactions';

-- ============================================================================
-- 4. Helper function to get user bankroll status
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_bankroll_status(p_user_id UUID)
RETURNS TABLE(
  current_balance DECIMAL,
  available_balance DECIMAL,
  pending_bets_amount DECIMAL,
  starting_balance DECIMAL,
  profit_loss DECIMAL,
  profit_loss_pct DECIMAL,
  total_deposits DECIMAL,
  total_withdrawals DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH bankroll_data AS (
    SELECT
      COALESCE(ub.current_amount, p.bankroll, 1000) as current_amt,
      COALESCE(ub.starting_amount, p.baseline_bankroll, 1000) as starting_amt
    FROM profiles p
    LEFT JOIN user_bankroll ub ON ub.user_id = p.id
    WHERE p.id = p_user_id
  ),
  pending_bets AS (
    SELECT COALESCE(SUM(amount), 0) as total_pending
    FROM bets
    WHERE user_id = p_user_id
    AND outcome = 'pending'
  ),
  transactions AS (
    SELECT
      COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) as total_dep,
      COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount ELSE 0 END), 0) as total_with
    FROM bankroll_transactions
    WHERE user_id = p_user_id
  )
  SELECT
    bd.current_amt as current_balance,
    bd.current_amt - pb.total_pending as available_balance,
    pb.total_pending as pending_bets_amount,
    bd.starting_amt as starting_balance,
    bd.current_amt - (bd.starting_amt + t.total_dep - t.total_with) as profit_loss,
    CASE
      WHEN (bd.starting_amt + t.total_dep - t.total_with) > 0
      THEN ((bd.current_amt - (bd.starting_amt + t.total_dep - t.total_with)) / (bd.starting_amt + t.total_dep - t.total_with) * 100)
      ELSE 0
    END as profit_loss_pct,
    t.total_dep as total_deposits,
    t.total_with as total_withdrawals
  FROM bankroll_data bd
  CROSS JOIN pending_bets pb
  CROSS JOIN transactions t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_bankroll_status IS 'Returns comprehensive bankroll status for a user';

-- ============================================================================
-- 5. Helper function to get betting statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_betting_stats(
  p_user_id UUID,
  p_time_period TEXT DEFAULT 'all', -- 'all', 'today', 'week', 'month'
  p_sport TEXT DEFAULT NULL,
  p_status TEXT DEFAULT 'settled' -- 'settled', 'pending', 'all'
)
RETURNS TABLE(
  wins INTEGER,
  losses INTEGER,
  pushes INTEGER,
  total_bets INTEGER,
  win_rate DECIMAL,
  total_wagered DECIMAL,
  total_returned DECIMAL,
  profit_loss DECIMAL,
  roi DECIMAL,
  largest_win DECIMAL,
  largest_loss DECIMAL,
  current_streak INTEGER,
  streak_type TEXT
) AS $$
DECLARE
  v_date_filter TIMESTAMPTZ;
BEGIN
  -- Determine date filter
  v_date_filter := CASE
    WHEN p_time_period = 'today' THEN CURRENT_DATE
    WHEN p_time_period = 'week' THEN CURRENT_DATE - INTERVAL '7 days'
    WHEN p_time_period = 'month' THEN CURRENT_DATE - INTERVAL '30 days'
    ELSE '1900-01-01'::TIMESTAMPTZ
  END;

  RETURN QUERY
  WITH filtered_bets AS (
    SELECT *
    FROM bets
    WHERE user_id = p_user_id
    AND created_at >= v_date_filter
    AND (p_sport IS NULL OR sport = p_sport)
    AND (
      (p_status = 'settled' AND outcome IN ('win', 'loss', 'push'))
      OR (p_status = 'pending' AND outcome = 'pending')
      OR (p_status = 'all')
    )
  ),
  stats AS (
    SELECT
      COUNT(*) FILTER (WHERE outcome = 'win') as win_count,
      COUNT(*) FILTER (WHERE outcome = 'loss') as loss_count,
      COUNT(*) FILTER (WHERE outcome = 'push') as push_count,
      COUNT(*) as total,
      COALESCE(SUM(amount), 0) as wagered,
      COALESCE(SUM(CASE WHEN outcome = 'win' THEN actual_return ELSE 0 END), 0) as returned,
      COALESCE(SUM(profit_loss), 0) as pl,
      MAX(CASE WHEN outcome = 'win' THEN profit_loss ELSE NULL END) as max_win,
      MIN(CASE WHEN outcome = 'loss' THEN profit_loss ELSE NULL END) as max_loss
    FROM filtered_bets
  ),
  streak_calc AS (
    SELECT
      COUNT(*) as streak_length,
      MAX(outcome) as streak_outcome
    FROM (
      SELECT outcome,
        ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn
      FROM bets
      WHERE user_id = p_user_id
      AND outcome IN ('win', 'loss')
      ORDER BY created_at DESC
      LIMIT 100
    ) recent
    WHERE rn <= (
      SELECT MIN(rn) - 1
      FROM (
        SELECT outcome,
          ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn,
          LAG(outcome) OVER (ORDER BY created_at DESC) as prev_outcome
        FROM bets
        WHERE user_id = p_user_id
        AND outcome IN ('win', 'loss')
        ORDER BY created_at DESC
      ) t
      WHERE outcome != prev_outcome
      LIMIT 1
    )
  )
  SELECT
    s.win_count::INTEGER,
    s.loss_count::INTEGER,
    s.push_count::INTEGER,
    s.total::INTEGER,
    CASE WHEN s.total > 0 THEN (s.win_count::DECIMAL / s.total * 100) ELSE 0 END,
    s.wagered,
    s.returned,
    s.pl,
    CASE WHEN s.wagered > 0 THEN (s.pl / s.wagered * 100) ELSE 0 END,
    COALESCE(s.max_win, 0),
    COALESCE(s.max_loss, 0),
    COALESCE(sc.streak_length::INTEGER, 0),
    COALESCE(
      CASE
        WHEN sc.streak_outcome = 'win' THEN 'win'
        WHEN sc.streak_outcome = 'loss' THEN 'loss'
        ELSE 'none'
      END,
      'none'
    )
  FROM stats s
  LEFT JOIN streak_calc sc ON true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_betting_stats IS 'Returns comprehensive betting statistics with optional filtering';

-- ============================================================================
-- 6. Trigger to auto-deactivate expired cool-off periods
-- ============================================================================

CREATE OR REPLACE FUNCTION deactivate_expired_cooloffs()
RETURNS void AS $$
BEGIN
  UPDATE cool_off_periods
  SET active = FALSE
  WHERE active = TRUE
  AND end_time <= NOW();

  UPDATE profiles
  SET cool_off_end = NULL
  WHERE cool_off_end IS NOT NULL
  AND cool_off_end <= NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION deactivate_expired_cooloffs IS 'Deactivates expired cool-off periods and clears profile cool_off_end';
