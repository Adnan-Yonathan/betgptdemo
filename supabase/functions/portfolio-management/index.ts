import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case 'calculate_exposure':
        return await calculateExposure(supabase, user.id);

      case 'detect_correlations':
        return await detectCorrelations(supabase, user.id, params.newBetId);

      case 'calculate_kelly':
        return await calculateKelly(supabase, user.id, params);

      case 'get_portfolio_summary':
        return await getPortfolioSummary(supabase, user.id);

      case 'check_risk_limits':
        return await checkRiskLimits(supabase, user.id, params.betAmount);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: any) {
    console.error('Error in portfolio-management:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function calculateExposure(supabase: any, userId: string) {
  // Get user's active bets (not yet settled)
  const { data: activeBets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .is('outcome', null);

  if (!activeBets || activeBets.length === 0) {
    return new Response(
      JSON.stringify({
        totalRisked: 0,
        totalPotentialWin: 0,
        activeBetsCount: 0,
        exposureBySport: {},
        exposureByMarket: {},
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Calculate exposure metrics
  const totalRisked = activeBets.reduce((sum: number, bet: any) => sum + bet.amount, 0);
  const totalPotentialWin = activeBets.reduce((sum: number, bet: any) => {
    const odds = bet.odds;
    const payout = odds > 0 ? bet.amount * (odds / 100) : bet.amount * (100 / Math.abs(odds));
    return sum + payout;
  }, 0);

  // Group by sport
  const exposureBySport: { [key: string]: number } = {};
  for (const bet of activeBets) {
    const sport = bet.sport || 'Unknown';
    exposureBySport[sport] = (exposureBySport[sport] || 0) + bet.amount;
  }

  // Group by market type
  const exposureByMarket: { [key: string]: number } = {};
  for (const bet of activeBets) {
    const market = bet.market_key || bet.bet_type || 'Unknown';
    exposureByMarket[market] = (exposureByMarket[market] || 0) + bet.amount;
  }

  // Calculate portfolio correlation score
  const correlationScore = await calculatePortfolioCorrelation(supabase, activeBets);

  // Update daily exposure
  await supabase.from('daily_risk_exposure').upsert({
    user_id: userId,
    date: new Date().toISOString().split('T')[0],
    total_amount_risked: totalRisked,
    total_potential_win: totalPotentialWin,
    total_potential_loss: totalRisked,
    active_bets_count: activeBets.length,
    active_bets_ids: activeBets.map((b: any) => b.id),
    exposure_by_sport: exposureBySport,
    exposure_by_market: exposureByMarket,
    portfolio_correlation_score: correlationScore,
    high_correlation_warning: correlationScore > 0.5,
  }, {
    onConflict: 'user_id,date',
  });

  return new Response(
    JSON.stringify({
      totalRisked,
      totalPotentialWin,
      activeBetsCount: activeBets.length,
      exposureBySport,
      exposureByMarket,
      correlationScore,
      highCorrelationWarning: correlationScore > 0.5,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function calculatePortfolioCorrelation(supabase: any, activeBets: any[]) {
  if (activeBets.length < 2) return 0;

  let totalCorrelation = 0;
  let pairCount = 0;

  // Check all pairs of bets
  for (let i = 0; i < activeBets.length; i++) {
    for (let j = i + 1; j < activeBets.length; j++) {
      const correlation = estimateBetCorrelation(activeBets[i], activeBets[j]);
      totalCorrelation += correlation;
      pairCount++;
    }
  }

  return pairCount > 0 ? totalCorrelation / pairCount : 0;
}

function estimateBetCorrelation(bet1: any, bet2: any): number {
  // Same game = very high correlation
  if (bet1.event_id === bet2.event_id) {
    return 0.9;
  }

  // Same team on same day = high correlation
  if (bet1.sport === bet2.sport) {
    const team1 = [bet1.home_team, bet1.away_team];
    const team2 = [bet2.home_team, bet2.away_team];

    const hasCommonTeam = team1.some((t: string) => team2.includes(t));
    if (hasCommonTeam) {
      return 0.7;
    }
  }

  // Same sport on same day = moderate correlation
  if (bet1.sport === bet2.sport) {
    const date1 = new Date(bet1.created_at).toDateString();
    const date2 = new Date(bet2.created_at).toDateString();

    if (date1 === date2) {
      return 0.3;
    }
  }

  // Different sports = low correlation
  return 0.1;
}

async function detectCorrelations(supabase: any, userId: string, newBetId?: string) {
  // Get active bets
  const { data: activeBets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .is('outcome', null);

  if (!activeBets || activeBets.length < 2) {
    return new Response(
      JSON.stringify({ warnings: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const warnings = [];

  // Check all pairs
  for (let i = 0; i < activeBets.length; i++) {
    for (let j = i + 1; j < activeBets.length; j++) {
      const bet1 = activeBets[i];
      const bet2 = activeBets[j];

      const correlation = estimateBetCorrelation(bet1, bet2);

      if (correlation >= 0.5) {
        const correlationType = correlation >= 0.9 ? 'same_game' :
                                correlation >= 0.7 ? 'same_team' :
                                'division_rival';

        const severity = correlation >= 0.8 ? 'high' :
                        correlation >= 0.6 ? 'medium' : 'low';

        const warning = {
          bet_id_1: bet1.id,
          bet_id_2: bet2.id,
          user_id: userId,
          correlation_type: correlationType,
          correlation_coefficient: correlation,
          severity,
        };

        warnings.push(warning);

        // Store warning in database
        await supabase.from('bet_correlation_warnings').upsert(warning, {
          onConflict: 'bet_id_1,bet_id_2',
        });
      }
    }
  }

  return new Response(
    JSON.stringify({ warnings }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function calculateKelly(supabase: any, userId: string, params: any) {
  const { winProbability, odds, edgePercentage, eventId, marketKey } = params;

  // Get user's bankroll
  const { data: bankroll } = await supabase
    .from('user_bankroll')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!bankroll) {
    throw new Error('User bankroll not found');
  }

  const currentBankroll = bankroll.current_amount;
  const kellyMultiplier = bankroll.kelly_multiplier || 0.25;

  // Convert odds to decimal
  const decimalOdds = odds > 0 ? 1 + (odds / 100) : 1 + (100 / Math.abs(odds));

  // Kelly formula: f = (bp - q) / b
  // f = fraction of bankroll to bet
  // b = decimal odds - 1
  // p = win probability
  // q = lose probability (1 - p)

  const b = decimalOdds - 1;
  const p = winProbability / 100;
  const q = 1 - p;

  const fullKelly = (b * p - q) / b;
  const fractionalKelly = fullKelly * kellyMultiplier;

  // Calculate recommended stake
  const fullKellyStake = Math.max(0, currentBankroll * fullKelly);
  const recommendedStake = Math.max(0, currentBankroll * fractionalKelly);

  // Calculate expected value
  const expectedValue = (p * (decimalOdds - 1) - q) * 100;

  // Calculate risk of ruin (simplified)
  const variance = p * Math.pow(decimalOdds - 1, 2) + q * Math.pow(-1, 2);
  const riskOfRuin = Math.exp(-2 * fullKelly * currentBankroll / Math.sqrt(variance));

  const recommendation = {
    user_id: userId,
    event_id: eventId,
    market_key: marketKey,
    odds,
    win_probability: winProbability,
    bankroll: currentBankroll,
    edge_percentage: edgePercentage,
    full_kelly_stake: Math.round(fullKellyStake * 100) / 100,
    fractional_kelly_stake: Math.round(recommendedStake * 100) / 100,
    kelly_multiplier: kellyMultiplier,
    recommended_stake: Math.round(recommendedStake * 100) / 100,
    variance: Math.round(variance * 100) / 100,
    risk_of_ruin: Math.round(riskOfRuin * 10000) / 10000,
  };

  // Store recommendation
  await supabase.from('kelly_recommendations').insert(recommendation);

  return new Response(
    JSON.stringify(recommendation),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function getPortfolioSummary(supabase: any, userId: string) {
  // Get bankroll
  const { data: bankroll } = await supabase
    .from('user_bankroll')
    .select('*')
    .eq('user_id', userId)
    .single();

  // Get active bets
  const { data: activeBets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .is('outcome', null);

  // Get today's exposure
  const { data: todayExposure } = await supabase
    .from('daily_risk_exposure')
    .select('*')
    .eq('user_id', userId)
    .eq('date', new Date().toISOString().split('T')[0])
    .single();

  // Get pending correlation warnings
  const { data: warnings } = await supabase
    .from('bet_correlation_warnings')
    .select('*')
    .eq('user_id', userId)
    .eq('acknowledged', false);

  const summary = {
    bankroll: bankroll?.current_amount || 0,
    startingBankroll: bankroll?.starting_amount || 0,
    profitLoss: (bankroll?.current_amount || 0) - (bankroll?.starting_amount || 0),
    activeBets: activeBets?.length || 0,
    totalExposure: todayExposure?.total_amount_risked || 0,
    exposurePercentage: bankroll ? (todayExposure?.total_amount_risked || 0) / bankroll.current_amount * 100 : 0,
    correlationWarnings: warnings?.length || 0,
    riskSettings: {
      maxBetPercentage: bankroll?.max_bet_percentage || 5,
      maxDailyExposure: bankroll?.max_daily_exposure || 20,
      kellyMultiplier: bankroll?.kelly_multiplier || 0.25,
    },
  };

  return new Response(
    JSON.stringify(summary),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

async function checkRiskLimits(supabase: any, userId: string, betAmount: number) {
  // Get bankroll and risk settings
  const { data: bankroll } = await supabase
    .from('user_bankroll')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!bankroll) {
    throw new Error('User bankroll not found');
  }

  // Get today's exposure
  const { data: todayExposure } = await supabase
    .from('daily_risk_exposure')
    .select('*')
    .eq('user_id', userId)
    .eq('date', new Date().toISOString().split('T')[0])
    .single();

  const currentExposure = todayExposure?.total_amount_risked || 0;
  const newTotalExposure = currentExposure + betAmount;

  // Check limits
  const betPercentage = (betAmount / bankroll.current_amount) * 100;
  const exposurePercentage = (newTotalExposure / bankroll.current_amount) * 100;

  const maxBet = bankroll.max_bet_percentage || 5;
  const maxExposure = bankroll.max_daily_exposure || 20;

  const warnings = [];

  if (betPercentage > maxBet) {
    warnings.push({
      type: 'max_bet_exceeded',
      message: `Bet is ${betPercentage.toFixed(1)}% of bankroll (max: ${maxBet}%)`,
      severity: 'high',
    });
  }

  if (exposurePercentage > maxExposure) {
    warnings.push({
      type: 'max_exposure_exceeded',
      message: `Total exposure would be ${exposurePercentage.toFixed(1)}% of bankroll (max: ${maxExposure}%)`,
      severity: 'high',
    });
  }

  return new Response(
    JSON.stringify({
      allowed: warnings.length === 0,
      warnings,
      betPercentage,
      exposurePercentage,
      currentBankroll: bankroll.current_amount,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
