-- Phase 3: User Preferences and Intelligence System
-- Part 2: Betting Patterns Analysis Table
-- Analyzes historical betting patterns to identify strengths, weaknesses, and tendencies

CREATE TABLE IF NOT EXISTS public.betting_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Overall performance metrics
  total_bets INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_pushes INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  total_wagered NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,

  -- Performance by league (JSONB format: {"NBA": {"wins": 10, "losses": 5, "roi": 15.5}, ...})
  performance_by_league JSONB DEFAULT '{}'::jsonb,

  -- Performance by bet type (JSONB format: {"moneyline": {...}, "spread": {...}, ...})
  performance_by_bet_type JSONB DEFAULT '{}'::jsonb,

  -- Performance by day of week (JSONB format: {"Monday": {...}, "Tuesday": {...}, ...})
  performance_by_day JSONB DEFAULT '{}'::jsonb,

  -- Performance by team (JSONB format: {"Lakers": {"wins": 8, "losses": 3, ...}, ...})
  performance_by_team JSONB DEFAULT '{}'::jsonb,

  -- Performance by odds range (JSONB format: {"favorites": {...}, "underdogs": {...}, ...})
  performance_by_odds JSONB DEFAULT '{}'::jsonb,

  -- Streak tracking
  current_win_streak INTEGER DEFAULT 0,
  current_loss_streak INTEGER DEFAULT 0,
  longest_win_streak INTEGER DEFAULT 0,
  longest_loss_streak INTEGER DEFAULT 0,

  -- Best/worst categories (auto-calculated)
  best_league TEXT,
  best_league_roi NUMERIC DEFAULT 0,
  worst_league TEXT,
  worst_league_roi NUMERIC DEFAULT 0,

  best_bet_type TEXT,
  best_bet_type_roi NUMERIC DEFAULT 0,
  worst_bet_type TEXT,
  worst_bet_type_roi NUMERIC DEFAULT 0,

  best_day TEXT,
  best_day_roi NUMERIC DEFAULT 0,
  worst_day TEXT,
  worst_day_roi NUMERIC DEFAULT 0,

  best_team TEXT,
  best_team_win_rate NUMERIC DEFAULT 0,
  worst_team TEXT,
  worst_team_win_rate NUMERIC DEFAULT 0,

  -- Tilt indicators
  avg_bet_size NUMERIC DEFAULT 0,
  recent_bet_size_variance NUMERIC DEFAULT 0, -- Higher = more inconsistent sizing
  bet_size_after_loss_multiplier NUMERIC DEFAULT 1.0, -- >1.0 = chasing losses
  tilt_score INTEGER DEFAULT 0 CHECK (tilt_score BETWEEN 0 AND 100),

  -- Time-based patterns
  best_time_of_day TEXT, -- 'morning', 'afternoon', 'evening', 'late-night'
  worst_time_of_day TEXT,

  -- Last calculation timestamp
  last_calculated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.betting_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own betting patterns"
ON public.betting_patterns
FOR SELECT
USING (auth.uid() = user_id);

-- Create index
CREATE INDEX idx_betting_patterns_user_id ON public.betting_patterns(user_id);

