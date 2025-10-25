import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Activity, Clock, DollarSign, Target } from 'lucide-react';
import type { KalshiMarket } from '@/utils/kalshiApi';

interface MarketAnalysis {
  model_probability?: number;
  market_probability?: number;
  edge?: number;
  confidence_score?: number;
  recommendation?: 'strong_yes' | 'yes' | 'no' | 'strong_no' | 'hold' | 'avoid';
  reasoning?: string;
  kelly_fraction?: number;
  expected_value?: number;
}

interface KalshiMarketCardProps {
  market: KalshiMarket;
  analysis?: MarketAnalysis;
  onTrade?: (market: KalshiMarket, side: 'yes' | 'no') => void;
  compact?: boolean;
}

export const KalshiMarketCard: React.FC<KalshiMarketCardProps> = ({
  market,
  analysis,
  onTrade,
  compact = false,
}) => {
  // Calculate implied probabilities from prices
  const yesProbability = market.yes_ask ? market.yes_ask / 100 : 0;
  const noProbability = market.no_ask ? market.no_ask / 100 : 0;

  // Format time until close
  const getTimeUntilClose = () => {
    const closeTime = new Date(market.close_time).getTime();
    const now = Date.now();
    const diff = closeTime - now;

    if (diff < 0) return 'Closed';
    if (diff < 60 * 60 * 1000) {
      const minutes = Math.floor(diff / (60 * 1000));
      return `${minutes}m`;
    }
    if (diff < 24 * 60 * 60 * 1000) {
      const hours = Math.floor(diff / (60 * 60 * 1000));
      return `${hours}h`;
    }
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));
    return `${days}d`;
  };

  // Get recommendation color and label
  const getRecommendationBadge = () => {
    if (!analysis?.recommendation) return null;

    const configs = {
      strong_yes: { color: 'bg-green-600', label: 'Strong Buy YES', icon: TrendingUp },
      yes: { color: 'bg-green-500', label: 'Buy YES', icon: TrendingUp },
      no: { color: 'bg-red-500', label: 'Buy NO', icon: TrendingDown },
      strong_no: { color: 'bg-red-600', label: 'Strong Buy NO', icon: TrendingDown },
      hold: { color: 'bg-gray-500', label: 'Hold', icon: Activity },
      avoid: { color: 'bg-gray-600', label: 'Avoid', icon: Activity },
    };

    const config = configs[analysis.recommendation];
    if (!config) return null;

    const Icon = config.icon;

    return (
      <Badge className={`${config.color} text-white`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  // Get edge color
  const getEdgeColor = (edge?: number) => {
    if (!edge) return 'text-gray-500';
    if (edge >= 0.08) return 'text-green-600 font-bold';
    if (edge >= 0.05) return 'text-green-500';
    if (edge >= 0.02) return 'text-yellow-500';
    if (edge <= -0.08) return 'text-red-600 font-bold';
    if (edge <= -0.05) return 'text-red-500';
    return 'text-gray-500';
  };

  // Format currency
  const formatCents = (cents?: number) => {
    if (cents === undefined || cents === null) return '-';
    return `${cents}¢`;
  };

  // Format percentage
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Get sport badge color
  const getSportBadgeColor = (sportKey?: string) => {
    const colors: Record<string, string> = {
      NBA: 'bg-orange-500',
      NFL: 'bg-blue-600',
      MLB: 'bg-red-600',
      NHL: 'bg-blue-500',
    };
    return colors[sportKey || ''] || 'bg-purple-500';
  };

  if (compact) {
    return (
      <Card className="w-full hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {market.sport_key && (
                  <Badge className={`${getSportBadgeColor(market.sport_key)} text-white text-xs`}>
                    {market.sport_key}
                  </Badge>
                )}
                <span className="text-xs text-gray-500">{market.ticker}</span>
              </div>
              <h3 className="font-semibold text-sm line-clamp-2">{market.title}</h3>
            </div>
            <div className="flex items-center gap-3 ml-4">
              <div className="text-center">
                <div className="text-xs text-gray-500">Yes</div>
                <div className="font-bold text-green-600">{formatCents(market.yes_ask)}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">No</div>
                <div className="font-bold text-red-600">{formatCents(market.no_ask)}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {market.sport_key && (
                <Badge className={`${getSportBadgeColor(market.sport_key)} text-white`}>
                  {market.sport_key}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs">
                {market.ticker}
              </Badge>
              {market.status === 'open' && (
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {getTimeUntilClose()}
                </Badge>
              )}
            </div>
            <CardTitle className="text-lg leading-tight">{market.title}</CardTitle>
            {market.subtitle && (
              <p className="text-sm text-gray-600 mt-1">{market.subtitle}</p>
            )}
          </div>
          {getRecommendationBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Market Prices */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-green-50 dark:bg-green-950 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-green-900 dark:text-green-100">YES</span>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Bid</span>
                <span className="font-bold text-green-700">{formatCents(market.yes_bid)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Ask</span>
                <span className="font-bold text-green-700">{formatCents(market.yes_ask)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-green-200">
                <span className="text-xs text-gray-600">Implied</span>
                <span className="text-sm font-semibold">{formatPercent(yesProbability)}</span>
              </div>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-950 p-3 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-red-900 dark:text-red-100">NO</span>
              <TrendingDown className="h-4 w-4 text-red-600" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Bid</span>
                <span className="font-bold text-red-700">{formatCents(market.no_bid)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Ask</span>
                <span className="font-bold text-red-700">{formatCents(market.no_ask)}</span>
              </div>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-red-200">
                <span className="text-xs text-gray-600">Implied</span>
                <span className="text-sm font-semibold">{formatPercent(noProbability)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <div className="text-xs text-gray-500">Volume</div>
            <div className="font-semibold">{market.volume?.toLocaleString() || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Open Interest</div>
            <div className="font-semibold">{market.open_interest?.toLocaleString() || '-'}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Liquidity</div>
            <div className="font-semibold">${(market.liquidity || 0).toLocaleString()}</div>
          </div>
        </div>

        {/* AI Analysis Section */}
        {analysis && (
          <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                AI Analysis
              </span>
            </div>

            {/* Edge Display */}
            {analysis.edge !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Edge</span>
                <span className={`text-lg font-bold ${getEdgeColor(analysis.edge)}`}>
                  {analysis.edge >= 0 ? '+' : ''}{formatPercent(analysis.edge)}
                </span>
              </div>
            )}

            {/* Model Probability */}
            {analysis.model_probability !== undefined && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-600">Model Probability</span>
                  <span className="text-sm font-semibold">
                    {formatPercent(analysis.model_probability)}
                  </span>
                </div>
                <Progress
                  value={analysis.model_probability * 100}
                  className="h-2"
                />
              </div>
            )}

            {/* Confidence Score */}
            {analysis.confidence_score !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Confidence</span>
                <Badge variant="outline">
                  {analysis.confidence_score}/100
                </Badge>
              </div>
            )}

            {/* Expected Value */}
            {analysis.expected_value !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Expected Value</span>
                <span className={`font-semibold ${analysis.expected_value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {analysis.expected_value >= 0 ? '+' : ''}${analysis.expected_value.toFixed(2)}
                </span>
              </div>
            )}

            {/* Reasoning */}
            {analysis.reasoning && (
              <div className="text-xs text-gray-700 dark:text-gray-300 border-t border-blue-200 pt-2 mt-2">
                {analysis.reasoning}
              </div>
            )}
          </div>
        )}

        {/* Trading Buttons */}
        {onTrade && market.status === 'open' && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button
              onClick={() => onTrade(market, 'yes')}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Buy YES
            </Button>
            <Button
              onClick={() => onTrade(market, 'no')}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Buy NO
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KalshiMarketCard;
