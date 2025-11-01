import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar } from "lucide-react";
import { subDays, subMonths, format } from "date-fns";

type TimeRange = '7D' | '30D' | '3M' | '1Y' | 'All';

interface BankrollDataPoint {
  date: string;
  bankroll: number;
  totalProfitLoss: number;
  dailyProfitLoss: number;
}

export function BankrollChart() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<BankrollDataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<TimeRange>('30D');
  const [isLoading, setIsLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'area'>('area');

  const getStartDate = (range: TimeRange): Date => {
    const now = new Date();
    switch (range) {
      case '7D':
        return subDays(now, 7);
      case '30D':
        return subDays(now, 30);
      case '3M':
        return subMonths(now, 3);
      case '1Y':
        return subMonths(now, 12);
      case 'All':
        return new Date(2020, 0, 1); // Arbitrary early date
      default:
        return subDays(now, 30);
    }
  };

  useEffect(() => {
    const fetchBankrollHistory = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const startDate = getStartDate(timeRange);

        const { data: historyData, error } = await supabase
          .rpc('get_bankroll_history', {
            p_user_id: user.id,
            p_start_date: format(startDate, 'yyyy-MM-dd'),
            p_end_date: format(new Date(), 'yyyy-MM-dd')
          });

        if (error) throw error;

        const formattedData: BankrollDataPoint[] = (historyData || []).map((item: any) => ({
          date: format(new Date(item.date), 'MMM dd'),
          bankroll: item.bankroll,
          totalProfitLoss: item.total_profit_loss,
          dailyProfitLoss: item.daily_profit_loss
        }));

        setData(formattedData);
      } catch (error) {
        console.error('Error fetching bankroll history:', error);
        toast({
          title: "Error",
          description: "Failed to load bankroll history",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchBankrollHistory();
  }, [user, timeRange]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background border border-border rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-sm mb-1">{data.date}</p>
          <div className="space-y-1">
            <p className="text-xs">
              <span className="text-muted-foreground">Bankroll: </span>
              <span className="font-medium">${data.bankroll.toFixed(2)}</span>
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Total P/L: </span>
              <span className={`font-medium ${data.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.totalProfitLoss >= 0 ? '+' : ''}${data.totalProfitLoss.toFixed(2)}
              </span>
            </p>
            <p className="text-xs">
              <span className="text-muted-foreground">Daily P/L: </span>
              <span className={`font-medium ${data.dailyProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {data.dailyProfitLoss >= 0 ? '+' : ''}${data.dailyProfitLoss.toFixed(2)}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Bankroll Growth
          </CardTitle>
          <CardDescription>Loading your bankroll timeline...</CardDescription>
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
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Bankroll Growth
          </CardTitle>
          <CardDescription>No bankroll history available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <div className="text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Start placing bets to track your bankroll over time</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const firstBankroll = data[0]?.bankroll || 0;
  const lastBankroll = data[data.length - 1]?.bankroll || 0;
  const growthAmount = lastBankroll - firstBankroll;
  const growthPercentage = firstBankroll > 0 ? (growthAmount / firstBankroll) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Bankroll Growth
            </CardTitle>
            <CardDescription>
              Track your bankroll performance over time
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={chartType === 'line' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              Line
            </Button>
            <Button
              variant={chartType === 'area' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setChartType('area')}
            >
              Area
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Time Range Selector */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {(['7D', '30D', '3M', '1Y', 'All'] as TimeRange[]).map((range) => (
                <Button
                  key={range}
                  variant={timeRange === range ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setTimeRange(range)}
                >
                  {range}
                </Button>
              ))}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Period Growth</p>
              <p className={`text-sm font-semibold ${growthAmount >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {growthAmount >= 0 ? '+' : ''}${growthAmount.toFixed(2)} ({growthPercentage >= 0 ? '+' : ''}{growthPercentage.toFixed(1)}%)
              </p>
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={400}>
            {chartType === 'area' ? (
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="bankrollGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="bankroll"
                  stroke="hsl(var(--primary))"
                  fill="url(#bankrollGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="bankroll"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={false}
                  name="Bankroll"
                />
                <Line
                  type="monotone"
                  dataKey="totalProfitLoss"
                  stroke="hsl(var(--chart-2))"
                  strokeWidth={2}
                  dot={false}
                  name="Total P/L"
                />
              </LineChart>
            )}
          </ResponsiveContainer>

          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground">Starting</p>
              <p className="text-lg font-semibold">${firstBankroll.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="text-lg font-semibold">${lastBankroll.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peak</p>
              <p className="text-lg font-semibold">
                ${Math.max(...data.map(d => d.bankroll)).toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
