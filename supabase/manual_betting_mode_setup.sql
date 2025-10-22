-- ============================================================================
-- MANUAL BETTING MODE SETUP SCRIPT
-- ============================================================================
-- This script can be run directly in the Supabase SQL Editor to:
-- 1. Add the betting_mode column to the profiles table (if missing)
-- 2. Verify RLS policies are in place
-- 3. Update existing profiles to have default values
--
-- This script is idempotent - it can be run multiple times safely.
-- ============================================================================

-- ============================================================================
-- STEP 1: Add betting_mode column if it doesn't exist
-- ============================================================================

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

    RAISE NOTICE '✅ Added betting_mode column to profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  betting_mode column already exists, skipping';
  END IF;
END $$;

-- Add documentation comment
COMMENT ON COLUMN public.profiles.betting_mode IS 'Betting analysis mode: basic for casual bettors with simple explanations, advanced for complex analysis with backtesting and +EV calculations';

-- ============================================================================
-- STEP 2: Update existing profiles to have default value
-- ============================================================================

DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.profiles
  SET betting_mode = 'basic'
  WHERE betting_mode IS NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count > 0 THEN
    RAISE NOTICE '✅ Updated % existing profiles to have betting_mode = basic', updated_count;
  ELSE
    RAISE NOTICE 'ℹ️  No profiles needed updating';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: Verify RLS is enabled
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND rowsecurity = false
  ) THEN
    ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE '✅ Enabled RLS on profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  RLS already enabled on profiles table';
  END IF;
END $$;

-- ============================================================================
-- STEP 4: Verify RLS policies exist
-- ============================================================================

-- Policy for SELECT (users can view their own profile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can view their own profile'
  ) THEN
    CREATE POLICY "Users can view their own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);

    RAISE NOTICE '✅ Created SELECT policy for profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  SELECT policy already exists';
  END IF;
END $$;

-- Policy for UPDATE (users can update their own profile)
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

    RAISE NOTICE '✅ Created UPDATE policy for profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  UPDATE policy already exists';
  END IF;
END $$;

-- Policy for INSERT (users can insert their own profile)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can insert their own profile'
  ) THEN
    CREATE POLICY "Users can insert their own profile"
    ON public.profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

    RAISE NOTICE '✅ Created INSERT policy for profiles table';
  ELSE
    RAISE NOTICE 'ℹ️  INSERT policy already exists';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: Verification queries
-- ============================================================================

-- Show table structure
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
ORDER BY ordinal_position;

-- Show RLS policies
SELECT
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'profiles';

-- Show sample of profiles (will only show your own profile due to RLS)
SELECT
  id,
  email,
  betting_mode,
  bankroll,
  created_at
FROM public.profiles
LIMIT 5;

-- ============================================================================
-- VERIFICATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE '✅ Betting mode setup complete!';
  RAISE NOTICE '✅ ============================================';
  RAISE NOTICE 'ℹ️  The betting_mode column is now ready to use.';
  RAISE NOTICE 'ℹ️  Users can toggle between "basic" and "advanced" modes.';
  RAISE NOTICE 'ℹ️  Check the query results above to verify the setup.';
END $$;
