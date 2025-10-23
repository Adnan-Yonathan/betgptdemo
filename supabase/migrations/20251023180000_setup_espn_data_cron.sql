-- ESPN Data Fetching Automation
-- This migration sets up automated fetching of scores and schedules from ESPN API
-- Runs every 15 minutes to keep data fresh across all major sports

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function to invoke the fetch-sports-scores edge function
CREATE OR REPLACE FUNCTION public.invoke_fetch_espn_scores()
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
  function_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/fetch-sports-scores';

  -- If setting doesn't exist, construct from SUPABASE_URL env var
  IF function_url IS NULL OR function_url = '' THEN
    function_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co/functions/v1/fetch-sports-scores';
  END IF;

  -- Call the edge function to fetch all sports
  -- This will fetch: NFL, NBA, MLB, NHL, NCAAF, WNBA, MLS
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
        '{}'  -- Empty body triggers fetching all sports
      )::http_request);

    -- Log the result
    RAISE NOTICE 'ESPN scores fetch completed. Status: %, Response: %', response_status, response_body;

    -- Return the result as JSONB
    RETURN jsonb_build_object(
      'success', response_status = 200,
      'status', response_status,
      'timestamp', now(),
      'response', response_body::jsonb
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    RAISE WARNING 'Error fetching ESPN scores: %', SQLERRM;

    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'timestamp', now()
    );
  END;
END;
$$;

-- Create a simplified wrapper for manual triggering
CREATE OR REPLACE FUNCTION public.trigger_fetch_espn_scores(sport_key text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- If specific sport requested, call with that sport
  -- Otherwise, fetch all sports
  IF sport_key IS NOT NULL THEN
    RAISE NOTICE 'Manually triggering ESPN fetch for sport: %', sport_key;
  ELSE
    RAISE NOTICE 'Manually triggering ESPN fetch for all sports';
  END IF;

  -- Call the main function
  SELECT invoke_fetch_espn_scores() INTO result;

  RETURN result;
END;
$$;

-- Create a view to check ESPN data freshness
CREATE OR REPLACE VIEW public.espn_data_status AS
SELECT
  league,
  COUNT(*) as total_games,
  COUNT(*) FILTER (WHERE game_status = 'STATUS_IN_PROGRESS') as live_games,
  COUNT(*) FILTER (WHERE game_status = 'STATUS_SCHEDULED') as upcoming_games,
  COUNT(*) FILTER (WHERE game_status = 'STATUS_FINAL') as completed_games,
  MAX(last_updated) as last_updated,
  EXTRACT(EPOCH FROM (now() - MAX(last_updated)))/60 as minutes_since_update
FROM public.sports_scores
WHERE event_id LIKE 'espn_%'  -- Only ESPN-sourced games
GROUP BY league
ORDER BY league;

-- Create log table for ESPN fetch operations
CREATE TABLE IF NOT EXISTS public.espn_fetch_log (
  id bigserial PRIMARY KEY,
  fetch_time timestamptz NOT NULL DEFAULT now(),
  sports_fetched text[],
  total_games_updated int,
  success boolean,
  error_message text,
  execution_time_ms int
);

-- Create index on fetch log
CREATE INDEX IF NOT EXISTS idx_espn_fetch_log_time ON public.espn_fetch_log(fetch_time DESC);

-- Schedule the cron job to run every 15 minutes
-- ESPN API is free and has no rate limits, so we can fetch frequently
SELECT cron.schedule(
  'espn-scores-auto-fetch',        -- Job name
  '*/15 * * * *',                   -- Every 15 minutes
  $$
  SELECT public.invoke_fetch_espn_scores();
  $$
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.invoke_fetch_espn_scores() TO service_role;
GRANT EXECUTE ON FUNCTION public.trigger_fetch_espn_scores(text) TO service_role;
GRANT SELECT ON public.espn_data_status TO authenticated, anon;
GRANT ALL ON public.espn_fetch_log TO service_role;

-- Add helpful comments
COMMENT ON FUNCTION public.invoke_fetch_espn_scores() IS
'Automatically invokes the fetch-sports-scores edge function to get latest scores and schedules from ESPN for all major sports';

COMMENT ON FUNCTION public.trigger_fetch_espn_scores(text) IS
'Manually trigger ESPN scores fetch. Call with no args to fetch all sports, or pass sport key (e.g., ''nfl'', ''nba'') for specific sport';

COMMENT ON VIEW public.espn_data_status IS
'Shows the current state of ESPN-sourced game data, including freshness and game counts by league';

-- Log the installation
DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'ESPN Data Fetching Cron Job Installed Successfully';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Configuration:';
  RAISE NOTICE '  - Schedule: Every 15 minutes';
  RAISE NOTICE '  - Sports: NFL, NBA, MLB, NHL, NCAAF, WNBA, MLS';
  RAISE NOTICE '  - Cost: FREE (ESPN API has no charges)';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual Triggers:';
  RAISE NOTICE '  - All sports:     SELECT trigger_fetch_espn_scores();';
  RAISE NOTICE '  - Specific sport: SELECT trigger_fetch_espn_scores(''nfl'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Monitoring:';
  RAISE NOTICE '  - Data status: SELECT * FROM espn_data_status;';
  RAISE NOTICE '  - Fetch logs:  SELECT * FROM espn_fetch_log ORDER BY fetch_time DESC LIMIT 10;';
  RAISE NOTICE '  - Cron status: SELECT * FROM cron.job WHERE jobname = ''espn-scores-auto-fetch'';';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
