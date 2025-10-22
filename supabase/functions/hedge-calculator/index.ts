import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculate optimal hedge bet size to guarantee profit or minimize loss
 * @param originalStake - Original bet stake
 * @param originalOdds - Original bet odds (American)
 * @param hedgeOdds - Current hedge bet odds (American)
 * @param strategy - 'guaranteed_profit' or 'minimize_loss'
 */
function calculateHedge(
  originalStake: number,
  originalOdds: number,
  hedgeOdds: number,
  strategy: 'guaranteed_profit' | 'minimize_loss' | 'maximize_profit'
) {
  // Convert American odds to decimal
  const originalDecimal = originalOdds > 0
    ? (originalOdds / 100) + 1
    : (100 / Math.abs(originalOdds)) + 1;

  const hedgeDecimal = hedgeOdds > 0
    ? (hedgeOdds / 100) + 1
    : (100 / Math.abs(hedgeOdds)) + 1;

  // Calculate potential win from original bet
  const originalPotentialWin = originalStake * originalDecimal;

  // Calculate optimal hedge stake based on strategy
  let hedgeStake = 0;
  let profitIfOriginalWins = 0;
  let profitIfHedgeWins = 0;

  if (strategy === 'guaranteed_profit') {
    // Hedge to guarantee same profit regardless of outcome
    // Formula: hedge_stake = (original_win / hedge_decimal)
    hedgeStake = originalPotentialWin / hedgeDecimal;

    profitIfOriginalWins = originalPotentialWin - originalStake - hedgeStake;
    profitIfHedgeWins = (hedgeStake * hedgeDecimal) - originalStake - hedgeStake;
  } else if (strategy === 'minimize_loss') {
    // Hedge to break even if original bet loses
    // hedge_stake such that hedge_win = original_stake
    hedgeStake = originalStake / (hedgeDecimal - 1);

    profitIfOriginalWins = originalPotentialWin - originalStake - hedgeStake;
    profitIfHedgeWins = (hedgeStake * hedgeDecimal) - originalStake - hedgeStake;
  } else if (strategy === 'maximize_profit') {
    // Partial hedge to maximize worst-case profit
    // This finds the balance point
    hedgeStake = (originalPotentialWin - originalStake) / hedgeDecimal;

    profitIfOriginalWins = originalPotentialWin - originalStake - hedgeStake;
    profitIfHedgeWins = (hedgeStake * hedgeDecimal) - originalStake - hedgeStake;
  }

  return {
    hedgeStake: Math.round(hedgeStake * 100) / 100,
    profitIfOriginalWins: Math.round(profitIfOriginalWins * 100) / 100,
    profitIfHedgeWins: Math.round(profitIfHedgeWins * 100) / 100,
    guaranteedProfit: Math.round(Math.min(profitIfOriginalWins, profitIfHedgeWins) * 100) / 100,
    totalExposure: originalStake + hedgeStake,
    hedgePotentialReturn: Math.round(hedgeStake * hedgeDecimal * 100) / 100,
  };
}

/**
 * Calculate arbitrage opportunity across two bets
 */
