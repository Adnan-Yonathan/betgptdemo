import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';
import { getYesterdayEST } from '../_shared/dateUtils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const BALLDONTLIE_API_KEY = Deno.env.get('BALLDONTLIE_API_KEY') || Deno.env.get('BALLDONTLIE_API');
const BASE_URL = 'https://api.balldontlie.io/v1';

// ============================================================================
// BALLDONTLIE API CLIENT
// ============================================================================

async function fetchFromBallDontLie(endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`${BASE_URL}${endpoint}`);

  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  console.log(`[BALLDONTLIE-SYNC] Fetching: ${endpoint}`);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': BALLDONTLIE_API_KEY!,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`BALLDONTLIE API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
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

    // Parse request body
    const { sync_date } = await req.json().catch(() => ({}));

    // Default to yesterday if no date provided (using Eastern Time zone)
    const targetDate = sync_date || getYesterdayEST();

    console.log(`[BALLDONTLIE-SYNC] Starting daily sync for ${targetDate}`);

    // Fetch games for the target date
    const gamesResponse = await fetchFromBallDontLie('/games', {
      dates: [targetDate],
      per_page: 250,
    });

    const games = gamesResponse.data || [];

    console.log(`[BALLDONTLIE-SYNC] Found ${games.length} games for ${targetDate}`);

    // Filter to completed games only
    const completedGames = games.filter((game: any) => {
      const status = game.status.toLowerCase();
      return status === 'final' || status === 'f' || status.includes('final');
    });

    console.log(`[BALLDONTLIE-SYNC] ${completedGames.length} completed games to sync`);

    // Sync each game
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const game of completedGames) {
      try {
        console.log(
          `[BALLDONTLIE-SYNC] Syncing game ${game.id}: ${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation}`
        );

        // Call fetch-balldontlie-stats edge function
        const { data: statsResult, error: statsError } = await supabase.functions.invoke(
          'fetch-balldontlie-stats',
          {
            body: {
              game_id: game.id,
              date: targetDate,
              store_data: true,
            },
          }
        );

        if (statsError) {
          throw statsError;
        }

        successCount++;
        results.push({
          game_id: game.id,
          game: `${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation}`,
          score: `${game.visitor_team_score}-${game.home_team_score}`,
          success: true,
          stats_count: statsResult.stats_count,
          stored_count: statsResult.stored_count,
        });

        // Rate limiting removed for faster syncing
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error(`[BALLDONTLIE-SYNC] Error syncing game ${game.id}:`, errorMessage);

        results.push({
          game_id: game.id,
          game: `${game.visitor_team.abbreviation} @ ${game.home_team.abbreviation}`,
          success: false,
          error: errorMessage,
        });
      }
    }

    console.log(
      `[BALLDONTLIE-SYNC] Sync complete: ${successCount} successful, ${failureCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        sync_date: targetDate,
        total_games: games.length,
        completed_games: completedGames.length,
        successful_syncs: successCount,
        failed_syncs: failureCount,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[BALLDONTLIE-SYNC] Fatal error:', error);
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

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
