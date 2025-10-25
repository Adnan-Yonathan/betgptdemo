import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ESPNCompetitor {
  team: {
    displayName: string;
    abbreviation?: string;
  };
  score: string;
  homeAway: string;
}

interface ESPNCompetition {
  id: string;
  date: string;
  status: {
    type: {
      name: string;
      description?: string;
    };
  };
  competitors: ESPNCompetitor[];
}

interface ESPNEvent {
  id: string;
  name: string;
  shortName: string;
  competitions: ESPNCompetition[];
}

interface ESPNResponse {
  events: ESPNEvent[];
}

interface SportConfig {
  key: string;
  espnPath: string;
  sportType: string;
  league: string;
}

// Configuration for all supported sports
const SPORTS_CONFIG: SportConfig[] = [
  { key: 'nfl', espnPath: 'football/nfl', sportType: 'football', league: 'NFL' },
  { key: 'ncaaf', espnPath: 'football/college-football', sportType: 'football', league: 'NCAAF' },
  { key: 'nba', espnPath: 'basketball/nba', sportType: 'basketball', league: 'NBA' },
  { key: 'mlb', espnPath: 'baseball/mlb', sportType: 'baseball', league: 'MLB' },
  { key: 'nhl', espnPath: 'hockey/nhl', sportType: 'hockey', league: 'NHL' },
  { key: 'wnba', espnPath: 'basketball/wnba', sportType: 'basketball', league: 'WNBA' },
  { key: 'mls', espnPath: 'soccer/usa.1', sportType: 'soccer', league: 'MLS' },
];

// Helper function to fetch and update scores for a sport
async function fetchScoresForSport(
  supabaseClient: any,
  config: SportConfig
): Promise<{ sport: string; count: number; error?: string }> {
  try {
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard`;
    console.log(`Fetching scores for ${config.league} from: ${espnUrl}`);

    const response = await fetch(espnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`ESPN API error for ${config.league}: ${response.status}`);
      return { sport: config.league, count: 0, error: `HTTP ${response.status}` };
    }

    const data: ESPNResponse = await response.json();
    const events = data.events || [];

    console.log(`Found ${events.length} events for ${config.league}`);

    let updatedCount = 0;
    for (const event of events) {
      try {
        const competition = event.competitions[0];
        const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
        const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

        if (!homeTeam || !awayTeam) {
          console.warn(`Missing team data for event ${event.id}`);
          continue;
        }

        const scoreData = {
          event_id: `espn_${competition.id}`,
          sport: config.sportType,
          league: config.league,
          event_name: event.name,
          short_name: event.shortName,
          home_team: homeTeam.team.displayName,
          away_team: awayTeam.team.displayName,
          home_score: parseInt(homeTeam.score) || 0,
          away_score: parseInt(awayTeam.score) || 0,
          game_status: competition.status.type.name,
          status_description: competition.status.type.description || competition.status.type.name,
          game_date: new Date(competition.date).toISOString(),
          last_updated: new Date().toISOString(),
        };

        const { error } = await supabaseClient
          .from('sports_scores')
          .upsert(scoreData, { onConflict: 'event_id' });

        if (error) {
          console.error(`Error upserting event ${event.id}:`, error);
        } else {
          updatedCount++;
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.id}:`, eventError);
      }
    }

    console.log(`Successfully updated ${updatedCount}/${events.length} games for ${config.league}`);
    return { sport: config.league, count: updatedCount };
  } catch (error) {
    console.error(`Error fetching scores for ${config.league}:`, error);
    return {
      sport: config.league,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('=== FETCH SPORTS SCORES: Starting data refresh ===');
    const startTime = Date.now();

    // Parse request body to see if specific sports requested
    let requestedSports: string[] | null = null;
    try {
      const body = await req.json();
      if (body.sports && Array.isArray(body.sports)) {
        requestedSports = body.sports;
      }
    } catch {
      // No body or invalid JSON, fetch all sports
    }

    // Determine which sports to fetch
    const sportsToFetch = requestedSports
      ? SPORTS_CONFIG.filter(s => requestedSports.includes(s.key))
      : SPORTS_CONFIG;

    console.log(`Fetching scores for: ${sportsToFetch.map(s => s.league).join(', ')}`);

    // Fetch scores for all sports
    const results = [];
    for (const sportConfig of sportsToFetch) {
      const result = await fetchScoresForSport(supabaseClient, sportConfig);
      results.push(result);
    }

    const totalUpdated = results.reduce((sum, r) => sum + r.count, 0);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`=== FETCH SPORTS SCORES: Completed in ${duration}ms ===`);
    console.log(`Total scores updated: ${totalUpdated}`);

    return new Response(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      duration: `${duration}ms`,
      sports: results,
      totalGamesUpdated: totalUpdated,
      message: `Successfully updated ${totalUpdated} games across ${results.length} sport(s)`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-sports-scores function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
