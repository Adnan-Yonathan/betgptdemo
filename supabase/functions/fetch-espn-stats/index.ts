import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNDOWN_HOST = 'therundown-therundown-v1.p.rapidapi.com';
const BASE_URL = `https://${RUNDOWN_HOST}`;

type JsonRecord = Record<string, unknown>;

interface RundownTeamInfo {
  team_id: number;
  name?: string;
  mascot?: string;
  abbreviation?: string;
  is_home: boolean;
  is_away: boolean;
}

interface RundownBoxScoreTeam {
  team_id: number;
  is_home: boolean;
  statistics?: JsonRecord;
  totals?: JsonRecord;
}

interface RundownBoxScorePlayer {
  player_id: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team_id?: number;
  position?: string;
  starter?: boolean;
  statistics?: JsonRecord;
  totals?: JsonRecord;
}

interface RundownBoxScoreResponse {
  event_id: string;
  event_date: string;
  teams?: RundownTeamInfo[];
  team_stats?: RundownBoxScoreTeam[];
  player_stats?: RundownBoxScorePlayer[];
  score?: {
    event_status: string;
    score_home?: number;
    score_away?: number;
  };
}

interface GamePlayerStats {
  name: string;
  team: string;
  position: string;
  stats: JsonRecord;
  starter: boolean;
}

interface GameData {
  event_id: string;
  game_date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  players: GamePlayerStats[];
}

function resolveTeamName(team?: RundownTeamInfo): string {
  if (!team) return '';
  return team.name || team.mascot || team.abbreviation || '';
}

function buildGameData(boxScore: RundownBoxScoreResponse): GameData {
  const teams = boxScore.teams || [];
  const homeTeamInfo = teams.find(team => team.is_home);
  const awayTeamInfo = teams.find(team => team.is_away);

  const teamMap = new Map<number, string>();
  teams.forEach(team => {
    teamMap.set(team.team_id, resolveTeamName(team));
  });

  const players: GamePlayerStats[] = (boxScore.player_stats || []).map(player => {
    const name = player.full_name || `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim();
    const teamName = player.team_id ? (teamMap.get(player.team_id) || `${player.team_id}`) : '';
    const stats = player.statistics || player.totals || {};

    return {
      name,
      team: teamName,
      position: player.position || '',
      stats,
      starter: Boolean(player.starter),
    };
  });

  const score: any = boxScore.score || {};

  return {
    event_id: boxScore.event_id,
    game_date: boxScore.event_date || new Date().toISOString(),
    home_team: resolveTeamName(homeTeamInfo),
    away_team: resolveTeamName(awayTeamInfo),
    home_score: score.score_home ?? 0,
    away_score: score.score_away ?? 0,
    status: score.event_status || 'Unknown',
    players,
  };
}

async function fetchRundownBoxScore(eventId: string, rundownApiKey: string): Promise<RundownBoxScoreResponse> {
  if (!eventId) {
    throw new Error('event_id is required');
  }

  const url = `${BASE_URL}/events/${eventId}/boxscore`;
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': rundownApiKey,
      'X-RapidAPI-Host': RUNDOWN_HOST,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`The Rundown API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

async function storePlayerStats(
  supabase: any,
  gameData: GameData
): Promise<number> {
  let storedCount = 0;

  for (const player of gameData.players) {
    const stats = player.stats || {};
    const performanceData = {
      player_name: player.name,
      team: player.team,
      sport: 'basketball',
      league: 'NBA',
      game_date: gameData.game_date,
      opponent: player.team === gameData.home_team ? gameData.away_team : gameData.home_team,
      home_away: player.team === gameData.home_team ? 'home' : 'away',
      stats,
      points: Number(stats.points ?? stats.PTS ?? 0),
      minutes_played: String(stats.minutes ?? stats.MIN ?? '0:00'),
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
    const rundownApiKey = Deno.env.get('THE_RUNDOWN_API');

    if (!rundownApiKey) {
      throw new Error('THE_RUNDOWN_API key is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const {
      event_id,
      store_data = false,
    } = await req.json();

    if (!event_id) {
      throw new Error('event_id is required');
    }

    console.log(`Fetching The Rundown boxscore for event ${event_id}`);

    const boxScore = await fetchRundownBoxScore(event_id, rundownApiKey);
    const gameData = buildGameData(boxScore);

    console.log(`Parsed ${gameData.players.length} player entries`);

    let storedCount = 0;
    if (store_data) {
      storedCount = await storePlayerStats(supabase, gameData);
      console.log(`Stored ${storedCount} player stats in database`);
    }

    return new Response(JSON.stringify({
      success: true,
      event_id,
      stored_count: storedCount,
      game: gameData,
      source: 'The Rundown API',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching Rundown stats:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
