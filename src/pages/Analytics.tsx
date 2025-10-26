import { BankrollChart } from "@/components/BankrollChart";
import { PerformanceAnalytics } from "@/components/PerformanceAnalytics";
import { BankrollTransactions } from "@/components/BankrollTransactions";
import { ResponsibleGamblingSettings } from "@/components/ResponsibleGamblingSettings";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, DollarSign, Target, Shield } from "lucide-react";

/**
 * Analytics Page
 * Comprehensive dashboard for bankroll tracking, performance analytics,
 * and responsible gambling features
 * Implements PRD Sections 4.2-4.6
 */
const Analytics = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Bankroll & Analytics</h1>
          <p className="text-muted-foreground">
            Track your betting performance, manage your bankroll, and bet responsibly
          </p>
        </div>

        {/* Tabs for different sections */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="hidden sm:inline">Overview</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">Transactions</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Limits</span>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <BankrollChart />
            <PerformanceAnalytics />
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <BankrollTransactions />
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance">
            <PerformanceAnalytics />
          </TabsContent>

          {/* Responsible Gambling Settings Tab */}
          <TabsContent value="settings">
            <ResponsibleGamblingSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Analytics;
