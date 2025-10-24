import { useState } from "react";
import { TrendingUp, TrendingDown, Activity, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GameInsightsProps {
  homeTeam: string;
  awayTeam: string;
  // Uses existing game.stats or odds.movement data
  valuePercent?: number;
  sharpMoneyPercent?: number;
  lineMovement?: {
    opening: number;
    current: number;
    direction: "up" | "down" | "stable";
  };
  dataConfidence?: number;
  injuries?: string[];
  weather?: string;
  publicBettingPercent?: number;
}

/**
 * Game Insights Component
 * Enhanced game detail view with advanced metrics
 * Uses existing game.stats or odds.movement data from backend
 * Displays value %, sharp money %, line movement, and data confidence
 */
export const GameInsights = ({
  homeTeam,
  awayTeam,
  valuePercent = 3.5,
  sharpMoneyPercent = 68,
  lineMovement = { opening: -5.5, current: -3.5, direction: "up" },
  dataConfidence = 87,
  injuries = ["Key PG - Questionable", "Starting C - Out"],
  weather = "Clear, 72°F",
  publicBettingPercent = 62,
}: GameInsightsProps) => {
  const [expanded, setExpanded] = useState(false);

  const getValueColor = (value: number) => {
    if (value >= 5) return "text-green-500";
    if (value >= 2) return "text-emerald-500";
    if (value >= 0) return "text-yellow-500";
    return "text-red-500";
  };

  const getSharpColor = (sharp: number) => {
    if (sharp >= 70) return "text-green-500";
    if (sharp >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return "bg-green-500";
    if (confidence >= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {awayTeam} @ {homeTeam}
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Live Insights
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3">
          {/* Value % */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Value %</span>
              <TrendingUp className={cn("w-4 h-4", getValueColor(valuePercent))} />
            </div>
            <p className={cn("text-2xl font-bold", getValueColor(valuePercent))}>
              {valuePercent > 0 ? "+" : ""}
              {valuePercent.toFixed(1)}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">Expected edge</p>
          </div>

          {/* Sharp Money % */}
          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">Sharp $</span>
              <Activity className={cn("w-4 h-4", getSharpColor(sharpMoneyPercent))} />
            </div>
            <p className={cn("text-2xl font-bold", getSharpColor(sharpMoneyPercent))}>
              {sharpMoneyPercent}%
            </p>
            <p className="text-xs text-muted-foreground mt-1">On {homeTeam}</p>
          </div>
        </div>

        {/* Line Movement */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Line Movement</span>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">
                {lineMovement.opening > 0 ? "+" : ""}
                {lineMovement.opening}
              </span>
              {lineMovement.direction === "up" ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : lineMovement.direction === "down" ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : null}
              <span className="font-semibold text-foreground">
                {lineMovement.current > 0 ? "+" : ""}
                {lineMovement.current}
              </span>
            </div>
          </div>

          {/* Visual Line Movement Bar */}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "absolute h-full rounded-full transition-all duration-500",
                lineMovement.direction === "up" && "bg-gradient-to-r from-yellow-500 to-green-500",
                lineMovement.direction === "down" && "bg-gradient-to-r from-yellow-500 to-red-500",
                lineMovement.direction === "stable" && "bg-blue-500"
              )}
              style={{
                width: `${Math.abs(((lineMovement.current - lineMovement.opening) / 10) * 100)}%`,
                left: lineMovement.direction === "up" ? "50%" : "auto",
                right: lineMovement.direction === "down" ? "50%" : "auto",
              }}
            />
            <div className="absolute left-1/2 top-0 w-0.5 h-full bg-border -translate-x-1/2" />
          </div>

          <p className="text-xs text-muted-foreground">
            {Math.abs(lineMovement.current - lineMovement.opening).toFixed(1)} point{" "}
            {lineMovement.direction === "up" ? "rise" : "drop"} from open
          </p>
        </div>

        {/* Data Confidence */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Data Confidence</span>
            <span className="text-sm font-semibold">{dataConfidence}%</span>
          </div>
          <Progress value={dataConfidence} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {dataConfidence >= 80
              ? "High confidence - all data sources available"
              : dataConfidence >= 60
              ? "Moderate confidence - some data pending"
              : "Low confidence - limited data"}
          </p>
        </div>

        {/* Public vs Sharp */}
        <div className="bg-muted/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">Public Betting</span>
            <span className="text-xs font-semibold">{publicBettingPercent}% on {homeTeam}</span>
          </div>
          {Math.abs(publicBettingPercent - sharpMoneyPercent) > 15 && (
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <p>Sharp money diverging from public ({Math.abs(publicBettingPercent - sharpMoneyPercent)}% difference)</p>
            </div>
          )}
        </div>

        {/* Expandable More Insights Section */}
        <div className="border-t border-border pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full justify-between text-sm"
          >
            <span className="font-medium">More Insights</span>
            {expanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>

          {expanded && (
            <div className="mt-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
              {/* Injuries */}
              {injuries && injuries.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Injury Report</p>
                  {injuries.map((injury, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span>{injury}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Weather */}
              {weather && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Conditions</p>
                  <p className="text-sm">{weather}</p>
                </div>
              )}

              {/* Historical Trends */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Recent Form</p>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{homeTeam}:</span>
                  <div className="flex gap-1">
                    {["W", "W", "L", "W", "L"].map((result, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-6 h-6 rounded flex items-center justify-center text-xs font-semibold",
                          result === "W"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                        )}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">{awayTeam}:</span>
                  <div className="flex gap-1">
                    {["W", "L", "W", "W", "W"].map((result, i) => (
                      <div
                        key={i}
                        className={cn(
                          "w-6 h-6 rounded flex items-center justify-center text-xs font-semibold",
                          result === "W"
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                        )}
                      >
                        {result}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
