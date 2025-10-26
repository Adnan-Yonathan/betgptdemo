import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, Layers } from "lucide-react";

interface ParlayLeg {
  id: string;
  bet_id: string;
  event_id: string;
  selection: string;
  odds: number;
  result: string | null; // 'pending', 'won', 'lost'
}

interface ParlayDisplayProps {
  betId: string;
  outcome: string;
}

/**
 * Parlay Display Component
 * Shows individual legs of a parlay bet
 * Implements PRD requirements for parlay support
 */
export const ParlayDisplay = ({ betId, outcome }: ParlayDisplayProps) => {
  const [legs, setLegs] = useState<ParlayLeg[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadParlayLegs();
  }, [betId]);

  const loadParlayLegs = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("parlay_legs")
        .select("*")
        .eq("bet_id", betId)
        .order("id", { ascending: true });

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      setLegs(data || []);
    } catch (error) {
      console.error("Error loading parlay legs:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Layers className="w-4 h-4" />
        <span>Loading parlay legs...</span>
      </div>
    );
  }

  if (legs.length === 0) {
    return null; // Not a parlay bet
  }

  const getLegIcon = (result: string | null, outcome: string) => {
    if (outcome === "pending" || result === "pending" || result === null) {
      return <Clock className="w-4 h-4 text-yellow-500" />;
    }
    if (result === "won") {
      return <CheckCircle2 className="w-4 h-4 text-green-500" />;
    }
    if (result === "lost") {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Clock className="w-4 h-4 text-muted-foreground" />;
  };

  const getLegStatus = (result: string | null, outcome: string) => {
    if (outcome === "pending" || result === "pending" || result === null) {
      return "pending";
    }
    if (result === "won") {
      return "won";
    }
    if (result === "lost") {
      return "lost";
    }
    return "pending";
  };

  const wonLegs = legs.filter((leg) => leg.result === "won").length;
  const lostLegs = legs.filter((leg) => leg.result === "lost").length;

  return (
    <Card className="border-purple-500/20 bg-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-500" />
            <CardTitle className="text-sm">Parlay ({legs.length} Legs)</CardTitle>
          </div>
          {outcome !== "pending" && (
            <Badge
              variant="outline"
              className={
                outcome === "win"
                  ? "bg-green-500/10 text-green-600 border-green-500/20"
                  : outcome === "loss"
                  ? "bg-red-500/10 text-red-600 border-red-500/20"
                  : "bg-muted text-muted-foreground"
              }
            >
              {wonLegs}/{legs.length} Won
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {legs.map((leg, index) => {
          const status = getLegStatus(leg.result, outcome);
          return (
            <div
              key={leg.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                status === "won"
                  ? "border-green-500/20 bg-green-500/5"
                  : status === "lost"
                  ? "border-red-500/20 bg-red-500/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="flex items-center gap-2 min-w-[24px]">
                {getLegIcon(leg.result, outcome)}
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{leg.selection}</p>
                  <span className="text-xs font-mono whitespace-nowrap">
                    {leg.odds > 0 ? "+" : ""}
                    {leg.odds}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      status === "won"
                        ? "bg-green-500/10 text-green-600"
                        : status === "lost"
                        ? "bg-red-500/10 text-red-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    Leg {index + 1}
                  </Badge>
                  {status !== "pending" && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${
                        status === "won"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {status === "won" ? "Won" : "Lost"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Parlay Rules Info */}
        {outcome === "pending" && (
          <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
            All legs must win for the parlay to pay out. If any leg loses, the entire parlay loses.
          </div>
        )}
      </CardContent>
    </Card>
  );
};