-- Function to calculate comprehensive betting patterns
CREATE OR REPLACE FUNCTION public.calculate_user_betting_patterns(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  pattern_data JSONB;
  total_bets_count INTEGER;
  wins_count INTEGER;
  losses_count INTEGER;
  pushes_count INTEGER;
  win_rate_calc NUMERIC;
  total_wagered_calc NUMERIC;
  total_profit_calc NUMERIC;
  roi_calc NUMERIC;
  league_performance JSONB;
  bet_type_performance JSONB;
  day_performance JSONB;
  team_performance JSONB;
  odds_performance JSONB;
  current_streak_type TEXT;
  current_streak_count INTEGER;
  longest_win_count INTEGER;
  longest_loss_count INTEGER;
  avg_bet NUMERIC;
  bet_variance NUMERIC;
  chase_multiplier NUMERIC;
  tilt_calc INTEGER;
BEGIN
  -- Calculate overall metrics
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE outcome = 'win'),
    COUNT(*) FILTER (WHERE outcome = 'loss'),
    COUNT(*) FILTER (WHERE outcome = 'push'),
    SUM(amount),
    SUM(profit_loss)
  INTO
    total_bets_count,
    wins_count,
    losses_count,
    pushes_count,
    total_wagered_calc,
    total_profit_calc
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss', 'push');

  -- Calculate win rate and ROI
  win_rate_calc := CASE
    WHEN total_bets_count > 0 THEN ROUND((wins_count::NUMERIC / total_bets_count) * 100, 2)
    ELSE 0
  END;

  roi_calc := CASE
    WHEN total_wagered_calc > 0 THEN ROUND((total_profit_calc / total_wagered_calc) * 100, 2)
    ELSE 0
  END;

  -- Calculate performance by league
  SELECT jsonb_object_agg(
    league,
    jsonb_build_object(
      'wins', wins,
      'losses', losses,
      'pushes', pushes,
      'win_rate', ROUND((wins::NUMERIC / NULLIF(wins + losses, 0)) * 100, 2),
      'roi', ROUND((profit_loss / NULLIF(wagered, 0)) * 100, 2),
      'total_bets', wins + losses + pushes,
      'profit_loss', profit_loss
    )
  ) INTO league_performance
  FROM (
    SELECT
      COALESCE(league, 'Unknown') as league,
      COUNT(*) FILTER (WHERE outcome = 'win') as wins,
      COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
      COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
      SUM(amount) as wagered,
      SUM(profit_loss) as profit_loss
    FROM public.bets
    WHERE user_id = p_user_id AND outcome IN ('win', 'loss', 'push')
    GROUP BY league
  ) league_stats;

  -- Calculate performance by bet type
  SELECT jsonb_object_agg(
    bet_type,
    jsonb_build_object(
      'wins', wins,
      'losses', losses,
      'pushes', pushes,
      'win_rate', ROUND((wins::NUMERIC / NULLIF(wins + losses, 0)) * 100, 2),
      'roi', ROUND((profit_loss / NULLIF(wagered, 0)) * 100, 2),
      'total_bets', wins + losses + pushes
    )
  ) INTO bet_type_performance
  FROM (
    SELECT
      COALESCE(market_key, bet_type, 'Unknown') as bet_type,
      COUNT(*) FILTER (WHERE outcome = 'win') as wins,
      COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
      COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
      SUM(amount) as wagered,
      SUM(profit_loss) as profit_loss
    FROM public.bets
    WHERE user_id = p_user_id AND outcome IN ('win', 'loss', 'push')
    GROUP BY COALESCE(market_key, bet_type, 'Unknown')
  ) type_stats;

  -- Calculate performance by day of week
  SELECT jsonb_object_agg(
    day_name,
    jsonb_build_object(
      'wins', wins,
      'losses', losses,
      'win_rate', ROUND((wins::NUMERIC / NULLIF(wins + losses, 0)) * 100, 2),
      'roi', ROUND((profit_loss / NULLIF(wagered, 0)) * 100, 2),
      'total_bets', wins + losses + pushes
    )
  ) INTO day_performance
  FROM (
    SELECT
      TO_CHAR(created_at, 'Day') as day_name,
      COUNT(*) FILTER (WHERE outcome = 'win') as wins,
      COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
      COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
      SUM(amount) as wagered,
      SUM(profit_loss) as profit_loss
    FROM public.bets
    WHERE user_id = p_user_id AND outcome IN ('win', 'loss', 'push')
    GROUP BY TO_CHAR(created_at, 'Day')
  ) day_stats;

  -- Calculate performance by team
  SELECT jsonb_object_agg(
    team_bet_on,
    jsonb_build_object(
      'wins', wins,
      'losses', losses,
      'win_rate', ROUND((wins::NUMERIC / NULLIF(wins + losses, 0)) * 100, 2),
      'roi', ROUND((profit_loss / NULLIF(wagered, 0)) * 100, 2),
      'total_bets', wins + losses + pushes
    )
  ) INTO team_performance
  FROM (
    SELECT
      team_bet_on,
      COUNT(*) FILTER (WHERE outcome = 'win') as wins,
      COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
      COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
      SUM(amount) as wagered,
      SUM(profit_loss) as profit_loss
    FROM public.bets
    WHERE user_id = p_user_id
      AND outcome IN ('win', 'loss', 'push')
      AND team_bet_on IS NOT NULL
      AND team_bet_on != ''
    GROUP BY team_bet_on
    HAVING COUNT(*) >= 3 -- Only include teams with 3+ bets
  ) team_stats;

  -- Calculate performance by odds (favorites vs underdogs)
  SELECT jsonb_object_agg(
    odds_category,
    jsonb_build_object(
      'wins', wins,
      'losses', losses,
      'win_rate', ROUND((wins::NUMERIC / NULLIF(wins + losses, 0)) * 100, 2),
      'roi', ROUND((profit_loss / NULLIF(wagered, 0)) * 100, 2),
      'total_bets', wins + losses + pushes
    )
  ) INTO odds_performance
  FROM (
    SELECT
      CASE
        WHEN odds < 0 AND odds >= -200 THEN 'favorites'
        WHEN odds < -200 THEN 'heavy_favorites'
        WHEN odds > 0 AND odds <= 200 THEN 'underdogs'
        WHEN odds > 200 THEN 'longshots'
        ELSE 'even'
      END as odds_category,
      COUNT(*) FILTER (WHERE outcome = 'win') as wins,
      COUNT(*) FILTER (WHERE outcome = 'loss') as losses,
      COUNT(*) FILTER (WHERE outcome = 'push') as pushes,
      SUM(amount) as wagered,
      SUM(profit_loss) as profit_loss
    FROM public.bets
    WHERE user_id = p_user_id AND outcome IN ('win', 'loss', 'push')
    GROUP BY odds_category
  ) odds_stats;

  -- Calculate current streaks
  WITH recent_bets_ordered AS (
    SELECT outcome, created_at
    FROM public.bets
    WHERE user_id = p_user_id AND outcome IN ('win', 'loss')
    ORDER BY created_at DESC
    LIMIT 100
  ),
  streak_calc AS (
    SELECT
      outcome,
      ROW_NUMBER() OVER (ORDER BY created_at DESC) as rn,
      CASE WHEN outcome = LAG(outcome) OVER (ORDER BY created_at DESC) THEN 0 ELSE 1 END as streak_break
    FROM recent_bets_ordered
  )
  SELECT
    FIRST_VALUE(outcome) OVER (ORDER BY created_at DESC),
    COUNT(*) FILTER (WHERE streak_break = 0 OR rn = 1)
  INTO current_streak_type, current_streak_count
  FROM streak_calc
  LIMIT 1;

  -- Calculate longest streaks (all time)
  SELECT MAX(wins) as max_wins, MAX(losses) as max_losses
  INTO longest_win_count, longest_loss_count
  FROM (
    SELECT
      COUNT(*) FILTER (WHERE outcome = 'win') as wins,
      COUNT(*) FILTER (WHERE outcome = 'loss') as losses
    FROM public.bets
    WHERE user_id = p_user_id
  ) t;

  -- Calculate tilt indicators
  SELECT
    AVG(amount),
    STDDEV(amount) / NULLIF(AVG(amount), 0)
  INTO avg_bet, bet_variance
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss', 'push')
    AND created_at > now() - INTERVAL '30 days';

  -- Calculate bet size after losses (chase multiplier)
  WITH loss_followed_by_bet AS (
    SELECT
      b1.amount as loss_amount,
      b2.amount as next_bet_amount
    FROM public.bets b1
    INNER JOIN public.bets b2 ON b2.user_id = b1.user_id AND b2.created_at > b1.created_at
    WHERE b1.user_id = p_user_id
      AND b1.outcome = 'loss'
      AND b2.created_at < b1.created_at + INTERVAL '1 day'
    ORDER BY b1.created_at DESC
    LIMIT 20
  )
  SELECT AVG(next_bet_amount / NULLIF(loss_amount, 0))
  INTO chase_multiplier
  FROM loss_followed_by_bet;

  -- Calculate tilt score (0-100)
  tilt_calc := LEAST(100, GREATEST(0, ROUND(
    (COALESCE(bet_variance, 0) * 30) +
    (COALESCE(chase_multiplier - 1.0, 0) * 50) +
    (CASE WHEN current_streak_type = 'loss' THEN current_streak_count * 5 ELSE 0 END)
  )));

  -- Upsert betting patterns
  INSERT INTO public.betting_patterns (
    user_id,
    total_bets,
    total_wins,
    total_losses,
    total_pushes,
    win_rate,
    roi,
    total_wagered,
    total_profit_loss,
    performance_by_league,
    performance_by_bet_type,
    performance_by_day,
    performance_by_team,
    performance_by_odds,
    current_win_streak,
    current_loss_streak,
    longest_win_streak,
    longest_loss_streak,
    avg_bet_size,
    recent_bet_size_variance,
    bet_size_after_loss_multiplier,
    tilt_score,
    last_calculated_at
  ) VALUES (
    p_user_id,
    total_bets_count,
    wins_count,
    losses_count,
    pushes_count,
    win_rate_calc,
    roi_calc,
    total_wagered_calc,
    total_profit_calc,
    COALESCE(league_performance, '{}'::jsonb),
    COALESCE(bet_type_performance, '{}'::jsonb),
    COALESCE(day_performance, '{}'::jsonb),
    COALESCE(team_performance, '{}'::jsonb),
    COALESCE(odds_performance, '{}'::jsonb),
    CASE WHEN current_streak_type = 'win' THEN current_streak_count ELSE 0 END,
    CASE WHEN current_streak_type = 'loss' THEN current_streak_count ELSE 0 END,
    COALESCE(longest_win_count, 0),
    COALESCE(longest_loss_count, 0),
    COALESCE(avg_bet, 0),
    COALESCE(bet_variance, 0),
    COALESCE(chase_multiplier, 1.0),
    tilt_calc,
    now()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    total_bets = EXCLUDED.total_bets,
    total_wins = EXCLUDED.total_wins,
    total_losses = EXCLUDED.total_losses,
    total_pushes = EXCLUDED.total_pushes,
    win_rate = EXCLUDED.win_rate,
    roi = EXCLUDED.roi,
    total_wagered = EXCLUDED.total_wagered,
    total_profit_loss = EXCLUDED.total_profit_loss,
    performance_by_league = EXCLUDED.performance_by_league,
    performance_by_bet_type = EXCLUDED.performance_by_bet_type,
    performance_by_day = EXCLUDED.performance_by_day,
    performance_by_team = EXCLUDED.performance_by_team,
    performance_by_odds = EXCLUDED.performance_by_odds,
    current_win_streak = EXCLUDED.current_win_streak,
    current_loss_streak = EXCLUDED.current_loss_streak,
    longest_win_streak = EXCLUDED.longest_win_streak,
    longest_loss_streak = EXCLUDED.longest_loss_streak,
    avg_bet_size = EXCLUDED.avg_bet_size,
    recent_bet_size_variance = EXCLUDED.recent_bet_size_variance,
    bet_size_after_loss_multiplier = EXCLUDED.bet_size_after_loss_multiplier,
    tilt_score = EXCLUDED.tilt_score,
    last_calculated_at = EXCLUDED.last_calculated_at;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'total_bets', total_bets_count,
    'win_rate', win_rate_calc,
    'roi', roi_calc,
    'tilt_score', tilt_calc,
    'current_streak', jsonb_build_object(
      'type', current_streak_type,
      'count', current_streak_count
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.betting_patterns TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_user_betting_patterns(UUID) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.betting_patterns IS
'Stores comprehensive betting pattern analysis for each user. Auto-calculated from bet history.';

COMMENT ON FUNCTION public.calculate_user_betting_patterns(UUID) IS
'Analyzes all bets for a user and calculates comprehensive performance patterns, streaks, and tilt indicators.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 3 Part 2: Betting Patterns Table Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Comprehensive performance analysis';
  RAISE NOTICE '  - Performance by league, bet type, day, team, odds';
  RAISE NOTICE '  - Win/loss streak tracking';
  RAISE NOTICE '  - Tilt detection and scoring';
  RAISE NOTICE '  - Bet sizing pattern analysis';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  SELECT calculate_user_betting_patterns(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
