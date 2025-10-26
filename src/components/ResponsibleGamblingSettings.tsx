import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Shield, AlertTriangle, Heart, PhoneCall, Save, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LossLimits {
  daily_limit: number | null;
  weekly_limit: number | null;
  monthly_limit: number | null;
  current_daily_loss: number;
  current_weekly_loss: number;
  current_monthly_loss: number;
}

interface CoolOffPeriod {
  end_time: string | null;
  is_active: boolean;
}

/**
 * Responsible Gambling Settings Component
 * Allows users to set loss limits, take breaks, and access help resources
 * Implements PRD Section 4.6: Responsible Gambling Features
 */
export const ResponsibleGamblingSettings = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [limits, setLimits] = useState<LossLimits>({
    daily_limit: null,
    weekly_limit: null,
    monthly_limit: null,
    current_daily_loss: 0,
    current_weekly_loss: 0,
    current_monthly_loss: 0,
  });

  const [dailyLimit, setDailyLimit] = useState("");
  const [weeklyLimit, setWeeklyLimit] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [enableLimits, setEnableLimits] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [coolOffDialog, setCoolOffDialog] = useState(false);
  const [coolOffPeriod, setCoolOffPeriod] = useState<CoolOffPeriod>({
    end_time: null,
    is_active: false,
  });

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Load loss limits from database
      const { data: limitsData, error: limitsError } = await supabase
        .from("loss_limits")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (limitsError && limitsError.code !== "PGRST116") {
        throw limitsError;
      }

      if (limitsData) {
        setLimits({
          daily_limit: limitsData.daily_limit,
          weekly_limit: limitsData.weekly_limit,
          monthly_limit: limitsData.monthly_limit,
          current_daily_loss: limitsData.current_daily_loss || 0,
          current_weekly_loss: limitsData.current_weekly_loss || 0,
          current_monthly_loss: limitsData.current_monthly_loss || 0,
        });

        setDailyLimit(limitsData.daily_limit?.toString() || "");
        setWeeklyLimit(limitsData.weekly_limit?.toString() || "");
        setMonthlyLimit(limitsData.monthly_limit?.toString() || "");
        setEnableLimits(
          limitsData.daily_limit !== null ||
          limitsData.weekly_limit !== null ||
          limitsData.monthly_limit !== null
        );
      }

      // Load cool-off period from profiles table
      const { data: profile } = await supabase
        .from("profiles")
        .select("cool_off_end")
        .eq("id", user.id)
        .single();

      if (profile?.cool_off_end) {
        const endTime = new Date(profile.cool_off_end);
        const now = new Date();
        setCoolOffPeriod({
          end_time: profile.cool_off_end,
          is_active: endTime > now,
        });
      }
    } catch (error) {
      console.error("Error loading settings:", error);
      toast({
        title: "Error",
        description: "Failed to load responsible gambling settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveLimits = async () => {
    if (!user) return;

    try {
      setSaving(true);

      const newLimits = enableLimits
        ? {
            daily_limit: dailyLimit ? Number(dailyLimit) : null,
            weekly_limit: weeklyLimit ? Number(weeklyLimit) : null,
            monthly_limit: monthlyLimit ? Number(monthlyLimit) : null,
          }
        : {
            daily_limit: null,
            weekly_limit: null,
            monthly_limit: null,
          };

      const { error } = await supabase
        .from("loss_limits")
        .upsert({
          user_id: user.id,
          ...newLimits,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your responsible gambling limits have been updated",
      });

      loadSettings();
    } catch (error) {
      console.error("Error saving limits:", error);
      toast({
        title: "Error",
        description: "Failed to save limits",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startCoolOff = async (hours: number) => {
    if (!user) return;

    try {
      const endTime = new Date();
      endTime.setHours(endTime.getHours() + hours);

      const { error } = await supabase
        .from("profiles")
        .update({ cool_off_end: endTime.toISOString() })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Cool-off period started",
        description: `You won't be able to place bets for ${hours} hours`,
      });

      setCoolOffDialog(false);
      loadSettings();
    } catch (error) {
      console.error("Error starting cool-off:", error);
      toast({
        title: "Error",
        description: "Failed to start cool-off period",
        variant: "destructive",
      });
    }
  };

  const cancelCoolOff = async () => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ cool_off_end: null })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Cool-off cancelled",
        description: "You can now place bets again",
      });

      loadSettings();
    } catch (error) {
      console.error("Error cancelling cool-off:", error);
      toast({
        title: "Error",
        description: "Failed to cancel cool-off period",
        variant: "destructive",
      });
    }
  };

  const getLimitPercentage = (current: number, limit: number | null) => {
    if (!limit || limit === 0) return 0;
    return Math.min((current / limit) * 100, 100);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Responsible Gambling</h2>
          <p className="text-sm text-muted-foreground">
            Set limits to help you bet responsibly
          </p>
        </div>
      </div>

      {/* Cool-Off Status */}
      {coolOffPeriod.is_active && coolOffPeriod.end_time && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-900 dark:text-yellow-100">
                  Cool-off period active
                </p>
                <p className="text-sm text-yellow-800 dark:text-yellow-200 mt-1">
                  Bet placement disabled until{" "}
                  {new Date(coolOffPeriod.end_time).toLocaleString()}
                </p>
                <Button
                  onClick={cancelCoolOff}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  Cancel Cool-off
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loss Limits */}
      <Card>
        <CardHeader>
          <CardTitle>Loss Limits</CardTitle>
          <CardDescription>
            Set maximum loss amounts to prevent excessive betting
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/Disable Limits */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="enable-limits" className="text-base">
                Enable Loss Limits
              </Label>
              <p className="text-sm text-muted-foreground">
                Prevent betting when limits are reached
              </p>
            </div>
            <Switch
              id="enable-limits"
              checked={enableLimits}
              onCheckedChange={setEnableLimits}
            />
          </div>

          {enableLimits && (
            <>
              {/* Daily Limit */}
              <div className="space-y-2">
                <Label htmlFor="daily-limit">Daily Loss Limit ($)</Label>
                <Input
                  id="daily-limit"
                  type="number"
                  placeholder="No limit"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  min="0"
                  step="10"
                />
                {limits.daily_limit && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Current: ${limits.current_daily_loss.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        Limit: ${limits.daily_limit.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          getLimitPercentage(
                            limits.current_daily_loss,
                            limits.daily_limit
                          ) >= 75
                            ? "bg-red-500"
                            : getLimitPercentage(
                                limits.current_daily_loss,
                                limits.daily_limit
                              ) >= 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${getLimitPercentage(
                            limits.current_daily_loss,
                            limits.daily_limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Weekly Limit */}
              <div className="space-y-2">
                <Label htmlFor="weekly-limit">Weekly Loss Limit ($)</Label>
                <Input
                  id="weekly-limit"
                  type="number"
                  placeholder="No limit"
                  value={weeklyLimit}
                  onChange={(e) => setWeeklyLimit(e.target.value)}
                  min="0"
                  step="50"
                />
                {limits.weekly_limit && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Current: ${limits.current_weekly_loss.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        Limit: ${limits.weekly_limit.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          getLimitPercentage(
                            limits.current_weekly_loss,
                            limits.weekly_limit
                          ) >= 75
                            ? "bg-red-500"
                            : getLimitPercentage(
                                limits.current_weekly_loss,
                                limits.weekly_limit
                              ) >= 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${getLimitPercentage(
                            limits.current_weekly_loss,
                            limits.weekly_limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Limit */}
              <div className="space-y-2">
                <Label htmlFor="monthly-limit">Monthly Loss Limit ($)</Label>
                <Input
                  id="monthly-limit"
                  type="number"
                  placeholder="No limit"
                  value={monthlyLimit}
                  onChange={(e) => setMonthlyLimit(e.target.value)}
                  min="0"
                  step="100"
                />
                {limits.monthly_limit && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Current: ${limits.current_monthly_loss.toFixed(2)}
                      </span>
                      <span className="text-muted-foreground">
                        Limit: ${limits.monthly_limit.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          getLimitPercentage(
                            limits.current_monthly_loss,
                            limits.monthly_limit
                          ) >= 75
                            ? "bg-red-500"
                            : getLimitPercentage(
                                limits.current_monthly_loss,
                                limits.monthly_limit
                              ) >= 50
                            ? "bg-yellow-500"
                            : "bg-green-500"
                        }`}
                        style={{
                          width: `${getLimitPercentage(
                            limits.current_monthly_loss,
                            limits.monthly_limit
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Save Button */}
          <Button onClick={saveLimits} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Limits
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Cool-Off Periods */}
      <Card>
        <CardHeader>
          <CardTitle>Take a Break</CardTitle>
          <CardDescription>
            Temporarily disable bet placement to take a break
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => setCoolOffDialog(true)}
            variant="outline"
            className="w-full"
            disabled={coolOffPeriod.is_active}
          >
            <Heart className="w-4 h-4 mr-2" />
            Start Cool-off Period
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            You can cancel the cool-off at any time
          </p>
        </CardContent>
      </Card>

      {/* Help Resources */}
      <Card className="border-blue-500/20 bg-blue-500/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="w-5 h-5" />
            Need Help?
          </CardTitle>
          <CardDescription>
            If you think you may have a gambling problem, help is available
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm">
            <div>
              <p className="font-semibold">National Council on Problem Gambling</p>
              <p className="text-muted-foreground">1-800-522-4700</p>
              <a
                href="https://www.ncpgambling.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                ncpgambling.org
              </a>
            </div>
            <div>
              <p className="font-semibold">Gamblers Anonymous</p>
              <a
                href="https://www.gamblersanonymous.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                gamblersanonymous.org
              </a>
            </div>
            <div>
              <p className="font-semibold">Crisis Text Line</p>
              <p className="text-muted-foreground">Text "HELP" to 741741</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cool-Off Dialog */}
      <Dialog open={coolOffDialog} onOpenChange={setCoolOffDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start Cool-off Period</DialogTitle>
            <DialogDescription>
              Choose how long you want to disable bet placement
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              onClick={() => startCoolOff(24)}
              variant="outline"
              className="w-full justify-start"
            >
              24 hours
            </Button>
            <Button
              onClick={() => startCoolOff(72)}
              variant="outline"
              className="w-full justify-start"
            >
              3 days
            </Button>
            <Button
              onClick={() => startCoolOff(168)}
              variant="outline"
              className="w-full justify-start"
            >
              1 week
            </Button>
            <Button
              onClick={() => startCoolOff(720)}
              variant="outline"
              className="w-full justify-start"
            >
              1 month
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCoolOffDialog(false)} variant="ghost">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
