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

    console.log('[PROPS] Starting player prop predictions...');

    // Get player props from database
    const { data: props } = await supabase
      .from('player_props')
      .select('*')
      .gte('game_date', new Date().toISOString())
      .lte('game_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

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

  // Calculate edge
  const edge = calculatePropEdge(adjustedPrediction, prop.line, prop.over_odds, prop.under_odds);

  return {
    prop_id: prop.id,
    event_id: prop.event_id,
    player_name: prop.player_name,
    prop_type: prop.prop_type,
    predicted_value: adjustedPrediction,
    confidence_score: confidence,
    market_line: prop.line,
    edge_percentage: edge.percentage,
    recommended_side: edge.side,
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

async function getPlayerHistory(supabase: any, playerName: string, propType: string) {
  // Get player's recent games
  const { data: history } = await supabase
    .from('player_performance_history')
    .select('*')
    .eq('player_name', playerName)
    .order('game_date', { ascending: false })
    .limit(20);

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
    };
  }

  const seasonAvg = values.reduce((a: number, b: number) => a + b, 0) / values.length;
  const last5Avg = values.slice(0, 5).reduce((a: number, b: number) => a + b, 0) / Math.min(5, values.length);
  const last10Avg = values.slice(0, 10).reduce((a: number, b: number) => a + b, 0) / Math.min(10, values.length);

  // Calculate trend (improving, declining, or neutral)
  const trend = last5Avg > seasonAvg * 1.1 ? 'improving' : last5Avg < seasonAvg * 0.9 ? 'declining' : 'neutral';

  return {
    seasonAvg,
    last5Avg,
    last10Avg,
    vsOpponentAvg: last5Avg, // Simplified - would need opponent-specific history
    homeAwaySplit: 1.0, // Simplified - would need home/away breakdown
    trend,
    sampleSize: values.length,
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
    last5: 0.5,
    last10: 0.3,
    season: 0.2,
  };

  const predicted =
    history.last5Avg * weights.last5 +
    history.last10Avg * weights.last10 +
    history.seasonAvg * weights.season;

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
  // Confidence based on sample size and consistency
  const sampleSize = history.sampleSize;
  const consistency = history.seasonAvg > 0 ? Math.abs(history.last5Avg - history.seasonAvg) / history.seasonAvg : 1;

  let confidence = 50; // Base confidence

  // Increase confidence with more data
  if (sampleSize >= 10) confidence += 20;
  else if (sampleSize >= 5) confidence += 10;

  // Increase confidence with consistency
  if (consistency < 0.1) confidence += 20;
  else if (consistency < 0.2) confidence += 10;

  // Adjust for trend
  if (history.trend === 'improving' || history.trend === 'declining') {
    confidence += 5; // Clearer trends are easier to predict
  }

  return Math.min(100, confidence);
}

function calculatePropEdge(
  predictedValue: number,
  line: number,
  overOdds: number,
  underOdds: number
) {
  // Determine which side has edge
  const difference = predictedValue - line;

  let side = 'no_bet';
  let percentage = 0;

  if (Math.abs(difference) < 0.5) {
    // Too close, no bet
    return { side: 'no_bet', percentage: 0 };
  }

  if (difference > 0) {
    // Over has edge
    side = 'over';
    const overImplied = oddsToImpliedProbability(overOdds);
    const fairProb = calculatePropProbability(predictedValue, line, 'over');
    percentage = (fairProb - overImplied) * 100;
  } else {
    // Under has edge
    side = 'under';
    const underImplied = oddsToImpliedProbability(underOdds);
    const fairProb = calculatePropProbability(predictedValue, line, 'under');
    percentage = (fairProb - underImplied) * 100;
  }

  return {
    side,
    percentage: Math.round(percentage * 10) / 10,
  };
}

function calculatePropProbability(predicted: number, line: number, side: string): number {
  // Simple probability model based on distance from line
  const difference = predicted - line;
  const stdDev = predicted * 0.15; // Assume 15% standard deviation

  if (side === 'over') {
    // Probability that actual > line
    const z = difference / stdDev;
    return 1 / (1 + Math.exp(-z));
  } else {
    // Probability that actual < line
    const z = difference / stdDev;
    return 1 - (1 / (1 + Math.exp(-z)));
  }
}

function oddsToImpliedProbability(odds: number): number {
  if (odds > 0) {
    return 100 / (odds + 100);
  } else {
    return Math.abs(odds) / (Math.abs(odds) + 100);
  }
}
