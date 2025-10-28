-- ============================================================================
-- FIX BANKROLL MANAGEMENT ISSUES
-- This migration fixes missing columns and ensures bankroll tracking works
-- ============================================================================

-- ============================================================================
-- 1. Add missing baseline_bankroll column back to profiles
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS baseline_bankroll NUMERIC DEFAULT 1000.00;

-- Set baseline_bankroll to current bankroll for existing users
UPDATE profiles
SET baseline_bankroll = COALESCE(bankroll, 1000.00)
WHERE baseline_bankroll IS NULL;

COMMENT ON COLUMN profiles.baseline_bankroll IS 'The starting bankroll amount set by the user. Used to calculate profit/loss percentage.';

-- ============================================================================
-- 2. Ensure bankroll column exists (should exist but adding safety check)
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bankroll NUMERIC(10, 2) DEFAULT 1000.00;

-- Update existing profiles to have the default bankroll if null
UPDATE profiles
SET bankroll = 1000.00
WHERE bankroll IS NULL;

-- ============================================================================
-- 3. Add kelly_multiplier if missing (used by log-bet function)
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kelly_multiplier NUMERIC DEFAULT 0.25;

COMMENT ON COLUMN profiles.kelly_multiplier IS 'Fractional Kelly multiplier for bet sizing (default 0.25 for quarter-Kelly)';

-- ============================================================================
-- 4. Ensure bets table has profit_loss column
-- ============================================================================

ALTER TABLE bets
ADD COLUMN IF NOT EXISTS profit_loss NUMERIC DEFAULT 0;

-- Update profit_loss for existing settled bets
UPDATE bets
SET profit_loss = CASE
  WHEN outcome = 'win' THEN (actual_return - amount)
  WHEN outcome = 'loss' THEN -amount
  WHEN outcome = 'push' THEN 0
  ELSE 0
END
WHERE profit_loss = 0 AND outcome IN ('win', 'loss', 'push');

COMMENT ON COLUMN bets.profit_loss IS 'Profit or loss from the bet (positive for wins, negative for losses)';

-- ============================================================================
-- 5. Fix get_user_bankroll_status function to handle missing data gracefully
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
      COALESCE(ub.starting_amount, p.baseline_bankroll, p.bankroll, 1000) as starting_amt
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

COMMENT ON FUNCTION get_user_bankroll_status IS 'Returns comprehensive bankroll status for a user with proper null handling';

-- ============================================================================
-- 6. Create trigger to update profit_loss on bet settlement
-- ============================================================================

CREATE OR REPLACE FUNCTION update_bet_profit_loss()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.outcome IN ('win', 'loss', 'push') AND NEW.profit_loss = 0 THEN
    NEW.profit_loss := CASE
      WHEN NEW.outcome = 'win' THEN (NEW.actual_return - NEW.amount)
      WHEN NEW.outcome = 'loss' THEN -NEW.amount
      WHEN NEW.outcome = 'push' THEN 0
      ELSE 0
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_bet_profit_loss ON bets;
CREATE TRIGGER trigger_update_bet_profit_loss
  BEFORE UPDATE ON bets
  FOR EACH ROW
  WHEN (NEW.outcome IS DISTINCT FROM OLD.outcome)
  EXECUTE FUNCTION update_bet_profit_loss();

COMMENT ON FUNCTION update_bet_profit_loss IS 'Automatically calculates profit_loss when a bet is settled';

-- ============================================================================
-- 7. Create function to initialize user bankroll if missing
-- ============================================================================

