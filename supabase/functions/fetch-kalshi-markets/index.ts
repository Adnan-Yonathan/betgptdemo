import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const KALSHI_EMAIL = Deno.env.get('KALSHI_EMAIL');
const KALSHI_PASSWORD = Deno.env.get('KALSHI_PASSWORD');
const BASE_URL = 'https://trading-api.kalshi.com/trade-api/v2';

// Token management (in-memory for this Edge Function instance)
let authToken: string | null = null;
let tokenExpiry: number | null = null;
const TOKEN_EXPIRY_DURATION = 30 * 60 * 1000; // 30 minutes
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 minutes before expiry

// ============================================================================
// AUTHENTICATION
// ============================================================================

async function getAuthToken(): Promise<string> {
  const now = Date.now();

  // If token exists and is still valid
  if (authToken && tokenExpiry && tokenExpiry > now + TOKEN_REFRESH_BUFFER) {
    return authToken;
  }

  // Need to login
  console.log('[KALSHI] Logging in...');

  if (!KALSHI_EMAIL || !KALSHI_PASSWORD) {
    throw new Error('Kalshi credentials not found in environment');
  }

  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email: KALSHI_EMAIL,
      password: KALSHI_PASSWORD,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kalshi login failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  if (!data.token) {
    throw new Error('Kalshi login response missing token');
  }

  authToken = data.token;
  tokenExpiry = Date.now() + TOKEN_EXPIRY_DURATION;

  console.log('[KALSHI] Login successful');

  return data.token;
}

// ============================================================================
// API CLIENT
// ============================================================================

async function kalshiFetch(endpoint: string, params: Record<string, any> = {}) {
  const token = await getAuthToken();

  const url = new URL(`${BASE_URL}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  console.log(`[KALSHI] Fetching: ${endpoint}`);

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kalshi API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

// ============================================================================
// DATA STORAGE
// ============================================================================

async function storeMarkets(supabase: any, markets: any[]): Promise<number> {
  if (!markets || markets.length === 0) {
    return 0;
  }

  let storedCount = 0;

  for (const market of markets) {
    // Extract sport key from ticker or series_ticker
    let sportKey = null;
    const ticker = market.ticker || '';
    const seriesTicker = market.series_ticker || '';

    if (ticker.includes('NBA') || seriesTicker.includes('NBA')) sportKey = 'NBA';
    else if (ticker.includes('NFL') || seriesTicker.includes('NFL')) sportKey = 'NFL';
    else if (ticker.includes('MLB') || seriesTicker.includes('MLB')) sportKey = 'MLB';
    else if (ticker.includes('NHL') || seriesTicker.includes('NHL')) sportKey = 'NHL';

    const marketData = {
      ticker: market.ticker,
      event_ticker: market.event_ticker,
      series_ticker: market.series_ticker,
      title: market.title,
      subtitle: market.subtitle,
      market_type: market.market_type || 'binary',

      // Status
      status: market.status || 'open',
      close_time: market.close_time,
      expiration_time: market.expiration_time,
      expected_expiration_time: market.expected_expiration_time,

      // Pricing
      yes_bid: market.yes_bid,
      yes_ask: market.yes_ask,
      no_bid: market.no_bid,
      no_ask: market.no_ask,
      last_price: market.last_price,
      previous_yes_bid: market.previous_yes_bid,
      previous_yes_ask: market.previous_yes_ask,

      // Volume & liquidity
      volume: market.volume || 0,
      volume_24h: market.volume_24h || 0,
      open_interest: market.open_interest || 0,
      liquidity: market.liquidity || 0,

      // Strike information
      strike_type: market.strike_type,
      floor_strike: market.floor_strike,
      cap_strike: market.cap_strike,
      can_close_early: market.can_close_early || false,

      // Rules
      rules_primary: market.rules_primary,
      rules_secondary: market.rules_secondary,

      // Categories
      category: market.category,
      tags: market.tags,

      // Sports metadata
      sport_key: sportKey,

      // Timestamps
      last_updated: new Date().toISOString(),
    };

    try {
      const { error } = await supabase
        .from('kalshi_markets')
        .upsert(marketData, {
          onConflict: 'ticker',
        });

      if (error) {
        console.error(`Error storing market ${market.ticker}:`, error);
      } else {
        storedCount++;
      }
    } catch (error) {
      console.error(`Exception storing market ${market.ticker}:`, error);
    }
  }

  return storedCount;
}

// ============================================================================
// MARKET FETCHING
// ============================================================================

async function fetchSportsMarkets(): Promise<any[]> {
  const allMarkets: any[] = [];
  const sportsKeywords = ['NBA', 'NFL', 'MLB', 'NHL'];

  try {
    // Fetch open markets (with pagination support)
    let cursor: string | undefined = undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = 10; // Prevent infinite loops

    while (hasMore && pageCount < maxPages) {
      const params: Record<string, any> = {
        status: 'open',
        limit: 200,
      };

      if (cursor) {
        params.cursor = cursor;
      }

      const response = await kalshiFetch('/markets', params);

      if (response.markets && response.markets.length > 0) {
        allMarkets.push(...response.markets);
        console.log(`[KALSHI] Fetched ${response.markets.length} markets (page ${pageCount + 1})`);
      }

      // Check if there's more data
      cursor = response.cursor;
      hasMore = !!cursor;
      pageCount++;
    }

    // Filter for sports markets
    const sportsMarkets = allMarkets.filter(market => {
      const ticker = market.ticker || '';
      const seriesTicker = market.series_ticker || '';
      const title = market.title || '';
      const category = market.category || '';

      return sportsKeywords.some(sport =>
        ticker.includes(sport) ||
        seriesTicker.includes(sport) ||
        title.includes(sport) ||
        category.toLowerCase().includes(sport.toLowerCase())
      );
    });

    console.log(`[KALSHI] Found ${sportsMarkets.length} sports markets out of ${allMarkets.length} total`);

    return sportsMarkets;

  } catch (error) {
    console.error('[KALSHI] Error fetching markets:', error);
    throw error;
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request parameters
    const { sport, status = 'open', limit = 200 } = await req.json().catch(() => ({}));

    console.log(`[KALSHI] Fetching markets - sport: ${sport || 'all'}, status: ${status}`);

    // Fetch sports markets
    const markets = await fetchSportsMarkets();

    // Filter by sport if specified
    let filteredMarkets = markets;
    if (sport) {
      filteredMarkets = markets.filter(m =>
        m.ticker?.includes(sport) ||
        m.series_ticker?.includes(sport) ||
        m.title?.includes(sport)
      );
    }

    // Store in database
    const storedCount = await storeMarkets(supabase, filteredMarkets);

    console.log(`[KALSHI] Stored ${storedCount} markets in database`);

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        total_markets: markets.length,
        filtered_markets: filteredMarkets.length,
        stored_count: storedCount,
        sports_breakdown: {
          NBA: markets.filter(m => m.ticker?.includes('NBA') || m.series_ticker?.includes('NBA')).length,
          NFL: markets.filter(m => m.ticker?.includes('NFL') || m.series_ticker?.includes('NFL')).length,
          MLB: markets.filter(m => m.ticker?.includes('MLB') || m.series_ticker?.includes('MLB')).length,
          NHL: markets.filter(m => m.ticker?.includes('NHL') || m.series_ticker?.includes('NHL')).length,
        },
        sample_markets: filteredMarkets.slice(0, 5).map(m => ({
          ticker: m.ticker,
          title: m.title,
          yes_ask: m.yes_ask,
          no_ask: m.no_ask,
          volume: m.volume,
        })),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[KALSHI] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
