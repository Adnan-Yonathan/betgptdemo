import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// The Rundown API interfaces
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

// Sport ID mapping
const SPORT_MAP: { [key: string]: number } = {
  'americanfootball_nfl': 2,
  'basketball_nba': 4,
  'baseball_mlb': 3,
  'icehockey_nhl': 1,
  'soccer_epl': 6,
};

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

    // Get The Rundown API key from environment (RapidAPI format)
    const rundownApiKey = Deno.env.get('X_RAPID_APIKEY');

    if (!rundownApiKey) {
      console.error('X_RAPID_APIKEY key not configured');

      // Log this error to betting_odds_fetch_log for monitoring
      await supabaseClient
        .from('betting_odds_fetch_log')
        .insert({
          sports_fetched: [sport],
          success: false,
          events_count: 0,
          odds_count: 0,
          error_message: 'X_RAPID_APIKEY key not configured in environment variables',
        });

      return new Response(JSON.stringify({
        error: 'X_RAPID_APIKEY key not configured',
        success: false,
        message: 'Please configure X_RAPID_APIKEY in backend secrets',
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Map sport name to The Rundown sport ID
    const sportId = SPORT_MAP[sport] || 2; // Default to NFL if not found
    
    // Build The Rundown API URL
    const rundownApiUrl = `https://therundown-therundown-v1.p.rapidapi.com/sports/${sportId}/events/${date}`;
    
    console.log(`Fetching odds from The Rundown API for sport ${sportId}...`);

    // Fetch odds from The Rundown API
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

      // Log API errors for monitoring and debugging
      const errorMessage = `The Rundown API returned ${response.status}: ${errorText.substring(0, 500)}`;
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

    // Validate response structure
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
    console.log(`Source: The Rundown API (therundown-therundown-v1.p.rapidapi.com)`);
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
      source: 'The Rundown API',
      apiEndpoint: 'therundown-therundown-v1.p.rapidapi.com',
      message: `Successfully fetched and stored ${totalOddsInserted} odds from ${eventsProcessed} events (${eventsWithOdds} with odds) using The Rundown API`,
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
