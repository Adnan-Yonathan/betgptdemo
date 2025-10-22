-- ============================================================================
-- BETTING PROFILE <-> LIVE CRM TRACKING SYNC
-- ============================================================================
-- This migration enables real-time synchronization between user betting
-- profiles and the CRM (bet tracking) system. It adds live tracking fields
-- to the profiles table and creates triggers to auto-update them.
-- ============================================================================

-- ============================================================================
-- 1. ADD LIVE CRM TRACKING FIELDS TO PROFILES TABLE
-- ============================================================================

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS total_bets_placed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bets_won INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bets_lost INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bets_pushed INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount_wagered NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount_won NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_amount_lost NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS win_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS roi NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_bet_size NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS largest_win NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS largest_loss NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_win_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS longest_loss_streak INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_bet_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_bet_amount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_bet_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_win_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_loss_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Add comments for documentation
COMMENT ON COLUMN public.profiles.total_bets_placed IS 'Total number of bets placed (all outcomes)';
COMMENT ON COLUMN public.profiles.total_bets_won IS 'Number of bets won';
COMMENT ON COLUMN public.profiles.total_bets_lost IS 'Number of bets lost';
COMMENT ON COLUMN public.profiles.total_bets_pushed IS 'Number of bets pushed (tie/void)';
COMMENT ON COLUMN public.profiles.total_amount_wagered IS 'Sum of all bet amounts across all bets';
COMMENT ON COLUMN public.profiles.total_amount_won IS 'Sum of all winnings from winning bets';
COMMENT ON COLUMN public.profiles.total_amount_lost IS 'Sum of all losses from losing bets';
COMMENT ON COLUMN public.profiles.win_rate IS 'Win percentage (wins / (wins + losses)) * 100';
COMMENT ON COLUMN public.profiles.roi IS 'Return on investment percentage';
COMMENT ON COLUMN public.profiles.average_bet_size IS 'Average amount per bet';
COMMENT ON COLUMN public.profiles.largest_win IS 'Largest single bet profit';
COMMENT ON COLUMN public.profiles.largest_loss IS 'Largest single bet loss';
COMMENT ON COLUMN public.profiles.current_streak IS 'Current win/loss streak (positive = wins, negative = losses)';
COMMENT ON COLUMN public.profiles.longest_win_streak IS 'Longest consecutive win streak';
COMMENT ON COLUMN public.profiles.longest_loss_streak IS 'Longest consecutive loss streak';
COMMENT ON COLUMN public.profiles.total_profit IS 'Net profit/loss (total won - total lost)';
COMMENT ON COLUMN public.profiles.pending_bet_count IS 'Number of pending bets';
COMMENT ON COLUMN public.profiles.pending_bet_amount IS 'Total amount in pending bets';
COMMENT ON COLUMN public.profiles.last_bet_at IS 'Timestamp of most recent bet';
COMMENT ON COLUMN public.profiles.last_win_at IS 'Timestamp of most recent win';
COMMENT ON COLUMN public.profiles.last_loss_at IS 'Timestamp of most recent loss';
COMMENT ON COLUMN public.profiles.last_sync_at IS 'Timestamp of last profile sync with CRM data';

