// Phase 5: Live Bet Tracking
// Background job that runs every 60 seconds to:
// 1. Fetch live scores from The Rundown API
// 2. Update bet tracking with current game state
// 3. Check alert conditions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BALLDONTLIE_API = Deno.env.get('BALLDONTLIE_API') || Deno.env.get('BALL_DONT_LIE_API') || '';
const BASE_URL = 'https://api.balldontlie.io/v1';

interface LiveScore {
  event_id: string;
  event_date: string;
  sport_id: number;
  home_team: string;
  away_team: string;
  score: {
    event_status: string; // 'STATUS_SCHEDULED' | 'STATUS_IN_PROGRESS' | 'STATUS_FINAL'
    event_status_detail: string; // 'Q1' | 'Q2' | 'Halftime' | 'Final'
    score_home: number;
    score_away: number;
    venue_name?: string;
    venue_location?: string;
    game_clock?: string; // '5:24'
    display_clock?: string; // '5:24 - 1st'
  };
  teams?: Array<{
    team_id: number;
    name: string;
    is_home: boolean;
    is_away: boolean;
  }>;
}

interface LiveScoresResponse {
  events: LiveScore[];
}

// Map league names to Ball Don't Lie API (NBA only)
const sportIdMap: Record<string, number> = {
  'NBA': 4,     // Basketball - supported by Ball Don't Lie
};

// Map game status from API to our format
function mapGameStatus(apiStatus: string): string {
  if (apiStatus === 'STATUS_SCHEDULED') return 'scheduled';
  if (apiStatus === 'STATUS_IN_PROGRESS') return 'in_progress';
  if (apiStatus === 'STATUS_FINAL') return 'final';
  if (apiStatus.includes('HALFTIME')) return 'halftime';
  return 'scheduled';
}

