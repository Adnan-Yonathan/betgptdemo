// PHASE 3: Manual Bet Settlement Edge Function for UI
// Allows users to settle bets via UI buttons or direct API calls

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const {
      betId,
      outcome,
      actualReturn
    } = await req.json();

    console.log('=== MANUAL BET SETTLEMENT ===');
    console.log('User ID:', user.id);
    console.log('Bet ID:', betId);
    console.log('Outcome:', outcome);
    console.log('Actual Return:', actualReturn);

    // Validate required fields
    if (!betId || !outcome) {
      console.error('❌ Missing required fields');
      return new Response(JSON.stringify({
        error: 'Missing required fields: betId, outcome'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate outcome
    if (!['win', 'loss', 'push'].includes(outcome)) {
      return new Response(JSON.stringify({
        error: 'Invalid outcome. Must be: win, loss, or push'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify bet belongs to this user
    const { data: bet, error: betError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('id', betId)
      .eq('user_id', user.id)
      .single();

    if (betError || !bet) {
      console.error('❌ Bet not found or does not belong to user:', betError);
      return new Response(JSON.stringify({
        error: 'Bet not found or access denied'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if bet is already settled
    if (bet.outcome !== 'pending') {
      return new Response(JSON.stringify({
        error: `Bet already settled with outcome: ${bet.outcome}`,
        bet: bet
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate actual return if not provided
    let calculatedReturn = actualReturn;
    if (calculatedReturn === undefined || calculatedReturn === null) {
      if (outcome === 'win') {
        // Calculate based on American odds
        if (bet.odds > 0) {
          calculatedReturn = bet.amount + (bet.amount * (bet.odds / 100));
        } else {
          calculatedReturn = bet.amount + (bet.amount * (100 / Math.abs(bet.odds)));
        }
      } else if (outcome === 'push') {
        calculatedReturn = bet.amount;
      } else {
        calculatedReturn = 0;
      }
    }

    console.log(`✅ Calculated return: $${calculatedReturn}`);

    // Use atomic settlement function
    const { data: settlement, error: settlementError } = await supabaseClient
      .rpc('settle_bet_atomic', {
        p_bet_id: betId,
        p_outcome: outcome,
        p_actual_return: calculatedReturn,
        p_closing_line: null,
        p_clv: null
      });

    if (settlementError) {
      console.error('❌ Error in atomic settlement:', settlementError);
      return new Response(JSON.stringify({
        error: 'Failed to settle bet',
        details: settlementError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settlement || settlement.length === 0 || !settlement[0].success) {
      console.error('❌ Settlement failed:', settlement);
      return new Response(JSON.stringify({
        error: settlement?.[0]?.message || 'Settlement failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = settlement[0];
    console.log('✅ Bet settled successfully!');

    // Fetch updated profile stats
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('bankroll, baseline_bankroll, total_bets_placed, total_bets_won, total_bets_lost, win_rate, roi, total_profit')
      .eq('id', user.id)
      .single();

    const percentChange = profile?.baseline_bankroll > 0
      ? ((profile.bankroll - profile.baseline_bankroll) / profile.baseline_bankroll * 100)
      : 0;

    return new Response(JSON.stringify({
      success: true,
      message: `Bet settled as ${outcome}`,
      bet: {
        id: betId,
        description: bet.description,
        amount: bet.amount,
        odds: bet.odds,
        outcome: outcome,
      },
      settlement: {
        profit: result.bet_data.profit,
        actual_return: calculatedReturn,
      },
      bankroll: {
        previous: result.bankroll_data.previous_bankroll,
        new: result.bankroll_data.new_bankroll,
        change: result.bankroll_data.change,
        percent_change: percentChange,
      },
      stats: {
        total_bets: profile?.total_bets_placed || 0,
        wins: profile?.total_bets_won || 0,
        losses: profile?.total_bets_lost || 0,
        win_rate: profile?.win_rate || 0,
        roi: profile?.roi || 0,
        total_profit: profile?.total_profit || 0,
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in settle-bet-manual function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
