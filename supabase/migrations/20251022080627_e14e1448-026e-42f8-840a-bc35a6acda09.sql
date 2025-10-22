-- Add all missing CRM tracking columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS total_bets_placed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bets_won integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bets_lost integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_bets_pushed integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS win_rate numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS roi numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_profit numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_streak integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_bet_size numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_bet_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_bet_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS largest_win numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS largest_loss numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS kelly_multiplier numeric DEFAULT 0.25;