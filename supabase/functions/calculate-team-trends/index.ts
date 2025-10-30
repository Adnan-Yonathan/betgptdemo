import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calculate Team Trends Edge Function
 * Analyzes recent team performance to generate betting trends
 * - Last 10 games record
 * - Home/away splits
 * - ATS (Against The Spread) record
 * - Over/Under trends
 * - Recent form and momentum
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { team, league } = await req.json();

    if (!team) {
      return new Response(
        JSON.stringify({ error: 'team parameter is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[TRENDS] Calculating trends for ${team} in ${league}...`);

    const trends = await calculateTeamTrends(supabase, team, league || 'NBA');

    return new Response(
      JSON.stringify({
        success: true,
        team,
        league,
        trends,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TRENDS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateTeamTrends(supabase: any, team: string, league: string) {
  // Get last 20 completed games for this team
  const { data: recentGames } = await supabase
    .from('sports_scores')
    .select('*')
    .eq('league', league)
    .or(`home_team.eq.${team},away_team.eq.${team}`)
    .in('game_status', ['STATUS_FINAL', 'Final'])
    .order('game_date', { ascending: false })
    .limit(20);

  if (!recentGames || recentGames.length === 0) {
    return {
      last10Record: '0-0',
      homeRecord: '0-0',
      awayRecord: '0-0',
      atsRecord: '0-0-0',
      ouRecord: '0-0-0',
      avgPointsFor: 0,
      avgPointsAgainst: 0,
      recentForm: [],
      currentStreak: { type: 'none', count: 0 },
    };
  }

  console.log(`[TRENDS] Found ${recentGames.length} recent games for ${team}`);

  const last10Games = recentGames.slice(0, 10);
  const trends = {
    // Straight up record
    last10Record: calculateRecord(last10Games, team),
    last5Record: calculateRecord(recentGames.slice(0, 5), team),
    homeRecord: calculateRecord(recentGames.filter(g => g.home_team === team), team),
    awayRecord: calculateRecord(recentGames.filter(g => g.away_team === team), team),

    // ATS and O/U records
    atsRecord: await calculateATSRecord(supabase, recentGames, team),
    ouRecord: await calculateOURecord(supabase, recentGames, team),

    // Scoring trends
    avgPointsFor: calculateAvgPointsFor(last10Games, team),
    avgPointsAgainst: calculateAvgPointsAgainst(last10Games, team),
    avgPointDifferential: 0, // Will calculate below

    // Recent form (last 5 games: W/L)
    recentForm: last10Games.slice(0, 5).map(g => {
      const won = didTeamWin(g, team);
      return won ? 'W' : 'L';
    }),

    // Current streak
    currentStreak: calculateStreak(recentGames, team),

    // Game date of last game
    lastGameDate: recentGames[0]?.game_date,
    gamesPlayed: recentGames.length,
  };

  trends.avgPointDifferential = trends.avgPointsFor - trends.avgPointsAgainst;

  return trends;
}

function calculateRecord(games: any[], team: string): string {
  let wins = 0;
  let losses = 0;

  for (const game of games) {
    if (didTeamWin(game, team)) {
      wins++;
    } else {
      losses++;
    }
  }

  return `${wins}-${losses}`;
}

function didTeamWin(game: any, team: string): boolean {
  const isHome = game.home_team === team;
  const homeScore = game.home_score || 0;
  const awayScore = game.away_score || 0;

  if (isHome) {
    return homeScore > awayScore;
  } else {
    return awayScore > homeScore;
  }
}

async function calculateATSRecord(supabase: any, games: any[], team: string): Promise<string> {
  let wins = 0;
  let losses = 0;
  let pushes = 0;

  for (const game of games) {
    // Get the spread for this game from betting_odds
    const { data: odds } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('event_id', game.event_id)
      .eq('market_key', 'spreads')
      .limit(1)
      .single();

    if (!odds) continue;

    const isHome = game.home_team === team;
    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    const scoreDiff = homeScore - awayScore;

    // Find the spread for our team
    const spread = isHome ? (odds.outcome_point || 0) : -(odds.outcome_point || 0);

    // Did we cover?
    const adjustedDiff = scoreDiff - spread;

    if (Math.abs(adjustedDiff) < 0.5) {
      pushes++;
    } else if (adjustedDiff > 0) {
      wins++;
    } else {
      losses++;
    }
  }

  return `${wins}-${losses}-${pushes}`;
}

async function calculateOURecord(supabase: any, games: any[], team: string): Promise<string> {
  let overs = 0;
  let unders = 0;
  let pushes = 0;

  for (const game of games) {
    // Get the total for this game
    const { data: odds } = await supabase
      .from('betting_odds')
      .select('*')
      .eq('event_id', game.event_id)
      .eq('market_key', 'totals')
      .limit(1)
      .single();

    if (!odds) continue;

    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    const totalScore = homeScore + awayScore;
    const line = odds.outcome_point || 0;

    if (Math.abs(totalScore - line) < 0.5) {
      pushes++;
    } else if (totalScore > line) {
      overs++;
    } else {
      unders++;
    }
  }

  return `${overs}-${unders}-${pushes}`;
}

function calculateAvgPointsFor(games: any[], team: string): number {
  if (games.length === 0) return 0;

  let totalPoints = 0;

  for (const game of games) {
    const isHome = game.home_team === team;
    const points = isHome ? (game.home_score || 0) : (game.away_score || 0);
    totalPoints += points;
  }

  return Math.round((totalPoints / games.length) * 10) / 10;
}

function calculateAvgPointsAgainst(games: any[], team: string): number {
  if (games.length === 0) return 0;

  let totalPoints = 0;

  for (const game of games) {
    const isHome = game.home_team === team;
    const points = isHome ? (game.away_score || 0) : (game.home_score || 0);
    totalPoints += points;
  }

  return Math.round((totalPoints / games.length) * 10) / 10;
}

function calculateStreak(games: any[], team: string): { type: 'win' | 'loss' | 'none'; count: number } {
  if (games.length === 0) return { type: 'none', count: 0 };

  const firstGame = games[0];
  const firstResult = didTeamWin(firstGame, team);
  const streakType = firstResult ? 'win' : 'loss';

  let count = 0;
  for (const game of games) {
    const won = didTeamWin(game, team);
    if ((streakType === 'win' && won) || (streakType === 'loss' && !won)) {
      count++;
    } else {
      break;
    }
  }

  return { type: streakType, count };
}
