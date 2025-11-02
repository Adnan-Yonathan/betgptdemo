import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, TrendingUp, Clock, AlertCircle } from 'lucide-react';

interface CompletionStats {
  total_users: number;
  completed_users: number;
  completion_rate: number;
  avg_completion_time_minutes: number;
}

interface DropoffStep {
  step_number: number;
  step_name: string;
  users_reached: number;
  users_completed: number;
  users_skipped: number;
  completion_rate: number;
  avg_time_seconds: number;
}

export const OnboardingAnalytics = () => {
  const [completionStats, setCompletionStats] = useState<CompletionStats | null>(null);
  const [dropoffData, setDropoffData] = useState<DropoffStep[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setLoading(true);

      // Get completion rate stats
      const { data: completionData, error: completionError } = await supabase
        .rpc('get_onboarding_completion_rate');

      if (completionError) {
        console.error('Error loading completion stats:', completionError);
      } else if (completionData && completionData.length > 0) {
        setCompletionStats(completionData[0]);
      }

      // Get dropoff analysis
      const { data: dropoffData, error: dropoffError } = await supabase
        .rpc('get_onboarding_dropoff_by_step');

      if (dropoffError) {
        console.error('Error loading dropoff data:', dropoffError);
      } else if (dropoffData) {
        setDropoffData(dropoffData);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg"></div>
          <div className="h-32 bg-muted rounded-lg"></div>
        </div>
      </div>
    );
  }

  const targetCompletionRate = 75; // From PRD
  const targetCompletionTime = 3; // From PRD (3 minutes)
  const meetsCompletionTarget = (completionStats?.completion_rate || 0) >= targetCompletionRate;
  const meetsTimeTarget = (completionStats?.avg_completion_time_minutes || 0) <= targetCompletionTime;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Onboarding Analytics</h2>
        <p className="text-muted-foreground">
          Track user onboarding performance and identify drop-off points
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionStats?.total_users || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Who started onboarding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {completionStats?.completion_rate?.toFixed(1) || 0}%
              </div>
              <Badge variant={meetsCompletionTarget ? 'default' : 'destructive'}>
                Target: {targetCompletionRate}%
              </Badge>
            </div>
            <Progress
              value={completionStats?.completion_rate || 0}
              className="mt-2 h-2"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completionStats?.completed_users || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Finished full onboarding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold">
                {completionStats?.avg_completion_time_minutes?.toFixed(1) || 0}m
              </div>
              <Badge variant={meetsTimeTarget ? 'default' : 'secondary'}>
                Target: ≤{targetCompletionTime}m
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Drop-off Analysis */}
      <Card>
        <CardHeader>
          <CardTitle>Step-by-Step Drop-off Analysis</CardTitle>
          <CardDescription>
            Identify which steps users struggle with or abandon
          </CardDescription>
        </CardHeader>
        <CardContent>
          {dropoffData.length > 0 ? (
            <div className="space-y-4">
              {dropoffData.map((step) => (
                <div key={step.step_number} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold">
                        Step {step.step_number}: {step.step_name}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {step.users_reached} users reached • {step.avg_time_seconds}s avg time
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {step.completion_rate?.toFixed(1) || 0}%
                      </div>
                      <p className="text-xs text-muted-foreground">completed</p>
                    </div>
                  </div>
                  <Progress value={step.completion_rate || 0} className="h-2" />
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span>✓ {step.users_completed} completed</span>
                    {step.users_skipped > 0 && (
                      <span>⊘ {step.users_skipped} skipped</span>
                    )}
                    <span>
                      ✗ {step.users_reached - step.users_completed - step.users_skipped} dropped
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No step data available yet</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Insights */}
      {completionStats && (
        <Card>
          <CardHeader>
            <CardTitle>Insights & Recommendations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!meetsCompletionTarget && (
              <div className="flex gap-2 items-start p-3 bg-destructive/10 rounded-lg">
                <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium">Completion rate below target</p>
                  <p className="text-sm text-muted-foreground">
                    Current: {completionStats.completion_rate?.toFixed(1)}% | Target: {targetCompletionRate}%
                  </p>
                </div>
              </div>
            )}
            {!meetsTimeTarget && (
              <div className="flex gap-2 items-start p-3 bg-yellow-500/10 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="font-medium">Average completion time above target</p>
                  <p className="text-sm text-muted-foreground">
                    Consider simplifying questions or reducing step count
                  </p>
                </div>
              </div>
            )}
            {meetsCompletionTarget && meetsTimeTarget && (
              <div className="flex gap-2 items-start p-3 bg-green-500/10 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                <div>
                  <p className="font-medium">All KPIs meeting targets!</p>
                  <p className="text-sm text-muted-foreground">
                    Onboarding flow is performing well
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
