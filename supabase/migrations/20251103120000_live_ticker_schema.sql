-- Live Ticker Database Schema
-- This migration creates a comprehensive schema for displaying live scores in a ticker format
-- Includes ticker games, key events, user preferences, and optimized views

-- ============================================================================
-- Table: live_ticker_games
-- Purpose: Enhanced live game data specifically optimized for ticker display
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_ticker_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT UNIQUE NOT NULL,
  league TEXT NOT NULL,
  sport TEXT NOT NULL,

  -- Team Information
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  home_team_abbreviation TEXT,
  away_team_abbreviation TEXT,
  home_team_logo_url TEXT,
  away_team_logo_url TEXT,

  -- Score Information
  home_score INTEGER DEFAULT 0,
  away_score INTEGER DEFAULT 0,

  -- Game Status
  game_status TEXT NOT NULL DEFAULT 'scheduled', -- scheduled, pre_game, in_progress, halftime, final, postponed, cancelled
  period TEXT, -- Q1, Q2, Q3, Q4, OT, Final, 1st, 2nd, 3rd, etc.
  period_number INTEGER, -- Numeric representation for sorting
  time_remaining TEXT, -- "12:34", "End of 1st", etc.
  game_clock_seconds INTEGER, -- Remaining seconds for calculations

  -- Timing
  scheduled_start_time TIMESTAMPTZ NOT NULL,
  actual_start_time TIMESTAMPTZ,
  last_updated TIMESTAMPTZ DEFAULT now(),

  -- Ticker Display Priority
  ticker_priority INTEGER DEFAULT 50, -- Higher = more important (0-100)
  is_featured BOOLEAN DEFAULT FALSE, -- Featured games get highlighted
  is_close_game BOOLEAN DEFAULT FALSE, -- Auto-calculated for close games
  is_trending BOOLEAN DEFAULT FALSE, -- High action/interest

  -- Game Context
  venue TEXT,
  broadcast_network TEXT,
  betting_line DECIMAL(5,1), -- Current spread for context
  total_line DECIMAL(5,1), -- Current total for context

  -- Momentum & Highlights
  last_scoring_play JSONB, -- {team, points, description, time}
  momentum_team TEXT, -- Which team has momentum
  scoring_run_current TEXT, -- e.g., "Lakers 12-0 run"
  period_scores JSONB, -- Detailed scoring by period

  -- Metadata
  api_source TEXT, -- 'espn', 'rundown', 'odds-api'
  api_response JSONB, -- Full API response for debugging
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_game_status CHECK (
    game_status IN ('scheduled', 'pre_game', 'in_progress', 'halftime', 'final', 'postponed', 'cancelled')
  ),
  CONSTRAINT valid_ticker_priority CHECK (ticker_priority >= 0 AND ticker_priority <= 100)
);

-- Indexes for performance
CREATE INDEX idx_ticker_games_status ON live_ticker_games(game_status);
CREATE INDEX idx_ticker_games_league ON live_ticker_games(league);
CREATE INDEX idx_ticker_games_sport ON live_ticker_games(sport);
CREATE INDEX idx_ticker_games_priority ON live_ticker_games(ticker_priority DESC);
CREATE INDEX idx_ticker_games_scheduled_time ON live_ticker_games(scheduled_start_time);
CREATE INDEX idx_ticker_games_last_updated ON live_ticker_games(last_updated DESC);
CREATE INDEX idx_ticker_games_featured ON live_ticker_games(is_featured) WHERE is_featured = TRUE;
CREATE INDEX idx_ticker_games_active ON live_ticker_games(game_status) WHERE game_status IN ('in_progress', 'halftime');

-- ============================================================================
-- Table: live_ticker_events
-- Purpose: Key moments and highlights to display in the ticker
-- ============================================================================
CREATE TABLE IF NOT EXISTS live_ticker_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES live_ticker_games(game_id) ON DELETE CASCADE,

  -- Event Details
  event_type TEXT NOT NULL, -- touchdown, field_goal, basket, three_pointer, home_run, goal, etc.
  event_category TEXT NOT NULL, -- scoring, milestone, injury, challenge, etc.
  importance INTEGER DEFAULT 5, -- 1-10, how important to show

  -- Event Description
  title TEXT NOT NULL, -- "Josh Allen TD Pass"
  description TEXT, -- Full description
  short_description TEXT, -- Ticker-friendly short version

  -- Event Context
  team TEXT, -- Which team (home/away team name)
  player_name TEXT,
  player_id TEXT,
  points_scored INTEGER,

  -- Timing
  event_time TIMESTAMPTZ DEFAULT now(),
  game_period TEXT,
  game_clock TEXT,

  -- Display Control
  is_displayed BOOLEAN DEFAULT FALSE, -- Has it been shown in ticker?
  display_count INTEGER DEFAULT 0, -- How many times shown
  last_displayed_at TIMESTAMPTZ,
  display_until TIMESTAMPTZ, -- Auto-expire old events

  -- Metadata
  event_data JSONB, -- Additional structured data
  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_importance CHECK (importance >= 1 AND importance <= 10)
);

