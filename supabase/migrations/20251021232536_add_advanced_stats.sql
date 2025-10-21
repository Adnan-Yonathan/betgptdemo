-- Add advanced_stats column to sports_scores table
-- This will store detailed game statistics from OpenAI analysis

-- Add the column as JSONB for flexible stat storage
ALTER TABLE public.sports_scores
ADD COLUMN IF NOT EXISTS advanced_stats JSONB;

-- Add a comment to explain the field
COMMENT ON COLUMN public.sports_scores.advanced_stats IS 'Advanced game statistics and analytics from OpenAI, stored as JSON';

-- Create an index on the JSONB column for better query performance
CREATE INDEX IF NOT EXISTS idx_sports_scores_advanced_stats ON public.sports_scores USING gin (advanced_stats);
