-- Create table for storing live betting odds
CREATE TABLE IF NOT EXISTS public.betting_odds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport_key TEXT NOT NULL,
  sport_title TEXT NOT NULL,
  commence_time TIMESTAMP WITH TIME ZONE NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  bookmaker TEXT NOT NULL,
  market_key TEXT NOT NULL,
  outcome_name TEXT NOT NULL,
  outcome_price NUMERIC NOT NULL,
  outcome_point NUMERIC,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.betting_odds ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access
CREATE POLICY "Anyone can view betting odds" 
ON public.betting_odds 
FOR SELECT 
USING (true);

-- Create indexes for efficient queries
CREATE INDEX idx_betting_odds_event_id ON public.betting_odds(event_id);
CREATE INDEX idx_betting_odds_sport_key ON public.betting_odds(sport_key);
CREATE INDEX idx_betting_odds_commence_time ON public.betting_odds(commence_time);
CREATE INDEX idx_betting_odds_teams ON public.betting_odds(home_team, away_team);

-- Create unique constraint to prevent duplicate odds entries
CREATE UNIQUE INDEX idx_betting_odds_unique ON public.betting_odds(event_id, bookmaker, market_key, outcome_name);