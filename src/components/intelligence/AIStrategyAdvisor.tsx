import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Lightbulb,
  Target,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  X
} from "lucide-react";

interface AIInsight {
  id: string;
  insight_type: 'strength' | 'weakness' | 'opportunity' | 'risk' | 'pattern';
  category: string;
  title: string;
  description: string;
  recommendation: string;
  confidence_score: number;
  potential_impact: 'high' | 'medium' | 'low';
  supporting_data: Record<string, any>;
  sample_size: number;
  status: 'active' | 'dismissed' | 'acted_upon' | 'expired';
  created_at: string;
}

export function AIStrategyAdvisor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchInsights();
  }, [user]);

  const fetchInsights = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
    const { data, error } = await supabase
      .from('ai_insights')
      .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setInsights(data || []);
    } catch (error) {
      console.error('Error fetching insights:', error);
      toast({
        title: "Error",
        description: "Failed to load AI insights",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const refreshInsights = async () => {
    if (!user) return;

    setIsRefreshing(true);
    try {
      const { data, error } = await supabase.rpc('refresh_ai_insights', {
        p_user_id: user.id
      });

      if (error) throw error;

      toast({
        title: "Insights Refreshed",
        description: `Generated ${data || 0} new insights based on your latest betting data`
      });

      await fetchInsights();
    } catch (error) {
      console.error('Error refreshing insights:', error);
      toast({
        title: "Error",
        description: "Failed to refresh insights",
        variant: "destructive"
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      const { error } = await supabase
        .from('ai_insights')
        .update({
          status: 'dismissed',
          dismissed_at: new Date().toISOString()
        })
        .eq('id', insightId);

      if (error) throw error;

      setInsights(prev => prev.filter(i => i.id !== insightId));

      toast({
        title: "Insight Dismissed",
        description: "This insight has been removed from your feed"
      });
    } catch (error) {
      console.error('Error dismissing insight:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss insight",
        variant: "destructive"
      });
    }
  };

  const markAsActedUpon = async (insightId: string) => {
    try {
      const { error } = await supabase
        .from('ai_insights')
        .update({
          status: 'acted_upon',
          acted_at: new Date().toISOString()
        })
        .eq('id', insightId);

      if (error) throw error;

      setInsights(prev => prev.filter(i => i.id !== insightId));

      toast({
        title: "Great!",
        description: "Thanks for acting on this insight"
      });
    } catch (error) {
      console.error('Error updating insight:', error);
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'strength':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'weakness':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'opportunity':
        return <Lightbulb className="w-5 h-5 text-yellow-500" />;
      case 'risk':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      default:
        return <Target className="w-5 h-5 text-blue-500" />;
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-500';
    if (confidence >= 60) return 'bg-yellow-500';
    return 'bg-orange-500';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return 'High Confidence';
    if (confidence >= 60) return 'Medium Confidence';
    return 'Low Confidence';
  };

  const getImpactBadgeVariant = (impact: string) => {
    switch (impact) {
      case 'high':
        return 'default' as const;
      case 'medium':
        return 'secondary' as const;
      default:
        return 'outline' as const;
    }
  };

  const filteredInsights = selectedType === 'all'
    ? insights
    : insights.filter(i => i.insight_type === selectedType);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>AI Strategy Advisor</CardTitle>
          <CardDescription>Loading insights...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
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
              <Lightbulb className="w-6 h-6 text-yellow-500" />
              AI Strategy Advisor
            </CardTitle>
            <CardDescription>
              Personalized insights based on your betting patterns
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={refreshInsights}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="text-center py-12">
            <Lightbulb className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Insights Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Place more bets to receive AI-powered insights about your betting strategy
            </p>
            <Button onClick={refreshInsights} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Generate Insights
            </Button>
          </div>
        ) : (
          <>
            <Tabs value={selectedType} onValueChange={setSelectedType} className="mb-6">
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="strength">Strengths</TabsTrigger>
                <TabsTrigger value="weakness">Weaknesses</TabsTrigger>
                <TabsTrigger value="opportunity">Opportunities</TabsTrigger>
                <TabsTrigger value="risk">Risks</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-4">
              {filteredInsights.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No {selectedType} insights available
                </div>
              ) : (
                filteredInsights.map((insight) => (
                  <Card key={insight.id} className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => dismissInsight(insight.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    <CardHeader className="pb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-1">{getInsightIcon(insight.insight_type)}</div>
                        <div className="flex-1">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <CardTitle className="text-base">{insight.title}</CardTitle>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant={getImpactBadgeVariant(insight.potential_impact)}>
                              {insight.potential_impact.toUpperCase()} IMPACT
                            </Badge>
                            <Badge variant="outline">
                              {insight.category.replace('_', ' ').toUpperCase()}
                            </Badge>
                            {insight.sample_size > 0 && (
                              <Badge variant="secondary">
                                {insight.sample_size} bets
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getConfidenceColor(insight.confidence_score)}`}
                                style={{ width: `${insight.confidence_score}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {getConfidenceLabel(insight.confidence_score)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <div>
                        <p className="text-sm mb-2">{insight.description}</p>
                      </div>

                      {insight.supporting_data && Object.keys(insight.supporting_data).length > 0 && (
                        <div className="bg-muted rounded-lg p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            SUPPORTING DATA
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {Object.entries(insight.supporting_data).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-muted-foreground">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}:
                                </span>{' '}
                                <span className="font-semibold">
                                  {typeof value === 'number' ? value.toFixed(2) : value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {insight.recommendation && (
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <Target className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                                RECOMMENDATION
                              </p>
                              <p className="text-sm">{insight.recommendation}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => markAsActedUpon(insight.id)}
                          className="flex-1"
                        >
                          <ThumbsUp className="w-4 h-4 mr-2" />
                          I'll Act on This
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dismissInsight(insight.id)}
                          className="flex-1"
                        >
                          <ThumbsDown className="w-4 h-4 mr-2" />
                          Not Useful
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
