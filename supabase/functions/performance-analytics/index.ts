import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Calculate statistical confidence interval for win rate
 */
function calculateWinRateConfidence(wins: number, total: number, confidence = 0.95): {
  lower: number;
  upper: number;
} {
  if (total === 0) return { lower: 0, upper: 0 };

  const winRate = wins / total;
  const z = 1.96; // 95% confidence
  const standardError = Math.sqrt((winRate * (1 - winRate)) / total);

  return {
    lower: Math.max(0, winRate - (z * standardError)),
    upper: Math.min(1, winRate + (z * standardError)),
  };
}

/**
 * Calculate Sharpe Ratio for betting performance
 * Measures risk-adjusted returns
 */
function calculateSharpeRatio(
  returns: number[],
  riskFreeRate = 0 // Assume 0% risk-free rate
): number {
  if (returns.length === 0) return 0;

  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;

  const variance = returns.reduce((sum, ret) =>
    sum + Math.pow(ret - avgReturn, 2), 0
  ) / returns.length;

  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  return (avgReturn - riskFreeRate) / stdDev;
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

    const { groupBy = 'overall', timeRange = 'all' } = await req.json().catch(() => ({}));

    console.log('=== PERFORMANCE ANALYTICS CALLED ===');
    console.log('User ID:', user.id);
    console.log('Group by:', groupBy);
    console.log('Time range:', timeRange);

    // Get user's settled bets
    let query = supabaseClient
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .in('outcome', ['win', 'loss', 'push']);

    // Apply time filter
    if (timeRange === 'last_7_days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      query = query.gte('created_at', sevenDaysAgo.toISOString());
    } else if (timeRange === 'last_30_days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      query = query.gte('created_at', thirtyDaysAgo.toISOString());
    }

    const { data: bets, error: betsError } = await query;

    if (betsError) {
      throw betsError;
    }

    if (!bets || bets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No settled bets found',
        analytics: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Overall statistics
    const totalBets = bets.length;
    const wins = bets.filter(b => b.outcome === 'win').length;
    const losses = bets.filter(b => b.outcome === 'loss').length;
    const pushes = bets.filter(b => b.outcome === 'push').length;

    const totalWagered = bets.reduce((sum, b) => sum + Number(b.amount), 0);
    const totalReturned = bets.reduce((sum, b) => sum + Number(b.actual_return || 0), 0);
    const netProfit = totalReturned - totalWagered;

    const winRate = losses + wins > 0 ? wins / (wins + losses) : 0;
    const roi = totalWagered > 0 ? (netProfit / totalWagered) * 100 : 0;

    // CLV statistics
    const betsWithCLV = bets.filter(b => b.clv !== null);
    const avgCLV = betsWithCLV.length > 0
      ? betsWithCLV.reduce((sum, b) => sum + Number(b.clv), 0) / betsWithCLV.length
      : 0;
    const positiveCLVBets = betsWithCLV.filter(b => Number(b.clv) > 0).length;

    // Expected Value tracking
    const betsWithEV = bets.filter(b => b.expected_value !== null);
    const totalExpectedValue = betsWithEV.reduce((sum, b) => sum + Number(b.expected_value), 0);
    const actualValue = netProfit;
    const evAccuracy = totalExpectedValue !== 0 ? (actualValue / totalExpectedValue) * 100 : 0;

    // Calculate returns for Sharpe Ratio
    const returns = bets.map(b => {
      const profit = Number(b.actual_return || 0) - Number(b.amount);
      return profit / Number(b.amount);
    });

    const sharpeRatio = calculateSharpeRatio(returns);

    // Win rate confidence interval
    const winRateCI = calculateWinRateConfidence(wins, wins + losses);

    // Grouping analytics
    let groupedAnalytics = {};

    if (groupBy === 'sport') {
      const sports = [...new Set(bets.map(b => b.sport).filter(Boolean))];

      groupedAnalytics = Object.fromEntries(
        sports.map(sport => {
          const sportBets = bets.filter(b => b.sport === sport);
          const sportWins = sportBets.filter(b => b.outcome === 'win').length;
          const sportLosses = sportBets.filter(b => b.outcome === 'loss').length;
          const sportWagered = sportBets.reduce((sum, b) => sum + Number(b.amount), 0);
          const sportReturned = sportBets.reduce((sum, b) => sum + Number(b.actual_return || 0), 0);

          return [sport, {
            totalBets: sportBets.length,
            wins: sportWins,
            losses: sportLosses,
            winRate: sportWins + sportLosses > 0 ? sportWins / (sportWins + sportLosses) : 0,
            totalWagered: sportWagered,
            netProfit: sportReturned - sportWagered,
            roi: sportWagered > 0 ? ((sportReturned - sportWagered) / sportWagered) * 100 : 0,
          }];
        })
      );
    } else if (groupBy === 'bet_type') {
      const betTypes = [...new Set(bets.map(b => b.bet_type || 'straight'))];

      groupedAnalytics = Object.fromEntries(
        betTypes.map(betType => {
          const typeBets = bets.filter(b => (b.bet_type || 'straight') === betType);
          const typeWins = typeBets.filter(b => b.outcome === 'win').length;
          const typeLosses = typeBets.filter(b => b.outcome === 'loss').length;
          const typeWagered = typeBets.reduce((sum, b) => sum + Number(b.amount), 0);
          const typeReturned = typeBets.reduce((sum, b) => sum + Number(b.actual_return || 0), 0);

          return [betType, {
            totalBets: typeBets.length,
            wins: typeWins,
            losses: typeLosses,
            winRate: typeWins + typeLosses > 0 ? typeWins / (typeWins + typeLosses) : 0,
            totalWagered: typeWagered,
            netProfit: typeReturned - typeWagered,
            roi: typeWagered > 0 ? ((typeReturned - typeWagered) / typeWagered) * 100 : 0,
          }];
        })
      );
    } else if (groupBy === 'team') {
      const teams = [...new Set(bets.map(b => b.team_bet_on).filter(Boolean))];

      groupedAnalytics = Object.fromEntries(
        teams.slice(0, 20).map(team => { // Limit to top 20 teams
          const teamBets = bets.filter(b => b.team_bet_on === team);
          const teamWins = teamBets.filter(b => b.outcome === 'win').length;
          const teamLosses = teamBets.filter(b => b.outcome === 'loss').length;
          const teamWagered = teamBets.reduce((sum, b) => sum + Number(b.amount), 0);
          const teamReturned = teamBets.reduce((sum, b) => sum + Number(b.actual_return || 0), 0);

          return [team, {
            totalBets: teamBets.length,
            wins: teamWins,
            losses: teamLosses,
            winRate: teamWins + teamLosses > 0 ? teamWins / (teamWins + teamLosses) : 0,
            totalWagered: teamWagered,
            netProfit: teamReturned - teamWagered,
            roi: teamWagered > 0 ? ((teamReturned - teamWagered) / teamWagered) * 100 : 0,
          }];
        })
      );
    }

    // Statistical insights
    const insights = [];

    if (avgCLV > 1) {
      insights.push({
        type: 'positive',
        message: `Strong CLV performance: +${avgCLV.toFixed(2)}% average - you're beating closing lines`,
        stat: 'CLV',
        value: avgCLV,
      });
    } else if (avgCLV < -1) {
      insights.push({
        type: 'negative',
        message: `Negative CLV: ${avgCLV.toFixed(2)}% - you're getting worse odds than closing lines`,
        stat: 'CLV',
        value: avgCLV,
      });
    }

    if (sharpeRatio > 1) {
      insights.push({
        type: 'positive',
        message: `Excellent risk-adjusted returns (Sharpe: ${sharpeRatio.toFixed(2)})`,
        stat: 'Sharpe Ratio',
        value: sharpeRatio,
      });
    } else if (sharpeRatio < 0) {
      insights.push({
        type: 'negative',
        message: `Poor risk-adjusted returns (Sharpe: ${sharpeRatio.toFixed(2)}) - high variance for returns`,
        stat: 'Sharpe Ratio',
        value: sharpeRatio,
      });
    }

    if (roi > 5) {
      insights.push({
        type: 'positive',
        message: `Strong ROI: ${roi.toFixed(2)}% - well above breakeven`,
        stat: 'ROI',
        value: roi,
      });
    } else if (roi < -5) {
      insights.push({
        type: 'negative',
        message: `Negative ROI: ${roi.toFixed(2)}% - review your bet selection`,
        stat: 'ROI',
        value: roi,
      });
    }

    if (totalBets < 30) {
      insights.push({
        type: 'warning',
        message: `Small sample size (${totalBets} bets) - results not statistically significant yet`,
        stat: 'Sample Size',
        value: totalBets,
      });
    }

    if (positiveCLVBets / betsWithCLV.length > 0.55) {
      insights.push({
        type: 'positive',
        message: `${((positiveCLVBets / betsWithCLV.length) * 100).toFixed(1)}% positive CLV rate - consistently beating closing lines`,
        stat: 'Positive CLV %',
        value: positiveCLVBets / betsWithCLV.length,
      });
    }

    const response = {
      success: true,
      analytics: {
        overall: {
          totalBets,
          wins,
          losses,
          pushes,
          winRate: winRate * 100,
          winRateConfidence: {
            lower: winRateCI.lower * 100,
            upper: winRateCI.upper * 100,
          },
          totalWagered,
          totalReturned,
          netProfit,
          roi,
          avgCLV,
          positiveCLVBets,
          positiveCLVRate: betsWithCLV.length > 0 ? (positiveCLVBets / betsWithCLV.length) * 100 : 0,
          totalExpectedValue,
          evAccuracy,
          sharpeRatio,
          averageBetSize: totalBets > 0 ? totalWagered / totalBets : 0,
        },
        grouped: groupedAnalytics,
        insights,
        statisticalSignificance: totalBets >= 30 ? 'Statistically significant' : 'Insufficient sample size',
      },
    };

    console.log('Performance analytics complete');

    // Refresh materialized view for faster future queries
    try {
      await supabaseClient.rpc('refresh_bet_performance_analytics');
    } catch (e) {
      console.log('Note: Materialized view refresh failed (may not exist yet)');
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in performance-analytics function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
