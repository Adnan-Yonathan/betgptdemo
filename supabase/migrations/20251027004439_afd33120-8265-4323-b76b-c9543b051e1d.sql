-- ============================================================================
-- MISSING COLUMNS MIGRATION
-- Adds columns referenced by components but missing from tables
-- ============================================================================

-- 1. Add tracking columns to loss_limits table
ALTER TABLE loss_limits ADD COLUMN IF NOT EXISTS current_daily_loss NUMERIC DEFAULT 0;
ALTER TABLE loss_limits ADD COLUMN IF NOT EXISTS current_weekly_loss NUMERIC DEFAULT 0;
ALTER TABLE loss_limits ADD COLUMN IF NOT EXISTS current_monthly_loss NUMERIC DEFAULT 0;

-- 2. Add cool-off period column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cool_off_end TIMESTAMPTZ;

-- 3. Add confidence_score to bets table (for AI predictions)
ALTER TABLE bets ADD COLUMN IF NOT EXISTS confidence_score NUMERIC;