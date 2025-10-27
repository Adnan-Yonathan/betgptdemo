import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MessageSquare,
  Target,
  Bell,
  TrendingUp,
  ThumbsUp,
  ThumbsDown,
  Star,
  Activity,
  BarChart3,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

interface MessageAnalytics {
  total: number;
  positive: number;
  negative: number;
  positiveRate: string;
  avgRating: string;
  byResponseType: Record<string, any>;
}

interface PredictionAnalytics {
  total: number;
  helpful: number;
  accurate: number;
  helpfulRate: string;
  accuracyRate: string;
  betsPlaced: number;
  avgConfidence: string;
  avgValue: string;
  totalProfit: string;
  bySport: Record<string, any>;
}

interface AlertAnalytics {
  total: number;
  useful: number;
  timely: number;
  accurate: number;
  usefulRate: string;
  timelyRate: string;
  accuracyRate: string;
  ledToBet: number;
  conversionRate: string;
  falsePositives: number;
  falsePositiveRate: string;
  avgRelevance: string;
  avgTimeToAction: string;
  byAlertType: Record<string, any>;
  actionDistribution: Record<string, number>;
}

interface OverallAnalytics {
  message: MessageAnalytics;
  prediction: PredictionAnalytics;
  alert: AlertAnalytics;
  summary: {
    totalFeedbackItems: number;
    overallSatisfaction: string;
  };
}

/**
 * FeedbackDashboard Component
 * Displays comprehensive analytics about user feedback across all feedback types
 * Shows trends, satisfaction rates, and improvement metrics
 */
export const FeedbackDashboard = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<OverallAnalytics | null>(null);

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user, period]);

  const loadAnalytics = async () => {
    if (!user) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('feedback-analytics', {
        body: { type: 'overall', period }
      });

      if (error) throw error;

      setAnalytics(data);
    } catch (error) {
      console.error('Error loading feedback analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Feedback Analytics</CardTitle>
          <CardDescription>Please sign in to view your feedback analytics</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Feedback Analytics</h2>
          <p className="text-muted-foreground">
            Track how your feedback is helping improve the AI
          </p>
        </div>
        <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">Last 7 Days</SelectItem>
            <SelectItem value="month">Last 30 Days</SelectItem>
            <SelectItem value="quarter">Last 90 Days</SelectItem>
            <SelectItem value="year">Last Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <LoadingSkeleton />
      ) : analytics ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Feedback</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.summary.totalFeedbackItems}</div>
                <p className="text-xs text-muted-foreground">
                  Across all feedback types
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overall Satisfaction</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.summary.overallSatisfaction}%</div>
                <Progress value={parseFloat(analytics.summary.overallSatisfaction)} className="mt-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Messages Rated</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.message.total}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.message.positiveRate}% positive
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Predictions Tracked</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics.prediction.total}</div>
                <p className="text-xs text-muted-foreground">
                  {analytics.prediction.accuracyRate}% accurate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Analytics Tabs */}
          <Tabs defaultValue="messages" className="space-y-4">
            <TabsList>
              <TabsTrigger value="messages">
                <MessageSquare className="h-4 w-4 mr-2" />
                Message Feedback
              </TabsTrigger>
              <TabsTrigger value="predictions">
                <Target className="h-4 w-4 mr-2" />
                Predictions
              </TabsTrigger>
              <TabsTrigger value="alerts">
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="space-y-4">
              <MessageFeedbackAnalytics data={analytics.message} />
            </TabsContent>

            <TabsContent value="predictions" className="space-y-4">
              <PredictionFeedbackAnalytics data={analytics.prediction} />
            </TabsContent>

            <TabsContent value="alerts" className="space-y-4">
              <AlertFeedbackAnalytics data={analytics.alert} />
            </TabsContent>
          </Tabs>
        </>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Feedback Data</CardTitle>
            <CardDescription>
              Start providing feedback on messages, predictions, and alerts to see analytics here
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
};

const MessageFeedbackAnalytics = ({ data }: { data: MessageAnalytics }) => (
  <div className="grid gap-4 md:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle>Feedback Distribution</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-green-600" />
            <span>Positive</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{data.positive}</span>
            <Badge variant="outline">{data.positiveRate}%</Badge>
          </div>
        </div>
        <Progress value={parseFloat(data.positiveRate)} className="bg-red-100" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ThumbsDown className="h-4 w-4 text-red-600" />
            <span>Negative</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{data.negative}</span>
            <Badge variant="outline">{(100 - parseFloat(data.positiveRate)).toFixed(1)}%</Badge>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>By Response Type</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {Object.entries(data.byResponseType).map(([type, stats]: [string, any]) => (
          <div key={type} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="capitalize">{type}</span>
              <span className="font-medium">{stats.total} ratings</span>
            </div>
            <Progress
              value={(stats.positive / stats.total) * 100}
              className="h-2"
            />
          </div>
        ))}
      </CardContent>
    </Card>

    {parseFloat(data.avgRating) > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>Average Rating</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Star className="h-8 w-8 text-yellow-500 fill-current" />
            <span className="text-4xl font-bold">{data.avgRating}</span>
            <span className="text-muted-foreground">/ 5.0</span>
          </div>
        </CardContent>
      </Card>
    )}
  </div>
);

