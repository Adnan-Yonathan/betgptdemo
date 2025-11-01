// Phase 5: Live Bet Tracking
// Background job that runs every 60 seconds to:
// 1. Fetch live scores from The Rundown API
// 2. Update bet tracking with current game state
// 3. Check alert conditions

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RUNDOWN_API_KEY = Deno.env.get('THE_RUNDOWN_API') || '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

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

// Map league names to sport IDs (must match The Rundown API sport IDs)
const sportIdMap: Record<string, number> = {
  'NBA': 4,     // Basketball
  'NFL': 2,     // American Football
  'NCAAF': 9,   // College Football (CFB)
  'MLB': 3,     // Baseball
  'NHL': 1,     // Ice Hockey
  'WNBA': 12,   // Women's Basketball
  'MLS': 10,    // Soccer
};

// Map game status from API to our format
function mapGameStatus(apiStatus: string): string {
  if (apiStatus === 'STATUS_SCHEDULED') return 'scheduled';
  if (apiStatus === 'STATUS_IN_PROGRESS') return 'in_progress';
  if (apiStatus === 'STATUS_FINAL') return 'final';
  if (apiStatus.includes('HALFTIME')) return 'halftime';
  return 'scheduled';
}

// Fetch live scores for a specific league
async function fetchLiveScores(league: string): Promise<LiveScore[]> {
  const sportId = sportIdMap[league];
  if (!sportId) {
    console.error(`Unknown league: ${league}`);
    return [];
  }

  try {
    const url = `https://therundown-therundown-v1.p.rapidapi.com/sports/${sportId}/events/live`;

    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': RUNDOWN_API_KEY,
        'X-RapidAPI-Host': 'therundown-therundown-v1.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch live scores for ${league}: ${response.statusText}`);
      return [];
    }

    const data: LiveScoresResponse = await response.json();
    return data.events || [];
  } catch (error) {
    console.error(`Error fetching live scores for ${league}:`, error);
    return [];
  }
}

// Update live score cache in database
async function updateLiveScoreCache(supabase: any, score: LiveScore, league: string) {
  const { event_id, home_team, away_team, event_date, score: gameScore } = score;

  const gameStatus = mapGameStatus(gameScore.event_status);
  const period = gameScore.event_status_detail || '';
  const timeRemaining = gameScore.game_clock || gameScore.display_clock || '';

  await supabase
    .from('live_score_cache')
    .upsert({
      game_id: event_id,
      league,
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
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  console.log('Starting live bet monitoring...');

  // Get all active tracking records
  const activeTracking = await getActiveTracking(supabase);
  console.log(`Found ${activeTracking.length} active bets to track`);

  // Always fetch live scores for ALL leagues, not just those with active bets
  // This ensures the live score ticker always has data to display
  const allLeagues = Object.keys(sportIdMap);
  console.log(`Fetching live scores for all leagues: ${allLeagues.join(', ')}`);

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
