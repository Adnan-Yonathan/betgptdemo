import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to settle a bet atomically (updates bet, bankroll, and CRM in one transaction)
async function settleBetAtomic(
  supabaseClient: any,
  betId: string,
  outcome: string,
  actualReturn: number,
  closingLine: number | null,
  clv: number | null
) {
  try {
    const { data, error } = await supabaseClient.rpc('settle_bet_atomic', {
      p_bet_id: betId,
      p_outcome: outcome,
      p_actual_return: actualReturn,
      p_closing_line: closingLine,
      p_clv: clv,
    });

    if (error) {
      console.error(`Error settling bet ${betId} atomically:`, error);
      return { success: false, error: error.message };
    }

    if (!data || data.length === 0) {
      console.error(`No data returned from settle_bet_atomic for bet ${betId}`);
      return { success: false, error: 'No data returned' };
    }

    const result = data[0];

    if (!result.success) {
      console.error(`Failed to settle bet ${betId}: ${result.message}`);
      return { success: false, error: result.message };
    }

    // Log success with details
    const betData = result.bet_data;
    const bankrollData = result.bankroll_data;

    console.log(`✓ Bet ${betId} settled: ${outcome.toUpperCase()}`);
    console.log(`  Amount: $${betData.amount}, Return: $${betData.actual_return}, Profit: $${betData.profit}`);
    console.log(`  Bankroll: $${bankrollData.previous_bankroll} → $${bankrollData.new_bankroll} (${bankrollData.change >= 0 ? '+' : ''}$${bankrollData.change})`);
    if (clv !== null) {
      console.log(`  CLV: ${clv > 0 ? '+' : ''}${clv}%`);
    }

    return { success: true, data: result };
  } catch (error) {
    console.error(`Exception in settleBetAtomic for bet ${betId}:`, error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

    console.log('Starting bet settlement process...');

    // Get all pending bets with event IDs
    const { data: pendingBets, error: betsError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('outcome', 'pending')
      .not('event_id', 'is', null);

    if (betsError) {
      console.error('Error fetching pending bets:', betsError);
      return new Response(JSON.stringify({ error: 'Failed to fetch bets' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pendingBets || pendingBets.length === 0) {
      console.log('No pending bets to settle');
      return new Response(JSON.stringify({ 
        settledCount: 0, 
        message: 'No pending bets to settle' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${pendingBets.length} pending bets to check`);

    const settledBets = [];

    // Check each bet
    for (const bet of pendingBets) {
      console.log(`Checking bet ${bet.id} for event ${bet.event_id}`);

      // Get game info
      const { data: game, error: gameError } = await supabaseClient
        .from('sports_scores')
        .select('*')
        .eq('event_id', bet.event_id)
        .single();

      if (gameError || !game) {
        console.log(`Game not found for event ${bet.event_id}`);
        continue;
      }

      // Only settle if game is final
      if (game.game_status !== 'STATUS_FINAL') {
        console.log(`Game ${game.event_id} not final yet (${game.game_status})`);
        continue;
      }

      console.log(`Game is final: ${game.home_team} ${game.home_score} - ${game.away_team} ${game.away_score}`);

      // Determine outcome based on market type
      let outcome: string;
      let actualReturn: number;

      const homeScore = game.home_score || 0;
      const awayScore = game.away_score || 0;
      const totalScore = homeScore + awayScore;

      // Identify which team the user bet on
      const betOnHome = bet.team_bet_on && (
        game.home_team.toLowerCase().includes(bet.team_bet_on.toLowerCase()) ||
        bet.team_bet_on.toLowerCase().includes(game.home_team.toLowerCase())
      );
      const betOnAway = bet.team_bet_on && (
        game.away_team.toLowerCase().includes(bet.team_bet_on.toLowerCase()) ||
        bet.team_bet_on.toLowerCase().includes(game.away_team.toLowerCase())
      );

      // Determine market type (default to moneyline if not specified)
      const marketKey = bet.market_key || 'h2h';

      if (marketKey === 'h2h') {
        // MONEYLINE: Simple win/loss based on who won the game
        const homeWon = homeScore > awayScore;
        const awayWon = awayScore > homeScore;
        const tie = homeScore === awayScore;

        if (tie) {
          outcome = 'push';
          actualReturn = bet.amount;
        } else if ((betOnHome && homeWon) || (betOnAway && awayWon)) {
          outcome = 'win';
          actualReturn = bet.potential_return;
        } else {
          outcome = 'loss';
          actualReturn = 0;
        }

      } else if (marketKey === 'spreads') {
        // SPREAD: Check if team covered the spread
        // Spread is stored in opening_line (e.g., -7.5 means team needs to win by 8+)
        const spread = bet.opening_line || 0;

        let teamScore: number;
        let opponentScore: number;

        if (betOnHome) {
          teamScore = homeScore;
          opponentScore = awayScore;
        } else if (betOnAway) {
          teamScore = awayScore;
          opponentScore = homeScore;
        } else {
          console.error(`Cannot determine which team was bet on for spread bet ${bet.id}`);
          continue;
        }

        // Calculate if they covered
        // If spread is -7.5, team must win by 8+ points
        // If spread is +7.5, team can lose by up to 7 points
        const scoreDifferential = teamScore - opponentScore;
        const adjustedDifferential = scoreDifferential - spread;

        if (Math.abs(adjustedDifferential) < 0.01) {
          // Exact push (e.g., -7 spread and won by exactly 7)
          outcome = 'push';
          actualReturn = bet.amount;
        } else if (adjustedDifferential > 0) {
          // Covered the spread
          outcome = 'win';
          actualReturn = bet.potential_return;
        } else {
          // Did not cover
          outcome = 'loss';
          actualReturn = 0;
        }

      } else if (marketKey === 'totals') {
        // TOTALS (Over/Under): Check if combined score went over or under the line
        const line = bet.opening_line || 0;

        // Determine if bet was over or under based on description
        const isOverBet = bet.description.toLowerCase().includes('over') ||
                         bet.description.toLowerCase().includes('o ');
        const isUnderBet = bet.description.toLowerCase().includes('under') ||
                          bet.description.toLowerCase().includes('u ');

        if (Math.abs(totalScore - line) < 0.01) {
          // Exact push
          outcome = 'push';
          actualReturn = bet.amount;
        } else if (isOverBet && totalScore > line) {
          outcome = 'win';
          actualReturn = bet.potential_return;
        } else if (isUnderBet && totalScore < line) {
          outcome = 'win';
          actualReturn = bet.potential_return;
        } else {
          outcome = 'loss';
          actualReturn = 0;
        }

      } else {
        // Unknown market type - fallback to moneyline logic
        console.warn(`Unknown market type "${marketKey}" for bet ${bet.id}, using moneyline logic`);
        const homeWon = homeScore > awayScore;
        const awayWon = awayScore > homeScore;
        const tie = homeScore === awayScore;

        if (tie) {
          outcome = 'push';
          actualReturn = bet.amount;
        } else if ((betOnHome && homeWon) || (betOnAway && awayWon)) {
          outcome = 'win';
          actualReturn = bet.potential_return;
        } else {
          outcome = 'loss';
          actualReturn = 0;
        }
      }

      console.log(`Settling bet ${bet.id}: ${outcome} (actual return: ${actualReturn})`);

      // Calculate CLV (Closing Line Value) if we have opening_line
      let closingLine = null;
      let clv = null;

      if (bet.opening_line && bet.team_bet_on && bet.market_key) {
        // Get the most recent (closing) line before game started
        const { data: closingOdds } = await supabaseClient
          .from('betting_odds')
          .select('outcome_price')
          .eq('event_id', bet.event_id)
          .eq('outcome_name', bet.team_bet_on)
          .eq('market_key', bet.market_key)
          .lte('last_updated', game.game_date) // Before game started
          .order('last_updated', { ascending: false })
          .limit(1)
          .single();

        if (closingOdds) {
          closingLine = closingOdds.outcome_price;

          // Calculate CLV using the database function
          const { data: clvResult } = await supabaseClient
            .rpc('calculate_clv', {
              bet_odds: bet.odds,
              closing_odds: closingLine
            });

          clv = clvResult;

          console.log(`CLV for bet ${bet.id}: ${clv}% (bet at ${bet.odds}, closed at ${closingLine})`);
        }
      }

      // Settle bet atomically (updates bet, bankroll, and CRM in one transaction)
      const settlementResult = await settleBetAtomic(
        supabaseClient,
        bet.id,
        outcome,
        actualReturn,
        closingLine,
        clv
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

    return new Response(JSON.stringify({ 
      settledCount: settledBets.length,
      bets: settledBets,
      message: `Successfully settled ${settledBets.length} bet(s)`,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in settle-bets function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
