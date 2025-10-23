-- Migration: Game Dashboard Schema
-- Create and update tables for injury reports, weather data, and enhanced matchup analysis

-- Create injury_reports table if it doesn't exist
CREATE TABLE IF NOT EXISTS injury_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team TEXT NOT NULL,
  league TEXT NOT NULL,
  player_name TEXT NOT NULL,
  position TEXT,
  injury_status TEXT NOT NULL, -- 'Out', 'Doubtful', 'Questionable', 'Probable'
  injury_type TEXT, -- Description of injury
  impact_level TEXT, -- 'High', 'Medium', 'Low'
  report_date DATE NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint to prevent duplicate player entries
  UNIQUE(team, player_name)
);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_injury_reports_team ON injury_reports(team);
CREATE INDEX IF NOT EXISTS idx_injury_reports_league ON injury_reports(league);
CREATE INDEX IF NOT EXISTS idx_injury_reports_date ON injury_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_injury_reports_status ON injury_reports(injury_status);

-- Add weather_impact column to matchup_analysis if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matchup_analysis' AND column_name = 'weather_impact'
  ) THEN
    ALTER TABLE matchup_analysis ADD COLUMN weather_impact JSONB;
  END IF;
END $$;

-- Update matchup_analysis table to include additional fields
DO $$
BEGIN
  -- Add event_id if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matchup_analysis' AND column_name = 'event_id'
  ) THEN
    ALTER TABLE matchup_analysis ADD COLUMN event_id TEXT;
  END IF;

  -- Add last_updated if not exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'matchup_analysis' AND column_name = 'last_updated'
  ) THEN
    ALTER TABLE matchup_analysis ADD COLUMN last_updated TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Create index on event_id for matchup_analysis
CREATE INDEX IF NOT EXISTS idx_matchup_analysis_event ON matchup_analysis(event_id);

-- Create team_schedule_factors table if it doesn't exist
CREATE TABLE IF NOT EXISTS team_schedule_factors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team TEXT NOT NULL,
  league TEXT NOT NULL,
  game_date DATE NOT NULL,

  -- Schedule factors
  rest_days INTEGER,
  games_in_last_7_days INTEGER,
  games_in_next_7_days INTEGER,
  is_back_to_back BOOLEAN DEFAULT FALSE,
  travel_miles INTEGER,
  time_zones_crossed INTEGER,

  -- Home/Away streaks
  consecutive_home_games INTEGER,
  consecutive_away_games INTEGER,

  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(team, game_date)
);

-- Create indexes for team_schedule_factors
CREATE INDEX IF NOT EXISTS idx_schedule_factors_team ON team_schedule_factors(team);
CREATE INDEX IF NOT EXISTS idx_schedule_factors_date ON team_schedule_factors(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_factors_league ON team_schedule_factors(league);

-- Enable Row Level Security on new tables
ALTER TABLE injury_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_schedule_factors ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access on injury reports
CREATE POLICY IF NOT EXISTS "Allow public read on injury_reports"
  ON injury_reports FOR SELECT
  USING (true);

-- Create policies for public read access on team_schedule_factors
CREATE POLICY IF NOT EXISTS "Allow public read on team_schedule_factors"
  ON team_schedule_factors FOR SELECT
  USING (true);

-- Create policy for service role insert/update on injury_reports
CREATE POLICY IF NOT EXISTS "Allow service role to insert injury_reports"
  ON injury_reports FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow service role to update injury_reports"
  ON injury_reports FOR UPDATE
  USING (true);

-- Create policy for service role insert/update on team_schedule_factors
CREATE POLICY IF NOT EXISTS "Allow service role to insert team_schedule_factors"
  ON team_schedule_factors FOR INSERT
  WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Allow service role to update team_schedule_factors"
  ON team_schedule_factors FOR UPDATE
  USING (true);

-- Add helpful comments
COMMENT ON TABLE injury_reports IS 'Stores current injury reports for all teams across all sports';
COMMENT ON TABLE team_schedule_factors IS 'Stores schedule-related fatigue factors for teams';
COMMENT ON COLUMN injury_reports.impact_level IS 'Estimated impact of injury on team performance: High, Medium, or Low';
COMMENT ON COLUMN team_schedule_factors.rest_days IS 'Number of days since last game';
COMMENT ON COLUMN matchup_analysis.weather_impact IS 'Weather data for outdoor sports (temperature, wind, precipitation)';
