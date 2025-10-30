import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RundownTeam {
  team_id: number;
  team_normalized_id?: number;
  name: string;
  mascot?: string;
  abbreviation?: string;
  is_home: boolean;
  is_away: boolean;
}

interface RundownScore {
  event_status: string;
  event_status_detail?: string;
  score_home?: number;
  score_away?: number;
  period?: string;
  clock?: string;
  team_stats?: any[];
  player_stats?: any[];
}

interface RundownEvent {
  event_id: string;
  event_uuid: string;
  sport_id: number;
  sport_name?: string;
  event_date: string;
  teams_normalized?: RundownTeam[];
  teams?: RundownTeam[];
  score?: RundownScore;
}

interface SportConfig {
  key: string;
  sportId: number;
  sportType: string;
  league: string;
}

const RUNDOWN_HOST = 'therundown-therundown-v1.p.rapidapi.com';
const BASE_URL = `https://${RUNDOWN_HOST}`;

// Configuration for all supported sports (The Rundown API sport IDs)
const SPORTS_CONFIG: SportConfig[] = [
  { key: 'nfl', sportId: 2, sportType: 'football', league: 'NFL' },
  { key: 'ncaaf', sportId: 9, sportType: 'football', league: 'NCAAF' },
  { key: 'nba', sportId: 4, sportType: 'basketball', league: 'NBA' },
  { key: 'mlb', sportId: 3, sportType: 'baseball', league: 'MLB' },
  { key: 'nhl', sportId: 1, sportType: 'hockey', league: 'NHL' },
  { key: 'wnba', sportId: 12, sportType: 'basketball', league: 'WNBA' },
  { key: 'mls', sportId: 10, sportType: 'soccer', league: 'MLS' },
];

function mapTeams(event: RundownEvent): { home: string; away: string } {
  const teams = event.teams_normalized || event.teams || [];
  const homeTeam = teams.find(team => team.is_home);
  const awayTeam = teams.find(team => team.is_away);

  return {
    home: homeTeam?.name || homeTeam?.mascot || 'Home Team',
    away: awayTeam?.name || awayTeam?.mascot || 'Away Team',
  };
}

function extractAdvancedStats(score?: RundownScore): Record<string, unknown> | null {
  if (!score) return null;

  const stats: Record<string, unknown> = {};

  if (score.team_stats && Array.isArray(score.team_stats) && score.team_stats.length > 0) {
    stats.team_stats = score.team_stats;
  }

  if (score.player_stats && Array.isArray(score.player_stats) && score.player_stats.length > 0) {
    stats.player_stats = score.player_stats;
  }

  if (score.period) {
    stats.period = score.period;
  }

  if (score.clock) {
    stats.clock = score.clock;
  }

  return Object.keys(stats).length > 0 ? stats : null;
}

// Helper function to fetch and update scores for a sport using The Rundown API
async function fetchScoresForSport(
  supabaseClient: any,
  config: SportConfig,
  rundownApiKey: string,
  targetDate: string
): Promise<{ sport: string; count: number; error?: string }> {
  try {
    const rundownUrl = `${BASE_URL}/sports/${config.sportId}/events/${targetDate}`;
    console.log(`Fetching scores for ${config.league} from The Rundown API: ${rundownUrl}`);

    const response = await fetch(rundownUrl, {
      headers: {
        'X-RapidAPI-Key': rundownApiKey,
        'X-RapidAPI-Host': RUNDOWN_HOST,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`The Rundown API error for ${config.league}: ${response.status} - ${errorText}`);
      return { sport: config.league, count: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const events: RundownEvent[] = data.events || [];

    console.log(`Found ${events.length} events for ${config.league}`);

    let updatedCount = 0;
    for (const event of events) {
      try {
        const { home, away } = mapTeams(event);
        const score = event.score || {};

        const scoreData = {
          event_id: event.event_uuid || event.event_id,
          sport: config.sportType,
          league: config.league,
          event_name: `${away} @ ${home}`,
          short_name: `${away} @ ${home}`,
          home_team: home,
          away_team: away,
          home_score: score.score_home ?? 0,
          away_score: score.score_away ?? 0,
          game_status: score.event_status || 'STATUS_SCHEDULED',
          status_description: score.event_status_detail || score.event_status || 'Scheduled',
          game_date: event.event_date,
          last_updated: new Date().toISOString(),
          advanced_stats: extractAdvancedStats(score),
        };

        const { error } = await supabaseClient
          .from('sports_scores')
          .upsert(scoreData, { onConflict: 'event_id' });

        if (error) {
          console.error(`Error upserting event ${event.event_id}:`, error);
        } else {
          updatedCount++;
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.event_id}:`, eventError);
      }
    }

    console.log(`Successfully updated ${updatedCount}/${events.length} games for ${config.league}`);
    return { sport: config.league, count: updatedCount };
  } catch (error) {
    console.error(`Error fetching scores for ${config.league}:`, error);
    return {
      sport: config.league,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
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

    const rundownApiKey = Deno.env.get('THE_RUNDOWN_API');

    if (!rundownApiKey) {
      throw new Error('THE_RUNDOWN_API key not configured');
    }

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

    const targetDate = new Date().toISOString().split('T')[0];

    console.log(`Fetching scores for: ${sportsToFetch.map(s => s.league).join(', ')}`);

    // Fetch scores for all sports
    const results = [];
    for (const sportConfig of sportsToFetch) {
      const result = await fetchScoresForSport(supabaseClient, sportConfig, rundownApiKey, targetDate);
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
