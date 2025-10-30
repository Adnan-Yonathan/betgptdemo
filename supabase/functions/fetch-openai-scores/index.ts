import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RundownTeam {
  name: string;
  mascot?: string;
  abbreviation?: string;
  is_home: boolean;
  is_away: boolean;
}

interface RundownEvent {
  event_id: string;
  event_uuid: string;
  event_date: string;
  sport_id: number;
  teams_normalized?: RundownTeam[];
  teams?: RundownTeam[];
  score?: {
    event_status: string;
    event_status_detail?: string;
    score_home?: number;
    score_away?: number;
  };
}

interface RundownBoxScoreTeam {
  team_id: number;
  is_home: boolean;
  statistics?: Record<string, unknown>;
}

interface RundownBoxScorePlayer {
  player_id: number;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team_id?: number;
  position?: string;
  starter?: boolean;
  statistics?: Record<string, unknown>;
}

interface LeagueConfig {
  league: string;
  sport: string;
  sportId: number;
}

const RUNDOWN_HOST = 'therundown-therundown-v1.p.rapidapi.com';
const BASE_URL = `https://${RUNDOWN_HOST}`;

const LEAGUE_CONFIG_MAP: Record<string, LeagueConfig> = {
  'NFL': { league: 'NFL', sport: 'football', sportId: 2 },
  'NCAAF': { league: 'NCAAF', sport: 'football', sportId: 9 },
  'NBA': { league: 'NBA', sport: 'basketball', sportId: 4 },
  'MLB': { league: 'MLB', sport: 'baseball', sportId: 3 },
  'NHL': { league: 'NHL', sport: 'hockey', sportId: 1 },
  'WNBA': { league: 'WNBA', sport: 'basketball', sportId: 12 },
  'MLS': { league: 'MLS', sport: 'soccer', sportId: 10 },
};

function normalizeTeamName(team?: RundownTeam): string {
  if (!team) return '';
  return team.name || team.mascot || team.abbreviation || '';
}

function resolveTeams(event: RundownEvent): { home: string; away: string } {
  const teams = event.teams_normalized || event.teams || [];
  const homeTeam = teams.find(team => team.is_home);
  const awayTeam = teams.find(team => team.is_away);

  return {
    home: normalizeTeamName(homeTeam) || 'Home Team',
    away: normalizeTeamName(awayTeam) || 'Away Team',
  };
}

function extractAdvancedStats(
  teams: RundownBoxScoreTeam[] | undefined,
  players: RundownBoxScorePlayer[] | undefined,
  teamMap: Map<number, string>
): Record<string, unknown> | null {
  const advanced: Record<string, unknown> = {};

  if (teams && teams.length > 0) {
    advanced.team_statistics = teams.map(team => ({
      team: teamMap.get(team.team_id) || team.team_id,
      statistics: team.statistics || {},
    }));
  }

  if (players && players.length > 0) {
    advanced.player_statistics = players.map(player => ({
      player: player.full_name || `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim(),
      team: player.team_id ? teamMap.get(player.team_id) || player.team_id : undefined,
      position: player.position,
      starter: player.starter,
      statistics: player.statistics || {},
    }));
  }

  return Object.keys(advanced).length > 0 ? advanced : null;
}

async function fetchRundownEvents(
  sportId: number,
  rundownApiKey: string,
  targetDate: string
): Promise<RundownEvent[]> {
  const url = `${BASE_URL}/sports/${sportId}/events/${targetDate}`;
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': rundownApiKey,
      'X-RapidAPI-Host': RUNDOWN_HOST,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`The Rundown API returned ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.events || [];
}

async function fetchRundownBoxScore(
  eventId: string,
  rundownApiKey: string
): Promise<{ teams?: RundownBoxScoreTeam[]; players?: RundownBoxScorePlayer[] }> {
  if (!eventId) {
    throw new Error('Missing eventId for Rundown boxscore request');
  }
  const url = `${BASE_URL}/events/${eventId}/boxscore`;
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': rundownApiKey,
      'X-RapidAPI-Host': RUNDOWN_HOST,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`The Rundown boxscore error ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    teams: data.team_stats || data.teams,
    players: data.player_stats || data.players,
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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

    // Parse request body to get league and query details
    const { league = 'NFL', query = '' } = await req.json().catch(() => ({
      league: 'NFL',
      query: ''
    }));

    const normalizedLeague = league.toUpperCase();
    const leagueConfig = LEAGUE_CONFIG_MAP[normalizedLeague] || LEAGUE_CONFIG_MAP['NFL'];

    const targetDate = new Date().toISOString().split('T')[0];
    console.log(`Fetching Rundown scores for ${leagueConfig.league} on ${targetDate}`);

    const events = await fetchRundownEvents(leagueConfig.sportId, rundownApiKey, targetDate);

    // Optionally filter events by query context if provided
    const filteredEvents = query
      ? events.filter(event => {
          const { home, away } = resolveTeams(event);
          const combined = `${home} ${away}`.toLowerCase();
          return combined.includes(query.toLowerCase());
        })
      : events;

    console.log(`Processing ${filteredEvents.length} events for ${leagueConfig.league}`);

    const processedResults = [];
    for (const event of filteredEvents) {
      try {
        const { home, away } = resolveTeams(event);
        const score = event.score || {};

        const teamMap = new Map<number, string>();
        const teams = event.teams_normalized || event.teams || [];
        teams.forEach(team => {
          if (typeof team.team_id === 'number') {
            teamMap.set(team.team_id, normalizeTeamName(team));
          }
        });

        let advancedStats: Record<string, unknown> | null = null;
        try {
          const boxScore = await fetchRundownBoxScore(event.event_id || event.event_uuid, rundownApiKey);
          advancedStats = extractAdvancedStats(boxScore.teams, boxScore.players, teamMap);
        } catch (boxScoreError) {
          console.warn(`Unable to fetch boxscore for ${event.event_id}:`, boxScoreError);
        }

        const scoreData = {
          event_id: event.event_uuid || event.event_id,
          sport: leagueConfig.sport,
          league: leagueConfig.league,
          home_team: home,
          away_team: away,
          home_score: score.score_home ?? 0,
          away_score: score.score_away ?? 0,
          game_status: score.event_status || 'STATUS_SCHEDULED',
          game_date: event.event_date,
          last_updated: new Date().toISOString(),
          advanced_stats: advancedStats,
        };

        const { data: upsertData, error } = await supabase
          .from('sports_scores')
          .upsert(scoreData, { onConflict: 'event_id' })
          .select()
          .single();

        if (error) {
          console.error('Error upserting score:', error);
        } else if (upsertData) {
          processedResults.push(upsertData);
        }
      } catch (eventError) {
        console.error(`Error processing event ${event.event_id}:`, eventError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        count: processedResults.length,
        scores: processedResults,
        source: 'The Rundown API',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error fetching sports scores from The Rundown API:', error);
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
