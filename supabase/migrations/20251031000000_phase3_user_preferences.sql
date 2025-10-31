-- Phase 3: User Preferences and Intelligence System
-- Part 1: User Preferences Table
-- Tracks user betting preferences, favorite teams, and settings

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Favorite teams (JSON array of team names)
  -- Example: ['Lakers', 'Cowboys', 'Yankees']
  favorite_teams JSONB DEFAULT '[]'::jsonb,

  -- Preferred leagues (JSON array: ['NBA', 'NFL', 'MLB', 'NHL'])
  preferred_leagues JSONB DEFAULT '[]'::jsonb,

  -- Betting style: 'conservative', 'moderate', 'aggressive'
  betting_style TEXT DEFAULT 'moderate' CHECK (betting_style IN ('conservative', 'moderate', 'aggressive')),

  -- Risk tolerance: 1-10 scale (1 = very conservative, 10 = very aggressive)
  risk_tolerance INTEGER DEFAULT 5 CHECK (risk_tolerance BETWEEN 1 AND 10),

  -- Preferred bet types (JSON array: ['moneyline', 'spread', 'totals', 'props', 'parlay'])
  preferred_bet_types JSONB DEFAULT '[]'::jsonb,

  -- User's stated betting goals (free text)
  betting_goals TEXT,

  -- User's concerns about betting (free text)
  betting_concerns TEXT,

  -- Feature toggles
  enable_tilt_warnings BOOLEAN DEFAULT true,
  enable_insights BOOLEAN DEFAULT true,
  enable_pattern_analysis BOOLEAN DEFAULT true,
  enable_daily_summaries BOOLEAN DEFAULT true,

  -- Notification preferences
  notify_on_tilt BOOLEAN DEFAULT true,
  notify_on_streak BOOLEAN DEFAULT true,
  notify_on_insights BOOLEAN DEFAULT true,

  -- Metadata
  auto_updated_at TIMESTAMPTZ DEFAULT now(),
  manually_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.user_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own preferences"
ON public.user_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for fast lookups
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);

-- Function to initialize default preferences for new users
CREATE OR REPLACE FUNCTION public.initialize_user_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create preferences when user signs up
CREATE TRIGGER create_user_preferences_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.initialize_user_preferences();

-- Function to auto-update favorite teams from bet history
CREATE OR REPLACE FUNCTION public.update_favorite_teams_from_bets()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  team_stats JSONB;
BEGIN
  -- For each user with bets
  FOR user_record IN
    SELECT DISTINCT user_id FROM public.bets
  LOOP
    -- Get top 5 teams by bet count
    SELECT jsonb_agg(team_bet_on ORDER BY bet_count DESC)
    INTO team_stats
    FROM (
      SELECT
        team_bet_on,
        COUNT(*) as bet_count
      FROM public.bets
      WHERE user_id = user_record.user_id
        AND team_bet_on IS NOT NULL
        AND team_bet_on != ''
      GROUP BY team_bet_on
      ORDER BY bet_count DESC
      LIMIT 5
    ) subquery;

    -- Update user preferences
    UPDATE public.user_preferences
    SET
      favorite_teams = COALESCE(team_stats, '[]'::jsonb),
      auto_updated_at = now()
    WHERE user_id = user_record.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to auto-update preferred leagues from bet history
CREATE OR REPLACE FUNCTION public.update_preferred_leagues_from_bets()
RETURNS void AS $$
DECLARE
  user_record RECORD;
  league_stats JSONB;
BEGIN
  FOR user_record IN
    SELECT DISTINCT user_id FROM public.bets
  LOOP
    -- Get leagues ordered by bet count
    SELECT jsonb_agg(league ORDER BY bet_count DESC)
    INTO league_stats
    FROM (
      SELECT
        COALESCE(b.league, 'Unknown') as league,
        COUNT(*) as bet_count
      FROM public.bets b
      WHERE b.user_id = user_record.user_id
      GROUP BY b.league
      HAVING COUNT(*) > 0
      ORDER BY bet_count DESC
    ) subquery;

    UPDATE public.user_preferences
    SET
      preferred_leagues = COALESCE(league_stats, '[]'::jsonb),
      auto_updated_at = now()
    WHERE user_id = user_record.user_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to detect betting style from bet sizing patterns
CREATE OR REPLACE FUNCTION public.detect_betting_style(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  avg_bet_size NUMERIC;
  unit_size NUMERIC;
  bet_size_ratio NUMERIC;
  style TEXT;
BEGIN
  -- Get user's unit size
  SELECT unit_size INTO unit_size
  FROM public.profiles
  WHERE id = p_user_id;

  -- Get average bet size
  SELECT AVG(amount) INTO avg_bet_size
  FROM public.bets
  WHERE user_id = p_user_id
    AND outcome IN ('win', 'loss', 'push')
    AND created_at > now() - INTERVAL '30 days';

  -- If no data, default to moderate
  IF avg_bet_size IS NULL OR unit_size IS NULL OR unit_size = 0 THEN
    RETURN 'moderate';
  END IF;

  -- Calculate ratio of average bet to unit size
  bet_size_ratio := avg_bet_size / unit_size;

  -- Classify betting style
  IF bet_size_ratio < 1.2 THEN
    style := 'conservative'; -- Betting below unit size
  ELSIF bet_size_ratio > 2.0 THEN
    style := 'aggressive'; -- Betting well above unit size
  ELSE
    style := 'moderate';
  END IF;

  -- Update user preferences
  UPDATE public.user_preferences
  SET
    betting_style = style,
    auto_updated_at = now()
  WHERE user_id = p_user_id;

  RETURN style;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT EXECUTE ON FUNCTION public.initialize_user_preferences() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_favorite_teams_from_bets() TO service_role;
GRANT EXECUTE ON FUNCTION public.update_preferred_leagues_from_bets() TO service_role;
GRANT EXECUTE ON FUNCTION public.detect_betting_style(UUID) TO authenticated, service_role;

-- Add helpful comments
COMMENT ON TABLE public.user_preferences IS
'Tracks user betting preferences, favorite teams, and personalization settings. Auto-updated from betting patterns.';

COMMENT ON FUNCTION public.update_favorite_teams_from_bets() IS
'Analyzes bet history to identify users favorite teams and updates preferences automatically.';

COMMENT ON FUNCTION public.detect_betting_style(UUID) IS
'Analyzes bet sizing patterns to classify user as conservative, moderate, or aggressive bettor.';

-- Initialize preferences for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users
  LOOP
    INSERT INTO public.user_preferences (user_id)
    VALUES (user_record.id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;

-- Log installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Phase 3 Part 1: User Preferences Table Created Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Features:';
  RAISE NOTICE '  - Tracks favorite teams and leagues';
  RAISE NOTICE '  - Detects betting style (conservative/moderate/aggressive)';
  RAISE NOTICE '  - Stores user goals and concerns';
  RAISE NOTICE '  - Auto-updates from betting patterns';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual Updates:';
  RAISE NOTICE '  - Favorite teams: SELECT update_favorite_teams_from_bets();';
  RAISE NOTICE '  - Preferred leagues: SELECT update_preferred_leagues_from_bets();';
  RAISE NOTICE '  - Betting style: SELECT detect_betting_style(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