-- Indexes
CREATE INDEX idx_ticker_events_game ON live_ticker_events(game_id);
CREATE INDEX idx_ticker_events_type ON live_ticker_events(event_type);
CREATE INDEX idx_ticker_events_importance ON live_ticker_events(importance DESC);
CREATE INDEX idx_ticker_events_time ON live_ticker_events(event_time DESC);
CREATE INDEX idx_ticker_events_undisplayed ON live_ticker_events(is_displayed) WHERE is_displayed = FALSE;
CREATE INDEX idx_ticker_events_active ON live_ticker_events(display_until) WHERE display_until > now();

-- ============================================================================
-- Table: user_ticker_preferences
-- Purpose: User customization for their live ticker experience
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_ticker_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Sport & League Preferences
  favorite_sports TEXT[] DEFAULT ARRAY['NFL', 'NBA', 'MLB', 'NHL'], -- Sports to show
  favorite_leagues TEXT[] DEFAULT ARRAY['NFL', 'NBA', 'MLB', 'NHL'], -- Leagues to show
  favorite_teams TEXT[], -- Specific teams to prioritize

  -- Display Preferences
  show_all_games BOOLEAN DEFAULT TRUE, -- Show all games or just favorites
  show_scores BOOLEAN DEFAULT TRUE, -- Show scores or just game status
  show_odds BOOLEAN DEFAULT FALSE, -- Show betting lines in ticker
  show_only_live BOOLEAN DEFAULT FALSE, -- Only show in-progress games
  show_final_scores BOOLEAN DEFAULT TRUE, -- Show completed games
  show_upcoming BOOLEAN DEFAULT TRUE, -- Show scheduled games

  -- Ticker Behavior
  auto_scroll BOOLEAN DEFAULT TRUE,
  scroll_speed INTEGER DEFAULT 3, -- 1 (slow) to 5 (fast)
  highlight_close_games BOOLEAN DEFAULT TRUE, -- Highlight games within 1 score
  highlight_user_bets BOOLEAN DEFAULT TRUE, -- Highlight games user has bets on

  -- Notification Preferences
  notify_on_score BOOLEAN DEFAULT FALSE, -- Notify on every score for favorites
  notify_on_close_game BOOLEAN DEFAULT TRUE, -- Notify when game becomes close
  notify_on_final BOOLEAN DEFAULT FALSE, -- Notify when game ends

  -- Refresh Settings
  refresh_interval_seconds INTEGER DEFAULT 60, -- How often to refresh (30-300)

  -- Display Order
  sort_by TEXT DEFAULT 'priority', -- priority, time, league, score_differential

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id),
  CONSTRAINT valid_scroll_speed CHECK (scroll_speed >= 1 AND scroll_speed <= 5),
  CONSTRAINT valid_refresh_interval CHECK (refresh_interval_seconds >= 30 AND refresh_interval_seconds <= 300),
  CONSTRAINT valid_sort_by CHECK (sort_by IN ('priority', 'time', 'league', 'score_differential', 'alphabetical'))
);

-- Index
CREATE INDEX idx_user_ticker_prefs_user ON user_ticker_preferences(user_id);

-- ============================================================================
-- Table: ticker_display_queue
-- Purpose: Optimized queue for rotating through games in the ticker UI
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticker_display_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL REFERENCES live_ticker_games(game_id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for global queue

  -- Queue Management
  display_order INTEGER NOT NULL, -- Order in the queue
  last_displayed_at TIMESTAMPTZ,
  display_count INTEGER DEFAULT 0,

  -- Priority Factors
  base_priority INTEGER DEFAULT 50,
  user_has_bet BOOLEAN DEFAULT FALSE, -- +20 priority
  is_favorite_team BOOLEAN DEFAULT FALSE, -- +15 priority
  is_close_game BOOLEAN DEFAULT FALSE, -- +10 priority
  calculated_priority INTEGER GENERATED ALWAYS AS (
    base_priority +
    CASE WHEN user_has_bet THEN 20 ELSE 0 END +
    CASE WHEN is_favorite_team THEN 15 ELSE 0 END +
    CASE WHEN is_close_game THEN 10 ELSE 0 END
  ) STORED,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(game_id, user_id)
);

