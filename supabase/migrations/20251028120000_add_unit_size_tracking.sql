-- ============================================================================
-- ADD UNIT SIZE TRACKING FOR CONVERSATIONAL BANKROLL MANAGEMENT
-- Adds unit_size field to profiles for better bet sizing recommendations
-- ============================================================================

-- Add unit_size column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS unit_size NUMERIC(10, 2) DEFAULT NULL;

-- Set default unit size to 1% of bankroll for existing users who have a bankroll
UPDATE profiles
SET unit_size = ROUND(COALESCE(bankroll, 1000) * 0.01, 2)
WHERE unit_size IS NULL AND bankroll IS NOT NULL;

COMMENT ON COLUMN profiles.unit_size IS 'User defined unit size for betting. Typically 1-5% of bankroll. Used for conversational bet tracking.';

-- ============================================================================
-- Update get_user_bankroll_status to include unit_size
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
  total_withdrawals DECIMAL,
  unit_size DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH bankroll_data AS (
    SELECT
      COALESCE(ub.current_amount, p.bankroll, 1000) as current_amt,
      COALESCE(ub.starting_amount, p.baseline_bankroll, p.bankroll, 1000) as starting_amt,
      p.unit_size as u_size
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
    t.total_with as total_withdrawals,
    COALESCE(bd.u_size, ROUND(bd.current_amt * 0.01, 2)) as unit_size
  FROM bankroll_data bd
  CROSS JOIN pending_bets pb
  CROSS JOIN transactions t;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_bankroll_status IS 'Returns comprehensive bankroll status including unit size for a user';
