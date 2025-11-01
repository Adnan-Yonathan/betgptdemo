import { PerformanceOverview } from "@/components/analytics/PerformanceOverview";
import { BankrollChart } from "@/components/analytics/BankrollChart";
import { PerformanceBreakdown } from "@/components/analytics/PerformanceBreakdown";
import { GoalTracker } from "@/components/analytics/GoalTracker";
import { WinLossAnalysis } from "@/components/analytics/WinLossAnalysis";
import { TrendAnalysis } from "@/components/analytics/TrendAnalysis";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Analytics = () => {
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
                <h1 className="text-3xl font-bold">Analytics</h1>
                <p className="text-muted-foreground">
                  Deep insights into your betting performance
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Performance Overview */}
          <PerformanceOverview />

          {/* Bankroll Chart */}
          <BankrollChart />

          {/* Trend Analysis */}
          <TrendAnalysis />

          {/* Win/Loss Analysis */}
          <WinLossAnalysis />

          {/* Performance Breakdown */}
          <PerformanceBreakdown />

          {/* Goal Tracker */}
          <GoalTracker />

          {/* Coming Soon Sections */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-6 border-2 border-dashed border-muted rounded-lg text-center">
              <h3 className="text-lg font-semibold mb-2">CLV Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Deep dive into your closing line value performance
              </p>
              <p className="text-xs text-muted-foreground mt-4">Coming soon...</p>
            </div>

            <div className="p-6 border-2 border-dashed border-muted rounded-lg text-center">
              <h3 className="text-lg font-semibold mb-2">Betting Calendar</h3>
              <p className="text-sm text-muted-foreground">
                Visualize your betting activity over time
              </p>
              <p className="text-xs text-muted-foreground mt-4">Coming soon...</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Analytics;
