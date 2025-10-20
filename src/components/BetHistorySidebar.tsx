import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, Minus, Clock } from "lucide-react";
import { format } from "date-fns";
interface Bet {
  id: string;
  amount: number;
  odds: number;
  outcome: string;
  description: string;
  potential_return: number | null;
  actual_return: number | null;
  created_at: string;
  settled_at: string | null;
}
interface BetHistorySidebarProps {
  onNewBet: () => void;
}
export const BetHistorySidebar = ({
  onNewBet
}: BetHistorySidebarProps) => {
  const {
    user
  } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  useEffect(() => {
    if (!user) return;
    const fetchBets = async () => {
      const {
        data
      } = await supabase.from("bets").select("*").eq("user_id", user.id).order("created_at", {
        ascending: false
      });
      if (data) setBets(data);
    };
    fetchBets();

    // Subscribe to bet changes
    const channel = supabase.channel('bet-history-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'bets',
      filter: `user_id=eq.${user.id}`
    }, () => fetchBets()).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'win':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'loss':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'push':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };
  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'win':
        return 'text-green-500';
      case 'loss':
        return 'text-red-500';
      case 'push':
        return 'text-muted-foreground';
      default:
        return 'text-yellow-500';
    }
  };
  return <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      <div className="p-4 border-b border-sidebar-border">
        
        <Button onClick={onNewBet} className="w-full justify-start gap-2 bg-sidebar-accent hover:bg-sidebar-accent/80 text-sidebar-foreground">
          <Plus className="w-4 h-4" />
          New conversation
        </Button>
      </div>

      <div className="p-4 border-b border-sidebar-border">
        <h2 className="text-lg font-semibold text-sidebar-foreground">Bet History</h2>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-2">
          {bets.length === 0 ? <div className="text-center py-8 px-4">
              <p className="text-sm text-sidebar-foreground/50">
                No bets logged yet. Start tracking your bets in the chat!
              </p>
            </div> : bets.map(bet => <div key={bet.id} className="p-3 rounded-lg bg-sidebar-accent hover:bg-sidebar-accent/80 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getOutcomeIcon(bet.outcome)}
                    <span className={`text-xs font-semibold uppercase ${getOutcomeColor(bet.outcome)}`}>
                      {bet.outcome}
                    </span>
                  </div>
                  <span className="text-xs text-sidebar-foreground/50">
                    {format(new Date(bet.created_at), "MMM d")}
                  </span>
                </div>

                <p className="text-sm font-medium text-sidebar-foreground mb-1 line-clamp-2">
                  {bet.description}
                </p>

                <div className="flex items-center justify-between text-xs text-sidebar-foreground/70">
                  <span>${bet.amount.toFixed(2)} @ {bet.odds > 0 ? '+' : ''}{bet.odds}</span>
                  {bet.outcome === 'win' && bet.actual_return && <span className="text-green-500 font-semibold">
                      +${bet.actual_return.toFixed(2)}
                    </span>}
                  {bet.outcome === 'loss' && <span className="text-red-500 font-semibold">
                      -${bet.amount.toFixed(2)}
                    </span>}
                </div>
              </div>)}
        </div>
      </ScrollArea>
    </aside>;
};