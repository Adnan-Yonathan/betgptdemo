import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OddsOutcome {
  name: string;
  price: number;
  point?: number;
}

interface OddsBookmaker {
  key: string;
  title: string;
  markets: Array<{
    key: string;
    outcomes: OddsOutcome[];
  }>;
}

interface OddsEvent {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: OddsBookmaker[];
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body to get sport (default to NFL)
    const { sport = 'americanfootball_nfl', regions = 'us', markets = 'h2h,spreads,totals' } = 
      await req.json().catch(() => ({ 
        sport: 'americanfootball_nfl', 
        regions: 'us', 
        markets: 'h2h,spreads,totals' 
      }));
    
    // Fetch data from The Odds API
    const oddsUrl = `https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${oddsApiKey}&regions=${regions}&markets=${markets}&oddsFormat=american`;
    console.log(`Fetching odds from: ${oddsUrl.replace(oddsApiKey, 'HIDDEN')}`);
    
    const response = await fetch(oddsUrl);
    
    if (!response.ok) {
      throw new Error(`The Odds API error: ${response.status} - ${await response.text()}`);
    }

    const events: OddsEvent[] = await response.json();
    console.log(`Found ${events.length} events with odds`);

    // Process and store each event's odds with line movement tracking
    const results = [];
    let lineMovementsTracked = 0;

    for (const event of events) {
      for (const bookmaker of event.bookmakers) {
        for (const market of bookmaker.markets) {
          for (const outcome of market.outcomes) {
            // Check for existing odds to track line movement
            const { data: existingOdds } = await supabase
              .from('betting_odds')
              .select('outcome_price, outcome_point, last_updated')
              .eq('event_id', event.id)
              .eq('bookmaker', bookmaker.title)
              .eq('market_key', market.key)
              .eq('outcome_name', outcome.name)
              .single();

            // Track line movement if odds changed significantly (>= 5 points for American odds)
            if (existingOdds &&
                (Math.abs(existingOdds.outcome_price - outcome.price) >= 5 ||
                 (outcome.point && existingOdds.outcome_point &&
                  Math.abs(existingOdds.outcome_point - outcome.point) >= 0.5))) {

              // Insert line movement record
              const { error: movementError } = await supabase
                .from('line_movements')
                .insert({
                  event_id: event.id,
                  sport_key: event.sport_key,
                  bookmaker: bookmaker.title,
                  market_key: market.key,
                  outcome_name: outcome.name,
                  odds: existingOdds.outcome_price,
                  point: existingOdds.outcome_point,
                  timestamp: existingOdds.last_updated,
                });

              if (!movementError) {
                lineMovementsTracked++;
                console.log(`Line movement detected: ${event.home_team} vs ${event.away_team} - ${outcome.name} ${market.key} moved from ${existingOdds.outcome_price} to ${outcome.price}`);
              }
            }

            const oddsData = {
              event_id: event.id,
              sport_key: event.sport_key,
              sport_title: event.sport_title,
              commence_time: new Date(event.commence_time).toISOString(),
              home_team: event.home_team,
              away_team: event.away_team,
              bookmaker: bookmaker.title,
              market_key: market.key,
              outcome_name: outcome.name,
              outcome_price: outcome.price,
              outcome_point: outcome.point || null,
              last_updated: new Date().toISOString(),
            };

            // Upsert the odds (update if exists, insert if new)
            const { data: upsertData, error } = await supabase
              .from('betting_odds')
              .upsert(oddsData, {
                onConflict: 'event_id,bookmaker,market_key,outcome_name',
                ignoreDuplicates: false
              })
              .select()
              .single();

            if (error) {
              console.error('Error upserting odds:', error);
            } else {
              results.push(upsertData);
            }
          }
        }
      }
    }

    console.log(`Tracked ${lineMovementsTracked} line movements`);

    console.log(`Successfully processed ${results.length} odds entries`);

    // Get remaining requests info from response headers
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        events: events.length,
        line_movements_tracked: lineMovementsTracked,
        api_requests_remaining: remainingRequests,
        api_requests_used: usedRequests
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error fetching betting odds:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
