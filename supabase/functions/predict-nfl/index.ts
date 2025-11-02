import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { getNowInEST, formatDateEST } from '../_shared/dateUtils.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// NFL Model Configuration
const NFL_MODEL_CONFIG = {
  name: 'nfl_spread_v1',
  version: '1.0.0',
  sport: 'NFL',
  // Feature weights (derived from historical analysis)
  weights: {
    homeAdvantage: 2.5,
    restDays: 0.3,
    recordDifferential: 0.15,
    divisionGame: 1.0,
    weather: 0.4,
    injuries: 1.5,
    trendMomentum: 0.8,
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

    console.log('[NFL_MODEL] Starting NFL predictions...');

    // Get upcoming NFL games (using Eastern Time zone)
    const todayEST = getNowInEST();
    const sevenDaysFromNowEST = new Date(todayEST);
    sevenDaysFromNowEST.setDate(sevenDaysFromNowEST.getDate() + 7);

    const { data: upcomingGames } = await supabase
      .from('sports_scores')
      .select('*')
      .eq('league', 'NFL')
      .gte('date', todayEST.toISOString())
      .lte('date', sevenDaysFromNowEST.toISOString())
      .order('date', { ascending: true });

    if (!upcomingGames || upcomingGames.length === 0) {
      return new Response(
        JSON.stringify({ success: true, predictions: 0, message: 'No upcoming NFL games found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[NFL_MODEL] Found ${upcomingGames.length} upcoming games`);

    const predictions = [];

    for (const game of upcomingGames) {
      try {
        const prediction = await generateNFLPrediction(supabase, game);
        predictions.push(prediction);

        // Store prediction
        await supabase.from('model_predictions').upsert(prediction, {
          onConflict: 'model_id,event_id,prediction_type',
        });
      } catch (error) {
        console.error(`[NFL_MODEL] Error predicting game ${game.event_id}:`, error);
      }
    }

    console.log(`[NFL_MODEL] Generated ${predictions.length} predictions`);

    return new Response(
      JSON.stringify({
        success: true,
        predictions: predictions.length,
        data: predictions,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[NFL_MODEL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateNFLPrediction(supabase: any, game: any) {
  // Get model
  const { data: model } = await supabase
    .from('prediction_models')
    .select('*')
    .eq('model_name', NFL_MODEL_CONFIG.name)
    .single();

  const modelId = model?.id || await createModel(supabase);

  // Extract features
  const features = await extractNFLFeatures(supabase, game);

  // Calculate predicted scores using weighted features
  const { predictedHomeScore, predictedAwayScore, confidence } = calculateNFLScores(features);

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
    sport: 'NFL',
    league: 'NFL',
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

async function extractNFLFeatures(supabase: any, game: any) {
  const features: any = {
    homeAdvantage: 2.5, // NFL standard home field advantage
    divisionGame: isDivisionGame(game.home_team, game.away_team) ? 1 : 0,
  };

  // Get team records
  const homeRecord = parseRecord(game.home_record);
  const awayRecord = parseRecord(game.away_record);

  features.homeWinPct = homeRecord.winPct;
  features.awayWinPct = awayRecord.winPct;
  features.recordDifferential = homeRecord.winPct - awayRecord.winPct;

  // Get rest days (schedule factors)
  const { data: scheduleFactors } = await supabase
    .from('team_schedule_factors')
    .select('*')
    .in('team', [game.home_team, game.away_team])
    .eq('game_date', formatDateEST(new Date(game.date)));

  if (scheduleFactors && scheduleFactors.length > 0) {
    const homeSchedule = scheduleFactors.find((s: any) => s.team === game.home_team);
    const awaySchedule = scheduleFactors.find((s: any) => s.team === game.away_team);

    features.homeRestDays = homeSchedule?.rest_days || 7;
    features.awayRestDays = awaySchedule?.rest_days || 7;
    features.restAdvantage = features.homeRestDays - features.awayRestDays;
  }

  // Get injuries
  const { data: injuries } = await supabase
    .from('injury_reports')
    .select('*')
    .in('team', [game.home_team, game.away_team])
    .in('injury_status', ['Out', 'Doubtful'])
    .eq('league', 'NFL');

  if (injuries) {
    const homeInjuries = injuries.filter((i: any) => i.team === game.home_team);
    const awayInjuries = injuries.filter((i: any) => i.team === game.away_team);

    features.homeHighImpactInjuries = homeInjuries.filter((i: any) => i.impact_level === 'High').length;
    features.awayHighImpactInjuries = awayInjuries.filter((i: any) => i.impact_level === 'High').length;
    features.injuryImpact = features.awayHighImpactInjuries - features.homeHighImpactInjuries;
  }

  // Weather impact (for outdoor stadiums)
  features.weatherImpact = 0; // TODO: Integrate with weather data

  return features;
}

function calculateNFLScores(features: any) {
  // NFL average score is ~23 points per team
  const NFL_AVG_SCORE = 23;

  // Calculate home team advantage
  let homeAdjustment = features.homeAdvantage;

  // Adjust for record differential
  homeAdjustment += features.recordDifferential * 7; // Strong teams score ~7 more

  // Adjust for rest
  homeAdjustment += features.restAdvantage * 0.3;

  // Adjust for injuries
  homeAdjustment += features.injuryImpact * 1.5;

  // Division game adjustments (typically closer games)
  if (features.divisionGame) {
    homeAdjustment *= 0.8; // Reduce advantage in division games
  }

  // Calculate predicted scores
  const predictedHomeScore = NFL_AVG_SCORE + homeAdjustment / 2;
  const predictedAwayScore = NFL_AVG_SCORE - homeAdjustment / 2;

  // Calculate confidence (0-100)
  const confidence = Math.min(100, Math.abs(homeAdjustment) * 8 + 50);

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
    return { spread: 0, total: 0, homeML: -110, awayML: -110 };
  }

  const latestOdds = odds[0];
  const outcomes = latestOdds.outcomes;

  // Extract spread
  const spreadOutcome = outcomes.find((o: any) => o.point !== undefined);
  const spread = spreadOutcome?.point || 0;

  // Extract totals (would need totals market)
  const total = 46; // NFL average total

  // Extract moneyline
  const homeML = outcomes.find((o: any) => o.name === latestOdds.home_team)?.price || -110;
  const awayML = outcomes.find((o: any) => o.name === latestOdds.away_team)?.price || -110;

  return { spread, total, homeML, awayML };
}

function calculateFairOdds(predictedSpread: number, predictedTotal: number) {
  // Convert spread to fair moneyline odds
  const winProb = calculateWinProbability(predictedSpread);

  const homeML = probabilityToOdds(winProb);
  const awayML = probabilityToOdds(1 - winProb);

  // Totals odds (simplified - assume 50/50 with slight vig)
  const over = -105;
  const under = -105;

  return { homeML, awayML, over, under };
}

function calculateWinProbability(spread: number): number {
  // Convert spread to win probability using logistic curve
  // NFL standard deviation ~13 points
  const stdDev = 13;
  const z = spread / stdDev;

  // Logistic function approximation
  const prob = 1 / (1 + Math.exp(-0.5 * z));

  return Math.max(0.01, Math.min(0.99, prob));
}

function probabilityToOdds(probability: number): number {
  if (probability >= 0.5) {
    // Favorite (negative odds)
    return Math.round(-100 * (probability / (1 - probability)));
  } else {
    // Underdog (positive odds)
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
  // NFL standard deviation for spread ~13 points
  const stdDev = 13;

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
  // NFL standard deviation for totals ~13 points
  const stdDev = 13;

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

function isDivisionGame(team1: string, team2: string): boolean {
  // NFL divisions (simplified)
  const divisions = {
    'AFC_East': ['Buffalo Bills', 'Miami Dolphins', 'New England Patriots', 'New York Jets'],
    'AFC_North': ['Baltimore Ravens', 'Cincinnati Bengals', 'Cleveland Browns', 'Pittsburgh Steelers'],
    'AFC_South': ['Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars', 'Tennessee Titans'],
    'AFC_West': ['Denver Broncos', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers'],
    'NFC_East': ['Dallas Cowboys', 'New York Giants', 'Philadelphia Eagles', 'Washington Commanders'],
    'NFC_North': ['Chicago Bears', 'Detroit Lions', 'Green Bay Packers', 'Minnesota Vikings'],
    'NFC_South': ['Atlanta Falcons', 'Carolina Panthers', 'New Orleans Saints', 'Tampa Bay Buccaneers'],
    'NFC_West': ['Arizona Cardinals', 'Los Angeles Rams', 'San Francisco 49ers', 'Seattle Seahawks'],
  };

  for (const teams of Object.values(divisions)) {
    if (teams.includes(team1) && teams.includes(team2)) {
      return true;
    }
  }

  return false;
}

async function createModel(supabase: any) {
  const { data, error } = await supabase
    .from('prediction_models')
    .insert({
      model_name: NFL_MODEL_CONFIG.name,
      sport: 'NFL',
      model_type: 'spread',
      version: NFL_MODEL_CONFIG.version,
      features: NFL_MODEL_CONFIG.weights,
      hyperparameters: {},
      is_active: true,
      last_trained_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('[NFL_MODEL] Error creating model:', error);
    throw error;
  }

  return data.id;
}
