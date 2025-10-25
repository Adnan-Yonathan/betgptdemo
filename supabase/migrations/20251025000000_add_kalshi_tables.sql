-- ============================================================================
-- KALSHI PREDICTION MARKETS INTEGRATION
-- ============================================================================
-- This migration adds tables for Kalshi prediction market integration
-- Created: 2025-10-25
-- ============================================================================

-- ============================================================================
-- KALSHI MARKETS TABLE
-- Stores prediction market data from Kalshi API
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_markets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Market identifiers
  ticker TEXT UNIQUE NOT NULL,
  event_ticker TEXT NOT NULL,
  series_ticker TEXT,

  -- Market details
  title TEXT NOT NULL,
  subtitle TEXT,
  market_type TEXT NOT NULL DEFAULT 'binary', -- 'binary', 'scalar'

  -- Status
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed', 'settled', 'finalized'
  close_time TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_time TIMESTAMP WITH TIME ZONE NOT NULL,
  expected_expiration_time TIMESTAMP WITH TIME ZONE,

  -- Pricing (in cents, 0-100)
  yes_bid DECIMAL(10,4),
  yes_ask DECIMAL(10,4),
  no_bid DECIMAL(10,4),
  no_ask DECIMAL(10,4),
  last_price DECIMAL(10,4),
  previous_yes_bid DECIMAL(10,4),
  previous_yes_ask DECIMAL(10,4),

  -- Volume & liquidity
  volume INTEGER DEFAULT 0,
  volume_24h INTEGER DEFAULT 0,
  open_interest INTEGER DEFAULT 0,
  liquidity DECIMAL(15,2) DEFAULT 0,

  -- Strike information
  strike_type TEXT,
  floor_strike DECIMAL(15,2),
  cap_strike DECIMAL(15,2),
  can_close_early BOOLEAN DEFAULT false,

  -- Rules
  rules_primary TEXT,
  rules_secondary TEXT,

  -- Categories (for filtering sports markets)
  category TEXT,
  tags TEXT[],

  -- Metadata for sports integration
  sport_key TEXT, -- 'NBA', 'NFL', 'MLB', 'NHL', etc.
  team_names TEXT[], -- Team names if applicable
  player_name TEXT, -- Player name if applicable (for player props)

  -- Cache management
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for kalshi_markets
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_ticker ON kalshi_markets(ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_event_ticker ON kalshi_markets(event_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_series_ticker ON kalshi_markets(series_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_status ON kalshi_markets(status);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_sport ON kalshi_markets(sport_key, status);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_category ON kalshi_markets(category);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_expiration ON kalshi_markets(expiration_time);
CREATE INDEX IF NOT EXISTS idx_kalshi_markets_close_time ON kalshi_markets(close_time);

-- ============================================================================
-- KALSHI POSITIONS TABLE
-- Stores user's positions on Kalshi markets
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_positions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Market reference
  market_ticker TEXT NOT NULL,

  -- Position details
  position_side TEXT NOT NULL, -- 'yes' or 'no'
  quantity INTEGER NOT NULL DEFAULT 0,

  -- Pricing
  average_price DECIMAL(10,4), -- Average entry price
  current_price DECIMAL(10,4), -- Current market price

  -- P&L tracking
  total_cost DECIMAL(15,2) NOT NULL DEFAULT 0, -- Total amount paid
  current_value DECIMAL(15,2) DEFAULT 0, -- Current market value
  unrealized_pnl DECIMAL(15,2) DEFAULT 0, -- Current profit/loss
  realized_pnl DECIMAL(15,2) DEFAULT 0, -- Realized profit/loss (closed positions)
  fees_paid DECIMAL(15,2) DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'open', -- 'open', 'closed', 'settled'

  -- Metadata
  resting_order_count INTEGER DEFAULT 0,

  -- Timestamps
  opened_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, market_ticker, position_side)
);

-- Indexes for kalshi_positions
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_user ON kalshi_positions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_market ON kalshi_positions(market_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_positions_status ON kalshi_positions(status);

-- RLS policies for kalshi_positions
ALTER TABLE kalshi_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own positions"
  ON kalshi_positions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own positions"
  ON kalshi_positions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own positions"
  ON kalshi_positions FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- KALSHI ORDERS TABLE
-- Stores user's order history on Kalshi
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Kalshi order ID (from API)
  kalshi_order_id TEXT UNIQUE,

  -- Market reference
  market_ticker TEXT NOT NULL,

  -- Order details
  side TEXT NOT NULL, -- 'yes' or 'no'
  action TEXT NOT NULL, -- 'buy' or 'sell'
  order_type TEXT NOT NULL, -- 'limit', 'market'

  -- Quantity
  count INTEGER NOT NULL, -- Total contracts
  remaining_count INTEGER, -- Unfilled contracts

  -- Pricing
  yes_price DECIMAL(10,4),
  no_price DECIMAL(10,4),

  -- Execution
  place_count INTEGER DEFAULT 0,
  decrease_count INTEGER DEFAULT 0,
  filled_quantity INTEGER DEFAULT 0,
  average_fill_price DECIMAL(10,4),

  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'resting', 'filled', 'partially_filled', 'canceled', 'executed'

  -- Metadata
  expiration_ts TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  placed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  filled_at TIMESTAMP WITH TIME ZONE,
  canceled_at TIMESTAMP WITH TIME ZONE,
  last_update_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for kalshi_orders
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_user ON kalshi_orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_market ON kalshi_orders(market_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_kalshi_id ON kalshi_orders(kalshi_order_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_orders_status ON kalshi_orders(status);

-- RLS policies for kalshi_orders
ALTER TABLE kalshi_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own orders"
  ON kalshi_orders FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own orders"
  ON kalshi_orders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own orders"
  ON kalshi_orders FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- KALSHI FILLS TABLE
-- Stores individual trade executions (fills)
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_fills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- References
  order_id UUID REFERENCES kalshi_orders(id) ON DELETE SET NULL,
  kalshi_trade_id TEXT, -- Trade ID from Kalshi
  market_ticker TEXT NOT NULL,

  -- Trade details
  side TEXT NOT NULL, -- 'yes' or 'no'
  action TEXT NOT NULL, -- 'buy' or 'sell'
  count INTEGER NOT NULL, -- Number of contracts filled

  -- Pricing
  yes_price DECIMAL(10,4) NOT NULL,
  no_price DECIMAL(10,4) NOT NULL,
  price DECIMAL(10,4) NOT NULL, -- Actual execution price

  -- Cost
  total_cost DECIMAL(15,2) NOT NULL,

  -- Metadata
  trade_type TEXT,

  -- Timestamps
  trade_time TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for kalshi_fills
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_user ON kalshi_fills(user_id, trade_time DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_order ON kalshi_fills(order_id);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_market ON kalshi_fills(market_ticker);
CREATE INDEX IF NOT EXISTS idx_kalshi_fills_trade_id ON kalshi_fills(kalshi_trade_id);

-- RLS policies for kalshi_fills
ALTER TABLE kalshi_fills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own fills"
  ON kalshi_fills FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own fills"
  ON kalshi_fills FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- KALSHI MARKET ANALYTICS TABLE
-- Stores AI-generated analysis and recommendations for markets
-- ============================================================================

CREATE TABLE IF NOT EXISTS kalshi_market_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Market reference
  market_ticker TEXT NOT NULL,

  -- AI Analysis
  model_probability DECIMAL(5,4), -- 0.0000 to 1.0000
  market_probability DECIMAL(5,4), -- Implied from price
  edge DECIMAL(5,4), -- Difference between model and market

  -- Recommendation
  confidence_score INTEGER CHECK (confidence_score >= 0 AND confidence_score <= 100),
  recommendation TEXT, -- 'strong_yes', 'yes', 'no', 'strong_no', 'hold', 'avoid'

  -- Analysis details
  reasoning TEXT,
  key_factors JSONB, -- Structured data about factors
  supporting_stats JSONB, -- Related stats used in analysis

  -- Kelly Criterion (for position sizing)
  kelly_fraction DECIMAL(5,4),
  suggested_stake_pct DECIMAL(5,4),

  -- Expected value
  expected_value DECIMAL(10,4),

  -- Metadata
  analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE, -- When analysis becomes stale
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for kalshi_market_analytics
CREATE INDEX IF NOT EXISTS idx_kalshi_analytics_ticker ON kalshi_market_analytics(market_ticker, analyzed_at DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_analytics_recommendation ON kalshi_market_analytics(recommendation);
CREATE INDEX IF NOT EXISTS idx_kalshi_analytics_edge ON kalshi_market_analytics(edge DESC);
CREATE INDEX IF NOT EXISTS idx_kalshi_analytics_expires ON kalshi_market_analytics(expires_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate unrealized P&L for positions
CREATE OR REPLACE FUNCTION calculate_kalshi_position_pnl()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate current value
  NEW.current_value := NEW.quantity * NEW.current_price / 100.0;

  -- Calculate unrealized P&L
  NEW.unrealized_pnl := NEW.current_value - NEW.total_cost;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-calculate P&L on position updates
CREATE TRIGGER trigger_calculate_kalshi_pnl
  BEFORE INSERT OR UPDATE ON kalshi_positions
  FOR EACH ROW
  EXECUTE FUNCTION calculate_kalshi_position_pnl();

-- Function to update last_updated timestamp
CREATE OR REPLACE FUNCTION update_kalshi_updated_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updating timestamps
CREATE TRIGGER trigger_kalshi_positions_updated
  BEFORE UPDATE ON kalshi_positions
  FOR EACH ROW
  EXECUTE FUNCTION update_kalshi_updated_timestamp();

CREATE TRIGGER trigger_kalshi_markets_updated
  BEFORE UPDATE ON kalshi_markets
  FOR EACH ROW
  EXECUTE FUNCTION update_kalshi_updated_timestamp();

CREATE TRIGGER trigger_kalshi_orders_updated
  BEFORE UPDATE ON kalshi_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_kalshi_updated_timestamp();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE kalshi_markets IS 'Prediction markets data from Kalshi API';
COMMENT ON TABLE kalshi_positions IS 'User positions on Kalshi markets';
COMMENT ON TABLE kalshi_orders IS 'User order history on Kalshi';
COMMENT ON TABLE kalshi_fills IS 'Individual trade executions on Kalshi';
COMMENT ON TABLE kalshi_market_analytics IS 'AI-generated market analysis and recommendations';

COMMENT ON COLUMN kalshi_markets.ticker IS 'Unique market identifier (e.g., KXNBA-24-LAL-BOS-10-25)';
COMMENT ON COLUMN kalshi_markets.yes_bid IS 'Current bid price for YES side (in cents, 0-100)';
COMMENT ON COLUMN kalshi_markets.yes_ask IS 'Current ask price for YES side (in cents, 0-100)';
COMMENT ON COLUMN kalshi_positions.unrealized_pnl IS 'Current profit/loss on open position';
COMMENT ON COLUMN kalshi_market_analytics.edge IS 'Difference between model probability and market price';
COMMENT ON COLUMN kalshi_market_analytics.kelly_fraction IS 'Optimal bet size using Kelly Criterion';
