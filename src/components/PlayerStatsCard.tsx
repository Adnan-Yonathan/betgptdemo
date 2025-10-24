import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Home, Plane } from 'lucide-react';

interface PlayerStats {
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  fieldGoalsMade?: number;
  fieldGoalsAttempted?: number;
  threePointsMade?: number;
  threePointsAttempted?: number;
  freeThrowsMade?: number;
  freeThrowsAttempted?: number;
  minutes?: string;
  plusMinus?: string;
}

interface PlayerHistory {
  seasonAvg: number;
  last5Avg: number;
  last10Avg: number;
  vsOpponentAvg: number;
  homeAwaySplit: number;
  trend: 'improving' | 'declining' | 'neutral';
  consistency: number;
  sampleSize: number;
}

interface PlayerStatsCardProps {
  playerName: string;
  team: string;
  position?: string;
  opponent?: string;
  isHome?: boolean;
  recentStats?: PlayerStats;
  history?: PlayerHistory;
  propType?: string;
  propLine?: number;
  predictedValue?: number;
  confidence?: number;
  edge?: number;
  recommendedSide?: string;
}

export const PlayerStatsCard: React.FC<PlayerStatsCardProps> = ({
  playerName,
  team,
  position,
  opponent,
  isHome,
  recentStats,
  history,
  propType,
  propLine,
  predictedValue,
  confidence,
  edge,
  recommendedSide,
}) => {
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEdgeColor = (edgeValue?: number) => {
    if (!edgeValue) return 'bg-gray-500';
    if (edgeValue >= 5) return 'bg-green-500';
    if (edgeValue >= 2) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatStat = (made?: number, attempted?: number) => {
    if (made === undefined || attempted === undefined) return '-';
    const percentage = attempted > 0 ? ((made / attempted) * 100).toFixed(1) : '0.0';
    return `${made}-${attempted} (${percentage}%)`;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold">{playerName}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-gray-600">{team}</span>
              {position && <Badge variant="outline">{position}</Badge>}
              {isHome !== undefined && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  {isHome ? <Home className="h-3 w-3" /> : <Plane className="h-3 w-3" />}
                  {isHome ? 'Home' : 'Away'}
                </Badge>
              )}
            </div>
          </div>
          {history && (
            <div className="flex items-center gap-2">
              {getTrendIcon(history.trend)}
              <span className="text-sm text-gray-600 capitalize">{history.trend}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Prop Prediction */}
        {propType && propLine !== undefined && (
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-sm uppercase">{propType}</span>
              {recommendedSide && (
                <Badge className={getEdgeColor(edge)}>
                  {recommendedSide.toUpperCase()}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-gray-600">Line</div>
                <div className="font-bold">{propLine}</div>
              </div>
              <div>
                <div className="text-gray-600">Predicted</div>
                <div className="font-bold text-blue-600">{predictedValue?.toFixed(1)}</div>
              </div>
              <div>
                <div className="text-gray-600">Edge</div>
                <div className="font-bold text-green-600">
                  {edge !== undefined ? `${edge.toFixed(1)}%` : '-'}
                </div>
              </div>
            </div>
            {confidence !== undefined && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>Confidence</span>
                  <span>{confidence}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Historical Averages */}
        {history && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Historical Averages</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-600">Last 5 Games</div>
                <div className="font-bold">{history.last5Avg.toFixed(1)}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-600">Last 10 Games</div>
                <div className="font-bold">{history.last10Avg.toFixed(1)}</div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-600">Season Avg</div>
                <div className="font-bold">{history.seasonAvg.toFixed(1)}</div>
              </div>
              {opponent && (
                <div className="p-2 bg-blue-50 rounded">
                  <div className="text-gray-600">vs {opponent}</div>
                  <div className="font-bold text-blue-600">
                    {history.vsOpponentAvg.toFixed(1)}
                  </div>
                </div>
              )}
            </div>

            {/* Home/Away Split */}
            {history.homeAwaySplit !== 1.0 && (
              <div className="mt-2 p-2 bg-gray-50 rounded">
                <div className="text-xs text-gray-600 mb-1">Home/Away Performance</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm">
                    {history.homeAwaySplit > 1 ? 'Better at Home' : 'Better Away'}
                  </span>
                  <Badge variant="outline">
                    {Math.abs((history.homeAwaySplit - 1) * 100).toFixed(0)}% difference
                  </Badge>
                </div>
              </div>
            )}

            {/* Consistency */}
            <div className="mt-2 p-2 bg-gray-50 rounded">
              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                <span>Consistency</span>
                <span>{formatPercentage(history.consistency)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    history.consistency >= 0.8
                      ? 'bg-green-500'
                      : history.consistency >= 0.6
                      ? 'bg-yellow-500'
                      : 'bg-red-500'
                  }`}
                  style={{ width: formatPercentage(history.consistency) }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Based on {history.sampleSize} games
              </div>
            </div>
          </div>
        )}

        {/* Recent Game Stats */}
        {recentStats && (
          <div>
            <h4 className="font-semibold text-sm mb-2">Last Game Performance</h4>
            <div className="grid grid-cols-3 gap-2 text-sm">
              {recentStats.points !== undefined && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-gray-600">PTS</div>
                  <div className="font-bold">{recentStats.points}</div>
                </div>
              )}
              {recentStats.rebounds !== undefined && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-gray-600">REB</div>
                  <div className="font-bold">{recentStats.rebounds}</div>
                </div>
              )}
              {recentStats.assists !== undefined && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-gray-600">AST</div>
                  <div className="font-bold">{recentStats.assists}</div>
                </div>
              )}
              {recentStats.steals !== undefined && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-gray-600">STL</div>
                  <div className="font-bold">{recentStats.steals}</div>
                </div>
              )}
              {recentStats.blocks !== undefined && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-gray-600">BLK</div>
                  <div className="font-bold">{recentStats.blocks}</div>
                </div>
              )}
              {recentStats.turnovers !== undefined && (
                <div className="p-2 bg-gray-50 rounded">
                  <div className="text-gray-600">TO</div>
                  <div className="font-bold">{recentStats.turnovers}</div>
                </div>
              )}
            </div>

            {/* Shooting Stats */}
            <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-600">FG</div>
                <div className="font-mono">
                  {formatStat(recentStats.fieldGoalsMade, recentStats.fieldGoalsAttempted)}
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-600">3PT</div>
                <div className="font-mono">
                  {formatStat(recentStats.threePointsMade, recentStats.threePointsAttempted)}
                </div>
              </div>
              <div className="p-2 bg-gray-50 rounded">
                <div className="text-gray-600">FT</div>
                <div className="font-mono">
                  {formatStat(recentStats.freeThrowsMade, recentStats.freeThrowsAttempted)}
                </div>
              </div>
            </div>

            {/* Minutes and Plus/Minus */}
            <div className="mt-2 flex gap-2">
              {recentStats.minutes && (
                <div className="flex-1 p-2 bg-gray-50 rounded text-xs">
                  <div className="text-gray-600">Minutes</div>
                  <div className="font-bold">{recentStats.minutes}</div>
                </div>
              )}
              {recentStats.plusMinus && (
                <div className="flex-1 p-2 bg-gray-50 rounded text-xs">
                  <div className="text-gray-600">+/-</div>
                  <div
                    className={`font-bold ${
                      recentStats.plusMinus.startsWith('+')
                        ? 'text-green-600'
                        : recentStats.plusMinus.startsWith('-')
                        ? 'text-red-600'
                        : ''
                    }`}
                  >
                    {recentStats.plusMinus}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PlayerStatsCard;
