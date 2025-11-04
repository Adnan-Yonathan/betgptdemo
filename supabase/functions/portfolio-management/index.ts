import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// DATE UTILITIES (inline to avoid bundling issues)
// ============================================================================

function getTodayEST(): string {
  const estDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getYesterdayEST(): string {
  const estDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  estDate.setDate(estDate.getDate() - 1);
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDaysAgoEST(days: number): string {
  const estDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  estDate.setDate(estDate.getDate() - days);
  const year = estDate.getFullYear();
  const month = String(estDate.getMonth() + 1).padStart(2, '0');
  const day = String(estDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getHoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

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

      case 'analyze_betting_behavior':
        return await analyzeBettingBehavior(supabase, user.id);

      case 'get_advisory_recommendations':
        return await getAdvisoryRecommendations(supabase, user.id);

      case 'check_bet_approval':
        return await checkBetApproval(supabase, user.id, params);

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

// ============================================================================
// EXPOSURE CALCULATION
// ============================================================================

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

  // Update daily exposure (using Eastern Time zone)
  await supabase.from('daily_risk_exposure').upsert({
    user_id: userId,
    date: getTodayEST(),
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

// ============================================================================
// CORRELATION DETECTION
// ============================================================================

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

// ============================================================================
// KELLY CRITERION CALCULATION
// ============================================================================

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

// ============================================================================
// PORTFOLIO SUMMARY
// ============================================================================

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
    .eq('date', getTodayEST())
    .single();

  // Get pending correlation warnings
  const { data: warnings } = await supabase
    .from('bet_correlation_warnings')
    .select('*')
    .eq('user_id', userId)
    .eq('acknowledged', false);

  // Get recent performance (last 30 days)
  const { data: recentBets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .in('outcome', ['win', 'loss', 'push'])
    .gte('created_at', getDaysAgoEST(30))
    .order('created_at', { ascending: false });

  // Calculate win rate and streak
  let wins = 0, losses = 0, pushes = 0;
  let currentStreak = 0, streakType = 'none';

  if (recentBets && recentBets.length > 0) {
    wins = recentBets.filter((b: any) => b.outcome === 'win').length;
    losses = recentBets.filter((b: any) => b.outcome === 'loss').length;
    pushes = recentBets.filter((b: any) => b.outcome === 'push').length;

    // Calculate current streak
    const lastOutcome = recentBets[0].outcome;
    if (lastOutcome !== 'push') {
      streakType = lastOutcome;
      currentStreak = 1;
      for (let i = 1; i < recentBets.length; i++) {
        if (recentBets[i].outcome === lastOutcome) {
          currentStreak++;
        } else if (recentBets[i].outcome !== 'push') {
          break;
        }
      }
    }
  }

  const summary = {
    bankroll: bankroll?.current_amount || 0,
    startingBankroll: bankroll?.starting_amount || 0,
    profitLoss: (bankroll?.current_amount || 0) - (bankroll?.starting_amount || 0),
    activeBets: activeBets?.length || 0,
    totalExposure: todayExposure?.total_amount_risked || 0,
    exposurePercentage: bankroll ? (todayExposure?.total_amount_risked || 0) / bankroll.current_amount * 100 : 0,
    correlationWarnings: warnings?.length || 0,
    recentPerformance: {
      wins,
      losses,
      pushes,
      winRate: (wins + losses + pushes) > 0 ? (wins / (wins + losses + pushes)) * 100 : 0,
      currentStreak,
      streakType,
    },
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

// ============================================================================
// RISK LIMITS CHECK
// ============================================================================

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
    .eq('date', getTodayEST())
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

// ============================================================================
// BETTING BEHAVIOR ANALYSIS (NEW)
// ============================================================================

async function analyzeBettingBehavior(supabase: any, userId: string) {
  // Get all bets from last 30 days
  const { data: recentBets } = await supabase
    .from('bets')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', getDaysAgoEST(30))
    .order('created_at', { ascending: false });

  // Get user's bankroll for context
  const { data: bankroll } = await supabase
    .from('user_bankroll')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (!recentBets || recentBets.length === 0) {
    return new Response(
      JSON.stringify({
        frequencyAnalysis: { status: 'insufficient_data' },
        streakAnalysis: { status: 'insufficient_data' },
        tiltDetection: { status: 'insufficient_data' },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // === FREQUENCY ANALYSIS ===
  const frequencyAnalysis = analyzeFrequency(recentBets);

  // === STREAK ANALYSIS ===
  const streakAnalysis = analyzeStreaks(recentBets);

  // === TILT DETECTION ===
  const tiltDetection = analyzeTilt(recentBets, bankroll);

  // === BET SIZE ANALYSIS ===
  const betSizeAnalysis = analyzeBetSizes(recentBets, bankroll);

  const analysis = {
    frequencyAnalysis,
    streakAnalysis,
    tiltDetection,
    betSizeAnalysis,
    timestamp: new Date().toISOString(),
  };

  return new Response(
    JSON.stringify(analysis),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

function analyzeFrequency(bets: any[]): any {
  const now = new Date();

  // Bets in last 24 hours
  const last24Hours = bets.filter(b => {
    const betDate = new Date(b.created_at);
    return (now.getTime() - betDate.getTime()) < 24 * 60 * 60 * 1000;
  });

  // Bets in last 7 days
  const last7Days = bets.filter(b => {
    const betDate = new Date(b.created_at);
    return (now.getTime() - betDate.getTime()) < 7 * 24 * 60 * 60 * 1000;
  });

  const betsPerDay = last7Days.length / 7;
  const betsToday = last24Hours.length;

  // Check for rapid-fire betting (multiple bets within 1 hour)
  let rapidFireCount = 0;
  for (let i = 0; i < bets.length - 1; i++) {
    const timeDiff = new Date(bets[i].created_at).getTime() - new Date(bets[i + 1].created_at).getTime();
    if (timeDiff < 60 * 60 * 1000) { // Within 1 hour
      rapidFireCount++;
    }
  }

  const avgBetsPerDay = bets.length / 30;
  const isOverBetting = betsToday > avgBetsPerDay * 2;

  return {
    betsLast24Hours: betsToday,
    betsLast7Days: last7Days.length,
    averageBetsPerDay: Math.round(betsPerDay * 10) / 10,
    rapidFireBets: rapidFireCount,
    isOverBetting,
    warning: isOverBetting ? 'You are betting more frequently than usual. Consider taking a break.' : null,
  };
}

function analyzeStreaks(bets: any[]): any {
  const settledBets = bets.filter(b => b.outcome && b.outcome !== 'pending');

  if (settledBets.length === 0) {
    return { status: 'insufficient_data' };
  }

  // Current streak
  let currentStreak = 0;
  let streakType = 'none';
  const lastOutcome = settledBets[0].outcome;

  if (lastOutcome !== 'push') {
    streakType = lastOutcome;
    currentStreak = 1;
    for (let i = 1; i < settledBets.length; i++) {
      if (settledBets[i].outcome === lastOutcome) {
        currentStreak++;
      } else if (settledBets[i].outcome !== 'push') {
        break;
      }
    }
  }

  // Find longest streaks
  let longestWinStreak = 0;
  let longestLossStreak = 0;
  let tempWinStreak = 0;
  let tempLossStreak = 0;

  for (const bet of settledBets) {
    if (bet.outcome === 'win') {
      tempWinStreak++;
      tempLossStreak = 0;
      longestWinStreak = Math.max(longestWinStreak, tempWinStreak);
    } else if (bet.outcome === 'loss') {
      tempLossStreak++;
      tempWinStreak = 0;
      longestLossStreak = Math.max(longestLossStreak, tempLossStreak);
    }
  }

  const isHotStreak = streakType === 'win' && currentStreak >= 3;
  const isColdStreak = streakType === 'loss' && currentStreak >= 3;

  let recommendation = null;
  if (isHotStreak) {
    recommendation = `You're on a ${currentStreak}-game win streak! Maintain discipline and stick to your bet sizing strategy.`;
  } else if (isColdStreak) {
    recommendation = `You're on a ${currentStreak}-game losing streak. Consider reducing bet sizes or taking a break to reset.`;
  }

  return {
    currentStreak,
    streakType,
    isHotStreak,
    isColdStreak,
    longestWinStreak,
    longestLossStreak,
    recommendation,
  };
}

function analyzeTilt(bets: any[], bankroll: any): any {
  const settledBets = bets.filter(b => b.outcome && b.outcome !== 'pending');

  if (settledBets.length < 5) {
    return { status: 'insufficient_data', isTilting: false };
  }

  let tiltIndicators = [];
  let tiltScore = 0;

  // 1. Revenge betting - betting immediately after losses
  let revengeBets = 0;
  for (let i = 0; i < settledBets.length - 1; i++) {
    if (settledBets[i].outcome === 'loss') {
      const nextBet = bets.find(b => new Date(b.created_at) > new Date(settledBets[i].created_at));
      if (nextBet) {
        const timeDiff = new Date(nextBet.created_at).getTime() - new Date(settledBets[i].created_at).getTime();
        if (timeDiff < 15 * 60 * 1000) { // Within 15 minutes
          revengeBets++;
        }
      }
    }
  }

  if (revengeBets >= 2) {
    tiltScore += 30;
    tiltIndicators.push('Revenge betting detected - placing bets quickly after losses');
  }

  // 2. Chasing losses - increasing bet size after losses
  let chasingLosses = 0;
  for (let i = 0; i < settledBets.length - 1; i++) {
    if (settledBets[i].outcome === 'loss') {
      const nextBet = settledBets[i + 1];
      if (nextBet && nextBet.amount > settledBets[i].amount * 1.5) {
        chasingLosses++;
      }
    }
  }

  if (chasingLosses >= 2) {
    tiltScore += 35;
    tiltIndicators.push('Chasing losses - increasing bet sizes after losses');
  }

  // 3. Betting outside comfort zone (unfamiliar sports)
  const sportCounts: { [key: string]: number } = {};
  bets.forEach(b => {
    const sport = b.sport || 'Unknown';
    sportCounts[sport] = (sportCounts[sport] || 0) + 1;
  });

  const recentSports = bets.slice(0, 5).map(b => b.sport);
  const unfamiliarBets = recentSports.filter(sport => {
    const totalBetsInSport = sportCounts[sport] || 0;
    return totalBetsInSport <= 2;
  }).length;

  if (unfamiliarBets >= 2) {
    tiltScore += 20;
    tiltIndicators.push('Betting on unfamiliar sports/markets');
  }

  // 4. Late night betting (11 PM - 5 AM EST)
  let lateNightBets = 0;
  bets.forEach(b => {
    const betDate = new Date(b.created_at);
    const hour = betDate.getHours();
    if (hour >= 23 || hour <= 5) {
      lateNightBets++;
    }
  });

  if (lateNightBets >= 3) {
    tiltScore += 15;
    tiltIndicators.push('Late night betting pattern detected');
  }

  // 5. High variance in bet sizes (indicating emotional betting)
  if (bankroll) {
    const betSizes = bets.map(b => b.amount / bankroll.current_amount);
    const avgBetSize = betSizes.reduce((a, b) => a + b, 0) / betSizes.length;
    const variance = betSizes.reduce((sum, size) => sum + Math.pow(size - avgBetSize, 2), 0) / betSizes.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev > avgBetSize) {
      tiltScore += 20;
      tiltIndicators.push('High variance in bet sizes - inconsistent strategy');
    }
  }

  const isTilting = tiltScore >= 50;
  const isMildTilt = tiltScore >= 30 && tiltScore < 50;

  let recommendation = null;
  if (isTilting) {
    recommendation = '🚨 STRONG TILT WARNING: Take a break from betting. Your betting patterns suggest emotional decision-making.';
  } else if (isMildTilt) {
    recommendation = '⚠️ Mild tilt detected. Be mindful of your betting decisions and stick to your strategy.';
  }

  return {
    isTilting,
    isMildTilt,
    tiltScore,
    tiltIndicators,
    recommendation,
    revengeBets,
    chasingLosses,
    lateNightBets,
  };
}

function analyzeBetSizes(bets: any[], bankroll: any): any {
  if (!bankroll || bets.length === 0) {
    return { status: 'insufficient_data' };
  }

  const betSizesPercent = bets.map(b => (b.amount / bankroll.current_amount) * 100);
  const avgBetSize = betSizesPercent.reduce((a, b) => a + b, 0) / betSizesPercent.length;
  const maxBetSize = Math.max(...betSizesPercent);
  const minBetSize = Math.min(...betSizesPercent);

  // Calculate standard deviation
  const variance = betSizesPercent.reduce((sum, size) => sum + Math.pow(size - avgBetSize, 2), 0) / betSizesPercent.length;
  const stdDev = Math.sqrt(variance);

  // Check consistency with Kelly
  let kellyDeviation = 0;
  bets.forEach(b => {
    if (b.kelly_fraction) {
      const actualPercent = (b.amount / bankroll.current_amount);
      const kellyPercent = b.kelly_fraction;
      kellyDeviation += Math.abs(actualPercent - kellyPercent);
    }
  });

  const avgKellyDeviation = bets.filter(b => b.kelly_fraction).length > 0
    ? kellyDeviation / bets.filter(b => b.kelly_fraction).length
    : 0;

  const isConsistent = stdDev < avgBetSize * 0.5;
  const followsKelly = avgKellyDeviation < 0.02; // Within 2%

  return {
    averageBetSize: Math.round(avgBetSize * 100) / 100,
    maxBetSize: Math.round(maxBetSize * 100) / 100,
    minBetSize: Math.round(minBetSize * 100) / 100,
    standardDeviation: Math.round(stdDev * 100) / 100,
    isConsistent,
    followsKelly,
    avgKellyDeviation: Math.round(avgKellyDeviation * 10000) / 10000,
  };
}

// ============================================================================
// ADVISORY RECOMMENDATIONS (NEW)
// ============================================================================

async function getAdvisoryRecommendations(supabase: any, userId: string) {
  // Gather all data
  const behaviorResponse = await analyzeBettingBehavior(supabase, userId);
  const behaviorData = await behaviorResponse.json();

  const summaryResponse = await getPortfolioSummary(supabase, userId);
  const summaryData = await summaryResponse.json();

  // Get bankroll
  const { data: bankroll } = await supabase
    .from('user_bankroll')
    .select('*')
    .eq('user_id', userId)
    .single();

  const recommendations = [];
  let overallScore = 100; // Start at 100, deduct for issues

  // === TILT ASSESSMENT ===
  if (behaviorData.tiltDetection?.isTilting) {
    recommendations.push({
      priority: 'critical',
      category: 'behavioral',
      title: 'Take a Break - Tilt Detected',
      message: behaviorData.tiltDetection.recommendation,
      action: 'Stop betting for at least 24 hours to reset emotionally.',
      indicators: behaviorData.tiltDetection.tiltIndicators,
    });
    overallScore -= 40;
  } else if (behaviorData.tiltDetection?.isMildTilt) {
    recommendations.push({
      priority: 'high',
      category: 'behavioral',
      title: 'Caution - Mild Tilt Detected',
      message: behaviorData.tiltDetection.recommendation,
      action: 'Review your recent bets and ensure you\'re following your strategy.',
    });
    overallScore -= 20;
  }

  // === FREQUENCY ASSESSMENT ===
  if (behaviorData.frequencyAnalysis?.isOverBetting) {
    recommendations.push({
      priority: 'high',
      category: 'frequency',
      title: 'Betting Too Frequently',
      message: behaviorData.frequencyAnalysis.warning,
      action: 'Limit yourself to your average daily bet count.',
      stats: {
        betsToday: behaviorData.frequencyAnalysis.betsLast24Hours,
        averagePerDay: behaviorData.frequencyAnalysis.averageBetsPerDay,
      },
    });
    overallScore -= 15;
  }

  if (behaviorData.frequencyAnalysis?.rapidFireBets > 3) {
    recommendations.push({
      priority: 'medium',
      category: 'frequency',
      title: 'Rapid-Fire Betting Detected',
      message: `You've placed ${behaviorData.frequencyAnalysis.rapidFireBets} bets within short time periods.`,
      action: 'Space out your bets and do proper research before each wager.',
    });
    overallScore -= 10;
  }

  // === STREAK ASSESSMENT ===
  if (behaviorData.streakAnalysis?.isColdStreak) {
    recommendations.push({
      priority: 'high',
      category: 'performance',
      title: 'Cold Streak Alert',
      message: behaviorData.streakAnalysis.recommendation,
      action: 'Consider reducing bet sizes by 50% until you break the streak.',
      streak: `${behaviorData.streakAnalysis.currentStreak} losses`,
    });
    overallScore -= 15;
  } else if (behaviorData.streakAnalysis?.isHotStreak) {
    recommendations.push({
      priority: 'low',
      category: 'performance',
      title: 'Hot Streak - Stay Disciplined',
      message: behaviorData.streakAnalysis.recommendation,
      action: 'Don\'t increase bet sizes due to confidence. Stick to your strategy.',
      streak: `${behaviorData.streakAnalysis.currentStreak} wins`,
    });
    // Don't deduct points for hot streaks, but remind about discipline
  }

  // === BET SIZING ASSESSMENT ===
  if (behaviorData.betSizeAnalysis?.followsKelly === false) {
    recommendations.push({
      priority: 'medium',
      category: 'risk_management',
      title: 'Deviating from Kelly Criterion',
      message: 'Your bet sizes are not following the Kelly recommendations.',
      action: 'Use the Kelly calculator for each bet to optimize long-term growth.',
      deviation: `${(behaviorData.betSizeAnalysis.avgKellyDeviation * 100).toFixed(1)}% average deviation`,
    });
    overallScore -= 10;
  }

  if (!behaviorData.betSizeAnalysis?.isConsistent) {
    recommendations.push({
      priority: 'medium',
      category: 'risk_management',
      title: 'Inconsistent Bet Sizing',
      message: 'Your bet sizes vary significantly, indicating lack of strategy.',
      action: 'Develop a consistent bet sizing strategy based on edge and bankroll.',
      stats: behaviorData.betSizeAnalysis,
    });
    overallScore -= 10;
  }

  // === EXPOSURE ASSESSMENT ===
  if (summaryData.exposurePercentage > 20) {
    recommendations.push({
      priority: 'high',
      category: 'risk_management',
      title: 'High Portfolio Exposure',
      message: `You have ${summaryData.exposurePercentage.toFixed(1)}% of your bankroll in active bets.`,
      action: 'Reduce exposure by avoiding new bets until some resolve.',
    });
    overallScore -= 15;
  }

  if (summaryData.correlationWarnings > 0) {
    recommendations.push({
      priority: 'medium',
      category: 'diversification',
      title: 'Correlated Bets Warning',
      message: `You have ${summaryData.correlationWarnings} highly correlated bets.`,
      action: 'Diversify across different sports, leagues, and games.',
    });
    overallScore -= 10;
  }

  // === BANKROLL ASSESSMENT ===
  const profitLossPercent = (summaryData.profitLoss / summaryData.startingBankroll) * 100;
  if (profitLossPercent < -20) {
    recommendations.push({
      priority: 'critical',
      category: 'bankroll',
      title: 'Significant Bankroll Drawdown',
      message: `You're down ${Math.abs(profitLossPercent).toFixed(1)}% from your starting bankroll.`,
      action: 'Consider stopping betting or reducing unit sizes significantly until you rebuild confidence.',
    });
    overallScore -= 25;
  }

  // === POSITIVE FEEDBACK ===
  if (recommendations.length === 0 || overallScore > 80) {
    recommendations.push({
      priority: 'low',
      category: 'positive',
      title: 'Good Betting Discipline',
      message: 'You\'re showing strong discipline and risk management.',
      action: 'Keep following your strategy and stay patient.',
    });
  }

  // Sort by priority
  const priorityOrder: { [key: string]: number } = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return new Response(
    JSON.stringify({
      overallScore: Math.max(0, overallScore),
      scoreRating: overallScore >= 80 ? 'Excellent' :
                   overallScore >= 60 ? 'Good' :
                   overallScore >= 40 ? 'Fair' :
                   overallScore >= 20 ? 'Poor' : 'Critical',
      recommendations,
      timestamp: new Date().toISOString(),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

// ============================================================================
// COMPREHENSIVE BET APPROVAL CHECK (NEW)
// ============================================================================

async function checkBetApproval(supabase: any, userId: string, params: any) {
  const { betAmount, odds, sport, eventId } = params;

  // Run all checks
  const riskResponse = await checkRiskLimits(supabase, userId, betAmount);
  const riskData = await riskResponse.json();

  const behaviorResponse = await analyzeBettingBehavior(supabase, userId);
  const behaviorData = await behaviorResponse.json();

  const advisoryResponse = await getAdvisoryRecommendations(supabase, userId);
  const advisoryData = await advisoryResponse.json();

  // Determine approval status
  let approved = true;
  let warnings = [];
  let blockers = [];

  // Check risk limits
  if (!riskData.allowed) {
    approved = false;
    blockers.push(...riskData.warnings);
  }

  // Check for tilt
  if (behaviorData.tiltDetection?.isTilting) {
    approved = false;
    blockers.push({
      type: 'tilt_detected',
      message: 'Strong tilt detected. Take a break before betting.',
      severity: 'critical',
    });
  }

  // Add warnings for concerning patterns
  if (behaviorData.tiltDetection?.isMildTilt) {
    warnings.push({
      type: 'mild_tilt',
      message: 'Mild tilt detected. Be mindful of your decisions.',
      severity: 'medium',
    });
  }

  if (behaviorData.frequencyAnalysis?.isOverBetting) {
    warnings.push({
      type: 'over_betting',
      message: behaviorData.frequencyAnalysis.warning,
      severity: 'medium',
    });
  }

  if (behaviorData.streakAnalysis?.isColdStreak) {
    warnings.push({
      type: 'cold_streak',
      message: 'Consider reducing bet size during losing streak.',
      severity: 'low',
    });
  }

  return new Response(
    JSON.stringify({
      approved,
      blockers,
      warnings,
      advisoryScore: advisoryData.overallScore,
      recommendation: approved
        ? 'Bet approved - proceed with caution'
        : 'Bet not recommended - address issues first',
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}
