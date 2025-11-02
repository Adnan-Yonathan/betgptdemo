import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamTrend {
  team: string;
  league: string;
  lastGames: {
    wins: number;
    losses: number;
    record: string;
  };
  atsRecord: {
    covers: number;
    fails: number;
    pushes: number;
    record: string;
    percentage: number;
  };
  homeAway: {
    homeRecord: string;
    awayRecord: string;
  };
  recentForm: {
    lastFiveResults: string[];
    trend: 'hot' | 'cold' | 'average';
  };
  scoringTrends: {
    avgPointsScored: number;
    avgPointsAllowed: number;
    last5AvgScored: number;
    last5AvgAllowed: number;
  };
  restDays?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { team, league, limit = 10 } = await req.json();

    if (!team || !league) {
      throw new Error('team and league are required');
    }

    console.log(`[TEAM-TRENDS] Fetching trends for ${team} (${league})`);

    // Fetch recent games for this team
    const { data: recentGames, error: gamesError } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', league)
      .or(`home_team.eq.${team},away_team.eq.${team}`)
      .not('status', 'eq', 'scheduled')
      .order('date', { ascending: false })
      .limit(limit);

    if (gamesError) throw gamesError;

    if (!recentGames || recentGames.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `No recent game data found for ${team}`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Calculate W/L record
    let wins = 0;
    let losses = 0;
    let homeWins = 0;
    let homeLosses = 0;
    let awayWins = 0;
    let awayLosses = 0;

    // Calculate ATS record
    let atsCovers = 0;
    let atsFails = 0;
    let atsPushes = 0;

    // Scoring trends
    let totalPointsScored = 0;
    let totalPointsAllowed = 0;
    const lastFiveResults: string[] = [];
    const lastFiveScored: number[] = [];
    const lastFiveAllowed: number[] = [];

    for (let i = 0; i < recentGames.length; i++) {
      const game = recentGames[i];
      const isHome = game.home_team === team;
      const teamScore = isHome ? game.home_score : game.away_score;
      const opponentScore = isHome ? game.away_score : game.home_score;

      // Skip games without scores
      if (teamScore == null || opponentScore == null) continue;

      // W/L record
      const won = teamScore > opponentScore;
      if (won) {
        wins++;
        if (isHome) homeWins++;
        else awayWins++;
      } else {
        losses++;
        if (isHome) homeLosses++;
        else awayLosses++;
      }

      // Scoring
      totalPointsScored += teamScore;
      totalPointsAllowed += opponentScore;

      if (i < 5) {
        lastFiveResults.push(won ? 'W' : 'L');
        lastFiveScored.push(teamScore);
        lastFiveAllowed.push(opponentScore);
      }

      // ATS record (if spread data available)
      if (game.spread != null) {
        const spread = isHome ? game.spread : -game.spread;
        const margin = teamScore - opponentScore;
        const atsResult = margin + spread;

        if (Math.abs(atsResult) < 0.5) {
          atsPushes++;
        } else if (atsResult > 0) {
          atsCovers++;
        } else {
          atsFails++;
        }
      }
    }

    const gamesPlayed = wins + losses;
    const avgPointsScored = gamesPlayed > 0 ? totalPointsScored / gamesPlayed : 0;
    const avgPointsAllowed = gamesPlayed > 0 ? totalPointsAllowed / gamesPlayed : 0;
    const last5AvgScored = lastFiveScored.length > 0
      ? lastFiveScored.reduce((a, b) => a + b, 0) / lastFiveScored.length
      : 0;
    const last5AvgAllowed = lastFiveAllowed.length > 0
      ? lastFiveAllowed.reduce((a, b) => a + b, 0) / lastFiveAllowed.length
      : 0;

    // Determine form trend
    let trend: 'hot' | 'cold' | 'average' = 'average';
    if (lastFiveResults.length >= 3) {
      const recentWins = lastFiveResults.filter(r => r === 'W').length;
      if (recentWins >= 4) trend = 'hot';
      else if (recentWins <= 1) trend = 'cold';
    }

    // Calculate rest days (if there's an upcoming game)
    let restDays: number | undefined;
    if (recentGames.length > 0) {
      const lastGame = recentGames[0];
      const lastGameDate = new Date(lastGame.date);
      const today = new Date();
      const diffTime = today.getTime() - lastGameDate.getTime();
      restDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    const atsTotal = atsCovers + atsFails + atsPushes;
    const atsPercentage = atsTotal > 0 ? (atsCovers / atsTotal) * 100 : 0;

    const trends: TeamTrend = {
      team,
      league,
      lastGames: {
        wins,
        losses,
        record: `${wins}-${losses}`,
      },
      atsRecord: {
        covers: atsCovers,
        fails: atsFails,
        pushes: atsPushes,
        record: `${atsCovers}-${atsFails}${atsPushes > 0 ? `-${atsPushes}` : ''}`,
        percentage: atsPercentage,
      },
      homeAway: {
        homeRecord: `${homeWins}-${homeLosses}`,
        awayRecord: `${awayWins}-${awayLosses}`,
      },
      recentForm: {
        lastFiveResults,
        trend,
      },
      scoringTrends: {
        avgPointsScored: Math.round(avgPointsScored * 10) / 10,
        avgPointsAllowed: Math.round(avgPointsAllowed * 10) / 10,
        last5AvgScored: Math.round(last5AvgScored * 10) / 10,
        last5AvgAllowed: Math.round(last5AvgAllowed * 10) / 10,
      },
      restDays,
    };

    console.log(`[TEAM-TRENDS] Generated trends for ${team}: ${trends.lastGames.record} (${trend})`);

    return new Response(
      JSON.stringify({
        success: true,
        team,
        league,
        trends,
        gamesAnalyzed: gamesPlayed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[TEAM-TRENDS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
