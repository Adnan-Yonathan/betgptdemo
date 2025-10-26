import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from "recharts";
import { format, subDays } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DataPoint {
  date: string;
  bankroll: number;
  timestamp: number;
}

interface BankrollEvent {
  date: string;
  type: "bet_placed" | "bet_won" | "bet_lost" | "bet_pushed" | "deposit" | "withdrawal";
  amount: number;
  running_balance: number;
}

/**
 * Bankroll Chart Component
 * Displays bankroll over time with historical tracking
 * Implements PRD Section 4.5: Performance Analytics (Bankroll Chart)
 */
export const BankrollChart = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<DataPoint[]>([]);
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "1y" | "all">("30d");
  const [startingBankroll, setStartingBankroll] = useState(1000);
  const [currentBankroll, setCurrentBankroll] = useState(1000);
  const [change, setChange] = useState(0);
  const [changePercent, setChangePercent] = useState(0);

  useEffect(() => {
    if (user) {
      loadChartData();
    }
  }, [user, timeRange]);

  const loadChartData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Get user bankroll info
      const { data: bankrollData } = await supabase
        .from("user_bankroll")
        .select("current_amount, starting_amount")
        .eq("user_id", user.id)
        .single();

      const starting = bankrollData?.starting_amount || 1000;
      const current = bankrollData?.current_amount || 1000;

      setStartingBankroll(starting);
      setCurrentBankroll(current);
      setChange(current - starting);
      setChangePercent(starting > 0 ? ((current - starting) / starting) * 100 : 0);

      // Calculate date range
      const now = new Date();
      let startDate: Date;
      switch (timeRange) {
        case "7d":
          startDate = subDays(now, 7);
          break;
        case "30d":
          startDate = subDays(now, 30);
          break;
        case "90d":
          startDate = subDays(now, 90);
          break;
        case "1y":
          startDate = subDays(now, 365);
          break;
        case "all":
          startDate = new Date(0); // Unix epoch
          break;
      }

      // Fetch all relevant events (bets + transactions)
      const [betsResult, transactionsResult] = await Promise.all([
        supabase
          .from("bets")
          .select("amount, outcome, actual_return, created_at, settled_at")
          .eq("user_id", user.id)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: true }),
        supabase
          .from("bankroll_transactions")
          .select("type, amount, balance_after, created_at")
          .eq("user_id", user.id)
          .gte("created_at", startDate.toISOString())
          .order("created_at", { ascending: true }),
      ]);

      const bets = betsResult.data || [];
      const transactions = transactionsResult.data || [];

      // Build timeline of events
      const events: BankrollEvent[] = [];

      // Add bet placements (decrease bankroll)
      bets.forEach((bet) => {
        events.push({
          date: bet.created_at,
          type: "bet_placed",
          amount: -bet.amount,
          running_balance: 0, // Will calculate later
        });

        // Add bet settlements (increase/decrease based on outcome)
        if (bet.outcome && bet.outcome !== "pending" && bet.settled_at) {
          if (bet.outcome === "win") {
            events.push({
              date: bet.settled_at,
              type: "bet_won",
              amount: bet.actual_return || 0,
              running_balance: 0,
            });
          } else if (bet.outcome === "push") {
            events.push({
              date: bet.settled_at,
              type: "bet_pushed",
              amount: bet.amount, // Refund
              running_balance: 0,
            });
          }
          // Losses don't add anything (already deducted on placement)
        }
      });

      // Add transactions
      transactions.forEach((tx) => {
        events.push({
          date: tx.created_at,
          type: tx.type === "deposit" ? "deposit" : "withdrawal",
          amount: tx.type === "deposit" ? tx.amount : -tx.amount,
          running_balance: 0,
        });
      });

      // Sort events chronologically
      events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Calculate running balance
      let runningBalance = starting;
      const dataPoints: DataPoint[] = [
        {
          date: format(startDate, "MMM d"),
          bankroll: starting,
          timestamp: startDate.getTime(),
        },
      ];

      events.forEach((event) => {
        runningBalance += event.amount;
        event.running_balance = runningBalance;

        // Add data point
        dataPoints.push({
          date: format(new Date(event.date), "MMM d"),
          bankroll: Number(runningBalance.toFixed(2)),
          timestamp: new Date(event.date).getTime(),
        });
      });

      // Ensure we have the current value at the end
      if (dataPoints.length > 0) {
        const lastPoint = dataPoints[dataPoints.length - 1];
        if (lastPoint.bankroll !== current) {
          dataPoints.push({
            date: format(now, "MMM d"),
            bankroll: current,
            timestamp: now.getTime(),
          });
        }
      } else {
        // No events, just show starting and current
        dataPoints.push(
          {
            date: format(startDate, "MMM d"),
            bankroll: starting,
            timestamp: startDate.getTime(),
          },
          {
            date: format(now, "MMM d"),
            bankroll: current,
            timestamp: now.getTime(),
          }
        );
      }

      // Aggregate by day for cleaner chart (take end-of-day value)
      const dailyData: { [key: string]: DataPoint } = {};
      dataPoints.forEach((point) => {
        const dateKey = point.date;
        // Keep the latest value for each day
        if (!dailyData[dateKey] || point.timestamp > dailyData[dateKey].timestamp) {
          dailyData[dateKey] = point;
        }
      });

      const aggregatedData = Object.values(dailyData).sort((a, b) => a.timestamp - b.timestamp);

      setChartData(aggregatedData);
    } catch (error) {
      console.error("Error loading chart data:", error);
    } finally {
      setLoading(false);
    }
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

  const isPositive = change >= 0;
  const minValue = Math.min(...chartData.map((d) => d.bankroll), startingBankroll);
  const maxValue = Math.max(...chartData.map((d) => d.bankroll), startingBankroll);
  const yAxisDomain = [
    Math.floor(minValue * 0.95),
    Math.ceil(maxValue * 1.05),
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Bankroll History</CardTitle>
            <CardDescription>Track your bankroll over time</CardDescription>
          </div>
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div>
            <p className="text-xs text-muted-foreground">Starting</p>
            <p className="text-lg font-semibold">${startingBankroll.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-lg font-semibold">${currentBankroll.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Change</p>
            <div className="flex items-center gap-1">
              <p className={`text-lg font-semibold ${isPositive ? "text-green-500" : "text-red-500"}`}>
                {isPositive ? "+" : ""}${change.toFixed(2)}
              </p>
              {isPositive ? (
                <TrendingUp className="w-4 h-4 text-green-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <p className={`text-xs ${isPositive ? "text-green-600" : "text-red-600"}`}>
              {isPositive ? "+" : ""}{changePercent.toFixed(1)}%
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available for this time period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="bankrollGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isPositive ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickLine={false}
              />
              <YAxis
                domain={yAxisDomain}
                tick={{ fontSize: 12 }}
                tickLine={false}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
                formatter={(value: any) => [`$${Number(value).toFixed(2)}`, "Bankroll"]}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="bankroll"
                stroke={isPositive ? "#22c55e" : "#ef4444"}
                strokeWidth={2}
                fill="url(#bankrollGradient)"
                name="Bankroll"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
