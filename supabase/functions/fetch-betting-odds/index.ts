import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The Odds API interfaces
interface OddsApiOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsApiMarket {
  key: string;
  last_update: string;
  outcomes: OddsApiOutcome[];
}

interface OddsApiBookmaker {
  key: string;
  title: string;
  last_update: string;
  markets: OddsApiMarket[];
}

interface OddsApiEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsApiBookmaker[];
}

// The Rundown API interfaces (fallback)
interface RundownLine {
  affiliate_id: number;
  moneyline?: {
    moneyline_away?: number;
    moneyline_home?: number;
    moneyline_draw?: number;
  };
  spread?: {
    point_spread_away?: number;
    point_spread_home?: number;
    point_spread_away_money?: number;
    point_spread_home_money?: number;
  };
  total?: {
    total_over?: number;
    total_under?: number;
    total_over_money?: number;
    total_under_money?: number;
  };
}

interface RundownEvent {
  event_id: string;
  event_uuid: string;
  sport_id: number;
  event_date: string;
  score?: {
    event_status: string;
    winner_away: number;
    winner_home: number;
    score_away: number;
    score_home: number;
  };
  teams: Array<{
    team_id: number;
    team_normalized_id: number;
    name: string;
    is_away: boolean;
    is_home: boolean;
  }>;
  teams_normalized: Array<{
    team_id: number;
    name: string;
    mascot: string;
    abbreviation: string;
    is_away: boolean;
    is_home: boolean;
  }>;
  lines?: {
    [key: string]: RundownLine;
  };
}

// Bookmaker ID mapping (The Rundown affiliate IDs to names)
const BOOKMAKER_MAP: { [key: number]: string } = {
  1: '5dimes',
  2: 'bovada',
  3: 'pinnacle',
  4: 'betmgm',
  5: 'draftkings',
  6: 'fanduel',
  7: 'pointsbet',
  8: 'betonline',
  9: 'sportsbetting',
  10: 'unibet',
  11: 'matchbook',
  12: 'lowvig',
  13: 'intertops',
  14: 'youwager',
  15: 'bodog',
};

// Sport ID mapping for The Rundown API (fallback)
const SPORT_MAP: { [key: string]: number } = {
  'americanfootball_nfl': 2,
  'basketball_nba': 4,
  'baseball_mlb': 3,
  'icehockey_nhl': 1,
  'soccer_epl': 6,
};

// The Odds API uses the sport key directly (no mapping needed)
// Supported sports: americanfootball_nfl, basketball_nba, baseball_mlb, icehockey_nhl, soccer_epl, etc.

/**
 * Fetch odds from The Odds API (primary source)
 */
