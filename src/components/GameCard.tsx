import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { OddsComparison } from "./OddsComparison";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Wind,
  Thermometer
} from "lucide-react";
import { format } from "date-fns";

interface GameData {
  event_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  game_date: string;
  game_status: string;
  home_score?: number;
  away_score?: number;
  odds: any[];
  injuries?: any[];
  weather?: {
    temperature?: number;
    wind_speed?: number;
    precipitation_prob?: number;
  };
  ai_recommendation?: {
    pick: string;
    ev: number;
    edge: number; // Keep for backward compatibility
    win_probability?: number;
    odds?: number;
    reasoning: string[];
  };
  schedule_factors?: {
    home_rest_days: number;
    away_rest_days: number;
  };
}

interface GameCardProps {
  game: GameData;
}

export const GameCard = ({ game }: GameCardProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getEdgeBadge = (edge?: number) => {
    if (!edge) return null;

    if (edge >= 5) {
      return <Badge className="bg-green-600">Strong +EV ({edge.toFixed(1)}%)</Badge>;
    } else if (edge >= 2) {
      return <Badge className="bg-green-500">+EV ({edge.toFixed(1)}%)</Badge>;
    } else if (edge >= 0) {
      return <Badge variant="secondary">Slight Edge ({edge.toFixed(1)}%)</Badge>;
    } else {
      return <Badge variant="outline">No Edge</Badge>;
    }
  };

  const getEVBadge = (ev?: number) => {
    if (ev === undefined || ev === null) return null;

    if (ev >= 5) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+{ev.toFixed(1)}% EV</span>
        </div>
      );
    } else if (ev >= 2) {
      return (
        <div className="flex items-center gap-1 text-green-500">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+{ev.toFixed(1)}% EV</span>
        </div>
      );
    } else if (ev >= 0) {
      return (
        <div className="flex items-center gap-1 text-yellow-600">
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">+{ev.toFixed(1)}% EV</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-muted-foreground">
          <TrendingDown className="w-4 h-4" />
          <span className="text-sm font-medium">{ev.toFixed(1)}% EV</span>
        </div>
      );
    }
  };

  const getSportIcon = (league: string) => {
    const sportEmojis: Record<string, string> = {
      NFL: "🏈",
      NCAAF: "🏈",
      NHL: "🏒",
      NBA: "🏀",
      MLB: "⚾"
    };
    return sportEmojis[league] || "🎯";
  };

  const formatGameTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, "MMM d, h:mm a");
    } catch {
      return dateString;
    }
  };

  const getRestAdvantage = () => {
    if (!game.schedule_factors) return null;
    const { home_rest_days, away_rest_days } = game.schedule_factors;
    const diff = home_rest_days - away_rest_days;

    if (Math.abs(diff) <= 1) return null;

    if (diff > 0) {
      return (
        <Badge variant="outline" className="text-xs">
          {game.home_team} +{diff} rest days
        </Badge>
      );
    } else {
      return (
        <Badge variant="outline" className="text-xs">
          {game.away_team} +{Math.abs(diff)} rest days
        </Badge>
      );
    }
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl">{getSportIcon(game.league)}</span>
              <Badge variant="secondary">{game.league}</Badge>
              {game.ai_recommendation && getEdgeBadge(game.ai_recommendation.edge)}
            </div>
            <CardTitle className="text-xl">
              {game.away_team} @ {game.home_team}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Clock className="w-3 h-3" />
              {formatGameTime(game.game_date)}
            </CardDescription>
          </div>
          <div className="text-right">
            {game.ai_recommendation && getEVBadge(game.ai_recommendation.edge)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* AI Recommendation Summary */}
        {game.ai_recommendation && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">AI Recommended Bet</h4>
              {getEdgeBadge(game.ai_recommendation.edge)}
            </div>
            <p className="text-lg font-bold">{game.ai_recommendation.pick}</p>
            {game.ai_recommendation.reasoning && game.ai_recommendation.reasoning.length > 0 && (
              <div className="text-sm text-muted-foreground">
                <p className="font-medium mb-1">Key Factors:</p>
                <ul className="list-disc list-inside space-y-1">
                  {game.ai_recommendation.reasoning.slice(0, 3).map((reason, idx) => (
                    <li key={idx}>{reason}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Situational Factors */}
        <div className="flex flex-wrap gap-2">
          {game.injuries && game.injuries.length > 0 && (
            <Badge variant="destructive" className="text-xs">
              <AlertCircle className="w-3 h-3 mr-1" />
              {game.injuries.length} Injury{game.injuries.length > 1 ? 's' : ''}
            </Badge>
          )}

          {game.weather && (
            <>
              {game.weather.temperature !== undefined && (
                <Badge variant="outline" className="text-xs">
                  <Thermometer className="w-3 h-3 mr-1" />
                  {game.weather.temperature}°F
                </Badge>
              )}
              {game.weather.wind_speed !== undefined && game.weather.wind_speed > 10 && (
                <Badge variant="outline" className="text-xs">
                  <Wind className="w-3 h-3 mr-1" />
                  {game.weather.wind_speed} mph
                </Badge>
              )}
            </>
          )}

          {getRestAdvantage()}
        </div>

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between">
              <span>View Odds & Details</span>
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            {/* Odds Comparison */}
            <OddsComparison
              odds={game.odds}
              homeTeam={game.home_team}
              awayTeam={game.away_team}
            />

            {/* Injuries Detail */}
            {game.injuries && game.injuries.length > 0 && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  Injury Report
                </h4>
                <div className="space-y-2">
                  {game.injuries.map((injury, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="font-medium">{injury.name}</span>
                      <span className="text-muted-foreground">
                        {injury.position} - {injury.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Full AI Analysis */}
            {game.ai_recommendation && game.ai_recommendation.reasoning && (
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-sm mb-3">Complete AI Analysis</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {game.ai_recommendation.reasoning.map((reason, idx) => (
                    <li key={idx} className="flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
};
