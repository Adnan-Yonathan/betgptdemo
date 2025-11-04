-- ============================================================================
-- Update invoke_fetch_betting_odds to guard against missing configuration
-- ============================================================================
-- This migration adds defensive checks so the hourly cron job logs a helpful
-- error instead of silently failing when the database settings required to
-- call the fetch-betting-odds edge function are missing.
-- ============================================================================

CREATE OR REPLACE FUNCTION invoke_fetch_betting_odds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_supabase_url TEXT;
  v_service_role_key TEXT;
  v_request_id BIGINT;
  v_sport TEXT;
  v_active_sports TEXT[];
  v_sports_fetched INTEGER := 0;
  v_missing_key_message TEXT;
BEGIN
  -- Get Supabase URL and service role key from environment
  v_supabase_url := current_setting('app.settings.supabase_url', true);
  v_service_role_key := current_setting('app.settings.service_role_key', true);

  -- Warn if Supabase URL is missing; fall back to default project URL so local
  -- testing keeps working, but nudge operators to configure the setting.
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    RAISE WARNING '[AUTO-FETCH] app.settings.supabase_url not configured; using default project URL. Please run: '
      'ALTER DATABASE postgres SET app.settings.supabase_url = ''https://<your-project>.supabase.co'';';
    v_supabase_url := 'https://dskfsnbdgyjizoaafqfk.supabase.co';
  END IF;

  -- Abort early if the service role key is missing because the edge function
  -- requires bearer authentication. Log a failure entry for observability.
  IF v_service_role_key IS NULL OR v_service_role_key = '' THEN
    v_missing_key_message := 'Missing database setting app.settings.service_role_key for invoke_fetch_betting_odds';
    RAISE WARNING '[AUTO-FETCH] %', v_missing_key_message;

    BEGIN
      INSERT INTO betting_odds_fetch_log (
        sports_fetched,
        success,
        events_count,
        odds_count,
        error_message
      ) VALUES (
        ARRAY[]::TEXT[],
        false,
        0,
        0,
        v_missing_key_message
      );
    EXCEPTION
      WHEN undefined_table THEN
        RAISE NOTICE '[AUTO-FETCH] betting_odds_fetch_log table not available to record missing key error';
    END;

    RETURN;
  END IF;

  -- Get active sports based on current season
  v_active_sports := get_active_sports_by_season();

  RAISE NOTICE '[AUTO-FETCH] Starting automated betting odds fetch for % sports',
    array_length(v_active_sports, 1);

  -- Loop through each active sport and fetch odds
  FOREACH v_sport IN ARRAY v_active_sports
  LOOP
    BEGIN
      -- Make async HTTP POST request to fetch-betting-odds edge function
      SELECT net.http_post(
        url := v_supabase_url || '/functions/v1/fetch-betting-odds',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object(
          'sport', v_sport,
          'regions', 'us',
          'markets', 'h2h,spreads,totals'
        )
      ) INTO v_request_id;

      v_sports_fetched := v_sports_fetched + 1;

      RAISE NOTICE '[AUTO-FETCH] Fetched odds for % (request ID: %)', v_sport, v_request_id;

      -- Small delay between requests to avoid overwhelming the API
      PERFORM pg_sleep(0.5);

    EXCEPTION
      WHEN OTHERS THEN
        RAISE WARNING '[AUTO-FETCH] Error fetching odds for %: %', v_sport, SQLERRM;
        -- Continue with other sports even if one fails
    END;
  END LOOP;

  RAISE NOTICE '[AUTO-FETCH] Completed: fetched % out of % sports',
    v_sports_fetched, array_length(v_active_sports, 1);

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING '[AUTO-FETCH] Fatal error in invoke_fetch_betting_odds: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION invoke_fetch_betting_odds IS
  'Invokes fetch-betting-odds edge function for all active sports based on current season (with configuration guardrails)';
