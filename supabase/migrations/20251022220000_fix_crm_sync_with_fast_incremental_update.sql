-- ============================================================================
-- FIX: RESTORE CRM SYNC WITH FAST INCREMENTAL UPDATES
-- ============================================================================
-- This migration fixes the broken CRM connection by re-enabling automatic
-- profile syncing, but using a FAST incremental approach instead of the
-- slow full recalculation.
--
-- Strategy:
-- 1. Keep lightweight flag trigger for complex stats (streaks)
-- 2. Add FAST incremental trigger for simple stats (counts, sums)
-- 3. Use AFTER trigger that updates stats incrementally (microseconds)
-- 4. Only recalculate streaks when explicitly needed (on-demand)
-- ============================================================================

-- ============================================================================
-- 1. CREATE FAST INCREMENTAL UPDATE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION update_profile_stats_incremental()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_old_outcome TEXT;
  v_new_outcome TEXT;
  v_old_amount NUMERIC;
  v_new_amount NUMERIC;
  v_old_return NUMERIC;
  v_new_return NUMERIC;
BEGIN
  -- Determine which user and values to work with based on operation
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
    v_old_outcome := OLD.outcome;
    v_old_amount := OLD.amount;
    v_old_return := COALESCE(OLD.actual_return, 0);
  ELSIF TG_OP = 'UPDATE' THEN
    v_user_id := NEW.user_id;
    v_old_outcome := OLD.outcome;
    v_new_outcome := NEW.outcome;
    v_old_amount := OLD.amount;
    v_new_amount := NEW.amount;
    v_old_return := COALESCE(OLD.actual_return, 0);
    v_new_return := COALESCE(NEW.actual_return, 0);
  ELSE -- INSERT
    v_user_id := NEW.user_id;
    v_new_outcome := NEW.outcome;
    v_new_amount := NEW.amount;
    v_new_return := COALESCE(NEW.actual_return, 0);
  END IF;

  -- FAST INCREMENTAL UPDATE: Only update the changed values, no loops!
  -- This is O(1) complexity instead of O(n)

  IF TG_OP = 'INSERT' THEN
    -- Increment counts and sums based on new bet
    UPDATE profiles
    SET
      total_bets_placed = total_bets_placed + 1,
      total_bets_won = total_bets_won + CASE WHEN v_new_outcome = 'win' THEN 1 ELSE 0 END,
      total_bets_lost = total_bets_lost + CASE WHEN v_new_outcome = 'loss' THEN 1 ELSE 0 END,
      total_bets_pushed = total_bets_pushed + CASE WHEN v_new_outcome = 'push' THEN 1 ELSE 0 END,
      pending_bet_count = pending_bet_count + CASE WHEN v_new_outcome = 'pending' THEN 1 ELSE 0 END,
      pending_bet_amount = pending_bet_amount + CASE WHEN v_new_outcome = 'pending' THEN v_new_amount ELSE 0 END,
      total_amount_wagered = total_amount_wagered + v_new_amount,
      total_amount_won = total_amount_won + CASE WHEN v_new_outcome = 'win' THEN v_new_return ELSE 0 END,
      total_amount_lost = total_amount_lost + CASE WHEN v_new_outcome = 'loss' THEN v_new_amount ELSE 0 END,
      total_profit = total_profit + CASE
        WHEN v_new_outcome = 'win' THEN v_new_return
        WHEN v_new_outcome = 'loss' THEN -v_new_amount
        ELSE 0
      END,
      last_bet_at = GREATEST(last_bet_at, NEW.created_at),
      last_win_at = CASE WHEN v_new_outcome = 'win' THEN GREATEST(COALESCE(last_win_at, NEW.created_at), NEW.created_at) ELSE last_win_at END,
      last_loss_at = CASE WHEN v_new_outcome = 'loss' THEN GREATEST(COALESCE(last_loss_at, NEW.created_at), NEW.created_at) ELSE last_loss_at END,
      largest_win = CASE WHEN v_new_outcome = 'win' THEN GREATEST(largest_win, v_new_return) ELSE largest_win END,
      largest_loss = CASE WHEN v_new_outcome = 'loss' THEN GREATEST(largest_loss, v_new_amount) ELSE largest_loss END,
      -- Recalculate derived stats
      win_rate = CASE
        WHEN (total_bets_won + total_bets_lost + CASE WHEN v_new_outcome IN ('win', 'loss') THEN 1 ELSE 0 END) > 0
        THEN ((total_bets_won + CASE WHEN v_new_outcome = 'win' THEN 1 ELSE 0 END)::NUMERIC /
              (total_bets_won + total_bets_lost + CASE WHEN v_new_outcome IN ('win', 'loss') THEN 1 ELSE 0 END)) * 100
        ELSE 0
      END,
      roi = CASE
        WHEN (total_amount_wagered + v_new_amount) > 0
        THEN ((total_profit + CASE
          WHEN v_new_outcome = 'win' THEN v_new_return
          WHEN v_new_outcome = 'loss' THEN -v_new_amount
          ELSE 0
        END) / (total_amount_wagered + v_new_amount)) * 100
        ELSE 0
      END,
      average_bet_size = (total_amount_wagered + v_new_amount) / (total_bets_placed + 1),
      -- Flag that streaks need recalculation (expensive operation, do later)
      needs_profile_sync = CASE WHEN v_new_outcome IN ('win', 'loss') THEN true ELSE needs_profile_sync END,
      last_sync_at = now()
    WHERE id = v_user_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counts and sums based on deleted bet
    UPDATE profiles
    SET
      total_bets_placed = GREATEST(0, total_bets_placed - 1),
      total_bets_won = GREATEST(0, total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END),
      total_bets_lost = GREATEST(0, total_bets_lost - CASE WHEN v_old_outcome = 'loss' THEN 1 ELSE 0 END),
      total_bets_pushed = GREATEST(0, total_bets_pushed - CASE WHEN v_old_outcome = 'push' THEN 1 ELSE 0 END),
      pending_bet_count = GREATEST(0, pending_bet_count - CASE WHEN v_old_outcome = 'pending' THEN 1 ELSE 0 END),
      pending_bet_amount = GREATEST(0, pending_bet_amount - CASE WHEN v_old_outcome = 'pending' THEN v_old_amount ELSE 0 END),
      total_amount_wagered = GREATEST(0, total_amount_wagered - v_old_amount),
      total_amount_won = GREATEST(0, total_amount_won - CASE WHEN v_old_outcome = 'win' THEN v_old_return ELSE 0 END),
      total_amount_lost = GREATEST(0, total_amount_lost - CASE WHEN v_old_outcome = 'loss' THEN v_old_amount ELSE 0 END),
      total_profit = total_profit - CASE
        WHEN v_old_outcome = 'win' THEN v_old_return
        WHEN v_old_outcome = 'loss' THEN -v_old_amount
        ELSE 0
      END,
      -- Recalculate derived stats
      win_rate = CASE
        WHEN (total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END +
              total_bets_lost - CASE WHEN v_old_outcome = 'loss' THEN 1 ELSE 0 END) > 0
        THEN ((total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END)::NUMERIC /
              (total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END +
               total_bets_lost - CASE WHEN v_old_outcome = 'loss' THEN 1 ELSE 0 END)) * 100
        ELSE 0
      END,
      roi = CASE
        WHEN (total_amount_wagered - v_old_amount) > 0
        THEN ((total_profit - CASE
          WHEN v_old_outcome = 'win' THEN v_old_return
          WHEN v_old_outcome = 'loss' THEN -v_old_amount
          ELSE 0
        END) / (total_amount_wagered - v_old_amount)) * 100
        ELSE 0
      END,
      average_bet_size = CASE
        WHEN (total_bets_placed - 1) > 0
        THEN (total_amount_wagered - v_old_amount) / (total_bets_placed - 1)
        ELSE 0
      END,
      -- Flag that streaks need recalculation
      needs_profile_sync = CASE WHEN v_old_outcome IN ('win', 'loss') THEN true ELSE needs_profile_sync END,
      last_sync_at = now()
    WHERE id = v_user_id;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle outcome changes (e.g., pending -> win)
    UPDATE profiles
    SET
      -- Adjust counts based on outcome change
      total_bets_won = total_bets_won
        - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END
        + CASE WHEN v_new_outcome = 'win' THEN 1 ELSE 0 END,
      total_bets_lost = total_bets_lost
        - CASE WHEN v_old_outcome = 'loss' THEN 1 ELSE 0 END
        + CASE WHEN v_new_outcome = 'loss' THEN 1 ELSE 0 END,
      total_bets_pushed = total_bets_pushed
        - CASE WHEN v_old_outcome = 'push' THEN 1 ELSE 0 END
        + CASE WHEN v_new_outcome = 'push' THEN 1 ELSE 0 END,
      pending_bet_count = pending_bet_count
        - CASE WHEN v_old_outcome = 'pending' THEN 1 ELSE 0 END
        + CASE WHEN v_new_outcome = 'pending' THEN 1 ELSE 0 END,
      pending_bet_amount = pending_bet_amount
        - CASE WHEN v_old_outcome = 'pending' THEN v_old_amount ELSE 0 END
        + CASE WHEN v_new_outcome = 'pending' THEN v_new_amount ELSE 0 END,
      total_amount_wagered = total_amount_wagered - v_old_amount + v_new_amount,
      total_amount_won = total_amount_won
        - CASE WHEN v_old_outcome = 'win' THEN v_old_return ELSE 0 END
        + CASE WHEN v_new_outcome = 'win' THEN v_new_return ELSE 0 END,
      total_amount_lost = total_amount_lost
        - CASE WHEN v_old_outcome = 'loss' THEN v_old_amount ELSE 0 END
        + CASE WHEN v_new_outcome = 'loss' THEN v_new_amount ELSE 0 END,
      total_profit = total_profit
        - CASE WHEN v_old_outcome = 'win' THEN v_old_return WHEN v_old_outcome = 'loss' THEN -v_old_amount ELSE 0 END
        + CASE WHEN v_new_outcome = 'win' THEN v_new_return WHEN v_new_outcome = 'loss' THEN -v_new_amount ELSE 0 END,
      last_bet_at = GREATEST(last_bet_at, NEW.created_at),
      last_win_at = CASE WHEN v_new_outcome = 'win' THEN GREATEST(COALESCE(last_win_at, NEW.created_at), NEW.created_at) ELSE last_win_at END,
      last_loss_at = CASE WHEN v_new_outcome = 'loss' THEN GREATEST(COALESCE(last_loss_at, NEW.created_at), NEW.created_at) ELSE last_loss_at END,
      largest_win = CASE WHEN v_new_outcome = 'win' THEN GREATEST(largest_win, v_new_return) ELSE largest_win END,
      largest_loss = CASE WHEN v_new_outcome = 'loss' THEN GREATEST(largest_loss, v_new_amount) ELSE largest_loss END,
      -- Recalculate derived stats
      win_rate = CASE
        WHEN (total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END + CASE WHEN v_new_outcome = 'win' THEN 1 ELSE 0 END +
              total_bets_lost - CASE WHEN v_old_outcome = 'loss' THEN 1 ELSE 0 END + CASE WHEN v_new_outcome = 'loss' THEN 1 ELSE 0 END) > 0
        THEN ((total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END + CASE WHEN v_new_outcome = 'win' THEN 1 ELSE 0 END)::NUMERIC /
              (total_bets_won - CASE WHEN v_old_outcome = 'win' THEN 1 ELSE 0 END + CASE WHEN v_new_outcome = 'win' THEN 1 ELSE 0 END +
               total_bets_lost - CASE WHEN v_old_outcome = 'loss' THEN 1 ELSE 0 END + CASE WHEN v_new_outcome = 'loss' THEN 1 ELSE 0 END)) * 100
        ELSE 0
      END,
      roi = CASE
        WHEN (total_amount_wagered - v_old_amount + v_new_amount) > 0
        THEN ((total_profit
          - CASE WHEN v_old_outcome = 'win' THEN v_old_return WHEN v_old_outcome = 'loss' THEN -v_old_amount ELSE 0 END
          + CASE WHEN v_new_outcome = 'win' THEN v_new_return WHEN v_new_outcome = 'loss' THEN -v_new_amount ELSE 0 END
        ) / (total_amount_wagered - v_old_amount + v_new_amount)) * 100
        ELSE 0
      END,
      average_bet_size = (total_amount_wagered - v_old_amount + v_new_amount) / GREATEST(1, total_bets_placed),
      -- Flag that streaks need recalculation if outcome changed to/from win/loss
      needs_profile_sync = CASE
        WHEN (v_old_outcome IN ('win', 'loss') OR v_new_outcome IN ('win', 'loss'))
          AND v_old_outcome != v_new_outcome
        THEN true
        ELSE needs_profile_sync
      END,
      last_sync_at = now()
    WHERE id = v_user_id;
  END IF;

  -- Return appropriate record
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION update_profile_stats_incremental IS 'Fast O(1) incremental update of profile stats. Updates counts and sums immediately, flags streaks for later calculation.';

