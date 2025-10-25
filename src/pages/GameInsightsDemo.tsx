import { GameInsights } from "@/components/GameInsights";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { ProfileSettings } from "@/components/ProfileSettings";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { LiveScoresTerminal } from "@/components/LiveScoresTerminal";

interface GameData {
  eventId: string;
  homeTeam: string;
  awayTeam: string;
  valuePercent: number;
  sharpMoneyPercent: number;
  lineMovement: {
    opening: number;
    current: number;
    direction: "up" | "down" | "stable";
  };
  dataConfidence: number;
  injuries: string[];
  weather: string;
  publicBettingPercent: number;
}

/**
 * Game Insights Demo Page
 * Shows enhanced game analysis with advanced metrics
 * Now uses real data from AI predictions and sharp money detection
 */
const GameInsightsDemo = () => {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [games, setGames] = useState<GameData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGameInsights();
  }, []);

  const loadGameInsights = async () => {
    try {
      setLoading(true);

      // Check cache first (24-hour cache)
      const cacheKey = "game-insights-cache";
      const cacheTimestampKey = "game-insights-timestamp";
      const cached = localStorage.getItem(cacheKey);
      const cacheTimestamp = localStorage.getItem(cacheTimestampKey);

      const now = Date.now();
      const cacheAge = cacheTimestamp ? now - parseInt(cacheTimestamp) : Infinity;
      const cacheValidDuration = 24 * 60 * 60 * 1000; // 24 hours

      if (cached && cacheAge < cacheValidDuration) {
        console.log("Using cached game insights");
        setGames(JSON.parse(cached));
        setLoading(false);
        return;
      }

      // Fetch predictions with sharp money data
      console.log("Fetching fresh game insights from database");
      const { data: predictions, error: predError } = await supabase
        .from("model_predictions")
        .select(`
          *,
          prediction_models!inner(
            model_name,
            is_active
          )
        `)
        .eq("prediction_models.is_active", true)
        .eq("game_started", false)
        .gte("game_date", new Date().toISOString())
        .order("confidence_score", { ascending: false })
        .limit(5);

      if (predError) {
        console.error("Error fetching predictions:", predError);
        throw predError;
      }

      // Fetch sharp money signals for these games
      const eventIds = predictions?.map(p => p.event_id) || [];
      const { data: sharpSignals } = await supabase
        .from("sharp_money_signals")
        .select("*")
        .in("event_id", eventIds);

      // Fetch line movement data
      const { data: lineHistory } = await supabase
        .from("line_movement_history")
        .select("*")
        .in("event_id", eventIds)
        .order("recorded_at", { ascending: true });

      // Transform data to GameData format
      const gameData: GameData[] = (predictions || []).map((pred) => {
        const sharp = sharpSignals?.find(s => s.event_id === pred.event_id);
        const lines = lineHistory?.filter(l => l.event_id === pred.event_id) || [];
        const openingLine = lines[0]?.spread || 0;
        const currentLine = lines[lines.length - 1]?.spread || openingLine;

        let direction: "up" | "down" | "stable" = "stable";
        if (currentLine > openingLine + 0.5) direction = "up";
        else if (currentLine < openingLine - 0.5) direction = "down";

        // Extract injuries from feature values
        const features = pred.feature_values as Record<string, any> || {};
        const injuries: string[] = features.injuries || [];

        return {
          eventId: pred.event_id,
          homeTeam: pred.home_team,
          awayTeam: pred.away_team,
          valuePercent: pred.edge_percentage || 0,
          sharpMoneyPercent: sharp?.sharp_percentage || 50,
          lineMovement: {
            opening: openingLine,
            current: currentLine,
            direction,
          },
          dataConfidence: pred.confidence_score || 75,
          injuries,
          weather: features.weather || "N/A",
          publicBettingPercent: sharp?.public_percentage || 50,
        };
      });

      setGames(gameData);

      // Cache the results
      localStorage.setItem(cacheKey, JSON.stringify(gameData));
      localStorage.setItem(cacheTimestampKey, now.toString());

      console.log(`Loaded ${gameData.length} game insights`);
    } catch (error) {
      console.error("Error loading game insights:", error);
      setGames([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Live Scores Terminal */}
      <LiveScoresTerminal />

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/")}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-6 h-6 text-primary" />
                <h1 className="text-xl font-bold">Game Analysis</h1>
              </div>
            </div>
            <ProfileDropdown onOpenProfile={() => setProfileOpen(true)} />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Deep dive into game metrics with value analysis, sharp money tracking,
            and line movement visualization. Data updates daily.
          </p>
        </div>

        {/* Game Insights */}
        {loading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-3/4 mb-4" />
                  <Skeleton className="h-20 w-full mb-4" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                No game insights available at the moment. Check back later for updated predictions.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {games.map((game) => (
              <GameInsights
                key={game.eventId}
                homeTeam={game.homeTeam}
                awayTeam={game.awayTeam}
                valuePercent={game.valuePercent}
                sharpMoneyPercent={game.sharpMoneyPercent}
                lineMovement={game.lineMovement}
                dataConfidence={game.dataConfidence}
                injuries={game.injuries}
                weather={game.weather}
                publicBettingPercent={game.publicBettingPercent}
              />
            ))}
          </div>
        )}

        {/* Info Footer */}
        {!loading && games.length > 0 && (
          <div className="mt-8 p-4 bg-muted/30 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Note:</strong> Insights are powered by AI prediction models and updated daily.
              Data includes value analysis, sharp money signals, and line movement tracking.
            </p>
          </div>
        )}
      </main>

      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default GameInsightsDemo;
