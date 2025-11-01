import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Award,
  BarChart3,
  Zap,
  Activity
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface PerformanceMetrics {
  totalBets: number;
  winRate: number;
  totalProfitLoss: number;
  roi: number;
  sharpeRatio: number | null;
  avgCLV: number | null;
  kellyEfficiency: number | null;
  currentStreak: {
    type: 'win' | 'loss' | 'none';
    count: number;
  };
  bestDay: {
    date: string;
    profit: number;
  } | null;
  worstDay: {
    date: string;
    loss: number;
  } | null;
  currentBankroll: number;
  allTimeHighBankroll: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, value, subtitle, icon, trend, color = 'text-primary' }) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={color}>{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className={`text-xs flex items-center gap-1 ${
            trend === 'up' ? 'text-green-500' :
            trend === 'down' ? 'text-red-500' :
            'text-muted-foreground'
          }`}>
            {trend === 'up' && <TrendingUp className="w-3 h-3" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3" />}
            {subtitle}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export function PerformanceOverview() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!user) return;

      try {
        // Fetch from multiple sources in parallel
        const [patternsResult, metricsResult, bankrollResult, historyResult] = await Promise.all([
          supabase
            .from('betting_patterns')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('advanced_metrics')
            .select('*')
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('user_preferences')
            .select('current_bankroll')
            .eq('user_id', user.id)
            .single(),
          supabase
            .from('bankroll_history')
            .select('date, daily_profit_loss, bankroll')
            .eq('user_id', user.id)
            .order('date', { ascending: false })
            .limit(30)
        ]);

        const patterns = patternsResult.data;
        const advMetrics = metricsResult.data;
        const bankroll = bankrollResult.data?.current_bankroll || 1000;
        const history = historyResult.data || [];

        // Find best and worst days
        const sortedByProfit = [...history].sort((a, b) => b.daily_profit_loss - a.daily_profit_loss);
        const bestDay = sortedByProfit[0] ? {
          date: sortedByProfit[0].date,
          profit: sortedByProfit[0].daily_profit_loss
        } : null;
        const worstDay = sortedByProfit[sortedByProfit.length - 1] ? {
          date: sortedByProfit[sortedByProfit.length - 1].date,
          loss: sortedByProfit[sortedByProfit.length - 1].daily_profit_loss
        } : null;

        // Find all-time high bankroll
        const allTimeHigh = Math.max(...history.map(h => h.bankroll), bankroll);

        // Determine current streak
        let currentStreak: PerformanceMetrics['currentStreak'] = {
          type: 'none',
          count: 0
        };

        if (patterns) {
          if (patterns.current_win_streak > 0) {
            currentStreak = { type: 'win', count: patterns.current_win_streak };
          } else if (patterns.current_loss_streak > 0) {
            currentStreak = { type: 'loss', count: patterns.current_loss_streak };
          }
        }

        setMetrics({
          totalBets: patterns?.total_bets || 0,
          winRate: patterns?.win_rate || 0,
          totalProfitLoss: patterns?.total_profit_loss || 0,
          roi: patterns?.roi || 0,
          sharpeRatio: advMetrics?.sharpe_ratio || null,
          avgCLV: advMetrics?.avg_clv_points || null,
          kellyEfficiency: advMetrics?.avg_kelly_efficiency || null,
          currentStreak,
          bestDay,
          worstDay,
          currentBankroll: bankroll,
          allTimeHighBankroll: allTimeHigh
        });
      } catch (error) {
        console.error('Error fetching performance metrics:', error);
        toast({
          title: "Error",
          description: "Failed to load performance metrics",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchMetrics();
  }, [user]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-2xl font-bold">Performance Overview</h3>
          <p className="text-muted-foreground">Loading your betting stats...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-3 w-1/2 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Performance Overview</CardTitle>
          <CardDescription>No betting data available yet</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Start placing bets to see your performance metrics here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-2xl font-bold">Performance Overview</h3>
        <p className="text-muted-foreground">
          Your betting performance at a glance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Bets */}
        <MetricCard
          title="Total Bets"
          value={metrics.totalBets.toLocaleString()}
          subtitle={`${metrics.totalBets > 0 ? 'Tracking your action' : 'Start betting'}`}
          icon={<BarChart3 className="w-4 h-4" />}
          color="text-blue-500"
        />

        {/* Win Rate */}
        <MetricCard
          title="Win Rate"
          value={`${metrics.winRate.toFixed(1)}%`}
          subtitle={metrics.winRate >= 55 ? 'Excellent!' : metrics.winRate >= 50 ? 'Solid' : 'Room to improve'}
          icon={<Target className="w-4 h-4" />}
          trend={metrics.winRate >= 52.4 ? 'up' : metrics.winRate < 50 ? 'down' : 'neutral'}
          color={metrics.winRate >= 52.4 ? 'text-green-500' : 'text-orange-500'}
        />

        {/* Total Profit/Loss */}
        <MetricCard
          title="Total P/L"
          value={`${metrics.totalProfitLoss >= 0 ? '+' : ''}$${metrics.totalProfitLoss.toFixed(2)}`}
          subtitle={`${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(1)}% ROI`}
          icon={<DollarSign className="w-4 h-4" />}
          trend={metrics.totalProfitLoss >= 0 ? 'up' : 'down'}
          color={metrics.totalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}
        />

        {/* ROI */}
        <MetricCard
          title="ROI"
          value={`${metrics.roi >= 0 ? '+' : ''}${metrics.roi.toFixed(2)}%`}
          subtitle={metrics.roi >= 5 ? 'Great returns!' : metrics.roi >= 0 ? 'Profitable' : 'Need improvement'}
          icon={<Activity className="w-4 h-4" />}
          trend={metrics.roi >= 0 ? 'up' : 'down'}
          color={metrics.roi >= 5 ? 'text-green-500' : metrics.roi >= 0 ? 'text-blue-500' : 'text-red-500'}
        />

        {/* Sharpe Ratio */}
        {metrics.sharpeRatio !== null && (
          <MetricCard
            title="Sharpe Ratio"
            value={metrics.sharpeRatio.toFixed(2)}
            subtitle={
              metrics.sharpeRatio >= 1.5 ? 'Excellent risk-adjusted returns' :
              metrics.sharpeRatio >= 1.0 ? 'Good risk management' :
              'High volatility'
            }
            icon={<Award className="w-4 h-4" />}
            color="text-purple-500"
          />
        )}

        {/* Average CLV */}
        {metrics.avgCLV !== null && (
          <MetricCard
            title="Avg CLV"
            value={`${metrics.avgCLV >= 0 ? '+' : ''}${metrics.avgCLV.toFixed(2)} pts`}
            subtitle={
              metrics.avgCLV >= 1.5 ? 'Elite line shopping!' :
              metrics.avgCLV >= 0.5 ? 'Beating the market' :
              'Improve line timing'
            }
            icon={<Zap className="w-4 h-4" />}
            trend={metrics.avgCLV >= 0 ? 'up' : 'down'}
            color={metrics.avgCLV >= 1.0 ? 'text-green-500' : 'text-yellow-500'}
          />
        )}

        {/* Kelly Efficiency */}
        {metrics.kellyEfficiency !== null && (
          <MetricCard
            title="Kelly Efficiency"
            value={metrics.kellyEfficiency.toFixed(2)}
            subtitle={
              metrics.kellyEfficiency >= 0.8 && metrics.kellyEfficiency <= 1.2 ? 'Optimal sizing' :
              metrics.kellyEfficiency > 1.2 ? 'Overbetting' :
              'Underbetting'
            }
            icon={<Target className="w-4 h-4" />}
            color={
              metrics.kellyEfficiency >= 0.8 && metrics.kellyEfficiency <= 1.2 ? 'text-green-500' :
              'text-orange-500'
            }
          />
        )}

        {/* Current Streak */}
        <MetricCard
          title="Current Streak"
          value={
            metrics.currentStreak.type === 'none' ? 'N/A' :
            `${metrics.currentStreak.count} ${metrics.currentStreak.type === 'win' ? 'W' : 'L'}`
          }
          subtitle={
            metrics.currentStreak.type === 'win' ? 'Keep it going! 🔥' :
            metrics.currentStreak.type === 'loss' ? 'Stay disciplined' :
            'No active streak'
          }
          icon={<Activity className="w-4 h-4" />}
          trend={
            metrics.currentStreak.type === 'win' ? 'up' :
            metrics.currentStreak.type === 'loss' ? 'down' :
            'neutral'
          }
          color={
            metrics.currentStreak.type === 'win' ? 'text-green-500' :
            metrics.currentStreak.type === 'loss' ? 'text-red-500' :
            'text-muted-foreground'
          }
        />
      </div>

      {/* Quick Stats */}
      {(metrics.bestDay || metrics.worstDay) && (
        <div className="grid gap-4 md:grid-cols-2">
          {metrics.bestDay && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Best Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-green-500">
                      +${metrics.bestDay.profit.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(metrics.bestDay.date).toLocaleDateString()}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          )}

          {metrics.worstDay && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Worst Day</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-red-500">
                      ${metrics.worstDay.loss.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(metrics.worstDay.date).toLocaleDateString()}
                    </p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-500 opacity-50" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Bankroll Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bankroll Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-muted-foreground">Current Bankroll</p>
              <p className="text-2xl font-bold">${metrics.currentBankroll.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">All-Time High</p>
              <p className="text-2xl font-bold">${metrics.allTimeHighBankroll.toFixed(2)}</p>
              {metrics.currentBankroll < metrics.allTimeHighBankroll && (
                <p className="text-xs text-red-500">
                  -{((1 - metrics.currentBankroll / metrics.allTimeHighBankroll) * 100).toFixed(1)}% from ATH
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
