-- Phase 7: Betting Playbooks and Bet Simulations
-- This migration creates tables for strategy playbooks and bet simulation functionality

-- =====================================================
-- TABLE: betting_playbooks
-- PURPOSE: Store user-defined betting strategies and playbooks
-- =====================================================

CREATE TABLE IF NOT EXISTS public.betting_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Playbook details
  name TEXT NOT NULL,
  description TEXT,
  created_by TEXT NOT NULL CHECK (created_by IN ('system', 'user', 'ai')),
  category TEXT CHECK (category IN ('value', 'underdog', 'favorite', 'total', 'live', 'custom', 'ai_recommended')),

  -- Strategy rules (JSONB for flexibility)
  rules JSONB NOT NULL DEFAULT '{}'::JSONB,
  /*
  Example rules structure:
  {
    "leagues": ["NBA", "NFL"],
    "betTypes": ["spread", "total"],
    "oddsRange": {"min": -150, "max": 150},
    "teams": ["Lakers", "Warriors"],
    "homeAway": "home",
    "customFilters": {}
  }
  */

  -- Bet sizing configuration
  bet_sizing JSONB NOT NULL DEFAULT '{}'::JSONB,
  /*
  Example bet_sizing structure:
  {
    "method": "kelly",  // "flat", "kelly", "percentage"
    "amount": 25,       // for flat betting
    "percentage": 2,    // for percentage betting
    "maxBet": 100,      // maximum bet limit
    "minBet": 10        // minimum bet limit
  }
  */

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_favorite BOOLEAN DEFAULT false,

  -- Performance tracking (updated by triggers)
  total_bets INTEGER DEFAULT 0,
  total_wins INTEGER DEFAULT 0,
  total_losses INTEGER DEFAULT 0,
  total_pushes INTEGER DEFAULT 0,
  win_rate NUMERIC DEFAULT 0,
  roi NUMERIC DEFAULT 0,
  total_profit_loss NUMERIC DEFAULT 0,
  avg_stake NUMERIC DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_bet_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_playbooks_user_active ON public.betting_playbooks(user_id, is_active);
CREATE INDEX idx_playbooks_user_category ON public.betting_playbooks(user_id, category);
CREATE INDEX idx_playbooks_performance ON public.betting_playbooks(user_id, roi DESC, total_bets DESC);

-- Enable RLS
ALTER TABLE public.betting_playbooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own playbooks"
  ON public.betting_playbooks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own playbooks"
  ON public.betting_playbooks FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- TABLE: bet_simulations
-- PURPOSE: Store bet simulation configurations and results
-- =====================================================

CREATE TABLE IF NOT EXISTS public.bet_simulations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Simulation configuration
  name TEXT NOT NULL,
  description TEXT,
  config JSONB NOT NULL,
  /*
  Example config structure:
  {
    "startBankroll": 1000,
    "betSizingStrategy": "kelly",
    "filters": {
      "leagues": ["NBA"],
      "betTypes": ["spread"],
      "oddsRange": [-110, -110],
      "dateRange": {
        "start": "2024-01-01",
        "end": "2024-12-31"
      }
    }
  }
  */

  -- Results (populated after simulation completes)
  results JSONB,
  /*
  Example results structure:
  {
    "totalBets": 100,
    "wins": 55,
    "losses": 45,
    "winRate": 55.0,
    "roi": 8.5,
    "finalBankroll": 1085,
    "profitLoss": 85,
    "maxDrawdown": -150,
    "sharpeRatio": 1.2,
    "confidence Interval": [1050, 1120]
  }
  */

  -- Performance metrics (denormalized for quick access)
  total_bets INTEGER,
  win_rate NUMERIC,
  roi NUMERIC,
  final_bankroll NUMERIC,
  profit_loss NUMERIC,
  max_drawdown NUMERIC,
  sharpe_ratio NUMERIC,

  -- Timeline data for charting
  timeline_data JSONB,
  /*
  Array of data points:
  [
    {"date": "2024-01-01", "bankroll": 1000, "profitLoss": 0},
    {"date": "2024-01-02", "bankroll": 1025, "profitLoss": 25},
    ...
  ]
  */

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_simulations_user_created ON public.bet_simulations(user_id, created_at DESC);
CREATE INDEX idx_simulations_user_status ON public.bet_simulations(user_id, status);

-- Enable RLS
ALTER TABLE public.bet_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own simulations"
  ON public.bet_simulations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own simulations"
  ON public.bet_simulations FOR ALL
  USING (auth.uid() = user_id);