async function fetchFromOddsApi(
  sport: string,
  oddsApiKey: string
): Promise<{ events: OddsApiEvent[]; requestsRemaining: number | null; requestsUsed: number | null }> {
  const regions = 'us'; // Focus on US bookmakers
  const markets = 'h2h,spreads,totals'; // Moneyline, spreads, and totals
  const oddsFormat = 'american'; // American odds format (+150, -110, etc.)

  const url = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?` +
    `apiKey=${oddsApiKey}&regions=${regions}&markets=${markets}&oddsFormat=${oddsFormat}`;

  console.log(`Fetching odds from The Odds API for sport: ${sport}`);

  const response = await fetch(url);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`The Odds API error: ${response.status} - ${errorText}`);
  }

  const events: OddsApiEvent[] = await response.json();

  // Check remaining requests from headers
  const requestsRemainingHeader = response.headers.get('x-requests-remaining');
  const requestsUsedHeader = response.headers.get('x-requests-used');
  console.log(
    `The Odds API - Requests used: ${requestsUsedHeader ?? 'unknown'}, Remaining: ${requestsRemainingHeader ?? 'unknown'}`,
  );

  return {
    events,
    requestsRemaining: requestsRemainingHeader ? Number(requestsRemainingHeader) : null,
    requestsUsed: requestsUsedHeader ? Number(requestsUsedHeader) : null,
  };
}

/**
 * Store odds from The Odds API events in database
 */
async function storeOddsApiEvents(
  events: OddsApiEvent[],
  supabaseClient: any
): Promise<{ oddsInserted: number; eventsProcessed: number; eventsWithOdds: number }> {
  let totalOddsInserted = 0;
  let eventsProcessed = 0;
  let eventsWithOdds = 0;

  for (const event of events) {
    eventsProcessed++;

    if (event.bookmakers && event.bookmakers.length > 0) {
      eventsWithOdds++;

      // Process each bookmaker
      for (const bookmaker of event.bookmakers) {
        // Process each market (h2h, spreads, totals)
        for (const market of bookmaker.markets) {
          // Process each outcome in the market
          for (const outcome of market.outcomes) {
            const oddsRecord = {
              event_id: event.id,
              sport_key: event.sport_key,
              sport_title: event.sport_title,
              commence_time: event.commence_time,
              home_team: event.home_team,
              away_team: event.away_team,
              bookmaker: bookmaker.key,
              market_key: market.key,
              outcome_name: outcome.name,
              outcome_price: outcome.price,
              outcome_point: outcome.point || null,
              last_updated: new Date().toISOString(),
            };

            const { error } = await supabaseClient
              .from('betting_odds')
              .upsert(oddsRecord, {
                onConflict: 'event_id,bookmaker,market_key,outcome_name',
              });

            if (!error) totalOddsInserted++;
          }
        }
      }
    }
  }

  return { oddsInserted: totalOddsInserted, eventsProcessed, eventsWithOdds };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Parse request body
    const {
      sport = 'americanfootball_nfl',
      date = new Date().toISOString().split('T')[0], // Default to today
    } = await req.json().catch(() => ({}));

    console.log(`=== FETCH BETTING ODDS: ${sport} for ${date} ===`);
    const startTime = Date.now();

    // Get API keys from environment
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY');

    if (!oddsApiKey) {
      console.error('No API key configured. Need THE_ODDS_API_KEY');

      // Log this error to betting_odds_fetch_log for monitoring
      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: false,
          events_count: 0,
          odds_count: 0,
          error_message: 'THE_ODDS_API_KEY not configured',
        });

      return new Response(JSON.stringify({
        error: 'No betting odds API key configured',
        success: false,
        message: 'Please configure THE_ODDS_API_KEY in backend secrets',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try The Odds API first (primary source)
    let oddsApiEvents: OddsApiEvent[] = [];
    let usedOddsApi = false;
    let apiSource = '';
    let apiRequestsRemaining: number | null = null;

    if (oddsApiKey) {
      try {
        console.log(`Attempting to fetch from The Odds API (primary source)...`);
        const oddsApiResult = await fetchFromOddsApi(sport, oddsApiKey);
        oddsApiEvents = oddsApiResult.events;
        apiRequestsRemaining = oddsApiResult.requestsRemaining;
        usedOddsApi = true;
        apiSource = 'The Odds API';
        console.log(`Successfully fetched ${oddsApiEvents.length} events from The Odds API`);
      } catch (error) {
        console.error(`The Odds API failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // If The Odds API succeeded, process those events
    if (usedOddsApi && oddsApiEvents.length > 0) {
      const { oddsInserted, eventsProcessed, eventsWithOdds } =
        await storeOddsApiEvents(oddsApiEvents, supabaseClient);

      // Log the successful fetch
      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: true,
          events_count: eventsProcessed,
          odds_count: oddsInserted,
          api_requests_remaining: apiRequestsRemaining,
        });

      const endTime = Date.now();
      const duration = endTime - startTime;

      console.log(`=== FETCH BETTING ODDS: Completed in ${duration}ms ===`);
      console.log(`Events processed: ${eventsProcessed}, Events with odds: ${eventsWithOdds}`);
      console.log(`Odds inserted/updated: ${oddsInserted}`);
      console.log(`Source: The Odds API (api.the-odds-api.com)`);

      return new Response(JSON.stringify({
        success: true,
        sport,
        date,
        events: eventsProcessed,
        eventsWithOdds,
        oddsInserted,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        source: 'The Odds API',
        apiEndpoint: 'api.the-odds-api.com',
        message: `Successfully fetched and stored ${oddsInserted} odds from ${eventsProcessed} events using The Odds API`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If we got here, The Odds API returned no events
    console.error('The Odds API returned no events');

    await supabaseClient
      .from('betting_odds_fetch_log')
      .insert({
        sports_fetched: [sport],
        success: true,
        events_count: 0,
        odds_count: 0,
        error_message: 'The Odds API returned no events for this sport/date',
      });

    return new Response(JSON.stringify({
      success: true,
      sport,
      date,
      events: 0,
      oddsInserted: 0,
      message: 'No events found for this date/sport. This may be normal if no games are scheduled.',
      source: 'The Odds API',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in fetch-betting-odds function:', error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false,
      timestamp: new Date().toISOString(),
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
