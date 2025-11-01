import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, Save, Settings } from "lucide-react";

interface AlertSettings {
  alerts_enabled: boolean;
  alert_game_starting: boolean;
  alert_close_finish: boolean;
  alert_momentum_shift: boolean;
  alert_critical_moment: boolean;
  alert_hedge_opportunity: boolean;
  alert_win_prob_change: boolean;
  alert_line_movement: boolean;
  alert_injury_update: boolean;
  win_prob_change_threshold: number;
  momentum_points_threshold: number;
  hedge_profit_threshold: number;
  close_finish_minutes: number;
  notify_via_app: boolean;
  notify_via_email: boolean;
  notify_via_sms: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
}

const defaultSettings: AlertSettings = {
  alerts_enabled: true,
  alert_game_starting: true,
  alert_close_finish: true,
  alert_momentum_shift: true,
  alert_critical_moment: true,
  alert_hedge_opportunity: true,
  alert_win_prob_change: true,
  alert_line_movement: true,
  alert_injury_update: true,
  win_prob_change_threshold: 0.15,
  momentum_points_threshold: 8,
  hedge_profit_threshold: 0.10,
  close_finish_minutes: 5,
  notify_via_app: true,
  notify_via_email: false,
  notify_via_sms: false,
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null
};

export function AlertSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<AlertSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch current settings
  useEffect(() => {
    const fetchSettings = async () => {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from('user_alert_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "not found" error, which is ok for first time
          throw error;
        }

        if (data) {
          setSettings({
            ...defaultSettings,
            ...data
          });
        }
      } catch (error) {
        console.error('Error fetching alert settings:', error);
        toast({
          title: "Error",
          description: "Failed to load alert settings",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [user]);

  // Save settings
  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_alert_preferences')
        .upsert({
          user_id: user.id,
          ...settings,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your alert preferences have been updated"
      });
    } catch (error) {
      console.error('Error saving alert settings:', error);
      toast({
        title: "Error",
        description: "Failed to save settings",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Alert Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5" />
          Alert Settings
        </CardTitle>
        <CardDescription>
          Customize when and how you receive notifications about your bets
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Master Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="alerts-enabled" className="text-base font-semibold">
              Enable Alerts
            </Label>
            <p className="text-sm text-muted-foreground">
              Turn all alerts on or off
            </p>
          </div>
          <Switch
            id="alerts-enabled"
            checked={settings.alerts_enabled}
            onCheckedChange={(checked) =>
              setSettings({ ...settings, alerts_enabled: checked })
            }
          />
        </div>

        <Separator />

        {/* Alert Types */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Alert Types</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="game-starting">Game Starting</Label>
                <p className="text-xs text-muted-foreground">
                  10 minutes before game starts
                </p>
              </div>
              <Switch
                id="game-starting"
                checked={settings.alert_game_starting}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_game_starting: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="close-finish">Close Finish</Label>
                <p className="text-xs text-muted-foreground">
                  Game is close in final minutes
                </p>
              </div>
              <Switch
                id="close-finish"
                checked={settings.alert_close_finish}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_close_finish: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="momentum-shift">Momentum Shift</Label>
                <p className="text-xs text-muted-foreground">
                  Significant scoring runs
                </p>
              </div>
              <Switch
                id="momentum-shift"
                checked={settings.alert_momentum_shift}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_momentum_shift: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="critical-moment">Critical Moment</Label>
                <p className="text-xs text-muted-foreground">
                  Under 2 minutes, close game
                </p>
              </div>
              <Switch
                id="critical-moment"
                checked={settings.alert_critical_moment}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_critical_moment: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="hedge-opportunity">Hedge Opportunity</Label>
                <p className="text-xs text-muted-foreground">
                  Profitable hedge available
                </p>
              </div>
              <Switch
                id="hedge-opportunity"
                checked={settings.alert_hedge_opportunity}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_hedge_opportunity: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="win-prob-change">Win Probability Change</Label>
                <p className="text-xs text-muted-foreground">
                  Significant probability shift
                </p>
              </div>
              <Switch
                id="win-prob-change"
                checked={settings.alert_win_prob_change}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_win_prob_change: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="line-movement">Line Movement</Label>
                <p className="text-xs text-muted-foreground">
                  Live odds changed significantly
                </p>
              </div>
              <Switch
                id="line-movement"
                checked={settings.alert_line_movement}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_line_movement: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="injury-update">Injury Update</Label>
                <p className="text-xs text-muted-foreground">
                  Key player injured during game
                </p>
              </div>
              <Switch
                id="injury-update"
                checked={settings.alert_injury_update}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, alert_injury_update: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Thresholds */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Alert Thresholds</h3>

          <div className="space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="win-prob-threshold">
                  Win Probability Change
                </Label>
                <span className="text-sm text-muted-foreground">
                  {(settings.win_prob_change_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="win-prob-threshold"
                min={5}
                max={30}
                step={5}
                value={[settings.win_prob_change_threshold * 100]}
                onValueChange={([value]) =>
                  setSettings({ ...settings, win_prob_change_threshold: value / 100 })
                }
                disabled={!settings.alerts_enabled}
              />
              <p className="text-xs text-muted-foreground">
                Alert when win probability changes by this percentage or more
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="momentum-threshold">
                  Momentum Points
                </Label>
                <span className="text-sm text-muted-foreground">
                  {settings.momentum_points_threshold} pts
                </span>
              </div>
              <Slider
                id="momentum-threshold"
                min={5}
                max={15}
                step={1}
                value={[settings.momentum_points_threshold]}
                onValueChange={([value]) =>
                  setSettings({ ...settings, momentum_points_threshold: value })
                }
                disabled={!settings.alerts_enabled}
              />
              <p className="text-xs text-muted-foreground">
                Alert on scoring runs of this size or larger (last 5 min)
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="hedge-threshold">
                  Hedge Profit
                </Label>
                <span className="text-sm text-muted-foreground">
                  {(settings.hedge_profit_threshold * 100).toFixed(0)}%
                </span>
              </div>
              <Slider
                id="hedge-threshold"
                min={5}
                max={25}
                step={5}
                value={[settings.hedge_profit_threshold * 100]}
                onValueChange={([value]) =>
                  setSettings({ ...settings, hedge_profit_threshold: value / 100 })
                }
                disabled={!settings.alerts_enabled}
              />
              <p className="text-xs text-muted-foreground">
                Alert when hedge guarantees this profit percentage or more
              </p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiet-hours" className="text-sm font-semibold">
                Quiet Hours
              </Label>
              <p className="text-xs text-muted-foreground">
                Don't send notifications during these hours
              </p>
            </div>
            <Switch
              id="quiet-hours"
              checked={settings.quiet_hours_enabled}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, quiet_hours_enabled: checked })
              }
              disabled={!settings.alerts_enabled}
            />
          </div>

          {settings.quiet_hours_enabled && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quiet-start">Start Time</Label>
                <Input
                  id="quiet-start"
                  type="time"
                  value={settings.quiet_hours_start || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, quiet_hours_start: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quiet-end">End Time</Label>
                <Input
                  id="quiet-end"
                  type="time"
                  value={settings.quiet_hours_end || ''}
                  onChange={(e) =>
                    setSettings({ ...settings, quiet_hours_end: e.target.value })
                  }
                />
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Notification Channels */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Notification Channels</h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-app">In-App Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Show notifications in the app
                </p>
              </div>
              <Switch
                id="notify-app"
                checked={settings.notify_via_app}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_via_app: checked })
                }
                disabled={!settings.alerts_enabled}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-email">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send alerts to your email (Coming Soon)
                </p>
              </div>
              <Switch
                id="notify-email"
                checked={settings.notify_via_email}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_via_email: checked })
                }
                disabled={true}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notify-sms">SMS Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send alerts via text message (Coming Soon)
                </p>
              </div>
              <Switch
                id="notify-sms"
                checked={settings.notify_via_sms}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, notify_via_sms: checked })
                }
                disabled={true}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isSaving || !settings.alerts_enabled}
          className="w-full"
        >
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}