-- Indexes
CREATE INDEX idx_ticker_queue_user ON ticker_display_queue(user_id);
CREATE INDEX idx_ticker_queue_order ON ticker_display_queue(display_order);
CREATE INDEX idx_ticker_queue_priority ON ticker_display_queue(calculated_priority DESC);
CREATE INDEX idx_ticker_queue_game ON ticker_display_queue(game_id);

-- ============================================================================
-- Table: ticker_stats
-- Purpose: Track ticker usage and performance metrics
-- ============================================================================
CREATE TABLE IF NOT EXISTS ticker_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Time Period
  stat_date DATE NOT NULL DEFAULT CURRENT_DATE,
  stat_hour INTEGER, -- Hour of day (0-23) for hourly stats

  -- Metrics
  total_games_displayed INTEGER DEFAULT 0,
  total_events_displayed INTEGER DEFAULT 0,
  unique_users_viewing INTEGER DEFAULT 0,
  avg_games_per_session DECIMAL(10,2),
  avg_session_duration_seconds INTEGER,

  -- Performance
  avg_load_time_ms INTEGER,
  total_refresh_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,

  -- Popular Content
  most_viewed_game_id TEXT,
  most_viewed_league TEXT,
  most_viewed_sport TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(stat_date, stat_hour),
  CONSTRAINT valid_hour CHECK (stat_hour IS NULL OR (stat_hour >= 0 AND stat_hour <= 23))
);

-- Index
CREATE INDEX idx_ticker_stats_date ON ticker_stats(stat_date DESC);

-- ============================================================================
-- Views: Optimized queries for ticker display
-- ============================================================================

-- View: Active games for ticker (in progress or recent finals)
CREATE OR REPLACE VIEW ticker_active_games AS
SELECT
  g.*,
  ABS(g.home_score - g.away_score) as score_differential,
  CASE
    WHEN g.game_status = 'in_progress' THEN 100
    WHEN g.game_status = 'halftime' THEN 95
    WHEN g.game_status = 'final' AND g.last_updated > now() - interval '30 minutes' THEN 50
    ELSE g.ticker_priority
  END as adjusted_priority
FROM live_ticker_games g
WHERE
  g.game_status IN ('in_progress', 'halftime')
  OR (g.game_status = 'final' AND g.last_updated > now() - interval '2 hours')
  OR (g.game_status = 'scheduled' AND g.scheduled_start_time <= now() + interval '30 minutes')
ORDER BY adjusted_priority DESC, g.scheduled_start_time ASC;

-- View: Ticker events feed (recent important events)
CREATE OR REPLACE VIEW ticker_events_feed AS
SELECT
  e.*,
  g.home_team,
  g.away_team,
  g.league,
  g.sport,
  g.home_score,
  g.away_score,
  g.game_status
FROM live_ticker_events e
JOIN live_ticker_games g ON e.game_id = g.game_id
WHERE
  e.event_time > now() - interval '15 minutes'
  AND (e.display_until IS NULL OR e.display_until > now())
  AND e.importance >= 6 -- Only show important events
ORDER BY e.importance DESC, e.event_time DESC;

-- View: User's personalized ticker feed
CREATE OR REPLACE VIEW ticker_user_feed AS
SELECT
  g.*,
  COALESCE(p.show_scores, TRUE) as user_show_scores,
  COALESCE(p.show_odds, FALSE) as user_show_odds,
  COALESCE(p.highlight_close_games, TRUE) as user_highlight_close,
  EXISTS(
    SELECT 1 FROM bets b
    WHERE b.user_id = p.user_id
    AND b.game_id = g.game_id
    AND b.status NOT IN ('settled', 'void')
  ) as user_has_active_bet,
  CASE
    WHEN p.favorite_teams @> ARRAY[g.home_team] OR p.favorite_teams @> ARRAY[g.away_team] THEN TRUE
    ELSE FALSE
  END as is_user_favorite
