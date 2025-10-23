import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Sport configuration mapping
const SPORT_CONFIG = {
  nfl: { espnPath: 'football/nfl', sport: 'football', league: 'NFL' },
  ncaaf: { espnPath: 'football/college-football', sport: 'football', league: 'NCAAF' },
  nba: { espnPath: 'basketball/nba', sport: 'basketball', league: 'NBA' },
  wnba: { espnPath: 'basketball/wnba', sport: 'basketball', league: 'WNBA' },
  mlb: { espnPath: 'baseball/mlb', sport: 'baseball', league: 'MLB' },
  nhl: { espnPath: 'hockey/nhl', sport: 'hockey', league: 'NHL' },
  mls: { espnPath: 'soccer/usa.1', sport: 'soccer', league: 'MLS' },
  ncaamb: { espnPath: 'basketball/mens-college-basketball', sport: 'basketball', league: 'NCAAMB' },
};

interface ESPNCompetitor {
  id: string;
  team: {
    id: string;
    displayName: string;
    abbreviation?: string;
    logo?: string;
  };
  score: string;
  homeAway: string;
  records?: Array<{
    type: string;
    summary: string;
  }>;
  winner?: boolean;
}

interface ESPNVenue {
  fullName?: string;
  address?: {
    city?: string;
    state?: string;
  };
}

interface ESPNBroadcast {
  names?: string[];
}

interface ESPNCompetition {
  id: string;
  date: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
    };
  };
  competitors: ESPNCompetitor[];
  venue?: ESPNVenue;
  broadcasts?: ESPNBroadcast[];
  notes?: Array<{ headline?: string }>;
}

interface ESPNEvent {
  id: string;
  name: string;
  shortName: string;
  competitions: ESPNCompetition[];
}

interface ESPNResponse {
  events: ESPNEvent[];
}

/**
 * Fetch scores and schedules from ESPN API for a specific sport
 */
async function fetchSportData(
  supabase: any,
  sportKey: string,
  config: typeof SPORT_CONFIG[keyof typeof SPORT_CONFIG]
) {
  const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.espnPath}/scoreboard`;
  console.log(`[${config.league}] Fetching from: ${espnUrl}`);

  try {
    const response = await fetch(espnUrl);

    if (!response.ok) {
      console.error(`[${config.league}] ESPN API error: ${response.status}`);
      return { success: false, count: 0, error: `HTTP ${response.status}` };
    }

    const data: ESPNResponse = await response.json();
    const events = data.events || [];

    console.log(`[${config.league}] Found ${events.length} events`);

    // Process and store each game
    const results = [];
    for (const event of events) {
      const competition = event.competitions[0];
      if (!competition) continue;

      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      if (!homeTeam || !awayTeam) continue;

      // Extract team records (W-L)
      const homeRecord = homeTeam.records?.find(r => r.type === 'total')?.summary || '';
      const awayRecord = awayTeam.records?.find(r => r.type === 'total')?.summary || '';

      // Extract venue information
      const venue = competition.venue?.fullName || null;
      const venueCity = competition.venue?.address?.city || null;
      const venueState = competition.venue?.address?.state || null;

      // Extract broadcast information
      const broadcast = competition.broadcasts?.[0]?.names?.join(', ') || null;

      // Extract any game notes
      const notes = competition.notes?.map(n => n.headline).filter(Boolean).join('; ') || null;

      const scoreData = {
        event_id: `espn_${competition.id}`,
        sport: config.sport,
        league: config.league,
        home_team: homeTeam.team.displayName,
        away_team: awayTeam.team.displayName,
        home_score: parseInt(homeTeam.score) || 0,
        away_score: parseInt(awayTeam.score) || 0,
        game_status: competition.status.type.name,
        game_date: new Date(competition.date).toISOString(),
        last_updated: new Date().toISOString(),
        advanced_stats: {
          home_record: homeRecord,
          away_record: awayRecord,
          venue: venue,
          venue_city: venueCity,
          venue_state: venueState,
          broadcast: broadcast,
          notes: notes,
          status_detail: competition.status.type.description,
          home_winner: homeTeam.winner || false,
          away_winner: awayTeam.winner || false,
        },
      };

      // Upsert the score (update if exists, insert if new)
      const { data: upsertData, error } = await supabase
        .from('sports_scores')
        .upsert(scoreData, { onConflict: 'event_id' })
        .select()
        .single();

      if (error) {
        console.error(`[${config.league}] Error upserting score:`, error);
      } else {
        results.push(upsertData);
      }
    }

    console.log(`[${config.league}] Successfully processed ${results.length} games`);

    return {
      success: true,
      league: config.league,
      count: results.length,
      scores: results,
    };
  } catch (error) {
    console.error(`[${config.league}] Error:`, error);
    return {
      success: false,
      league: config.league,
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main handler - supports fetching single sport or all sports
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const { sport, sports } = await req.json().catch(() => ({}));

    let sportsToFetch: string[] = [];

    if (sport) {
      // Single sport mode
      sportsToFetch = [sport];
    } else if (sports && Array.isArray(sports)) {
      // Multiple sports mode
      sportsToFetch = sports;
    } else {
      // Default: fetch all active sports
      sportsToFetch = ['nfl', 'nba', 'mlb', 'nhl', 'ncaaf', 'wnba', 'mls'];
    }

    console.log(`Fetching data for sports: ${sportsToFetch.join(', ')}`);

    // Fetch data for all requested sports
    const results = await Promise.all(
      sportsToFetch.map(async (sportKey) => {
        const config = SPORT_CONFIG[sportKey as keyof typeof SPORT_CONFIG];
        if (!config) {
          console.warn(`Unknown sport: ${sportKey}`);
          return { success: false, league: sportKey, count: 0, error: 'Unknown sport' };
        }
        return fetchSportData(supabase, sportKey, config);
      })
    );

    // Aggregate results
    const totalCount = results.reduce((sum, r) => sum + r.count, 0);
    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        total_games: totalCount,
        sports_fetched: successCount,
        sports_total: sportsToFetch.length,
        results: results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in fetch-sports-scores:', error);
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
