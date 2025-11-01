import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function WinLossAnalysis() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        setStats(profile);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Win/Loss Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5" />
          Win/Loss Analysis
        </CardTitle>
        <CardDescription>Your betting record</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-500">{stats?.total_bets_won || 0}</p>
            <p className="text-xs text-muted-foreground">Wins</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-red-500">{stats?.total_bets_lost || 0}</p>
            <p className="text-xs text-muted-foreground">Losses</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-yellow-500">{stats?.total_bets_pushed || 0}</p>
            <p className="text-xs text-muted-foreground">Pushes</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
