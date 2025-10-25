-- ============================================================================
-- KALSHI MARKETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kalshi_markets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker TEXT NOT NULL UNIQUE,
  event_ticker TEXT NOT NULL,
  series_ticker TEXT,
  title TEXT NOT NULL,
  subtitle TEXT,
  market_type TEXT NOT NULL DEFAULT 'binary',
  
  -- Status fields
  status TEXT NOT NULL DEFAULT 'open',
  close_time TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_expiration_time TIMESTAMP WITH TIME ZONE,
  
  -- Pricing fields
  yes_bid NUMERIC,
  yes_ask NUMERIC,
  no_bid NUMERIC,
  no_ask NUMERIC,
  last_price NUMERIC,
  previous_yes_bid NUMERIC,
  previous_yes_ask NUMERIC,
  
  -- Volume & liquidity fields
  volume INTEGER DEFAULT 0,
  volume_24h INTEGER DEFAULT 0,
  open_interest INTEGER DEFAULT 0,
  liquidity NUMERIC DEFAULT 0,
  
  -- Market details
  strike_type TEXT,
  floor_strike NUMERIC,
  cap_strike NUMERIC,
  can_close_early BOOLEAN DEFAULT false,
  
  -- Rules
  rules_primary TEXT,
  rules_secondary TEXT,
  
  -- Categories and filtering
  category TEXT,
  tags TEXT[],
  sport_key TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for kalshi_markets
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_status ON public.kalshi_markets(status);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_sport_key ON public.kalshi_markets(sport_key);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_close_time ON public.kalshi_markets(close_time);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_volume ON public.kalshi_markets(volume DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_event_ticker ON public.kalshi_markets(event_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_series_ticker ON public.kalshi_markets(series_ticker);

-- Enable RLS for kalshi_markets
ALTER TABLE public.kalshi_markets ENABLE ROW LEVEL SECURITY;

-- Anyone can view markets (public data)
CREATE POLICY "Anyone can view kalshi markets" 
  ON public.kalshi_markets 
  FOR SELECT 
  USING (true);

-- ============================================================================
-- KALSHI POSITIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kalshi_positions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  market_ticker TEXT NOT NULL,
  position_side TEXT NOT NULL, -- 'yes' or 'no'
  
  -- Quantity and pricing
  quantity INTEGER NOT NULL,
  average_price NUMERIC NOT NULL,
  current_price NUMERIC NOT NULL DEFAULT 0,
  
  -- Cost and value
  total_cost NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unrealized_pnl NUMERIC NOT NULL DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'open',
  
  -- Timestamps
  opened_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for kalshi_positions
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_user_id ON public.kalshi_positions(user_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_market_ticker ON public.kalshi_positions(market_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_status ON public.kalshi_positions(status);
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_opened_at ON public.kalshi_positions(opened_at DESC);

-- Enable RLS for kalshi_positions
ALTER TABLE public.kalshi_positions ENABLE ROW LEVEL SECURITY;

-- Users can view their own positions
CREATE POLICY "Users can view their own positions" 
  ON public.kalshi_positions 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own positions
CREATE POLICY "Users can create their own positions" 
  ON public.kalshi_positions 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own positions
CREATE POLICY "Users can update their own positions" 
  ON public.kalshi_positions 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own positions
CREATE POLICY "Users can delete their own positions" 
  ON public.kalshi_positions 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- KALSHI ORDERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kalshi_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id TEXT, -- Kalshi's order ID
  market_ticker TEXT NOT NULL,
  
  -- Order details
  side TEXT NOT NULL, -- 'yes' or 'no'
  action TEXT NOT NULL, -- 'buy' or 'sell'
  order_type TEXT NOT NULL DEFAULT 'limit', -- 'limit' or 'market'
  
  -- Quantity and pricing
  count INTEGER NOT NULL,
  remaining_count INTEGER,
  yes_price NUMERIC,
  no_price NUMERIC,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'resting', 'partially_filled', 'executed', 'canceled'
  
  -- Timestamps
  placed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  executed_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for kalshi_orders
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_user_id ON public.kalshi_orders(user_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_market_ticker ON public.kalshi_orders(market_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_status ON public.kalshi_orders(status);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_placed_at ON public.kalshi_orders(placed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_order_id ON public.kalshi_orders(order_id);

-- Enable RLS for kalshi_orders
ALTER TABLE public.kalshi_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own orders
CREATE POLICY "Users can view their own orders" 
  ON public.kalshi_orders 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own orders
CREATE POLICY "Users can create their own orders" 
  ON public.kalshi_orders 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own orders
CREATE POLICY "Users can update their own orders" 
  ON public.kalshi_orders 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Users can delete their own orders
CREATE POLICY "Users can delete their own orders" 
  ON public.kalshi_orders 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================================================
-- KALSHI FILLS TABLE (Trade History)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.kalshi_fills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id TEXT, -- Kalshi's trade ID
  order_id TEXT, -- Reference to kalshi_orders.order_id
  market_ticker TEXT NOT NULL,
  
  -- Trade details
  side TEXT NOT NULL, -- 'yes' or 'no'
  action TEXT NOT NULL, -- 'buy' or 'sell'
  count INTEGER NOT NULL,
  price NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  
  -- Trade type
  trade_type TEXT,
  
  -- Timestamps
  trade_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for kalshi_fills
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_user_id ON public.kalshi_fills(user_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_market_ticker ON public.kalshi_fills(market_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_trade_time ON public.kalshi_fills(trade_time DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_trade_id ON public.kalshi_fills(trade_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_order_id ON public.kalshi_fills(order_id);

-- Enable RLS for kalshi_fills
ALTER TABLE public.kalshi_fills ENABLE ROW LEVEL SECURITY;

-- Users can view their own fills
CREATE POLICY "Users can view their own fills" 
  ON public.kalshi_fills 
  FOR SELECT 
  USING (auth.uid() = user_id);

-- Users can insert their own fills
CREATE POLICY "Users can create their own fills" 
  ON public.kalshi_fills 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Trigger for kalshi_markets
CREATE TRIGGER update_kalshi_markets_updated_at
  BEFORE UPDATE ON public.kalshi_markets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for kalshi_positions
CREATE TRIGGER update_kalshi_positions_updated_at
  BEFORE UPDATE ON public.kalshi_positions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for kalshi_orders
CREATE TRIGGER update_kalshi_orders_updated_at
  BEFORE UPDATE ON public.kalshi_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();