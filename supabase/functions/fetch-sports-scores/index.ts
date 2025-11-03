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

const BALLDONTLIE_BASE_URL = 'https://api.balldontlie.io/v1';

// Ball Don't Lie API only supports NBA
const SPORTS_CONFIG: SportConfig[] = [
  { key: 'nba', sportId: 4, sportType: 'basketball', league: 'NBA' },
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

// Helper function to fetch and update scores for NBA using Ball Don't Lie API
async function fetchScoresForSport(
  supabaseClient: any,
  config: SportConfig,
  ballDontLieApiKey: string,
  targetDate: string
): Promise<{ sport: string; count: number; error?: string }> {
  try {
    const ballDontLieUrl = `${BALLDONTLIE_BASE_URL}/games?dates[]=${targetDate}&per_page=100`;
    console.log(`Fetching scores for ${config.league} from Ball Don't Lie API: ${ballDontLieUrl}`);

    const response = await fetch(ballDontLieUrl, {
      headers: {
        'Authorization': ballDontLieApiKey,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Ball Don't Lie API error for ${config.league}: ${response.status} - ${errorText}`);
      return { sport: config.league, count: 0, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const games = data.data || [];

    console.log(`Found ${games.length} games for ${config.league}`);

    let updatedCount = 0;
    for (const game of games) {
      try {
        const homeTeam = game.home_team?.full_name || game.home_team?.name || 'Home Team';
        const awayTeam = game.visitor_team?.full_name || game.visitor_team?.name || 'Away Team';
        
        const status = game.status?.toLowerCase() || 'scheduled';
        let gameStatus = 'STATUS_SCHEDULED';
        if (status.includes('final') || status === 'f') {
          gameStatus = 'STATUS_FINAL';
        } else if (status.includes('in progress') || status === 'live') {
          gameStatus = 'STATUS_IN_PROGRESS';
        }

        const scoreData = {
          event_id: String(game.id),
          sport: config.sportType,
          league: config.league,
          event_name: `${awayTeam} @ ${homeTeam}`,
          short_name: `${awayTeam} @ ${homeTeam}`,
          home_team: homeTeam,
          away_team: awayTeam,
          home_score: game.home_team_score ?? 0,
          away_score: game.visitor_team_score ?? 0,
          game_status: gameStatus,
          status_description: game.status || 'Scheduled',
          game_date: game.date,
          last_updated: new Date().toISOString(),
          advanced_stats: null,
        };

        const { error } = await supabaseClient
          .from('sports_scores')
          .upsert(scoreData, { onConflict: 'event_id' });

        if (error) {
          console.error(`Error upserting game ${game.id}:`, error);
        } else {
          updatedCount++;
        }
      } catch (gameError) {
        console.error(`Error processing game ${game.id}:`, gameError);
      }
    }

    console.log(`Successfully updated ${updatedCount}/${games.length} games for ${config.league}`);
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

    const ballDontLieApiKey = Deno.env.get('BALLDONTLIE_API') || Deno.env.get('BALL_DONT_LIE_API');

    if (!ballDontLieApiKey) {
      throw new Error('BALLDONTLIE_API key not configured');
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

    // Fetch scores for all sports (currently only NBA from Ball Don't Lie)
    const results = [];
    for (const sportConfig of sportsToFetch) {
      const result = await fetchScoresForSport(supabaseClient, sportConfig, ballDontLieApiKey, targetDate);
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
