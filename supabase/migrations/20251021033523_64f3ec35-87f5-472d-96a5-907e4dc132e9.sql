-- Add columns to bets table for automatic settlement tracking
ALTER TABLE bets 
ADD COLUMN IF NOT EXISTS event_id TEXT,
ADD COLUMN IF NOT EXISTS team_bet_on TEXT,
ADD COLUMN IF NOT EXISTS bet_type TEXT DEFAULT 'moneyline';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_bets_event_id ON bets(event_id);
CREATE INDEX IF NOT EXISTS idx_bets_outcome ON bets(outcome);
CREATE INDEX IF NOT EXISTS idx_bets_pending_with_event ON bets(outcome, event_id) WHERE outcome = 'pending' AND event_id IS NOT NULL;

COMMENT ON COLUMN bets.event_id IS 'Links to sports_scores.event_id for automatic settlement';
COMMENT ON COLUMN bets.team_bet_on IS 'Team or side the user bet on';
COMMENT ON COLUMN bets.bet_type IS 'Type of bet: moneyline, spread, total, etc.';