-- =====================================================
-- FUNCTION: create_system_playbooks
-- PURPOSE: Create pre-built system playbooks for users
-- =====================================================

CREATE OR REPLACE FUNCTION public.create_system_playbooks(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_playbooks_created INTEGER := 0;
BEGIN
  -- 1. Value Hunter Playbook
  INSERT INTO public.betting_playbooks (
    user_id,
    name,
    description,
    created_by,
    category,
    rules,
    bet_sizing
  ) VALUES (
    p_user_id,
    'Value Hunter',
    'Focus on bets with positive closing line value (CLV). Only bet when you have an edge.',
    'system',
    'value',
    jsonb_build_object(
      'leagues', ARRAY['NBA', 'NFL', 'MLB', 'NHL'],
      'betTypes', ARRAY['spread', 'total', 'moneyline'],
      'customFilters', jsonb_build_object(
        'minCLV', 2.0,
        'requireCLV', true
      )
    ),
    jsonb_build_object(
      'method', 'kelly',
      'percentage', 2,
      'maxBet', 100,
      'minBet', 10
    )
  );

  -- 2. Underdog Specialist Playbook
  INSERT INTO public.betting_playbooks (
    user_id,
    name,
    description,
    created_by,
    category,
    rules,
    bet_sizing
  ) VALUES (
    p_user_id,
    'Underdog Specialist',
    'Bet on underdogs with spreads between +4.5 and +10. Home underdogs often provide value.',
    'system',
    'underdog',
    jsonb_build_object(
      'leagues', ARRAY['NBA', 'NFL'],
      'betTypes', ARRAY['spread'],
      'oddsRange', jsonb_build_object('min', -105, 'max', -115),
      'customFilters', jsonb_build_object(
        'spreadRange', jsonb_build_object('min', 4.5, 'max', 10),
        'preferHome', true
      )
    ),
    jsonb_build_object(
      'method', 'flat',
      'amount', 25,
      'maxBet', 50
    )
  );

  -- 3. Total Master Playbook
  INSERT INTO public.betting_playbooks (
    user_id,
    name,
    description,
    created_by,
    category,
    rules,
    bet_sizing
  ) VALUES (
    p_user_id,
    'Total Master',
    'Specialize in over/under bets. Avoid extremely high totals (over 55) due to variance.',
    'system',
    'total',
    jsonb_build_object(
      'leagues', ARRAY['NBA', 'NFL', 'NHL'],
      'betTypes', ARRAY['total'],
      'customFilters', jsonb_build_object(
        'maxTotal', 55,
        'minTotal', 35
      )
    ),
    jsonb_build_object(
      'method', 'percentage',
      'percentage', 2.5,
      'maxBet', 75,
      'minBet', 15
    )
  );

  -- 4. Live Bet Opportunist Playbook
  INSERT INTO public.betting_playbooks (
    user_id,
    name,
    description,
    created_by,
    category,
    rules,
    bet_sizing
  ) VALUES (
    p_user_id,
    'Live Bet Opportunist',
    'Focus on live betting opportunities during games. Wait for 2nd quarter NBA or 2nd half NFL.',
    'system',
    'live',
    jsonb_build_object(
      'leagues', ARRAY['NBA', 'NFL'],
      'betTypes', ARRAY['spread', 'total'],
      'customFilters', jsonb_build_object(
        'liveOnly', true,
        'minPeriod', 2
      )
    ),
    jsonb_build_object(
      'method', 'flat',
      'amount', 20,
      'maxBet', 40
    )
  );

  -- 5. Favorite Fade Playbook
  INSERT INTO public.betting_playbooks (
    user_id,
    name,
    description,
    created_by,
    category,
    rules,
    bet_sizing
  ) VALUES (
    p_user_id,
    'Favorite Fade',
    'Bet against heavy favorites (spreads > -10). Public often overvalues favorites.',
    'system',
    'custom',
    jsonb_build_object(
      'leagues', ARRAY['NBA', 'NFL', 'MLB'],
      'betTypes', ARRAY['spread'],
      'customFilters', jsonb_build_object(
        'spreadRange', jsonb_build_object('min', -20, 'max', -10),
        'betAgainstFavorite', true
      )
    ),
    jsonb_build_object(
      'method', 'percentage',
      'percentage', 1.5,
      'maxBet', 50,
      'minBet', 10
    )
  );

  v_playbooks_created := 5;
  RETURN v_playbooks_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: run_bet_simulation
-- PURPOSE: Run a bet simulation based on historical data
-- =====================================================

CREATE OR REPLACE FUNCTION public.run_bet_simulation(
  p_simulation_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_simulation RECORD;
  v_config JSONB;
  v_start_bankroll NUMERIC;
  v_current_bankroll NUMERIC;
  v_bet_sizing_method TEXT;
  v_filters JSONB;
  v_historical_bets RECORD;
  v_total_bets INTEGER := 0;
  v_total_wins INTEGER := 0;
  v_total_losses INTEGER := 0;
  v_total_pushes INTEGER := 0;
  v_total_wagered NUMERIC := 0;
  v_total_profit_loss NUMERIC := 0;
  v_max_bankroll NUMERIC;
  v_min_bankroll NUMERIC;
  v_max_drawdown NUMERIC;
  v_timeline JSONB := '[]'::JSONB;
  v_bet_size NUMERIC;
  v_result JSONB;
BEGIN
  -- Get simulation record
  SELECT * INTO v_simulation
  FROM public.bet_simulations
  WHERE id = p_simulation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Simulation not found';
  END IF;

  -- Update status to running
  UPDATE public.bet_simulations
  SET status = 'running'
  WHERE id = p_simulation_id;

  -- Extract config
  v_config := v_simulation.config;
  v_start_bankroll := (v_config->>'startBankroll')::NUMERIC;
  v_current_bankroll := v_start_bankroll;
  v_max_bankroll := v_start_bankroll;
  v_min_bankroll := v_start_bankroll;
  v_bet_sizing_method := v_config->>'betSizingStrategy';
  v_filters := v_config->'filters';

  -- Simulate bets based on historical data
  FOR v_historical_bets IN
    SELECT
      b.id,
      b.placed_at::DATE as bet_date,
      b.amount,
      b.odds,
      b.result,
      b.profit_loss
    FROM bets b
    WHERE b.user_id = v_simulation.user_id
      AND b.result IS NOT NULL
      AND (v_filters->'dateRange'->>'start')::DATE IS NULL
        OR b.placed_at >= (v_filters->'dateRange'->>'start')::DATE
      AND (v_filters->'dateRange'->>'end')::DATE IS NULL
        OR b.placed_at <= (v_filters->'dateRange'->>'end')::DATE
      -- Apply league filter if specified
      AND (v_filters->'leagues' IS NULL
        OR b.league = ANY(ARRAY(SELECT jsonb_array_elements_text(v_filters->'leagues'))))
      -- Apply bet type filter if specified
      AND (v_filters->'betTypes' IS NULL
        OR b.bet_type = ANY(ARRAY(SELECT jsonb_array_elements_text(v_filters->'betTypes'))))
    ORDER BY b.placed_at
  LOOP
    -- Calculate bet size based on strategy
    CASE v_bet_sizing_method
      WHEN 'flat' THEN
        v_bet_size := (v_config->'betSizing'->>'amount')::NUMERIC;
      WHEN 'percentage' THEN
        v_bet_size := v_current_bankroll * ((v_config->'betSizing'->>'percentage')::NUMERIC / 100);
      WHEN 'kelly' THEN
        -- Simplified Kelly (would need win rate and odds for true Kelly)
        v_bet_size := v_current_bankroll * 0.02; -- 2% default
      ELSE
        v_bet_size := 25; -- Default flat bet
    END CASE;

    -- Apply max/min bet limits if specified
    IF (v_config->'betSizing'->>'maxBet')::NUMERIC IS NOT NULL THEN
      v_bet_size := LEAST(v_bet_size, (v_config->'betSizing'->>'maxBet')::NUMERIC);
    END IF;
    IF (v_config->'betSizing'->>'minBet')::NUMERIC IS NOT NULL THEN
      v_bet_size := GREATEST(v_bet_size, (v_config->'betSizing'->>'minBet')::NUMERIC);
    END IF;

    -- Calculate profit/loss for this bet
    DECLARE
      v_bet_profit_loss NUMERIC;
    BEGIN
      CASE v_historical_bets.result
        WHEN 'won' THEN
          v_bet_profit_loss := v_bet_size * (ABS(v_historical_bets.odds - 100) / 100.0);
        WHEN 'lost' THEN
          v_bet_profit_loss := -v_bet_size;
        WHEN 'push' THEN
          v_bet_profit_loss := 0;
        ELSE
          v_bet_profit_loss := 0;
      END CASE;

      -- Update counters
      v_total_bets := v_total_bets + 1;
      v_total_wagered := v_total_wagered + v_bet_size;
      v_total_profit_loss := v_total_profit_loss + v_bet_profit_loss;
      v_current_bankroll := v_current_bankroll + v_bet_profit_loss;

      IF v_historical_bets.result = 'won' THEN
        v_total_wins := v_total_wins + 1;
      ELSIF v_historical_bets.result = 'lost' THEN
        v_total_losses := v_total_losses + 1;
      ELSIF v_historical_bets.result = 'push' THEN
        v_total_pushes := v_total_pushes + 1;
      END IF;

      -- Track max/min bankroll
      v_max_bankroll := GREATEST(v_max_bankroll, v_current_bankroll);
      v_min_bankroll := LEAST(v_min_bankroll, v_current_bankroll);

      -- Add to timeline
      v_timeline := v_timeline || jsonb_build_object(
        'date', v_historical_bets.bet_date,
        'bankroll', ROUND(v_current_bankroll, 2),
        'profitLoss', ROUND(v_bet_profit_loss, 2),
        'cumulativePL', ROUND(v_total_profit_loss, 2)
      );
    END;

    -- Check for bankruptcy
    IF v_current_bankroll <= 0 THEN
      EXIT;
    END IF;
  END LOOP;

  -- Calculate final metrics
  v_max_drawdown := v_max_bankroll - v_min_bankroll;

  v_result := jsonb_build_object(
    'totalBets', v_total_bets,
    'wins', v_total_wins,
    'losses', v_total_losses,
    'pushes', v_total_pushes,
    'winRate', CASE WHEN v_total_bets > 0 THEN ROUND((v_total_wins::NUMERIC / v_total_bets) * 100, 2) ELSE 0 END,
    'roi', CASE WHEN v_total_wagered > 0 THEN ROUND((v_total_profit_loss / v_total_wagered) * 100, 2) ELSE 0 END,
    'finalBankroll', ROUND(v_current_bankroll, 2),
    'profitLoss', ROUND(v_total_profit_loss, 2),
    'maxDrawdown', ROUND(v_max_drawdown, 2),
    'totalWagered', ROUND(v_total_wagered, 2),
    'avgBetSize', CASE WHEN v_total_bets > 0 THEN ROUND(v_total_wagered / v_total_bets, 2) ELSE 0 END
  );

  -- Update simulation record
  UPDATE public.bet_simulations
  SET
    status = 'completed',
    results = v_result,
    timeline_data = v_timeline,
    total_bets = v_total_bets,
    win_rate = (v_result->>'winRate')::NUMERIC,
    roi = (v_result->>'roi')::NUMERIC,
    final_bankroll = v_current_bankroll,
    profit_loss = v_total_profit_loss,
    max_drawdown = v_max_drawdown,
    completed_at = now()
  WHERE id = p_simulation_id;

  RETURN v_result;
EXCEPTION
  WHEN OTHERS THEN
    -- Update simulation with error
    UPDATE public.bet_simulations
    SET
      status = 'failed',
      error_message = SQLERRM
    WHERE id = p_simulation_id;

    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- FUNCTION: get_playbook_performance
-- PURPOSE: Get detailed performance stats for a playbook
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_playbook_performance(p_playbook_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'totalBets', total_bets,
    'wins', total_wins,
    'losses', total_losses,
    'pushes', total_pushes,
    'winRate', ROUND(win_rate, 2),
    'roi', ROUND(roi, 2),
    'profitLoss', ROUND(total_profit_loss, 2),
    'avgStake', ROUND(avg_stake, 2),
    'lastBetAt', last_bet_at,
    'isActive', is_active
  ) INTO v_result
  FROM public.betting_playbooks
  WHERE id = p_playbook_id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.create_system_playbooks TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_bet_simulation TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_playbook_performance TO authenticated;

COMMENT ON TABLE public.betting_playbooks IS 'Stores user-defined betting strategies and playbooks';
COMMENT ON TABLE public.bet_simulations IS 'Stores bet simulation configurations and results';
COMMENT ON FUNCTION public.create_system_playbooks IS 'Creates pre-built system playbooks for a user';
COMMENT ON FUNCTION public.run_bet_simulation IS 'Runs a bet simulation based on historical data';
COMMENT ON FUNCTION public.get_playbook_performance IS 'Gets detailed performance statistics for a playbook';
