import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Target, Plus, Trophy, Calendar, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Goal {
  goal_id: string;
  goal_type: string;
  goal_name: string;
  goal_description: string;
  target_value: number;
  current_value: number;
  progress_percentage: number;
  unit: string;
  start_date: string;
  end_date: string | null;
  is_achieved: boolean;
  days_remaining: number | null;
}

export function GoalTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({
    goalType: 'profit',
    goalName: '',
    targetValue: '',
    timePeriod: 'monthly'
  });

  const fetchGoals = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_active_goals', {
        p_user_id: user.id
      });

      if (error) throw error;

      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
      toast({
        title: "Error",
        description: "Failed to load goals",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, [user]);

  const createGoal = async () => {
    if (!user || !newGoal.goalName || !newGoal.targetValue) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    try {
      const startDate = new Date().toISOString().split('T')[0];
      let endDate = null;

      if (newGoal.timePeriod === 'monthly') {
        const end = new Date();
        end.setMonth(end.getMonth() + 1);
        endDate = end.toISOString().split('T')[0];
      } else if (newGoal.timePeriod === 'yearly') {
        const end = new Date();
        end.setFullYear(end.getFullYear() + 1);
        endDate = end.toISOString().split('T')[0];
      }

      const unit = newGoal.goalType === 'win_rate' || newGoal.goalType === 'roi' ? 'percentage' :
                   newGoal.goalType === 'profit' || newGoal.goalType === 'bankroll' ? 'dollars' : 'count';

      const { error } = await supabase
        .from('user_goals')
        .insert({
          user_id: user.id,
          goal_type: newGoal.goalType,
          goal_name: newGoal.goalName,
          target_value: parseFloat(newGoal.targetValue),
          unit,
          start_date: startDate,
          end_date: endDate,
          time_period: newGoal.timePeriod
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Goal created successfully"
      });

      setDialogOpen(false);
      setNewGoal({
        goalType: 'profit',
        goalName: '',
        targetValue: '',
        timePeriod: 'monthly'
      });

      fetchGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
      toast({
        title: "Error",
        description: "Failed to create goal",
        variant: "destructive"
      });
    }
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case 'profit':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'win_rate':
        return <Target className="w-4 h-4 text-blue-500" />;
      case 'roi':
        return <Trophy className="w-4 h-4 text-yellow-500" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const formatValue = (value: number, unit: string) => {
    if (unit === 'percentage') return `${value.toFixed(1)}%`;
    if (unit === 'dollars') return `$${value.toFixed(2)}`;
    return value.toString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5" />
            Goal Tracker
          </CardTitle>
          <CardDescription>Loading your goals...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Goal Tracker
            </CardTitle>
            <CardDescription>
              Set and track your betting goals
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                New Goal
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Goal</DialogTitle>
                <DialogDescription>
                  Set a target to work towards and track your progress
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="goal-type">Goal Type</Label>
                  <Select
                    value={newGoal.goalType}
                    onValueChange={(value) => setNewGoal({ ...newGoal, goalType: value })}
                  >
                    <SelectTrigger id="goal-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="profit">Profit Target</SelectItem>
                      <SelectItem value="win_rate">Win Rate</SelectItem>
                      <SelectItem value="roi">ROI Target</SelectItem>
                      <SelectItem value="volume">Bet Volume</SelectItem>
                      <SelectItem value="bankroll">Bankroll Milestone</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="goal-name">Goal Name</Label>
                  <Input
                    id="goal-name"
                    placeholder="e.g., Monthly Profit Goal"
                    value={newGoal.goalName}
                    onChange={(e) => setNewGoal({ ...newGoal, goalName: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-value">Target Value</Label>
                  <Input
                    id="target-value"
                    type="number"
                    placeholder="e.g., 200"
                    value={newGoal.targetValue}
                    onChange={(e) => setNewGoal({ ...newGoal, targetValue: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-period">Time Period</Label>
                  <Select
                    value={newGoal.timePeriod}
                    onValueChange={(value) => setNewGoal({ ...newGoal, timePeriod: value })}
                  >
                    <SelectTrigger id="time-period">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                      <SelectItem value="custom">No End Date</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createGoal}>Create Goal</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {goals.length === 0 ? (
          <div className="text-center py-8">
            <Target className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">No active goals yet</p>
            <p className="text-sm text-muted-foreground mb-4">
              Set goals to stay motivated and track your progress
            </p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Goal
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => (
              <Card key={goal.goal_id} className={goal.is_achieved ? 'border-green-500' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      {getGoalIcon(goal.goal_type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">{goal.goal_name}</CardTitle>
                          {goal.is_achieved && (
                            <Badge className="bg-green-500">
                              <Trophy className="w-3 h-3 mr-1" />
                              Achieved!
                            </Badge>
                          )}
                        </div>
                        {goal.goal_description && (
                          <p className="text-xs text-muted-foreground">
                            {goal.goal_description}
                          </p>
                        )}
                      </div>
                    </div>
                    {goal.days_remaining !== null && !goal.is_achieved && (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {goal.days_remaining} days left
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold">
                        {goal.progress_percentage.toFixed(0)}%
                      </span>
                    </div>
                    <Progress value={Math.min(goal.progress_percentage, 100)} />
                  </div>

                  {/* Current vs Target */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="text-lg font-semibold">
                        {formatValue(goal.current_value, goal.unit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Target</p>
                      <p className="text-lg font-semibold">
                        {formatValue(goal.target_value, goal.unit)}
                      </p>
                    </div>
                  </div>

                  {/* Remaining */}
                  {!goal.is_achieved && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-muted-foreground">
                        {formatValue(goal.target_value - goal.current_value, goal.unit)} remaining
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
