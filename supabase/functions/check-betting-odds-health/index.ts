import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // Check for recent odds data across all sports
    const { data: recentOdds, error: oddsError } = await supabaseClient
      .from('betting_odds')
      .select('sport_key, sport_title, last_updated')
      .gte('last_updated', twoHoursAgo.toISOString())
      .order('last_updated', { ascending: false })
      .limit(10);

    if (oddsError) {
      console.error('Error querying betting_odds:', oddsError);
    }

    // Get most recent update per sport
    const sportUpdates = new Map<string, { lastUpdate: Date; ageMinutes: number }>();
    if (recentOdds && recentOdds.length > 0) {
      for (const odd of recentOdds) {
        if (!sportUpdates.has(odd.sport_key)) {
          const lastUpdate = new Date(odd.last_updated);
          const ageMinutes = Math.floor((now.getTime() - lastUpdate.getTime()) / 60000);
          sportUpdates.set(odd.sport_key, {
            lastUpdate,
            ageMinutes
          });
        }
      }
    }

    // Check cron job execution history
    const { data: cronStatus, error: cronError } = await supabaseClient
      .from('betting_odds_fetch_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    if (cronError) {
      console.error('Error querying betting_odds_fetch_log:', cronError);
    }

    const lastFetch = cronStatus && cronStatus.length > 0 ? cronStatus[0] : null;
    const lastFetchAge = lastFetch
      ? Math.floor((now.getTime() - new Date(lastFetch.created_at).getTime()) / 60000)
      : null;

    // Count recent failures
    const recentFailures = cronStatus?.filter(log =>
      log.success === false &&
      new Date(log.created_at) > oneHourAgo
    ).length ?? 0;

    // Determine overall system health
    let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if we have recent data
    const hasVeryRecentData = Array.from(sportUpdates.values()).some(s => s.ageMinutes < 30);
    const hasRecentData = Array.from(sportUpdates.values()).some(s => s.ageMinutes < 60);

    if (!hasVeryRecentData && !hasRecentData) {
      status = 'critical';
      errors.push('No betting odds data in database from the last hour');
    } else if (!hasVeryRecentData) {
      status = 'degraded';
      warnings.push('Betting odds data is moderately stale (30-60 minutes old)');
    }

    // Check cron job health
    if (lastFetchAge === null || lastFetchAge > 45) {
      status = status === 'critical' ? 'critical' : 'degraded';
      warnings.push(`Cron job may not be running (last fetch: ${lastFetchAge ? `${lastFetchAge} min ago` : 'never'})`);
    }

    if (lastFetch?.success === false) {
      status = status === 'critical' ? 'critical' : 'degraded';
      errors.push(`Last automated fetch failed${lastFetch.error_message ? `: ${lastFetch.error_message}` : ''}`);
    }

    if (recentFailures > 2) {
      status = 'critical';
      errors.push(`Multiple recent fetch failures (${recentFailures} in last hour)`);
    }

    // Check API key configuration
    const hasApiKey = Deno.env.get('THE_RUNDOWN_API') != null;
    if (!hasApiKey) {
      status = 'critical';
      errors.push('THE_RUNDOWN_API key not configured in environment');
    }

    // Build sports status
    const sportsStatus = Array.from(sportUpdates.entries()).map(([key, value]) => ({
      sport: key,
      lastUpdated: value.lastUpdate.toISOString(),
      ageMinutes: value.ageMinutes,
      status: value.ageMinutes < 30 ? 'fresh' : value.ageMinutes < 60 ? 'recent' : 'stale'
    }));

    const health = {
      status,
      timestamp: now.toISOString(),
      hasRecentData,
      hasApiKey,
      sports: sportsStatus,
      cronJob: {
        lastFetchTime: lastFetch?.created_at ?? null,
        lastFetchAgeMinutes: lastFetchAge,
        lastFetchSuccess: lastFetch?.success ?? null,
        lastFetchEventsCount: lastFetch?.events_count ?? null,
        lastFetchOddsCount: lastFetch?.odds_count ?? null,
        recentFailures
      },
      warnings,
      errors
    };

    const statusCode = status === 'critical' ? 503 : status === 'degraded' ? 200 : 200;

    return new Response(JSON.stringify(health, null, 2), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Health check error:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
