/**
 * Kalshi API Client
 *
 * Provides TypeScript client for interacting with Kalshi's prediction market API.
 * Handles authentication, market data, orders, and portfolio management.
 *
 * Authentication: Uses email/password to get JWT token that expires every 30 minutes.
 * Auto-refreshes tokens before expiration.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  series_ticker?: string;
  title: string;
  subtitle?: string;
  market_type: 'binary' | 'scalar';

  // Status
  status: 'open' | 'closed' | 'settled' | 'finalized';
  close_time: string;
  expiration_time: string;
  expected_expiration_time?: string;

  // Pricing
  yes_bid?: number;
  yes_ask?: number;
  no_bid?: number;
  no_ask?: number;
  last_price?: number;
  previous_yes_bid?: number;
  previous_yes_ask?: number;

  // Volume & liquidity
  volume?: number;
  volume_24h?: number;
  open_interest?: number;
  liquidity?: number;

  // Market details
  strike_type?: string;
  floor_strike?: number;
  cap_strike?: number;
  can_close_early?: boolean;

  // Rules
  rules_primary?: string;
  rules_secondary?: string;

  // Categories
  category?: string;
  tags?: string[];
  sport_key?: string;
}

export interface KalshiEvent {
  event_ticker: string;
  series_ticker: string;
  title: string;
  sub_title?: string;
  category: string;
  strike_date?: string;
  mutually_exclusive?: boolean;
  markets?: KalshiMarket[];
}

export interface KalshiPosition {
  ticker: string;
  market_ticker: string;
  position: number;
  total_cost: number;
  fees_paid?: number;
  realized_pnl?: number;
  resting_order_count?: number;
}

export interface KalshiOrder {
  order_id: string;
  user_id: string;
  ticker: string;

  // Order details
  action: 'buy' | 'sell';
  side: 'yes' | 'no';
  type: 'limit' | 'market';

  // Quantity and pricing
  yes_price?: number;
  no_price?: number;
  count: number;
  remaining_count?: number;

  // Status
  status: 'pending' | 'resting' | 'canceled' | 'executed';

  // Execution
  place_count?: number;
  decrease_count?: number;
  expiration_ts?: number;

  // Timestamps
  created_time: string;
  last_update_time?: string;
}

export interface KalshiFill {
  trade_id: string;
  order_id: string;
  ticker: string;
  side: 'yes' | 'no';
  action: 'buy' | 'sell';
  count: number;
  yes_price: number;
  no_price: number;
  created_time: string;
  trade_type?: string;
}

export interface KalshiBalance {
  balance: number;
  payout: number;
}

interface KalshiLoginResponse {
  token: string;
  member_id: string;
}

interface KalshiMarketsResponse {
  markets: KalshiMarket[];
  cursor?: string;
}

interface KalshiEventsResponse {
  events: KalshiEvent[];
  cursor?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2';
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry
const TOKEN_EXPIRY_DURATION = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// TOKEN MANAGEMENT
// ============================================================================

let authToken: string | null = null;
let tokenExpiry: number | null = null;
let refreshPromise: Promise<string> | null = null;

/**
 * Get current auth token, refreshing if necessary
 */
async function getAuthToken(): Promise<string> {
  const now = Date.now();

  // If token exists and is still valid
  if (authToken && tokenExpiry && tokenExpiry > now + TOKEN_REFRESH_BUFFER) {
    return authToken;
  }

  // If already refreshing, wait for that promise
  if (refreshPromise) {
    return refreshPromise;
  }

  // Start new refresh
  refreshPromise = login();

  try {
    const token = await refreshPromise;
    return token;
  } finally {
    refreshPromise = null;
  }
}

/**
 * Login to Kalshi and get JWT token
 * 
 * ⚠️ IMPORTANT: This function should ONLY be called from edge functions (server-side).
 * Frontend code should NEVER call Kalshi API directly for security reasons.
 * Always use supabase.functions.invoke() to call edge functions instead.
 */
async function login(): Promise<string> {
  // ⚠️ Security: Credentials are stored as Supabase secrets, not frontend env vars
  // This function is designed for edge function use only
  throw new Error(
    'Direct Kalshi API calls from frontend are not supported. ' +
    'Use edge functions instead: supabase.functions.invoke("fetch-kalshi-markets")'
  );
}