FROM live_ticker_games g
CROSS JOIN user_ticker_preferences p
WHERE
  (p.show_all_games = TRUE OR p.favorite_teams @> ARRAY[g.home_team] OR p.favorite_teams @> ARRAY[g.away_team])
  AND (p.show_only_live = FALSE OR g.game_status IN ('in_progress', 'halftime'))
  AND (p.favorite_sports @> ARRAY[g.sport] OR p.favorite_sports IS NULL)
  AND (p.favorite_leagues @> ARRAY[g.league] OR p.favorite_leagues IS NULL);

-- ============================================================================
-- Functions: Business logic for ticker operations
-- ============================================================================

-- Function: Update close game flags based on score differential
CREATE OR REPLACE FUNCTION update_close_game_flags()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE live_ticker_games
  SET is_close_game = CASE
    WHEN game_status IN ('in_progress', 'halftime') THEN
      CASE
        WHEN sport IN ('NFL', 'NCAAF') THEN ABS(home_score - away_score) <= 7
        WHEN sport IN ('NBA', 'WNBA', 'NCAAB') THEN ABS(home_score - away_score) <= 8
        WHEN sport IN ('MLB') THEN ABS(home_score - away_score) <= 2
        WHEN sport IN ('NHL') THEN ABS(home_score - away_score) <= 1
        WHEN sport IN ('MLS') THEN ABS(home_score - away_score) <= 1
        ELSE ABS(home_score - away_score) <= 5
      END
    ELSE FALSE
  END;
END;
$$;

-- Function: Calculate and update ticker priority
CREATE OR REPLACE FUNCTION update_ticker_priority()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE live_ticker_games
  SET ticker_priority = (
    50 + -- Base priority
    CASE WHEN game_status = 'in_progress' THEN 30 ELSE 0 END + -- Live games
    CASE WHEN is_featured THEN 15 ELSE 0 END + -- Featured games
    CASE WHEN is_close_game THEN 20 ELSE 0 END + -- Close games
    CASE WHEN is_trending THEN 10 ELSE 0 END - -- Trending games
    CASE
      WHEN game_status = 'final' THEN
        GREATEST(0, 30 - EXTRACT(EPOCH FROM (now() - last_updated))/120) -- Decay priority after final
      ELSE 0
    END::INTEGER
  );
END;
$$;

-- Function: Sync from live_score_cache to ticker
CREATE OR REPLACE FUNCTION sync_scores_to_ticker()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO live_ticker_games (
    game_id, league, sport, home_team, away_team,
    home_score, away_score, game_status, period,
    time_remaining, scheduled_start_time, last_updated,
    period_scores, api_source, api_response
  )
  SELECT
    lsc.game_id, lsc.league, lsc.sport, lsc.home_team, lsc.away_team,
    lsc.home_score, lsc.away_score, lsc.game_status, lsc.period,
    lsc.time_remaining,
    COALESCE(lsc.scheduled_time, now()) as scheduled_start_time,
    lsc.last_updated,
    lsc.period_scores,
    'live_score_cache' as api_source,
    lsc.api_response
  FROM live_score_cache lsc
  ON CONFLICT (game_id) DO UPDATE SET
    home_score = EXCLUDED.home_score,
    away_score = EXCLUDED.away_score,
    game_status = EXCLUDED.game_status,
    period = EXCLUDED.period,
    time_remaining = EXCLUDED.time_remaining,
    last_updated = EXCLUDED.last_updated,
    period_scores = EXCLUDED.period_scores,
    api_response = EXCLUDED.api_response;

  -- Update close game flags
  PERFORM update_close_game_flags();

  -- Update priorities
  PERFORM update_ticker_priority();
END;
$$;

-- Function: Create ticker event from score change
CREATE OR REPLACE FUNCTION create_ticker_event_on_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  points_scored INTEGER;
  scoring_team TEXT;
