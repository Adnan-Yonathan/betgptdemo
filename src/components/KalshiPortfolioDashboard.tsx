import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Clock,
  RefreshCw,
  X
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Position {
  id: string;
  market_ticker: string;
  position_side: string;
  quantity: number;
  average_price: number;
  current_price: number;
  total_cost: number;
  current_value: number;
  unrealized_pnl: number;
  status: string;
  opened_at: string;
}

interface Order {
  id: string;
  market_ticker: string;
  side: string;
  action: string;
  order_type: string;
  count: number;
  status: string;
  placed_at: string;
}

interface Fill {
  id: string;
  market_ticker: string;
  side: string;
  action: string;
  count: number;
  price: number;
  total_cost: number;
  trade_time: string;
}

interface KalshiPortfolioDashboardProps {
  userId: string;
}

export const KalshiPortfolioDashboard: React.FC<KalshiPortfolioDashboardProps> = ({ userId }) => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [fills, setFills] = useState<Fill[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPortfolio = async () => {
    try {
      setLoading(true);

      // Fetch positions
      const { data: positionsData, error: positionsError } = await supabase
        .from('kalshi_positions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('opened_at', { ascending: false });

      if (positionsError) throw positionsError;
      setPositions(positionsData || []);

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from('kalshi_orders')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['pending', 'resting', 'partially_filled'])
        .order('placed_at', { ascending: false })
        .limit(20);

      if (ordersError) throw ordersError;
      setOrders(ordersData || []);

      // Fetch recent fills
      const { data: fillsData, error: fillsError } = await supabase
        .from('kalshi_fills')
        .select('*')
        .eq('user_id', userId)
        .order('trade_time', { ascending: false })
        .limit(50);

      if (fillsError) throw fillsError;
      setFills(fillsData || []);

    } catch (error) {
      console.error('Error fetching portfolio:', error);
      toast({
        title: 'Error loading portfolio',
        description: error instanceof Error ? error.message : 'Failed to load portfolio data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    try {
      // TODO: Call Kalshi API to cancel order
      toast({
        title: 'Order cancelled',
        description: 'Your order has been cancelled',
      });
      fetchPortfolio();
    } catch (error) {
      toast({
        title: 'Failed to cancel order',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchPortfolio();
  }, [userId]);

  // Calculate portfolio stats
  const totalValue = positions.reduce((sum, p) => sum + p.current_value, 0);
  const totalCost = positions.reduce((sum, p) => sum + p.total_cost, 0);
  const totalPnL = positions.reduce((sum, p) => sum + p.unrealized_pnl, 0);
  const pnlPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;
  const winningPositions = positions.filter(p => p.unrealized_pnl > 0).length;
  const losingPositions = positions.filter(p => p.unrealized_pnl < 0).length;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Portfolio Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground">
              Cost: {formatCurrency(totalCost)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total P&L</CardTitle>
            {totalPnL >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            </div>
            <p className="text-xs text-muted-foreground">
              {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Positions</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{positions.length}</div>
            <p className="text-xs text-muted-foreground">
              {winningPositions} winning, {losingPositions} losing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orders.length}</div>
            <p className="text-xs text-muted-foreground">
              Pending execution
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Positions, Orders, History Tabs */}
      <Tabs defaultValue="positions" className="w-full">
        <TabsList>
          <TabsTrigger value="positions">
            Positions ({positions.length})
          </TabsTrigger>
          <TabsTrigger value="orders">
            Orders ({orders.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            History ({fills.length})
          </TabsTrigger>
        </TabsList>

        {/* Positions Tab */}
        <TabsContent value="positions" className="mt-4">
          {positions.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No open positions</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {positions.map((position) => (
                  <Card key={position.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{position.market_ticker}</h3>
                            <Badge className={position.position_side === 'yes' ? 'bg-green-600' : 'bg-red-600'}>
                              {position.position_side.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <span className="text-muted-foreground">Quantity:</span>
                              <span className="ml-2 font-medium">{position.quantity}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Avg Price:</span>
                              <span className="ml-2 font-medium">{position.average_price}¢</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Current:</span>
                              <span className="ml-2 font-medium">{position.current_price}¢</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cost:</span>
                              <span className="ml-2 font-medium">{formatCurrency(position.total_cost)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-lg font-bold ${position.unrealized_pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {position.unrealized_pnl >= 0 ? '+' : ''}{formatCurrency(position.unrealized_pnl)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {((position.unrealized_pnl / position.total_cost) * 100).toFixed(2)}%
                          </div>
                          <Button size="sm" variant="outline" className="mt-2">
                            Close Position
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* Orders Tab */}
        <TabsContent value="orders" className="mt-4">
          {orders.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No active orders</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4">
                {orders.map((order) => (
                  <Card key={order.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{order.market_ticker}</h3>
                            <Badge>{order.order_type.toUpperCase()}</Badge>
                            <Badge variant="outline">{order.status}</Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {order.action.toUpperCase()} {order.count} {order.side.toUpperCase()} contracts
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Placed: {formatDate(order.placed_at)}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => cancelOrder(order.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="mt-4">
          {fills.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No trade history</p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {fills.map((fill) => (
                  <Card key={fill.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{fill.market_ticker}</span>
                            <Badge
                              variant="outline"
                              className={fill.action === 'buy' ? 'bg-green-50' : 'bg-red-50'}
                            >
                              {fill.action.toUpperCase()} {fill.side.toUpperCase()}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {fill.count} contracts @ {fill.price}¢ • {formatDate(fill.trade_time)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{formatCurrency(fill.total_cost)}</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Refresh Button */}
      <div className="flex justify-center">
        <Button onClick={fetchPortfolio} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Portfolio
        </Button>
      </div>
    </div>
  );
};

export default KalshiPortfolioDashboard;
