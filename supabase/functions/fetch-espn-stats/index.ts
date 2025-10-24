import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ESPNPlayerStats {
  name: string;
  team: string;
  position: string;
  stats: {
    points?: number;
    rebounds?: number;
    assists?: number;
    steals?: number;
    blocks?: number;
    turnovers?: number;
    fieldGoalsMade?: number;
    fieldGoalsAttempted?: number;
    threePointsMade?: number;
    threePointsAttempted?: number;
    freeThrowsMade?: number;
    freeThrowsAttempted?: number;
    minutes?: string;
    plusMinus?: string;
  };
  starter: boolean;
}

interface ESPNGameData {
  event_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  players: ESPNPlayerStats[];
}

/**
 * Parses ESPN API response and extracts player statistics
 */
function parseESPNResponse(data: any): ESPNGameData {
  const header = data.header || {};
  const boxScore = data.boxscore || {};
  const players: ESPNPlayerStats[] = [];

  // Extract game info
  const gameInfo = {
    event_id: header.id || data.gameId || '',
    game_date: header.competitions?.[0]?.date || new Date().toISOString(),
    home_team: '',
    away_team: '',
    home_score: 0,
    away_score: 0,
    status: header.competitions?.[0]?.status?.type?.description || 'Unknown',
  };

  // Extract teams and scores
  const competitions = header.competitions?.[0] || {};
  const competitors = competitions.competitors || [];

  competitors.forEach((team: any) => {
    if (team.homeAway === 'home') {
      gameInfo.home_team = team.team?.displayName || team.team?.name || '';
      gameInfo.home_score = parseInt(team.score) || 0;
    } else {
      gameInfo.away_team = team.team?.displayName || team.team?.name || '';
      gameInfo.away_score = parseInt(team.score) || 0;
    }
  });

  // Parse box score for player statistics
  if (boxScore.players) {
    boxScore.players.forEach((teamData: any) => {
      const teamName = teamData.team?.displayName || teamData.team?.name || '';
      const statistics = teamData.statistics || [];

      // Get stat labels (e.g., MIN, FG, 3PT, FT, REB, AST, etc.)
      const statLabels = statistics.map((stat: any) => stat.name || stat.abbreviation || '');

      // Process each player
      (teamData.statistics?.[0]?.athletes || []).forEach((athlete: any, index: number) => {
        const playerStats: any = {};

        // Map stats to our schema
        statistics.forEach((stat: any, statIndex: number) => {
          const label = stat.name || stat.abbreviation || '';
          const value = stat.athletes?.[index]?.value || '0';

          // Map ESPN stat names to our schema
          switch (label.toUpperCase()) {
            case 'MIN':
              playerStats.minutes = value;
              break;
            case 'FG':
              const fg = value.split('-');
              playerStats.fieldGoalsMade = parseInt(fg[0]) || 0;
              playerStats.fieldGoalsAttempted = parseInt(fg[1]) || 0;
              break;
            case '3PT':
              const three = value.split('-');
              playerStats.threePointsMade = parseInt(three[0]) || 0;
              playerStats.threePointsAttempted = parseInt(three[1]) || 0;
              break;
            case 'FT':
              const ft = value.split('-');
              playerStats.freeThrowsMade = parseInt(ft[0]) || 0;
              playerStats.freeThrowsAttempted = parseInt(ft[1]) || 0;
              break;
            case 'OREB':
            case 'DREB':
            case 'REB':
              playerStats.rebounds = (playerStats.rebounds || 0) + (parseInt(value) || 0);
              break;
            case 'AST':
              playerStats.assists = parseInt(value) || 0;
              break;
            case 'STL':
              playerStats.steals = parseInt(value) || 0;
              break;
            case 'BLK':
              playerStats.blocks = parseInt(value) || 0;
              break;
            case 'TO':
              playerStats.turnovers = parseInt(value) || 0;
              break;
            case 'PTS':
              playerStats.points = parseInt(value) || 0;
              break;
            case '+/-':
              playerStats.plusMinus = value;
              break;
          }
        });

        players.push({
          name: athlete.athlete?.displayName || athlete.athlete?.name || '',
          team: teamName,
          position: athlete.athlete?.position?.abbreviation || '',
          stats: playerStats,
          starter: athlete.starter || false,
        });
      });
    });
  }

  return {
    ...gameInfo,
    players,
  };
}

/**
 * Stores player statistics in the player_performance_history table
 */
async function storePlayerStats(
  supabase: any,
  gameData: ESPNGameData
): Promise<number> {
  let storedCount = 0;

  for (const player of gameData.players) {
    const performanceData = {
      player_name: player.name,
      team: player.team,
      sport: 'basketball',
      league: 'NBA',
      game_date: gameData.game_date,
      opponent: player.team === gameData.home_team ? gameData.away_team : gameData.home_team,
      home_away: player.team === gameData.home_team ? 'home' : 'away',
      stats: player.stats,
      points: player.stats.points || 0,
      minutes_played: player.stats.minutes || '0:00',
    };

    const { error } = await supabase
      .from('player_performance_history')
      .upsert(performanceData, {
        onConflict: 'player_name,game_date,team',
      });

    if (error) {
      console.error(`Error storing stats for ${player.name}:`, error);
    } else {
      storedCount++;
    }
  }

  return storedCount;
}

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
    const { event_id, store_data = true } = await req.json();

    if (!event_id) {
      return new Response(
        JSON.stringify({
          error: 'event_id is required',
          success: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`Fetching ESPN data for event ${event_id}...`);

    // Fetch from ESPN API
    const espnUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/summary?region=us&lang=en&contentorigin=espn&event=${event_id}`;

    const espnResponse = await fetch(espnUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!espnResponse.ok) {
      throw new Error(`ESPN API error: ${espnResponse.status}`);
    }

    const espnData = await espnResponse.json();
    const parsedGameData = parseESPNResponse(espnData);

    console.log(`Parsed data for ${parsedGameData.players.length} players`);

    // Store player statistics if requested
    let storedCount = 0;
    if (store_data) {
      storedCount = await storePlayerStats(supabase, parsedGameData);
      console.log(`Stored stats for ${storedCount} players`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        event_id: parsedGameData.event_id,
        game_date: parsedGameData.game_date,
        home_team: parsedGameData.home_team,
        away_team: parsedGameData.away_team,
        home_score: parsedGameData.home_score,
        away_score: parsedGameData.away_score,
        status: parsedGameData.status,
        players_count: parsedGameData.players.length,
        stored_count: storedCount,
        players: parsedGameData.players,
        source: 'ESPN',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching ESPN stats:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