BEGIN
  -- Only create events for live games
  IF NEW.game_status NOT IN ('in_progress', 'halftime') THEN
    RETURN NEW;
  END IF;

  -- Detect scoring
  IF NEW.home_score > OLD.home_score THEN
    points_scored := NEW.home_score - OLD.home_score;
    scoring_team := NEW.home_team;
  ELSIF NEW.away_score > OLD.away_score THEN
    points_scored := NEW.away_score - OLD.away_score;
    scoring_team := NEW.away_team;
  ELSE
    RETURN NEW;
  END IF;

  -- Create event
  INSERT INTO live_ticker_events (
    game_id, event_type, event_category, importance,
    title, short_description, team, points_scored,
    game_period, game_clock, display_until
  ) VALUES (
    NEW.game_id,
    CASE
      WHEN NEW.sport IN ('NFL', 'NCAAF') AND points_scored = 6 THEN 'touchdown'
      WHEN NEW.sport IN ('NFL', 'NCAAF') AND points_scored = 3 THEN 'field_goal'
      WHEN NEW.sport IN ('NBA', 'WNBA', 'NCAAB') AND points_scored = 3 THEN 'three_pointer'
      WHEN NEW.sport IN ('NBA', 'WNBA', 'NCAAB') THEN 'basket'
      WHEN NEW.sport IN ('MLB') THEN 'run_scored'
      WHEN NEW.sport IN ('NHL', 'MLS') THEN 'goal'
      ELSE 'score'
    END,
    'scoring',
    8, -- High importance for scoring plays
    scoring_team || ' scores ' || points_scored,
    scoring_team || ' +' || points_scored,
    scoring_team,
    points_scored,
    NEW.period,
    NEW.time_remaining,
    now() + interval '10 minutes' -- Display for 10 minutes
  );

  RETURN NEW;
END;
$$;

-- Trigger: Auto-create events on score changes
CREATE TRIGGER trigger_ticker_event_on_score
AFTER UPDATE OF home_score, away_score ON live_ticker_games
FOR EACH ROW
WHEN (OLD.home_score IS DISTINCT FROM NEW.home_score OR OLD.away_score IS DISTINCT FROM NEW.away_score)
EXECUTE FUNCTION create_ticker_event_on_score_change();

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE live_ticker_games ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_ticker_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_ticker_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticker_display_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticker_stats ENABLE ROW LEVEL SECURITY;

-- live_ticker_games: Public read access
CREATE POLICY "Anyone can view live ticker games"
  ON live_ticker_games FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage ticker games"
  ON live_ticker_games FOR ALL
  TO service_role
  USING (true);

-- live_ticker_events: Public read access
CREATE POLICY "Anyone can view ticker events"
  ON live_ticker_events FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage ticker events"
  ON live_ticker_events FOR ALL
  TO service_role
  USING (true);

-- user_ticker_preferences: User-specific access
CREATE POLICY "Users can view their own ticker preferences"
  ON user_ticker_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own ticker preferences"
  ON user_ticker_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ticker preferences"
  ON user_ticker_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own ticker preferences"
  ON user_ticker_preferences FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all ticker preferences"
  ON user_ticker_preferences FOR ALL
  TO service_role
  USING (true);

-- ticker_display_queue: User-specific and global access
CREATE POLICY "Users can view their own ticker queue"
  ON ticker_display_queue FOR SELECT
  USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role can manage ticker queue"
  ON ticker_display_queue FOR ALL
  TO service_role
  USING (true);

-- ticker_stats: Public read, service write
CREATE POLICY "Anyone can view ticker stats"
  ON ticker_stats FOR SELECT
  USING (true);

CREATE POLICY "Service role can manage ticker stats"
  ON ticker_stats FOR ALL
  TO service_role
  USING (true);

-- ============================================================================
-- Initial Data: Create default preferences for existing users
-- ============================================================================

-- This will be handled by the application or a separate migration
-- to avoid issues with users not yet existing

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE live_ticker_games IS 'Live games optimized for ticker display with priority and status tracking';
COMMENT ON TABLE live_ticker_events IS 'Key game moments and highlights to display in the live ticker';
COMMENT ON TABLE user_ticker_preferences IS 'User customization settings for their personalized ticker experience';
COMMENT ON TABLE ticker_display_queue IS 'Optimized rotation queue for displaying games in the ticker UI';
COMMENT ON TABLE ticker_stats IS 'Analytics and metrics for ticker usage and performance';

COMMENT ON VIEW ticker_active_games IS 'Currently active and recently completed games for ticker display';
COMMENT ON VIEW ticker_events_feed IS 'Recent important events from live games';
COMMENT ON VIEW ticker_user_feed IS 'Personalized game feed based on user preferences';

COMMENT ON FUNCTION sync_scores_to_ticker() IS 'Syncs data from live_score_cache to ticker tables with priority calculation';
COMMENT ON FUNCTION update_close_game_flags() IS 'Updates is_close_game flag based on sport-specific thresholds';
COMMENT ON FUNCTION update_ticker_priority() IS 'Calculates and updates ticker_priority based on multiple factors';
