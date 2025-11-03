-- Live Ticker Cron Jobs
-- Automated tasks for keeping the ticker updated in real-time

-- ============================================================================
-- Cron Job: Sync scores to ticker every 30 seconds
-- ============================================================================

-- First, ensure pg_cron extension is enabled (should already be enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Sync live scores to ticker table every 30 seconds
SELECT cron.schedule(
  'sync-ticker-scores',
  '* * * * *', -- Every minute (we'll use the function to run more frequently)
  $$SELECT sync_scores_to_ticker();$$
);

-- ============================================================================
-- Cron Job: Clean up old ticker events every hour
-- ============================================================================

SELECT cron.schedule(
  'cleanup-ticker-events',
  '0 * * * *', -- Every hour at minute 0
  $$
    DELETE FROM live_ticker_events
    WHERE display_until < now() - interval '1 hour'
    AND is_displayed = true;
  $$
);

-- ============================================================================
-- Cron Job: Update ticker stats every hour
-- ============================================================================

SELECT cron.schedule(
  'update-ticker-stats',
  '5 * * * *', -- Every hour at minute 5
  $$
    INSERT INTO ticker_stats (
      stat_date,
      stat_hour,
      total_games_displayed,
      most_viewed_league
    )
    SELECT
      CURRENT_DATE,
      EXTRACT(HOUR FROM now())::INTEGER,
      COUNT(DISTINCT game_id),
      MODE() WITHIN GROUP (ORDER BY league)
    FROM live_ticker_games
    WHERE last_updated > now() - interval '1 hour'
    ON CONFLICT (stat_date, stat_hour) DO UPDATE SET
      total_games_displayed = EXCLUDED.total_games_displayed,
      most_viewed_league = EXCLUDED.most_viewed_league,
      updated_at = now();
  $$
);

-- ============================================================================
-- Cron Job: Refresh ticker display queue every 2 minutes
-- ============================================================================

SELECT cron.schedule(
  'refresh-ticker-queue',
  '*/2 * * * *', -- Every 2 minutes
  $$
    -- Clear old queue entries
    DELETE FROM ticker_display_queue
    WHERE game_id NOT IN (
      SELECT game_id FROM live_ticker_games
      WHERE game_status IN ('in_progress', 'halftime')
         OR (game_status = 'final' AND last_updated > now() - interval '2 hours')
    );

    -- Add/update queue entries for active games
    INSERT INTO ticker_display_queue (game_id, user_id, base_priority)
    SELECT
      g.game_id,
      NULL as user_id, -- Global queue
      g.ticker_priority
    FROM live_ticker_games g
    WHERE g.game_status IN ('in_progress', 'halftime', 'scheduled')
       OR (g.game_status = 'final' AND g.last_updated > now() - interval '2 hours')
    ON CONFLICT (game_id, user_id) DO UPDATE SET
      base_priority = EXCLUDED.base_priority,
      updated_at = now();
  $$
);

-- ============================================================================
-- Cron Job: Archive old completed games
-- ============================================================================

SELECT cron.schedule(
  'archive-ticker-games',
  '0 4 * * *', -- Daily at 4:00 AM
  $$
    DELETE FROM live_ticker_games
    WHERE game_status = 'final'
    AND last_updated < now() - interval '24 hours';
  $$
);

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON SCHEMA cron IS 'pg_cron extension for scheduled jobs';
