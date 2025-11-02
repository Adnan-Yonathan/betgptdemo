-- Add onboarding-related fields to profiles table
-- This supports the Delta Onboarding Sequence PRD

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS onboarding_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS league_preferences JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS bet_type_profile JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tilt_prevention BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS volatility_preference TEXT CHECK (volatility_preference IN ('steady', 'aggressive')) DEFAULT 'steady',
ADD COLUMN IF NOT EXISTS bet_frequency INTEGER DEFAULT 5;

-- Update initial_bankroll if it doesn't exist
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS initial_bankroll DECIMAL(10, 2);

-- Set initial_bankroll to current bankroll for existing users
UPDATE public.profiles
SET initial_bankroll = bankroll
WHERE initial_bankroll IS NULL;

-- Create an analytics table for tracking onboarding metrics
CREATE TABLE IF NOT EXISTS public.onboarding_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  step_name TEXT NOT NULL,
  entered_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  exited_at TIMESTAMP WITH TIME ZONE,
  completed BOOLEAN DEFAULT FALSE,
  skipped BOOLEAN DEFAULT FALSE,
  time_spent_seconds INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on onboarding_analytics
ALTER TABLE public.onboarding_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for onboarding_analytics
CREATE POLICY "Users can view their own onboarding analytics"
ON public.onboarding_analytics
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding analytics"
ON public.onboarding_analytics
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding analytics"
ON public.onboarding_analytics
FOR UPDATE
USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_user_id ON public.onboarding_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_analytics_step ON public.onboarding_analytics(step_number);
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON public.profiles(onboarding_completed);

-- Function to calculate onboarding completion rate
CREATE OR REPLACE FUNCTION public.get_onboarding_completion_rate()
RETURNS TABLE (
  total_users BIGINT,
  completed_users BIGINT,
  completion_rate NUMERIC,
  avg_completion_time_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as total_users,
    COUNT(*) FILTER (WHERE onboarding_completed = TRUE)::BIGINT as completed_users,
    ROUND(
      (COUNT(*) FILTER (WHERE onboarding_completed = TRUE)::NUMERIC /
       NULLIF(COUNT(*)::NUMERIC, 0) * 100), 2
    ) as completion_rate,
    ROUND(
      AVG(
        EXTRACT(EPOCH FROM (onboarding_completed_at - onboarding_started_at)) / 60
      ) FILTER (WHERE onboarding_completed = TRUE), 2
    ) as avg_completion_time_minutes
  FROM public.profiles
  WHERE onboarding_started_at IS NOT NULL;
END;
$$;

-- Function to get drop-off analysis by step
CREATE OR REPLACE FUNCTION public.get_onboarding_dropoff_by_step()
RETURNS TABLE (
  step_number INTEGER,
  step_name TEXT,
  users_reached BIGINT,
  users_completed BIGINT,
  users_skipped BIGINT,
  completion_rate NUMERIC,
  avg_time_seconds NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    oa.step_number,
    oa.step_name,
    COUNT(*)::BIGINT as users_reached,
    COUNT(*) FILTER (WHERE oa.completed = TRUE)::BIGINT as users_completed,
    COUNT(*) FILTER (WHERE oa.skipped = TRUE)::BIGINT as users_skipped,
    ROUND(
      (COUNT(*) FILTER (WHERE oa.completed = TRUE)::NUMERIC /
       NULLIF(COUNT(*)::NUMERIC, 0) * 100), 2
    ) as completion_rate,
    ROUND(AVG(oa.time_spent_seconds)::NUMERIC, 2) as avg_time_seconds
  FROM public.onboarding_analytics oa
  GROUP BY oa.step_number, oa.step_name
  ORDER BY oa.step_number;
END;
$$;

-- Comment on new columns
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Whether user has completed the onboarding flow';
COMMENT ON COLUMN public.profiles.onboarding_step IS 'Current step in the onboarding flow (0-9)';
COMMENT ON COLUMN public.profiles.league_preferences IS 'Array of preferred sports leagues (e.g., ["NBA", "NFL"])';
COMMENT ON COLUMN public.profiles.bet_type_profile IS 'Array of preferred bet types (e.g., ["Spreads", "Props"])';
COMMENT ON COLUMN public.profiles.tilt_prevention IS 'Whether user prefers tilt prevention features';
COMMENT ON COLUMN public.profiles.volatility_preference IS 'User preference for steady vs aggressive betting';
COMMENT ON COLUMN public.profiles.bet_frequency IS 'Average number of bets per day';
