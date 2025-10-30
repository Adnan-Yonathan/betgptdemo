import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, Target, Flame, DollarSign, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getTodayStartEST } from "@/utils/dateUtils";

interface DashboardStats {
  roi: number;
  winRate: number;
  currentStreak: number;
  streakType: "win" | "loss" | "none";
  totalBets: number;
  bankroll: number;
  todayChange: number;
  totalProfit: number;
}

/**
 * Betting Profile Dashboard Component
 * Displays ROI, win rate, streaks, and bankroll trend
 * Connects to existing bets table and calculates metrics
 * Located in ProfileSettings section
 */
export const BettingDashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadDashboardStats = useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Fetch profile bankroll
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("bankroll")
        .eq("id", user.id)
        .single();

      if (profileError) throw profileError;

      const initialBankroll = profile?.bankroll || 1000;

      // Fetch all bets for the user
      const { data: bets, error } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (!bets || bets.length === 0) {
        setStats({
          roi: 0,
          winRate: 0,
          currentStreak: 0,
          streakType: "none",
          totalBets: 0,
          bankroll: initialBankroll,
          todayChange: 0,
          totalProfit: 0,
        });
        setLoading(false);
        return;
      }

      // Calculate statistics
      const settledBets = bets.filter((b) => b.outcome !== "pending");
      const wins = settledBets.filter((b) => b.outcome === "win");
      const losses = settledBets.filter((b) => b.outcome === "loss");

      const totalWagered = settledBets.reduce((sum, b) => sum + b.amount, 0);
      const totalReturns = wins.reduce((sum, b) => sum + (b.actual_return || 0), 0);
      const totalLost = losses.reduce((sum, b) => sum + b.amount, 0);
      const totalProfit = totalReturns - totalLost;

      const roi = totalWagered > 0 ? (totalProfit / totalWagered) * 100 : 0;
      const winRate = settledBets.length > 0 ? (wins.length / settledBets.length) * 100 : 0;

      // Calculate current streak
      let currentStreak = 0;
      let streakType: "win" | "loss" | "none" = "none";

      if (settledBets.length > 0) {
        const lastOutcome = settledBets[0].outcome;
        if (lastOutcome === "win" || lastOutcome === "loss") {
          streakType = lastOutcome;
          for (const bet of settledBets) {
            if (bet.outcome === lastOutcome) {
              currentStreak++;
            } else if (bet.outcome !== "push") {
              break;
            }
          }
        }
      }

      // Calculate today's change (using Eastern Time zone)
      const today = getTodayStartEST();
      const todayBets = settledBets.filter((b) => {
        const betDate = new Date(b.settled_at || b.created_at);
        return betDate >= today;
      });

      const todayWins = todayBets.filter((b) => b.outcome === "win");
      const todayLosses = todayBets.filter((b) => b.outcome === "loss");
      const todayProfit =
        todayWins.reduce((sum, b) => sum + (b.actual_return || 0), 0) -
        todayLosses.reduce((sum, b) => sum + b.amount, 0);

      // Calculate current bankroll from initial bankroll + total profit
      const bankroll = initialBankroll + totalProfit;

      setStats({
        roi,
        winRate,
        currentStreak,
        streakType,
        totalBets: bets.length,
        bankroll,
        todayChange: todayProfit,
        totalProfit,
      });
    } catch (error) {
      console.error("Error loading dashboard stats:", error);
      setStats({
        roi: 0,
        winRate: 0,
        currentStreak: 0,
        streakType: "none",
        totalBets: 0,
        bankroll: 1000,
        todayChange: 0,
        totalProfit: 0,
      });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadDashboardStats();

      // Set up real-time subscriptions for automatic dashboard updates
      const betsChannel = supabase
        .channel('betting-dashboard-bets')
        .on(
          'postgres_changes',
          {
            event: '*', // Listen to INSERT, UPDATE, DELETE
            schema: 'public',
            table: 'bets',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Bet change detected:', payload);
            loadDashboardStats();
          }
        )
        .subscribe();

      // Also listen to profile changes for bankroll updates
      const profileChannel = supabase
        .channel('betting-dashboard-profile')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            console.log('Profile/bankroll change detected:', payload);
            loadDashboardStats();
          }
        )
        .subscribe();

      // Cleanup subscriptions on unmount
      return () => {
        supabase.removeChannel(betsChannel);
        supabase.removeChannel(profileChannel);
      };
    }
  }, [user, loadDashboardStats]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          Your Performance
        </h3>
      </div>

      {/* Bankroll Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Bankroll</p>
              <h2 className="text-3xl font-bold text-foreground mb-2">
                ${stats.bankroll.toFixed(2)}
              </h2>
              <div className="flex items-center gap-2 text-sm">
                {stats.todayChange !== 0 && (
                  <span
                    className={cn(
                      "flex items-center gap-1 font-medium",
                      stats.todayChange > 0 ? "text-green-500" : "text-red-500"
                    )}
                  >
                    {stats.todayChange > 0 ? (
                      <TrendingUp className="w-4 h-4" />
                    ) : (
                      <TrendingDown className="w-4 h-4" />
                    )}
                    {stats.todayChange > 0 ? "+" : ""}
                    ${Math.abs(stats.todayChange).toFixed(2)} today
                  </span>
                )}
              </div>
            </div>
            <div className="p-3 bg-primary/10 rounded-full">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* ROI */}
        <Card className={cn(
          "border transition-colors",
          stats.roi > 0 ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <Target className={cn(
                "w-5 h-5",
                stats.roi > 0 ? "text-green-500" : "text-red-500"
              )} />
              <span className={cn(
                "text-xs px-2 py-0.5 rounded-full font-medium",
                stats.roi > 0 ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"
              )}>
                {stats.roi > 0 ? "+" : ""}{stats.roi.toFixed(1)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">ROI</p>
            <p className="text-lg font-bold mt-1">
              {stats.totalProfit > 0 ? "+" : ""}${stats.totalProfit.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        {/* Win Rate */}
        <Card className="border border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-600">
                {stats.winRate.toFixed(0)}%
              </span>
            </div>
            <p className="text-sm text-muted-foreground">Win Rate</p>
            <p className="text-lg font-bold mt-1">{stats.totalBets} bets</p>
          </CardContent>
        </Card>

        {/* Current Streak */}
        <Card className={cn(
          "border transition-colors",
          stats.streakType === "win" && "border-yellow-500/20 bg-yellow-500/5",
          stats.streakType === "loss" && "border-gray-500/20 bg-gray-500/5",
          stats.streakType === "none" && "border-border"
        )}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <Flame className={cn(
                "w-5 h-5",
                stats.streakType === "win" && "text-yellow-500",
                stats.streakType === "loss" && "text-gray-500",
                stats.streakType === "none" && "text-muted-foreground"
              )} />
            </div>
            <p className="text-sm text-muted-foreground">Current Streak</p>
            <p className="text-lg font-bold mt-1">
              {stats.currentStreak > 0 ? (
                <>
                  {stats.currentStreak} {stats.streakType}
                  {stats.currentStreak > 1 ? "s" : ""}
                </>
              ) : (
                "No streak"
              )}
            </p>
          </CardContent>
        </Card>

        {/* Trend Indicator - Placeholder for future chart */}
        <Card className="border border-purple-500/20 bg-purple-500/5">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-sm text-muted-foreground">Trend</p>
            <p className="text-xs text-muted-foreground mt-1">
              Chart coming soon
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Info text */}
      <p className="text-xs text-muted-foreground text-center">
        Stats update automatically as bets settle
      </p>
    </div>
  );
};