CREATE OR REPLACE FUNCTION initialize_user_bankroll(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Initialize profiles bankroll if null
  UPDATE profiles
  SET
    bankroll = COALESCE(bankroll, 1000.00),
    baseline_bankroll = COALESCE(baseline_bankroll, bankroll, 1000.00),
    kelly_multiplier = COALESCE(kelly_multiplier, 0.25)
  WHERE id = p_user_id;

  -- Initialize user_bankroll table if not exists
  INSERT INTO user_bankroll (user_id, starting_amount, current_amount)
  VALUES (p_user_id, 1000.00, 1000.00)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION initialize_user_bankroll IS 'Initializes bankroll tracking for a user if not already set up';

-- ============================================================================
-- 8. Create trigger to initialize bankroll on profile creation
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_initialize_bankroll()
RETURNS TRIGGER AS $$
BEGIN
  -- Set default values for new profiles
  NEW.bankroll := COALESCE(NEW.bankroll, 1000.00);
  NEW.baseline_bankroll := COALESCE(NEW.baseline_bankroll, NEW.bankroll, 1000.00);
  NEW.kelly_multiplier := COALESCE(NEW.kelly_multiplier, 0.25);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_init_bankroll_on_profile_create ON profiles;
CREATE TRIGGER trigger_init_bankroll_on_profile_create
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_initialize_bankroll();

-- ============================================================================
-- 9. Initialize bankroll for all existing users
-- ============================================================================

-- Update all existing profiles to have proper bankroll values
UPDATE profiles
SET
  bankroll = COALESCE(bankroll, 1000.00),
  baseline_bankroll = COALESCE(baseline_bankroll, bankroll, 1000.00),
  kelly_multiplier = COALESCE(kelly_multiplier, 0.25)
WHERE bankroll IS NULL OR baseline_bankroll IS NULL OR kelly_multiplier IS NULL;

-- Initialize user_bankroll for all users who don't have one
INSERT INTO user_bankroll (user_id, starting_amount, current_amount)
SELECT
  p.id,
  COALESCE(p.baseline_bankroll, p.bankroll, 1000.00) as starting_amount,
  COALESCE(p.bankroll, 1000.00) as current_amount
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_bankroll ub WHERE ub.user_id = p.id
);

-- ============================================================================
-- 10. Create a view for easy bankroll status checking
-- ============================================================================

CREATE OR REPLACE VIEW user_bankroll_status AS
SELECT
  p.id as user_id,
  COALESCE(ub.current_amount, p.bankroll, 1000) as current_balance,
  COALESCE(ub.starting_amount, p.baseline_bankroll, 1000) as starting_balance,
  (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE user_id = p.id AND outcome = 'pending') as pending_amount,
  COALESCE(ub.current_amount, p.bankroll, 1000) - (SELECT COALESCE(SUM(amount), 0) FROM bets WHERE user_id = p.id AND outcome = 'pending') as available_balance,
  COALESCE(ub.current_amount, p.bankroll, 1000) - COALESCE(ub.starting_amount, p.baseline_bankroll, 1000) as profit_loss,
  CASE
    WHEN COALESCE(ub.starting_amount, p.baseline_bankroll, 1000) > 0
    THEN ((COALESCE(ub.current_amount, p.bankroll, 1000) - COALESCE(ub.starting_amount, p.baseline_bankroll, 1000)) / COALESCE(ub.starting_amount, p.baseline_bankroll, 1000) * 100)
    ELSE 0
  END as profit_loss_pct
FROM profiles p
LEFT JOIN user_bankroll ub ON ub.user_id = p.id;

COMMENT ON VIEW user_bankroll_status IS 'Convenient view for checking user bankroll status';

-- ============================================================================
-- 11. Create stub sync_user_betting_profile function
-- ============================================================================
-- The settle_bet_atomic function calls this, but it was removed in remove_crm_tracking migration
-- Create a no-op version to prevent errors

CREATE OR REPLACE FUNCTION sync_user_betting_profile(p_user_id UUID)
RETURNS void AS $$
BEGIN
  -- This is a no-op function to maintain compatibility with settle_bet_atomic
  -- The CRM tracking functionality was removed, but settle_bet_atomic still calls this
  -- In the future, this can be expanded if needed
  NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION sync_user_betting_profile IS 'Stub function for compatibility with settle_bet_atomic (CRM tracking removed)';

-- ============================================================================
-- 12. Recreate settle_bet_atomic function with proper bankroll handling
-- ============================================================================