-- ============================================================================
-- 2. REPLACE TRIGGERS WITH FAST INCREMENTAL VERSION
-- ============================================================================

-- Drop the lightweight flag-only triggers
DROP TRIGGER IF EXISTS trigger_flag_profile_on_bet_insert ON public.bets;
DROP TRIGGER IF EXISTS trigger_flag_profile_on_bet_update ON public.bets;
DROP TRIGGER IF EXISTS trigger_flag_profile_on_bet_delete ON public.bets;

-- Create new fast incremental triggers
CREATE TRIGGER trigger_update_profile_on_bet_insert
  AFTER INSERT ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_incremental();

CREATE TRIGGER trigger_update_profile_on_bet_update
  AFTER UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_incremental();

CREATE TRIGGER trigger_update_profile_on_bet_delete
  AFTER DELETE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_stats_incremental();

COMMENT ON TRIGGER trigger_update_profile_on_bet_insert ON public.bets IS 'Fast incremental update of profile stats on bet insert';
COMMENT ON TRIGGER trigger_update_profile_on_bet_update ON public.bets IS 'Fast incremental update of profile stats on bet update';
COMMENT ON TRIGGER trigger_update_profile_on_bet_delete ON public.bets IS 'Fast incremental update of profile stats on bet delete';

-- ============================================================================
-- 3. OPTIMIZE THE STREAK CALCULATION FUNCTION
-- ============================================================================

