import React, { useState } from 'react';
import { KalshiMarketBrowser } from '@/components/KalshiMarketBrowser';
import { KalshiPortfolioDashboard } from '@/components/KalshiPortfolioDashboard';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Wallet, AlertCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { KalshiMarket } from '@/utils/kalshiApi';
import { useAuth } from '@/hooks/useAuth';

const KalshiPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedMarket, setSelectedMarket] = useState<KalshiMarket | null>(null);

  const handleTrade = (market: KalshiMarket, side: 'yes' | 'no') => {
    console.log('Trade initiated:', { market: market.ticker, side });
    // TODO: Implement trade modal/flow
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  Kalshi Prediction Markets
                </h1>
                <p className="text-sm text-muted-foreground">
                  Trade on sports outcomes with real-time pricing
                </p>
              </div>
            </div>
            {user && (
              <Button onClick={() => navigate('/')}>
                Back to Chat
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <Tabs defaultValue="markets" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="markets">
              <TrendingUp className="h-4 w-4 mr-2" />
              Markets
            </TabsTrigger>
            <TabsTrigger value="portfolio">
              <Wallet className="h-4 w-4 mr-2" />
              Portfolio
            </TabsTrigger>
          </TabsList>

          <TabsContent value="markets" className="mt-6">
            <div className="grid gap-6">
              {/* Info Banner */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                      About Kalshi Markets
                    </h3>
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      Kalshi is a CFTC-regulated prediction market exchange. Trade on sports outcomes
                      with transparent, market-driven pricing. Each contract is worth $1 if your prediction
                      is correct.
                    </p>
                  </div>
                </div>
              </div>

              {/* Market Browser */}
              <KalshiMarketBrowser
                onMarketSelect={setSelectedMarket}
                onTrade={handleTrade}
              />
            </div>
          </TabsContent>

          <TabsContent value="portfolio" className="mt-6">
            {user ? (
              <KalshiPortfolioDashboard userId={user.id} />
            ) : (
              <div className="text-center py-12 bg-card rounded-lg border">
                <Wallet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sign in to view your portfolio</h3>
                <p className="text-muted-foreground mb-4">
                  Track your Kalshi positions, P&L, and trade history
                </p>
                <Button onClick={() => navigate('/auth')}>
                  Sign In
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default KalshiPage;
