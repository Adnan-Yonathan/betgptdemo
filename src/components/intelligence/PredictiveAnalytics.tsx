import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { TrendingUp, TrendingDown, Target, RefreshCw, Activity } from "lucide-react";

interface Prediction {
  id: string;
  prediction_type: string;
  metric: string;
  current_value: number;
  predicted_value: number;
  confidence: number;
  confidence_interval_lower: number;
  confidence_interval_upper: number;
  timeframe: string;
  methodology: string;
  target_date: string;
  prediction_date: string;
}

export function PredictiveAnalytics() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchPredictions();
  }, [user]);

  const fetchPredictions = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('predictions')
        .select('*')
        .eq('user_id', user.id)
        .is('validated_at', null)
        .order('prediction_date', { ascending: false })
        .limit(10);

      if (error) throw error;

      setPredictions(data || []);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      toast({
        title: "Error",
        description: "Failed to load predictions",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generatePredictions = async () => {
    if (!user) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.rpc('generate_predictions', {
        p_user_id: user.id
      });

      if (error) throw error;

      toast({
        title: "Predictions Generated",
        description: `Created ${data || 0} new predictions based on your data`
      });

      await fetchPredictions();
    } catch (error) {
      console.error('Error generating predictions:', error);
      toast({
        title: "Error",
        description: "Failed to generate predictions",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getMetricLabel = (metric: string) => {
    const labels: Record<string, string> = {
      roi: 'ROI',
      win_rate: 'Win Rate',
      bankroll: 'Bankroll',
      profit_loss: 'Profit/Loss'
    };
    return labels[metric] || metric;
  };

  const getTimeframeLabel = (timeframe: string) => {
    const labels: Record<string, string> = {
      '7_days': '7 Days',
      '30_days': '30 Days',
      '90_days': '90 Days',
      'season': 'Season'
    };
    return labels[timeframe] || timeframe;
  };

  const formatValue = (metric: string, value: number) => {
    if (metric === 'roi' || metric === 'win_rate') {
      return `${value.toFixed(1)}%`;
    }
    if (metric === 'bankroll' || metric === 'profit_loss') {
      return `$${value.toFixed(0)}`;
    }
    return value.toFixed(2);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High Confidence';
    if (confidence >= 60) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const getTrendIcon = (current: number, predicted: number) => {
    if (predicted > current) {
      return <TrendingUp className="w-5 h-5 text-green-500" />;
    } else if (predicted < current) {
      return <TrendingDown className="w-5 h-5 text-red-500" />;
    }
    return <Activity className="w-5 h-5 text-muted-foreground" />;
  };

  const generateChartData = (prediction: Prediction) => {
    const now = new Date();
    const target = new Date(prediction.target_date);
    const daysDiff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return [
      {
        date: 'Now',
        value: prediction.current_value,
        lower: prediction.current_value,
        upper: prediction.current_value
      },
      {
        date: getTimeframeLabel(prediction.timeframe),
        value: prediction.predicted_value,
        lower: prediction.confidence_interval_lower,
        upper: prediction.confidence_interval_upper
      }
    ];
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Predictive Analytics</CardTitle>
          <CardDescription>Loading predictions...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-500" />
              Predictive Analytics
            </CardTitle>
            <CardDescription>
              AI-powered forecasts of your future betting performance
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generatePredictions}
            disabled={isGenerating}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Generate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Predictions Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Generate predictions based on your betting history and current trends
            </p>
            <Button onClick={generatePredictions} disabled={isGenerating}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate Predictions
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {predictions.map((prediction) => {
              const chartData = generateChartData(prediction);
              const change = prediction.predicted_value - prediction.current_value;
              const changePercent = (change / prediction.current_value) * 100;

              return (
                <Card key={prediction.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        {getTrendIcon(prediction.current_value, prediction.predicted_value)}
                        <div>
                          <CardTitle className="text-base mb-1">
                            {getMetricLabel(prediction.metric)} Forecast
                          </CardTitle>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">
                              {getTimeframeLabel(prediction.timeframe)}
                            </Badge>
                            <Badge variant="secondary">
                              {prediction.methodology.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline" className={getConfidenceColor(prediction.confidence)}>
                              {getConfidenceLabel(prediction.confidence)}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Current vs Predicted */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Current</p>
                        <p className="text-2xl font-bold">
                          {formatValue(prediction.metric, prediction.current_value)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">Predicted</p>
                        <p className={`text-2xl font-bold ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatValue(prediction.metric, prediction.predicted_value)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {change >= 0 ? '+' : ''}{changePercent.toFixed(1)}% change
                        </p>
                      </div>
                    </div>

                    {/* Forecast Chart */}
                    <div>
                      <ResponsiveContainer width="100%" height={150}>
                        <AreaChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis
                            dataKey="date"
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                          />
                          <YAxis
                            tickFormatter={(value) => formatValue(prediction.metric, value)}
                            className="text-xs"
                            tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            domain={['auto', 'auto']}
                          />
                          <Tooltip
                            content={({ active, payload }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-background border border-border rounded-lg p-2 shadow-lg">
                                    <p className="font-semibold text-sm mb-1">
                                      {payload[0].payload.date}
                                    </p>
                                    <p className="text-xs">
                                      Value: <span className="font-semibold">
                                        {formatValue(prediction.metric, payload[0].payload.value)}
                                      </span>
                                    </p>
                                    {payload[0].payload.lower && payload[0].payload.upper && (
                                      <p className="text-xs text-muted-foreground">
                                        Range: {formatValue(prediction.metric, payload[0].payload.lower)} - {formatValue(prediction.metric, payload[0].payload.upper)}
                                      </p>
                                    )}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke={change >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))'}
                            fill={change >= 0 ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-5))'}
                            fillOpacity={0.2}
                          />
                          <Area
                            type="monotone"
                            dataKey="lower"
                            stroke="none"
                            fill="hsl(var(--muted))"
                            fillOpacity={0.1}
                          />
                          <Area
                            type="monotone"
                            dataKey="upper"
                            stroke="none"
                            fill="hsl(var(--muted))"
                            fillOpacity={0.1}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Confidence Interval */}
                    <div className="bg-muted rounded-lg p-3">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        CONFIDENCE INTERVAL ({prediction.confidence.toFixed(0)}%)
                      </p>
                      <div className="flex items-center justify-between text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Lower Bound</p>
                          <p className="font-semibold">
                            {formatValue(prediction.metric, prediction.confidence_interval_lower)}
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Expected</p>
                          <p className="font-semibold text-lg">
                            {formatValue(prediction.metric, prediction.predicted_value)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Upper Bound</p>
                          <p className="font-semibold">
                            {formatValue(prediction.metric, prediction.confidence_interval_upper)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Target Date */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Prediction made {new Date(prediction.prediction_date).toLocaleDateString()}</span>
                      <span>Target date: {new Date(prediction.target_date).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Disclaimer */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold mb-1">Important Note</p>
                  <p className="text-xs text-muted-foreground">
                    Predictions are based on historical patterns and current trends. Past performance does not guarantee future results.
                    Use these forecasts as guidance, not certainties. Always bet responsibly within your means.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
