-- Setup cron job to automatically analyze odds discrepancies every 15 minutes
-- This ensures fresh data is available for chat responses without hitting token limits

-- Create cron job to analyze odds discrepancies every 15 minutes
SELECT cron.schedule(
    'analyze-odds-discrepancies-every-15-min',
    '*/15 * * * *', -- Every 15 minutes
    $$
    SELECT net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/analyze-odds-discrepancies',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
        ),
        body := jsonb_build_object()
    ) AS request_id;
    $$
);

-- Also create a cleanup job to remove old discrepancies (older than 24 hours)
SELECT cron.schedule(
    'cleanup-old-odds-discrepancies',
    '0 */6 * * *', -- Every 6 hours
    $$
    DELETE FROM public.odds_discrepancies
    WHERE calculated_at < NOW() - INTERVAL '24 hours';
    $$
);

-- Add comment
COMMENT ON EXTENSION cron IS 'Automated odds discrepancy analysis runs every 15 minutes to keep data fresh';
