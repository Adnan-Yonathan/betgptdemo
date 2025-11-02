import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { getNowInEST, addDaysEST, formatDateEST } from '../_shared/dateUtils.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NBA Model Configuration
const NBA_MODEL_CONFIG = {
  name: 'nba_spread_v1',
  version: '1.0.0',
  sport: 'NBA',
  weights: {
    homeAdvantage: 3.5, // NBA has higher home advantage than NFL
    restDays: 1.2, // Rest is crucial in NBA (back-to-backs)
    recordDifferential: 0.2,
    paceDifferential: 0.15,
    injuries: 2.0, // Individual players matter more in NBA
    trendMomentum: 1.0,
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

    console.log('[NBA_MODEL] Starting NBA predictions...');

    // Get upcoming NBA games (using Eastern Time zone)
    const todayEST = getNowInEST();
    const sevenDaysFromNowEST = new Date(todayEST);
    sevenDaysFromNowEST.setDate(sevenDaysFromNowEST.getDate() + 7);

    const { data: upcomingGames } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', 'NBA')
      .gte('date', todayEST.toISOString())
      .lte('date', sevenDaysFromNowEST.toISOString())
      .order('date', { ascending: true });

    if (!upcomingGames || upcomingGames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, predictions: 0, message: 'No upcoming NBA games found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NBA_MODEL] Found ${upcomingGames.length} upcoming games`);

    const predictions = [];

    for (const game of upcomingGames) {
      try {
        const prediction = await generateNBAPrediction(supabase, game);
        predictions.push(prediction);

        // Store prediction
        await supabase.from('model_predictions').upsert(prediction, {
          onConflict: 'model_id,event_id,prediction_type',
        });
      } catch (error) {
        console.error(`[NBA_MODEL] Error predicting game ${game.event_id}:`, error);
      }
    }

    console.log(`[NBA_MODEL] Generated ${predictions.length} predictions`);

    return new Response(
      JSON.stringify({
        success: true,
        predictions: predictions.length,
        data: predictions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[NBA_MODEL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateNBAPrediction(supabase: any, game: any) {
  // Get model
  const { data: model } = await supabase
    .from('prediction_models')
    .select('*')
    .eq('model_name', NBA_MODEL_CONFIG.name)
    .single();

  const modelId = model?.id || await createModel(supabase);

  // Extract features
  const features = await extractNBAFeatures(supabase, game);

  // Calculate predicted scores
  const { predictedHomeScore, predictedAwayScore, confidence } = calculateNBAScores(features);

  // Calculate spread and totals
  const predictedSpread = predictedHomeScore - predictedAwayScore;
  const predictedTotal = predictedHomeScore + predictedAwayScore;

  // Get market odds
  const marketData = await getMarketOdds(supabase, game.event_id);

  // Calculate fair odds
  const fairOdds = calculateFairOdds(predictedSpread, predictedTotal);

  // Calculate spread cover probabilities
  const spreadProbabilities = calculateSpreadCoverProbability(predictedSpread, marketData.spread);

  // Calculate total over/under probabilities
  const totalProbabilities = calculateTotalProbability(predictedTotal, marketData.total);

  return {
    model_id: modelId,
    event_id: game.event_id,
    sport: 'NBA',
    league: 'NBA',
    home_team: game.home_team,
    away_team: game.away_team,
    game_date: game.date,
    prediction_type: 'spread',
    predicted_spread: predictedSpread,
    predicted_home_score: predictedHomeScore,
    predicted_away_score: predictedAwayScore,
    predicted_total: predictedTotal,
    home_win_probability: calculateWinProbability(predictedSpread),
    away_win_probability: calculateWinProbability(-predictedSpread),
    spread_cover_probability_home: spreadProbabilities.homeCoverProb,
    spread_cover_probability_away: spreadProbabilities.awayCoverProb,
    total_over_probability: totalProbabilities.overProb,
    total_under_probability: totalProbabilities.underProb,
    confidence_score: confidence,
    fair_odds_home: fairOdds.homeML,
    fair_odds_away: fairOdds.awayML,
    fair_odds_over: fairOdds.over,
    fair_odds_under: fairOdds.under,
    market_odds_home: marketData.homeML,
    market_odds_away: marketData.awayML,
    market_spread: marketData.spread,
    market_total: marketData.total,
    feature_values: features,
    game_started: false,
    game_completed: false,
  };
}

async function extractNBAFeatures(supabase: any, game: any) {
  const features: any = {
    homeAdvantage: 3.5, // NBA home court advantage
  };

  // Get team records
  const homeRecord = parseRecord(game.home_record);
  const awayRecord = parseRecord(game.away_record);

  features.homeWinPct = homeRecord.winPct;
  features.awayWinPct = awayRecord.winPct;
  features.recordDifferential = homeRecord.winPct - awayRecord.winPct;

  // Get rest days and back-to-back situations
  const { data: scheduleFactors } = await supabase
    .from('team_schedule_factors')
    .select('*')
    .in('team', [game.home_team, game.away_team])
    .eq('game_date', formatDateEST(new Date(game.date)));

  if (scheduleFactors && scheduleFactors.length > 0) {
    const homeSchedule = scheduleFactors.find((s: any) => s.team === game.home_team);
    const awaySchedule = scheduleFactors.find((s: any) => s.team === game.away_team);

    features.homeRestDays = homeSchedule?.rest_days || 2;
    features.awayRestDays = awaySchedule?.rest_days || 2;
    features.homeBackToBack = homeSchedule?.is_back_to_back || false;
    features.awayBackToBack = awaySchedule?.is_back_to_back || false;

    // Back-to-back penalty (significant in NBA)
    features.b2bImpact = 0;
    if (features.homeBackToBack) features.b2bImpact -= 4;
    if (features.awayBackToBack) features.b2bImpact += 4;
  }

  // Get injuries (more impactful in NBA with 5-man lineups)
  const { data: injuries } = await supabase
    .from('injury_reports')
    .select('*')
    .in('team', [game.home_team, game.away_team])
    .in('injury_status', ['Out', 'Doubtful'])
    .eq('league', 'NBA');

  if (injuries) {
    const homeInjuries = injuries.filter((i: any) => i.team === game.home_team);
    const awayInjuries = injuries.filter((i: any) => i.team === game.away_team);

    features.homeHighImpactInjuries = homeInjuries.filter((i: any) => i.impact_level === 'High').length;
    features.awayHighImpactInjuries = awayInjuries.filter((i: any) => i.impact_level === 'High').length;
    features.injuryImpact = features.awayHighImpactInjuries - features.homeHighImpactInjuries;
  }

  return features;
}

function calculateNBAScores(features: any) {
  // NBA average score is ~112 points per team
  const NBA_AVG_SCORE = 112;

  // Calculate home team advantage
  let homeAdjustment = features.homeAdvantage;

  // Adjust for record differential (strong teams score more)
  homeAdjustment += features.recordDifferential * 10; // NBA has higher scoring variance

  // Back-to-back impact (huge in NBA)
  homeAdjustment += features.b2bImpact || 0;

  // Injury impact (star players matter more in NBA)
  homeAdjustment += (features.injuryImpact || 0) * 2.0;

  // Calculate predicted scores
  const predictedHomeScore = NBA_AVG_SCORE + homeAdjustment / 2;
  const predictedAwayScore = NBA_AVG_SCORE - homeAdjustment / 2;

  // Calculate confidence
  const confidence = Math.min(100, Math.abs(homeAdjustment) * 6 + 50);

  return {
    predictedHomeScore: Math.round(predictedHomeScore * 10) / 10,
    predictedAwayScore: Math.round(predictedAwayScore * 10) / 10,
    confidence: Math.round(confidence),
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
    return { spread: 0, total: 224, homeML: -110, awayML: -110 };
  }

  const latestOdds = odds[0];
  const outcomes = latestOdds.outcomes;

  const spreadOutcome = outcomes.find((o: any) => o.point !== undefined);
  const spread = spreadOutcome?.point || 0;

  const total = 224; // NBA average total

  const homeML = outcomes.find((o: any) => o.name === latestOdds.home_team)?.price || -110;
  const awayML = outcomes.find((o: any) => o.name === latestOdds.away_team)?.price || -110;

  return { spread, total, homeML, awayML };
}

function calculateFairOdds(predictedSpread: number, predictedTotal: number) {
  const winProb = calculateWinProbability(predictedSpread);

  const homeML = probabilityToOdds(winProb);
  const awayML = probabilityToOdds(1 - winProb);

  const over = -105;
  const under = -105;

  return { homeML, awayML, over, under };
}

function calculateWinProbability(spread: number): number {
  // NBA standard deviation ~12 points
  const stdDev = 12;
  const z = spread / stdDev;

  const prob = 1 / (1 + Math.exp(-0.5 * z));

  return Math.max(0.01, Math.min(0.99, prob));
}

function probabilityToOdds(probability: number): number {
  if (probability >= 0.5) {
    return Math.round(-100 * (probability / (1 - probability)));
  } else {
    return Math.round(100 * ((1 - probability) / probability));
  }
}

/**
 * Calculate the probability that each team covers the spread
 * Uses the difference between predicted spread and market spread
 * to determine cover probabilities
 */
function calculateSpreadCoverProbability(
  predictedSpread: number,
  marketSpread: number
) {
  // NBA standard deviation for spread ~12 points
  const stdDev = 12;

  // Calculate how many standard deviations the market spread is from our prediction
  const spreadDiff = predictedSpread - marketSpread;
  const z = spreadDiff / stdDev;

  // Use logistic function to convert to probability
  // Positive spreadDiff means we predict home team to do better than market expects
  const homeCoverProb = 1 / (1 + Math.exp(-z));

  // Away cover probability is complementary
  const awayCoverProb = 1 - homeCoverProb;

  return {
    homeCoverProb: Math.max(0.01, Math.min(0.99, homeCoverProb)),
    awayCoverProb: Math.max(0.01, Math.min(0.99, awayCoverProb)),
  };
}

/**
 * Calculate the probability of the total going over or under
 * Uses the difference between predicted total and market total
 */
function calculateTotalProbability(
  predictedTotal: number,
  marketTotal: number
) {
  // NBA standard deviation for totals ~15 points
  const stdDev = 15;

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

function parseRecord(recordString: string) {
  if (!recordString) return { wins: 0, losses: 0, winPct: 0.5 };

  const parts = recordString.split('-');
  const wins = parseInt(parts[0]) || 0;
  const losses = parseInt(parts[1]) || 0;
  const total = wins + losses;

  return {
    wins,
    losses,
    winPct: total > 0 ? wins / total : 0.5,
  };
}

async function createModel(supabase: any) {
  const { data, error } = await supabase
    .from('prediction_models')
    .insert({
      model_name: NBA_MODEL_CONFIG.name,
      sport: 'NBA',
      model_type: 'spread',
      version: NBA_MODEL_CONFIG.version,
      features: NBA_MODEL_CONFIG.weights,
      hyperparameters: {},
      is_active: true,
      last_trained_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[NBA_MODEL] Error creating model:', error);
    throw error;
  }

  return data.id;
}
