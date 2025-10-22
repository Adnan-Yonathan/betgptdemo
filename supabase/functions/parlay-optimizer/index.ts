import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ParlayLeg {
  eventId: string;
  team: string;
  marketKey: string;
  odds: number;
  winProbability: number;
  sport: string;
}

/**
 * Calculate parlay odds from individual legs
 * Converts American odds to decimal, multiplies, converts back
 */
function calculateParlayOdds(legs: ParlayLeg[]): number {
  let combinedDecimalOdds = 1;

  for (const leg of legs) {
    // Convert American to decimal
    const decimalOdds = leg.odds > 0
      ? (leg.odds / 100) + 1
      : (100 / Math.abs(leg.odds)) + 1;

    combinedDecimalOdds *= decimalOdds;
  }

  // Convert back to American odds
  if (combinedDecimalOdds >= 2) {
    return Math.round((combinedDecimalOdds - 1) * 100);
  } else {
    return Math.round(-100 / (combinedDecimalOdds - 1));
  }
}

/**
 * Detect correlation between parlay legs
 * Returns correlation coefficient (-1 to 1)
 */
async function detectCorrelation(
  supabaseClient: any,
  leg1: ParlayLeg,
  leg2: ParlayLeg
): Promise<number> {
  // Same game parlay = high correlation
  if (leg1.eventId === leg2.eventId) {
    // Check correlation matrix for same-game markets
    const { data: correlation } = await supabaseClient
      .from('bet_correlations')
      .select('correlation_coefficient')
      .eq('sport', leg1.sport)
      .or(`and(market_type_1.eq.${leg1.marketKey},market_type_2.eq.${leg2.marketKey}),and(market_type_1.eq.${leg2.marketKey},market_type_2.eq.${leg1.marketKey})`)
      .single();

    return correlation?.correlation_coefficient || 0.5; // Default high correlation for SGP
  }

  // Different games, same sport = low correlation
  if (leg1.sport === leg2.sport) {
    return 0.1; // Small correlation within same sport
  }

  // Different sports = no correlation
  return 0;
}

/**
 * Calculate true parlay win probability accounting for correlation
 * Uses copula-based adjustment for correlated events
 */
function calculateTrueParlayProbability(
  legs: ParlayLeg[],
  correlations: number[][]
): number {
  // If no correlation (independent events), simple multiplication
  if (correlations.every(row => row.every(c => c === 0))) {
    return legs.reduce((prob, leg) => prob * leg.winProbability, 1);
  }

  // With correlation, adjust using average correlation factor
  const avgCorrelation = correlations.flat().reduce((a, b) => a + Math.abs(b), 0) /
    (correlations.length * correlations[0].length);

  // Simple correlation adjustment (more sophisticated copula methods possible)
  const independentProb = legs.reduce((prob, leg) => prob * leg.winProbability, 1);
  const adjustmentFactor = 1 - (avgCorrelation * 0.3); // Correlation reduces true probability

  return independentProb * adjustmentFactor;
}

/**
 * Calculate expected value of parlay accounting for correlation
 */
function calculateParlayEV(
  stake: number,
  parlayOdds: number,
  trueProbability: number
): number {
  const decimalOdds = parlayOdds > 0
    ? (parlayOdds / 100) + 1
    : (100 / Math.abs(parlayOdds)) + 1;

  const potentialProfit = stake * (decimalOdds - 1);

  // EV = (true_prob * profit) - (loss_prob * stake)
  return (trueProbability * potentialProfit) - ((1 - trueProbability) * stake);
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

    const { legs, stake } = await req.json();

    console.log('=== PARLAY OPTIMIZER CALLED ===');
    console.log('Legs:', legs);
    console.log('Stake:', stake);

    // Validate input
    if (!legs || !Array.isArray(legs) || legs.length < 2) {
      return new Response(JSON.stringify({
        error: 'At least 2 legs required for parlay'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate parlay odds
    const parlayOdds = calculateParlayOdds(legs);
    console.log('Combined parlay odds:', parlayOdds);

    // Build correlation matrix
    const numLegs = legs.length;
    const correlationMatrix: number[][] = Array(numLegs).fill(0).map(() => Array(numLegs).fill(0));

    for (let i = 0; i < numLegs; i++) {
      for (let j = i + 1; j < numLegs; j++) {
        const corr = await detectCorrelation(supabaseClient, legs[i], legs[j]);
        correlationMatrix[i][j] = corr;
        correlationMatrix[j][i] = corr;
      }
    }

    console.log('Correlation matrix:', correlationMatrix);

    // Calculate true win probability with correlation adjustment
    const independentProbability = legs.reduce((p: number, leg: ParlayLeg) =>
      p * leg.winProbability, 1
    );
    const trueProbability = calculateTrueParlayProbability(legs, correlationMatrix);

    console.log('Independent probability:', independentProbability);
    console.log('Correlation-adjusted probability:', trueProbability);

    // Calculate correlation penalty
    const correlationPenalty = independentProbability - trueProbability;

    // Calculate Expected Value
    const expectedValue = calculateParlayEV(stake, parlayOdds, trueProbability);

    // Calculate potential return
    const decimalOdds = parlayOdds > 0
      ? (parlayOdds / 100) + 1
      : (100 / Math.abs(parlayOdds)) + 1;
    const potentialReturn = stake * decimalOdds;

    // Implied probability from market odds (with vig removed approximately)
    const marketImpliedProb = 1 / decimalOdds;

    // Edge calculation
    const edge = trueProbability - marketImpliedProb;
    const edgePercentage = edge * 100;

    // Statistical reasoning
    const reasoning = {
      summary: edgePercentage > 0
        ? `This parlay has a ${edgePercentage.toFixed(2)}% edge (+EV)`
        : `This parlay is -EV with a ${Math.abs(edgePercentage).toFixed(2)}% disadvantage`,
      details: [
        `Independent probability: ${(independentProbability * 100).toFixed(2)}%`,
        `Correlation-adjusted probability: ${(trueProbability * 100).toFixed(2)}%`,
        `Correlation penalty: ${(correlationPenalty * 100).toFixed(2)}%`,
        `Market implied probability: ${(marketImpliedProb * 100).toFixed(2)}%`,
        `Expected value: $${expectedValue.toFixed(2)}`,
      ],
      warning: correlationPenalty > 0.05
        ? 'WARNING: High correlation detected between legs, significantly reducing true win probability. Most parlays are -EV traps.'
        : null,
      recommendation: edgePercentage > 2
        ? 'This parlay shows positive expected value and may be worth considering.'
        : 'This parlay is likely -EV. Consider betting legs individually for better value.',
    };

    // Check for same-game parlay warning
    const isSameGameParlay = new Set(legs.map((l: ParlayLeg) => l.eventId)).size === 1;

    const response = {
      success: true,
      parlay: {
        numLegs: legs.length,
        combinedOdds: parlayOdds,
        stake: stake,
        potentialReturn: potentialReturn,
        potentialProfit: potentialReturn - stake,
      },
      probability: {
        independent: independentProbability,
        correlationAdjusted: trueProbability,
        marketImplied: marketImpliedProb,
        correlationPenalty: correlationPenalty,
      },
      expectedValue: {
        amount: expectedValue,
        percentage: (expectedValue / stake) * 100,
        edge: edgePercentage,
        isPositive: expectedValue > 0,
      },
      correlationMatrix: correlationMatrix,
      isSameGameParlay: isSameGameParlay,
      reasoning: reasoning,
      recommendation: edgePercentage > 0 ? 'PROCEED' : 'AVOID',
    };

    console.log('Parlay analysis complete:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in parlay-optimizer function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
