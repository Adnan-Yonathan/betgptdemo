import { useEffect, useState } from "react";
import { CheckCircle2, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface BetConfirmationProps {
  amount: number;
  description: string;
  odds: number;
  potentialReturn?: number;
  onClose?: () => void;
}

/**
 * Conversational bet confirmation component
 * Shows AI-style confirmation with micro-animations
 * Uses existing log-bet function via ChatMessage flow
 */
export const BetConfirmation = ({
  amount,
  description,
  odds,
  potentialReturn,
  onClose,
}: BetConfirmationProps) => {
  const [phase, setPhase] = useState<"syncing" | "logged">("syncing");

  useEffect(() => {
    // Simulate syncing phase with smooth transition
    const timer = setTimeout(() => {
      setPhase("logged");

      // Auto-dismiss after showing success
      if (onClose) {
        setTimeout(onClose, 2500);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/20",
        "rounded-lg p-4 mb-4 transition-all duration-500 ease-out",
        phase === "syncing" && "opacity-50 scale-95",
        phase === "logged" && "opacity-100 scale-100"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Animated Icon */}
        <div className="flex-shrink-0 mt-0.5">
          {phase === "syncing" ? (
            <div className="w-5 h-5 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-500 animate-in zoom-in duration-300" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground mb-1">
            {phase === "syncing" ? "Syncing..." : "✅ Logged and tracking!"}
          </p>

          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">${amount}</span> on{" "}
              <span className="font-medium">{description}</span>
            </p>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>Odds: {odds > 0 ? '+' : ''}{odds}</span>
              {potentialReturn && (
                <span className="flex items-center gap-1 text-green-500">
                  <TrendingUp className="w-3 h-3" />
                  Potential: ${potentialReturn.toFixed(2)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar animation */}
      {phase === "syncing" && (
        <div className="mt-3 h-1 bg-green-500/20 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full animate-pulse" style={{ width: "60%" }} />
        </div>
      )}
    </div>
  );
};
