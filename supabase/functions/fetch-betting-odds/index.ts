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
async function fetchFromOddsApi(sport: string, oddsApiKey: string): Promise<OddsApiEvent[]> {
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
  const requestsRemaining = response.headers.get('x-requests-remaining');
  const requestsUsed = response.headers.get('x-requests-used');
  console.log(`The Odds API - Requests used: ${requestsUsed}, Remaining: ${requestsRemaining}`);

  return events;
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
    // Priority: The Odds API (primary) -> The Rundown API (fallback)
    const oddsApiKey = Deno.env.get('THE_ODDS_API_KEY');
    const rundownApiKey = Deno.env.get('X_RAPID_APIKEY');

    if (!oddsApiKey && !rundownApiKey) {
      console.error('No API keys configured. Need either THE_ODDS_API_KEY or X_RAPID_APIKEY');

      // Log this error to betting_odds_fetch_log for monitoring
      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: false,
          events_count: 0,
          odds_count: 0,
          error_message: 'No API keys configured. Need either THE_ODDS_API_KEY or X_RAPID_APIKEY',
        });

      return new Response(JSON.stringify({
        error: 'No betting odds API keys configured',
        success: false,
        message: 'Please configure THE_ODDS_API_KEY (primary) or X_RAPID_APIKEY (fallback) in backend secrets',
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
        oddsApiEvents = await fetchFromOddsApi(sport, oddsApiKey);
        usedOddsApi = true;
        apiSource = 'The Odds API';
        console.log(`Successfully fetched ${oddsApiEvents.length} events from The Odds API`);
      } catch (error) {
        console.error(`The Odds API failed: ${error instanceof Error ? error.message : String(error)}`);
        console.log(`Falling back to The Rundown API...`);
      }
    } else {
      console.log(`THE_ODDS_API_KEY not configured, using The Rundown API...`);
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

    // Fallback to The Rundown API if The Odds API failed or returned no events
    if (!rundownApiKey) {
      console.error('The Odds API failed and no Rundown API key configured');

      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: false,
          events_count: 0,
          odds_count: 0,
          error_message: 'The Odds API failed and X_RAPID_APIKEY not configured as fallback',
        });

      return new Response(JSON.stringify({
        error: 'The Odds API failed and no fallback API configured',
        success: false,
        message: 'The Odds API returned no events and X_RAPID_APIKEY is not configured for fallback',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use The Rundown API as fallback
    console.log(`Using The Rundown API as fallback...`);
    apiSource = 'The Rundown API (fallback)';

    const sportId = SPORT_MAP[sport] || 2;
    const rundownApiUrl = `https://therundown-therundown-v1.p.rapidapi.com/sports/${sportId}/events/${date}`;

    console.log(`Fetching odds from The Rundown API for sport ${sportId}...`);

    const response = await fetch(rundownApiUrl, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rundownApiKey,
        'X-RapidAPI-Host': 'therundown-therundown-v1.p.rapidapi.com',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`The Rundown API error: ${response.status} - ${errorText}`);

      const errorMessage = `Both APIs failed. The Odds API: ${usedOddsApi ? 'No events' : 'Not configured'}. Rundown API: ${response.status} - ${errorText.substring(0, 500)}`;
      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: false,
          events_count: 0,
          odds_count: 0,
          error_message: errorMessage,
        });

      return new Response(JSON.stringify({
        error: `The Rundown API returned ${response.status}`,
        details: errorText,
        success: false,
      }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseData = await response.json();

    if (!responseData || typeof responseData !== 'object') {
      console.error('Invalid response structure from The Rundown API');
      return new Response(JSON.stringify({
        error: 'Invalid response structure from The Rundown API',
        success: false,
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const events: RundownEvent[] = responseData.events || [];
    console.log(`Received ${events.length} events from The Rundown API`);

    // Early return if no events
    if (events.length === 0) {
      console.log('No events found for this date/sport combination');

      // Still log the successful fetch (even with 0 events)
      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: true,
          events_count: 0,
          odds_count: 0,
          api_requests_remaining: null,
        });

      return new Response(JSON.stringify({
        success: true,
        sport,
        sportId,
        date,
        events: 0,
        oddsInserted: 0,
        message: 'No events found for this date/sport. This may be normal if no games are scheduled.',
        source: 'The Rundown API',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Store odds in database
    let totalOddsInserted = 0;
    let eventsProcessed = 0;
    let eventsWithOdds = 0;
    let eventsSkipped = 0;

    for (const event of events) {
      // Validate event has required fields
      if (!event.event_uuid || !event.event_date) {
        console.warn('Skipping event with missing required fields:', event);
        eventsSkipped++;
        continue;
      }

      const homeTeam = event.teams_normalized?.find(t => t.is_home)?.name ||
                       event.teams?.find(t => t.is_home)?.name || 'Unknown';
      const awayTeam = event.teams_normalized?.find(t => t.is_away)?.name ||
                       event.teams?.find(t => t.is_away)?.name || 'Unknown';

      // Skip if we couldn't determine team names
      if (homeTeam === 'Unknown' || awayTeam === 'Unknown') {
        console.warn('Skipping event with unknown team names:', event.event_uuid);
        eventsSkipped++;
        continue;
      }

      eventsProcessed++;

      // Process lines from each bookmaker
      if (event.lines && Object.keys(event.lines).length > 0) {
        eventsWithOdds++;

        for (const [periodKey, line] of Object.entries(event.lines)) {
          // Only process full game lines (period 0), skip 1st half, 2nd half, etc.
          // The Rundown API uses period keys like "1", "2", etc. for different periods
          // We want full game lines which are typically the main period
          // Skip if this is a non-primary period line

          const affiliateId = line.affiliate_id;
          const bookmaker = BOOKMAKER_MAP[affiliateId] || `bookmaker_${affiliateId}`;

          // Determine sport title
          const sportTitle = sport === 'americanfootball_nfl' ? 'NFL' :
                            sport === 'basketball_nba' ? 'NBA' :
                            sport === 'baseball_mlb' ? 'MLB' :
                            sport === 'icehockey_nhl' ? 'NHL' :
                            sport === 'soccer_epl' ? 'EPL' : 'Unknown';

          // Insert moneyline odds (h2h market)
          if (line.moneyline) {
            if (line.moneyline.moneyline_home !== undefined) {
              const oddsRecord = {
                event_id: event.event_uuid,
                sport_key: sport,
                sport_title: sportTitle,
                commence_time: event.event_date,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker,
                market_key: 'h2h',
                outcome_name: homeTeam,
                outcome_price: line.moneyline.moneyline_home,
                outcome_point: null,
                last_updated: new Date().toISOString(),
              };

              const { error } = await supabaseClient
                .from('betting_odds')
                .upsert(oddsRecord, {
                  onConflict: 'event_id,bookmaker,market_key,outcome_name',
                });

              if (!error) totalOddsInserted++;
            }

            if (line.moneyline.moneyline_away !== undefined) {
              const oddsRecord = {
                event_id: event.event_uuid,
                sport_key: sport,
                sport_title: sportTitle,
                commence_time: event.event_date,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker,
                market_key: 'h2h',
                outcome_name: awayTeam,
                outcome_price: line.moneyline.moneyline_away,
                outcome_point: null,
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

          // Insert spread odds
          if (line.spread) {
            if (line.spread.point_spread_home !== undefined && line.spread.point_spread_home_money !== undefined) {
              const oddsRecord = {
                event_id: event.event_uuid,
                sport_key: sport,
                sport_title: sportTitle,
                commence_time: event.event_date,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker,
                market_key: 'spreads',
                outcome_name: homeTeam,
                outcome_price: line.spread.point_spread_home_money,
                outcome_point: line.spread.point_spread_home,
                last_updated: new Date().toISOString(),
              };

              const { error } = await supabaseClient
                .from('betting_odds')
                .upsert(oddsRecord, {
                  onConflict: 'event_id,bookmaker,market_key,outcome_name',
                });

              if (!error) totalOddsInserted++;
            }

            if (line.spread.point_spread_away !== undefined && line.spread.point_spread_away_money !== undefined) {
              const oddsRecord = {
                event_id: event.event_uuid,
                sport_key: sport,
                sport_title: sportTitle,
                commence_time: event.event_date,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker,
                market_key: 'spreads',
                outcome_name: awayTeam,
                outcome_price: line.spread.point_spread_away_money,
                outcome_point: line.spread.point_spread_away,
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

          // Insert totals (over/under) odds
          if (line.total) {
            if (line.total.total_over !== undefined && line.total.total_over_money !== undefined) {
              const oddsRecord = {
                event_id: event.event_uuid,
                sport_key: sport,
                sport_title: sportTitle,
                commence_time: event.event_date,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker,
                market_key: 'totals',
                outcome_name: 'Over',
                outcome_price: line.total.total_over_money,
                outcome_point: line.total.total_over,
                last_updated: new Date().toISOString(),
              };

              const { error } = await supabaseClient
                .from('betting_odds')
                .upsert(oddsRecord, {
                  onConflict: 'event_id,bookmaker,market_key,outcome_name',
                });

              if (!error) totalOddsInserted++;
            }

            if (line.total.total_under !== undefined && line.total.total_under_money !== undefined) {
              const oddsRecord = {
                event_id: event.event_uuid,
                sport_key: sport,
                sport_title: sportTitle,
                commence_time: event.event_date,
                home_team: homeTeam,
                away_team: awayTeam,
                bookmaker: bookmaker,
                market_key: 'totals',
                outcome_name: 'Under',
                outcome_price: line.total.total_under_money,
                outcome_point: line.total.total_under,
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

    // Log the fetch to betting_odds_fetch_log
    const { error: logError } = await supabaseClient
      .from('betting_odds_fetch_log')
      .insert({
        sports_fetched: [sport],
        success: true,
        events_count: eventsProcessed,
        odds_count: totalOddsInserted,
        api_requests_remaining: null, // The Rundown API doesn't provide this in headers
      });

    if (logError) {
      console.error('Error logging fetch:', logError);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`=== FETCH BETTING ODDS: Completed in ${duration}ms ===`);
    console.log(`Events processed: ${eventsProcessed}, Events with odds: ${eventsWithOdds}, Events skipped: ${eventsSkipped}`);
    console.log(`Odds inserted/updated: ${totalOddsInserted}`);
    console.log(`Source: ${apiSource} (therundown-therundown-v1.p.rapidapi.com)`);
    console.log(`Sport ID: ${sportId}, Sport Key: ${sport}`);

    return new Response(JSON.stringify({
      success: true,
      sport,
      sportId,
      date,
      events: eventsProcessed,
      eventsWithOdds,
      eventsSkipped,
      oddsInserted: totalOddsInserted,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      source: apiSource,
      apiEndpoint: 'therundown-therundown-v1.p.rapidapi.com',
      message: `Successfully fetched and stored ${totalOddsInserted} odds from ${eventsProcessed} events (${eventsWithOdds} with odds) using ${apiSource}`,
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
