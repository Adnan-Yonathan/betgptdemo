-- ============================================================================
-- ADD ERROR LOGGING TO BETTING ODDS FETCH LOG
-- ============================================================================
-- This migration adds an error_message column to track fetch failures
-- for better debugging and monitoring of The Rundown API integration
-- ============================================================================

-- Add error_message column to betting_odds_fetch_log for better debugging
ALTER TABLE betting_odds_fetch_log
ADD COLUMN IF NOT EXISTS error_message TEXT;

COMMENT ON COLUMN betting_odds_fetch_log.error_message IS
  'Error message when fetch fails, null when successful. Used for debugging API integration issues.';

-- Create index for quick error lookup
CREATE INDEX IF NOT EXISTS idx_betting_odds_fetch_log_errors
ON betting_odds_fetch_log(success, created_at DESC)
WHERE success = false;

COMMENT ON INDEX idx_betting_odds_fetch_log_errors IS
  'Index to quickly find failed fetch attempts for monitoring and debugging';
