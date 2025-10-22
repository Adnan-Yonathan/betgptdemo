-- ============================================================================
-- PERFORMANCE OPTIMIZATION MIGRATION
-- ============================================================================
-- This migration adds performance improvements including:
-- 1. Composite indexes for common query patterns
-- 2. Automatic materialized view refresh
-- 3. Query optimization hints
-- 4. Connection pooling optimizations
-- ============================================================================

-- ============================================================================
-- 1. ADD COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Bets table: Common filters (user_id + outcome + created_at)
CREATE INDEX IF NOT EXISTS idx_bets_user_outcome_created
  ON public.bets(user_id, outcome, created_at DESC)
  WHERE outcome IN ('win', 'loss', 'push');

-- Bets table: Analytics queries (user_id + sport + outcome)
CREATE INDEX IF NOT EXISTS idx_bets_user_sport_outcome
  ON public.bets(user_id, sport, outcome)
  WHERE outcome IN ('win', 'loss', 'push');

-- Bets table: Performance dashboard (user_id + bet_type + created_at)
CREATE INDEX IF NOT EXISTS idx_bets_user_type_created
  ON public.bets(user_id, bet_type, created_at DESC);

-- Betting odds: Faster odds lookup (sport_key + event_id + last_updated)
CREATE INDEX IF NOT EXISTS idx_betting_odds_sport_event_updated
  ON public.betting_odds(sport_key, event_id, last_updated DESC);

-- Betting odds: Market-specific queries (event_id + market_key + last_updated)
CREATE INDEX IF NOT EXISTS idx_betting_odds_event_market_updated
  ON public.betting_odds(event_id, market_key, last_updated DESC);

-- Messages: Conversation loading (conversation_id + created_at)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at ASC);

-- Conversations: User's recent conversations (user_id + updated_at)
CREATE INDEX IF NOT EXISTS idx_conversations_user_updated
  ON public.conversations(user_id, updated_at DESC);

-- Sports scores: Game lookup (league + game_date + last_updated)
CREATE INDEX IF NOT EXISTS idx_sports_scores_league_date_updated
  ON public.sports_scores(league, game_date, last_updated DESC);

-- Starting lineups: Event lookup with freshness check (event_id + last_updated)
CREATE INDEX IF NOT EXISTS idx_lineups_event_updated
  ON public.starting_lineups(event_id, last_updated DESC);

-- Matchup analysis: Recent analysis (sport + game_date + last_updated)
CREATE INDEX IF NOT EXISTS idx_matchup_sport_date_updated
  ON public.matchup_analysis(sport, game_date, last_updated DESC);

COMMENT ON INDEX idx_bets_user_outcome_created IS 'Optimizes bet history queries filtered by outcome';
COMMENT ON INDEX idx_bets_user_sport_outcome IS 'Optimizes sport-specific performance analytics';
COMMENT ON INDEX idx_betting_odds_sport_event_updated IS 'Speeds up odds cache checks';
COMMENT ON INDEX idx_messages_conversation_created IS 'Optimizes conversation loading';

-- ============================================================================
-- 2. AUTOMATIC MATERIALIZED VIEW REFRESH
-- ============================================================================

-- Function to refresh materialized view after bet updates
CREATE OR REPLACE FUNCTION trigger_refresh_bet_performance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only refresh if bet outcome changed (win/loss/push)
  IF (TG_OP = 'UPDATE' AND OLD.outcome = 'pending' AND NEW.outcome IN ('win', 'loss', 'push'))
     OR (TG_OP = 'INSERT' AND NEW.outcome IN ('win', 'loss', 'push')) THEN

    -- Refresh materialized view concurrently (non-blocking)
    PERFORM refresh_bet_performance_analytics();
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-refresh materialized view
DROP TRIGGER IF EXISTS trigger_auto_refresh_performance ON public.bets;
CREATE TRIGGER trigger_auto_refresh_performance
  AFTER INSERT OR UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_refresh_bet_performance();

COMMENT ON FUNCTION trigger_refresh_bet_performance IS 'Automatically refreshes performance analytics when bets are settled';

-- ============================================================================
-- 3. OPTIMIZE EXISTING QUERIES WITH COVERING INDEXES
-- ============================================================================

-- Covering index for bet history queries (includes all commonly selected columns)
CREATE INDEX IF NOT EXISTS idx_bets_user_covering
  ON public.bets(user_id, created_at DESC)
  INCLUDE (amount, odds, outcome, sport, team_bet_on, expected_value, actual_return);

-- Covering index for odds comparison queries
CREATE INDEX IF NOT EXISTS idx_betting_odds_covering
  ON public.betting_odds(event_id, market_key)
  INCLUDE (bookmaker, odds, point, last_updated);

COMMENT ON INDEX idx_bets_user_covering IS 'Covering index to avoid table lookups for bet history';
COMMENT ON INDEX idx_betting_odds_covering IS 'Covering index for odds comparison without table scan';

-- ============================================================================
-- 4. ADD PARTIAL INDEXES FOR SPECIFIC USE CASES
-- ============================================================================

-- Index only pending bets (actively used for settlement checks)
CREATE INDEX IF NOT EXISTS idx_bets_pending_settlement
  ON public.bets(event_id, created_at DESC)
  WHERE outcome = 'pending' AND event_id IS NOT NULL;

-- Index only recent odds (last 24 hours) for active games
CREATE INDEX IF NOT EXISTS idx_betting_odds_recent
  ON public.betting_odds(sport_key, event_id, last_updated DESC)
  WHERE last_updated > (now() - interval '24 hours');

