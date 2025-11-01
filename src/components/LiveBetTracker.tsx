import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function LiveBetTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [liveBets, setLiveBets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchLiveBets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('bets')
        .select('*')
        .eq('user_id', user.id)
        .eq('outcome', 'pending')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      setLiveBets(data || []);
    } catch (error) {
      console.error('Error fetching live bets:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveBets();
    const interval = setInterval(fetchLiveBets, 10000);
    return () => clearInterval(interval);
  }, [user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 animate-pulse" />
            Live Bets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (liveBets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Live Bets
          </CardTitle>
          <CardDescription>No active bets being tracked</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When you place a bet on an upcoming game, it will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
            Live Bets
          </div>
          <Badge variant="secondary">{liveBets.length} active</Badge>
        </CardTitle>
        <CardDescription>Real-time tracking of your active bets</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-4">
            {liveBets.map((bet) => (
              <Card key={bet.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base">
                        {bet.description}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                        <Badge variant="outline" className="text-xs">
                          {bet.bet_type}
                        </Badge>
                        <span>•</span>
                        <span className="font-medium">${bet.amount}</span>
                        <span>•</span>
                        <span>{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
                      </div>
                    </div>
                    <Badge className="bg-blue-500/10 text-blue-500">
                      PENDING
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{bet.league || 'Unknown League'}</span>
                    <Clock className="w-4 h-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
