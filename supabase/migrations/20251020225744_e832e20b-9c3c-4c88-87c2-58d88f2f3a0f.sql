-- Create sports_scores table to store live game data
CREATE TABLE public.sports_scores (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL UNIQUE,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,
  game_status TEXT NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sports_scores ENABLE ROW LEVEL SECURITY;

-- Allow everyone to read scores (public data)
CREATE POLICY "Anyone can view sports scores"
ON public.sports_scores
FOR SELECT
USING (true);

-- Create index for faster queries
CREATE INDEX idx_sports_scores_league ON public.sports_scores(league);
CREATE INDEX idx_sports_scores_date ON public.sports_scores(game_date DESC);
CREATE INDEX idx_sports_scores_status ON public.sports_scores(game_status);