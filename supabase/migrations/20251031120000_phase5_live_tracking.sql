-- Phase 5: Live Bet Tracking & In-Game Alerts
-- Part 1: Live Bet Tracking System
-- Monitors active bets in real-time during games

CREATE TABLE IF NOT EXISTS public.live_bet_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL REFERENCES public.bets(id) ON DELETE CASCADE UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,

  -- Teams
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  league TEXT NOT NULL,

  -- Bet details (cached for quick access)
  bet_type TEXT, -- 'spread', 'total', 'moneyline'
  bet_line NUMERIC, -- Spread or total value
  bet_odds NUMERIC,
  bet_amount NUMERIC,
  bet_side TEXT, -- 'home', 'away', 'over', 'under'

  -- Current game state
  current_home_score INTEGER DEFAULT 0,
  current_away_score INTEGER DEFAULT 0,
  current_period TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'OT2', 'Final', 'Halftime'
  time_remaining TEXT, -- '5:24', '2:00', 'End of Period'
  game_status TEXT NOT NULL DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'halftime', 'final'

  -- Bet status analysis
  bet_status TEXT NOT NULL DEFAULT 'pending', -- 'winning', 'losing', 'push', 'uncertain', 'won', 'lost'
  points_needed_to_cover NUMERIC, -- For spreads (negative = currently covering)
  points_from_total NUMERIC, -- For totals (current total - line, positive = over)
  current_margin NUMERIC, -- Home - Away

  -- Win probability (requires Phase 4 integration)
  pre_game_win_prob NUMERIC,
  current_win_prob NUMERIC,
  win_prob_change NUMERIC, -- current - pre_game
  win_prob_history JSONB DEFAULT '[]', -- [{period: 'Q1', time: '7:24', prob: 0.62}, ...]

  -- Momentum tracking
  last_5min_home_points INTEGER DEFAULT 0,
  last_5min_away_points INTEGER DEFAULT 0,
  momentum_team TEXT, -- 'home', 'away', 'neutral'
  scoring_run TEXT, -- 'Lakers on 12-2 run', null if no significant run

  -- Alerts tracking
  alerts_sent JSONB DEFAULT '[]', -- ['game_starting', 'momentum_shift', 'critical_moment']
  last_alert_sent_at TIMESTAMPTZ,

  -- Hedge opportunity
  hedge_available BOOLEAN DEFAULT false,
  hedge_recommendation JSONB, -- {side: 'away', odds: +150, amount: 50, guaranteed_profit: 35}

  -- Status tracking
  is_active BOOLEAN DEFAULT true, -- false when game is final
  tracking_started_at TIMESTAMPTZ DEFAULT now(),
  tracking_ended_at TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.live_bet_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own live tracking"
ON public.live_bet_tracking
FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_live_tracking_user_id ON public.live_bet_tracking(user_id);
CREATE INDEX idx_live_tracking_bet_id ON public.live_bet_tracking(bet_id);
CREATE INDEX idx_live_tracking_game_id ON public.live_bet_tracking(game_id);
CREATE INDEX idx_live_tracking_active ON public.live_bet_tracking(is_active) WHERE is_active = true;
CREATE INDEX idx_live_tracking_status ON public.live_bet_tracking(game_status) WHERE game_status = 'in_progress';

-- Table for caching live scores
CREATE TABLE IF NOT EXISTS public.live_score_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL UNIQUE,
  league TEXT NOT NULL,

  -- Teams
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,

  -- Current score
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,

  -- Game state
  period TEXT, -- 'Q1', 'Q2', 'Q3', 'Q4', 'OT', 'Final', 'Halftime'
  time_remaining TEXT, -- '5:24' or 'End of Period'
  game_status TEXT NOT NULL, -- 'scheduled', 'in_progress', 'halftime', 'final'
  game_date TIMESTAMPTZ NOT NULL,

  -- Last scoring play
  last_score_team TEXT, -- 'home' or 'away'
  last_score_points INTEGER, -- 2 or 3
  last_score_time TEXT, -- '7:24 Q2'
  last_score_player TEXT,

  -- Momentum (last 5 minutes of game time)
  last_5min_home_points INTEGER DEFAULT 0,
  last_5min_away_points INTEGER DEFAULT 0,

  -- Quarter/period scores (for detailed analysis)
  period_scores JSONB DEFAULT '{}', -- {Q1: {home: 25, away: 22}, Q2: {...}}

  -- API data
  api_last_updated TIMESTAMPTZ,
  api_response JSONB, -- Raw response from The Rundown API

  -- Metadata
  last_updated TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS (public read for scores)