-- Keep the existing sync_user_betting_profile function for streak calculation
-- but make it only recalculate streaks, not all stats
CREATE OR REPLACE FUNCTION sync_user_betting_profile_streaks_only(target_user_id UUID)
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
  v_current_streak INTEGER := 0;
  v_longest_win_streak INTEGER := 0;
  v_longest_loss_streak INTEGER := 0;
  v_temp_streak INTEGER := 0;
  v_temp_win_streak INTEGER := 0;
  v_temp_loss_streak INTEGER := 0;
  bet_record RECORD;
BEGIN
  -- Only calculate streaks (the expensive part)
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

  -- Update ONLY the streak fields
  UPDATE profiles
  SET
    current_streak = v_current_streak,
    longest_win_streak = v_longest_win_streak,
    longest_loss_streak = v_longest_loss_streak,
    needs_profile_sync = false,
    last_sync_at = now()
  WHERE id = target_user_id;

  RETURN QUERY SELECT
    true AS success,
    'Streaks synced successfully' AS message,
    jsonb_build_object(
      'current_streak', v_current_streak,
      'longest_win_streak', v_longest_win_streak,
      'longest_loss_streak', v_longest_loss_streak
    ) AS stats;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error syncing streaks: ' || SQLERRM AS message,
      NULL::JSONB AS stats;
