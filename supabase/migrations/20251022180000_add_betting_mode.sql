-- Add betting_mode column to profiles table
ALTER TABLE public.profiles
ADD COLUMN betting_mode TEXT CHECK (betting_mode IN ('basic', 'advanced')) DEFAULT 'basic';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.betting_mode IS 'Betting analysis mode: basic for casual bettors with simple explanations, advanced for complex analysis with backtesting and +EV calculations';
