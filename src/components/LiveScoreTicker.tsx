import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LiveScore {
  game_id: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  period: string;
  time_remaining: string;
  game_status: string;
}

export function LiveScoreTicker() {
  const [liveScores, setLiveScores] = useState<LiveScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live scores
  const fetchLiveScores = async () => {
    try {
      const { data, error } = await supabase
        .from('live_score_cache')
        .select('*')
        .eq('game_status', 'in_progress')
        .order('last_updated', { ascending: false })
        .limit(20);

      if (error) throw error;

      setLiveScores(data || []);
    } catch (error) {
      console.error('Error fetching live scores:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchLiveScores();

    // Poll every 30 seconds
    const interval = setInterval(fetchLiveScores, 30000);

    return () => clearInterval(interval);
  }, []);

  // Set up Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('live_score_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_score_cache',
          filter: 'game_status=eq.in_progress'
        },
        (payload) => {
          console.log('Live score update:', payload);
          fetchLiveScores();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-4">
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
            <Skeleton className="h-16 flex-1" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (liveScores.length === 0) {
    return (
      <Card className="border-0 shadow-none bg-muted/50">
        <CardContent className="p-3">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span>No live games right now</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-none bg-muted/50">
      <CardContent className="p-3">
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-2">
            {liveScores.map((score) => (
              <Card
                key={score.game_id}
                className="flex-shrink-0 w-[280px] border-2 bg-card"
              >
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {/* League and Status */}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        {score.league}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-red-500">
                        <Activity className="w-3 h-3 animate-pulse" />
                        <span>LIVE</span>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[140px]">
                          {score.away_team}
                        </span>
                        <span className="text-lg font-bold">
                          {score.away_score}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate max-w-[140px]">
                          {score.home_team}
                        </span>
                        <span className="text-lg font-bold">
                          {score.home_score}
                        </span>
                      </div>
                    </div>

                    {/* Game Time */}
                    <div className="text-xs text-muted-foreground text-center pt-1 border-t">
                      {score.period} • {score.time_remaining || 'In Progress'}
                    </div>
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
