import { useState, useEffect, useRef } from "react";
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
import { Moon, Sun, Upload } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface ProfileSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileSettings = ({ open, onOpenChange }: ProfileSettingsProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [bankroll, setBankroll] = useState("1000");
  const [betSize, setBetSize] = useState("100");
  const [riskTolerance, setRiskTolerance] = useState("moderate");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setAvatarUrl(data.avatar_url || null);
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !user) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Math.random()}.${fileExt}`;

    setUploading(true);
    try {
      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast({
        title: "Success!",
        description: "Profile picture updated.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
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
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure your betting preferences and appearance settings.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl || undefined} alt="Profile" />
                <AvatarFallback className="text-2xl">
                  {user?.email?.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {uploading ? "Uploading..." : "Upload Photo"}
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
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
