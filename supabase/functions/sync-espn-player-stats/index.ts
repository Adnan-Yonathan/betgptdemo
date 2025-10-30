import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNDOWN_HOST = 'therundown-therundown-v1.p.rapidapi.com';
const BASE_URL = `https://${RUNDOWN_HOST}`;

interface RundownTeam {
  team_id: number;
  name?: string;
  mascot?: string;
  abbreviation?: string;
  is_home: boolean;
  is_away: boolean;
}

interface RundownEvent {
  event_id: string;
  event_uuid: string;
  event_date: string;
  teams?: RundownTeam[];
  teams_normalized?: RundownTeam[];
  score?: {
    event_status: string;
    score_home?: number;
    score_away?: number;
  };
}

interface GameSummary {
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

async function fetchRundownSchedule(
  rundownApiKey: string,
  sportId: number,
  date: string
): Promise<GameSummary[]> {
  const url = `${BASE_URL}/sports/${sportId}/events/${date}`;
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': rundownApiKey,
      'X-RapidAPI-Host': RUNDOWN_HOST,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`The Rundown API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const events: RundownEvent[] = data.events || [];

  return events.map(event => {
    const teams = event.teams_normalized || event.teams || [];
    const home = teams.find(team => team.is_home);
    const away = teams.find(team => team.is_away);
    const score = event.score || {};

    const homeName = home?.name || home?.mascot || home?.abbreviation || 'Home Team';
    const awayName = away?.name || away?.mascot || away?.abbreviation || 'Away Team';

    return {
      id: event.event_id || event.event_uuid,
      date: event.event_date,
      name: `${awayName} @ ${homeName}`,
      shortName: `${awayName} @ ${homeName}`,
      status: score.event_status || 'STATUS_SCHEDULED',
      homeTeam: homeName,
      awayTeam: awayName,
      homeScore: score.score_home ?? 0,
      awayScore: score.score_away ?? 0,
    };
  });
}

async function fetchGameStats(
  supabaseUrl: string,
  eventId: string
): Promise<any> {
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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rundownApiKey = Deno.env.get('THE_RUNDOWN_API');

    if (!rundownApiKey) {
      throw new Error('THE_RUNDOWN_API key is not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      sync_completed_only = false,
      specific_event_ids = null,
      league = 'NBA',
    } = await req.json().catch(() => ({
      sync_completed_only: false,
      specific_event_ids: null,
      league: 'NBA',
    }));

    const leagueKey = league.toString().toUpperCase();
    const sportId = leagueKey === 'NBA' ? 4 : leagueKey === 'WNBA' ? 12 : 4;

    console.log(`Starting Rundown player stats sync for ${leagueKey}...`);

    let gamesToSync: GameSummary[] = [];

    if (specific_event_ids && Array.isArray(specific_event_ids)) {
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
      const targetDate = new Date().toISOString().split('T')[0];
      const schedule = await fetchRundownSchedule(rundownApiKey!, sportId, targetDate);
      console.log(`Found ${schedule.length} events on The Rundown schedule`);

      gamesToSync = sync_completed_only
        ? schedule.filter(game => game.status.toLowerCase().includes('final'))
        : schedule;
    }

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
    }

    console.log(`Sync complete: ${successCount} successful, ${failureCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        total_games: gamesToSync.length,
        successful_syncs: successCount,
        failed_syncs: failureCount,
        results,
        source: 'The Rundown API',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error syncing Rundown stats:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
