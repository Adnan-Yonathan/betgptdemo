import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { TrendingUp, Sparkles, Eye, Share2, ThumbsDown, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

interface AISuggestion {
  id: string;
  team: string;
  opponent: string;
  line: string;
  confidence: number;
  ev: number;
  reasoning: string;
  sport: string;
  gameTime: string;
}

/**
 * Personalized Feed Component
 * Shows AI-suggested bets with confidence scores and reasoning
 * Connects to existing recommendation/prediction logic
 * When getAIInsights() is available, it will call it here
 * Currently uses mock data as placeholder
 */
export const PersonalizedFeed = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user) {
      loadSuggestions();
    }
  }, [user]);

  const loadSuggestions = async () => {
    try {
      setLoading(true);

      // TODO: Replace with actual API call when getAIInsights() is available
      // const { data, error } = await supabase.functions.invoke('get-ai-insights');

      // Mock data for now - simulates AI-generated picks
      const mockSuggestions: AISuggestion[] = [
        {
          id: "1",
          team: "Lakers",
          opponent: "vs Warriors",
          line: "-3.5",
          confidence: 78,
          ev: 5.2,
          reasoning: "Strong home court advantage, 3-0 ATS in last 3. Warriors missing key defender.",
          sport: "NBA",
          gameTime: "Tonight 7:00 PM",
        },
        {
          id: "2",
          team: "Chiefs",
          opponent: "@ Bills",
          line: "+2.5",
          confidence: 72,
          ev: 3.8,
          reasoning: "Mahomes excels as underdog. Bills defense allowing 28 PPG in last 4.",
          sport: "NFL",
          gameTime: "Sunday 1:00 PM",
        },
        {
          id: "3",
          team: "Red Sox",
          opponent: "vs Yankees",
          line: "Over 9.5",
          confidence: 65,
          ev: 2.1,
          reasoning: "Both bullpens depleted. Wind blowing out at 15 MPH. History of high scoring.",
          sport: "MLB",
          gameTime: "Today 4:10 PM",
        },
      ];

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 800));

      setSuggestions(mockSuggestions);
    } catch (error) {
      console.error("Error loading suggestions:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTrack = (suggestion: AISuggestion) => {
    // This will integrate with existing bet tracking
    toast({
      title: "Added to tracking",
      description: `Now tracking ${suggestion.team} ${suggestion.line}`,
    });
  };

  const handleIgnore = (id: string) => {
    setIgnoredIds((prev) => new Set([...prev, id]));
    toast({
      description: "Suggestion removed from feed",
    });
  };

  const handleShare = (suggestion: AISuggestion) => {
    // Copy to clipboard
    const shareText = `BetGPT Pick: ${suggestion.team} ${suggestion.line} (${suggestion.confidence}% confidence, +${suggestion.ev}% EV)`;
    navigator.clipboard.writeText(shareText);
    toast({
      title: "Copied to clipboard",
      description: "Share this pick with others",
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 75) return "text-green-500 bg-green-500/10 border-green-500/20";
    if (confidence >= 65) return "text-yellow-500 bg-yellow-500/10 border-yellow-500/20";
    return "text-orange-500 bg-orange-500/10 border-orange-500/20";
  };

  const getEVColor = (ev: number) => {
    if (ev >= 5) return "text-green-600 dark:text-green-400";
    if (ev >= 3) return "text-emerald-600 dark:text-emerald-400";
    return "text-blue-600 dark:text-blue-400";
  };

  const visibleSuggestions = suggestions.filter((s) => !ignoredIds.has(s.id));

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          <h3 className="text-lg font-semibold">AI Picks for You</h3>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadSuggestions}
          className="text-xs"
        >
          Refresh
        </Button>
      </div>

      {/* Suggestions */}
      {visibleSuggestions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Sparkles className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              No AI picks available right now. Check back soon!
            </p>
          </CardContent>
        </Card>
      ) : (
        visibleSuggestions.map((suggestion) => (
          <Card
            key={suggestion.id}
            className="transition-all hover:shadow-md border-border"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-xs font-normal">
                      {suggestion.sport}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {suggestion.gameTime}
                    </span>
                  </div>
                  <CardTitle className="text-xl">
                    {suggestion.team} {suggestion.line}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {suggestion.opponent}
                  </p>
                </div>

                {/* Confidence Badge */}
                <div
                  className={cn(
                    "px-3 py-1.5 rounded-lg border font-semibold text-sm",
                    getConfidenceColor(suggestion.confidence)
                  )}
                >
                  {suggestion.confidence}%
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* EV & Reasoning */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className={cn("w-4 h-4", getEVColor(suggestion.ev))} />
                  <span className={cn("text-sm font-semibold", getEVColor(suggestion.ev))}>
                    +{suggestion.ev}% Expected Value
                  </span>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          Expected Value (EV) shows the theoretical profit % per bet over time.
                          Positive EV bets are mathematically profitable long-term.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm text-foreground/90 leading-relaxed">
                    <span className="font-medium text-primary">Why this pick: </span>
                    {suggestion.reasoning}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => handleTrack(suggestion)}
                >
                  <Eye className="w-4 h-4 mr-1.5" />
                  Track
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleIgnore(suggestion.id)}
                >
                  <ThumbsDown className="w-4 h-4 mr-1.5" />
                  Ignore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleShare(suggestion)}
                >
                  <Share2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Footer Note */}
      <p className="text-xs text-center text-muted-foreground">
        AI suggestions are based on statistical models and should not be considered financial advice.
      </p>
    </div>
  );
};
