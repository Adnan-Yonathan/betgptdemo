import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// ARBITRAGE DETECTION
// ============================================================================
// Deployment trigger

interface ArbitrageOpportunity {
  type: 'pure_arb' | 'positive_ev' | 'hedge';
  kalshi_market: any;
  sportsbook_odds: any;
  guaranteed_profit?: number;
  profit_percent?: number;
  expected_value?: number;
  recommendation: string;
  stake_kalshi: number;
  stake_sportsbook: number;
  reasoning: string;
}

/**
 * Convert American odds to decimal
 */
function americanToDecimal(american: number): number {
  if (american > 0) {
    return (american / 100) + 1;
  } else {
    return (100 / Math.abs(american)) + 1;
  }
}

/**
 * Convert Kalshi price (cents) to implied probability
 */
function kalshiToProb(cents: number): number {
  return cents / 100;
}

/**
 * Convert decimal odds to implied probability
 */
function decimalToProb(decimal: number): number {
  return 1 / decimal;
}

/**
 * Detect pure arbitrage opportunities
 * Buy YES on Kalshi + bet NO equivalent on sportsbook
 */
function detectPureArbitrage(
  kalshiMarket: any,
  sportsbookOdds: any
): ArbitrageOpportunity | null {
  // Kalshi YES price
  const kalshiYesPrice = kalshiMarket.yes_ask; // Price to buy YES
  if (!kalshiYesPrice) return null;

  // Find corresponding sportsbook line (opposite side)
  const sbOdds = sportsbookOdds.outcome_price;
  if (!sbOdds) return null;

  const kalshiYesProb = kalshiToProb(kalshiYesPrice);
  const sbDecimal = americanToDecimal(sbOdds);
  const sbProb = decimalToProb(sbDecimal);

  // Total implied probability
  const totalProb = kalshiYesProb + sbProb;

  // If total probability < 1, there's an arbitrage opportunity
  if (totalProb < 1) {
    const arbMargin = 1 - totalProb;
    const profitPercent = (arbMargin / totalProb) * 100;

    // Calculate optimal stakes for $100 total
    const totalStake = 100;
    const stakeKalshi = (totalStake * sbProb) / totalProb;
    const stakeSportsbook = (totalStake * kalshiYesProb) / totalProb;

    // Guaranteed profit
    const guaranteedProfit = totalStake * arbMargin;

    return {
      type: 'pure_arb',
      kalshi_market: kalshiMarket,
      sportsbook_odds: sportsbookOdds,
      guaranteed_profit: guaranteedProfit,
      profit_percent: profitPercent,
      recommendation: `Guaranteed profit of $${guaranteedProfit.toFixed(2)} (${profitPercent.toFixed(2)}%)`,
      stake_kalshi: stakeKalshi,
      stake_sportsbook: stakeSportsbook,
      reasoning: `Buy YES on Kalshi at ${kalshiYesPrice}¢ and bet the opposite on sportsbook. Total implied probability is ${(totalProb * 100).toFixed(2)}%, creating a ${(arbMargin * 100).toFixed(2)}% arbitrage margin.`,
    };
  }

  return null;
}

/**
 * Detect positive expected value opportunities
 */
function detectPositiveEV(
  kalshiMarket: any,
  sportsbookOdds: any
): ArbitrageOpportunity | null {
  const kalshiYesPrice = kalshiMarket.yes_ask;
  if (!kalshiYesPrice) return null;

  const sbOdds = sportsbookOdds.outcome_price;
  if (!sbOdds) return null;

  // Calculate fair probability from sportsbook (removing vig)
  const sbDecimal = americanToDecimal(sbOdds);
  const sbImpliedProb = decimalToProb(sbDecimal);

  // Assume 5% vig, calculate fair probability
  const fairProb = sbImpliedProb / 1.05;

  // Kalshi implied probability
  const kalshiProb = kalshiToProb(kalshiYesPrice);

  // If fair probability > Kalshi probability, there's +EV
  const edge = fairProb - kalshiProb;

  if (edge > 0.05) { // At least 5% edge
    const ev = (fairProb * (100 - kalshiYesPrice)) - (kalshiProb * kalshiYesPrice);
    const evPercent = (ev / kalshiYesPrice) * 100;

    return {
      type: 'positive_ev',
      kalshi_market: kalshiMarket,
      sportsbook_odds: sportsbookOdds,
      expected_value: ev,
      profit_percent: evPercent,
      recommendation: `Bet YES on Kalshi with ${evPercent.toFixed(2)}% expected value`,
      stake_kalshi: 100,
      stake_sportsbook: 0,
      reasoning: `Kalshi price (${kalshiYesPrice}¢) implies ${(kalshiProb * 100).toFixed(1)}% probability, but sportsbook suggests fair probability is ${(fairProb * 100).toFixed(1)}%, giving you ${(edge * 100).toFixed(1)}% edge.`,
    };
  }

  return null;
}

