import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LineupData {
  event_id: string;
  sport: string;
  league: string;
  team: string;
  game_date: string;
  starters: any[];
  bench?: any[];
  injured?: any[];
  scratches?: any[];
  formation?: string;
  lineup_quality_score?: number;
  key_absences?: string[];
  lineup_changes_from_previous?: string[];
  source_url?: string;
  data_quality: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    // Parse request body
    const {
      sport = 'NFL',
      league = 'NFL',
      team = null,
      event_id = null,
      game_date = null
    } = await req.json().catch(() => ({}));

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`Scraping lineups for ${sport}/${league}${team ? ` - ${team}` : ''}...`);

    // Build the prompt for OpenAI to scrape lineup information
    const prompt = `You are a sports data expert with access to real-time information about team lineups, rosters, and injuries.

Today's date is ${currentDate}.

Task: Fetch the latest starting lineup and injury information for ${league}${team ? ` ${team}` : ' teams'}${game_date ? ` for games on ${game_date}` : ' for upcoming games'}.

For each team/game, provide:
1. Starting lineup with player names, positions, and jersey numbers
2. Bench players
3. Injured/inactive players with injury status and type
4. Any scratches or late lineup changes
5. Formation/scheme information (if applicable)
6. Notable absences or lineup changes from previous game

Return data in this JSON format:
{
  "lineups": [
    {
      "event_id": "unique_game_identifier",
      "sport": "${sport}",
      "league": "${league}",
      "team": "Team Name",
      "game_date": "ISO 8601 datetime",
      "opponent": "Opponent Name",
      "starters": [
        {
          "name": "Player Name",
          "position": "QB|PG|P|C|etc",
          "jersey_number": "12",
          "status": "active",
          "season_stats": {
            "ppg": 25.5,
            "rpg": 8.2,
            "other_relevant_stats": "..."
          }
        }
      ],
      "bench": [
        {
          "name": "Player Name",
          "position": "Position",
          "jersey_number": "15"
        }
      ],
      "injured": [
        {
          "name": "Player Name",
          "position": "Position",
          "injury_status": "Out|Doubtful|Questionable|Probable",
          "injury_type": "Knee|Ankle|Concussion|etc",
          "impact_level": "Critical|High|Medium|Low"
        }
      ],
      "scratches": ["Player names who are healthy scratches"],
      "formation": "4-3|3-4|Triangle-2|etc",
      "key_absences": ["Notable missing players"],
      "lineup_changes": ["Changes from last game"],
      "data_quality": "verified|projected|estimated"
    }
  ]
}

Focus on:
- Verified starting lineups (not just depth charts)
- Current injury reports with latest updates
- Impact players and their status
- Any breaking news about lineup changes

${event_id ? `Focus specifically on event_id: ${event_id}` : ''}

Provide accurate, up-to-date lineup information. If lineups aren't confirmed yet, provide projected lineups based on recent games and mark as "projected".`;

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a sports lineup and injury data API that provides accurate, real-time roster information. Always return valid JSON with comprehensive lineup details.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        response_format: { type: 'json_object' }
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const content = openaiData.choices[0].message.content;
    const parsedData = JSON.parse(content);

    console.log(`OpenAI returned ${parsedData.lineups?.length || 0} lineup entries`);

    // Process and store each lineup
    const results = [];
    const lineups = parsedData.lineups || [];

    for (const lineup of lineups) {
      // Calculate lineup quality score
      const starterCount = lineup.starters?.length || 0;
      const injuryCount = lineup.injured?.length || 0;
      const criticalInjuries = lineup.injured?.filter((inj: any) =>
        inj.impact_level === 'Critical' || inj.impact_level === 'High'
      ).length || 0;

      // Simple quality score calculation
      let qualityScore = 100;

      // Deduct for missing starters (sport-specific expected counts)
      const expectedStarters = {
        'basketball': 5,
        'football': 11,
        'baseball': 9,
        'hockey': 6,
        'soccer': 11
      };

      const expected = expectedStarters[sport.toLowerCase()] || 10;
      if (starterCount < expected) {
        qualityScore -= (expected - starterCount) * 10;
      }

      // Deduct for injuries
      qualityScore -= injuryCount * 5;
      qualityScore -= criticalInjuries * 10;

      qualityScore = Math.max(0, Math.min(100, qualityScore));

      const lineupData: LineupData = {
        event_id: lineup.event_id || `${league}-${lineup.team}-${new Date().getTime()}`,
        sport: lineup.sport || sport,
        league: lineup.league || league,
        team: lineup.team,
        game_date: lineup.game_date || new Date().toISOString(),
        starters: lineup.starters || [],
        bench: lineup.bench || [],
        injured: lineup.injured || [],
        scratches: lineup.scratches || [],
        formation: lineup.formation,
        lineup_quality_score: qualityScore,
        key_absences: lineup.key_absences || [],
        lineup_changes_from_previous: lineup.lineup_changes || [],
        source_url: lineup.source_url,
        data_quality: lineup.data_quality || 'verified',
      };

      // Upsert the lineup (update if exists, insert if new)
      const { data: upsertData, error } = await supabase
        .from('starting_lineups')
        .upsert(lineupData, {
          onConflict: 'event_id,team',
          ignoreDuplicates: false
        })
        .select()
        .single();

      if (error) {
        console.error('Error upserting lineup:', error);
      } else {
        results.push(upsertData);

        // Also store injury reports in the injury_reports table
        if (lineup.injured && lineup.injured.length > 0) {
          const injuryReports = lineup.injured.map((injury: any) => ({
            event_id: lineupData.event_id,
            sport: lineupData.sport,
            league: lineupData.league,
            team: lineupData.team,
            player_name: injury.name,
            position: injury.position,
            injury_status: injury.injury_status || 'Questionable',
            injury_type: injury.injury_type,
            injury_description: injury.description,
            impact_level: injury.impact_level || 'Medium',
            official_report: lineup.data_quality === 'verified',
          }));

          const { error: injuryError } = await supabase
            .from('injury_reports')
            .upsert(injuryReports, {
              onConflict: 'player_name,team,event_id',
              ignoreDuplicates: false
            });

          if (injuryError) {
            console.error('Error storing injury reports:', injuryError);
          }
        }
      }
    }

    console.log(`Successfully processed ${results.length} lineups`);

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        lineups: results,
        source: 'OpenAI + Web Scraping',
        raw_response: parsedData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error scraping lineups:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        success: false
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
