import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RUNDOWN_HOST = 'therundown-therundown-v1.p.rapidapi.com';
const BASE_URL = `https://${RUNDOWN_HOST}`;

type JsonRecord = Record<string, unknown>;

interface LeagueConfig {
  league: string;
  sport: string;
  sportId: number;
}

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
}

interface RundownLineupPlayer {
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  jersey_number?: string;
  status?: string;
  is_starter?: boolean;
  injury_status?: string;
  injury_type?: string;
  impact?: string;
}

interface RundownLineupTeam {
  team_id: number;
  team_name?: string;
  is_home: boolean;
  confirmed?: boolean;
  last_updated?: string;
  players?: RundownLineupPlayer[];
}

interface RundownLineupResponse {
  event_id: string;
  lineups?: RundownLineupTeam[];
}

const LEAGUE_MAP: Record<string, LeagueConfig> = {
  'NFL': { league: 'NFL', sport: 'football', sportId: 2 },
  'NCAAF': { league: 'NCAAF', sport: 'football', sportId: 9 },
  'NBA': { league: 'NBA', sport: 'basketball', sportId: 4 },
  'MLB': { league: 'MLB', sport: 'baseball', sportId: 3 },
  'NHL': { league: 'NHL', sport: 'hockey', sportId: 1 },
};

function resolveTeamName(team?: RundownTeam): string {
  if (!team) return '';
  return team.name || team.mascot || team.abbreviation || '';
}

function normalizeLeague(league: string | null): LeagueConfig {
  if (!league) {
    return LEAGUE_MAP['NFL'];
  }

  const upper = league.toUpperCase();
  return LEAGUE_MAP[upper] || LEAGUE_MAP['NFL'];
}

async function fetchRundownEvents(
  sportId: number,
  rundownApiKey: string,
  date: string
): Promise<RundownEvent[]> {
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
  return data.events || [];
}

async function fetchRundownLineups(eventId: string, rundownApiKey: string): Promise<RundownLineupResponse> {
  if (!eventId) {
    throw new Error('event_id is required for lineup fetch');
  }

  const url = `${BASE_URL}/events/${eventId}/lineups`;
  const response = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': rundownApiKey,
      'X-RapidAPI-Host': RUNDOWN_HOST,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`The Rundown lineup error (${response.status}): ${errorText}`);
  }

  return await response.json();
}

function splitPlayers(players: RundownLineupPlayer[] | undefined) {
  const starters: JsonRecord[] = [];
  const bench: JsonRecord[] = [];
  const injured: JsonRecord[] = [];

  (players || []).forEach(player => {
    const name = player.full_name || `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim();
    const baseInfo: JsonRecord = {
      name,
      position: player.position || null,
      jersey_number: player.jersey_number || null,
      status: player.status || player.injury_status || null,
    };

    if (player.injury_status && player.injury_status.toLowerCase() !== 'active') {
      injured.push({
        ...baseInfo,
        injury_status: player.injury_status,
        injury_type: player.injury_type || null,
        impact_level: player.impact || null,
      });
      return;
    }

    if (player.is_starter) {
      starters.push(baseInfo);
    } else {
      bench.push(baseInfo);
    }
  });

  return { starters, bench, injured };
}

function calculateLineupQuality(starters: JsonRecord[], injured: JsonRecord[]): number {
  let quality = 100;

  // Penalize missing starters
  const expectedStarters = 5;
  if (starters.length < expectedStarters) {
    quality -= (expectedStarters - starters.length) * 8;
  }

  // Penalize injuries
  quality -= injured.length * 5;

  return Math.max(50, quality);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const rundownApiKey = Deno.env.get('X_RAPID_APIKEY') ?? Deno.env.get('THE_RUNDOWN_API');

    if (!rundownApiKey) {
      throw new Error('No betting odds API key configured (expected THE_RUNDOWN_API or X_RAPID_APIKEY)');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      league = 'NBA',
      team = null,
      event_id = null,
    } = await req.json().catch(() => ({
      league: 'NBA',
      team: null,
      event_id: null,
    }));

    const leagueConfig = normalizeLeague(league);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    const dates = [today, tomorrow].map(date => date.toISOString().split('T')[0]);

    const allEvents: RundownEvent[] = [];
    for (const date of dates) {
      try {
        const events = await fetchRundownEvents(leagueConfig.sportId, rundownApiKey, date);
        allEvents.push(...events);
      } catch (error) {
        console.error(`Error fetching events for ${date}:`, error);
      }
    }

    const teamFilter = (team ?? '').toString().toLowerCase();

    const relevantEvents = event_id
      ? allEvents.filter(event => event.event_id === event_id || event.event_uuid === event_id)
      : teamFilter
        ? allEvents.filter(event => {
            const teams = event.teams_normalized || event.teams || [];
            return teams.some(t => resolveTeamName(t).toLowerCase().includes(teamFilter));
          })
        : allEvents;

    const results = [];

    for (const event of relevantEvents) {
      const eventIdentifier = event.event_uuid || event.event_id;
      try {
        const lineupResponse = await fetchRundownLineups(eventIdentifier, rundownApiKey);
        const teams = event.teams_normalized || event.teams || [];
        const teamMap = new Map<number, RundownTeam>();
        teams.forEach(t => {
          if (typeof t.team_id === 'number') {
            teamMap.set(t.team_id, t);
          }
        });

        const opponentMap = new Map<number, string>();
        const homeTeam = teams.find(t => t.is_home);
        const awayTeam = teams.find(t => t.is_away);
        if (homeTeam && awayTeam) {
          opponentMap.set(homeTeam.team_id, resolveTeamName(awayTeam));
          opponentMap.set(awayTeam.team_id, resolveTeamName(homeTeam));
        }

        for (const lineup of lineupResponse.lineups || []) {
          const baseTeam = teamMap.get(lineup.team_id);
          const teamName = lineup.team_name || resolveTeamName(baseTeam) || `Team ${lineup.team_id}`;
          const opponentName = opponentMap.get(lineup.team_id) || '';

          const { starters, bench, injured } = splitPlayers(lineup.players);
          const quality = calculateLineupQuality(starters, injured);

          const lineupRecord = {
            event_id: eventIdentifier,
            sport: leagueConfig.sport,
            league: leagueConfig.league,
            team: teamName,
            opponent: opponentName,
            game_date: event.event_date,
            starters,
            bench,
            injured,
            lineup_quality_score: quality,
            data_quality: lineup.confirmed ? 'verified' : 'projected',
            key_absences: injured.map(player => player.name).filter(Boolean),
            source_url: 'https://therundown.io',
            last_updated: lineup.last_updated || new Date().toISOString(),
          };

          const { error, data } = await supabase
            .from('starting_lineups')
            .upsert(lineupRecord, { onConflict: 'event_id,team' })
            .select()
            .single();

          if (error) {
            console.error('Error storing lineup:', error);
            continue;
          }

          results.push(data || lineupRecord);
        }
      } catch (error) {
        console.error(`Failed to fetch lineups for event ${eventIdentifier}:`, error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      count: results.length,
      lineups: results,
      source: 'The Rundown API',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error fetching Rundown lineups:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
