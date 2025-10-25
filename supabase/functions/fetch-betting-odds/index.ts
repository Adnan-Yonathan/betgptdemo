import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Bookmaker {
  key: string;
  title: string;
  markets: Market[];
}

interface Market {
  key: string;
  outcomes: Outcome[];
}

interface Outcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: Bookmaker[];
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
      regions = 'us',
      markets = 'h2h,spreads,totals',
    } = await req.json().catch(() => ({}));

    console.log(`=== FETCH BETTING ODDS: ${sport} ===`);
    const startTime = Date.now();

    // Get The Odds API key from environment
    const oddsApiKey = Deno.env.get('ODDS_API_KEY');

    if (!oddsApiKey) {
      console.error('ODDS_API_KEY not configured');
      return new Response(JSON.stringify({
        error: 'ODDS_API_KEY not configured',
        success: false,
        message: 'Please configure ODDS_API_KEY in Supabase Edge Function secrets',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build The Odds API URL
    const oddsApiUrl = new URL(`https://api.the-odds-api.com/v4/sports/${sport}/odds/`);
    oddsApiUrl.searchParams.set('apiKey', oddsApiKey);
    oddsApiUrl.searchParams.set('regions', regions);
    oddsApiUrl.searchParams.set('markets', markets);
    oddsApiUrl.searchParams.set('oddsFormat', 'american');

    console.log(`Fetching odds from The Odds API...`);

    // Fetch odds from The Odds API
    const response = await fetch(oddsApiUrl.toString());

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`The Odds API error: ${response.status} - ${errorText}`);
      return new Response(JSON.stringify({
        error: `The Odds API returned ${response.status}`,
        details: errorText,
        success: false,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check remaining requests from headers
    const requestsRemaining = response.headers.get('x-requests-remaining');
    const requestsUsed = response.headers.get('x-requests-used');

    console.log(`API Requests: ${requestsUsed} used, ${requestsRemaining} remaining`);

    const oddsData: OddsEvent[] = await response.json();
    console.log(`Received ${oddsData.length} events from The Odds API`);

    // Store odds in database
    let totalOddsInserted = 0;
    let eventsProcessed = 0;

    for (const event of oddsData) {
      eventsProcessed++;

      // Process each bookmaker's odds
      for (const bookmaker of event.bookmakers) {
        for (const market of bookmaker.markets) {
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

            if (error) {
              console.error(`Error inserting odds for ${event.id}:`, error);
            } else {
              totalOddsInserted++;
            }
          }
        }
      }
    }

    // Log the fetch to betting_odds_fetch_log
    const { error: logError } = await supabaseClient
      .from('betting_odds_fetch_log')
      .insert({
        sports_fetched: [sport],
        success: true,
        events_count: eventsProcessed,
        odds_count: totalOddsInserted,
        api_requests_remaining: requestsRemaining ? parseInt(requestsRemaining) : null,
      });

    if (logError) {
      console.error('Error logging fetch:', logError);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`=== FETCH BETTING ODDS: Completed in ${duration}ms ===`);
    console.log(`Events: ${eventsProcessed}, Odds inserted: ${totalOddsInserted}`);

    return new Response(JSON.stringify({
      success: true,
      sport,
      events: eventsProcessed,
      oddsInserted: totalOddsInserted,
      apiRequestsRemaining: requestsRemaining ? parseInt(requestsRemaining) : null,
      apiRequestsUsed: requestsUsed ? parseInt(requestsUsed) : null,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      message: `Successfully fetched and stored ${totalOddsInserted} odds from ${eventsProcessed} events`,
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
