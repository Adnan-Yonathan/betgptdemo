-- Phase 4: Advanced Statistical Models & EV Analysis
-- Part 1: Expected Value (EV) Analysis System
-- Calculates and tracks EV, Kelly sizing, and CLV for every bet

CREATE TABLE IF NOT EXISTS public.bet_ev_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID REFERENCES public.bets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- EV Calculation
  estimated_win_prob NUMERIC CHECK (estimated_win_prob BETWEEN 0 AND 1), -- 0-1 (e.g., 0.58 = 58%)
  market_implied_prob NUMERIC CHECK (market_implied_prob BETWEEN 0 AND 1), -- From odds
  edge_percentage NUMERIC, -- (estimated - implied) * 100
  expected_value_dollars NUMERIC,
  expected_value_percentage NUMERIC,

  -- Confidence interval for win probability
  confidence_lower NUMERIC CHECK (confidence_lower BETWEEN 0 AND 1),
  confidence_upper NUMERIC CHECK (confidence_upper BETWEEN 0 AND 1),
  confidence_level NUMERIC DEFAULT 0.90, -- 90% confidence interval

  -- Kelly Criterion
  kelly_full_percentage NUMERIC, -- Full Kelly as % of bankroll
  kelly_half_percentage NUMERIC, -- Half Kelly
  kelly_quarter_percentage NUMERIC, -- Quarter Kelly (recommended)
  recommended_bet_size NUMERIC, -- In dollars (quarter Kelly)
  actual_bet_size NUMERIC, -- What user actually bet
  kelly_efficiency NUMERIC, -- actual / recommended (1.0 = perfect)

  -- Opening line (when bet was placed)
  opening_odds NUMERIC,
  opening_line_value NUMERIC, -- For spreads/totals

  -- Closing line (when game started)
  closing_odds NUMERIC,
  closing_line_value NUMERIC,

  -- Closing Line Value (CLV)
  clv_points NUMERIC, -- For spreads/totals (positive = beat the closing line)
  clv_cents NUMERIC, -- For moneyline (in cents)
  clv_dollars NUMERIC, -- Estimated dollar value of beating closing line
  beat_closing_line BOOLEAN, -- true if got better price than closing

  -- Actual outcome (filled after bet settles)
  actual_outcome TEXT CHECK (actual_outcome IN ('win', 'loss', 'push', NULL)),
  actual_profit_loss NUMERIC,
  ev_realization_error NUMERIC, -- (actual P/L) - (expected value)

  -- Model attribution
  model_used TEXT, -- 'elo', 'regression', 'ensemble', 'manual'
  model_confidence NUMERIC DEFAULT 0.5 CHECK (model_confidence BETWEEN 0 AND 1),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.bet_ev_analysis ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own EV analysis"
ON public.bet_ev_analysis
FOR SELECT
USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX idx_bet_ev_analysis_bet_id ON public.bet_ev_analysis(bet_id);
CREATE INDEX idx_bet_ev_analysis_user_id ON public.bet_ev_analysis(user_id);
CREATE INDEX idx_bet_ev_analysis_edge ON public.bet_ev_analysis(edge_percentage DESC);

