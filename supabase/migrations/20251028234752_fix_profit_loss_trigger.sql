-- ============================================================================
-- Fix Profit/Loss Trigger to Handle NULL Values
-- ============================================================================
-- This migration fixes the profit_loss trigger to properly handle cases where
-- the profit_loss column is NULL (not just 0). This ensures profit_loss is
-- always calculated when a bet is settled.

-- Drop existing trigger
DROP TRIGGER IF EXISTS trigger_update_bet_profit_loss ON bets;

-- Recreate function with improved NULL handling
CREATE OR REPLACE FUNCTION update_bet_profit_loss()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate profit_loss if bet is being settled and profit_loss is not set
  IF NEW.outcome IN ('win', 'loss', 'push') AND (NEW.profit_loss IS NULL OR NEW.profit_loss = 0) THEN
    NEW.profit_loss := CASE
      WHEN NEW.outcome = 'win' THEN (NEW.actual_return - NEW.amount)
      WHEN NEW.outcome = 'loss' THEN -NEW.amount
      WHEN NEW.outcome = 'push' THEN 0
      ELSE 0
    END;

    -- Log for debugging
    RAISE NOTICE 'Auto-calculated profit_loss for bet %: % (outcome: %, amount: %, return: %)',
      NEW.id, NEW.profit_loss, NEW.outcome, NEW.amount, NEW.actual_return;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
CREATE TRIGGER trigger_update_bet_profit_loss
  BEFORE UPDATE ON bets
  FOR EACH ROW
  WHEN (NEW.outcome IS DISTINCT FROM OLD.outcome)
  EXECUTE FUNCTION update_bet_profit_loss();

COMMENT ON FUNCTION update_bet_profit_loss IS 'Automatically calculates profit_loss when a bet is settled (handles NULL values)';

-- ============================================================================
-- Ensure profit_loss column has proper default and constraints
-- ============================================================================

-- Set default value to 0 for new records
ALTER TABLE bets
ALTER COLUMN profit_loss SET DEFAULT 0;

-- Update any existing NULL values to 0 for pending bets
UPDATE bets
SET profit_loss = 0
WHERE profit_loss IS NULL AND outcome = 'pending';

-- Backfill profit_loss for any settled bets that don't have it set
UPDATE bets
SET profit_loss = CASE
  WHEN outcome = 'win' THEN (actual_return - amount)
  WHEN outcome = 'loss' THEN -amount
  WHEN outcome = 'push' THEN 0
  ELSE 0
END
WHERE outcome IN ('win', 'loss', 'push')
  AND (profit_loss IS NULL OR profit_loss = 0)
  AND actual_return IS NOT NULL;

-- ============================================================================
-- Verification Query (commented out for migration)
-- ============================================================================

-- SELECT
--   id,
--   description,
--   outcome,
--   amount,
--   actual_return,
--   profit_loss,
--   CASE
--     WHEN outcome = 'win' THEN (actual_return - amount)
--     WHEN outcome = 'loss' THEN -amount
--     WHEN outcome = 'push' THEN 0
--     ELSE 0
--   END as calculated_profit_loss
-- FROM bets
-- WHERE outcome IN ('win', 'loss', 'push')
-- ORDER BY settled_at DESC
-- LIMIT 10;
