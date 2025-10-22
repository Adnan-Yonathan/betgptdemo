-- Add baseline_bankroll column to track the starting point for CRM statistics
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS baseline_bankroll numeric DEFAULT 1000.00;

-- Set baseline_bankroll to current bankroll for existing users
UPDATE public.profiles 
SET baseline_bankroll = COALESCE(bankroll, 1000.00)
WHERE baseline_bankroll IS NULL;