import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { calculateEV, formatEV, getEVColorClass, calculateImpliedProbability, removeVig } from "@/utils/evCalculations";

interface OddsData {
  bookmaker: string;
  market_key: string;
  outcome_name: string;
  outcome_price: number;
  outcome_point?: number;
}

interface OddsComparisonProps {
  odds: OddsData[];
  homeTeam: string;
  awayTeam: string;
  aiProbabilities?: {
    home: number;
    away: number;
    market_key?: string;
  };
}

export const OddsComparison = ({ odds, homeTeam, awayTeam, aiProbabilities }: OddsComparisonProps) => {
  if (!odds || odds.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Odds Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No odds available yet</p>
        </CardContent>
      </Card>
    );
  }

  // Group odds by market type
  const groupedByMarket = odds.reduce((acc, odd) => {
    if (!acc[odd.market_key]) {
      acc[odd.market_key] = [];
    }
    acc[odd.market_key].push(odd);
    return acc;
  }, {} as Record<string, OddsData[]>);

  // Calculate fair probabilities for each market by removing vig
  const calculateFairProbabilities = (marketOdds: OddsData[], marketKey: string) => {
    // Get all unique outcomes for this market
    const homeOdds = marketOdds.filter(o => o.outcome_name === homeTeam);
    const awayOdds = marketOdds.filter(o => o.outcome_name === awayTeam);

    if (homeOdds.length === 0 || awayOdds.length === 0) {
      return null;
    }

    // Calculate average implied probabilities across all bookmakers
    const avgHomeImplied = homeOdds.reduce((sum, o) => sum + calculateImpliedProbability(o.outcome_price), 0) / homeOdds.length;
    const avgAwayImplied = awayOdds.reduce((sum, o) => sum + calculateImpliedProbability(o.outcome_price), 0) / awayOdds.length;

    // Remove vig to get fair probabilities
    const fairProbs = removeVig([avgHomeImplied, avgAwayImplied]);

    return {
      home: fairProbs[0],
      away: fairProbs[1]
    };
  };

  // Group by bookmaker within each market
  const organizedOdds = Object.entries(groupedByMarket).map(([marketKey, marketOdds]) => {
    const byBookmaker = marketOdds.reduce((acc, odd) => {
      if (!acc[odd.bookmaker]) {
        acc[odd.bookmaker] = [];
      }
      acc[odd.bookmaker].push(odd);
      return acc;
    }, {} as Record<string, OddsData[]>);

    return { marketKey, byBookmaker };
  });

  const formatOdds = (price: number) => {
    return price > 0 ? `+${price}` : `${price}`;
  };

  const getBestOdds = (bookmakerOdds: Record<string, OddsData[]>, team: string) => {
    let bestOdds = -Infinity;
    let bestBookmaker = "";

    Object.entries(bookmakerOdds).forEach(([bookmaker, odds]) => {
      const teamOdd = odds.find(o => o.outcome_name === team);
      if (teamOdd && teamOdd.outcome_price > bestOdds) {
        bestOdds = teamOdd.outcome_price;
        bestBookmaker = bookmaker;
      }
    });

    return { bestOdds, bestBookmaker };
  };

  const getBestEV = (bookmakerOdds: Record<string, OddsData[]>, team: string, trueProbability: number) => {
    let bestEV = -Infinity;
    let bestBookmaker = "";

    Object.entries(bookmakerOdds).forEach(([bookmaker, odds]) => {
      const teamOdd = odds.find(o => o.outcome_name === team);
      if (teamOdd) {
        const ev = calculateEV(trueProbability, teamOdd.outcome_price);
        if (ev > bestEV) {
          bestEV = ev;
          bestBookmaker = bookmaker;
        }
      }
    });

    return { bestEV, bestBookmaker };
  };

  const marketLabels: Record<string, string> = {
    h2h: "Moneyline",
    spreads: "Point Spread",
    totals: "Over/Under"
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Odds Comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {organizedOdds.map(({ marketKey, byBookmaker }) => {
          const bestHome = getBestOdds(byBookmaker, homeTeam);
          const bestAway = getBestOdds(byBookmaker, awayTeam);

          // Calculate fair probabilities for EV calculation
          const fairProbs = calculateFairProbabilities(groupedByMarket[marketKey], marketKey);

          // Use AI probabilities if available for this market, otherwise use fair market probabilities
          const homeProbability = fairProbs?.home || 0.5;
          const awayProbability = fairProbs?.away || 0.5;

          const bestHomeEV = getBestEV(byBookmaker, homeTeam, homeProbability);
          const bestAwayEV = getBestEV(byBookmaker, awayTeam, awayProbability);

          return (
            <div key={marketKey} className="space-y-3">
              <h4 className="font-semibold text-sm">{marketLabels[marketKey] || marketKey}</h4>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Bookmaker</TableHead>
                      <TableHead>{awayTeam}</TableHead>
                      <TableHead className="w-[80px]">EV</TableHead>
                      <TableHead>{homeTeam}</TableHead>
                      <TableHead className="w-[80px]">EV</TableHead>
                      {marketKey === "totals" && <TableHead>Total</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.entries(byBookmaker).slice(0, 5).map(([bookmaker, bookmakerOdds]) => {
                      const awayOdd = bookmakerOdds.find(o =>
                        o.outcome_name === awayTeam || o.outcome_name.includes("Over")
                      );
                      const homeOdd = bookmakerOdds.find(o =>
                        o.outcome_name === homeTeam || o.outcome_name.includes("Under")
                      );

                      // Calculate EV for each outcome
                      const awayEV = awayOdd ? calculateEV(awayProbability, awayOdd.outcome_price) : null;
                      const homeEV = homeOdd ? calculateEV(homeProbability, homeOdd.outcome_price) : null;

                      return (
                        <TableRow key={bookmaker}>
                          <TableCell className="font-medium text-xs">
                            {bookmaker}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {awayOdd && (
                                <>
                                  {marketKey === "spreads" && awayOdd.outcome_point !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      {awayOdd.outcome_point > 0 ? '+' : ''}{awayOdd.outcome_point}
                                    </span>
                                  )}
                                  <span className={
                                    bookmaker === bestAway.bestBookmaker ? "font-bold text-green-600" : ""
                                  }>
                                    {formatOdds(awayOdd.outcome_price)}
                                  </span>
                                  {bookmaker === bestAway.bestBookmaker && (
                                    <Badge variant="default" className="text-xs py-0 px-1">Best</Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {awayEV !== null && (
                              <div className="flex items-center gap-1">
                                <span className={`text-xs ${getEVColorClass(awayEV)}`}>
                                  {formatEV(awayEV)}
                                </span>
                                {bookmaker === bestAwayEV.bestBookmaker && awayEV > 0 && (
                                  <Badge variant="default" className="text-xs py-0 px-1 bg-green-600">+EV</Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {homeOdd && (
                                <>
                                  {marketKey === "spreads" && homeOdd.outcome_point !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      {homeOdd.outcome_point > 0 ? '+' : ''}{homeOdd.outcome_point}
                                    </span>
                                  )}
                                  <span className={
                                    bookmaker === bestHome.bestBookmaker ? "font-bold text-green-600" : ""
                                  }>
                                    {formatOdds(homeOdd.outcome_price)}
                                  </span>
                                  {bookmaker === bestHome.bestBookmaker && (
                                    <Badge variant="default" className="text-xs py-0 px-1">Best</Badge>
                                  )}
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {homeEV !== null && (
                              <div className="flex items-center gap-1">
                                <span className={`text-xs ${getEVColorClass(homeEV)}`}>
                                  {formatEV(homeEV)}
                                </span>
                                {bookmaker === bestHomeEV.bestBookmaker && homeEV > 0 && (
                                  <Badge variant="default" className="text-xs py-0 px-1 bg-green-600">+EV</Badge>
                                )}
                              </div>
                            )}
                          </TableCell>
                          {marketKey === "totals" && (
                            <TableCell>
                              {awayOdd?.outcome_point && (
                                <span className="text-sm">{awayOdd.outcome_point}</span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