ALTER TABLE public.live_score_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view live scores"
ON public.live_score_cache
FOR SELECT
USING (true);

-- Create indexes
CREATE INDEX idx_live_scores_game_id ON public.live_score_cache(game_id);
CREATE INDEX idx_live_scores_status ON public.live_score_cache(game_status);
CREATE INDEX idx_live_scores_in_progress ON public.live_score_cache(game_status, game_date)
  WHERE game_status = 'in_progress';

-- Function to initialize live tracking for a bet
CREATE OR REPLACE FUNCTION public.start_live_tracking(p_bet_id UUID)
RETURNS UUID AS $$
DECLARE
  v_bet RECORD;
  v_tracking_id UUID;
  v_bet_type TEXT;
  v_bet_side TEXT;
BEGIN
  -- Get bet details
  SELECT
    b.*,
    COALESCE(b.market_key, 'h2h') as market_type
  INTO v_bet
  FROM public.bets b
  WHERE b.id = p_bet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found: %', p_bet_id;
  END IF;

  -- Determine bet type and side
  IF v_bet.market_type = 'spreads' THEN
    v_bet_type := 'spread';
    -- Determine if bet is on home or away team
    -- This would need more logic based on bet description
    v_bet_side := 'home'; -- Placeholder
  ELSIF v_bet.market_type = 'totals' THEN
    v_bet_type := 'total';
    -- Determine if over or under
    v_bet_side := CASE
      WHEN v_bet.description ILIKE '%over%' THEN 'over'
      ELSE 'under'
    END;
  ELSE
    v_bet_type := 'moneyline';
    v_bet_side := 'home'; -- Placeholder
  END IF;

  -- Insert or update tracking
  INSERT INTO public.live_bet_tracking (
    bet_id,
    user_id,
    game_id,
    home_team,
    away_team,
    league,
    bet_type,
    bet_line,
    bet_odds,
    bet_amount,
    bet_side,
    is_active
  ) VALUES (
    p_bet_id,
    v_bet.user_id,
    COALESCE(v_bet.game_id, 'unknown'),
    COALESCE(v_bet.team_bet_on, 'Home Team'), -- Needs improvement
    'Away Team', -- Needs improvement
    COALESCE(v_bet.league, 'NBA'),
    v_bet_type,
    v_bet.opening_line,
    v_bet.odds,
    v_bet.amount,
    v_bet_side,
    true
  )
  ON CONFLICT (bet_id)
  DO UPDATE SET
    is_active = true,
    last_updated = now()
  RETURNING id INTO v_tracking_id;

  RETURN v_tracking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update bet tracking from live scores
