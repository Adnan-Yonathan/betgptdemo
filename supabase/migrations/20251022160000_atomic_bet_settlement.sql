-- ============================================================================
-- ATOMIC BET SETTLEMENT FUNCTION
-- ============================================================================
-- This migration creates a database function to settle bets atomically,
-- ensuring bankroll and CRM stats are always synchronized.
-- ============================================================================

-- ============================================================================
-- 1. CREATE ATOMIC BET SETTLEMENT FUNCTION
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
  SELECT bankroll INTO v_current_bankroll
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

  IF p_outcome = 'win' THEN
    v_profit := p_actual_return - v_bet.amount;
    v_new_bankroll := v_current_bankroll + v_profit;
  ELSIF p_outcome = 'loss' THEN
    v_new_bankroll := v_current_bankroll - v_bet.amount;
  END IF;
  -- For push, bankroll stays the same

  -- Step 1: Update the bet (this will trigger CRM sync via trigger)
  UPDATE bets
  SET
    outcome = p_outcome,
    actual_return = p_actual_return,
    settled_at = now(),
    closing_line = p_closing_line,
    clv = p_clv
  WHERE id = p_bet_id;

  -- Step 2: Update the bankroll
  UPDATE profiles
  SET bankroll = v_new_bankroll
  WHERE id = v_user_id;

  -- Step 3: Explicitly sync CRM to ensure all stats are current
  -- (The trigger already fired after the bet update, but we call again
  -- to ensure the stats reflect the final state after bankroll update)
  PERFORM sync_user_betting_profile(v_user_id);

  -- Return success with details
  RETURN QUERY SELECT
    true AS success,
    'Bet settled successfully' AS message,
    jsonb_build_object(
      'bet_id', p_bet_id,
      'outcome', p_outcome,
      'amount', v_bet.amount,
      'actual_return', p_actual_return,
      'profit', v_new_bankroll - v_current_bankroll,
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

COMMENT ON FUNCTION settle_bet_atomic IS 'Atomically settles a bet, updates bankroll, and syncs CRM stats in a single transaction';

-- ============================================================================
-- 2. CREATE BATCH SETTLEMENT FUNCTION FOR CRON JOB
-- ============================================================================

CREATE OR REPLACE FUNCTION settle_pending_bets_batch()
RETURNS TABLE(
  total_checked INTEGER,
  total_settled INTEGER,
  settled_wins INTEGER,
  settled_losses INTEGER,
  settled_pushes INTEGER,
  errors JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_checked INTEGER := 0;
  v_total_settled INTEGER := 0;
  v_settled_wins INTEGER := 0;
  v_settled_losses INTEGER := 0;
  v_settled_pushes INTEGER := 0;
  v_errors JSONB := '[]'::JSONB;
  bet_record RECORD;
  game_record RECORD;
  v_outcome TEXT;
  v_actual_return NUMERIC;
  v_closing_line NUMERIC;
  v_clv NUMERIC;
  v_did_win BOOLEAN;
  settlement_result RECORD;
BEGIN
  -- Find all pending bets with event_id
  FOR bet_record IN
    SELECT *
    FROM bets
    WHERE outcome = 'pending'
      AND event_id IS NOT NULL
    ORDER BY created_at ASC
  LOOP
    v_total_checked := v_total_checked + 1;

    -- Get the corresponding game
    SELECT * INTO game_record
    FROM sports_scores
    WHERE event_id = bet_record.event_id;

    -- Skip if game not found or not final
    IF NOT FOUND OR game_record.game_status != 'STATUS_FINAL' THEN
      CONTINUE;
    END IF;

    -- Determine outcome
    v_did_win := false;

    IF bet_record.team_bet_on IS NOT NULL THEN
      -- Check if bet on home team and home won
      IF (game_record.home_team ILIKE '%' || bet_record.team_bet_on || '%' OR
          bet_record.team_bet_on ILIKE '%' || game_record.home_team || '%') AND
         game_record.home_score > game_record.away_score THEN
        v_did_win := true;
      END IF;

      -- Check if bet on away team and away won
      IF (game_record.away_team ILIKE '%' || bet_record.team_bet_on || '%' OR
          bet_record.team_bet_on ILIKE '%' || game_record.away_team || '%') AND
         game_record.away_score > game_record.home_score THEN
        v_did_win := true;
      END IF;
    END IF;

    -- Determine final outcome and actual return
    IF game_record.home_score = game_record.away_score THEN
      v_outcome := 'push';
      v_actual_return := bet_record.amount;
    ELSIF v_did_win THEN
      v_outcome := 'win';
      v_actual_return := bet_record.potential_return;
    ELSE
      v_outcome := 'loss';
      v_actual_return := 0;
    END IF;

    -- Calculate CLV if possible
    v_closing_line := NULL;
    v_clv := NULL;

    IF bet_record.opening_line IS NOT NULL AND bet_record.team_bet_on IS NOT NULL AND bet_record.market_key IS NOT NULL THEN
      SELECT outcome_price INTO v_closing_line
      FROM betting_odds
      WHERE event_id = bet_record.event_id
        AND outcome_name = bet_record.team_bet_on
        AND market_key = bet_record.market_key
        AND last_updated <= game_record.game_date
      ORDER BY last_updated DESC
      LIMIT 1;

      IF v_closing_line IS NOT NULL THEN
        SELECT calculate_clv(bet_record.odds, v_closing_line) INTO v_clv;
      END IF;
    END IF;

    -- Settle the bet atomically
    BEGIN
      SELECT * INTO settlement_result
      FROM settle_bet_atomic(
        bet_record.id,
        v_outcome,
        v_actual_return,
        v_closing_line,
        v_clv
      );

      IF settlement_result.success THEN
        v_total_settled := v_total_settled + 1;

        IF v_outcome = 'win' THEN
          v_settled_wins := v_settled_wins + 1;
        ELSIF v_outcome = 'loss' THEN
          v_settled_losses := v_settled_losses + 1;
        ELSE
          v_settled_pushes := v_settled_pushes + 1;
        END IF;
      ELSE
        v_errors := v_errors || jsonb_build_object(
          'bet_id', bet_record.id,
          'error', settlement_result.message
        );
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors || jsonb_build_object(
          'bet_id', bet_record.id,
          'error', SQLERRM
        );
    END;
  END LOOP;

  RETURN QUERY SELECT
    v_total_checked,
    v_total_settled,
    v_settled_wins,
    v_settled_losses,
    v_settled_pushes,
    v_errors;
END;
$$;

COMMENT ON FUNCTION settle_pending_bets_batch IS 'Batch settle all pending bets with final game scores. Called by cron job.';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