/**
 * Find arbitrage opportunities between Kalshi and sportsbooks
 */
async function findArbitrageOpportunities(
  supabase: any,
  sport?: string
): Promise<ArbitrageOpportunity[]> {
  const opportunities: ArbitrageOpportunity[] = [];

  try {
    // Fetch open Kalshi markets
    let kalshiQuery = supabase
      .from('kalshi_markets')
      .select('*')
      .eq('status', 'open')
      .order('volume', { ascending: false })
      .limit(50);

    if (sport) {
      kalshiQuery = kalshiQuery.eq('sport_key', sport);
    }

    const { data: kalshiMarkets, error: kalshiError } = await kalshiQuery;

    if (kalshiError) throw kalshiError;

    if (!kalshiMarkets || kalshiMarkets.length === 0) {
      console.log('[ARBITRAGE] No Kalshi markets found');
      return opportunities;
    }

    console.log(`[ARBITRAGE] Checking ${kalshiMarkets.length} Kalshi markets`);

    // For each Kalshi market, find corresponding sportsbook odds
    for (const market of kalshiMarkets) {
      // Extract team names from market title
      const teamNames = extractTeamNames(market.title);

      if (teamNames.length === 0) continue;

      // Fetch sportsbook odds for these teams
      const { data: sbOdds, error: sbError } = await supabase
        .from('betting_odds')
        .select('*')
        .or(teamNames.map(team => `home_team.ilike.%${team}%,away_team.ilike.%${team}%`).join(','))
        .gte('commence_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('last_updated', { ascending: false })
        .limit(10);

      if (sbError || !sbOdds || sbOdds.length === 0) continue;

      // Check for arbitrage with each sportsbook odd
      for (const odd of sbOdds) {
        // Pure arbitrage
        const pureArb = detectPureArbitrage(market, odd);
        if (pureArb) {
          opportunities.push(pureArb);
        }

        // Positive EV
        const posEV = detectPositiveEV(market, odd);
        if (posEV) {
          opportunities.push(posEV);
        }
      }
    }

    // Sort by profit/EV
    opportunities.sort((a, b) => {
      const aValue = a.guaranteed_profit || a.expected_value || 0;
      const bValue = b.guaranteed_profit || b.expected_value || 0;
      return bValue - aValue;
    });

    console.log(`[ARBITRAGE] Found ${opportunities.length} opportunities`);

  } catch (error) {
    console.error('[ARBITRAGE] Error:', error);
    throw error;
  }

  return opportunities;
}

function extractTeamNames(title: string): string[] {
  // Common team names for matching
  const nbaTeams = ['Lakers', 'Celtics', 'Warriors', 'Nets', 'Heat', 'Bucks', 'Mavericks', 'Suns', 'Nuggets', 'Clippers'];
  const nflTeams = ['Chiefs', 'Bills', 'Eagles', 'Cowboys', '49ers', 'Ravens', 'Bengals', 'Dolphins'];
  const mlbTeams = ['Yankees', 'Dodgers', 'Red Sox', 'Astros', 'Braves', 'Mets'];
  const nhlTeams = ['Maple Leafs', 'Bruins', 'Rangers', 'Penguins', 'Capitals'];

  const allTeams = [...nbaTeams, ...nflTeams, ...mlbTeams, ...nhlTeams];

  return allTeams.filter(team => title.includes(team));
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request
    const { sport, min_profit = 2 } = await req.json().catch(() => ({}));

    console.log(`[ARBITRAGE] Detecting opportunities for sport: ${sport || 'all'}, min profit: ${min_profit}%`);

    // Find arbitrage opportunities
    const opportunities = await findArbitrageOpportunities(supabase, sport);

    // Filter by minimum profit
    const filtered = opportunities.filter(opp => {
      const profit = opp.profit_percent || 0;
      return profit >= min_profit;
    });

    console.log(`[ARBITRAGE] ${filtered.length} opportunities meet ${min_profit}% threshold`);

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        total_opportunities: opportunities.length,
        filtered_opportunities: filtered.length,
        min_profit_threshold: min_profit,
        opportunities: filtered.slice(0, 20), // Return top 20
        summary: {
          pure_arbitrage: filtered.filter(o => o.type === 'pure_arb').length,
          positive_ev: filtered.filter(o => o.type === 'positive_ev').length,
          avg_profit: filtered.length > 0
            ? (filtered.reduce((sum, o) => sum + (o.profit_percent || 0), 0) / filtered.length).toFixed(2)
            : 0,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[ARBITRAGE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
