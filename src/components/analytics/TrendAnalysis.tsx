import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";

interface TrendDataPoint {
  date: string;
  winRate: number;
  roi: number;
  profitLoss: number;
  rollingWinRate: number;
  rollingROI: number;
  cumulativePL: number;
}

type TrendMetric = 'winRate' | 'roi' | 'profitLoss';

export function TrendAnalysis() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState<TrendMetric>('profitLoss');
  const [showRollingAverage, setShowRollingAverage] = useState(true);

  useEffect(() => {
    const fetchTrendData = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        // Fetch bets grouped by date
        const { data: bets, error } = await supabase
          .from('bets')
          .select('placed_at, amount, profit_loss, result')
          .eq('user_id', user.id)
          .not('result', 'is', null)
          .order('placed_at', { ascending: true });

        if (error) throw error;

        if (!bets || bets.length === 0) {
          setData([]);
          return;
        }

        // Group bets by date
        const betsByDate = new Map<string, any[]>();
        bets.forEach(bet => {
          const date = new Date(bet.placed_at).toISOString().split('T')[0];
          if (!betsByDate.has(date)) {
            betsByDate.set(date, []);
          }
          betsByDate.get(date)!.push(bet);
        });

        // Calculate metrics for each date
        const trendData: TrendDataPoint[] = [];
        let cumulativePL = 0;

        const dates = Array.from(betsByDate.keys()).sort();

        dates.forEach((date, index) => {
          const dayBets = betsByDate.get(date)!;

          const wins = dayBets.filter(b => b.result === 'won').length;
          const totalBets = dayBets.length;
          const winRate = (wins / totalBets) * 100;

          const totalAmount = dayBets.reduce((sum, b) => sum + (b.amount || 0), 0);
          const totalPL = dayBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0);
          const roi = totalAmount > 0 ? (totalPL / totalAmount) * 100 : 0;

          cumulativePL += totalPL;

          // Calculate rolling averages (last 10 bets)
          const rollingWindow = 10;
          const startIndex = Math.max(0, index - rollingWindow + 1);
          const rollingDates = dates.slice(startIndex, index + 1);

          let rollingBets: any[] = [];
          rollingDates.forEach(d => {
            rollingBets = rollingBets.concat(betsByDate.get(d)!);
          });

          const rollingWins = rollingBets.filter(b => b.result === 'won').length;
          const rollingTotal = rollingBets.length;
          const rollingWinRate = (rollingWins / rollingTotal) * 100;

          const rollingAmount = rollingBets.reduce((sum, b) => sum + (b.amount || 0), 0);
          const rollingPL = rollingBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0);
          const rollingROI = rollingAmount > 0 ? (rollingPL / rollingAmount) * 100 : 0;

          trendData.push({
            date,
            winRate,
            roi,
            profitLoss: totalPL,
            rollingWinRate,
            rollingROI,
            cumulativePL
          });
        });

        setData(trendData);
      } catch (error) {
        console.error('Error fetching trend data:', error);
        toast({
          title: "Error",
          description: "Failed to load trend analysis",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrendData();
  }, [user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Trend Analysis</CardTitle>
          <CardDescription>Loading trends...</CardDescription>
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
          <CardTitle>Trend Analysis</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Place more bets to see trend analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  // Calculate overall trend direction
  const recentData = data.slice(-10);
  const olderData = data.slice(-20, -10);

  const recentAvgPL = recentData.length > 0
    ? recentData.reduce((sum, d) => sum + d.profitLoss, 0) / recentData.length
    : 0;

  const olderAvgPL = olderData.length > 0
    ? olderData.reduce((sum, d) => sum + d.profitLoss, 0) / olderData.length
    : 0;

  const trendDirection = recentAvgPL > olderAvgPL ? 'up' : 'down';
  const trendChange = olderAvgPL !== 0 ? ((recentAvgPL - olderAvgPL) / Math.abs(olderAvgPL)) * 100 : 0;

  const lastPoint = data[data.length - 1];
  const firstPoint = data[0];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getMetricConfig = (metric: TrendMetric) => {
    switch (metric) {
      case 'winRate':
        return {
          title: 'Win Rate Trend',
          dataKey: 'winRate',
          rollingKey: 'rollingWinRate',
          color: 'hsl(var(--chart-2))',
          format: (value: number) => `${value.toFixed(1)}%`,
          referenceValue: 52.4,
          referenceLabel: 'Break-even (52.4%)'
        };
      case 'roi':
        return {
          title: 'ROI Trend',
          dataKey: 'roi',
          rollingKey: 'rollingROI',
          color: 'hsl(var(--chart-3))',
          format: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
          referenceValue: 0,
          referenceLabel: 'Break-even'
        };
      case 'profitLoss':
        return {
          title: 'Daily Profit/Loss',
          dataKey: 'profitLoss',
          rollingKey: null,
          color: 'hsl(var(--chart-1))',
          format: (value: number) => `$${value >= 0 ? '+' : ''}${value.toFixed(2)}`,
          referenceValue: 0,
          referenceLabel: 'Break-even'
        };
    }
  };

  const config = getMetricConfig(selectedMetric);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Trend Analysis</CardTitle>
            <CardDescription>
              Track your performance trends over time
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' ? (
              <Badge variant="default" className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Trending Up
              </Badge>
            ) : (
              <Badge variant="destructive" className="flex items-center gap-1">
                <TrendingDown className="w-3 h-3" />
                Trending Down
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Trend Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Recent Trend</p>
            <div className="flex items-baseline gap-2">
              {trendDirection === 'up' ? (
                <TrendingUp className="w-5 h-5 text-green-500" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-500" />
              )}
              <span className={`text-2xl font-bold ${trendDirection === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(trendChange).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs previous period
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Total P/L</p>
            <p className={`text-2xl font-bold ${lastPoint.cumulativePL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${lastPoint.cumulativePL >= 0 ? '+' : ''}{lastPoint.cumulativePL.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cumulative
            </p>
          </div>

          <div className="border rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-1">Data Points</p>
            <p className="text-2xl font-bold">{data.length}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Days tracked
            </p>
          </div>
        </div>

        {/* Metric Selector */}
        <Tabs value={selectedMetric} onValueChange={(value) => setSelectedMetric(value as TrendMetric)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profitLoss">Profit/Loss</TabsTrigger>
            <TabsTrigger value="winRate">Win Rate</TabsTrigger>
            <TabsTrigger value="roi">ROI</TabsTrigger>
          </TabsList>

          <TabsContent value={selectedMetric} className="space-y-4">
            {/* Chart */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold">{config.title}</h4>
                {config.rollingKey && (
                  <button
                    onClick={() => setShowRollingAverage(!showRollingAverage)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showRollingAverage ? 'Hide' : 'Show'} 10-day average
                  </button>
                )}
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickFormatter={config.format}
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-semibold text-sm mb-2">
                              {formatDate(payload[0].payload.date)}
                            </p>
                            <p className="text-xs">
                              Value: <span className="font-semibold">
                                {config.format(payload[0].value as number)}
                              </span>
                            </p>
                            {config.rollingKey && showRollingAverage && payload[1] && (
                              <p className="text-xs text-muted-foreground">
                                10-day avg: {config.format(payload[1].value as number)}
                              </p>
                            )}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={config.referenceValue}
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="3 3"
                    label={{
                      value: config.referenceLabel,
                      position: 'insideTopRight',
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 10
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={config.dataKey}
                    stroke={config.color}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  {config.rollingKey && showRollingAverage && (
                    <Line
                      type="monotone"
                      dataKey={config.rollingKey}
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Cumulative P/L Chart */}
            {selectedMetric === 'profitLoss' && (
              <div>
                <h4 className="text-sm font-semibold mb-2">Cumulative Profit/Loss</h4>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDate}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <YAxis
                      tickFormatter={(value) => `$${value}`}
                      className="text-xs"
                      tick={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                              <p className="font-semibold text-sm">
                                {formatDate(payload[0].payload.date)}
                              </p>
                              <p className="text-xs">
                                Total: <span className="font-semibold">
                                  ${(payload[0].value as number).toFixed(2)}
                                </span>
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
                    <Area
                      type="monotone"
                      dataKey="cumulativePL"
                      stroke="hsl(var(--chart-1))"
                      fill={lastPoint.cumulativePL >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))'}
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Insights */}
        <div className="bg-muted rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-blue-500 mt-0.5" />
            <div>
              <p className="text-sm font-semibold mb-2">Trend Insights</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                {trendDirection === 'up' && trendChange > 10 && (
                  <li>✅ Strong upward trend - you're improving!</li>
                )}
                {trendDirection === 'down' && Math.abs(trendChange) > 10 && (
                  <li>⚠️ Downward trend detected - review your recent strategy</li>
                )}
                {lastPoint.rollingWinRate > 55 && (
                  <li>🔥 Your 10-day rolling win rate of {lastPoint.rollingWinRate.toFixed(1)}% is excellent</li>
                )}
                {lastPoint.rollingWinRate < 50 && (
                  <li>📉 Your 10-day rolling win rate of {lastPoint.rollingWinRate.toFixed(1)}% is below break-even</li>
                )}
                {lastPoint.cumulativePL > 0 && lastPoint.cumulativePL > firstPoint.profitLoss * 10 && (
                  <li>💰 You've grown your profits significantly since starting</li>
                )}
                {Math.abs(recentAvgPL - olderAvgPL) < 5 && (
                  <li>📊 Your results are stable with low volatility</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