-- ============================================================================
-- 2. CREATE FUNCTION TO SYNC USER BETTING PROFILE FROM BETS
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_user_betting_profile(target_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  stats JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bets_placed INTEGER;
  v_total_bets_won INTEGER;
  v_total_bets_lost INTEGER;
  v_total_bets_pushed INTEGER;
  v_pending_count INTEGER;
  v_pending_amount NUMERIC;
  v_total_amount_wagered NUMERIC;
  v_total_amount_won NUMERIC;
  v_total_amount_lost NUMERIC;
  v_win_rate NUMERIC;
  v_roi NUMERIC;
  v_average_bet_size NUMERIC;
  v_largest_win NUMERIC;
  v_largest_loss NUMERIC;
  v_total_profit NUMERIC;
  v_last_bet_at TIMESTAMP WITH TIME ZONE;
  v_last_win_at TIMESTAMP WITH TIME ZONE;
  v_last_loss_at TIMESTAMP WITH TIME ZONE;
  v_current_streak INTEGER := 0;
  v_longest_win_streak INTEGER := 0;
  v_longest_loss_streak INTEGER := 0;
  v_temp_streak INTEGER := 0;
  v_temp_win_streak INTEGER := 0;
  v_temp_loss_streak INTEGER := 0;
  bet_record RECORD;
BEGIN
  -- Calculate aggregate statistics from bets
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'win'),
    COUNT(*) FILTER (WHERE outcome = 'loss'),
    COUNT(*) FILTER (WHERE outcome = 'push'),
    COUNT(*) FILTER (WHERE outcome = 'pending'),
    COALESCE(SUM(amount) FILTER (WHERE outcome = 'pending'), 0),
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(actual_return) FILTER (WHERE outcome = 'win'), 0),
    COALESCE(SUM(amount) FILTER (WHERE outcome = 'loss'), 0),
    CASE
      WHEN AVG(amount) IS NOT NULL THEN AVG(amount)
      ELSE 0
    END,
    COALESCE(MAX(actual_return) FILTER (WHERE outcome = 'win'), 0),
    COALESCE(MAX(amount) FILTER (WHERE outcome = 'loss'), 0),
    MAX(created_at),
    MAX(created_at) FILTER (WHERE outcome = 'win'),
    MAX(created_at) FILTER (WHERE outcome = 'loss')
  INTO
    v_total_bets_placed,
    v_total_bets_won,
    v_total_bets_lost,
    v_total_bets_pushed,
    v_pending_count,
    v_pending_amount,
    v_total_amount_wagered,
    v_total_amount_won,
    v_total_amount_lost,
    v_average_bet_size,
    v_largest_win,
    v_largest_loss,
    v_last_bet_at,
    v_last_win_at,
    v_last_loss_at
  FROM bets
  WHERE user_id = target_user_id;

  -- Calculate win rate
  IF v_total_bets_won + v_total_bets_lost > 0 THEN
    v_win_rate := (v_total_bets_won::NUMERIC / (v_total_bets_won + v_total_bets_lost)) * 100;
  ELSE
    v_win_rate := 0;
  END IF;

  -- Calculate total profit
  v_total_profit := v_total_amount_won - v_total_amount_lost;

  -- Calculate ROI
  IF v_total_amount_wagered > 0 THEN
    v_roi := (v_total_profit / v_total_amount_wagered) * 100;
  ELSE
    v_roi := 0;
  END IF;

  -- Calculate streaks (current, longest win, longest loss)
  -- Process bets in chronological order to track streaks
  FOR bet_record IN
    SELECT outcome, created_at
    FROM bets
    WHERE user_id = target_user_id
      AND outcome IN ('win', 'loss')
    ORDER BY created_at ASC
  LOOP
    IF bet_record.outcome = 'win' THEN
      IF v_temp_streak >= 0 THEN
        v_temp_streak := v_temp_streak + 1;
      ELSE
        v_temp_streak := 1;
      END IF;
      v_temp_win_streak := v_temp_win_streak + 1;
      v_temp_loss_streak := 0;

      IF v_temp_win_streak > v_longest_win_streak THEN
        v_longest_win_streak := v_temp_win_streak;
      END IF;
    ELSE -- loss
      IF v_temp_streak <= 0 THEN
        v_temp_streak := v_temp_streak - 1;
      ELSE
        v_temp_streak := -1;
      END IF;
      v_temp_loss_streak := v_temp_loss_streak + 1;
      v_temp_win_streak := 0;

      IF v_temp_loss_streak > v_longest_loss_streak THEN
        v_longest_loss_streak := v_temp_loss_streak;
      END IF;
    END IF;
  END LOOP;

  v_current_streak := v_temp_streak;

  -- Update the profile with calculated statistics
  UPDATE profiles
  SET
    total_bets_placed = v_total_bets_placed,
    total_bets_won = v_total_bets_won,
    total_bets_lost = v_total_bets_lost,
    total_bets_pushed = v_total_bets_pushed,
    total_amount_wagered = v_total_amount_wagered,
    total_amount_won = v_total_amount_won,
    total_amount_lost = v_total_amount_lost,
    win_rate = v_win_rate,
    roi = v_roi,
    average_bet_size = v_average_bet_size,
    largest_win = v_largest_win,
    largest_loss = v_largest_loss,
    current_streak = v_current_streak,
    longest_win_streak = v_longest_win_streak,
    longest_loss_streak = v_longest_loss_streak,
    total_profit = v_total_profit,
    pending_bet_count = v_pending_count,
    pending_bet_amount = v_pending_amount,
    last_bet_at = v_last_bet_at,
    last_win_at = v_last_win_at,
    last_loss_at = v_last_loss_at,
    last_sync_at = now()
  WHERE id = target_user_id;

  -- Return success with stats
  RETURN QUERY SELECT
    true AS success,
    'Profile synced successfully' AS message,
    jsonb_build_object(
      'total_bets_placed', v_total_bets_placed,
      'total_bets_won', v_total_bets_won,
      'total_bets_lost', v_total_bets_lost,
      'total_bets_pushed', v_total_bets_pushed,
      'win_rate', ROUND(v_win_rate, 2),
      'roi', ROUND(v_roi, 2),
      'total_profit', ROUND(v_total_profit, 2),
      'current_streak', v_current_streak,
      'longest_win_streak', v_longest_win_streak,
      'longest_loss_streak', v_longest_loss_streak,
      'pending_bet_count', v_pending_count,
      'pending_bet_amount', ROUND(v_pending_amount, 2)
    ) AS stats;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error syncing profile: ' || SQLERRM AS message,
      NULL::JSONB AS stats;
END;
$$;

COMMENT ON FUNCTION sync_user_betting_profile IS 'Syncs user profile statistics from bet history in CRM (bets table)';

-- ============================================================================
-- 3. CREATE TRIGGER FUNCTION TO AUTO-SYNC ON BET CHANGES
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_sync_betting_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Sync the profile for the affected user
  -- Use TG_OP to determine which user_id to sync
  IF TG_OP = 'DELETE' THEN
    PERFORM sync_user_betting_profile(OLD.user_id);
  ELSE
    PERFORM sync_user_betting_profile(NEW.user_id);
  END IF;

  -- Return appropriate record based on operation
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION trigger_sync_betting_profile IS 'Trigger function to automatically sync user profile when bets change';

-- ============================================================================
-- 4. CREATE TRIGGERS ON BETS TABLE
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_insert ON public.bets;
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_update ON public.bets;
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_delete ON public.bets;

-- Create trigger for INSERT
CREATE TRIGGER trigger_sync_profile_on_bet_insert
  AFTER INSERT ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_betting_profile();

-- Create trigger for UPDATE
CREATE TRIGGER trigger_sync_profile_on_bet_update
  AFTER UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_betting_profile();

-- Create trigger for DELETE
CREATE TRIGGER trigger_sync_profile_on_bet_delete
  AFTER DELETE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_sync_betting_profile();

-- ============================================================================
-- 5. INITIAL SYNC FOR EXISTING USERS
-- ============================================================================

-- Sync all existing user profiles with their bet history
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT DISTINCT id FROM profiles
  LOOP
    PERFORM sync_user_betting_profile(user_record.id);
  END LOOP;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
