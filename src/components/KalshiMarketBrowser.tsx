import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, RefreshCw, Filter, TrendingUp } from 'lucide-react';
import { KalshiMarketCard } from './KalshiMarketCard';
import { supabase } from '@/integrations/supabase/client';
import type { KalshiMarket } from '@/utils/kalshiApi';
import { useToast } from '@/hooks/use-toast';

interface KalshiMarketBrowserProps {
  onMarketSelect?: (market: KalshiMarket) => void;
  onTrade?: (market: KalshiMarket, side: 'yes' | 'no') => void;
  defaultSport?: 'NBA' | 'NFL' | 'MLB' | 'NHL' | 'ALL';
}

export const KalshiMarketBrowser: React.FC<KalshiMarketBrowserProps> = ({
  onMarketSelect,
  onTrade,
  defaultSport = 'ALL',
}) => {
  const [markets, setMarkets] = useState<KalshiMarket[]>([]);
  const [filteredMarkets, setFilteredMarkets] = useState<KalshiMarket[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>(defaultSport);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'volume' | 'edge' | 'closing_soon'>('volume');
  const { toast } = useToast();

  // Fetch markets from database
  const fetchMarkets = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('kalshi_markets')
        .select('*')
        .eq('status', 'open')
        .order('volume', { ascending: false })
        .limit(100);

      // Filter by sport if not ALL
      if (selectedSport !== 'ALL') {
        query = query.eq('sport_key', selectedSport);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        setMarkets(data as KalshiMarket[]);
        setFilteredMarkets(data as KalshiMarket[]);
      }
    } catch (error) {
      console.error('Error fetching Kalshi markets:', error);
      toast({
        title: 'Error loading markets',
        description: error instanceof Error ? error.message : 'Failed to load Kalshi markets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Sync markets from Kalshi API
  const syncMarkets = async () => {
    try {
      setLoading(true);
      toast({
        title: 'Syncing markets',
        description: 'Fetching latest data from Kalshi...',
      });

      const { data, error } = await supabase.functions.invoke('fetch-kalshi-markets', {
        body: { sport: selectedSport !== 'ALL' ? selectedSport : undefined },
      });

      if (error) throw error;

      toast({
        title: 'Markets synced',
        description: `Loaded ${data.stored_count} markets`,
      });

      // Refresh local data
      await fetchMarkets();
    } catch (error) {
      console.error('Error syncing markets:', error);
      toast({
        title: 'Sync failed',
        description: error instanceof Error ? error.message : 'Failed to sync markets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort markets
  useEffect(() => {
    let filtered = [...markets];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        m =>
          m.title.toLowerCase().includes(query) ||
          m.subtitle?.toLowerCase().includes(query) ||
          m.ticker.toLowerCase().includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'volume':
        filtered.sort((a, b) => (b.volume || 0) - (a.volume || 0));
        break;
      case 'closing_soon':
        filtered.sort((a, b) => {
          const timeA = new Date(a.close_time).getTime();
          const timeB = new Date(b.close_time).getTime();
          return timeA - timeB;
        });
        break;
      // 'edge' would require joining with analytics table
    }

    setFilteredMarkets(filtered);
  }, [markets, searchQuery, sortBy]);

  // Load markets on mount and when sport changes
  useEffect(() => {
    fetchMarkets();
  }, [selectedSport]);

  // Get market counts by sport
  const getMarketCounts = () => {
    const counts = {
      NBA: markets.filter(m => m.sport_key === 'NBA').length,
      NFL: markets.filter(m => m.sport_key === 'NFL').length,
      MLB: markets.filter(m => m.sport_key === 'MLB').length,
      NHL: markets.filter(m => m.sport_key === 'NHL').length,
      ALL: markets.length,
    };
    return counts;
  };

  const counts = getMarketCounts();

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Kalshi Prediction Markets
          </CardTitle>
          <Button onClick={syncMarkets} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Sync
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sport Tabs */}
        <Tabs value={selectedSport} onValueChange={setSelectedSport}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="ALL">
              All
              {counts.ALL > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.ALL}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="NBA">
              NBA
              {counts.NBA > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.NBA}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="NFL">
              NFL
              {counts.NFL > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.NFL}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="MLB">
              MLB
              {counts.MLB > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.MLB}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="NHL">
              NHL
              {counts.NHL > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {counts.NHL}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search and Filters */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search markets..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'volume' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('volume')}
            >
              Volume
            </Button>
            <Button
              variant={sortBy === 'closing_soon' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('closing_soon')}
            >
              Closing Soon
            </Button>
          </div>
        </div>

        {/* Markets List */}
        <ScrollArea className="h-[600px] pr-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredMarkets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No markets found</p>
              <Button onClick={syncMarkets} variant="outline" className="mt-4">
                Load Markets
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredMarkets.map(market => (
                <div
                  key={market.ticker}
                  onClick={() => onMarketSelect?.(market)}
                  className="cursor-pointer"
                >
                  <KalshiMarketCard
                    market={market}
                    onTrade={onTrade}
                    compact={false}
                  />
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Summary Footer */}
        {!loading && filteredMarkets.length > 0 && (
          <div className="text-sm text-gray-500 text-center pt-2 border-t">
            Showing {filteredMarkets.length} market{filteredMarkets.length !== 1 ? 's' : ''}
            {searchQuery && ` matching "${searchQuery}"`}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default KalshiMarketBrowser;
