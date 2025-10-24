import { GameInsights } from "@/components/GameInsights";
import { ProfileDropdown } from "@/components/ProfileDropdown";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { ProfileSettings } from "@/components/ProfileSettings";

/**
 * Game Insights Demo Page
 * Shows enhanced game analysis with advanced metrics
 * In production, this would receive real game data via props or route params
 */
const GameInsightsDemo = () => {
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
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
            and line movement visualization.
          </p>
        </div>

        {/* Demo Insights - Multiple Games */}
        <div className="space-y-6">
          <GameInsights
            homeTeam="Lakers"
            awayTeam="Warriors"
            valuePercent={5.2}
            sharpMoneyPercent={72}
            lineMovement={{ opening: -5.5, current: -3.5, direction: "up" }}
            dataConfidence={92}
            injuries={["Warriors: Draymond Green - Questionable", "Lakers: Rui Hachimura - Probable"]}
            weather="Indoor Arena"
            publicBettingPercent={58}
          />

          <GameInsights
            homeTeam="Bills"
            awayTeam="Chiefs"
            valuePercent={2.8}
            sharpMoneyPercent={65}
            lineMovement={{ opening: -3, current: -2.5, direction: "down" }}
            dataConfidence={85}
            injuries={["Chiefs: Travis Kelce - Probable", "Bills: No significant injuries"]}
            weather="Light snow, 28°F, Wind 12 MPH"
            publicBettingPercent={71}
          />

          <GameInsights
            homeTeam="Yankees"
            awayTeam="Red Sox"
            valuePercent={-1.2}
            sharpMoneyPercent={45}
            lineMovement={{ opening: -145, current: -145, direction: "stable" }}
            dataConfidence={78}
            injuries={["Red Sox: Starting RF - Out", "Yankees: Bullpen arm - Day-to-day"]}
            weather="Clear, 75°F, Wind 8 MPH out to RF"
            publicBettingPercent={55}
          />
        </div>

        {/* Info Footer */}
        <div className="mt-8 p-4 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Note:</strong> These are demo insights. In production, data would be pulled from
            your existing <code className="text-xs bg-muted px-1 py-0.5 rounded">game.stats</code> and{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">odds.movement</code> endpoints.
          </p>
        </div>
      </main>

      <ProfileSettings open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
};

export default GameInsightsDemo;
