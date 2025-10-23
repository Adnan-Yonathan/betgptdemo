-- ============================================================================
-- PHASE 4: BET SETTLEMENT HELPER FUNCTIONS
-- ============================================================================
-- This migration adds helper functions to make bet settlement easier
-- and more robust for both chat and UI interactions.
-- ============================================================================

-- ============================================================================
-- 1. FUNCTION TO FIND PENDING BETS BY DESCRIPTION
-- ============================================================================

CREATE OR REPLACE FUNCTION find_pending_bets_by_description(
  p_user_id UUID,
  p_search_text TEXT,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  bet_id UUID,
  description TEXT,
  amount NUMERIC,
  odds NUMERIC,
  potential_return NUMERIC,
  team_bet_on TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  match_score INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bet_id,
    b.description,
    b.amount,
    b.odds,
    b.potential_return,
    b.team_bet_on,
    b.created_at,
    -- Calculate match score based on how well the description matches
    CASE
      WHEN b.description ILIKE p_search_text THEN 100
      WHEN b.description ILIKE '%' || p_search_text || '%' THEN 75
      WHEN b.team_bet_on ILIKE p_search_text THEN 90
      WHEN b.team_bet_on ILIKE '%' || p_search_text || '%' THEN 60
      ELSE 50
    END AS match_score
  FROM bets b
  WHERE b.user_id = p_user_id
    AND b.outcome = 'pending'
    AND (
      b.description ILIKE '%' || p_search_text || '%'
      OR b.team_bet_on ILIKE '%' || p_search_text || '%'
    )
  ORDER BY
    match_score DESC,
    b.created_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION find_pending_bets_by_description IS 'Finds pending bets matching a search string, ordered by relevance';

-- ============================================================================
-- 2. FUNCTION TO GET ALL PENDING BETS FOR A USER
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_pending_bets(
  p_user_id UUID
)
RETURNS TABLE(
  bet_id UUID,
  description TEXT,
  amount NUMERIC,
  odds NUMERIC,
  potential_return NUMERIC,
  team_bet_on TEXT,
  event_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  days_pending INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bet_id,
    b.description,
    b.amount,
    b.odds,
    b.potential_return,
    b.team_bet_on,
    b.event_id,
    b.created_at,
    EXTRACT(DAY FROM (now() - b.created_at))::INTEGER AS days_pending
  FROM bets b
  WHERE b.user_id = p_user_id
    AND b.outcome = 'pending'
  ORDER BY b.created_at DESC;
END;
$$;

COMMENT ON FUNCTION get_user_pending_bets IS 'Returns all pending bets for a user with additional context';

-- ============================================================================
-- 3. FUNCTION TO GET BET SETTLEMENT SUMMARY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_bet_settlement_summary(
  p_bet_id UUID
)
RETURNS TABLE(
  bet_id UUID,
  description TEXT,
  amount NUMERIC,
  odds NUMERIC,
  potential_return NUMERIC,
  team_bet_on TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  user_id UUID,
  current_outcome TEXT,
  win_return NUMERIC,
  loss_return NUMERIC,
  push_return NUMERIC,
  can_settle BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
  v_win_return NUMERIC;
BEGIN
  -- Get bet details
  SELECT * INTO v_bet
  FROM bets
  WHERE id = p_bet_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Calculate potential returns for each outcome
  IF v_bet.odds > 0 THEN
    v_win_return := v_bet.amount + (v_bet.amount * (v_bet.odds / 100));
  ELSE
    v_win_return := v_bet.amount + (v_bet.amount * (100 / ABS(v_bet.odds)));
  END IF;

  RETURN QUERY SELECT
    v_bet.id,
    v_bet.description,
    v_bet.amount,
    v_bet.odds,
    v_bet.potential_return,
    v_bet.team_bet_on,
    v_bet.created_at,
    v_bet.user_id,
    v_bet.outcome,
    v_win_return,           -- Win: stake + profit
    0::NUMERIC,            -- Loss: 0
    v_bet.amount,          -- Push: original stake
    v_bet.outcome = 'pending'  -- Can only settle pending bets
  ;
END;
$$;

COMMENT ON FUNCTION get_bet_settlement_summary IS 'Returns bet details with calculated returns for each potential outcome';

-- ============================================================================
-- 4. FUNCTION TO VALIDATE BET SETTLEMENT
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_bet_settlement(
  p_bet_id UUID,
  p_user_id UUID,
  p_outcome TEXT
)
RETURNS TABLE(
  valid BOOLEAN,
  error_code TEXT,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bet RECORD;
BEGIN
  -- Check if outcome is valid
  IF p_outcome NOT IN ('win', 'loss', 'push') THEN
    RETURN QUERY SELECT
      false,
      'INVALID_OUTCOME'::TEXT,
      'Outcome must be: win, loss, or push'::TEXT;
    RETURN;
  END IF;

  -- Get bet
  SELECT * INTO v_bet
  FROM bets
  WHERE id = p_bet_id;

  -- Check if bet exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      false,
      'BET_NOT_FOUND'::TEXT,
      'Bet does not exist'::TEXT;
    RETURN;
  END IF;

  -- Check ownership
  IF v_bet.user_id != p_user_id THEN
    RETURN QUERY SELECT
      false,
      'ACCESS_DENIED'::TEXT,
      'Bet does not belong to this user'::TEXT;
    RETURN;
  END IF;

  -- Check if already settled
  IF v_bet.outcome != 'pending' THEN
    RETURN QUERY SELECT
      false,
      'ALREADY_SETTLED'::TEXT,
      format('Bet already settled with outcome: %s', v_bet.outcome)::TEXT;
    RETURN;
  END IF;

  -- All validations passed
  RETURN QUERY SELECT
    true,
    NULL::TEXT,
    NULL::TEXT;
END;
$$;

COMMENT ON FUNCTION validate_bet_settlement IS 'Validates if a bet can be settled by a specific user with the given outcome';

-- ============================================================================
-- 5. FUNCTION TO GET RECENT SETTLEMENT HISTORY
-- ============================================================================

CREATE OR REPLACE FUNCTION get_recent_settlements(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
  bet_id UUID,
  description TEXT,
  amount NUMERIC,
  odds NUMERIC,
  outcome TEXT,
  actual_return NUMERIC,
  profit NUMERIC,
  settled_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id AS bet_id,
    b.description,
    b.amount,
    b.odds,
    b.outcome,
    b.actual_return,
    CASE
      WHEN b.outcome = 'win' THEN b.actual_return - b.amount
      WHEN b.outcome = 'loss' THEN -b.amount
      ELSE 0
    END AS profit,
    b.settled_at
  FROM bets b
  WHERE b.user_id = p_user_id
    AND b.outcome IN ('win', 'loss', 'push')
    AND b.settled_at IS NOT NULL
  ORDER BY b.settled_at DESC
  LIMIT p_limit;
END;
$$;

COMMENT ON FUNCTION get_recent_settlements IS 'Returns recently settled bets with profit/loss calculations';

-- ============================================================================
-- 6. FUNCTION TO COUNT PENDING BETS BY TEAM
-- ============================================================================

CREATE OR REPLACE FUNCTION count_pending_bets_by_team(
  p_user_id UUID
)
RETURNS TABLE(
  team_name TEXT,
  bet_count INTEGER,
  total_amount NUMERIC,
  avg_odds NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(b.team_bet_on, 'Unknown') AS team_name,
    COUNT(*)::INTEGER AS bet_count,
    SUM(b.amount) AS total_amount,
    AVG(b.odds) AS avg_odds
  FROM bets b
  WHERE b.user_id = p_user_id
    AND b.outcome = 'pending'
    AND b.team_bet_on IS NOT NULL
  GROUP BY b.team_bet_on
  ORDER BY bet_count DESC, total_amount DESC;
END;
$$;

COMMENT ON FUNCTION count_pending_bets_by_team IS 'Groups pending bets by team for easy identification of multiple bets';

-- ============================================================================
-- USAGE EXAMPLES
-- ============================================================================

-- Find pending bets matching "Lakers":
--   SELECT * FROM find_pending_bets_by_description('user-uuid', 'Lakers');

-- Get all pending bets for a user:
--   SELECT * FROM get_user_pending_bets('user-uuid');

-- Get settlement summary for a specific bet:
--   SELECT * FROM get_bet_settlement_summary('bet-uuid');

-- Validate before settling:
--   SELECT * FROM validate_bet_settlement('bet-uuid', 'user-uuid', 'win');

-- Get recent settlement history:
--   SELECT * FROM get_recent_settlements('user-uuid', 5);

-- Count pending bets by team (detect multiple bets):
--   SELECT * FROM count_pending_bets_by_team('user-uuid');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
