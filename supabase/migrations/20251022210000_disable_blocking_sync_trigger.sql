-- ============================================================================
-- EMERGENCY FIX: DISABLE BLOCKING PROFILE SYNC TRIGGERS
-- ============================================================================
-- This migration disables the synchronous triggers that were causing
-- first message delays of 1-10+ seconds by looping through all user bets.
--
-- The triggers are replaced with:
-- 1. A lightweight flag-based system (needs_profile_sync)
-- 2. An on-demand sync function that can be called when needed
-- 3. Optional: Can be converted to scheduled background job later
-- ============================================================================

-- ============================================================================
-- 1. DROP BLOCKING TRIGGERS
-- ============================================================================

-- Remove the triggers that were blocking all bet operations
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_insert ON public.bets;
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_update ON public.bets;
DROP TRIGGER IF EXISTS trigger_sync_profile_on_bet_delete ON public.bets;

COMMENT ON FUNCTION trigger_sync_betting_profile IS 'DISABLED: Trigger function replaced with on-demand sync to prevent blocking operations';

-- ============================================================================
-- 2. ADD LIGHTWEIGHT SYNC FLAG TO PROFILES
-- ============================================================================

-- Add a flag to track which profiles need syncing (non-blocking)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS needs_profile_sync BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.profiles.needs_profile_sync IS 'Flag indicating profile stats need to be recalculated from bets';

-- ============================================================================
-- 3. CREATE LIGHTWEIGHT TRIGGER TO FLAG PROFILES FOR SYNC
-- ============================================================================

-- New lightweight trigger function that just sets a flag (microseconds, not seconds)
CREATE OR REPLACE FUNCTION flag_profile_for_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Just flag the profile for sync, don't actually sync
  -- This is virtually instant (single column update)
  IF TG_OP = 'DELETE' THEN
    UPDATE profiles
    SET needs_profile_sync = true
    WHERE id = OLD.user_id;
    RETURN OLD;
  ELSE
    UPDATE profiles
    SET needs_profile_sync = true
    WHERE id = NEW.user_id;
    RETURN NEW;
  END IF;
END;
$$;

COMMENT ON FUNCTION flag_profile_for_sync IS 'Lightweight trigger that flags profiles for sync without blocking';

-- ============================================================================
-- 4. CREATE NEW LIGHTWEIGHT TRIGGERS
-- ============================================================================

-- These triggers are 1000x faster - they just set a boolean flag
CREATE TRIGGER trigger_flag_profile_on_bet_insert
  AFTER INSERT ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION flag_profile_for_sync();

CREATE TRIGGER trigger_flag_profile_on_bet_update
  AFTER UPDATE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION flag_profile_for_sync();

CREATE TRIGGER trigger_flag_profile_on_bet_delete
  AFTER DELETE ON public.bets
  FOR EACH ROW
  EXECUTE FUNCTION flag_profile_for_sync();

-- ============================================================================
-- 5. CREATE ON-DEMAND SYNC FUNCTION (NON-BLOCKING)
-- ============================================================================

-- Wrapper function that only syncs if the flag is set
CREATE OR REPLACE FUNCTION sync_profile_if_needed(target_user_id UUID)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  stats JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  needs_sync BOOLEAN;
BEGIN
  -- Check if sync is needed
  SELECT needs_profile_sync INTO needs_sync
  FROM profiles
  WHERE id = target_user_id;

  -- If no sync needed, return early
  IF NOT COALESCE(needs_sync, false) THEN
    RETURN QUERY SELECT
      true AS success,
      'Profile already synced' AS message,
      NULL::JSONB AS stats;
    RETURN;
  END IF;

  -- Perform sync using existing function
  RETURN QUERY SELECT * FROM sync_user_betting_profile(target_user_id);

  -- Clear the sync flag
  UPDATE profiles
  SET needs_profile_sync = false
  WHERE id = target_user_id;

EXCEPTION
  WHEN OTHERS THEN
    RETURN QUERY SELECT
      false AS success,
      'Error syncing profile: ' || SQLERRM AS message,
      NULL::JSONB AS stats;
END;
$$;

COMMENT ON FUNCTION sync_profile_if_needed IS 'Syncs profile only if needs_profile_sync flag is set. Safe to call frequently.';

-- ============================================================================
-- 6. CREATE BATCH SYNC FUNCTION FOR BACKGROUND JOBS (OPTIONAL)
-- ============================================================================

-- Function to sync all profiles that need it (for scheduled jobs)
CREATE OR REPLACE FUNCTION sync_all_flagged_profiles()
RETURNS TABLE(
  synced_count INTEGER,
  error_count INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_synced_count INTEGER := 0;
  v_error_count INTEGER := 0;
  user_record RECORD;
  sync_result RECORD;
BEGIN
  -- Find all users who need sync
  FOR user_record IN
    SELECT id
    FROM profiles
    WHERE needs_profile_sync = true
    LIMIT 100  -- Process in batches to avoid long-running queries
  LOOP
    BEGIN
      -- Sync this user
      SELECT * INTO sync_result
      FROM sync_user_betting_profile(user_record.id);

      IF sync_result.success THEN
        v_synced_count := v_synced_count + 1;
        -- Clear the flag
        UPDATE profiles
        SET needs_profile_sync = false
        WHERE id = user_record.id;
      ELSE
        v_error_count := v_error_count + 1;
      END IF;

    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error syncing profile %: %', user_record.id, SQLERRM;
    END;
  END LOOP;

  RETURN QUERY SELECT
    v_synced_count,
    v_error_count,
    format('Synced %s profiles, %s errors', v_synced_count, v_error_count) AS message;
END;
$$;

COMMENT ON FUNCTION sync_all_flagged_profiles IS 'Batch sync all profiles flagged for sync. Use in scheduled jobs or manually.';

-- ============================================================================
-- 7. INITIAL SETUP - FLAG ALL EXISTING PROFILES FOR SYNC
-- ============================================================================

-- Flag all existing profiles to sync on next access
-- This ensures stats are up-to-date after migration
UPDATE profiles SET needs_profile_sync = true;

-- ============================================================================
-- USAGE NOTES
-- ============================================================================

-- To manually sync a specific user:
--   SELECT * FROM sync_profile_if_needed('user-uuid-here');

-- To sync all flagged profiles (run periodically):
--   SELECT * FROM sync_all_flagged_profiles();

-- To check how many profiles need syncing:
--   SELECT COUNT(*) FROM profiles WHERE needs_profile_sync = true;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
