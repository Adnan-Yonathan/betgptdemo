import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ESPNGame {
  id: string;
  date: string;
  name: string;
  shortName: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Fetches today's NBA games from ESPN scoreboard
 */
async function fetchESPNScoreboard(): Promise<ESPNGame[]> {
  const scoreboard_url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';

  const response = await fetch(scoreboard_url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ESPN Scoreboard API error: ${response.status}`);
  }

  const data = await response.json();
  const games: ESPNGame[] = [];

  if (data.events) {
    data.events.forEach((event: any) => {
      const competition = event.competitions?.[0];
      const competitors = competition?.competitors || [];

      let homeTeam = '';
      let awayTeam = '';
      let homeScore = 0;
      let awayScore = 0;

      competitors.forEach((team: any) => {
        if (team.homeAway === 'home') {
          homeTeam = team.team?.displayName || team.team?.name || '';
          homeScore = parseInt(team.score) || 0;
        } else {
          awayTeam = team.team?.displayName || team.team?.name || '';
          awayScore = parseInt(team.score) || 0;
        }
      });

      games.push({
        id: event.id,
        date: event.date,
        name: event.name,
        shortName: event.shortName,
        status: competition?.status?.type?.description || 'Unknown',
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
      });
    });
  }

  return games;
}

/**
 * Fetches player stats for a specific game
 */
async function fetchGameStats(supabaseUrl: string, eventId: string): Promise<any> {
  const fetchStatsUrl = `${supabaseUrl}/functions/v1/fetch-espn-stats`;

  const response = await fetch(fetchStatsUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      event_id: eventId,
      store_data: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Error fetching stats for event ${eventId}:`, errorText);
    return null;
  }

  return await response.json();
}

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
    const {
      sync_completed_only = false,
      specific_event_ids = null
    } = await req.json().catch(() => ({}));

    console.log('Starting ESPN player stats sync...');

    let gamesToSync: ESPNGame[] = [];

    // If specific event IDs provided, use those
    if (specific_event_ids && Array.isArray(specific_event_ids)) {
      console.log(`Syncing specific events: ${specific_event_ids.join(', ')}`);
      gamesToSync = specific_event_ids.map(id => ({
        id,
        date: new Date().toISOString(),
        name: `Event ${id}`,
        shortName: `Event ${id}`,
        status: 'Unknown',
        homeTeam: '',
        awayTeam: '',
        homeScore: 0,
        awayScore: 0,
      }));
    } else {
      // Fetch today's games from scoreboard
      const allGames = await fetchESPNScoreboard();
      console.log(`Found ${allGames.length} games on ESPN scoreboard`);

      // Filter games based on sync_completed_only flag
      if (sync_completed_only) {
        gamesToSync = allGames.filter(game =>
          game.status.toLowerCase().includes('final') ||
          game.status.toLowerCase().includes('completed')
        );
        console.log(`Filtered to ${gamesToSync.length} completed games`);
      } else {
        gamesToSync = allGames;
      }
    }

    // Sync stats for each game
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    for (const game of gamesToSync) {
      console.log(`Syncing stats for ${game.name} (${game.id})...`);

      try {
        const statsResult = await fetchGameStats(supabaseUrl, game.id);

        if (statsResult && statsResult.success) {
          successCount++;
          results.push({
            event_id: game.id,
            game: game.name,
            status: game.status,
            success: true,
            players_synced: statsResult.stored_count,
          });
        } else {
          failureCount++;
          results.push({
            event_id: game.id,
            game: game.name,
            status: game.status,
            success: false,
            error: 'Failed to fetch stats',
          });
        }
      } catch (error) {
        failureCount++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({
          event_id: game.id,
          game: game.name,
          status: game.status,
          success: false,
          error: errorMessage,
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`Sync complete: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_games: gamesToSync.length,
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
    console.error('Error syncing ESPN player stats:', error);
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
