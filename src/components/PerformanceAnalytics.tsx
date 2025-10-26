import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown, Target, Award, Brain, User } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Bet {
  id: string;
  amount: number;
  odds: number;
  outcome: string;
  actual_return: number | null;
  sport: string | null;
  bet_type: string | null;
  confidence_score: number | null;
}

interface SportStats {
  sport: string;
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;
  profit: number;
  roi: number;
}

interface BetTypeStats {
  type: string;
  wins: number;
  losses: number;
  winRate: number;
  profit: number;
}

interface AIStats {
  totalBets: number;
  wins: number;
  winRate: number;
  profit: number;
  roi: number;
}

/**
 * Performance Analytics Component
 * Displays detailed betting performance breakdowns
 * Implements PRD Section 4.5: Performance Analytics
 */
export const PerformanceAnalytics = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bets, setBets] = useState<Bet[]>([]);

  const [sportStats, setSportStats] = useState<SportStats[]>([]);
  const [betTypeStats, setBetTypeStats] = useState<BetTypeStats[]>([]);
  const [aiStats, setAIStats] = useState<AIStats>({ totalBets: 0, wins: 0, winRate: 0, profit: 0, roi: 0 });
  const [userStats, setUserStats] = useState<AIStats>({ totalBets: 0, wins: 0, winRate: 0, profit: 0, roi: 0 });

  useEffect(() => {
    if (user) {
      loadBets();
    }
  }, [user]);

  useEffect(() => {
    if (bets.length > 0) {
      calculateStats();
    }
  }, [bets]);

  const loadBets = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("bets")
        .select("id, amount, odds, outcome, actual_return, sport, bet_type, confidence_score")
        .eq("user_id", user.id)
        .in("outcome", ["win", "loss", "push"]);

      if (error) throw error;

      setBets(data || []);
    } catch (error) {
      console.error("Error loading bets:", error);
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = () => {
    // Group by sport
    const sportMap: { [key: string]: Bet[] } = {};
    bets.forEach((bet) => {
      const sport = bet.sport || "Other";
      if (!sportMap[sport]) {
        sportMap[sport] = [];
      }
      sportMap[sport].push(bet);
    });

    const sportStatsArray: SportStats[] = Object.entries(sportMap).map(([sport, sportBets]) => {
      const wins = sportBets.filter((b) => b.outcome === "win").length;
      const losses = sportBets.filter((b) => b.outcome === "loss").length;
      const pushes = sportBets.filter((b) => b.outcome === "push").length;
      const totalWagered = sportBets.reduce((sum, b) => sum + b.amount, 0);
      const totalReturned = sportBets
        .filter((b) => b.outcome === "win")
        .reduce((sum, b) => sum + (b.actual_return || 0), 0);
      const profit = totalReturned - sportBets.filter((b) => b.outcome === "loss").reduce((sum, b) => sum + b.amount, 0);

      return {
        sport,
        wins,
        losses,
        pushes,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        profit,
        roi: totalWagered > 0 ? (profit / totalWagered) * 100 : 0,
      };
    });

    setSportStats(sportStatsArray.sort((a, b) => b.profit - a.profit));

    // Group by bet type
    const typeMap: { [key: string]: Bet[] } = {};
    bets.forEach((bet) => {
      const type = bet.bet_type || "Unknown";
      if (!typeMap[type]) {
        typeMap[type] = [];
      }
      typeMap[type].push(bet);
    });

    const betTypeStatsArray: BetTypeStats[] = Object.entries(typeMap).map(([type, typeBets]) => {
      const wins = typeBets.filter((b) => b.outcome === "win").length;
      const losses = typeBets.filter((b) => b.outcome === "loss").length;
      const totalWagered = typeBets.reduce((sum, b) => sum + b.amount, 0);
      const totalReturned = typeBets
        .filter((b) => b.outcome === "win")
        .reduce((sum, b) => sum + (b.actual_return || 0), 0);
      const profit = totalReturned - typeBets.filter((b) => b.outcome === "loss").reduce((sum, b) => sum + b.amount, 0);

      return {
        type: type.charAt(0).toUpperCase() + type.slice(1),
        wins,
        losses,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        profit,
      };
    });

    setBetTypeStats(betTypeStatsArray.sort((a, b) => b.winRate - a.winRate));

    // AI vs User bets (AI bets have confidence_score)
    const aiBets = bets.filter((b) => b.confidence_score !== null && b.confidence_score !== undefined);
    const userBets = bets.filter((b) => b.confidence_score === null || b.confidence_score === undefined);

    const calculateAIUserStats = (betSet: Bet[]): AIStats => {
      const wins = betSet.filter((b) => b.outcome === "win").length;
      const losses = betSet.filter((b) => b.outcome === "loss").length;
      const totalWagered = betSet.reduce((sum, b) => sum + b.amount, 0);
      const totalReturned = betSet
        .filter((b) => b.outcome === "win")
        .reduce((sum, b) => sum + (b.actual_return || 0), 0);
      const profit = totalReturned - betSet.filter((b) => b.outcome === "loss").reduce((sum, b) => sum + b.amount, 0);

      return {
        totalBets: betSet.length,
        wins,
        winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
        profit,
        roi: totalWagered > 0 ? (profit / totalWagered) * 100 : 0,
      };
    };

    setAIStats(calculateAIUserStats(aiBets));
    setUserStats(calculateAIUserStats(userBets));
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (bets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center p-12 text-center">
          <Award className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No settled bets yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start placing bets to see your performance analytics
          </p>
        </CardContent>
      </Card>
    );
  }

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Target className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-2xl font-bold">Performance Analytics</h2>
          <p className="text-sm text-muted-foreground">
            Detailed breakdown of your betting performance
          </p>
        </div>
      </div>

      <Tabs defaultValue="sport" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="sport">By Sport</TabsTrigger>
          <TabsTrigger value="type">By Bet Type</TabsTrigger>
          <TabsTrigger value="ai">AI vs My Picks</TabsTrigger>
        </TabsList>

        {/* By Sport */}
        <TabsContent value="sport" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Sport</CardTitle>
              <CardDescription>
                Win rate and profitability across different sports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sportStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No sport data available
                </div>
              ) : (
                <>
                  {/* Bar Chart */}
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={sportStats}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="sport" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                        }}
                      />
                      <Legend />
                      <Bar dataKey="profit" fill="#3b82f6" name="Profit ($)" />
                      <Bar dataKey="winRate" fill="#10b981" name="Win Rate (%)" />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Detailed Stats Table */}
                  <div className="mt-6 space-y-3">
                    {sportStats.map((stat, index) => (
                      <div
                        key={stat.sport}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-semibold">{stat.sport}</p>
                            <p className="text-sm text-muted-foreground">
                              {stat.wins}-{stat.losses}
                              {stat.pushes > 0 && `-${stat.pushes}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Win Rate</p>
                            <p className="font-semibold">{stat.winRate.toFixed(1)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Profit</p>
                            <p className={`font-semibold ${stat.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {stat.profit >= 0 ? "+" : ""}${stat.profit.toFixed(2)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">ROI</p>
                            <p className={`font-semibold ${stat.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {stat.roi >= 0 ? "+" : ""}{stat.roi.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Bet Type */}
        <TabsContent value="type" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Bet Type</CardTitle>
              <CardDescription>
                Success rate across different bet types
              </CardDescription>
            </CardHeader>
            <CardContent>
              {betTypeStats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No bet type data available
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Win Rate Pie Chart */}
                    <div>
                      <h3 className="text-sm font-medium mb-4 text-center">Win Rate Distribution</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                          <Pie
                            data={betTypeStats}
                            dataKey="winRate"
                            nameKey="type"
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            label={({ type, winRate }) => `${type}: ${winRate.toFixed(0)}%`}
                            labelLine={false}
                          >
                            {betTypeStats.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: any) => `${Number(value).toFixed(1)}%`}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Profit Bar Chart */}
                    <div>
                      <h3 className="text-sm font-medium mb-4 text-center">Profit by Type</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={betTypeStats} layout="horizontal">
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="type" type="category" tick={{ fontSize: 12 }} width={80} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                            formatter={(value: any) => `$${Number(value).toFixed(2)}`}
                          />
                          <Bar dataKey="profit" fill="#3b82f6" name="Profit" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Detailed Stats */}
                  <div className="mt-6 space-y-3">
                    {betTypeStats.map((stat, index) => (
                      <div
                        key={stat.type}
                        className="flex items-center justify-between p-4 rounded-lg border bg-card"
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <div>
                            <p className="font-semibold">{stat.type}</p>
                            <p className="text-sm text-muted-foreground">
                              {stat.wins}-{stat.losses}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Win Rate</p>
                            <p className="font-semibold">{stat.winRate.toFixed(1)}%</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Profit</p>
                            <p className={`font-semibold ${stat.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                              {stat.profit >= 0 ? "+" : ""}${stat.profit.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI vs User Picks */}
        <TabsContent value="ai" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* AI Picks Card */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  <CardTitle>AI Recommendations</CardTitle>
                </div>
                <CardDescription>
                  Bets based on AI predictions
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bets</p>
                    <p className="text-2xl font-bold">{aiStats.totalBets}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wins</p>
                    <p className="text-2xl font-bold text-green-500">{aiStats.wins}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold">{aiStats.winRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ROI</p>
                    <p className={`text-2xl font-bold ${aiStats.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {aiStats.roi >= 0 ? "+" : ""}{aiStats.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Total Profit</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-3xl font-bold ${aiStats.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {aiStats.profit >= 0 ? "+" : ""}${aiStats.profit.toFixed(2)}
                    </p>
                    {aiStats.profit >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Picks Card */}
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-500" />
                  <CardTitle>My Own Picks</CardTitle>
                </div>
                <CardDescription>
                  Bets you made independently
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bets</p>
                    <p className="text-2xl font-bold">{userStats.totalBets}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Wins</p>
                    <p className="text-2xl font-bold text-green-500">{userStats.wins}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Win Rate</p>
                    <p className="text-2xl font-bold">{userStats.winRate.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">ROI</p>
                    <p className={`text-2xl font-bold ${userStats.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {userStats.roi >= 0 ? "+" : ""}{userStats.roi.toFixed(1)}%
                    </p>
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground">Total Profit</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className={`text-3xl font-bold ${userStats.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {userStats.profit >= 0 ? "+" : ""}${userStats.profit.toFixed(2)}
                    </p>
                    {userStats.profit >= 0 ? (
                      <TrendingUp className="w-6 h-6 text-green-500" />
                    ) : (
                      <TrendingDown className="w-6 h-6 text-red-500" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Comparison Summary */}
          {aiStats.totalBets > 0 && userStats.totalBets > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Comparison</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">Win Rate Difference</span>
                    <span className={`font-semibold ${aiStats.winRate - userStats.winRate >= 0 ? "text-green-500" : "text-red-500"}`}>
                      AI is {Math.abs(aiStats.winRate - userStats.winRate).toFixed(1)}% {aiStats.winRate >= userStats.winRate ? "better" : "worse"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">ROI Difference</span>
                    <span className={`font-semibold ${aiStats.roi - userStats.roi >= 0 ? "text-green-500" : "text-red-500"}`}>
                      AI is {Math.abs(aiStats.roi - userStats.roi).toFixed(1)}% {aiStats.roi >= userStats.roi ? "better" : "worse"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <span className="font-medium">Profit Difference</span>
                    <span className={`font-semibold ${aiStats.profit - userStats.profit >= 0 ? "text-green-500" : "text-red-500"}`}>
                      AI is ${Math.abs(aiStats.profit - userStats.profit).toFixed(2)} {aiStats.profit >= userStats.profit ? "more profitable" : "less profitable"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
