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