-- Function to calculate implied probability from American odds
CREATE OR REPLACE FUNCTION public.calculate_implied_probability(american_odds NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF american_odds > 0 THEN
    -- Underdog odds (e.g., +150)
    RETURN 100.0 / (american_odds + 100);
  ELSIF american_odds < 0 THEN
    -- Favorite odds (e.g., -150)
    RETURN ABS(american_odds) / (ABS(american_odds) + 100);
  ELSE
    -- Even odds
    RETURN 0.5;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate decimal odds from American odds
CREATE OR REPLACE FUNCTION public.american_to_decimal_odds(american_odds NUMERIC)
RETURNS NUMERIC AS $$
BEGIN
  IF american_odds > 0 THEN
    RETURN (american_odds / 100.0) + 1;
  ELSIF american_odds < 0 THEN
    RETURN (100.0 / ABS(american_odds)) + 1;
  ELSE
    RETURN 2.0; -- Even odds
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate Expected Value
CREATE OR REPLACE FUNCTION public.calculate_expected_value(
  p_win_probability NUMERIC,
  p_american_odds NUMERIC,
  p_stake NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  decimal_odds NUMERIC;
  profit_if_win NUMERIC;
  loss_if_lose NUMERIC;
  expected_value NUMERIC;
  ev_percentage NUMERIC;
  market_implied_prob NUMERIC;
  edge NUMERIC;
BEGIN
  -- Convert to decimal odds
  decimal_odds := american_to_decimal_odds(p_american_odds);

  -- Calculate profit if win and loss if lose
  profit_if_win := p_stake * (decimal_odds - 1);
  loss_if_lose := p_stake;

  -- Calculate EV
  expected_value := (p_win_probability * profit_if_win) - ((1 - p_win_probability) * loss_if_lose);
  ev_percentage := (expected_value / p_stake) * 100;

  -- Calculate market implied probability
  market_implied_prob := calculate_implied_probability(p_american_odds);

  -- Calculate edge
  edge := (p_win_probability - market_implied_prob) * 100;

  RETURN jsonb_build_object(
    'expected_value_dollars', ROUND(expected_value, 2),
    'expected_value_percentage', ROUND(ev_percentage, 2),
    'profit_if_win', ROUND(profit_if_win, 2),
    'loss_if_lose', ROUND(loss_if_lose, 2),
    'market_implied_prob', ROUND(market_implied_prob, 4),
    'edge_percentage', ROUND(edge, 2),
    'decimal_odds', ROUND(decimal_odds, 3)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate Kelly Criterion bet sizing
CREATE OR REPLACE FUNCTION public.calculate_kelly_sizing(
  p_win_probability NUMERIC,
  p_american_odds NUMERIC,
  p_bankroll NUMERIC,
  p_fraction NUMERIC DEFAULT 0.25
)
RETURNS JSONB AS $$
DECLARE
  decimal_odds NUMERIC;
  edge NUMERIC;
  market_implied_prob NUMERIC;
  kelly_full NUMERIC;
  kelly_half NUMERIC;
  kelly_quarter NUMERIC;
  recommended_bet NUMERIC;
BEGIN
  -- Convert to decimal odds
  decimal_odds := american_to_decimal_odds(p_american_odds);

  -- Calculate market implied probability
  market_implied_prob := calculate_implied_probability(p_american_odds);

  -- Calculate edge
  edge := p_win_probability - market_implied_prob;

  -- Kelly formula: f = (bp - q) / b
  -- where b = decimal_odds - 1, p = win_prob, q = 1 - win_prob
  -- Simplified: f = (edge * decimal_odds) / (decimal_odds - 1)

  IF edge <= 0 THEN
    -- No edge or negative edge, don't bet
    kelly_full := 0;
  ELSE
    kelly_full := (edge * decimal_odds) / (decimal_odds - 1);

    -- Cap at 20% for safety (even full Kelly)
    kelly_full := LEAST(kelly_full, 0.20);
  END IF;

  -- Calculate fractional Kelly
  kelly_half := kelly_full * 0.5;
  kelly_quarter := kelly_full * 0.25;

  -- Recommended bet (using specified fraction)
  recommended_bet := p_bankroll * (kelly_full * p_fraction);

  -- Cap recommended bet at 5% of bankroll for safety
  recommended_bet := LEAST(recommended_bet, p_bankroll * 0.05);

  RETURN jsonb_build_object(
    'kelly_full_percentage', ROUND(kelly_full * 100, 2),
    'kelly_half_percentage', ROUND(kelly_half * 100, 2),
    'kelly_quarter_percentage', ROUND(kelly_quarter * 100, 2),
    'recommended_bet_dollars', ROUND(recommended_bet, 2),
    'fraction_used', p_fraction
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to analyze a bet and store EV analysis
CREATE OR REPLACE FUNCTION public.analyze_bet_ev(
  p_bet_id UUID,
  p_win_probability NUMERIC,
  p_confidence_lower NUMERIC DEFAULT NULL,
  p_confidence_upper NUMERIC DEFAULT NULL,
  p_model_used TEXT DEFAULT 'manual'
)
RETURNS UUID AS $$
DECLARE
  v_bet RECORD;
  v_user_bankroll NUMERIC;
  v_ev_result JSONB;
  v_kelly_result JSONB;
  v_analysis_id UUID;
BEGIN
  -- Get bet details
  SELECT * INTO v_bet
  FROM public.bets
  WHERE id = p_bet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bet not found: %', p_bet_id;
  END IF;

  -- Get user's bankroll
  SELECT bankroll INTO v_user_bankroll
  FROM public.profiles
  WHERE id = v_bet.user_id;

  -- Default bankroll if not set
  v_user_bankroll := COALESCE(v_user_bankroll, 1000);

  -- Calculate EV
  v_ev_result := calculate_expected_value(p_win_probability, v_bet.odds, v_bet.amount);

  -- Calculate Kelly sizing
  v_kelly_result := calculate_kelly_sizing(p_win_probability, v_bet.odds, v_user_bankroll, 0.25);

  -- Insert or update EV analysis
  INSERT INTO public.bet_ev_analysis (
    bet_id,
    user_id,
    estimated_win_prob,
    market_implied_prob,
    edge_percentage,
    expected_value_dollars,
    expected_value_percentage,
    confidence_lower,
    confidence_upper,
    kelly_full_percentage,
    kelly_half_percentage,
    kelly_quarter_percentage,
    recommended_bet_size,
    actual_bet_size,
    kelly_efficiency,
    opening_odds,
    model_used,
    model_confidence
  ) VALUES (
    p_bet_id,
    v_bet.user_id,
    p_win_probability,
    (v_ev_result->>'market_implied_prob')::NUMERIC,
    (v_ev_result->>'edge_percentage')::NUMERIC,
    (v_ev_result->>'expected_value_dollars')::NUMERIC,
    (v_ev_result->>'expected_value_percentage')::NUMERIC,
    p_confidence_lower,
    p_confidence_upper,
    (v_kelly_result->>'kelly_full_percentage')::NUMERIC,
    (v_kelly_result->>'kelly_half_percentage')::NUMERIC,
    (v_kelly_result->>'kelly_quarter_percentage')::NUMERIC,
    (v_kelly_result->>'recommended_bet_dollars')::NUMERIC,
    v_bet.amount,
    CASE
      WHEN (v_kelly_result->>'recommended_bet_dollars')::NUMERIC > 0
      THEN v_bet.amount / (v_kelly_result->>'recommended_bet_dollars')::NUMERIC
      ELSE NULL
    END,
    v_bet.odds,
    p_model_used,
    CASE
      WHEN p_confidence_lower IS NOT NULL AND p_confidence_upper IS NOT NULL
      THEN 1.0 - (p_confidence_upper - p_confidence_lower) / 2.0
      ELSE 0.5
    END
  )
  ON CONFLICT (bet_id)
  DO UPDATE SET
    estimated_win_prob = EXCLUDED.estimated_win_prob,
    market_implied_prob = EXCLUDED.market_implied_prob,
    edge_percentage = EXCLUDED.edge_percentage,
    expected_value_dollars = EXCLUDED.expected_value_dollars,
    expected_value_percentage = EXCLUDED.expected_value_percentage,
    confidence_lower = EXCLUDED.confidence_lower,
    confidence_upper = EXCLUDED.confidence_upper,
    kelly_full_percentage = EXCLUDED.kelly_full_percentage,
    kelly_half_percentage = EXCLUDED.kelly_half_percentage,
    kelly_quarter_percentage = EXCLUDED.kelly_quarter_percentage,
    recommended_bet_size = EXCLUDED.recommended_bet_size,
    model_used = EXCLUDED.model_used,
    model_confidence = EXCLUDED.model_confidence,
    updated_at = now()
  RETURNING id INTO v_analysis_id;

  RETURN v_analysis_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT SELECT ON public.bet_ev_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_implied_probability(NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.american_to_decimal_odds(NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_expected_value(NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_kelly_sizing(NUMERIC, NUMERIC, NUMERIC, NUMERIC) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.analyze_bet_ev(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated, service_role;

-- Add comments
COMMENT ON TABLE public.bet_ev_analysis IS
'Stores Expected Value (EV) analysis for every bet including Kelly sizing, CLV tracking, and model predictions.';

COMMENT ON FUNCTION public.calculate_expected_value(NUMERIC, NUMERIC, NUMERIC) IS
'Calculates Expected Value given win probability, American odds, and stake. Returns EV in dollars and percentage, plus market implied probability and edge.';

COMMENT ON FUNCTION public.calculate_kelly_sizing(NUMERIC, NUMERIC, NUMERIC, NUMERIC) IS
'Calculates optimal bet size using Kelly Criterion. Returns full/half/quarter Kelly percentages and recommended bet in dollars.';

COMMENT ON FUNCTION public.analyze_bet_ev(UUID, NUMERIC, NUMERIC, NUMERIC, TEXT) IS
'Analyzes a bet and stores complete EV analysis including Kelly sizing. Call this after placing a bet.';

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 4 Part 1: EV Analysis System Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Expected Value (EV) calculation';
  RAISE NOTICE '  - Kelly Criterion bet sizing (full/half/quarter)';
  RAISE NOTICE '  - Market implied probability calculation';
  RAISE NOTICE '  - Edge detection and quantification';
  RAISE NOTICE '  - Confidence intervals for predictions';
  RAISE NOTICE '  - CLV (Closing Line Value) tracking framework';
  RAISE NOTICE '';
  RAISE NOTICE 'Usage Examples:';
  RAISE NOTICE '  -- Calculate EV for a $100 bet at -110 with 58% win probability:';
  RAISE NOTICE '  SELECT calculate_expected_value(0.58, -110, 100);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Calculate Kelly sizing for same bet with $5000 bankroll:';
  RAISE NOTICE '  SELECT calculate_kelly_sizing(0.58, -110, 5000, 0.25);';
  RAISE NOTICE '';
  RAISE NOTICE '  -- Analyze a bet:';
  RAISE NOTICE '  SELECT analyze_bet_ev(bet_id, 0.58, 0.54, 0.62, ''elo'');';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
