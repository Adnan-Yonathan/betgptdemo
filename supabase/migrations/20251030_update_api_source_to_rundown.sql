-- ============================================================================
-- UPDATE API SOURCE FROM 'odds-api' TO 'rundown'
-- ============================================================================
-- This migration updates the api_source_log table to reflect the correct
-- API source name 'rundown' instead of the outdated 'odds-api' reference.
-- ============================================================================

-- First, update any existing 'odds-api' entries to 'rundown'
UPDATE api_source_log
SET source = 'rundown'
WHERE source = 'odds-api';

-- Drop the old constraint if it exists
ALTER TABLE api_source_log
DROP CONSTRAINT IF EXISTS api_source_log_source_check;

-- Add the updated constraint with 'rundown' instead of 'odds-api'
ALTER TABLE api_source_log
ADD CONSTRAINT api_source_log_source_check
CHECK (source IN ('balldontlie', 'espn', 'rundown', 'openai'));

-- Log the migration
DO $$
BEGIN
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'API SOURCE UPDATED: odds-api → rundown';
  RAISE NOTICE '=================================================================';
  RAISE NOTICE 'Updated api_source_log constraint to use "rundown" instead of "odds-api"';
  RAISE NOTICE 'This reflects the actual API being used: The Rundown API';
  RAISE NOTICE '=================================================================';
END $$;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
