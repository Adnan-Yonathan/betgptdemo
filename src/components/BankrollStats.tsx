import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, DollarSign, Percent, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export const BankrollStats = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalBankroll: 0,
    percentChange: 0,
    expectedEV: 0,
    totalBets: 0,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = async () => {
    if (!user) return;
    
    try {
      // Fetch initial bankroll from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("bankroll")
        .eq("id", user.id)
        .single();

      const initialBankroll = Number(profile?.bankroll || 1000);

      // Fetch all bets
      const { data: bets } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", user.id);

      if (!bets) {
        setStats({
          totalBankroll: initialBankroll,
          percentChange: 0,
          expectedEV: 0,
          totalBets: 0,
        });
        return;
      }

      // Calculate profit/loss from settled bets
      const settled = bets.filter(b => b.outcome !== 'pending');
      const totalReturn = settled.reduce((sum, bet) => {
        if (bet.outcome === 'win') return sum + (bet.actual_return || 0);
        if (bet.outcome === 'loss') return sum - bet.amount;
        return sum; // push = no change
      }, 0);

      const currentBankroll = initialBankroll + totalReturn;
      const percentChange = initialBankroll > 0 
        ? ((currentBankroll - initialBankroll) / initialBankroll) * 100 
        : 0;

      // Calculate expected EV based on odds (simplified Kelly-style calculation)
      const totalEV = bets.reduce((sum, bet) => {
        // Convert American odds to decimal
        const decimalOdds = bet.odds > 0 
          ? (bet.odds / 100) + 1 
          : (100 / Math.abs(bet.odds)) + 1;
        
        // EV = (Probability of Win × Potential Profit) - (Probability of Loss × Amount Wagered)
        // Using implied probability from odds as estimate
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
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchStats();
    setIsRefreshing(false);
    toast({
      title: "Stats Refreshed",
      description: "Your bankroll stats have been updated",
    });
  };

  useEffect(() => {
    if (!user) return;
    
    fetchStats();

    // Subscribe to bet changes
    const channel = supabase
      .channel('bets-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `user_id=eq.${user.id}`,
        },
        () => fetchStats()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const isPositive = stats.percentChange >= 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b border-border">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
        <DollarSign className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Total Bankroll</p>
          <p className="text-sm font-semibold">${stats.totalBankroll.toFixed(2)}</p>
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
            {isPositive ? '+' : ''}{stats.percentChange.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Percent className="h-4 w-4 text-muted-foreground" />
        <div>
          <p className="text-xs text-muted-foreground">Expected EV</p>
          <p className="text-sm font-semibold">${stats.expectedEV.toFixed(2)}</p>
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
};
