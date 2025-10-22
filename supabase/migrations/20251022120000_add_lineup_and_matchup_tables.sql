-- ============================================================================
-- LINEUP AND MATCHUP INFORMATION MIGRATION
-- ============================================================================
-- This migration adds support for:
-- 1. Starting lineup tracking for all sports
-- 2. Matchup information and player vs player analysis
-- 3. Injury reports and team news
-- 4. Historical matchup performance
-- ============================================================================

-- ============================================================================
-- 1. STARTING LINEUPS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.starting_lineups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  team TEXT NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Lineup data
  starters JSONB, -- Array of player objects with positions
  bench JSONB, -- Array of bench players
  injured JSONB, -- Array of injured players
  scratches JSONB, -- Array of scratched/inactive players

  -- Lineup metadata
  formation TEXT, -- e.g., "4-3-3" for soccer, "3-4" for NFL defense
  lineup_quality_score NUMERIC, -- 0-100 rating based on player quality
  key_absences TEXT[], -- Array of notable missing players
  lineup_changes_from_previous TEXT[], -- Changes from last game

  -- Scraping metadata
  source_url TEXT,
  data_quality TEXT DEFAULT 'verified', -- 'verified', 'projected', 'unofficial'
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(event_id, team),
  CONSTRAINT valid_data_quality CHECK (data_quality IN ('verified', 'projected', 'unofficial', 'estimated'))
);

-- Enable RLS
ALTER TABLE public.starting_lineups ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view starting lineups"
  ON public.starting_lineups FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_lineups_event_id ON public.starting_lineups(event_id);
CREATE INDEX IF NOT EXISTS idx_lineups_team ON public.starting_lineups(team);
CREATE INDEX IF NOT EXISTS idx_lineups_sport_league ON public.starting_lineups(sport, league);
CREATE INDEX IF NOT EXISTS idx_lineups_game_date ON public.starting_lineups(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_lineups_starters ON public.starting_lineups USING gin (starters);

COMMENT ON TABLE public.starting_lineups IS 'Starting lineups for all sports with injury reports and lineup analysis';
COMMENT ON COLUMN public.starting_lineups.starters IS 'Array of starting players with position, number, stats';
COMMENT ON COLUMN public.starting_lineups.lineup_quality_score IS 'AI-calculated score (0-100) based on player performance and availability';

-- ============================================================================
-- 2. MATCHUP ANALYSIS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.matchup_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT NOT NULL,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Head-to-head data
  h2h_history JSONB, -- Recent matchup results
  home_team_recent_form JSONB, -- Last 5-10 games
  away_team_recent_form JSONB, -- Last 5-10 games

  -- Key matchup factors
  key_player_matchups JSONB, -- Specific player vs player advantages
  coaching_matchup JSONB, -- Head coach stats/history
  tactical_analysis TEXT, -- AI-generated tactical preview

  -- Statistical edges
  statistical_edges JSONB, -- {
    -- "home_offensive_rating": 115.2,
    -- "away_defensive_rating": 108.5,
    -- "pace_advantage": "home",
    -- "turnover_battle": "away"
  -- }

  -- Trends and patterns
  betting_trends JSONB, -- Public vs sharp betting patterns
  situational_trends TEXT[], -- e.g., ["Home team 8-2 ATS after loss"]
  weather_impact TEXT, -- For outdoor sports
  venue_advantages TEXT[], -- Home court/field specific factors

  -- AI predictions
  ai_prediction JSONB, -- {
    -- "predicted_winner": "home",
    -- "confidence": 72,
    -- "key_factors": ["Home team rest advantage", "Matchup edge at QB"]
  -- }

  -- Meta information
  source_urls TEXT[], -- Multiple sources for data
  data_quality TEXT DEFAULT 'comprehensive',
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Constraints
  UNIQUE(event_id),
  CONSTRAINT valid_matchup_quality CHECK (data_quality IN ('comprehensive', 'partial', 'basic', 'estimated'))
);

-- Enable RLS
ALTER TABLE public.matchup_analysis ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view matchup analysis"
  ON public.matchup_analysis FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_matchup_event_id ON public.matchup_analysis(event_id);
