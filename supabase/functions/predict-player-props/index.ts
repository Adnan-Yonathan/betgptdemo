import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { getNowInEST } from '../_shared/dateUtils.ts';

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

    console.log('[PROPS] Starting player prop predictions...');

    // Get player props from database (using Eastern Time zone)
    const todayEST = getNowInEST();
    const sevenDaysFromNowEST = new Date(todayEST);
    sevenDaysFromNowEST.setDate(sevenDaysFromNowEST.getDate() + 7);

    const { data: props } = await supabase
      .from('player_props')
      .select('*')
      .gte('game_date', todayEST.toISOString())
      .lte('game_date', sevenDaysFromNowEST.toISOString());

    if (!props || props.length === 0) {
      return new Response(
        JSON.stringify({ success: true, predictions: 0, message: 'No player props found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[PROPS] Found ${props.length} player props`);

    const predictions = [];

    for (const prop of props) {
      try {
        const prediction = await generatePropPrediction(supabase, prop);
        predictions.push(prediction);

        // Store prediction
        await supabase.from('player_prop_predictions').upsert(prediction, {
          onConflict: 'event_id,player_name,prop_type',
        });
      } catch (error) {
        console.error(`[PROPS] Error predicting prop for ${prop.player_name}:`, error);
      }
    }

    console.log(`[PROPS] Generated ${predictions.length} prop predictions`);

    return new Response(
      JSON.stringify({
        success: true,
        predictions: predictions.length,
        data: predictions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[PROPS] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generatePropPrediction(supabase: any, prop: any) {
  // Get player historical performance
  const playerHistory = await getPlayerHistory(supabase, prop.player_name, prop.prop_type);

  // Calculate predicted value based on recent performance
  const predictedValue = calculatePredictedValue(playerHistory, prop);

  // Get injury impact
  const injuryImpact = await getInjuryImpact(supabase, prop.team, prop.player_name);

  // Adjust for injuries
  const adjustedPrediction = predictedValue * (1 - injuryImpact);

  // Calculate confidence
  const confidence = calculateConfidence(playerHistory);

  // Calculate over/under probabilities
  const overProbability = calculatePropProbability(adjustedPrediction, prop.line, 'over');
  const underProbability = calculatePropProbability(adjustedPrediction, prop.line, 'under');

  return {
    prop_id: prop.id,
    event_id: prop.event_id,
    player_name: prop.player_name,
    prop_type: prop.prop_type,
    predicted_value: adjustedPrediction,
    confidence_score: confidence,
    market_line: prop.line,
    over_probability: overProbability,
    under_probability: underProbability,
    season_average: playerHistory.seasonAvg,
    last_5_games_average: playerHistory.last5Avg,
    vs_opponent_average: playerHistory.vsOpponentAvg,
    home_away_split: playerHistory.homeAwaySplit,
    injury_impact_factor: injuryImpact,
    feature_values: {
      seasonAvg: playerHistory.seasonAvg,
      last5: playerHistory.last5Avg,
      last10: playerHistory.last10Avg,
      vsOpponent: playerHistory.vsOpponentAvg,
      homeAway: playerHistory.homeAwaySplit,
      trend: playerHistory.trend,
    },
  };
}

async function getPlayerHistory(supabase: any, playerName: string, propType: string, opponent?: string, isHome?: boolean) {
  // Get player's recent games from ESPN-enhanced data
  const { data: history } = await supabase
    .from('player_performance_history')
    .select('*')
    .eq('player_name', playerName)
    .order('game_date', { ascending: false })
    .limit(30);

  if (!history || history.length === 0) {
    // Return default averages if no history
    return {
      seasonAvg: 0,
      last5Avg: 0,
      last10Avg: 0,
      vsOpponentAvg: 0,
      homeAwaySplit: 1.0,
      trend: 'neutral',
      sampleSize: 0,
      consistency: 0,
    };
  }

  // Extract stat values for this prop type
  const statKey = getStatKey(propType);
  const values = history.map((game: any) => game.stats?.[statKey] || 0).filter((v: number) => v > 0);

  if (values.length === 0) {
    return {
      seasonAvg: 0,
      last5Avg: 0,
      last10Avg: 0,
      vsOpponentAvg: 0,
      homeAwaySplit: 1.0,
      trend: 'neutral',
      sampleSize: 0,
      consistency: 0,
    };
  }

  const seasonAvg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const last5Avg = values.slice(0, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(5, values.length);
  const last10Avg = values.slice(0, 10).reduce((a: number, b: number) => a + b, 0) / Math.min(10, values.length);

  // Calculate vs opponent average (ESPN data provides opponent info)
  let vsOpponentAvg = seasonAvg;
  if (opponent) {
    const vsOpponentGames = history.filter((game: any) => game.opponent === opponent);
    if (vsOpponentGames.length > 0) {
      const opponentValues = vsOpponentGames
        .map((game: any) => game.stats?.[statKey] || 0)
        .filter((v: number) => v > 0);
      vsOpponentAvg = opponentValues.reduce((a: number, b: number) => a + b, 0) / opponentValues.length;
    }
  }

  // Calculate home/away split (ESPN data provides home_away field)
  let homeAwaySplit = 1.0;
  const homeGames = history.filter((game: any) => game.home_away === 'home');
  const awayGames = history.filter((game: any) => game.home_away === 'away');

  if (homeGames.length > 0 && awayGames.length > 0) {
    const homeValues = homeGames
      .map((game: any) => game.stats?.[statKey] || 0)
      .filter((v: number) => v > 0);
    const awayValues = awayGames
      .map((game: any) => game.stats?.[statKey] || 0)
      .filter((v: number) => v > 0);

    if (homeValues.length > 0 && awayValues.length > 0) {
      const homeAvg = homeValues.reduce((a: number, b: number) => a + b, 0) / homeValues.length;
      const awayAvg = awayValues.reduce((a: number, b: number) => a + b, 0) / awayValues.length;

      // homeAwaySplit: >1 means better at home, <1 means better away
      homeAwaySplit = awayAvg > 0 ? homeAvg / awayAvg : 1.0;
    }
  }

  // Calculate trend (improving, declining, or neutral)
  const trend = last5Avg > seasonAvg * 1.1 ? 'improving' : last5Avg < seasonAvg * 0.9 ? 'declining' : 'neutral';

  // Calculate consistency (lower variance = more consistent)
  const variance = values.reduce((sum: number, val: number) => sum + Math.pow(val - seasonAvg, 2), 0) / values.length;
  const consistency = seasonAvg > 0 ? 1 - Math.min(Math.sqrt(variance) / seasonAvg, 1) : 0;

  return {
    seasonAvg,
    last5Avg,
    last10Avg,
    vsOpponentAvg,
    homeAwaySplit,
    trend,
    sampleSize: values.length,
    consistency: Math.round(consistency * 100) / 100,
  };
}

function getStatKey(propType: string): string {
  const mapping: { [key: string]: string } = {
    'points': 'points',
    'rebounds': 'rebounds',
    'assists': 'assists',
    'passing_yards': 'passingYards',
    'rushing_yards': 'rushingYards',
    'receiving_yards': 'receivingYards',
    'touchdowns': 'touchdowns',
    'hits': 'hits',
    'strikeouts': 'strikeouts',
  };

  return mapping[propType] || propType;
}

function calculatePredictedValue(history: any, prop: any) {
  // Weight recent games more heavily
  const weights = {
    last5: 0.4,
    last10: 0.25,
    season: 0.15,
    vsOpponent: 0.15,
    homeAway: 0.05,
  };

  // Base prediction from weighted averages
  let predicted =
    history.last5Avg * weights.last5 +
    history.last10Avg * weights.last10 +
    history.seasonAvg * weights.season +
    history.vsOpponentAvg * weights.vsOpponent;

  // Apply home/away adjustment
  // If homeAwaySplit > 1 and playing at home, boost prediction
  // If homeAwaySplit < 1 and playing away, boost prediction
  const homeAwayAdjustment = history.homeAwaySplit !== 1.0
    ? (history.homeAwaySplit - 1.0) * weights.homeAway * predicted
    : 0;

  predicted += homeAwayAdjustment;

  // Adjust based on trend
  if (history.trend === 'improving') {
    predicted *= 1.05; // 5% boost for improving trend
  } else if (history.trend === 'declining') {
    predicted *= 0.95; // 5% reduction for declining trend
  }

  return Math.round(predicted * 10) / 10;
}

async function getInjuryImpact(supabase: any, team: string, playerName: string) {
  const { data: injuries } = await supabase
    .from('injury_reports')
    .select('*')
    .eq('team', team)
    .eq('player_name', playerName)
    .in('injury_status', ['Questionable', 'Probable']);

  if (!injuries || injuries.length === 0) {
    return 0; // No injury impact
  }

  const injury = injuries[0];

  // Reduce expected value based on injury status
  if (injury.injury_status === 'Questionable') {
    return 0.15; // 15% reduction
  } else if (injury.injury_status === 'Probable') {
    return 0.05; // 5% reduction
  }

  return 0;
}

function calculateConfidence(history: any): number {
  // Enhanced confidence calculation using ESPN data
  const sampleSize = history.sampleSize;
  const consistency = history.consistency || 0;

  let confidence = 40; // Base confidence

  // Increase confidence with more data (ESPN provides more historical games)
  if (sampleSize >= 20) confidence += 30;
  else if (sampleSize >= 15) confidence += 25;
  else if (sampleSize >= 10) confidence += 20;
  else if (sampleSize >= 5) confidence += 10;

  // Increase confidence with consistency (ESPN data allows better variance calculation)
  if (consistency >= 0.8) confidence += 20; // Very consistent
  else if (consistency >= 0.7) confidence += 15;
  else if (consistency >= 0.6) confidence += 10;
  else if (consistency >= 0.5) confidence += 5;

  // Adjust for trend clarity
  if (history.trend === 'improving' || history.trend === 'declining') {
    confidence += 5; // Clearer trends are easier to predict
  }

  // Bonus for having opponent-specific data
  if (history.vsOpponentAvg !== history.seasonAvg) {
    confidence += 5; // We have actual vs-opponent history
  }

  return Math.min(95, confidence); // Cap at 95% (never 100% certain)
}

/**
 * Calculate the probability that a player prop goes over or under the line
 * Uses the predicted value and a standard deviation model
 */
function calculatePropProbability(predicted: number, line: number, side: string): number {
  // Simple probability model based on distance from line
  const difference = predicted - line;
  const stdDev = Math.max(predicted * 0.15, 0.5); // Assume 15% standard deviation, min 0.5

  if (side === 'over') {
    // Probability that actual > line
    const z = difference / stdDev;
    const prob = 1 / (1 + Math.exp(-z));
    return Math.max(0.01, Math.min(0.99, prob));
  } else {
    // Probability that actual < line
    const z = difference / stdDev;
    const prob = 1 - (1 / (1 + Math.exp(-z)));
    return Math.max(0.01, Math.min(0.99, prob));
  }
}
