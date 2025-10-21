-- Add initial_bankroll column to profiles table to track starting balance
-- This allows us to update the current bankroll while preserving the initial value for percentage calculations

-- Add the column with the same default as bankroll
ALTER TABLE public.profiles
ADD COLUMN initial_bankroll DECIMAL(10, 2) DEFAULT 1000.00;

-- For existing users, set initial_bankroll to their current bankroll value
-- This preserves their starting balance before we begin updating bankroll with wins/losses
UPDATE public.profiles
SET initial_bankroll = bankroll
WHERE initial_bankroll IS NULL;

-- Add a comment to explain the field
COMMENT ON COLUMN public.profiles.initial_bankroll IS 'The starting bankroll amount set by the user. Used to calculate percentage change.';
COMMENT ON COLUMN public.profiles.bankroll IS 'The current bankroll amount, updated automatically with each bet win/loss.';
