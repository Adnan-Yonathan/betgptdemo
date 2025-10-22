import { Check, ChevronDown, Sparkles, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type BettingMode = "basic" | "advanced";

interface BettingModeSelectorProps {
  currentMode: BettingMode;
  onModeChange: (mode: BettingMode) => void;
}

export function BettingModeSelector({
  currentMode,
  onModeChange,
}: BettingModeSelectorProps) {
  const { user } = useAuth();

  const handleModeChange = async (mode: BettingMode) => {
    if (!user) return;

    try {
      // Use upsert to create profile if it doesn't exist, or update if it does
      // This handles cases where the profile wasn't created during signup
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            email: user.email,
            betting_mode: mode
          },
          {
            onConflict: 'id',
            ignoreDuplicates: false // Always update even if row exists
          }
        )
        .select();

      if (error) throw error;

      // Verify the upsert was successful
      if (!data || data.length === 0) {
        throw new Error("Failed to update profile. Please try again.");
      }

      // Update local state
      onModeChange(mode);

      toast.success(
        mode === "basic"
          ? "Switched to Basic mode - Simple and easy to understand"
          : "Switched to Advanced mode - Complex analysis with backtesting"
      );
    } catch (error) {
      console.error("Error updating betting mode:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to update mode. Please try again.";
      toast.error(errorMessage);
    }
  };

  const modes = [
    {
      id: "basic" as BettingMode,
      name: "Basic",
      description: "Simple analysis for casual bettors",
      icon: Sparkles,
    },
    {
      id: "advanced" as BettingMode,
      name: "Advanced",
      description: "Complex analysis with backtesting & +EV calculations",
      icon: Brain,
    },
  ];

  const currentModeData = modes.find((m) => m.id === currentMode);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-9 gap-2 px-3 text-sm font-medium hover:bg-accent"
        >
          {currentModeData && (
            <>
              <currentModeData.icon className="w-4 h-4" />
              <span>{currentModeData.name}</span>
            </>
          )}
          <ChevronDown className="w-4 h-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = currentMode === mode.id;

          return (
            <DropdownMenuItem
              key={mode.id}
              className="flex items-start gap-3 p-3 cursor-pointer"
              onClick={() => handleModeChange(mode.id)}
            >
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 mt-0.5">
                <Icon className="w-3 h-3 text-primary" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{mode.name}</p>
                  {isSelected && (
                    <Check className="w-4 h-4 text-primary" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {mode.description}
                </p>
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