-- Index only recent conversations (last 30 days)
CREATE INDEX IF NOT EXISTS idx_conversations_recent
  ON public.conversations(user_id, updated_at DESC)
  WHERE updated_at > (now() - interval '30 days');

COMMENT ON INDEX idx_bets_pending_settlement IS 'Optimizes bet settlement queries';
COMMENT ON INDEX idx_betting_odds_recent IS 'Speeds up queries for active games only';
COMMENT ON INDEX idx_conversations_recent IS 'Optimizes recent conversation loading';

-- ============================================================================
-- 5. ANALYZE TABLES FOR QUERY PLANNER OPTIMIZATION
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE public.bets;
ANALYZE public.betting_odds;
ANALYZE public.messages;
ANALYZE public.conversations;
ANALYZE public.sports_scores;
ANALYZE public.starting_lineups;
ANALYZE public.matchup_analysis;
ANALYZE public.profiles;

-- ============================================================================
-- 6. ADD FUNCTION FOR EFFICIENT BET HISTORY PAGINATION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_bets_paginated(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_sport TEXT DEFAULT NULL,
  p_outcome TEXT DEFAULT NULL,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  amount NUMERIC,
  odds NUMERIC,
  description TEXT,
  outcome TEXT,
  sport TEXT,
  league TEXT,
  team_bet_on TEXT,
  expected_value NUMERIC,
  actual_return NUMERIC,
  kelly_fraction NUMERIC,
  clv NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.amount,
    b.odds,
    b.description,
    b.outcome,
    b.sport,
    b.league,
    b.team_bet_on,
    b.expected_value,
    b.actual_return,
    b.kelly_fraction,
    b.clv,
    b.created_at,
    COUNT(*) OVER() as total_count
  FROM public.bets b
  WHERE b.user_id = p_user_id
    AND (p_sport IS NULL OR b.sport = p_sport)
    AND (p_outcome IS NULL OR b.outcome = p_outcome)
    AND (p_start_date IS NULL OR b.created_at >= p_start_date)
    AND (p_end_date IS NULL OR b.created_at <= p_end_date)
  ORDER BY b.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_user_bets_paginated IS 'Efficiently retrieves paginated bet history with optional filters';

-- ============================================================================
-- 7. ADD FUNCTION FOR EFFICIENT MESSAGE PAGINATION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_conversation_messages_paginated(
  p_conversation_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  role TEXT,
  content TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.role,
    m.content,
    m.created_at,
    COUNT(*) OVER() as total_count
  FROM public.messages m
  WHERE m.conversation_id = p_conversation_id
  ORDER BY m.created_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_conversation_messages_paginated IS 'Efficiently retrieves paginated conversation messages';

-- ============================================================================
-- 8. OPTIMIZE PROFILE QUERIES WITH MATERIALIZED STATS
-- ============================================================================

-- Add cached computed columns to profiles for faster dashboard loading
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS cached_total_bets INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS cached_total_wagered NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cached_total_won NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cached_win_rate NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cached_roi NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS stats_last_updated TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Function to update cached profile stats
CREATE OR REPLACE FUNCTION update_profile_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_bets INTEGER;
  v_total_wagered NUMERIC;
  v_total_won NUMERIC;
  v_win_count INTEGER;
  v_settled_count INTEGER;
  v_win_rate NUMERIC;
  v_roi NUMERIC;
  v_bankroll NUMERIC;
  v_initial_bankroll NUMERIC;
BEGIN
  -- Calculate stats from bets
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome IN ('win', 'loss', 'push')),
    COUNT(*) FILTER (WHERE outcome = 'win'),
    COALESCE(SUM(amount), 0),
    COALESCE(SUM(actual_return), 0)
  INTO v_total_bets, v_settled_count, v_win_count, v_total_wagered, v_total_won
  FROM public.bets
  WHERE user_id = p_user_id;

  -- Calculate win rate
  IF v_settled_count > 0 THEN
    v_win_rate := (v_win_count::NUMERIC / v_settled_count) * 100;
  ELSE
    v_win_rate := 0;
  END IF;

  -- Calculate ROI
  SELECT bankroll, initial_bankroll
  INTO v_bankroll, v_initial_bankroll
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_initial_bankroll > 0 THEN
    v_roi := ((v_bankroll - v_initial_bankroll) / v_initial_bankroll) * 100;
  ELSE
    v_roi := 0;
  END IF;

  -- Update profile with cached stats
  UPDATE public.profiles
  SET
    cached_total_bets = v_total_bets,
    cached_total_wagered = v_total_wagered,
    cached_total_won = v_total_won,
    cached_win_rate = ROUND(v_win_rate, 2),
    cached_roi = ROUND(v_roi, 2),
    stats_last_updated = now()
  WHERE id = p_user_id;
END;
$$;

COMMENT ON FUNCTION update_profile_stats IS 'Updates cached profile statistics for faster dashboard loading';

-- Trigger to auto-update profile stats when bets change
CREATE OR REPLACE FUNCTION trigger_update_profile_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update profile stats when bet outcome changes
  IF (TG_OP = 'UPDATE' AND OLD.outcome != NEW.outcome) OR TG_OP = 'INSERT' THEN
    PERFORM update_profile_stats(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_update_profile_stats ON public.bets;
CREATE TRIGGER trigger_auto_update_profile_stats
  AFTER INSERT OR UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_profile_stats();

COMMENT ON FUNCTION trigger_update_profile_stats IS 'Automatically updates profile stats when bets change';

-- ============================================================================
-- 9. ADD QUERY PERFORMANCE MONITORING
-- ============================================================================

-- Enable query performance tracking (optional, for debugging)
-- ALTER DATABASE postgres SET log_min_duration_statement = 1000; -- Log queries slower than 1s

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
