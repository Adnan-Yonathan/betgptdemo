import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Eye,
  X
} from "lucide-react";

interface Pattern {
  id: string;
  pattern_type: 'strength' | 'weakness' | 'anomaly';
  pattern_name: string;
  pattern_description: string;
  occurrences: number;
  confidence: number;
  impact_metrics: Record<string, any>;
  recommendation: string;
  status: 'active' | 'dismissed' | 'resolved';
  first_detected_at: string;
  last_detected_at: string;
}

export function PatternInsights() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchPatterns();
  }, [user]);

  const fetchPatterns = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pattern_detections')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('confidence', { ascending: false });

      if (error) throw error;

      setPatterns(data || []);
    } catch (error) {
      console.error('Error fetching patterns:', error);
      toast({
        title: "Error",
        description: "Failed to load pattern insights",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const dismissPattern = async (patternId: string) => {
    try {
      const { error } = await supabase
        .from('pattern_detections')
        .update({ status: 'dismissed' })
        .eq('id', patternId);

      if (error) throw error;

      setPatterns(prev => prev.filter(p => p.id !== patternId));

      toast({
        title: "Pattern Dismissed",
        description: "This pattern has been removed from your feed"
      });
    } catch (error) {
      console.error('Error dismissing pattern:', error);
      toast({
        title: "Error",
        description: "Failed to dismiss pattern",
        variant: "destructive"
      });
    }
  };

  const markAsResolved = async (patternId: string) => {
    try {
      const { error } = await supabase
        .from('pattern_detections')
        .update({ status: 'resolved' })
        .eq('id', patternId);

      if (error) throw error;

      setPatterns(prev => prev.filter(p => p.id !== patternId));

      toast({
        title: "Pattern Resolved!",
        description: "Great job addressing this pattern"
      });
    } catch (error) {
      console.error('Error resolving pattern:', error);
      toast({
        title: "Error",
        description: "Failed to mark pattern as resolved",
        variant: "destructive"
      });
    }
  };

  const getPatternIcon = (type: string) => {
    switch (type) {
      case 'strength':
        return <TrendingUp className="w-5 h-5 text-green-500" />;
      case 'weakness':
        return <TrendingDown className="w-5 h-5 text-red-500" />;
      case 'anomaly':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <Eye className="w-5 h-5 text-blue-500" />;
    }
  };

  const getPatternColor = (type: string) => {
    switch (type) {
      case 'strength':
        return 'border-green-500/50 bg-green-500/5';
      case 'weakness':
        return 'border-red-500/50 bg-red-500/5';
      case 'anomaly':
        return 'border-yellow-500/50 bg-yellow-500/5';
      default:
        return 'border-border';
    }
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 80) return { label: 'Very Confident', color: 'text-green-600' };
    if (confidence >= 60) return { label: 'Confident', color: 'text-yellow-600' };
    return { label: 'Moderate', color: 'text-orange-600' };
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Betting Patterns</CardTitle>
          <CardDescription>Loading patterns...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const strengths = patterns.filter(p => p.pattern_type === 'strength');
  const weaknesses = patterns.filter(p => p.pattern_type === 'weakness');
  const anomalies = patterns.filter(p => p.pattern_type === 'anomaly');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="w-6 h-6" />
          Betting Pattern Analysis
        </CardTitle>
        <CardDescription>
          Automatically detected patterns in your betting behavior
        </CardDescription>
      </CardHeader>
      <CardContent>
        {patterns.length === 0 ? (
          <div className="text-center py-12">
            <Eye className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Patterns Detected Yet</h3>
            <p className="text-sm text-muted-foreground">
              Continue betting to allow our AI to identify patterns in your behavior
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Weaknesses Section */}
            {weaknesses.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-red-600 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  AREAS FOR IMPROVEMENT ({weaknesses.length})
                </h3>
                <div className="space-y-3">
                  {weaknesses.map((pattern) => {
                    const confidenceInfo = getConfidenceLabel(pattern.confidence);
                    return (
                      <Card key={pattern.id} className={`${getPatternColor(pattern.pattern_type)} border-2 relative`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => dismissPattern(pattern.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>

                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            {getPatternIcon(pattern.pattern_type)}
                            <div className="flex-1">
                              <CardTitle className="text-base mb-2">{pattern.pattern_name}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="destructive">
                                  {pattern.occurrences} occurrence{pattern.occurrences !== 1 ? 's' : ''}
                                </Badge>
                                <Badge variant="outline" className={confidenceInfo.color}>
                                  {confidenceInfo.label} ({pattern.confidence.toFixed(0)}%)
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          <p className="text-sm">{pattern.pattern_description}</p>

                          {pattern.impact_metrics && Object.keys(pattern.impact_metrics).length > 0 && (
                            <div className="bg-muted rounded-lg p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">
                                IMPACT METRICS
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {Object.entries(pattern.impact_metrics).map(([key, value]) => (
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

                          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">
                              HOW TO FIX
                            </p>
                            <p className="text-sm">{pattern.recommendation}</p>
                          </div>

                          <div className="flex gap-2 pt-2">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => markAsResolved(pattern.id)}
                              className="flex-1"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Mark as Fixed
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => dismissPattern(pattern.id)}
                            >
                              Dismiss
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Strengths Section */}
            {strengths.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-green-600 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  STRENGTHS ({strengths.length})
                </h3>
                <div className="space-y-3">
                  {strengths.map((pattern) => {
                    const confidenceInfo = getConfidenceLabel(pattern.confidence);
                    return (
                      <Card key={pattern.id} className={`${getPatternColor(pattern.pattern_type)} border-2 relative`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => dismissPattern(pattern.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>

                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            {getPatternIcon(pattern.pattern_type)}
                            <div className="flex-1">
                              <CardTitle className="text-base mb-2">{pattern.pattern_name}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="default">
                                  {pattern.occurrences} occurrence{pattern.occurrences !== 1 ? 's' : ''}
                                </Badge>
                                <Badge variant="outline" className={confidenceInfo.color}>
                                  {confidenceInfo.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          <p className="text-sm">{pattern.pattern_description}</p>

                          {pattern.impact_metrics && Object.keys(pattern.impact_metrics).length > 0 && (
                            <div className="bg-muted rounded-lg p-3">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">
                                IMPACT METRICS
                              </p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                {Object.entries(pattern.impact_metrics).map(([key, value]) => (
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

                          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">
                              LEVERAGE THIS
                            </p>
                            <p className="text-sm">{pattern.recommendation}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Anomalies Section */}
            {anomalies.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-yellow-600 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  UNUSUAL PATTERNS ({anomalies.length})
                </h3>
                <div className="space-y-3">
                  {anomalies.map((pattern) => {
                    const confidenceInfo = getConfidenceLabel(pattern.confidence);
                    return (
                      <Card key={pattern.id} className={`${getPatternColor(pattern.pattern_type)} border-2 relative`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6"
                          onClick={() => dismissPattern(pattern.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>

                        <CardHeader className="pb-3">
                          <div className="flex items-start gap-3">
                            {getPatternIcon(pattern.pattern_type)}
                            <div className="flex-1">
                              <CardTitle className="text-base mb-2">{pattern.pattern_name}</CardTitle>
                              <div className="flex flex-wrap gap-2">
                                <Badge variant="outline">
                                  {pattern.occurrences} occurrence{pattern.occurrences !== 1 ? 's' : ''}
                                </Badge>
                                <Badge variant="outline" className={confidenceInfo.color}>
                                  {confidenceInfo.label}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="space-y-3">
                          <p className="text-sm">{pattern.pattern_description}</p>

                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                            <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400 mb-1">
                              WORTH INVESTIGATING
                            </p>
                            <p className="text-sm">{pattern.recommendation}</p>
                          </div>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => dismissPattern(pattern.id)}
                            className="w-full"
                          >
                            Dismiss
                          </Button>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
