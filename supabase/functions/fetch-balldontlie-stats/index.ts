import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const BALLDONTLIE_API_KEY = Deno.env.get('BALLDONTLIE_API_KEY') || Deno.env.get('BALLDONTLIE_API');
const BASE_URL = 'https://api.balldontlie.io/v1';

// ============================================================================
// TYPES
// ============================================================================

interface BallDontLieTeam {
  id: number;
  full_name: string;
  abbreviation: string;
  city: string;
  conference: string;
  division: string;
}

interface BallDontLiePlayer {
  id: number;
  first_name: string;
  last_name: string;
  position: string;
  team: BallDontLieTeam;
}

interface BallDontLieGame {
  id: number;
  date: string;
  season: number;
  status: string;
  home_team: BallDontLieTeam;
  visitor_team: BallDontLieTeam;
  home_team_score: number;
  visitor_team_score: number;
}

interface BallDontLieStats {
  id: number;
  min: string;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  pf: number;
  pts: number;
  player: BallDontLiePlayer;
  team: BallDontLieTeam;
  game: BallDontLieGame;
}

// ============================================================================
// BALLDONTLIE API CLIENT
// ============================================================================

async function fetchFromBallDontLie(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  console.log(`[BALLDONTLIE] Fetching: ${endpoint}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': BALLDONTLIE_API_KEY!,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BALLDONTLIE API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ============================================================================
// DATA STORAGE
// ============================================================================

async function storePlayerStats(
  supabase: any,
  stats: BallDontLieStats[],
  gameDate: string
): Promise<number> {
  let storedCount = 0;

  for (const stat of stats) {
    // Determine opponent and home/away
    const playerTeamId = stat.team.id;
    const isHome = stat.game.home_team.id === playerTeamId;
    const opponent = isHome ? stat.game.visitor_team.full_name : stat.game.home_team.full_name;
    const homeAway = isHome ? 'home' : 'away';

    const performanceData = {
      player_name: `${stat.player.first_name} ${stat.player.last_name}`,
      team: stat.team.full_name,
      sport: 'basketball',
      league: 'NBA',
      game_date: gameDate,
      opponent: opponent,
      home_away: homeAway,
      stats: {
        points: stat.pts,
        rebounds: stat.reb,
        assists: stat.ast,
        steals: stat.stl,
        blocks: stat.blk,
        turnovers: stat.turnover,
        fieldGoalsMade: stat.fgm,
        fieldGoalsAttempted: stat.fga,
        threePointsMade: stat.fg3m,
        threePointsAttempted: stat.fg3a,
        freeThrowsMade: stat.ftm,
        freeThrowsAttempted: stat.fta,
        minutes: stat.min,
      },
      points: stat.pts,
      minutes_played: stat.min,
      data_source: 'balldontlie',
    };

    try {
      const { error } = await supabase
        .from('player_performance_history')
        .upsert(performanceData, {
          onConflict: 'player_name,game_date,team',
        });

      if (error) {
        console.error(`Error storing stats for ${performanceData.player_name}:`, error);
      } else {
        storedCount++;
      }
    } catch (error) {
      console.error(`Exception storing stats for ${performanceData.player_name}:`, error);
    }
  }

  return storedCount;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { game_id, date, store_data = true } = await req.json();

    if (!game_id && !date) {
      return new Response(
        JSON.stringify({
          error: 'Either game_id or date is required',
          success: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`[BALLDONTLIE] Fetching stats - game_id: ${game_id}, date: ${date}`);

    // Fetch stats from BALLDONTLIE
    let statsData;

    if (game_id) {
      // Fetch stats for specific game
      statsData = await fetchFromBallDontLie('/stats', {
        game_ids: [parseInt(game_id)],
        per_page: 100,
      });
    } else if (date) {
      // Fetch stats for specific date
      statsData = await fetchFromBallDontLie('/stats', {
        dates: [date],
        per_page: 100,
      });
    }

    const stats: BallDontLieStats[] = statsData.data || [];

    console.log(`[BALLDONTLIE] Retrieved ${stats.length} player stats`);

    // Store in database if requested
    let storedCount = 0;
    if (store_data && stats.length > 0) {
      const targetDate = date || stats[0]?.game.date || new Date().toISOString();
      storedCount = await storePlayerStats(supabase, stats, targetDate);
      console.log(`[BALLDONTLIE] Stored ${storedCount} player stats`);
    }

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        game_id: game_id || null,
        date: date || null,
        stats_count: stats.length,
        stored_count: storedCount,
        source: 'BALLDONTLIE',
        players: stats.map(s => ({
          name: `${s.player.first_name} ${s.player.last_name}`,
          team: s.team.full_name,
          stats: {
            pts: s.pts,
            reb: s.reb,
            ast: s.ast,
            stl: s.stl,
            blk: s.blk,
            min: s.min,
          },
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[BALLDONTLIE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
        source: 'BALLDONTLIE',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
