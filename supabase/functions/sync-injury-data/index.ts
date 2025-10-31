import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Sync Injury Data Edge Function
 * Fetches injury reports from ESPN API and stores in injury_reports table
 * Run via cron or manual trigger
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[INJURY_SYNC] Starting injury data sync...');

    const leagues = ['NBA', 'NFL', 'MLB', 'NHL'];
    let totalInjuries = 0;

    for (const league of leagues) {
      try {
        const injuries = await fetchInjuriesForLeague(league);

        if (injuries.length > 0) {
          // Clear old injuries for this league (older than 24 hours)
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);

          await supabase
            .from('injury_reports')
            .delete()
            .eq('league', league)
            .lt('last_updated', yesterday.toISOString());

          // Upsert new injuries
          const { error } = await supabase
            .from('injury_reports')
            .upsert(injuries, {
              onConflict: 'league,team,player_name',
            });

          if (error) {
            console.error(`[INJURY_SYNC] Error upserting ${league} injuries:`, error);
          } else {
            console.log(`[INJURY_SYNC] Synced ${injuries.length} ${league} injuries`);
            totalInjuries += injuries.length;
          }
        }
      } catch (error) {
        console.error(`[INJURY_SYNC] Error fetching ${league} injuries:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalInjuries,
        message: `Synced ${totalInjuries} injury reports across all leagues`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[INJURY_SYNC] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function fetchInjuriesForLeague(league: string): Promise<any[]> {
  const espnLeagueMap: Record<string, string> = {
    'NBA': 'nba',
    'NFL': 'nfl',
    'MLB': 'mlb',
    'NHL': 'nhl',
  };

  // Map league to ESPN sport category
  const espnSportMap: Record<string, string> = {
    'NBA': 'basketball',
    'NFL': 'football',
    'MLB': 'baseball',
    'NHL': 'hockey',
  };

  const espnLeague = espnLeagueMap[league];
  const espnSport = espnSportMap[league];

  if (!espnLeague || !espnSport) return [];

  try {
    // ESPN Scoreboard API includes injuries
    const url = `https://site.api.espn.com/apis/site/v2/sports/${espnSport}/${espnLeague}/scoreboard`;

    console.log(`[INJURY_SYNC] Fetching ${league} injuries from ESPN (${url})...`);

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      console.error(`[INJURY_SYNC] ESPN API returned ${response.status} for ${league}`);
      return [];
    }

    const data = await response.json();
    const injuries: any[] = [];

    // Extract injuries from scoreboard data
    if (data.events) {
      for (const event of data.events) {
        const competitors = event.competitions?.[0]?.competitors || [];

        for (const competitor of competitors) {
          const team = competitor.team?.displayName || competitor.team?.name;

          if (competitor.injuries && competitor.injuries.length > 0) {
            for (const injury of competitor.injuries) {
              const impactLevel = determineImpactLevel(
                injury.status,
                injury.details?.fantasyStatus,
                competitor.team?.abbreviation
              );

              injuries.push({
                event_id: event.id,
                sport: league === 'NBA' ? 'basketball' : league.toLowerCase(),
                league: league,
                team: team,
                player_name: injury.longName || injury.athlete?.displayName,
                position: injury.position?.abbreviation,
                injury_status: injury.status, // 'Out', 'Doubtful', 'Questionable', 'Day-To-Day'
                injury_type: injury.details?.type,
                injury_description: injury.details?.detail,
                impact_level: impactLevel,
                last_updated: new Date().toISOString(),
                data_source: 'ESPN',
              });
            }
          }
        }
      }
    }

    console.log(`[INJURY_SYNC] Found ${injuries.length} injuries for ${league}`);
    return injuries;
  } catch (error) {
    console.error(`[INJURY_SYNC] Error fetching injuries for ${league}:`, error);
    return [];
  }
}

function determineImpactLevel(
  status: string,
  fantasyStatus: string | undefined,
  teamAbbr: string | undefined
): 'High' | 'Medium' | 'Low' {
  // High impact: Definite starters who are Out or Doubtful
  if (status === 'Out' || status === 'Doubtful') {
    // In real implementation, would check if player is a starter
    // For now, use fantasy status as proxy
    if (fantasyStatus && fantasyStatus.includes('Start')) {
      return 'High';
    }
    return 'Medium';
  }

  // Medium impact: Questionable starters
  if (status === 'Questionable') {
    return 'Medium';
  }

  // Low impact: Day-to-day or probable
  return 'Low';
}
