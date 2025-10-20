import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, TrendingDown, DollarSign, Percent } from "lucide-react";

interface BankrollStatsProps {
  initialBankroll: number;
}

export const BankrollStats = ({ initialBankroll }: BankrollStatsProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalBankroll: initialBankroll,
    percentChange: 0,
    expectedEV: 0,
    totalBets: 0,
  });

  useEffect(() => {
    if (!user) return;

    const fetchStats = async () => {
      const { data: bets } = await supabase
        .from("bets")
        .select("*")
        .eq("user_id", user.id);

      if (!bets) return;

      const settled = bets.filter(b => b.outcome !== 'pending');
      const totalReturn = settled.reduce((sum, bet) => {
        if (bet.outcome === 'win') return sum + (bet.actual_return || 0);
        if (bet.outcome === 'loss') return sum - bet.amount;
        return sum;
      }, 0);

      const totalWagered = settled.reduce((sum, bet) => sum + bet.amount, 0);
      const currentBankroll = initialBankroll + totalReturn;
      const percentChange = initialBankroll > 0 
        ? ((currentBankroll - initialBankroll) / initialBankroll) * 100 
        : 0;

      // Calculate expected EV from all bets
      const totalEV = bets.reduce((sum, bet) => {
        const decimalOdds = bet.odds > 0 ? (bet.odds / 100) + 1 : (100 / Math.abs(bet.odds)) + 1;
        const impliedProb = 1 / decimalOdds;
        const ev = (bet.amount * decimalOdds - bet.amount) * impliedProb;
        return sum + ev;
      }, 0);

      setStats({
        totalBankroll: currentBankroll,
        percentChange,
        expectedEV: totalEV,
        totalBets: bets.length,
      });
    };

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
  }, [user, initialBankroll]);

  const isPositive = stats.percentChange >= 0;

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-muted/30 border-b border-border">
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
  );
};
