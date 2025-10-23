-- Remove bankroll CRM tracking functionality
-- This migration removes all CRM-related columns and functions

-- Drop triggers first
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_insert ON bets;
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_update ON bets;
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_delete ON bets;

-- Drop functions
DROP FUNCTION IF EXISTS sync_user_betting_profile(UUID);
DROP FUNCTION IF EXISTS settle_bet_atomic(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC);
DROP FUNCTION IF EXISTS settle_pending_bets_batch();
DROP FUNCTION IF EXISTS update_profile_stats_incremental();
DROP FUNCTION IF EXISTS trigger_sync_betting_profile();
DROP FUNCTION IF EXISTS sync_profile_if_needed(UUID);

-- Remove CRM columns from profiles table
ALTER TABLE profiles
DROP COLUMN IF EXISTS bankroll,
DROP COLUMN IF EXISTS baseline_bankroll,
DROP COLUMN IF EXISTS betting_mode,
DROP COLUMN IF EXISTS default_bet_size,
DROP COLUMN IF EXISTS kelly_multiplier,
DROP COLUMN IF EXISTS total_bets_placed,
DROP COLUMN IF EXISTS total_bets_won,
DROP COLUMN IF EXISTS total_bets_lost,
DROP COLUMN IF EXISTS total_bets_pushed,
DROP COLUMN IF EXISTS win_rate,
DROP COLUMN IF EXISTS roi,
DROP COLUMN IF EXISTS total_profit,
DROP COLUMN IF EXISTS current_streak,
DROP COLUMN IF EXISTS average_bet_size,
DROP COLUMN IF EXISTS largest_win,
DROP COLUMN IF EXISTS largest_loss,
DROP COLUMN IF EXISTS pending_bet_count,
DROP COLUMN IF EXISTS pending_bet_amount,
DROP COLUMN IF EXISTS last_sync_at,
DROP COLUMN IF EXISTS needs_profile_sync;

-- Add theme column if it doesn't exist
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'dark' CHECK (theme IN ('light', 'dark'));

-- Ensure risk_tolerance has proper constraint
ALTER TABLE profiles
DROP CONSTRAINT IF EXISTS profiles_risk_tolerance_check;

ALTER TABLE profiles
ADD CONSTRAINT profiles_risk_tolerance_check
CHECK (risk_tolerance IN ('conservative', 'moderate', 'aggressive'));
