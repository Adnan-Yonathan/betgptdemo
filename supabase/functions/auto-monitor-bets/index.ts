import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ESPNCompetitor {
  team: {
    displayName: string;
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
    };
  };
  competitors: ESPNCompetitor[];
}

interface ESPNEvent {
  id: string;
  competitions: ESPNCompetition[];
}

interface ESPNResponse {
  events: ESPNEvent[];
}

// Helper function to fetch and update scores for a league
async function fetchScoresForLeague(supabaseClient: any, league: string) {
  try {
    const espnUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/${league}/scoreboard`;
    console.log(`Fetching scores for ${league.toUpperCase()} from: ${espnUrl}`);

    const response = await fetch(espnUrl);

    if (!response.ok) {
      console.error(`ESPN API error for ${league}: ${response.status}`);
      return { league, count: 0, error: `HTTP ${response.status}` };
    }

    const data: ESPNResponse = await response.json();
    const events = data.events || [];

    console.log(`Found ${events.length} events for ${league.toUpperCase()}`);

    let updatedCount = 0;
    for (const event of events) {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      if (!homeTeam || !awayTeam) continue;

      const scoreData = {
        event_id: competition.id,
        sport: 'football',
        league: league.toUpperCase(),
        home_team: homeTeam.team.displayName,
        away_team: awayTeam.team.displayName,
        home_score: parseInt(homeTeam.score) || 0,
        away_score: parseInt(awayTeam.score) || 0,
        game_status: competition.status.type.name,
        game_date: new Date(competition.date).toISOString(),
        last_updated: new Date().toISOString(),
      };

      const { error } = await supabaseClient
        .from('sports_scores')
        .upsert(scoreData, { onConflict: 'event_id' });

      if (!error) {
        updatedCount++;
      }
    }

    console.log(`Successfully updated ${updatedCount} games for ${league.toUpperCase()}`);
    return { league, count: updatedCount };
  } catch (error) {
    console.error(`Error fetching scores for ${league}:`, error);
    return { league, count: 0, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to settle a bet
async function settleBet(
  supabaseClient: any,
  betId: string,
  outcome: string,
  actualReturn: number
) {
  try {
    const { data, error } = await supabaseClient
      .from('bets')
      .update({
        outcome,
        actual_return: actualReturn,
        settled_at: new Date().toISOString(),
      })
      .eq('id', betId)
      .select()
      .single();

    if (error) {
      console.error(`Error settling bet ${betId}:`, error);
      return { success: false, error: error.message };
    }

    console.log(`✓ Bet ${betId} settled: ${outcome.toUpperCase()}`);
    console.log(`  Amount: $${data.amount}, Return: $${actualReturn}`);

    return { success: true, data };
  } catch (error) {
    console.error(`Exception in settleBet for bet ${betId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function to settle pending bets
async function settlePendingBets(supabaseClient: any) {
  try {
    console.log('Starting bet settlement process...');

    const { data: pendingBets, error: betsError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('outcome', 'pending')
      .not('event_id', 'is', null);

    if (betsError) {
      console.error('Error fetching pending bets:', betsError);
      return { settledCount: 0, error: 'Failed to fetch bets' };
    }

    if (!pendingBets || pendingBets.length === 0) {
      console.log('No pending bets to settle');
      return { settledCount: 0 };
    }

    console.log(`Found ${pendingBets.length} pending bets to check`);

    const settledBets = [];

    for (const bet of pendingBets) {
      const { data: game, error: gameError } = await supabaseClient
        .from('sports_scores')
        .select('*')
        .eq('event_id', bet.event_id)
        .single();

      if (gameError || !game) {
        continue;
      }

      // Only settle if game is final
      if (game.game_status !== 'STATUS_FINAL') {
        continue;
      }

      console.log(`Game is final: ${game.home_team} ${game.home_score} - ${game.away_team} ${game.away_score}`);

      // Determine winner
      let didWin = false;
      const homeWon = game.home_score > game.away_score;
      const awayWon = game.away_score > game.home_score;
      const tie = game.home_score === game.away_score;

      if (bet.team_bet_on) {
        const betOnHome = game.home_team.toLowerCase().includes(bet.team_bet_on.toLowerCase()) ||
                         bet.team_bet_on.toLowerCase().includes(game.home_team.toLowerCase());
        const betOnAway = game.away_team.toLowerCase().includes(bet.team_bet_on.toLowerCase()) ||
                         bet.team_bet_on.toLowerCase().includes(game.away_team.toLowerCase());

        if (betOnHome && homeWon) didWin = true;
        if (betOnAway && awayWon) didWin = true;
      }

      const outcome = tie ? 'push' : (didWin ? 'win' : 'loss');
      const actualReturn = outcome === 'win' ? bet.potential_return : (outcome === 'push' ? bet.amount : 0);

      console.log(`Settling bet ${bet.id}: ${outcome} (actual return: ${actualReturn})`);

      // Settle bet
      const settlementResult = await settleBet(
        supabaseClient,
        bet.id,
        outcome,
        actualReturn
      );

      if (settlementResult.success) {
        settledBets.push({
          betId: bet.id,
          outcome,
          actualReturn,
          details: settlementResult.data
        });
      } else {
        console.error(`Failed to settle bet ${bet.id}: ${settlementResult.error}`);
      }
    }

    console.log(`Settlement complete. Settled ${settledBets.length} bets.`);
    return { settledCount: settledBets.length, bets: settledBets };
  } catch (error) {
    console.error('Error in settlePendingBets:', error);
    return { settledCount: 0, error: error instanceof Error ? error.message : 'Unknown error' };
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

    console.log('=== AUTO MONITOR BETS: Starting live score and bet settlement process ===');
    const startTime = Date.now();

    // Step 1: Fetch live scores for all supported leagues
    const leagues = ['nfl', 'college-football']; // Add more as needed
    const scoreResults = [];

    for (const league of leagues) {
      const result = await fetchScoresForLeague(supabaseClient, league);
      scoreResults.push(result);
    }

    const totalScoresUpdated = scoreResults.reduce((sum, r) => sum + r.count, 0);
    console.log(`Total scores updated across all leagues: ${totalScoresUpdated}`);

    // Step 2: Settle pending bets based on updated scores
    const settlementResult = await settlePendingBets(supabaseClient);

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`=== AUTO MONITOR BETS: Process completed in ${duration}ms ===`);

    return new Response(JSON.stringify({
      success: true,
      duration: `${duration}ms`,
      scores: {
        leagues: scoreResults,
        totalUpdated: totalScoresUpdated,
      },
      settlement: {
        settledCount: settlementResult.settledCount,
        bets: settlementResult.bets || [],
      },
      message: `Updated ${totalScoresUpdated} scores and settled ${settlementResult.settledCount} bet(s)`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in auto-monitor-bets function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
