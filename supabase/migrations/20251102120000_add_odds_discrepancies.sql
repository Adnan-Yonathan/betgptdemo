-- Create odds_discrepancies table to store pre-computed betting odds probability differences
-- This prevents token limit issues when generating large analyses in chat responses

CREATE TABLE IF NOT EXISTS public.odds_discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id TEXT NOT NULL,
    sport TEXT NOT NULL,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    game_time TIMESTAMPTZ,

    -- Market information
    market_key TEXT NOT NULL, -- 'h2h' (moneyline), 'spreads', 'totals'
    outcome_name TEXT NOT NULL, -- Team name, 'Over', 'Under'

    -- Discrepancy details
    bookmaker_low TEXT NOT NULL, -- Bookmaker with lowest implied probability
    odds_low DECIMAL NOT NULL,
    probability_low DECIMAL NOT NULL,
    point_low DECIMAL, -- For spreads/totals

    bookmaker_high TEXT NOT NULL, -- Bookmaker with highest implied probability
    odds_high DECIMAL NOT NULL,
    probability_high DECIMAL NOT NULL,
    point_high DECIMAL, -- For spreads/totals

    -- Calculated discrepancy
    probability_difference DECIMAL NOT NULL, -- High - Low
    percentage_difference DECIMAL NOT NULL, -- (Difference / Low) * 100

    -- Additional bookmakers for context
    num_bookmakers INTEGER NOT NULL,
    bookmakers_data JSONB, -- Store all bookmaker odds for reference

    -- Metadata
    data_freshness_minutes INTEGER, -- How old is the odds data
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),

    -- Composite unique constraint to prevent duplicates
    CONSTRAINT unique_discrepancy UNIQUE (event_id, market_key, outcome_name, calculated_at)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_odds_discrepancies_event ON public.odds_discrepancies(event_id);
CREATE INDEX IF NOT EXISTS idx_odds_discrepancies_sport ON public.odds_discrepancies(sport);
CREATE INDEX IF NOT EXISTS idx_odds_discrepancies_game_time ON public.odds_discrepancies(game_time);
CREATE INDEX IF NOT EXISTS idx_odds_discrepancies_probability_diff ON public.odds_discrepancies(probability_difference DESC);
CREATE INDEX IF NOT EXISTS idx_odds_discrepancies_calculated_at ON public.odds_discrepancies(calculated_at DESC);

-- Index for finding biggest discrepancies
CREATE INDEX IF NOT EXISTS idx_odds_discrepancies_biggest ON public.odds_discrepancies(
    sport,
    probability_difference DESC,
    calculated_at DESC
);

-- Enable Row Level Security
ALTER TABLE public.odds_discrepancies ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous and authenticated users to read discrepancies
CREATE POLICY "Allow public read access to odds discrepancies"
    ON public.odds_discrepancies
    FOR SELECT
    USING (true);

-- Policy: Only service role can insert/update discrepancies
CREATE POLICY "Only service role can modify odds discrepancies"
    ON public.odds_discrepancies
    FOR ALL
    USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public.odds_discrepancies IS 'Pre-computed betting odds probability differences across bookmakers to prevent token limit issues in chat responses';
