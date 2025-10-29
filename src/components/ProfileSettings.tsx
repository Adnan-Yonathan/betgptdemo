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

  useEffect(() => {
    if (user && open) {
      loadProfile();
    }
  }, [user, open]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("risk_tolerance")
        .eq("id", user?.id)
        .single();

      if (error) throw error;

      if (data) {
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
      <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Betting Profile</DialogTitle>
          <DialogDescription className="text-sm">
            Configure your betting preferences.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 py-3 sm:py-4">
          <div className="space-y-2">
            <Label className="text-sm sm:text-base">Theme</Label>
            <div className="flex gap-2">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-10 sm:h-9"
                onClick={() => setTheme("light")}
              >
                <Sun className="h-4 w-4 mr-2" />
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                size="sm"
                className="flex-1 h-10 sm:h-9"
                onClick={() => setTheme("dark")}
              >
                <Moon className="h-4 w-4 mr-2" />
                Dark
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="riskTolerance" className="text-sm sm:text-base">Risk Tolerance</Label>
            <Select value={riskTolerance} onValueChange={setRiskTolerance}>
              <SelectTrigger id="riskTolerance" className="h-10 sm:h-9">
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

          <div className="flex justify-end gap-2 pt-3 sm:pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 sm:h-9 px-4">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading} className="h-10 sm:h-9 px-4">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
