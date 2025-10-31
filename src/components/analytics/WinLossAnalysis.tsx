import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Target, Award, AlertCircle } from "lucide-react";

interface WinLossData {
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  biggestWin: number;
  biggestLoss: number;
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  variance: number;
  consistency: number;
  profitFactor: number;
}

export function WinLossAnalysis() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [data, setData] = useState<WinLossData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchWinLossData = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        // Fetch betting patterns for overall stats
        const { data: patterns, error: patternsError } = await supabase
          .from('betting_patterns')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (patternsError && patternsError.code !== 'PGRST116') throw patternsError;

        // Fetch individual bets for detailed analysis
        const { data: bets, error: betsError } = await supabase
          .from('bets')
          .select('profit_loss, result')
          .eq('user_id', user.id)
          .not('result', 'is', null);

        if (betsError) throw betsError;

        if (!patterns || !bets) {
          setData(null);
          return;
        }

        // Calculate averages
        const winningBets = bets.filter(b => b.result === 'won');
        const losingBets = bets.filter(b => b.result === 'lost');

        const avgWin = winningBets.length > 0
          ? winningBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0) / winningBets.length
          : 0;

        const avgLoss = losingBets.length > 0
          ? Math.abs(losingBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0) / losingBets.length)
          : 0;

        // Calculate biggest win/loss
        const biggestWin = winningBets.length > 0
          ? Math.max(...winningBets.map(b => b.profit_loss || 0))
          : 0;

        const biggestLoss = losingBets.length > 0
          ? Math.abs(Math.min(...losingBets.map(b => b.profit_loss || 0)))
          : 0;

        // Calculate variance and consistency
        const profitLosses = bets.map(b => b.profit_loss || 0);
        const mean = profitLosses.reduce((sum, val) => sum + val, 0) / profitLosses.length;
        const variance = profitLosses.length > 0
          ? profitLosses.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / profitLosses.length
          : 0;

        const standardDeviation = Math.sqrt(variance);
        const consistency = mean !== 0 ? (mean / standardDeviation) * 100 : 0;

        // Calculate profit factor (total wins / total losses)
        const totalWins = winningBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0);
        const totalLosses = Math.abs(losingBets.reduce((sum, b) => sum + (b.profit_loss || 0), 0));
        const profitFactor = totalLosses > 0 ? totalWins / totalLosses : 0;

        setData({
          totalBets: patterns.total_bets || 0,
          wins: patterns.total_wins || 0,
          losses: patterns.total_losses || 0,
          pushes: patterns.total_pushes || 0,
          winRate: patterns.overall_win_rate || 0,
          avgWin,
          avgLoss,
          biggestWin,
          biggestLoss,
          currentWinStreak: patterns.current_win_streak || 0,
          currentLossStreak: patterns.current_loss_streak || 0,
          longestWinStreak: patterns.longest_win_streak || 0,
          longestLossStreak: patterns.longest_loss_streak || 0,
          variance,
          consistency: Math.abs(consistency),
          profitFactor
        });
      } catch (error) {
        console.error('Error fetching win/loss data:', error);
        toast({
          title: "Error",
          description: "Failed to load win/loss analysis",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchWinLossData();
  }, [user]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Win/Loss Analysis</CardTitle>
          <CardDescription>Loading analysis...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalBets === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Win/Loss Analysis</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Place more bets to see your win/loss analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  const pieData = [
    { name: 'Wins', value: data.wins, color: 'hsl(var(--chart-1))' },
    { name: 'Losses', value: data.losses, color: 'hsl(var(--chart-5))' },
    { name: 'Pushes', value: data.pushes, color: 'hsl(var(--muted))' }
  ].filter(item => item.value > 0);

  const winLossRatio = data.losses > 0 ? (data.wins / data.losses).toFixed(2) : '∞';
  const avgWinLossRatio = data.avgLoss > 0 ? (data.avgWin / data.avgLoss).toFixed(2) : '∞';

  return (
    <Card>
      <CardHeader>
        <CardTitle>Win/Loss Analysis</CardTitle>
        <CardDescription>
          Deep dive into your betting outcomes and patterns
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Distribution Chart */}
        <div>
          <h4 className="text-sm font-semibold mb-4">Outcome Distribution</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Bets</span>
                  <span className="font-semibold">{data.totalBets}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    Wins
                  </span>
                  <span className="font-semibold text-green-600">{data.wins}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                    Losses
                  </span>
                  <span className="font-semibold text-red-600">{data.losses}</span>
                </div>
                {data.pushes > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-2">
                      <Target className="w-4 h-4 text-muted-foreground" />
                      Pushes
                    </span>
                    <span className="font-semibold">{data.pushes}</span>
                  </div>
                )}
              </div>
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Win Rate</span>
                  <Badge variant={data.winRate >= 52.4 ? 'default' : 'secondary'}>
                    {data.winRate.toFixed(1)}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-muted-foreground">Win/Loss Ratio</span>
                  <span className="font-semibold">{winLossRatio}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Win vs Loss Comparison */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-semibold mb-4">Win vs Loss Comparison</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  Winning Bets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Win</span>
                  <span className="font-semibold text-green-600">
                    +${data.avgWin.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Biggest Win</span>
                  <span className="font-semibold text-green-600">
                    +${data.biggestWin.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Wins</span>
                  <span className="font-semibold">{data.wins}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  Losing Bets
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Average Loss</span>
                  <span className="font-semibold text-red-600">
                    -${data.avgLoss.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Biggest Loss</span>
                  <span className="font-semibold text-red-600">
                    -${data.biggestLoss.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Losses</span>
                  <span className="font-semibold">{data.losses}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-4 bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">Average Win/Loss Ratio</p>
                <p className="text-xs text-muted-foreground mt-1">
                  How much you win vs lose per bet on average
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold">
                  {avgWinLossRatio}:1
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {parseFloat(avgWinLossRatio) >= 1.5 ? 'Excellent' :
                   parseFloat(avgWinLossRatio) >= 1.0 ? 'Good' : 'Needs Work'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Streak Analysis */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-semibold mb-4">Streak Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="text-sm font-semibold">Current Win Streak</p>
                    <p className="text-xs text-muted-foreground">Consecutive wins</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-green-600">
                  {data.currentWinStreak}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-sm font-semibold">Longest Win Streak</p>
                    <p className="text-xs text-muted-foreground">Personal best</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">
                  {data.longestWinStreak}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm font-semibold">Current Loss Streak</p>
                    <p className="text-xs text-muted-foreground">Consecutive losses</p>
                  </div>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {data.currentLossStreak}
                </span>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold">Longest Loss Streak</p>
                    <p className="text-xs text-muted-foreground">Watch out for tilt</p>
                  </div>
                </div>
                <span className="text-2xl font-bold">
                  {data.longestLossStreak}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Advanced Metrics */}
        <div className="border-t pt-6">
          <h4 className="text-sm font-semibold mb-4">Advanced Metrics</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Profit Factor</p>
              <p className="text-2xl font-bold mb-1">
                {data.profitFactor.toFixed(2)}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.profitFactor >= 1.5 ? '🟢 Excellent' :
                 data.profitFactor >= 1.0 ? '🟡 Profitable' : '🔴 Losing'}
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Variance</p>
              <p className="text-2xl font-bold mb-1">
                ${data.variance.toFixed(0)}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.variance < 100 ? 'Low volatility' :
                 data.variance < 500 ? 'Medium volatility' : 'High volatility'}
              </p>
            </div>

            <div className="border rounded-lg p-4">
              <p className="text-sm text-muted-foreground mb-1">Consistency</p>
              <p className="text-2xl font-bold mb-1">
                {data.consistency.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground">
                {data.consistency >= 80 ? 'Very consistent' :
                 data.consistency >= 50 ? 'Moderately consistent' : 'Inconsistent'}
              </p>
            </div>
          </div>

          <div className="mt-4 bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
              <div>
                <p className="text-sm font-semibold mb-1">Key Insights</p>
                <ul className="text-xs text-muted-foreground space-y-1">
                  {data.profitFactor >= 1.5 && (
                    <li>✅ Your profit factor of {data.profitFactor.toFixed(2)} indicates strong profitability</li>
                  )}
                  {data.profitFactor < 1.0 && (
                    <li>⚠️ Profit factor below 1.0 means total losses exceed total wins</li>
                  )}
                  {data.avgWin > data.avgLoss * 1.5 && (
                    <li>✅ Your average wins are significantly larger than average losses - great risk/reward!</li>
                  )}
                  {data.avgWin < data.avgLoss && (
                    <li>⚠️ Average losses exceed average wins - you need a higher win rate to be profitable</li>
                  )}
                  {data.longestLossStreak >= 5 && (
                    <li>📊 You've had a {data.longestLossStreak}-bet losing streak - practice good bankroll management</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
