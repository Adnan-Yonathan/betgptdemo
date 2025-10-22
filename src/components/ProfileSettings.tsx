import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Moon, Sun, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { Tables } from "@/integrations/supabase/types";

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettings = ({ open, onOpenChange }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bankroll, setBankroll] = useState("1000");
  const [betSize, setBetSize] = useState("100");
  const [riskTolerance, setRiskTolerance] = useState("moderate");
  const [profile, setProfile] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    if (user && open) {
      loadProfile();
    }
  }, [user, open]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setBankroll(data.bankroll?.toString() || "1000");
        setBetSize(data.default_bet_size?.toString() || "100");
        setRiskTolerance(data.risk_tolerance || "moderate");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };

  const handleSyncProfile = async () => {
    if (!user) return;

    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-betting-profile', {
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: "Profile Synced",
        description: "Your betting statistics have been synchronized with CRM data.",
      });

      // Reload profile to get updated stats
      await loadProfile();
    } catch (error: any) {
      console.error("Error syncing profile:", error);
      toast({
        title: "Sync Error",
        description: error.message || "Failed to sync profile",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const bankrollValue = parseFloat(bankroll);

      // When user manually updates their bankroll, update both current and initial
      // This represents resetting/starting fresh with a new bankroll amount
      const { error } = await supabase
        .from("profiles")
        .update({
          bankroll: bankrollValue,
          default_bet_size: parseFloat(betSize),
          risk_tolerance: riskTolerance,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Your betting profile has been updated.",
      });
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your betting preferences and view your live CRM statistics.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {/* Live CRM Statistics Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Live CRM Statistics</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSyncProfile}
                disabled={syncing}
                className="h-8 px-2"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? 'animate-spin' : ''}`} />
                Sync
              </Button>
            </div>
            {profile && (
              <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Bets</p>
                  <p className="text-lg font-semibold">{profile.total_bets_placed || 0}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Win Rate</p>
                  <p className="text-lg font-semibold">
                    {profile.win_rate ? `${Number(profile.win_rate).toFixed(1)}%` : '0%'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Record</p>
                  <p className="text-lg font-semibold">
                    {profile.total_bets_won || 0}-{profile.total_bets_lost || 0}-{profile.total_bets_pushed || 0}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">ROI</p>
                  <p className={`text-lg font-semibold ${(profile.roi || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {profile.roi ? `${Number(profile.roi).toFixed(2)}%` : '0%'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Total Profit</p>
                  <p className={`text-lg font-semibold ${(profile.total_profit || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {profile.total_profit !== null
                      ? `${(profile.total_profit || 0) >= 0 ? '+' : ''}$${Number(profile.total_profit).toFixed(2)}`
                      : '$0.00'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Current Streak</p>
                  <p className={`text-lg font-semibold flex items-center ${(profile.current_streak || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {(profile.current_streak || 0) >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    {Math.abs(profile.current_streak || 0)} {(profile.current_streak || 0) >= 0 ? 'W' : 'L'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Avg Bet Size</p>
                  <p className="text-lg font-semibold">
                    ${profile.average_bet_size ? Number(profile.average_bet_size).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Pending Bets</p>
                  <p className="text-lg font-semibold">
                    {profile.pending_bet_count || 0} (${profile.pending_bet_amount ? Number(profile.pending_bet_amount).toFixed(2) : '0.00'})
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Largest Win</p>
                  <p className="text-lg font-semibold text-green-500">
                    ${profile.largest_win ? Number(profile.largest_win).toFixed(2) : '0.00'}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Largest Loss</p>
                  <p className="text-lg font-semibold text-red-500">
                    ${profile.largest_loss ? Number(profile.largest_loss).toFixed(2) : '0.00'}
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Last synced: {profile?.last_sync_at
                ? new Date(profile.last_sync_at).toLocaleString()
                : 'Never'}
            </p>
          </div>

          <Separator />
          <div className="space-y-2">
            <Label>Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bankroll">Bankroll ($)</Label>
            <Input
              id="bankroll"
              type="number"
              step="0.01"
              min="0"
              value={bankroll}
              onChange={(e) => setBankroll(e.target.value)}
              placeholder="1000.00"
            />
            <p className="text-xs text-muted-foreground">
              Total amount you're willing to bet with
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="betSize">Default Bet Size ($)</Label>
            <Input
              id="betSize"
              type="number"
              step="0.01"
              min="0"
              value={betSize}
              onChange={(e) => setBetSize(e.target.value)}
              placeholder="100.00"
            />
            <p className="text-xs text-muted-foreground">
              Your typical bet amount
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="riskTolerance">Risk Tolerance</Label>
            <Select value={riskTolerance} onValueChange={setRiskTolerance}>
              <SelectTrigger id="riskTolerance">
                <SelectValue placeholder="Select risk level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conservative">
                  Conservative - Play it safe
                </SelectItem>
                <SelectItem value="moderate">
                  Moderate - Balanced approach
                </SelectItem>
                <SelectItem value="aggressive">
                  Aggressive - High risk, high reward
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How much risk you're comfortable with
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
