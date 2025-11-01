import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Activity, CheckCircle2, XCircle, Equal, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LiveBet {
  id: string;
  bet_id: string;
  bet_type: string;
  bet_side: string;
  bet_amount: number;
  odds: number;
  home_team: string;
  away_team: string;
  current_home_score: number;
  current_away_score: number;
  bet_status: string;
  time_remaining: string;
  current_period: string;
  points_needed_to_cover: number | null;
  win_prob_change: number | null;
  last_5min_home_points: number;
  last_5min_away_points: number;
  game_status: string;
}

export function LiveBetTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [liveBets, setLiveBets] = useState<LiveBet[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch active live bets
  const fetchLiveBets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_active_bets_live', {
        p_user_id: user.id
      });

      if (error) throw error;

      setLiveBets(data || []);
    } catch (error) {
      console.error('Error fetching live bets:', error);
      toast({
        title: "Error",
        description: "Failed to load live bets",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLiveBets();

    // Set up polling every 10 seconds
    const interval = setInterval(fetchLiveBets, 10000);

    return () => clearInterval(interval);
  }, [user]);

  // Set up Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('live_bet_tracking_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_bet_tracking',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Live bet update:', payload);
          fetchLiveBets(); // Refresh when changes detected
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'winning':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'losing':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'push':
        return <Equal className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'winning':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'losing':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'push':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const formatBetType = (type: string) => {
    switch (type) {
      case 'spread':
        return 'Spread';
      case 'total':
        return 'Total';
      case 'moneyline':
        return 'Moneyline';
      default:
        return type;
    }
  };

  const getMomentumIndicator = (bet: LiveBet) => {
    const homeMomentum = bet.last_5min_home_points;
    const awayMomentum = bet.last_5min_away_points;
    const diff = homeMomentum - awayMomentum;

    if (Math.abs(diff) < 5) return null;

    const team = diff > 0 ? bet.home_team : bet.away_team;
    const isFavorable =
      (bet.bet_side === 'home' && diff > 0) ||
      (bet.bet_side === 'away' && diff < 0);

    return (
      <div className={`flex items-center gap-1 text-xs ${isFavorable ? 'text-green-500' : 'text-red-500'}`}>
        {isFavorable ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        <span>{team} on {Math.abs(diff)}-point run (last 5 min)</span>
      </div>
    );
  };

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
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
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
          <CardDescription>
            No active bets being tracked right now
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            When you place a bet on an upcoming game, it will appear here and be tracked in real-time.
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
        <CardDescription>
          Real-time tracking of your active bets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-4">
            {liveBets.map((bet) => (
              <Card key={bet.id} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-base">
                          {bet.home_team} vs {bet.away_team}
                        </CardTitle>
                        {getStatusIcon(bet.bet_status)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline" className="text-xs">
                          {formatBetType(bet.bet_type)}
                        </Badge>
                        <span>•</span>
                        <span className="font-medium">${bet.bet_amount}</span>
                        <span>•</span>
                        <span>{bet.odds > 0 ? '+' : ''}{bet.odds}</span>
                      </div>
                    </div>
                    <Badge className={getStatusColor(bet.bet_status)}>
                      {bet.bet_status.toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2">
                    {/* Current Score */}
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="text-center flex-1">
                        <div className="text-xs text-muted-foreground mb-1">{bet.home_team}</div>
                        <div className="text-2xl font-bold">{bet.current_home_score}</div>
                      </div>
                      <div className="px-4">
                        <div className="text-xs text-muted-foreground">vs</div>
                      </div>
                      <div className="text-center flex-1">
                        <div className="text-xs text-muted-foreground mb-1">{bet.away_team}</div>
                        <div className="text-2xl font-bold">{bet.current_away_score}</div>
                      </div>
                    </div>

                    {/* Game Status */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {bet.current_period} - {bet.time_remaining || 'In Progress'}
                      </span>
                      <span className="text-muted-foreground">
                        {bet.game_status === 'in_progress' ? '🔴 LIVE' : '⏸️ Paused'}
                      </span>
                    </div>

                    {/* Points Needed */}
                    {bet.points_needed_to_cover !== null && bet.points_needed_to_cover !== undefined && (
                      <div className={`p-2 rounded-md text-sm ${
                        bet.points_needed_to_cover <= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {bet.points_needed_to_cover > 0
                          ? `Need ${bet.points_needed_to_cover} more points to cover`
                          : `Covering by ${Math.abs(bet.points_needed_to_cover)} points`
                        }
                      </div>
                    )}

                    {/* Momentum Indicator */}
                    {getMomentumIndicator(bet)}

                    {/* Win Probability Change */}
                    {bet.win_prob_change !== null && Math.abs(bet.win_prob_change) > 0.05 && (
                      <div className={`flex items-center gap-1 text-xs ${
                        bet.win_prob_change > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {bet.win_prob_change > 0 ? '📈' : '📉'}
                        <span>
                          Win probability {bet.win_prob_change > 0 ? 'up' : 'down'} {Math.abs(bet.win_prob_change * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
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
