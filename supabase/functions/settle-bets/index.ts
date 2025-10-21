import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to update user's bankroll for a specific bet settlement
async function updateUserBankroll(supabaseClient: any, userId: string, outcome: string, amount: number, actualReturn: number) {
  try {
    // Get user's current bankroll from profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('bankroll')
      .eq('id', userId)
      .single();

    if (!profile) {
      console.error(`Profile not found for user ${userId}`);
      return;
    }

    const currentBankroll = Number(profile.bankroll || 1000);
    let newBankroll = currentBankroll;

    // Update bankroll based on bet outcome
    if (outcome === 'win') {
      newBankroll = currentBankroll + actualReturn;
    } else if (outcome === 'loss') {
      newBankroll = currentBankroll - amount;
    }
    // For 'push', bankroll stays the same

    // Update profile with new bankroll
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ bankroll: newBankroll })
      .eq('id', userId);

    if (updateError) {
      console.error(`Error updating bankroll for user ${userId}:`, updateError);
    } else {
      console.log(`Updated bankroll for user ${userId}: $${currentBankroll.toFixed(2)} -> $${newBankroll.toFixed(2)} (${outcome})`);
    }
  } catch (error) {
    console.error(`Error in updateUserBankroll for user ${userId}:`, error);
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

      // Update bet
      const { error: updateError } = await supabaseClient
        .from('bets')
        .update({
          outcome,
          actual_return: actualReturn,
          settled_at: new Date().toISOString(),
        })
        .eq('id', bet.id);

      if (updateError) {
        console.error(`Error updating bet ${bet.id}:`, updateError);
      } else {
        settledBets.push({ betId: bet.id, outcome, actualReturn });

        // Update user's bankroll in profile
        await updateUserBankroll(supabaseClient, bet.user_id, outcome, bet.amount, actualReturn);
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
