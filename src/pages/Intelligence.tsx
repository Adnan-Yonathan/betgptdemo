import { AIStrategyAdvisor } from "@/components/intelligence/AIStrategyAdvisor";
import { PatternInsights } from "@/components/intelligence/PatternInsights";
import { SmartAlerts } from "@/components/intelligence/SmartAlerts";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Intelligence = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold">AI Intelligence</h1>
                <p className="text-muted-foreground">
                  Advanced insights and recommendations powered by AI
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Smart Alerts - Priority section at top */}
          <SmartAlerts />

          {/* AI Strategy Advisor */}
          <AIStrategyAdvisor />

          {/* Pattern Insights */}
          <PatternInsights />

          {/* Placeholder for Bet Simulator */}
          <div className="p-6 border-2 border-dashed border-muted rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2">Bet Simulator</h3>
            <p className="text-sm text-muted-foreground">
              Test betting strategies without risking real money
            </p>
            <p className="text-xs text-muted-foreground mt-4">Coming soon...</p>
          </div>

          {/* Placeholder for Predictive Analytics */}
          <div className="p-6 border-2 border-dashed border-muted rounded-lg text-center">
            <h3 className="text-lg font-semibold mb-2">Predictive Analytics</h3>
            <p className="text-sm text-muted-foreground">
              Forecast your future performance and identify trends
            </p>
            <p className="text-xs text-muted-foreground mt-4">Coming soon...</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Intelligence;
