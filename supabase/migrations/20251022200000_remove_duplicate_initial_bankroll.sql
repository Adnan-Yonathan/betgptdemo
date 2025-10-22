-- ============================================================================
-- REMOVE DUPLICATE INITIAL_BANKROLL COLUMN
-- ============================================================================
-- The initial_bankroll column was created earlier but then baseline_bankroll
-- was added later to serve the same purpose. This migration removes the
-- duplicate initial_bankroll column to avoid confusion.
-- ============================================================================

-- Migrate any data from initial_bankroll to baseline_bankroll if needed
UPDATE public.profiles
SET baseline_bankroll = initial_bankroll
WHERE baseline_bankroll IS NULL AND initial_bankroll IS NOT NULL;

-- Drop the initial_bankroll column
ALTER TABLE public.profiles
DROP COLUMN IF EXISTS initial_bankroll;

COMMENT ON COLUMN public.profiles.baseline_bankroll IS 'The starting bankroll amount set by the user. Used to calculate percentage change. This is the only baseline column - initial_bankroll was removed as a duplicate.';
