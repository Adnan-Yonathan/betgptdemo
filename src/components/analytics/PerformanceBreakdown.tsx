import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

export function PerformanceBreakdown() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBreakdown = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const { data: bets, error } = await supabase
          .from('bets')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        // Group by sport
        const grouped: any = {};
        (bets || []).forEach((bet: any) => {
          const key = bet.sport || 'Unknown';
          if (!grouped[key]) {
            grouped[key] = { sport: key, total_bets: 0, total_won: 0, total_lost: 0, total_profit: 0 };
          }
          grouped[key].total_bets++;
          if (bet.outcome === 'won') grouped[key].total_won++;
          if (bet.outcome === 'lost') grouped[key].total_lost++;
          if (bet.actual_return) grouped[key].total_profit += (bet.actual_return - bet.amount);
        });

        setData(Object.values(grouped));
      } catch (error) {
        console.error('Error fetching performance breakdown:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBreakdown();
  }, [user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Place more bets to see your performance breakdown
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Breakdown</CardTitle>
        <CardDescription>Analyze your betting performance by sport</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map((item, index) => {
            const winRate = item.total_bets > 0 ? (item.total_won / item.total_bets * 100) : 0;
            return (
              <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-semibold">{item.sport}</h4>
                  <p className="text-sm text-muted-foreground">
                    {item.total_won}-{item.total_lost} ({winRate.toFixed(1)}%)
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${item.total_profit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {item.total_profit >= 0 ? '+' : ''}${item.total_profit.toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground">{item.total_bets} bets</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
