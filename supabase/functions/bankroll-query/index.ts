import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BankrollQueryRequest {
  userId: string;
  query: string;
  verbosity?: "brief" | "detailed" | "specific";
  filter?: {
    sport?: string;
    timePeriod?: "today" | "week" | "month" | "all";
    betType?: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, query, verbosity = "brief", filter = {} }: BankrollQueryRequest = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing userId" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Bankroll query for user ${userId}: "${query}"`);

    // Get bankroll status
    const { data: bankrollStatus, error: bankrollError } = await supabase
      .rpc("get_user_bankroll_status", { p_user_id: userId });

    if (bankrollError) {
      console.error("Error fetching bankroll status:", bankrollError);
      throw bankrollError;
    }

    const status = bankrollStatus?.[0] || {
      current_balance: 1000,
      available_balance: 1000,
      pending_bets_amount: 0,
      starting_balance: 1000,
      profit_loss: 0,
      profit_loss_pct: 0,
      total_deposits: 0,
      total_withdrawals: 0,
    };

    // Get betting statistics
    const { data: overallStats, error: statsError } = await supabase
      .rpc("get_betting_stats", {
        p_user_id: userId,
        p_time_period: filter.timePeriod || "all",
        p_sport: filter.sport || null,
        p_status: "settled",
      });

    if (statsError) {
      console.error("Error fetching betting stats:", statsError);
      throw statsError;
    }

    const stats = overallStats?.[0] || {
      wins: 0,
      losses: 0,
      pushes: 0,
      total_bets: 0,
      win_rate: 0,
      total_wagered: 0,
      total_returned: 0,
      profit_loss: 0,
      roi: 0,
      largest_win: 0,
      largest_loss: 0,
      current_streak: 0,
      streak_type: "none",
    };

    // Get pending bets
    const { data: pendingBets, error: pendingError } = await supabase
      .from("bets")
      .select("*")
      .eq("user_id", userId)
      .eq("outcome", "pending")
      .order("created_at", { ascending: false });

    if (pendingError) {
      console.error("Error fetching pending bets:", pendingError);
    }

    // Get sport breakdown
    const { data: sportBreakdown, error: sportError } = await supabase
      .from("bets")
      .select("sport, outcome, amount, profit_loss")
      .eq("user_id", userId)
      .in("outcome", ["win", "loss", "push"]);

    if (sportError) {
      console.error("Error fetching sport breakdown:", sportError);
    }

    const sportStats = calculateSportStats(sportBreakdown || []);

    // Generate conversational response
    const response = await generateConversationalResponse({
      query,
      verbosity,
      bankrollStatus: status,
      stats,
      pendingBets: pendingBets || [],
      sportStats,
      filter,
    });

    return new Response(
      JSON.stringify({
        response,
        data: {
          bankrollStatus: status,
          stats,
          pendingBets: pendingBets || [],
          sportStats,
        },
        success: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in bankroll-query:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateSportStats(bets: any[]) {
  const sportMap = new Map();

  bets.forEach((bet) => {
    const sport = bet.sport || "Unknown";
    if (!sportMap.has(sport)) {
      sportMap.set(sport, {
        wins: 0,
        losses: 0,
        pushes: 0,
        profitLoss: 0,
      });
    }

    const sportStat = sportMap.get(sport);
    if (bet.outcome === "win") sportStat.wins++;
    else if (bet.outcome === "loss") sportStat.losses++;
    else if (bet.outcome === "push") sportStat.pushes++;

    sportStat.profitLoss += bet.profit_loss || 0;
  });

  const result: any[] = [];
  sportMap.forEach((stats, sport) => {
    const total = stats.wins + stats.losses + stats.pushes;
    const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
    result.push({
      sport,
      record: `${stats.wins}-${stats.losses}${stats.pushes > 0 ? `-${stats.pushes}` : ""}`,
      winRate: winRate.toFixed(1),
      profitLoss: stats.profitLoss,
    });
  });

  return result.sort((a, b) => b.profitLoss - a.profitLoss);
}

async function generateConversationalResponse(params: any): Promise<string> {
  const { query, verbosity, bankrollStatus, stats, pendingBets, sportStats, filter } = params;

  const formatCurrency = (val: number) => {
    const formatted = Math.abs(val).toFixed(2);
    return val >= 0 ? `$${formatted}` : `-$${formatted}`;
  };

  const formatPct = (val: number) => {
    return val >= 0 ? `+${val.toFixed(1)}%` : `${val.toFixed(1)}%`;
  };

  // Brief mode (default for simple queries)
  if (verbosity === "brief") {
    const profitEmoji = bankrollStatus.profit_loss >= 0 ? "📈" : "📉";
    const streakEmoji = stats.streak_type === "win" ? "🔥" : stats.streak_type === "loss" ? "❄️" : "";

    let response = `${profitEmoji} **Your Betting Status**\n\n`;
    response += `**Bankroll:** ${formatCurrency(bankrollStatus.current_balance)}\n`;
    response += `**Record:** ${stats.wins}-${stats.losses}`;
    if (stats.pushes > 0) response += `-${stats.pushes}`;
    response += ` (${stats.win_rate.toFixed(1)}% win rate)\n`;
    response += `**Profit/Loss:** ${formatCurrency(bankrollStatus.profit_loss)} (${formatPct(bankrollStatus.profit_loss_pct)})\n`;

    if (sportStats.length > 0) {
      const best = sportStats[0];
      const worst = sportStats[sportStats.length - 1];
      response += `\n**Best:** ${best.sport} (${best.record}, ${formatCurrency(best.profitLoss)})\n`;
      if (sportStats.length > 1) {
        response += `**Worst:** ${worst.sport} (${worst.record}, ${formatCurrency(worst.profitLoss)})\n`;
      }
    }

    if (pendingBets.length > 0) {
      response += `\n**Open Bets:** ${pendingBets.length} (${formatCurrency(bankrollStatus.pending_bets_amount)} at risk)\n`;
    }

    if (stats.current_streak >= 3) {
      response += `\n${streakEmoji} **Streak:** ${stats.current_streak} ${stats.streak_type}s in a row!\n`;
    }

    return response;
  }

  // Detailed mode (for "show me everything" queries)
  if (verbosity === "detailed") {
    let response = `📊 **Complete Bankroll Breakdown**\n\n`;

    // Bankroll section
    response += `**💰 BANKROLL**\n`;
    response += `Current: ${formatCurrency(bankrollStatus.current_balance)}\n`;
    response += `Started: ${formatCurrency(bankrollStatus.starting_balance)}\n`;
    response += `Profit: ${formatCurrency(bankrollStatus.profit_loss)} (${formatPct(bankrollStatus.profit_loss_pct)})\n`;
    response += `Available: ${formatCurrency(bankrollStatus.available_balance)}`;
    if (bankrollStatus.pending_bets_amount > 0) {
      response += ` (${formatCurrency(bankrollStatus.pending_bets_amount)} in pending bets)`;
    }
    response += `\n\n`;

    // Overall record
    response += `**🏆 OVERALL RECORD**\n`;
    response += `${stats.wins}-${stats.losses}`;
    if (stats.pushes > 0) response += `-${stats.pushes}`;
    response += ` (${stats.win_rate.toFixed(1)}% win rate)\n`;
    response += `Total wagered: ${formatCurrency(stats.total_wagered)}\n`;
    response += `Total returned: ${formatCurrency(stats.total_returned)}\n`;
    response += `ROI: ${formatPct(stats.roi)}\n\n`;

    // Sport breakdown
    if (sportStats.length > 0) {
      response += `**📊 BY SPORT**\n`;
      sportStats.forEach((sport) => {
        response += `${sport.sport}: ${sport.record} (${sport.winRate}%) | ${formatCurrency(sport.profitLoss)}\n`;
      });
      response += `\n`;
    }

    // Streaks
    if (stats.current_streak > 0) {
      response += `**🔥 STREAKS**\n`;
      response += `Current: ${stats.streak_type === "win" ? "W" : "L"}${stats.current_streak}\n`;
      response += `\n`;
    }

    // Open bets
    if (pendingBets.length > 0) {
      response += `**⏳ OPEN BETS (${pendingBets.length})**\n`;
      pendingBets.slice(0, 5).forEach((bet: any) => {
        response += `• ${bet.description || bet.selection}, ${formatCurrency(bet.amount)} to win ${formatCurrency(bet.potential_return)}\n`;
      });
      if (pendingBets.length > 5) {
        response += `...and ${pendingBets.length - 5} more\n`;
      }
    }

    return response;
  }

  // Specific mode (single stat queries)
  // This would be determined by the query itself
  return `I found that information! Let me know if you need more details.`;
}
