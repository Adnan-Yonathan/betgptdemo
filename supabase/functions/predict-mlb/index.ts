import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { getNowInEST } from '../_shared/dateUtils.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// MLB Model Configuration (pitcher-heavy)
const MLB_MODEL_CONFIG = {
  name: 'mlb_moneyline_v1',
  version: '1.0.0',
  sport: 'MLB',
  weights: {
    homeAdvantage: 0.5, // MLB has smaller home advantage
    pitcherMatchup: 3.0, // Pitchers are critical in MLB
    bullpenQuality: 1.5,
    recordDifferential: 0.1,
    injuries: 0.8,
    weather: 0.6, // Wind/weather matters for runs
  },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[MLB_MODEL] Starting MLB predictions...');

    // Get upcoming MLB games (using Eastern Time zone)
    const todayEST = getNowInEST();
    const sevenDaysFromNowEST = new Date(todayEST);
    sevenDaysFromNowEST.setDate(sevenDaysFromNowEST.getDate() + 7);

    const { data: upcomingGames } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', 'MLB')
      .gte('date', todayEST.toISOString())
      .lte('date', sevenDaysFromNowEST.toISOString())
      .order('date', { ascending: true });

    if (!upcomingGames || upcomingGames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, predictions: 0, message: 'No upcoming MLB games found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MLB_MODEL] Found ${upcomingGames.length} upcoming games`);

    const predictions = [];

    for (const game of upcomingGames) {
      try {
        const prediction = await generateMLBPrediction(supabase, game);
        predictions.push(prediction);

        await supabase.from('model_predictions').upsert(prediction, {
          onConflict: 'model_id,event_id,prediction_type',
        });
      } catch (error) {
        console.error(`[MLB_MODEL] Error predicting game ${game.event_id}:`, error);
      }
    }

    console.log(`[MLB_MODEL] Generated ${predictions.length} predictions`);

    return new Response(
      JSON.stringify({ success: true, predictions: predictions.length, data: predictions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[MLB_MODEL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateMLBPrediction(supabase: any, game: any) {
  const { data: model } = await supabase
    .from('prediction_models')
    .select('*')
    .eq('model_name', MLB_MODEL_CONFIG.name)
    .single();

  const modelId = model?.id || await createModel(supabase);

  const features = await extractMLBFeatures(supabase, game);
  const { predictedHomeScore, predictedAwayScore, confidence } = calculateMLBScores(features);
  const predictedTotal = predictedHomeScore + predictedAwayScore;

  const marketData = await getMarketOdds(supabase, game.event_id);
  const fairOdds = calculateFairOdds(predictedHomeScore, predictedAwayScore);

  const homeWinProb = calculateMLBWinProbability(predictedHomeScore, predictedAwayScore);

  // Calculate total over/under probabilities
  const totalProbabilities = calculateTotalProbability(predictedTotal, marketData.total);

  return {
    model_id: modelId,
    event_id: game.event_id,
    sport: 'MLB',
    league: 'MLB',
    home_team: game.home_team,
    away_team: game.away_team,
    game_date: game.date,
    prediction_type: 'moneyline',
    predicted_home_score: predictedHomeScore,
    predicted_away_score: predictedAwayScore,
    predicted_total: predictedTotal,
    home_win_probability: homeWinProb,
    away_win_probability: 1 - homeWinProb,
    total_over_probability: totalProbabilities.overProb,
    total_under_probability: totalProbabilities.underProb,
    confidence_score: confidence,
    fair_odds_home: fairOdds.homeML,
    fair_odds_away: fairOdds.awayML,
    fair_odds_over: fairOdds.over,
    fair_odds_under: fairOdds.under,
    market_odds_home: marketData.homeML,
    market_odds_away: marketData.awayML,
    market_total: marketData.total,
    feature_values: features,
    game_started: false,
    game_completed: false,
  };
}

async function extractMLBFeatures(supabase: any, game: any) {
  const features: any = {
    homeAdvantage: 0.5, // MLB home field advantage is small
  };

  const homeRecord = parseRecord(game.home_record);
  const awayRecord = parseRecord(game.away_record);

  features.homeWinPct = homeRecord.winPct;
  features.awayWinPct = awayRecord.winPct;
  features.recordDifferential = homeRecord.winPct - awayRecord.winPct;

  // Pitcher matchup (would need starting pitcher data)
  features.pitcherAdvantage = 0; // TODO: Integrate pitcher ERAs

  return features;
}

function calculateMLBScores(features: any) {
  const MLB_AVG_SCORE = 4.5; // MLB average runs per team

  let homeAdjustment = features.homeAdvantage;
  homeAdjustment += features.recordDifferential * 2;
  homeAdjustment += features.pitcherAdvantage || 0;

  const predictedHomeScore = MLB_AVG_SCORE + homeAdjustment / 2;
  const predictedAwayScore = MLB_AVG_SCORE - homeAdjustment / 2;

  const confidence = Math.min(100, Math.abs(homeAdjustment) * 15 + 50);

  return {
    predictedHomeScore: Math.round(predictedHomeScore * 10) / 10,
    predictedAwayScore: Math.round(predictedAwayScore * 10) / 10,
    confidence: Math.round(confidence),
  };
}

function calculateMLBWinProbability(homeScore: number, awayScore: number): number {
  const scoreDiff = homeScore - awayScore;
  const prob = 1 / (1 + Math.exp(-0.8 * scoreDiff));
  return Math.max(0.01, Math.min(0.99, prob));
}

/**
 * Calculate the probability of the total going over or under
 * Uses the difference between predicted total and market total
 */
function calculateTotalProbability(
  predictedTotal: number,
  marketTotal: number
) {
  // MLB standard deviation for totals ~2.5 runs
  const stdDev = 2.5;

  // Calculate how many standard deviations the market total is from our prediction
  const totalDiff = predictedTotal - marketTotal;
  const z = totalDiff / stdDev;

  // Positive totalDiff means we predict higher scoring than market expects
  const overProb = 1 / (1 + Math.exp(-z));

  // Under probability is complementary
  const underProb = 1 - overProb;

  return {
    overProb: Math.max(0.01, Math.min(0.99, overProb)),
    underProb: Math.max(0.01, Math.min(0.99, underProb)),
  };
}

async function getMarketOdds(supabase: any, eventId: string) {
  const { data: odds } = await supabase
    .from('betting_odds')
    .select('*')
    .eq('event_id', eventId)
    .order('last_update', { ascending: false })
    .limit(1);

  if (!odds || odds.length === 0) {
    return { total: 9, homeML: -110, awayML: -110 };
  }

  const latestOdds = odds[0];
  const homeML = latestOdds.outcomes.find((o: any) => o.name === latestOdds.home_team)?.price || -110;
  const awayML = latestOdds.outcomes.find((o: any) => o.name === latestOdds.away_team)?.price || -110;

  return { total: 9, homeML, awayML };
}

function calculateFairOdds(homeScore: number, awayScore: number) {
  const homeWinProb = calculateMLBWinProbability(homeScore, awayScore);

  const homeML = homeWinProb >= 0.5
    ? Math.round(-100 * (homeWinProb / (1 - homeWinProb)))
    : Math.round(100 * ((1 - homeWinProb) / homeWinProb));

  const awayML = homeWinProb >= 0.5
    ? Math.round(100 * ((1 - homeWinProb) / homeWinProb))
    : Math.round(-100 * ((1 - homeWinProb) / homeWinProb));

  return { homeML, awayML, over: -105, under: -105 };
}

function parseRecord(recordString: string) {
  if (!recordString) return { wins: 0, losses: 0, winPct: 0.5 };
  const parts = recordString.split('-');
  const wins = parseInt(parts[0]) || 0;
  const losses = parseInt(parts[1]) || 0;
  const total = wins + losses;
  return { wins, losses, winPct: total > 0 ? wins / total : 0.5 };
}

async function createModel(supabase: any) {
  const { data } = await supabase
    .from('prediction_models')
    .insert({
      model_name: MLB_MODEL_CONFIG.name,
      sport: 'MLB',
      model_type: 'moneyline',
      version: MLB_MODEL_CONFIG.version,
      features: MLB_MODEL_CONFIG.weights,
      is_active: true,
      last_trained_at: new Date().toISOString(),
    })
    .select()
    .single();

  return data.id;
}
