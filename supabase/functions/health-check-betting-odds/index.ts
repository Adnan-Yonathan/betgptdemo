import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Health Check Endpoint for Betting Odds Data Pipeline
 *
 * Purpose: Provides a public endpoint to diagnose betting data issues
 * Returns: Comprehensive health status of the entire pipeline
 *
 * Usage: GET https://your-project.supabase.co/functions/v1/health-check-betting-odds
 */
serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // =================================================================
    // CHECK 1: Recent Odds Data Availability
    // =================================================================
    const { data: recentOdds, error: oddsError } = await supabaseClient
      .from('betting_odds')
      .select('sport_key, last_updated, event_id, bookmaker')
      .gte('commence_time', now.toISOString())
      .order('last_updated', { ascending: false })
      .limit(1);

    const hasRecentData = recentOdds && recentOdds.length > 0;
    const newestDataTime = hasRecentData ? new Date(recentOdds[0].last_updated) : null;
    const dataAgeMinutes = newestDataTime
      ? Math.floor((now.getTime() - newestDataTime.getTime()) / 60000)
      : null;

    // =================================================================
    // CHECK 2: Odds Data Statistics
    // =================================================================
    const { data: oddsStats, error: statsError } = await supabaseClient
      .from('betting_odds')
      .select('sport_key, event_id, bookmaker, last_updated')
      .gte('commence_time', now.toISOString());

    const uniqueEvents = oddsStats ? new Set(oddsStats.map(o => o.event_id)).size : 0;
    const uniqueBookmakers = oddsStats ? new Set(oddsStats.map(o => o.bookmaker)).size : 0;
    const sportsCovered = oddsStats ? new Set(oddsStats.map(o => o.sport_key)).size : 0;

    // =================================================================
    // CHECK 3: Cron Job Status (from pg_cron)
    // =================================================================
    let cronStatus = null;
    try {
      const { data: cronData, error: cronError } = await supabaseClient
        .rpc('get_cron_job_status', { job_name_pattern: '%betting%odds%' })
        .limit(1);

      if (!cronError && cronData && cronData.length > 0) {
        cronStatus = cronData[0];
      }
    } catch (e) {
      // RPC may not exist, that's okay
      console.log('Could not fetch cron status:', e);
    }

    // =================================================================
    // CHECK 4: Recent Fetch Log Entries
    // =================================================================
    const { data: fetchLogs, error: fetchError } = await supabaseClient
      .from('betting_odds_fetch_log')
      .select('*')
      .order('fetch_time', { ascending: false })
      .limit(10);

    const lastFetch = fetchLogs && fetchLogs.length > 0 ? fetchLogs[0] : null;
    const lastFetchTime = lastFetch ? new Date(lastFetch.fetch_time) : null;
    const lastFetchAgeMinutes = lastFetchTime
      ? Math.floor((now.getTime() - lastFetchTime.getTime()) / 60000)
      : null;

    const last24hFetches = fetchLogs?.filter(f =>
      new Date(f.fetch_time).getTime() > twoHoursAgo.getTime()
    ) || [];

    const successCount = last24hFetches.filter(f => f.success === true).length;
    const failureCount = last24hFetches.filter(f => f.success === false).length;
    const recentErrors = last24hFetches
      .filter(f => f.success === false && f.error_message)
      .map(f => ({
        time: f.fetch_time,
        sports: f.sports_fetched,
        error: f.error_message
      }));

    // =================================================================
    // CHECK 5: API Key Configuration (cannot directly check, infer from logs)
    // =================================================================
    const hasApiKeyError = recentErrors.some(e =>
      e.error?.includes('API key') ||
      e.error?.includes('not configured') ||
      e.error?.includes('authentication')
    );

    // =================================================================
    // HEALTH ASSESSMENT
    // =================================================================

    const issues: string[] = [];
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Data Freshness Issues
    if (!hasRecentData) {
      issues.push('CRITICAL: No betting odds data found for upcoming games');
      recommendations.push('Check if API keys are configured in Supabase Dashboard → Settings → Edge Functions → Secrets');
      recommendations.push('Verify API keys: THE_ODDS_API_KEY or X_RAPID_APIKEY');
    } else if (dataAgeMinutes && dataAgeMinutes > 120) {
      issues.push(`CRITICAL: Betting data is too stale (${dataAgeMinutes} minutes / ${Math.floor(dataAgeMinutes / 60)} hours old)`);
      recommendations.push('Data refresh system is not working - investigate cron job or fetch function errors');
    } else if (dataAgeMinutes && dataAgeMinutes > 60) {
      warnings.push(`WARNING: Betting data is stale (${dataAgeMinutes} minutes old)`);
      recommendations.push('Data should refresh every 30 minutes - check recent fetch logs for errors');
    } else if (dataAgeMinutes && dataAgeMinutes > 30) {
      warnings.push(`Data is moderately stale (${dataAgeMinutes} minutes old)`);
    }

    // Cron Job Issues
    if (lastFetchAgeMinutes === null) {
      issues.push('CRITICAL: No fetch logs found - cron job may never have run');
      recommendations.push('Verify cron job is scheduled: SELECT * FROM cron.job WHERE jobname LIKE \'%betting%odds%\'');
      recommendations.push('Check if pg_cron extension is enabled');
    } else if (lastFetchAgeMinutes > 60) {
      issues.push(`CRITICAL: Last fetch was ${lastFetchAgeMinutes} minutes ago (expected every 30 minutes)`);
      recommendations.push('Cron job is not running - check database logs or contact support');
    } else if (lastFetchAgeMinutes > 45) {
      warnings.push(`Last fetch was ${lastFetchAgeMinutes} minutes ago (expected every 30 minutes)`);
    }

    // Fetch Success Rate Issues
    if (failureCount > successCount && failureCount > 0) {
      issues.push(`CRITICAL: More failures (${failureCount}) than successes (${successCount}) in recent fetches`);
      if (recentErrors.length > 0) {
        recommendations.push(`Most recent error: ${recentErrors[0].error}`);
      }
    } else if (failureCount > 2) {
      warnings.push(`${failureCount} fetch failures in last 2 hours`);
    }

    // API Key Issues
    if (hasApiKeyError) {
      issues.push('CRITICAL: API key configuration error detected in logs');
      recommendations.push('Set THE_ODDS_API_KEY or X_RAPID_APIKEY in Supabase secrets');
      recommendations.push('Get keys from: https://the-odds-api.com/ or RapidAPI');
    }

    // Empty Database
    if (uniqueEvents === 0) {
      issues.push('CRITICAL: No upcoming games found in database');
      recommendations.push('This could be normal during off-season, or indicate a data pipeline failure');
      recommendations.push('Try manual trigger: SELECT trigger_fetch_betting_odds();');
    }

    // Overall Status
    let overallStatus: 'healthy' | 'degraded' | 'critical';
    if (issues.length > 0) {
      overallStatus = 'critical';
    } else if (warnings.length > 0) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    // =================================================================
    // RESPONSE
    // =================================================================

    const healthReport = {
      status: overallStatus,
      timestamp: now.toISOString(),
      summary: {
        canProvideBettingRecommendations: overallStatus === 'healthy' && dataAgeMinutes !== null && dataAgeMinutes < 60,
        dataFreshness: dataAgeMinutes ? `${dataAgeMinutes} minutes old` : 'No data',
        eventsAvailable: uniqueEvents,
        bookmakersAvailable: uniqueBookmakers,
        sportsCovered: sportsCovered,
      },
      dataHealth: {
        hasRecentData,
        newestDataTime: newestDataTime?.toISOString() || null,
        dataAgeMinutes,
        totalOddsEntries: oddsStats?.length || 0,
        uniqueEvents,
        uniqueBookmakers,
        sportsCovered,
      },
      fetchHealth: {
        lastFetchTime: lastFetchTime?.toISOString() || null,
        lastFetchAgeMinutes,
        lastFetchSuccess: lastFetch?.success || null,
        last2hSuccesses: successCount,
        last2hFailures: failureCount,
        successRate: last24hFetches.length > 0
          ? Math.round((successCount / last24hFetches.length) * 100)
          : null,
      },
      cronHealth: {
        status: cronStatus?.active ? 'active' : 'unknown',
        schedule: cronStatus?.schedule || 'unknown',
        lastRun: cronStatus?.last_run_start || null,
      },
      issues,
      warnings,
      recommendations,
      recentErrors: recentErrors.slice(0, 3), // Only show last 3 errors
      diagnosticLinks: {
        fetchLogs: 'SELECT * FROM betting_odds_fetch_log ORDER BY fetch_time DESC LIMIT 10;',
        cronJobs: 'SELECT * FROM cron.job WHERE jobname LIKE \'%betting%odds%\';',
        dataFreshness: 'SELECT sport_key, MAX(last_updated) as last_update FROM betting_odds GROUP BY sport_key;',
      }
    };

    return new Response(JSON.stringify(healthReport, null, 2), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health check error:', error);

    return new Response(JSON.stringify({
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
