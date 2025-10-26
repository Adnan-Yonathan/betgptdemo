-- Migration: Add Responsible Gambling Features
-- Adds cool-off periods, kelly_multiplier to profiles
-- Ensures loss_limits table has current loss tracking columns

-- ============================================================================
-- 1. Add cool-off period support to profiles
-- ============================================================================

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS cool_off_end TIMESTAMPTZ;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS kelly_multiplier DECIMAL DEFAULT 0.25;

COMMENT ON COLUMN profiles.cool_off_end IS 'Timestamp when cool-off period ends (null if not in cool-off)';
COMMENT ON COLUMN profiles.kelly_multiplier IS 'Fractional Kelly multiplier for bet sizing (0.25 = quarter Kelly)';

-- ============================================================================
-- 2. Ensure loss_limits table exists with current loss tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS loss_limits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Limit settings
  daily_limit DECIMAL,
  weekly_limit DECIMAL,
  monthly_limit DECIMAL,

  -- Current loss tracking
  current_daily_loss DECIMAL DEFAULT 0,
  current_weekly_loss DECIMAL DEFAULT 0,
  current_monthly_loss DECIMAL DEFAULT 0,

  -- Reset tracking
  last_reset_daily DATE DEFAULT CURRENT_DATE,
  last_reset_weekly DATE DEFAULT CURRENT_DATE,
  last_reset_monthly DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- ============================================================================
-- 3. Add RLS policies for loss_limits
-- ============================================================================

ALTER TABLE loss_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own loss limits" ON loss_limits;
CREATE POLICY "Users can view their own loss limits"
  ON loss_limits FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own loss limits" ON loss_limits;
CREATE POLICY "Users can update their own loss limits"
  ON loss_limits FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================================
-- 4. Function to reset loss limits based on time period
-- ============================================================================

CREATE OR REPLACE FUNCTION reset_loss_limits()
RETURNS void AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Reset daily losses if last reset was before today
  UPDATE loss_limits
  SET current_daily_loss = 0,
      last_reset_daily = v_today
  WHERE last_reset_daily < v_today;

  -- Reset weekly losses (Monday-based week)
  UPDATE loss_limits
  SET current_weekly_loss = 0,
      last_reset_weekly = v_today
  WHERE last_reset_weekly < v_today - INTERVAL '7 days'
     OR (EXTRACT(DOW FROM v_today) = 1 AND EXTRACT(DOW FROM last_reset_weekly) != 1);

  -- Reset monthly losses
  UPDATE loss_limits
  SET current_monthly_loss = 0,
      last_reset_monthly = v_today
  WHERE EXTRACT(MONTH FROM last_reset_monthly) != EXTRACT(MONTH FROM v_today)
     OR EXTRACT(YEAR FROM last_reset_monthly) != EXTRACT(YEAR FROM v_today);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. Function to update loss limits when bets settle
-- ============================================================================

CREATE OR REPLACE FUNCTION update_loss_limits_on_bet_settlement()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if bet changed to loss outcome
  IF NEW.outcome = 'loss' AND (OLD.outcome IS NULL OR OLD.outcome = 'pending') THEN
    -- Ensure reset has been done for today
    PERFORM reset_loss_limits();

    -- Update current losses
    INSERT INTO loss_limits (user_id, current_daily_loss, current_weekly_loss, current_monthly_loss)
    VALUES (
      NEW.user_id,
      NEW.amount,
      NEW.amount,
      NEW.amount
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      current_daily_loss = loss_limits.current_daily_loss + NEW.amount,
      current_weekly_loss = loss_limits.current_weekly_loss + NEW.amount,
      current_monthly_loss = loss_limits.current_monthly_loss + NEW.amount,
      updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. Create trigger for automatic loss limit updates
-- ============================================================================

DROP TRIGGER IF EXISTS update_loss_limits_trigger ON bets;
CREATE TRIGGER update_loss_limits_trigger
  AFTER UPDATE OF outcome ON bets
  FOR EACH ROW
  EXECUTE FUNCTION update_loss_limits_on_bet_settlement();

-- ============================================================================
-- 7. Add indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_loss_limits_user ON loss_limits(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_cool_off ON profiles(cool_off_end) WHERE cool_off_end IS NOT NULL;

-- ============================================================================
-- 8. Helper function to check if user can place bet
-- ============================================================================

CREATE OR REPLACE FUNCTION can_user_place_bet(
  p_user_id UUID,
  p_bet_amount DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_cool_off_end TIMESTAMPTZ;
  v_limits RECORD;
BEGIN
  -- Check cool-off period
  SELECT cool_off_end INTO v_cool_off_end
  FROM profiles
  WHERE id = p_user_id;

  IF v_cool_off_end IS NOT NULL AND v_cool_off_end > NOW() THEN
    RETURN FALSE;
  END IF;

  -- Check loss limits
  SELECT * INTO v_limits
  FROM loss_limits
  WHERE user_id = p_user_id;

  IF v_limits IS NOT NULL THEN
    -- Check daily limit
    IF v_limits.daily_limit IS NOT NULL THEN
      IF v_limits.current_daily_loss + p_bet_amount > v_limits.daily_limit THEN
        RETURN FALSE;
      END IF;
    END IF;

    -- Check weekly limit
    IF v_limits.weekly_limit IS NOT NULL THEN
      IF v_limits.current_weekly_loss + p_bet_amount > v_limits.weekly_limit THEN
        RETURN FALSE;
      END IF;
    END IF;

    -- Check monthly limit
    IF v_limits.monthly_limit IS NOT NULL THEN
      IF v_limits.current_monthly_loss + p_bet_amount > v_limits.monthly_limit THEN
        RETURN FALSE;
      END IF;
    END IF;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION can_user_place_bet IS 'Checks if user can place a bet based on cool-off and loss limits';

-- ============================================================================
-- 9. Bankroll Transactions Table (Deposits & Withdrawals)
-- ============================================================================

CREATE TABLE IF NOT EXISTS bankroll_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount DECIMAL NOT NULL CHECK (amount > 0),
  balance_after DECIMAL NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_transaction_type CHECK (type IN ('deposit', 'withdrawal'))
);

-- RLS for bankroll_transactions
ALTER TABLE bankroll_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own transactions" ON bankroll_transactions;
CREATE POLICY "Users can view their own transactions"
  ON bankroll_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own transactions" ON bankroll_transactions;
CREATE POLICY "Users can insert their own transactions"
  ON bankroll_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_bankroll_tx_user ON bankroll_transactions(user_id, created_at DESC);

COMMENT ON TABLE bankroll_transactions IS 'User deposit and withdrawal history for bankroll tracking';