CREATE INDEX IF NOT EXISTS idx_matchup_teams ON public.matchup_analysis(home_team, away_team);
CREATE INDEX IF NOT EXISTS idx_matchup_sport_league ON public.matchup_analysis(sport, league);
CREATE INDEX IF NOT EXISTS idx_matchup_game_date ON public.matchup_analysis(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_matchup_h2h ON public.matchup_analysis USING gin (h2h_history);

COMMENT ON TABLE public.matchup_analysis IS 'Comprehensive matchup information including H2H, trends, and tactical analysis';
COMMENT ON COLUMN public.matchup_analysis.key_player_matchups IS 'Critical individual matchups (e.g., WR vs CB, PG vs PG)';
COMMENT ON COLUMN public.matchup_analysis.statistical_edges IS 'Team stat advantages and mismatches';

-- ============================================================================
-- 3. INJURY REPORTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.injury_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id TEXT,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  team TEXT NOT NULL,

  -- Player information
  player_name TEXT NOT NULL,
  position TEXT,
  jersey_number TEXT,

  -- Injury details
  injury_status TEXT NOT NULL, -- 'Out', 'Doubtful', 'Questionable', 'Probable', 'GTD'
  injury_type TEXT, -- 'Knee', 'Ankle', 'Concussion', etc.
  injury_description TEXT,

  -- Timeline
  injury_date DATE,
  expected_return DATE,
  games_missed INTEGER DEFAULT 0,

  -- Impact assessment
  impact_level TEXT, -- 'High', 'Medium', 'Low'
  player_importance_score NUMERIC, -- 0-100
  replacement_quality_dropoff NUMERIC, -- Percentage dropoff

  -- Meta
  official_report BOOLEAN DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_injury_status CHECK (injury_status IN ('Out', 'Doubtful', 'Questionable', 'Probable', 'GTD', 'Day-to-Day', 'IR', 'Healthy')),
  CONSTRAINT valid_impact_level CHECK (impact_level IN ('Critical', 'High', 'Medium', 'Low', 'Minimal', NULL))
);

-- Enable RLS
ALTER TABLE public.injury_reports ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view injury reports"
  ON public.injury_reports FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_injury_event_id ON public.injury_reports(event_id);
CREATE INDEX IF NOT EXISTS idx_injury_team ON public.injury_reports(team);
CREATE INDEX IF NOT EXISTS idx_injury_player ON public.injury_reports(player_name);
CREATE INDEX IF NOT EXISTS idx_injury_status ON public.injury_reports(injury_status);
CREATE INDEX IF NOT EXISTS idx_injury_impact ON public.injury_reports(impact_level);
CREATE INDEX IF NOT EXISTS idx_injury_sport_league ON public.injury_reports(sport, league);

COMMENT ON TABLE public.injury_reports IS 'Real-time injury reports and impact analysis for betting decisions';
COMMENT ON COLUMN public.injury_reports.player_importance_score IS 'Calculated importance (0-100) based on role and performance';
COMMENT ON COLUMN public.injury_reports.replacement_quality_dropoff IS 'Quality decrease percentage when backup replaces starter';

-- ============================================================================
-- 4. TEAM NEWS AND UPDATES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.team_news (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  team TEXT NOT NULL,
  event_id TEXT, -- Optional: link to specific game

  -- News content
  headline TEXT NOT NULL,
  summary TEXT,
  full_content TEXT,
  news_type TEXT, -- 'injury', 'trade', 'suspension', 'coaching', 'lineup', 'other'

  -- Impact assessment
  betting_impact TEXT, -- 'line_moving', 'significant', 'minor', 'none'
  affected_players TEXT[], -- Players mentioned/affected
  sentiment TEXT, -- 'positive', 'negative', 'neutral'

  -- Source information
  source_name TEXT,
  source_url TEXT,
  credibility_score NUMERIC, -- 0-100

  -- Timestamps
  published_at TIMESTAMP WITH TIME ZONE,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT valid_news_type CHECK (news_type IN ('injury', 'trade', 'suspension', 'coaching', 'lineup', 'weather', 'roster', 'other')),
  CONSTRAINT valid_betting_impact CHECK (betting_impact IN ('line_moving', 'significant', 'minor', 'none', NULL)),
  CONSTRAINT valid_sentiment CHECK (sentiment IN ('positive', 'negative', 'neutral', NULL))
);

-- Enable RLS
ALTER TABLE public.team_news ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view team news"
  ON public.team_news FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_news_team ON public.team_news(team);
