-- Enable required extensions for automated fetching
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop existing live_score_cache table if it exists
DROP TABLE IF EXISTS public.live_score_cache CASCADE;

-- Create live_score_cache with correct schema
CREATE TABLE public.live_score_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL UNIQUE,
  league TEXT NOT NULL,
  sport TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER NOT NULL DEFAULT 0,
  away_score INTEGER NOT NULL DEFAULT 0,
  period TEXT,
  time_remaining TEXT,
  game_time TEXT,
  game_status TEXT NOT NULL,
  game_date TIMESTAMPTZ NOT NULL,
  api_last_updated TIMESTAMPTZ,
  api_response JSONB,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_live_score_cache_game_id ON public.live_score_cache(game_id);
CREATE INDEX idx_live_score_cache_game_status ON public.live_score_cache(game_status);
CREATE INDEX idx_live_score_cache_league ON public.live_score_cache(league);
CREATE INDEX idx_live_score_cache_last_updated ON public.live_score_cache(last_updated DESC);

-- Enable RLS
ALTER TABLE public.live_score_cache ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read live scores
CREATE POLICY "Anyone can view live scores"
  ON public.live_score_cache
  FOR SELECT
  USING (true);

-- Create function to manually trigger live scores update
CREATE OR REPLACE FUNCTION public.trigger_live_scores_update()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function can be called manually to trigger an immediate update
  -- The actual update will be done by calling the edge function
  RETURN 'Trigger function ready. Call monitor-live-bets edge function to update scores.';
END;
$$;