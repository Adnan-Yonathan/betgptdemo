-- ============================================================================
-- Add betting_mode column to profiles table
-- ============================================================================
-- This migration adds the betting_mode column to store user's preferred
-- analysis mode (basic or advanced). Uses idempotent pattern to safely
-- handle cases where the column might already exist.
-- ============================================================================

-- Add betting_mode column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'betting_mode'
  ) THEN
    ALTER TABLE public.profiles
    ADD COLUMN betting_mode TEXT CHECK (betting_mode IN ('basic', 'advanced')) DEFAULT 'basic';

    RAISE NOTICE 'Added betting_mode column to profiles table';
  ELSE
    RAISE NOTICE 'betting_mode column already exists, skipping';
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.betting_mode IS 'Betting analysis mode: basic for casual bettors with simple explanations, advanced for complex analysis with backtesting and +EV calculations';

-- Update existing profiles to have basic mode as default (if they are NULL)
UPDATE public.profiles
SET betting_mode = 'basic'
WHERE betting_mode IS NULL;

-- ============================================================================
-- Verify RLS policies exist for profile updates
-- ============================================================================
-- The profiles table should already have RLS policies from the initial
-- migration (20251020025718), but we verify they exist here for safety.
-- ============================================================================

-- Ensure users can update their own profile (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can update their own profile'
  ) THEN
    CREATE POLICY "Users can update their own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);

    RAISE NOTICE 'Created UPDATE policy for profiles table';
  ELSE
    RAISE NOTICE 'UPDATE policy already exists, skipping';
  END IF;
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
