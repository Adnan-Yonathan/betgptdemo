import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown } from "lucide-react";

interface BreakdownData {
  breakdown_key: string;
  total_bets: number;
  wins: number;
  losses: number;
  pushes: number;
  win_rate: number;
  roi: number;
  total_profit_loss: number;
  avg_stake: number;
}

type BreakdownType = 'league' | 'bet_type' | 'team';

export function PerformanceBreakdown() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [breakdownType, setBreakdownType] = useState<BreakdownType>('league');
  const [data, setData] = useState<BreakdownData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBreakdown = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const { data: breakdownData, error } = await supabase.rpc('get_performance_breakdown', {
          p_user_id: user.id,
          p_breakdown_type: breakdownType,
          p_start_date: null,
          p_end_date: null
        });

        if (error) throw error;

        setData(breakdownData || []);
      } catch (error) {
        console.error('Error fetching performance breakdown:', error);
        toast({
          title: "Error",
          description: "Failed to load performance breakdown",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBreakdown();
  }, [user, breakdownType]);

  const getROIColor = (roi: number) => {
    if (roi >= 5) return 'text-green-600';
    if (roi >= 0) return 'text-green-500';
    return 'text-red-500';
  };

  const getWinRateColor = (winRate: number) => {
    if (winRate >= 55) return 'text-green-600';
    if (winRate >= 52.4) return 'text-green-500';
    if (winRate >= 50) return 'text-yellow-500';
    return 'text-red-500';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Breakdown</CardTitle>
          <CardDescription>Loading breakdown data...</CardDescription>
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

  const chartData = data.slice(0, 10).map(item => ({
    name: item.breakdown_key,
    roi: item.roi,
    winRate: item.win_rate,
    totalBets: item.total_bets
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance Breakdown</CardTitle>
        <CardDescription>
          Analyze your betting performance across different dimensions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={breakdownType} onValueChange={(value) => setBreakdownType(value as BreakdownType)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="league">By League</TabsTrigger>
            <TabsTrigger value="bet_type">By Bet Type</TabsTrigger>
            <TabsTrigger value="team">By Team</TabsTrigger>
          </TabsList>

          <TabsContent value={breakdownType} className="space-y-4">
            {/* ROI Chart */}
            <div>
              <h4 className="text-sm font-semibold mb-2">ROI Comparison</h4>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="name"
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${value}%`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                            <p className="font-semibold text-sm">{payload[0].payload.name}</p>
                            <p className="text-xs">
                              ROI: <span className={getROIColor(payload[0].value as number)}>
                                {payload[0].value}%
                              </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {payload[0].payload.totalBets} bets
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="roi" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.roi >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Detailed Table */}
            <div>
              <h4 className="text-sm font-semibold mb-2">Detailed Stats</h4>
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{breakdownType === 'league' ? 'League' : breakdownType === 'bet_type' ? 'Type' : 'Team'}</TableHead>
                      <TableHead className="text-right">Bets</TableHead>
                      <TableHead className="text-right">Record</TableHead>
                      <TableHead className="text-right">Win Rate</TableHead>
                      <TableHead className="text-right">ROI</TableHead>
                      <TableHead className="text-right">P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{item.breakdown_key}</TableCell>
                        <TableCell className="text-right">{item.total_bets}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs">
                            {item.wins}-{item.losses}
                            {item.pushes > 0 && `-${item.pushes}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={getWinRateColor(item.win_rate)}>
                            {item.win_rate?.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className={getROIColor(item.roi)}>
                              {item.roi >= 0 ? '+' : ''}{item.roi?.toFixed(1)}%
                            </span>
                            {item.roi >= 0 ? (
                              <TrendingUp className="w-3 h-3 text-green-500" />
                            ) : (
                              <TrendingDown className="w-3 h-3 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.total_profit_loss >= 0 ? 'default' : 'destructive'}>
                            {item.total_profit_loss >= 0 ? '+' : ''}${item.total_profit_loss?.toFixed(2)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Key Insights */}
            <div className="bg-muted rounded-lg p-4">
              <h4 className="text-sm font-semibold mb-2">Key Insights</h4>
              <div className="space-y-2 text-sm">
                {(() => {
                  const best = data.reduce((prev, current) =>
                    (current.roi > prev.roi) ? current : prev
                  );
                  const worst = data.reduce((prev, current) =>
                    (current.roi < prev.roi) ? current : prev
                  );
                  const mostBets = data.reduce((prev, current) =>
                    (current.total_bets > prev.total_bets) ? current : prev
                  );

                  return (
                    <>
                      {best.roi > 0 && (
                        <p className="text-green-600">
                          ✅ Best performing: <span className="font-semibold">{best.breakdown_key}</span> ({best.roi.toFixed(1)}% ROI)
                        </p>
                      )}
                      {worst.roi < 0 && (
                        <p className="text-red-600">
                          ⚠️ Avoid: <span className="font-semibold">{worst.breakdown_key}</span> ({worst.roi.toFixed(1)}% ROI)
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        📊 Most active: <span className="font-semibold">{mostBets.breakdown_key}</span> ({mostBets.total_bets} bets)
                      </p>
                    </>
                  );
                })()}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