CREATE OR REPLACE FUNCTION public.update_bet_tracking_from_scores(p_bet_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tracking RECORD;
  v_score RECORD;
  v_new_status TEXT;
  v_points_needed NUMERIC;
  v_points_from_total NUMERIC;
  v_current_margin NUMERIC;
BEGIN
  -- Get tracking record
  SELECT * INTO v_tracking
  FROM public.live_bet_tracking
  WHERE bet_id = p_bet_id AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No active tracking found');
  END IF;

  -- Get current score
  SELECT * INTO v_score
  FROM public.live_score_cache
  WHERE game_id = v_tracking.game_id
  ORDER BY last_updated DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'No live score data');
  END IF;

  -- Calculate current margin
  v_current_margin := v_score.home_score - v_score.away_score;

  -- Determine bet status based on type
  IF v_tracking.bet_type = 'spread' THEN
    -- For spreads, check if covering
    IF v_tracking.bet_side = 'home' THEN
      v_points_needed := v_tracking.bet_line - v_current_margin;
      IF v_current_margin > v_tracking.bet_line THEN
        v_new_status := 'winning';
      ELSIF v_current_margin < v_tracking.bet_line THEN
        v_new_status := 'losing';
      ELSE
        v_new_status := 'push';
      END IF;
    ELSE -- away side
      v_points_needed := v_current_margin + v_tracking.bet_line;
      IF v_current_margin < -v_tracking.bet_line THEN
        v_new_status := 'winning';
      ELSIF v_current_margin > -v_tracking.bet_line THEN
        v_new_status := 'losing';
      ELSE
        v_new_status := 'push';
      END IF;
    END IF;

  ELSIF v_tracking.bet_type = 'total' THEN
    -- For totals, check if over/under
    DECLARE
      v_current_total NUMERIC;
    BEGIN
      v_current_total := v_score.home_score + v_score.away_score;
      v_points_from_total := v_current_total - v_tracking.bet_line;

      IF v_tracking.bet_side = 'over' THEN
        IF v_current_total > v_tracking.bet_line THEN
          v_new_status := 'winning';
        ELSIF v_current_total < v_tracking.bet_line THEN
          v_new_status := 'losing';
        ELSE
          v_new_status := 'push';
        END IF;
      ELSE -- under
        IF v_current_total < v_tracking.bet_line THEN
          v_new_status := 'winning';
        ELSIF v_current_total > v_tracking.bet_line THEN
          v_new_status := 'losing';
        ELSE
          v_new_status := 'push';
        END IF;
      END IF;
    END;

  ELSE -- moneyline
    IF v_tracking.bet_side = 'home' THEN
      IF v_current_margin > 0 THEN
        v_new_status := 'winning';
      ELSIF v_current_margin < 0 THEN
        v_new_status := 'losing';
      ELSE
        v_new_status := 'uncertain';
      END IF;
    ELSE
      IF v_current_margin < 0 THEN
        v_new_status := 'winning';
      ELSIF v_current_margin > 0 THEN
        v_new_status := 'losing';
      ELSE
        v_new_status := 'uncertain';
      END IF;
    END IF;
  END IF;

  -- Update tracking
  UPDATE public.live_bet_tracking
  SET
    current_home_score = v_score.home_score,
    current_away_score = v_score.away_score,
    current_period = v_score.period,
    time_remaining = v_score.time_remaining,
    game_status = v_score.game_status,
    bet_status = v_new_status,
    points_needed_to_cover = v_points_needed,
    points_from_total = v_points_from_total,
    current_margin = v_current_margin,
    last_5min_home_points = v_score.last_5min_home_points,
    last_5min_away_points = v_score.last_5min_away_points,
    last_updated = now()
  WHERE bet_id = p_bet_id;

  -- Mark as inactive if game is final
  IF v_score.game_status = 'final' THEN
    UPDATE public.live_bet_tracking
    SET is_active = false, tracking_ended_at = now()
    WHERE bet_id = p_bet_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'bet_id', p_bet_id,
    'bet_status', v_new_status,
    'current_score', v_score.home_score || '-' || v_score.away_score,
    'game_status', v_score.game_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get all active bets for a user with live status
CREATE OR REPLACE FUNCTION public.get_user_active_bets_live(p_user_id UUID)
RETURNS TABLE (
  bet_id UUID,
  game_id TEXT,
  home_team TEXT,
  away_team TEXT,
  bet_type TEXT,
  bet_amount NUMERIC,
  bet_status TEXT,
  current_score TEXT,
  time_remaining TEXT,
  points_needed NUMERIC,
  last_updated TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    lt.bet_id,
    lt.game_id,
    lt.home_team,
    lt.away_team,
    lt.bet_type,
    lt.bet_amount,
    lt.bet_status,
    lt.current_home_score || '-' || lt.current_away_score as current_score,
    lt.time_remaining,
    lt.points_needed_to_cover as points_needed,
    lt.last_updated
  FROM public.live_bet_tracking lt
  WHERE lt.user_id = p_user_id
    AND lt.is_active = true
  ORDER BY lt.game_status DESC, lt.last_updated DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.live_bet_tracking TO authenticated;
GRANT SELECT ON public.live_score_cache TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.start_live_tracking(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_bet_tracking_from_scores(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_active_bets_live(UUID) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.live_bet_tracking IS
'Tracks active bets in real-time during games. Updates every 60 seconds with current game state and bet status.';

COMMENT ON TABLE public.live_score_cache IS
'Caches live scores from The Rundown API. Updated every 60 seconds for games in progress.';

COMMENT ON FUNCTION public.start_live_tracking(UUID) IS
'Initializes live tracking for a pending bet. Call this when a bet is placed on an upcoming game.';

COMMENT ON FUNCTION public.update_bet_tracking_from_scores(UUID) IS
'Updates bet tracking based on current live scores. Determines if bet is winning, losing, or push.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 5 Part 1: Live Bet Tracking System Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Real-time bet status tracking (winning/losing/push)';
  RAISE NOTICE '  - Live score caching from The Rundown API';
  RAISE NOTICE '  - Momentum tracking (last 5 min scoring)';
  RAISE NOTICE '  - Points needed to cover calculation';
  RAISE NOTICE '  - Game state monitoring (period, time remaining)';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage:';
  RAISE NOTICE '  -- Start tracking a bet:';
  RAISE NOTICE '  SELECT start_live_tracking(bet_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Update bet from live scores:';
  RAISE NOTICE '  SELECT update_bet_tracking_from_scores(bet_id);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Get all active bets with live status:';
  RAISE NOTICE '  SELECT * FROM get_user_active_bets_live(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
