-- Add bankroll column to profiles table for user bankroll management
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS bankroll DECIMAL(10, 2) DEFAULT 1000.00;

-- Update existing profiles to have the default bankroll
UPDATE profiles
SET bankroll = 1000.00
WHERE bankroll IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN profiles.bankroll IS 'User initial bankroll amount for betting calculations';