CREATE INDEX IF NOT EXISTS idx_team_news_event_id ON public.team_news(event_id);
CREATE INDEX IF NOT EXISTS idx_team_news_type ON public.team_news(news_type);
CREATE INDEX IF NOT EXISTS idx_team_news_impact ON public.team_news(betting_impact);
CREATE INDEX IF NOT EXISTS idx_team_news_published ON public.team_news(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_news_sport_league ON public.team_news(sport, league);

COMMENT ON TABLE public.team_news IS 'Scraped team news and updates with betting impact assessment';
COMMENT ON COLUMN public.team_news.betting_impact IS 'How much this news might affect betting lines';

-- ============================================================================
-- 5. HISTORICAL MATCHUP STATS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.historical_matchups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  team_1 TEXT NOT NULL,
  team_2 TEXT NOT NULL,

  -- Historical data
  total_games INTEGER DEFAULT 0,
  team_1_wins INTEGER DEFAULT 0,
  team_2_wins INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,

  -- Recent form (last 5 meetings)
  last_5_results JSONB, -- Array of game results

  -- ATS (Against the Spread) data
  team_1_ats_record TEXT, -- e.g., "7-3"
  team_2_ats_record TEXT,

  -- Over/Under trends
  over_under_record TEXT, -- e.g., "6-4 O"
  avg_total_points NUMERIC,

  -- Home/Away splits in matchup
  team_1_home_record TEXT,
  team_2_home_record TEXT,

  -- Last updated
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Ensure team order consistency (team_1 alphabetically before team_2)
  UNIQUE(sport, league, team_1, team_2),
  CONSTRAINT team_order CHECK (team_1 < team_2)
);

-- Enable RLS
ALTER TABLE public.historical_matchups ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view historical matchups"
  ON public.historical_matchups FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_historical_teams ON public.historical_matchups(team_1, team_2);
CREATE INDEX IF NOT EXISTS idx_historical_sport_league ON public.historical_matchups(sport, league);

COMMENT ON TABLE public.historical_matchups IS 'Historical head-to-head records and betting trends between teams';

-- ============================================================================
-- 6. PLAYER PERFORMANCE VS OPPONENT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.player_vs_opponent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  player_name TEXT NOT NULL,
  player_team TEXT NOT NULL,
  opponent_team TEXT NOT NULL,

  -- Career stats vs this opponent
  games_played INTEGER DEFAULT 0,
  avg_points NUMERIC,
  avg_rebounds NUMERIC, -- Basketball
  avg_assists NUMERIC, -- Basketball
  avg_yards NUMERIC, -- Football
  touchdowns INTEGER, -- Football
  avg_hits NUMERIC, -- Baseball
  home_runs INTEGER, -- Baseball
  goals INTEGER, -- Hockey/Soccer
  custom_stats JSONB, -- Sport-specific stats

  -- Performance metrics
  performance_rating NUMERIC, -- 0-100
  vs_opponent_advantage TEXT, -- 'favorable', 'neutral', 'unfavorable'

  -- Last updated
  last_game_date DATE,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  UNIQUE(player_name, player_team, opponent_team, sport, league)
);

-- Enable RLS
ALTER TABLE public.player_vs_opponent ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Anyone can view player vs opponent stats"
  ON public.player_vs_opponent FOR SELECT
  USING (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_player_vs_opponent_player ON public.player_vs_opponent(player_name);
CREATE INDEX IF NOT EXISTS idx_player_vs_opponent_team ON public.player_vs_opponent(player_team, opponent_team);
CREATE INDEX IF NOT EXISTS idx_player_vs_opponent_sport ON public.player_vs_opponent(sport, league);

COMMENT ON TABLE public.player_vs_opponent IS 'Individual player performance history against specific opponents';

-- ============================================================================
-- 7. FUNCTIONS FOR LINEUP ANALYSIS
-- ============================================================================

-- Function to calculate lineup quality score
CREATE OR REPLACE FUNCTION calculate_lineup_quality(
  starters_json JSONB,
  injured_json JSONB,
  sport TEXT
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  base_score NUMERIC := 100;
  injury_penalty NUMERIC := 0;
  starter_count INTEGER;
BEGIN
  -- Count starters
  starter_count := jsonb_array_length(starters_json);

  -- Penalty for missing starters (sport-specific)
  CASE sport
    WHEN 'basketball' THEN
      IF starter_count < 5 THEN
        base_score := base_score - (5 - starter_count) * 15;
      END IF;
    WHEN 'football' THEN
      IF starter_count < 11 THEN
        base_score := base_score - (11 - starter_count) * 8;
      END IF;
    WHEN 'baseball' THEN
      IF starter_count < 9 THEN
        base_score := base_score - (9 - starter_count) * 10;
      END IF;
    WHEN 'hockey' THEN
      IF starter_count < 6 THEN
        base_score := base_score - (6 - starter_count) * 12;
      END IF;
  END CASE;

  -- Count critical injuries
  IF injured_json IS NOT NULL THEN
    injury_penalty := jsonb_array_length(injured_json) * 5;
  END IF;

  base_score := base_score - injury_penalty;

  -- Ensure score stays within 0-100
  IF base_score < 0 THEN
    base_score := 0;
  END IF;

  RETURN ROUND(base_score, 1);
END;
$$;

COMMENT ON FUNCTION calculate_lineup_quality IS 'Calculate lineup strength score (0-100) based on starters and injuries';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
