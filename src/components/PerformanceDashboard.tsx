import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, AlertCircle, Award, BarChart3 } from 'lucide-react';

interface Analytics {
  overall: {
    totalBets: number;
    wins: number;
    losses: number;
    pushes: number;
    winRate: number;
    winRateConfidence: {
      lower: number;
      upper: number;
    };
    roi: number;
    avgCLV: number;
    positiveCLVRate: number;
    sharpeRatio: number;
    netProfit: number;
    totalWagered: number;
  };
  grouped: Record<string, any>;
  insights: Array<{
    type: 'positive' | 'negative' | 'warning';
    message: string;
    stat: string;
    value: number;
  }>;
}

export function PerformanceDashboard() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [groupBy, setGroupBy] = useState<'sport' | 'bet_type' | 'team'>('sport');
  const [timeRange, setTimeRange] = useState<'all' | 'last_7_days' | 'last_30_days'>('last_30_days');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [groupBy, timeRange]);

  async function fetchAnalytics() {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('performance-analytics', {
        body: { groupBy, timeRange }
      });

      if (error) throw error;
      if (data.analytics) {
        setAnalytics(data.analytics);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="p-4">Loading performance analytics...</div>;
  }

  if (!analytics) {
    return (
      <div className="p-4">
        <Card>
          <CardHeader>
            <CardTitle>No Betting History</CardTitle>
            <CardDescription>
              Start placing bets to see your performance analytics
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { overall, grouped, insights } = analytics;

  return (
    <div className="space-y-6 p-4">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">Performance Analytics</h2>
        <div className="flex gap-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border rounded px-3 py-2"
          >
            <option value="last_7_days">Last 7 Days</option>
            <option value="last_30_days">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overall.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              95% CI: {overall.winRateConfidence.lower.toFixed(1)}% - {overall.winRateConfidence.upper.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {overall.wins}W - {overall.losses}L - {overall.pushes}P
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overall.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {overall.roi > 0 ? '+' : ''}{overall.roi.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Net: ${overall.netProfit.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Wagered: ${overall.totalWagered.toFixed(2)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg CLV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overall.avgCLV > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {overall.avgCLV > 0 ? '+' : ''}{overall.avgCLV.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Closing Line Value
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {overall.positiveCLVRate.toFixed(1)}% positive CLV rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${overall.sharpeRatio > 1 ? 'text-green-600' : overall.sharpeRatio > 0 ? 'text-yellow-600' : 'text-red-600'}`}>
              {overall.sharpeRatio.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Risk-Adjusted Returns
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {overall.sharpeRatio > 1 ? 'Excellent' : overall.sharpeRatio > 0 ? 'Good' : 'Poor'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      {insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Key Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg">
                  {insight.type === 'positive' && <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />}
                  {insight.type === 'negative' && <TrendingDown className="h-5 w-5 text-red-600 mt-0.5" />}
                  {insight.type === 'warning' && <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{insight.message}</p>
                    <Badge variant="outline" className="mt-1">{insight.stat}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grouped Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Performance Breakdown
          </CardTitle>
          <CardDescription>
            Analyze your performance by different categories
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={groupBy} onValueChange={(v) => setGroupBy(v as any)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="sport">By Sport</TabsTrigger>
              <TabsTrigger value="bet_type">By Bet Type</TabsTrigger>
              <TabsTrigger value="team">By Team</TabsTrigger>
            </TabsList>

            <TabsContent value="sport" className="mt-4">
              <GroupedAnalyticsTable data={grouped} />
            </TabsContent>

            <TabsContent value="bet_type" className="mt-4">
              <GroupedAnalyticsTable data={grouped} />
            </TabsContent>

            <TabsContent value="team" className="mt-4">
              <GroupedAnalyticsTable data={grouped} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupedAnalyticsTable({ data }: { data: Record<string, any> }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-sm text-muted-foreground">No data available</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Category</th>
            <th className="text-right p-2">Bets</th>
            <th className="text-right p-2">Win Rate</th>
            <th className="text-right p-2">ROI</th>
            <th className="text-right p-2">Net Profit</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data).map(([key, stats]: [string, any]) => (
            <tr key={key} className="border-b hover:bg-muted/50">
              <td className="p-2 font-medium">{key}</td>
              <td className="text-right p-2">{stats.totalBets}</td>
              <td className="text-right p-2">
                <span className={stats.winRate > 0.55 ? 'text-green-600' : stats.winRate < 0.45 ? 'text-red-600' : ''}>
                  {(stats.winRate * 100).toFixed(1)}%
                </span>
              </td>
              <td className="text-right p-2">
                <span className={stats.roi > 0 ? 'text-green-600' : 'text-red-600'}>
                  {stats.roi > 0 ? '+' : ''}{stats.roi.toFixed(2)}%
                </span>
              </td>
              <td className="text-right p-2">
                <span className={stats.netProfit > 0 ? 'text-green-600' : 'text-red-600'}>
                  ${stats.netProfit.toFixed(2)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
