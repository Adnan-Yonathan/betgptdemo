import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { PlayCircle, TrendingUp, TrendingDown, DollarSign, Target, AlertCircle } from "lucide-react";

interface SimulationConfig {
  name: string;
  startBankroll: number;
  betSizingStrategy: 'flat' | 'kelly' | 'percentage';
  flatAmount?: number;
  percentage?: number;
  maxBet?: number;
  minBet?: number;
  leagues: string[];
  betTypes: string[];
  dateRange: {
    start: string;
    end: string;
  };
}

interface SimulationResult {
  totalBets: number;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  roi: number;
  finalBankroll: number;
  profitLoss: number;
  maxDrawdown: number;
  totalWagered: number;
  avgBetSize: number;
}

interface TimelineDataPoint {
  date: string;
  bankroll: number;
  profitLoss: number;
  cumulativePL: number;
}

export function BetSimulator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isRunning, setIsRunning] = useState(false);
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null);
  const [timelineData, setTimelineData] = useState<TimelineDataPoint[]>([]);

  const [config, setConfig] = useState<SimulationConfig>({
    name: "My Simulation",
    startBankroll: 1000,
    betSizingStrategy: 'percentage',
    percentage: 2,
    maxBet: 100,
    minBet: 10,
    leagues: [],
    betTypes: [],
    dateRange: {
      start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0]
    }
  });

  const runSimulation = async () => {
    if (!user) return;

    setIsRunning(true);
    try {
      // Create simulation record
      const { data: simulation, error: createError } = await supabase
        .from('bet_simulations')
        .insert({
          user_id: user.id,
          name: config.name,
          config: {
            startBankroll: config.startBankroll,
            betSizingStrategy: config.betSizingStrategy,
            betSizing: {
              method: config.betSizingStrategy,
              amount: config.flatAmount,
              percentage: config.percentage,
              maxBet: config.maxBet,
              minBet: config.minBet
            },
            filters: {
              leagues: config.leagues,
              betTypes: config.betTypes,
              dateRange: config.dateRange
            }
          },
          status: 'pending'
        })
        .select()
        .single();

      if (createError) throw createError;

      // Run simulation via RPC function
      const { data: results, error: runError } = await supabase.rpc('run_bet_simulation', {
        p_simulation_id: simulation.id
      });

      if (runError) throw runError;

      // Fetch updated simulation with results
      const { data: completedSim, error: fetchError } = await supabase
        .from('bet_simulations')
        .select('*')
        .eq('id', simulation.id)
        .single();

      if (fetchError) throw fetchError;

      if (completedSim.results) {
        setSimulationResults(completedSim.results as SimulationResult);
      }

      if (completedSim.timeline_data) {
        setTimelineData(completedSim.timeline_data as TimelineDataPoint[]);
      }

      toast({
        title: "Simulation Complete",
        description: `Simulated ${completedSim.results?.totalBets || 0} bets`
      });
    } catch (error) {
      console.error('Error running simulation:', error);
      toast({
        title: "Simulation Failed",
        description: "Failed to run simulation. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  const updateConfig = (updates: Partial<SimulationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlayCircle className="w-6 h-6 text-purple-500" />
          Bet Simulator
        </CardTitle>
        <CardDescription>
          Test betting strategies risk-free using historical data
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="config" className="space-y-6">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="config">Configuration</TabsTrigger>
            <TabsTrigger value="results" disabled={!simulationResults}>
              Results
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="space-y-6">
            {/* Simulation Name */}
            <div className="space-y-2">
              <Label htmlFor="sim-name">Simulation Name</Label>
              <Input
                id="sim-name"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                placeholder="e.g., Conservative Strategy"
              />
            </div>

            {/* Starting Bankroll */}
            <div className="space-y-2">
              <Label htmlFor="start-bankroll">Starting Bankroll ($)</Label>
              <Input
                id="start-bankroll"
                type="number"
                min="100"
                step="100"
                value={config.startBankroll}
                onChange={(e) => updateConfig({ startBankroll: parseFloat(e.target.value) })}
              />
            </div>

            {/* Bet Sizing Strategy */}
            <div className="space-y-2">
              <Label htmlFor="bet-sizing">Bet Sizing Strategy</Label>
              <Select
                value={config.betSizingStrategy}
                onValueChange={(value) => updateConfig({ betSizingStrategy: value as any })}
              >
                <SelectTrigger id="bet-sizing">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat Betting</SelectItem>
                  <SelectItem value="percentage">Percentage of Bankroll</SelectItem>
                  <SelectItem value="kelly">Kelly Criterion</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Strategy-specific settings */}
            {config.betSizingStrategy === 'flat' && (
              <div className="space-y-2">
                <Label htmlFor="flat-amount">Flat Bet Amount ($)</Label>
                <Input
                  id="flat-amount"
                  type="number"
                  min="1"
                  step="5"
                  value={config.flatAmount || 25}
                  onChange={(e) => updateConfig({ flatAmount: parseFloat(e.target.value) })}
                />
              </div>
            )}

            {config.betSizingStrategy === 'percentage' && (
              <div className="space-y-2">
                <Label htmlFor="percentage">Percentage of Bankroll (%)</Label>
                <Input
                  id="percentage"
                  type="number"
                  min="0.5"
                  max="10"
                  step="0.5"
                  value={config.percentage || 2}
                  onChange={(e) => updateConfig({ percentage: parseFloat(e.target.value) })}
                />
              </div>
            )}

            {/* Bet Limits */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="min-bet">Min Bet ($)</Label>
                <Input
                  id="min-bet"
                  type="number"
                  min="1"
                  value={config.minBet || 10}
                  onChange={(e) => updateConfig({ minBet: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-bet">Max Bet ($)</Label>
                <Input
                  id="max-bet"
                  type="number"
                  min="1"
                  value={config.maxBet || 100}
                  onChange={(e) => updateConfig({ maxBet: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={config.dateRange.start}
                  onChange={(e) => updateConfig({
                    dateRange: { ...config.dateRange, start: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={config.dateRange.end}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => updateConfig({
                    dateRange: { ...config.dateRange, end: e.target.value }
                  })}
                />
              </div>
            </div>

            {/* Run Simulation Button */}
            <Button
              onClick={runSimulation}
              disabled={isRunning}
              className="w-full"
              size="lg"
            >
              <PlayCircle className={`w-5 h-5 mr-2 ${isRunning ? 'animate-spin' : ''}`} />
              {isRunning ? 'Running Simulation...' : 'Run Simulation'}
            </Button>
          </TabsContent>

          <TabsContent value="results" className="space-y-6">
            {simulationResults ? (
              <>
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Total Bets</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{simulationResults.totalBets}</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Win Rate</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{simulationResults.winRate.toFixed(1)}%</p>
                      <Badge variant={simulationResults.winRate >= 52.4 ? 'default' : 'secondary'} className="mt-1">
                        {simulationResults.wins}-{simulationResults.losses}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">ROI</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${simulationResults.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {simulationResults.roi >= 0 ? '+' : ''}{simulationResults.roi.toFixed(2)}%
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription className="text-xs">Final Bankroll</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className={`text-2xl font-bold ${simulationResults.finalBankroll >= config.startBankroll ? 'text-green-600' : 'text-red-600'}`}>
                        ${simulationResults.finalBankroll.toFixed(0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {simulationResults.profitLoss >= 0 ? '+' : ''}${simulationResults.profitLoss.toFixed(0)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Bankroll Chart */}
                {timelineData.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Bankroll Timeline</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                                      {new Date(payload[0].payload.date).toLocaleDateString()}
                                    </p>
                                    <p className="text-xs">
                                      Bankroll: <span className="font-semibold">${payload[0].value}</span>
                                    </p>
                                    <p className="text-xs">
                                      Cumulative P/L: <span className="font-semibold">
                                        ${payload[0].payload.cumulativePL.toFixed(2)}
                                      </span>
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <ReferenceLine
                            y={config.startBankroll}
                            stroke="hsl(var(--muted-foreground))"
                            strokeDasharray="3 3"
                            label={{
                              value: 'Start',
                              position: 'insideTopRight',
                              fill: 'hsl(var(--muted-foreground))',
                              fontSize: 10
                            }}
                          />
                          <Line
                            type="monotone"
                            dataKey="bankroll"
                            stroke={simulationResults.profitLoss >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))'}
                            strokeWidth={2}
                            dot={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                )}

                {/* Additional Metrics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Performance Metrics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Max Drawdown</p>
                        <p className="font-semibold text-red-600">-${simulationResults.maxDrawdown.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Total Wagered</p>
                        <p className="font-semibold">${simulationResults.totalWagered.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Bet Size</p>
                        <p className="font-semibold">${simulationResults.avgBetSize.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pushes</p>
                        <p className="font-semibold">{simulationResults.pushes}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Insights */}
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold mb-1">Simulation Insights</p>
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {simulationResults.roi >= 5 && (
                          <li>✅ This strategy shows strong profitability ({simulationResults.roi.toFixed(1)}% ROI)</li>
                        )}
                        {simulationResults.roi < 0 && (
                          <li>⚠️ This strategy resulted in losses - consider adjusting bet sizing or filters</li>
                        )}
                        {simulationResults.winRate >= 55 && (
                          <li>✅ Win rate of {simulationResults.winRate.toFixed(1)}% is excellent</li>
                        )}
                        {simulationResults.maxDrawdown > config.startBankroll * 0.3 && (
                          <li>⚠️ Max drawdown was {((simulationResults.maxDrawdown / config.startBankroll) * 100).toFixed(0)}% of starting bankroll - high risk</li>
                        )}
                        {simulationResults.totalBets < 20 && (
                          <li>ℹ️ Sample size is small ({simulationResults.totalBets} bets) - results may not be statistically significant</li>
                        )}
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <PlayCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Run a simulation to see results</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