function calculateArbitrage(
  odds1: number,
  odds2: number,
  totalStake: number
) {
  const decimal1 = odds1 > 0 ? (odds1 / 100) + 1 : (100 / Math.abs(odds1)) + 1;
  const decimal2 = odds2 > 0 ? (odds2 / 100) + 1 : (100 / Math.abs(odds2)) + 1;

  // Arbitrage exists if 1/decimal1 + 1/decimal2 < 1
  const arbPercentage = (1 / decimal1) + (1 / decimal2);

  if (arbPercentage >= 1) {
    return {
      hasArbitrage: false,
      arbPercentage: arbPercentage * 100,
    };
  }

  // Calculate optimal stake distribution
  const stake1 = totalStake / (1 + (decimal2 / decimal1));
  const stake2 = totalStake - stake1;

  const profit1 = (stake1 * decimal1) - totalStake;
  const profit2 = (stake2 * decimal2) - totalStake;

  return {
    hasArbitrage: true,
    arbPercentage: arbPercentage * 100,
    stake1: Math.round(stake1 * 100) / 100,
    stake2: Math.round(stake2 * 100) / 100,
    guaranteedProfit: Math.round(Math.min(profit1, profit2) * 100) / 100,
    profitPercentage: (Math.min(profit1, profit2) / totalStake) * 100,
  };
}

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
      hedgeOdds,
      strategy = 'guaranteed_profit',
      checkArbitrage = false
    } = await req.json();

    console.log('=== HEDGE CALCULATOR CALLED ===');
    console.log('Bet ID:', betId);
    console.log('Hedge odds:', hedgeOdds);
    console.log('Strategy:', strategy);

    // Get original bet details
    const { data: bet, error: betError } = await supabaseClient
      .from('bets')
      .select('*')
      .eq('id', betId)
      .eq('user_id', user.id)
      .single();

    if (betError || !bet) {
      return new Response(JSON.stringify({
        error: 'Bet not found or unauthorized'
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (bet.outcome !== 'pending') {
      return new Response(JSON.stringify({
        error: 'Cannot hedge a settled bet'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate hedge
    const hedge = calculateHedge(
      bet.amount,
      bet.odds,
      hedgeOdds,
      strategy
    );

    // Check for arbitrage if requested
    let arbitrage = null;
    if (checkArbitrage) {
      arbitrage = calculateArbitrage(bet.odds, hedgeOdds, bet.amount);
    }

    // Build statistical reasoning
    const reasoning = {
      summary: hedge.guaranteedProfit > 0
        ? `Hedging guarantees a profit of $${hedge.guaranteedProfit.toFixed(2)} regardless of outcome`
        : `Hedging will result in a loss of $${Math.abs(hedge.guaranteedProfit).toFixed(2)}`,
      originalBet: {
        stake: bet.amount,
        odds: bet.odds,
        potentialWin: bet.potential_return,
        potentialProfit: bet.potential_return - bet.amount,
        description: bet.description,
      },
      hedgeDetails: {
        recommendedStake: hedge.hedgeStake,
        odds: hedgeOdds,
        potentialReturn: hedge.hedgePotentialReturn,
      },
      outcomes: {
        ifOriginalWins: {
          profit: hedge.profitIfOriginalWins,
          calculation: `Win $${bet.potential_return} - $${bet.amount} stake - $${hedge.hedgeStake} hedge = $${hedge.profitIfOriginalWins}`,
        },
        ifHedgeWins: {
          profit: hedge.profitIfHedgeWins,
          calculation: `Win $${hedge.hedgePotentialReturn} - $${bet.amount} stake - $${hedge.hedgeStake} hedge = $${hedge.profitIfHedgeWins}`,
        },
      },
      statistics: {
        totalExposure: hedge.totalExposure,
        guaranteedProfit: hedge.guaranteedProfit,
        roiOnTotalExposure: (hedge.guaranteedProfit / hedge.totalExposure) * 100,
        roiOnOriginalStake: (hedge.guaranteedProfit / bet.amount) * 100,
      },
      recommendation: hedge.guaranteedProfit > (bet.amount * 0.05)
        ? 'HEDGE RECOMMENDED: You can lock in a solid profit'
        : hedge.guaranteedProfit > 0
          ? 'HEDGE POSSIBLE: Small guaranteed profit available'
          : 'HEDGE NOT RECOMMENDED: Would result in guaranteed loss. Let original bet ride or consider partial hedge.',
    };

    const response: any = {
      success: true,
      hedge: hedge,
      arbitrage: arbitrage,
      reasoning: reasoning,
      shouldHedge: hedge.guaranteedProfit > 0,
    };

    console.log('Hedge calculation complete:', response);

    // If user wants to place the hedge, create it
    if (req.method === 'POST' && hedgeOdds) {
      const { data: hedgeBet, error: hedgeError } = await supabaseClient
        .from('bets')
        .insert({
          user_id: user.id,
          amount: hedge.hedgeStake,
          odds: hedgeOdds,
          description: `Hedge for bet: ${bet.description}`,
          potential_return: hedge.hedgePotentialReturn,
          outcome: 'pending',
          bet_type: 'straight',
          is_hedge: true,
          hedge_target_id: betId,
        })
        .select()
        .single();

      if (!hedgeError) {
        response.hedgeBetId = hedgeBet.id;
        response.message = 'Hedge bet created successfully';
      }
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in hedge-calculator function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