// Fetch live NBA scores using Ball Don't Lie API
async function fetchLiveScores(league: string): Promise<LiveScore[]> {
  const sportId = sportIdMap[league];
  if (!sportId) {
    console.error(`League not supported by Ball Don't Lie: ${league}`);
    return [];
  }

  // Ball Don't Lie only supports NBA
  if (league !== 'NBA') {
    console.log(`Ball Don't Lie only supports NBA, skipping ${league}`);
    return [];
  }

  if (!BALLDONTLIE_API) {
    console.error('BALLDONTLIE_API key not configured');
    return [];
  }

  try {
    // Fetch today's NBA games
    const today = new Date().toISOString().split('T')[0];
    const url = `${BASE_URL}/games?dates[]=${today}&per_page=100`;

    const response = await fetch(url, {
      headers: {
        'Authorization': BALLDONTLIE_API,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch live scores for ${league}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const games = data.data || [];

    // Convert Ball Don't Lie format to our LiveScore format
    return games.map((game: any) => ({
      event_id: String(game.id),
      event_date: game.date,
      sport_id: 4, // NBA
      home_team: game.home_team?.full_name || game.home_team?.name || 'Home Team',
      away_team: game.visitor_team?.full_name || game.visitor_team?.name || 'Away Team',
      score: {
        event_status: game.status?.includes('Final') || game.status === 'F' ? 'STATUS_FINAL' :
                      game.status?.includes('In Progress') || game.status === 'Live' ? 'STATUS_IN_PROGRESS' :
                      'STATUS_SCHEDULED',
        event_status_detail: game.status || 'Scheduled',
        score_home: game.home_team_score ?? 0,
        score_away: game.visitor_team_score ?? 0,
        game_clock: game.time || '',
      },
    }));
  } catch (error) {
    console.error(`Error fetching live scores for ${league}:`, error);
    return [];
  }
}

// Update live score cache in database
async function updateLiveScoreCache(supabase: any, score: LiveScore, league: string) {
  const { event_id, home_team, away_team, event_date, score: gameScore, sport_id } = score;

  const gameStatus = mapGameStatus(gameScore.event_status);
  const period = gameScore.event_status_detail || '';
  const timeRemaining = gameScore.game_clock || gameScore.display_clock || '';
  
  // Map sport_id to sport name
  const sportName = Object.keys(sportIdMap).find(key => sportIdMap[key] === sport_id) || league;

  await supabase
    .from('live_score_cache')
    .upsert({
      game_id: event_id,
      league,
      sport: sportName,
      home_team,
      away_team,
      home_score: gameScore.score_home || 0,
      away_score: gameScore.score_away || 0,
      period,
      time_remaining: timeRemaining,
      game_status: gameStatus,
      game_date: event_date,
      api_last_updated: new Date().toISOString(),
      api_response: score,
      last_updated: new Date().toISOString(),
    }, {
      onConflict: 'game_id',
    });
}

// Get all active bets that need tracking
async function getActiveTracking(supabase: any) {
  const { data, error } = await supabase
    .from('live_bet_tracking')
    .select('*')
    .eq('is_active', true)
    .in('game_status', ['scheduled', 'in_progress', 'halftime']);

  if (error) {
    console.error('Error fetching active tracking:', error);
    return [];
  }

  return data || [];
}

// Main monitoring function
async function monitorLiveBets() {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Starting live bet monitoring (Ball Don\'t Lie API - NBA only)...');

  // Get all active tracking records
  const activeTracking = await getActiveTracking(supabase);
  console.log(`Found ${activeTracking.length} active bets to track`);

  // Always fetch live scores for NBA (Ball Don't Lie only supports NBA)
  const allLeagues = ['NBA'];
  console.log(`Fetching live scores for NBA from Ball Don't Lie API`);

  // Fetch live scores for each league
  const allScores: LiveScore[] = [];
  for (const league of allLeagues) {
    const scores = await fetchLiveScores(league as string);
    allScores.push(...scores);
    console.log(`Fetched ${scores.length} live scores for ${league}`);
  }

  // Update live score cache
  for (const score of allScores) {
    const league = allLeagues.find(l => {
      const sportId = sportIdMap[l as string];
      return sportId === score.sport_id;
    });

    if (league) {
      await updateLiveScoreCache(supabase, score, league as string);
    }
  }

  console.log(`Updated ${allScores.length} live scores in cache`);

  // Update bet tracking from scores
  let updatedCount = 0;
  let alertsCreated = 0;

  for (const tracking of activeTracking) {
    try {
      // Update bet tracking from live scores
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_bet_tracking_from_scores', {
          p_bet_id: tracking.bet_id,
        });

      if (updateError) {
        console.error(`Error updating tracking for bet ${tracking.bet_id}:`, updateError);
        continue;
      }

      if (updateResult?.success) {
        updatedCount++;
      }

      // Check alert conditions
      const { data: alertResult, error: alertError } = await supabase
        .rpc('check_all_alerts_for_bet', {
          p_tracking_id: tracking.id,
        });

      if (alertError) {
        console.error(`Error checking alerts for tracking ${tracking.id}:`, alertError);
        continue;
      }

      if (alertResult?.alerts_created) {
        const createdCount = Object.keys(alertResult.alerts_created).length;
        alertsCreated += createdCount;

        if (createdCount > 0) {
          console.log(`Created ${createdCount} alerts for bet ${tracking.bet_id}`);
        }
      }
    } catch (error) {
      console.error(`Error processing tracking ${tracking.id}:`, error);
    }
  }

  console.log(`Live bet monitoring complete: ${updatedCount} bets updated, ${alertsCreated} alerts created`);

  return {
    success: true,
    activeTracking: activeTracking.length,
    updatedBets: updatedCount,
    alertsCreated,
    liveScoresFetched: allScores.length,
  };
}

serve(async (req) => {
  try {
    const result = await monitorLiveBets();

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in monitor-live-bets:', error);

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
