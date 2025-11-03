import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, Zap, ArrowRight } from "lucide-react";

interface OddsDiscrepancy {
  id: string;
  event_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  game_time: string;
  market_key: string;
  outcome_name: string;
  bookmaker_low: string;
  odds_low: number;
  probability_low: number;
  bookmaker_high: string;
  odds_high: number;
  probability_high: number;
  probability_difference: number;
  percentage_difference: number;
}

interface SharpMoneySignal {
  id: string;
  event_id: string;
  sport: string;
  home_team: string;
  away_team: string;
  signal_type: string;
  strength: string;
  sharp_side: string;
  confidence_score: number;
  detected_at: string;
}

export function ValueDashboard() {
  const [discrepancies, setDiscrepancies] = useState<OddsDiscrepancy[]>([]);
  const [sharpSignals, setSharpSignals] = useState<SharpMoneySignal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("discrepancies");

  useEffect(() => {
    fetchValueData();
  }, []);

  const fetchValueData = async () => {
    setIsLoading(true);
    try {
      // TODO: Re-enable when odds_discrepancies table is created
      // Odds discrepancies feature is temporarily disabled
      setDiscrepancies([]);
      
      // TODO: Re-enable when sharp_money_signals table is created  
      // Sharp money signals feature is temporarily disabled
      setSharpSignals([]);
    } catch (error) {
      console.error('Error fetching value data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatOdds = (americanOdds: number) => {
    return americanOdds > 0 ? `+${americanOdds}` : americanOdds.toString();
  };

  const getStrengthColor = (strength: string) => {
    switch (strength) {
      case 'very_strong':
        return 'bg-red-500';
      case 'strong':
        return 'bg-orange-500';
      case 'moderate':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getSignalIcon = (signalType: string) => {
    switch (signalType) {
      case 'steam_move':
        return <Zap className="w-4 h-4" />;
      case 'reverse_line_movement':
        return <TrendingUp className="w-4 h-4" />;
      default:
        return <DollarSign className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Value Dashboard</CardTitle>
          <CardDescription>Finding betting value across markets</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Value Dashboard
        </CardTitle>
        <CardDescription>
          Compare odds across 15+ sportsbooks and track sharp action
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="discrepancies">
              Odds Discrepancies ({discrepancies.length})
            </TabsTrigger>
            <TabsTrigger value="sharp">
              Sharp Action ({sharpSignals.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discrepancies" className="space-y-4">
            {discrepancies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No significant odds discrepancies found at this time.
              </div>
            ) : (
              discrepancies.map((disc) => (
                <Card key={disc.id} className="border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold">
                          {disc.away_team} @ {disc.home_team}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {disc.market_key} - {disc.outcome_name}
                        </p>
                      </div>
                      <Badge variant="destructive">
                        {disc.probability_difference.toFixed(2)}% diff
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex-1 text-center p-3 bg-red-50 dark:bg-red-950 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Worst Line</p>
                        <p className="font-bold">{disc.bookmaker_low}</p>
                        <p className="text-sm">{formatOdds(disc.odds_low)}</p>
                        <p className="text-xs text-muted-foreground">
                          {(disc.probability_low * 100).toFixed(1)}% implied
                        </p>
                      </div>

                      <ArrowRight className="w-6 h-6 text-muted-foreground" />

                      <div className="flex-1 text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">Best Line</p>
                        <p className="font-bold">{disc.bookmaker_high}</p>
                        <p className="text-sm">{formatOdds(disc.odds_high)}</p>
                        <p className="text-xs text-muted-foreground">
                          {(disc.probability_high * 100).toFixed(1)}% implied
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground text-center">
                      {new Date(disc.game_time).toLocaleString()} • {disc.sport}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="sharp" className="space-y-4">
            {sharpSignals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No recent sharp money signals detected.
              </div>
            ) : (
              sharpSignals.map((signal) => (
                <Card key={signal.id} className="border-2">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getSignalIcon(signal.signal_type)}
                        <div>
                          <h3 className="font-semibold">
                            {signal.away_team} @ {signal.home_team}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {signal.signal_type.replace(/_/g, ' ').toUpperCase()}
                          </p>
                        </div>
                      </div>
                      <Badge className={getStrengthColor(signal.strength)}>
                        {signal.strength}
                      </Badge>
                    </div>

                    <div className="mt-3 p-3 bg-secondary rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Sharp Side:</span>
                        <span className="text-sm font-bold uppercase">{signal.sharp_side}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-sm font-medium">Confidence:</span>
                        <span className="text-sm">{signal.confidence_score.toFixed(1)}%</span>
                      </div>
                    </div>

                    <div className="mt-3 text-xs text-muted-foreground text-center">
                      Detected {new Date(signal.detected_at).toLocaleString()} • {signal.sport}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