/**
 * Clear authentication token (force re-login)
 */
export function clearAuthToken(): void {
  authToken = null;
  tokenExpiry = null;
  refreshPromise = null;
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface FetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  params?: Record<string, any>;
  requireAuth?: boolean;
  retries?: number;
}

/**
 * Make authenticated request to Kalshi API
 */
async function kalshiFetch<T>(
  endpoint: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    method = 'GET',
    body,
    params = {},
    requireAuth = true,
    retries = 10,
  } = options;

  // Build URL with query parameters
  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  // Build headers
  const headers: Record<string, string> = {
    'Accept': 'application/json',
  };

  if (requireAuth) {
    const token = await getAuthToken();
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    headers['Content-Type'] = 'application/json';
  }

  // Make request with retry logic
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      console.log(`[KALSHI] ${method} ${endpoint} (attempt ${attempt + 1}/${retries})`);

      const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      // Handle 401 Unauthorized - token might be expired
      if (response.status === 401 && requireAuth && attempt === 0) {
        console.log('[KALSHI] Token expired, refreshing...');
        clearAuthToken();
        continue; // Retry with fresh token
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
        console.log(`[KALSHI] Rate limited, waiting ${retryAfter}s...`);
        await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Kalshi API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data as T;

    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`[KALSHI] Request failed (attempt ${attempt + 1}):`, lastError.message);

      // Wait before retry (exponential backoff)
      if (attempt < retries - 1) {
        const delay = Math.pow(2, attempt) * 500; // 0.5s, 1s, 2s, 4s, etc.
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('Kalshi request failed after retries');
}

// ============================================================================
// MARKET DATA API
// ============================================================================

export interface GetMarketsParams {
  limit?: number;
  cursor?: string;
  event_ticker?: string;
  series_ticker?: string;
  status?: 'open' | 'closed' | 'settled' | 'all';
  tickers?: string[];

  // Filtering
  max_close_ts?: number;
  min_close_ts?: number;

  // Sports filtering
  category?: string;
  tags?: string[];
}

/**
 * Get markets from Kalshi
 */
export async function getMarkets(params: GetMarketsParams = {}): Promise<KalshiMarket[]> {
  const response = await kalshiFetch<KalshiMarketsResponse>('/markets', {
    method: 'GET',
    params: {
      limit: params.limit || 500,
      cursor: params.cursor,
      event_ticker: params.event_ticker,
      series_ticker: params.series_ticker,
      status: params.status || 'open',
      tickers: params.tickers,
      max_close_ts: params.max_close_ts,
      min_close_ts: params.min_close_ts,
    },
  });

  return response.markets || [];
}

/**
 * Get a single market by ticker
 */
export async function getMarket(ticker: string): Promise<KalshiMarket> {
  const response = await kalshiFetch<{ market: KalshiMarket }>(`/markets/${ticker}`, {
    method: 'GET',
  });

  return response.market;
}

/**
 * Get events from Kalshi
 */
export async function getEvents(params: {
  limit?: number;
  cursor?: string;
  series_ticker?: string;
  status?: string;
} = {}): Promise<KalshiEvent[]> {
  const response = await kalshiFetch<KalshiEventsResponse>('/events', {
    method: 'GET',
    params,
  });

  return response.events || [];
}

/**
 * Get event by ticker
 */
export async function getEvent(eventTicker: string): Promise<KalshiEvent> {
  const response = await kalshiFetch<{ event: KalshiEvent }>(`/events/${eventTicker}`, {
    method: 'GET',
  });

  return response.event;
}

/**
 * Get sports markets (NBA, NFL, MLB, NHL)
 */
export async function getSportsMarkets(sport?: 'NBA' | 'NFL' | 'MLB' | 'NHL'): Promise<KalshiMarket[]> {
  const params: GetMarketsParams = {
    status: 'open',
    limit: 500,
  };

  // Filter by sport if specified
  if (sport) {
    // Kalshi uses series_ticker for sports, usually in format like "KXNBA-*"
    // We'll fetch all and filter client-side for now
    const markets = await getMarkets(params);
    return markets.filter(m =>
      m.series_ticker?.includes(sport) ||
      m.ticker.includes(sport) ||
      m.title.toLowerCase().includes(sport.toLowerCase())
    );
  }

  return getMarkets(params);
}