CREATE OR REPLACE FUNCTION settle_bet_atomic(
  p_bet_id UUID,
  p_outcome TEXT,
  p_actual_return NUMERIC,
  p_closing_line NUMERIC DEFAULT NULL,
  p_clv NUMERIC DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  bet_data JSONB,
  bankroll_data JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
  v_user_id UUID;
  v_current_bankroll NUMERIC;
  v_new_bankroll NUMERIC;
  v_profit NUMERIC;
BEGIN
  -- Validate outcome
  IF p_outcome NOT IN ('win', 'loss', 'push') THEN
    RETURN QUERY SELECT
      false AS success,
      'Invalid outcome. Must be: win, loss, or push' AS message,
      NULL::JSONB AS bet_data,
      NULL::JSONB AS bankroll_data;
    RETURN;
  END IF;

  -- Get bet details and lock the row to prevent concurrent updates
  SELECT * INTO v_bet
  FROM bets
  WHERE id = p_bet_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false AS success,
      'Bet not found' AS message,
      NULL::JSONB AS bet_data,
      NULL::JSONB AS bankroll_data;
    RETURN;
  END IF;

  -- Don't settle already settled bets
  IF v_bet.outcome != 'pending' THEN
    RETURN QUERY SELECT
      false AS success,
      'Bet already settled with outcome: ' || v_bet.outcome AS message,
      NULL::JSONB AS bet_data,
      NULL::JSONB AS bankroll_data;
    RETURN;
  END IF;

  v_user_id := v_bet.user_id;

  -- Get current bankroll and lock the profile row
  SELECT COALESCE(bankroll, 1000.00) INTO v_current_bankroll
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false AS success,
      'User profile not found' AS message,
      NULL::JSONB AS bet_data,
      NULL::JSONB AS bankroll_data;
    RETURN;
  END IF;

  -- Calculate new bankroll based on outcome
  v_new_bankroll := v_current_bankroll;
  v_profit := 0;

  IF p_outcome = 'win' THEN
    v_profit := p_actual_return - v_bet.amount;
    v_new_bankroll := v_current_bankroll + v_profit;
  ELSIF p_outcome = 'loss' THEN
    v_profit := -v_bet.amount;
    v_new_bankroll := v_current_bankroll - v_bet.amount;
  ELSIF p_outcome = 'push' THEN
    v_profit := 0;
    -- For push, bankroll stays the same
  END IF;

  -- Step 1: Update the bet
  UPDATE bets
  SET
    outcome = p_outcome,
    actual_return = p_actual_return,
    settled_at = now(),
    closing_line = p_closing_line,
    clv = p_clv,
    profit_loss = v_profit
  WHERE id = p_bet_id;

  -- Step 2: Update the profiles bankroll
  UPDATE profiles
  SET bankroll = v_new_bankroll
  WHERE id = v_user_id;

  -- Step 3: Also update user_bankroll table if it exists for this user
  UPDATE user_bankroll
  SET
    current_amount = v_new_bankroll,
    updated_at = now()
  WHERE user_id = v_user_id;

  -- Return success with details
  RETURN QUERY SELECT
    true AS success,
    'Bet settled successfully' AS message,
    jsonb_build_object(
      'bet_id', p_bet_id,
      'outcome', p_outcome,
      'amount', v_bet.amount,
      'actual_return', p_actual_return,
      'profit', v_profit,
      'clv', p_clv
    ) AS bet_data,
    jsonb_build_object(
      'user_id', v_user_id,
      'previous_bankroll', v_current_bankroll,
      'new_bankroll', v_new_bankroll,
      'change', v_new_bankroll - v_current_bankroll
    ) AS bankroll_data;

EXCEPTION
  WHEN OTHERS THEN
    -- If anything fails, the entire transaction will be rolled back
    RETURN QUERY SELECT
      false AS success,
      'Error settling bet: ' || SQLERRM AS message,
      NULL::JSONB AS bet_data,
      NULL::JSONB AS bankroll_data;
END;
$$;

COMMENT ON FUNCTION settle_bet_atomic IS 'Atomically settles a bet and updates bankroll in profiles and user_bankroll tables';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
