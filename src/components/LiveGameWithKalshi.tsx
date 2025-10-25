import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Activity,
  TrendingUp,
  DollarSign,
  Clock,
  Target,
  AlertTriangle,
} from 'lucide-react';
import { KalshiMarketCard } from './KalshiMarketCard';
import { supabase } from '@/integrations/supabase/client';
import type { KalshiMarket } from '@/utils/kalshiApi';
import { useKalshiWebSocket } from '@/utils/kalshiWebSocket';

interface GameScore {
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  status: string;
  period: number;
  time_remaining?: string;
  game_date: string;
}

interface LiveGameWithKalshiProps {
  gameId?: string;
  homeTeam: string;
  awayTeam: string;
  sport?: 'NBA' | 'NFL' | 'MLB' | 'NHL';
}

export const LiveGameWithKalshi: React.FC<LiveGameWithKalshiProps> = ({
  gameId,
  homeTeam,
  awayTeam,
  sport = 'NBA',
}) => {
  const [gameScore, setGameScore] = useState<GameScore | null>(null);
  const [kalshiMarkets, setKalshiMarkets] = useState<KalshiMarket[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hedgeOpportunities, setHedgeOpportunities] = useState<any[]>([]);

  // WebSocket for selected market
  const { connected, marketData } = useKalshiWebSocket(selectedMarket || undefined);

  // Fetch game score
  const fetchGameScore = async () => {
    try {
      const { data, error } = await supabase
        .from('sports_scores')
        .select('*')
        .or(`home_team.ilike.%${homeTeam}%,away_team.ilike.%${awayTeam}%`)
        .order('game_date', { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      if (data) setGameScore(data);
    } catch (error) {
      console.error('Error fetching game score:', error);
    }
  };

  // Fetch related Kalshi markets
  const fetchKalshiMarkets = async () => {
    try {
      setLoading(true);

      // Search for markets mentioning either team
      const { data, error } = await supabase
        .from('kalshi_markets')
        .select('*')
        .eq('sport_key', sport)
        .eq('status', 'open')
        .or(`title.ilike.%${homeTeam}%,title.ilike.%${awayTeam}%`)
        .order('volume', { ascending: false })
        .limit(10);

      if (error) throw error;
      setKalshiMarkets(data || []);

      // Auto-select first market for WebSocket
      if (data && data.length > 0) {
        setSelectedMarket(data[0].ticker);
      }
    } catch (error) {
      console.error('Error fetching Kalshi markets:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate hedge opportunities
  const calculateHedges = () => {
    if (!gameScore) return;

    const opportunities: any[] = [];

    kalshiMarkets.forEach((market) => {
      // Simple hedge detection: if game is close and market has significant edge
      const scoreDiff = Math.abs(gameScore.home_score - gameScore.away_score);

      if (scoreDiff <= 10 && gameScore.status === 'in_progress') {
        // Check if market price suggests different outcome
        const homeWinningGame = gameScore.home_score > gameScore.away_score;
        const marketFavorHome = market.yes_ask && market.yes_ask > 50;

        if (homeWinningGame !== marketFavorHome) {
          opportunities.push({
            market,
            type: 'hedge',
            reason: 'Market odds diverging from game state',
            action: homeWinningGame ? 'Consider buying YES' : 'Consider buying NO',
          });
        }
      }
    });

    setHedgeOpportunities(opportunities);
  };

  useEffect(() => {
    fetchGameScore();
    fetchKalshiMarkets();

    // Refresh game score every 30 seconds
    const interval = setInterval(fetchGameScore, 30000);

    return () => clearInterval(interval);
  }, [homeTeam, awayTeam, sport]);

  useEffect(() => {
    calculateHedges();
  }, [gameScore, kalshiMarkets]);

  const getGameStatus = () => {
    if (!gameScore) return 'Not Started';
    if (gameScore.status === 'final') return 'Final';
    if (gameScore.status === 'in_progress') {
      return `Q${gameScore.period} ${gameScore.time_remaining || ''}`;
    }
    return gameScore.status;
  };

  const getWinProbability = () => {
    if (!gameScore) return 50;

    const totalScore = gameScore.home_score + gameScore.away_score;
    if (totalScore === 0) return 50;

    return (gameScore.home_score / totalScore) * 100;
  };

  return (
    <div className="space-y-6">
      {/* Live Game Score */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-red-500" />
              Live Game
            </CardTitle>
            <Badge variant={gameScore?.status === 'in_progress' ? 'default' : 'secondary'}>
              {getGameStatus()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Score Display */}
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">{awayTeam}</div>
                <div className="text-4xl font-bold">{gameScore?.away_score || 0}</div>
              </div>
              <div className="text-center text-muted-foreground">@</div>
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">{homeTeam}</div>
                <div className="text-4xl font-bold">{gameScore?.home_score || 0}</div>
              </div>
            </div>

            {/* Win Probability */}
            {gameScore && (
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>{awayTeam} {(100 - getWinProbability()).toFixed(0)}%</span>
                  <span>{homeTeam} {getWinProbability().toFixed(0)}%</span>
                </div>
                <Progress value={getWinProbability()} className="h-2" />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Hedge Opportunities Alert */}
      {hedgeOpportunities.length > 0 && (
        <Card className="border-orange-500 bg-orange-50 dark:bg-orange-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-900 dark:text-orange-100">
              <AlertTriangle className="h-5 w-5" />
              Hedge Opportunities Detected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {hedgeOpportunities.map((opp, idx) => (
                <div key={idx} className="bg-white dark:bg-gray-900 p-3 rounded-lg">
                  <div className="font-semibold">{opp.market.title}</div>
                  <div className="text-sm text-muted-foreground">{opp.reason}</div>
                  <div className="text-sm font-medium text-orange-700 dark:text-orange-400 mt-1">
                    {opp.action}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Kalshi Markets for This Game */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Kalshi Markets
            {connected && (
              <Badge variant="outline" className="ml-2">
                <Activity className="h-3 w-3 mr-1 text-green-500" />
                Live
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading markets...
            </div>
          ) : kalshiMarkets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No Kalshi markets found for this game
            </div>
          ) : (
            <Tabs value={selectedMarket || ''} onValueChange={setSelectedMarket}>
              <TabsList className="w-full">
                {kalshiMarkets.slice(0, 3).map((market) => (
                  <TabsTrigger key={market.ticker} value={market.ticker} className="flex-1">
                    <span className="truncate">{market.title.substring(0, 20)}...</span>
                  </TabsTrigger>
                ))}
              </TabsList>

              {kalshiMarkets.map((market) => (
                <TabsContent key={market.ticker} value={market.ticker} className="mt-4">
                  <KalshiMarketCard
                    market={{
                      ...market,
                      // Update with live WebSocket data if available
                      ...(marketData && selectedMarket === market.ticker ? {
                        yes_bid: marketData.yes_bid ?? market.yes_bid,
                        yes_ask: marketData.yes_ask ?? market.yes_ask,
                        no_bid: marketData.no_bid ?? market.no_bid,
                        no_ask: marketData.no_ask ?? market.no_ask,
                        last_price: marketData.last_price ?? market.last_price,
                        volume: marketData.volume ?? market.volume,
                      } : {}),
                    }}
                  />

                  {/* Real-time Price Updates */}
                  {marketData && selectedMarket === market.ticker && (
                    <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Real-time prices via WebSocket
                    </div>
                  )}
                </TabsContent>
              ))}
            </Tabs>
          )}

          {/* View All Markets Button */}
          {kalshiMarkets.length > 3 && (
            <div className="mt-4 text-center">
              <Button variant="outline" size="sm">
                View All {kalshiMarkets.length} Markets
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" className="w-full">
              <DollarSign className="h-4 w-4 mr-2" />
              Place Bet
            </Button>
            <Button variant="outline" className="w-full">
              <Clock className="h-4 w-4 mr-2" />
              Set Alert
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default LiveGameWithKalshi;
