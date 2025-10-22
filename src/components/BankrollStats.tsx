import { useEffect, useState, useMemo, useCallback, memo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const BankrollStats = memo(() => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalBankroll: 0,
    percentChange: 0,
    expectedEV: 0,
    totalBets: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoize fetchStats to prevent recreation on every render
  const fetchStats = useCallback(async () => {
    if (!user) return;

    try {
      // Use cached profile stats for faster loading
      const { data: profile } = await supabase
        .from("profiles")
        .select("bankroll, initial_bankroll, cached_total_bets, cached_win_rate, cached_roi")
        .eq("id", user.id)
        .single();

      const currentBankroll = Number(profile?.bankroll || 1000);
      const initialBankroll = Number(profile?.initial_bankroll || profile?.bankroll || 1000);

      // Use cached stats if available, otherwise fetch bets
      if (profile?.cached_total_bets !== undefined && profile?.cached_total_bets > 0) {
        // Use cached stats for immediate display
        const percentChange = initialBankroll > 0
          ? ((currentBankroll - initialBankroll) / initialBankroll) * 100
          : 0;

        // Fetch only pending bets for EV calculation (much faster than all bets)
        const { data: pendingBets } = await supabase
          .from("bets")
          .select("amount, odds, expected_value")
          .eq("user_id", user.id)
          .eq("outcome", "pending");

        const totalEV = (pendingBets || []).reduce((sum, bet) => {
          // Use pre-calculated EV if available
          if (bet.expected_value) {
            return sum + bet.expected_value;
          }
          // Fallback to calculation
          const decimalOdds = bet.odds > 0
            ? (bet.odds / 100) + 1
            : (100 / Math.abs(bet.odds)) + 1;
          const impliedProb = 1 / decimalOdds;
          const potentialProfit = bet.amount * (decimalOdds - 1);
          const ev = (impliedProb * potentialProfit) - ((1 - impliedProb) * bet.amount);
          return sum + ev;
        }, 0);

        setStats({
          totalBankroll: currentBankroll,
          percentChange,
          expectedEV: totalEV,
          totalBets: profile.cached_total_bets,
        });
      } else {
        // Fallback to full fetch if cached stats not available
        const { data: bets } = await supabase
          .from("bets")
          .select("amount, odds, expected_value, outcome")
          .eq("user_id", user.id);

        if (!bets) {
          setStats({
            totalBankroll: currentBankroll,
            percentChange: 0,
            expectedEV: 0,
            totalBets: 0,
          });
          return;
        }

        const percentChange = initialBankroll > 0
          ? ((currentBankroll - initialBankroll) / initialBankroll) * 100
          : 0;

        const totalEV = bets
          .filter(bet => bet.outcome === 'pending')
          .reduce((sum, bet) => {
            if (bet.expected_value) return sum + bet.expected_value;
            const decimalOdds = bet.odds > 0
              ? (bet.odds / 100) + 1
              : (100 / Math.abs(bet.odds)) + 1;
            const impliedProb = 1 / decimalOdds;
            const potentialProfit = bet.amount * (decimalOdds - 1);
            const ev = (impliedProb * potentialProfit) - ((1 - impliedProb) * bet.amount);
            return sum + ev;
          }, 0);

        setStats({
          totalBankroll: currentBankroll,
          percentChange,
          expectedEV: totalEV,
          totalBets: bets.length,
        });
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  }, [user]);

  // Memoize handleRefresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
    toast({
      title: "Stats Refreshed",
      description: "Your bankroll stats have been updated",
    });
  }, [fetchStats, toast]);

  useEffect(() => {
    if (!user) return;

    fetchStats();

    // Subscribe to bet and profile changes for real-time updates
    const channel = supabase
      .channel(`user-stats-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Debounce multiple rapid updates
          setTimeout(() => fetchStats(), 500);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchStats]);

  // Memoize derived values
  const isPositive = useMemo(() => stats.percentChange >= 0, [stats.percentChange]);
  const formattedBankroll = useMemo(() => stats.totalBankroll.toFixed(2), [stats.totalBankroll]);
  const formattedPercentChange = useMemo(() => stats.percentChange.toFixed(2), [stats.percentChange]);
  const formattedEV = useMemo(() => stats.expectedEV.toFixed(2), [stats.expectedEV]);

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Total Bankroll</p>
          <p className="text-sm font-semibold">${formattedBankroll}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {isPositive ? (
          <TrendingUp className="h-4 w-4 text-green-500" />
        ) : (
          <TrendingDown className="h-4 w-4 text-red-500" />
        )}
        <div>
          <p className="text-xs text-muted-foreground">Change</p>
          <p className={`text-sm font-semibold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {isPositive ? '+' : ''}{formattedPercentChange}%
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Percent className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Expected EV</p>
          <p className="text-sm font-semibold">${formattedEV}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-4 w-4 flex items-center justify-center text-muted-foreground text-xs font-bold">
          #
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Bets</p>
          <p className="text-sm font-semibold">{stats.totalBets}</p>
        </div>
      </div>
      </div>
      
      <Button
        variant="ghost"
        size="sm"
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="h-8 w-8 p-0"
      >
        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
});
