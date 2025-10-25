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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Moon, Sun } from "lucide-react";

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettings = ({ open, onOpenChange }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [riskTolerance, setRiskTolerance] = useState("moderate");
  const [bankroll, setBankroll] = useState("1000");

  useEffect(() => {
    if (user && open) {
      loadProfile();
    }
  }, [user, open]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("risk_tolerance, bankroll")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setRiskTolerance(data.risk_tolerance || "moderate");
        setBankroll(data.bankroll?.toString() || "1000");
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate bankroll
    const bankrollValue = parseFloat(bankroll);
    if (isNaN(bankrollValue) || bankrollValue <= 0) {
      toast({
        title: "Invalid Bankroll",
        description: "Please enter a valid bankroll amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          risk_tolerance: riskTolerance,
          bankroll: bankrollValue,
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
          <DialogTitle>Betting Profile</DialogTitle>
          <DialogDescription>
            Configure your betting preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="bankroll">Bankroll</Label>
            <Input
              id="bankroll"
              type="number"
              min="0"
              step="0.01"
              value={bankroll}
              onChange={(e) => setBankroll(e.target.value)}
              placeholder="Enter your bankroll"
            />
            <p className="text-xs text-muted-foreground">
              Your initial bankroll amount for betting calculations
            </p>
          </div>

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

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
