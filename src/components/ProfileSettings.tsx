import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettings = ({ open, onOpenChange }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [bankroll, setBankroll] = useState("1000");
  const [betSize, setBetSize] = useState("100");
  const [riskTolerance, setRiskTolerance] = useState("moderate");

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
        setBankroll(data.bankroll?.toString() || "1000");
        setBetSize(data.default_bet_size?.toString() || "100");
        setRiskTolerance(data.risk_tolerance || "moderate");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          bankroll: parseFloat(bankroll),
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
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Betting Profile</DialogTitle>
          <DialogDescription>
            Configure your betting preferences to help BetGPT give you personalized advice.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
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