const PredictionFeedbackAnalytics = ({ data }: { data: PredictionAnalytics }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <Card>
      <CardHeader>
        <CardTitle>Prediction Quality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Helpful</span>
            <Badge>{data.helpfulRate}%</Badge>
          </div>
          <Progress value={parseFloat(data.helpfulRate)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Accurate</span>
            <Badge>{data.accuracyRate}%</Badge>
          </div>
          <Progress value={parseFloat(data.accuracyRate)} className="bg-blue-100" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>User Engagement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Bets Placed</span>
          <span className="text-2xl font-bold">{data.betsPlaced}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Avg Confidence</span>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <span className="font-bold">{data.avgConfidence}</span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Avg Value</span>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-yellow-500 fill-current" />
            <span className="font-bold">{data.avgValue}</span>
          </div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Total Profit/Loss</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn(
          "text-4xl font-bold",
          parseFloat(data.totalProfit) >= 0 ? "text-green-600" : "text-red-600"
        )}>
          {parseFloat(data.totalProfit) >= 0 ? '+' : ''}${data.totalProfit}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          From predictions with feedback
        </p>
      </CardContent>
    </Card>

    <Card className="md:col-span-2 lg:col-span-3">
      <CardHeader>
        <CardTitle>Performance by Sport</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {Object.entries(data.bySport).map(([sport, stats]: [string, any]) => (
            <div key={sport} className="space-y-2 p-3 border rounded-lg">
              <div className="font-semibold capitalize">{sport}</div>
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span>{stats.total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Helpful</span>
                  <span>{((stats.helpful / stats.total) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Accurate</span>
                  <span>{((stats.accurate / stats.total) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bets</span>
                  <span>{stats.betsPlaced}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

const AlertFeedbackAnalytics = ({ data }: { data: AlertAnalytics }) => (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    <Card>
      <CardHeader>
        <CardTitle>Alert Quality</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Useful</span>
            <Badge>{data.usefulRate}%</Badge>
          </div>
          <Progress value={parseFloat(data.usefulRate)} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Timely</span>
            <Badge>{data.timelyRate}%</Badge>
          </div>
          <Progress value={parseFloat(data.timelyRate)} className="bg-blue-100" />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Accurate</span>
            <Badge>{data.accuracyRate}%</Badge>
          </div>
          <Progress value={parseFloat(data.accuracyRate)} className="bg-green-100" />
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Conversion Metrics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm">Led to Bet</span>
          <span className="text-2xl font-bold">{data.ledToBet}</span>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Conversion Rate</span>
            <Badge variant="secondary">{data.conversionRate}%</Badge>
          </div>
          <Progress value={parseFloat(data.conversionRate)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm">Avg Time to Action</span>
          <span className="font-bold">{data.avgTimeToAction}s</span>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>False Positives</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3 mb-3">
          <AlertCircle className="h-8 w-8 text-orange-500" />
          <div>
            <div className="text-3xl font-bold">{data.falsePositives}</div>
            <div className="text-sm text-muted-foreground">{data.falsePositiveRate}% rate</div>
          </div>
        </div>
        <Progress value={parseFloat(data.falsePositiveRate)} className="bg-orange-100" />
      </CardContent>
    </Card>

    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Alert Type Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Object.entries(data.byAlertType).map(([type, stats]: [string, any]) => (
            <div key={type} className="flex items-center justify-between p-3 border rounded">
              <div>
                <div className="font-medium capitalize">{type}</div>
                <div className="text-sm text-muted-foreground">
                  {stats.total} alerts • {((stats.useful / stats.total) * 100).toFixed(0)}% useful
                </div>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Bets:</span> {stats.ledToBet}
                </div>
                <div>
                  <span className="text-muted-foreground">False:</span> {stats.falsePositives}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>User Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {Object.entries(data.actionDistribution).map(([action, count]) => (
            <div key={action} className="flex items-center justify-between text-sm">
              <span className="capitalize">{action.replace('_', ' ')}</span>
              <Badge variant="outline">{count}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  </div>
);

const LoadingSkeleton = () => (
  <div className="space-y-4">
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
    <Skeleton className="h-[400px] w-full" />
  </div>
);
