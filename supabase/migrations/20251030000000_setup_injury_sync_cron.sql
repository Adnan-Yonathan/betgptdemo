-- Injury Data Sync Automation
-- This migration sets up automated fetching of injury reports from ESPN API
-- Runs daily at 6 AM EST to keep injury data fresh

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to invoke the sync-injury-data edge function
CREATE OR REPLACE FUNCTION public.invoke_sync_injury_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  response_status int;
  response_body text;
  function_url text;
BEGIN
  -- Get the Supabase project URL
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/sync-injury-data';

  -- If setting doesn't exist, construct from SUPABASE_URL env var
  IF function_url IS NULL OR function_url = '' THEN
    function_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/sync-injury-data';
  END IF;

  -- Call the edge function to sync injury data
  BEGIN
    SELECT
      status,
      content::text
    INTO
      response_status,
      response_body
    FROM
      http((
        'POST',
        function_url,
        ARRAY[
          http_header('Content-Type', 'application/json'),
          http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))
        ],
        'application/json',
        '{}'
      )::http_request);

    -- Log the result
    RAISE NOTICE 'Injury sync completed. Status: %, Response: %', response_status, response_body;

    -- Return the result as JSONB
    RETURN jsonb_build_object(
      'success', response_status = 200,
      'status', response_status,
      'timestamp', now(),
      'response', response_body::jsonb
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Error syncing injury data: %', SQLERRM;

    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
  END;
END;
$$;

-- Create a simplified wrapper for manual triggering
CREATE OR REPLACE FUNCTION public.trigger_sync_injury_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  RAISE NOTICE 'Manually triggering injury data sync';

  -- Call the main function
  SELECT invoke_sync_injury_data() INTO result;

  RETURN result;
END;
$$;

-- Create a view to check injury data freshness
CREATE OR REPLACE VIEW public.injury_data_status AS
SELECT
  league,
  COUNT(*) as total_injuries,
  COUNT(*) FILTER (WHERE injury_status = 'Out') as players_out,
  COUNT(*) FILTER (WHERE injury_status = 'Doubtful') as players_doubtful,
  COUNT(*) FILTER (WHERE injury_status = 'Questionable') as players_questionable,
  COUNT(*) FILTER (WHERE impact_level = 'High') as high_impact_injuries,
  MAX(last_updated) as last_updated,
  EXTRACT(EPOCH FROM (now() - MAX(last_updated)))/3600 as hours_since_update
FROM public.injury_reports
GROUP BY league
ORDER BY league;

-- Schedule the cron job to run daily at 6 AM EST (10 AM UTC)
SELECT cron.schedule(
  'injury-data-sync',               -- Job name
  '0 10 * * *',                     -- Daily at 10 AM UTC (6 AM EST)
  $$
  SELECT public.invoke_sync_injury_data();
  $$
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.invoke_sync_injury_data() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_sync_injury_data() TO service_role;
GRANT SELECT ON public.injury_data_status TO authenticated, anon;

-- Add helpful comments
COMMENT ON FUNCTION public.invoke_sync_injury_data() IS
'Automatically invokes the sync-injury-data edge function to get latest injury reports from ESPN for NBA, NFL, MLB, NHL';

COMMENT ON FUNCTION public.trigger_sync_injury_data() IS
'Manually trigger injury data sync. Fetches current injury reports for all leagues.';

COMMENT ON VIEW public.injury_data_status IS
'Shows the current state of injury data, including counts by league and freshness';

-- Log the installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Injury Data Sync Cron Job Installed Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Configuration:';
  RAISE NOTICE '  - Schedule: Daily at 6 AM EST (10 AM UTC)';
  RAISE NOTICE '  - Leagues: NBA, NFL, MLB, NHL';
  RAISE NOTICE '  - Source: ESPN API';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual Trigger:';
  RAISE NOTICE '  SELECT trigger_sync_injury_data();';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring:';
  RAISE NOTICE '  - Injury status: SELECT * FROM injury_data_status;';
  RAISE NOTICE '  - Recent injuries: SELECT * FROM injury_reports ORDER BY last_updated DESC LIMIT 20;';
  RAISE NOTICE '  - Cron status: SELECT * FROM cron.job WHERE jobname = ''injury-data-sync'';';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