// ============================================================================
// PORTFOLIO API
// ============================================================================

/**
 * Get user's balance
 */
export async function getBalance(): Promise<KalshiBalance> {
  const response = await kalshiFetch<{ balance: KalshiBalance }>('/portfolio/balance', {
    method: 'GET',
  });

  return response.balance;
}

/**
 * Get user's positions
 */
export async function getPositions(params: {
  limit?: number;
  cursor?: string;
  ticker?: string;
  settlement_status?: string;
} = {}): Promise<KalshiPosition[]> {
  const response = await kalshiFetch<{ positions: KalshiPosition[] }>('/portfolio/positions', {
    method: 'GET',
    params,
  });

  return response.positions || [];
}

/**
 * Get user's fills (trade history)
 */
export async function getFills(params: {
  limit?: number;
  cursor?: string;
  ticker?: string;
  min_ts?: number;
  max_ts?: number;
} = {}): Promise<KalshiFill[]> {
  const response = await kalshiFetch<{ fills: KalshiFill[] }>('/portfolio/fills', {
    method: 'GET',
    params,
  });

  return response.fills || [];
}

// ============================================================================
// ORDER API
// ============================================================================

export interface CreateOrderParams {
  ticker: string;
  action: 'buy' | 'sell';
  side: 'yes' | 'no';
  count: number;
  type: 'limit' | 'market';
  yes_price?: number; // For limit orders
  no_price?: number; // For limit orders
  expiration_ts?: number;
}

/**
 * Create a new order
 */
export async function createOrder(params: CreateOrderParams): Promise<KalshiOrder> {
  const response = await kalshiFetch<{ order: KalshiOrder }>('/portfolio/orders', {
    method: 'POST',
    body: params,
  });

  return response.order;
}

/**
 * Get user's orders
 */
export async function getOrders(params: {
  limit?: number;
  cursor?: string;
  ticker?: string;
  status?: string;
} = {}): Promise<KalshiOrder[]> {
  const response = await kalshiFetch<{ orders: KalshiOrder[] }>('/portfolio/orders', {
    method: 'GET',
    params,
  });

  return response.orders || [];
}

/**
 * Cancel an order
 */
export async function cancelOrder(orderId: string): Promise<KalshiOrder> {
  const response = await kalshiFetch<{ order: KalshiOrder }>(`/portfolio/orders/${orderId}`, {
    method: 'DELETE',
  });

  return response.order;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate implied probability from price
 */
export function priceToImpliedProbability(price: number): number {
  return price / 100; // Kalshi prices are in cents (0-100)
}

/**
 * Calculate edge (difference between model probability and market price)
 */
export function calculateEdge(modelProbability: number, marketPrice: number): number {
  const impliedProbability = priceToImpliedProbability(marketPrice);
  return modelProbability - impliedProbability;
}

/**
 * Calculate potential profit for a position
 */
export function calculatePotentialProfit(
  contracts: number,
  entryPrice: number,
  side: 'yes' | 'no'
): { maxProfit: number; maxLoss: number; breakeven: number } {
  const costPerContract = side === 'yes' ? entryPrice : (100 - entryPrice);
  const totalCost = contracts * costPerContract;
  const maxProfit = (contracts * 100) - totalCost;
  const maxLoss = totalCost;
  const breakeven = entryPrice;

  return { maxProfit, maxLoss, breakeven };
}

/**
 * Format market title for display
 */
export function formatMarketTitle(market: KalshiMarket): string {
  return market.subtitle
    ? `${market.title} - ${market.subtitle}`
    : market.title;
}

/**
 * Check if market is about to close (within 1 hour)
 */
export function isMarketClosingSoon(market: KalshiMarket): boolean {
  const closeTime = new Date(market.close_time).getTime();
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;

  return closeTime - now < oneHour && closeTime > now;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const KalshiAPI = {
  // Authentication
  login,
  clearAuthToken,

  // Markets
  getMarkets,
  getMarket,
  getEvents,
  getEvent,
  getSportsMarkets,

  // Portfolio
  getBalance,
  getPositions,
  getFills,

  // Orders
  createOrder,
  getOrders,
  cancelOrder,

  // Helpers
  priceToImpliedProbability,
  calculateEdge,
  calculatePotentialProfit,
  formatMarketTitle,
  isMarketClosingSoon,
};

export default KalshiAPI;