END;
$$;

-- Update the sync_profile_if_needed to use the streaks-only function
CREATE OR REPLACE FUNCTION sync_profile_if_needed(target_user_id UUID)
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
  needs_sync BOOLEAN;
BEGIN
  -- Check if streak sync is needed
  SELECT needs_profile_sync INTO needs_sync
  FROM profiles
  WHERE id = target_user_id;

  -- If no sync needed, return early
  IF NOT COALESCE(needs_sync, false) THEN
    RETURN QUERY SELECT
      true AS success,
      'Profile already synced' AS message,
      NULL::JSONB AS stats;
    RETURN;
  END IF;

  -- Perform streak-only sync (much faster than full sync)
  RETURN QUERY SELECT * FROM sync_user_betting_profile_streaks_only(target_user_id);

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error syncing profile: ' || SQLERRM AS message,
      NULL::JSONB AS stats;
END;
$$;

-- ============================================================================
-- 4. UPDATE BATCH SYNC TO USE STREAKS-ONLY VERSION
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_all_flagged_profiles()
RETURNS TABLE(
  synced_count INTEGER,
  error_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_error_count INTEGER := 0;
  user_record RECORD;
  sync_result RECORD;
BEGIN
  FOR user_record IN
    SELECT id
    FROM profiles
    WHERE needs_profile_sync = true
    LIMIT 100
  LOOP
    BEGIN
      -- Use streaks-only sync for efficiency
      SELECT * INTO sync_result
      FROM sync_user_betting_profile_streaks_only(user_record.id);

      IF sync_result.success THEN
        v_synced_count := v_synced_count + 1;
      ELSE
        v_error_count := v_error_count + 1;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error syncing profile %: %', user_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT
    v_synced_count,
    v_error_count,
    format('Synced %s profiles, %s errors', v_synced_count, v_error_count) AS message;
END;
$$;

-- ============================================================================
-- 5. INITIAL SYNC - RECALCULATE ALL EXISTING PROFILES
-- ============================================================================

-- Recalculate all existing profiles from scratch using the full sync
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
-- SUMMARY
-- ============================================================================
-- Now the system works as follows:
-- 1. When a bet is inserted/updated/deleted, the trigger runs FAST incremental updates (< 10ms)
-- 2. Simple stats (counts, sums, win rate, ROI) are updated immediately
-- 3. Complex stats (streaks) are flagged for later calculation
-- 4. Streaks are calculated on-demand when BankrollStats component loads (if flagged)
-- 5. This gives us automatic CRM sync WITHOUT blocking operations
-- ============================================================================
