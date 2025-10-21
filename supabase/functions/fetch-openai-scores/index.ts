import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScoreData {
  event_id: string;
  sport: string;
  league: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  game_status: string;
  game_date: string;
  last_updated: string;
  advanced_stats?: any;
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

    // Parse request body to get league and query details
    const { league = 'NFL', query = '' } = await req.json().catch(() => ({
      league: 'NFL',
      query: ''
    }));

    const currentDate = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    console.log(`Fetching scores for ${league} via OpenAI...`);

    // Use OpenAI to fetch and analyze live scores with web browsing
    const prompt = `You are a sports data expert with access to real-time sports information.

Today's date is ${currentDate}.

Task: Fetch the latest ${league} scores and game information. Include:
1. All games from today and yesterday
2. Current scores (live or final)
3. Game status (scheduled, in progress, final, etc.)
4. Game start times
5. Advanced statistics if available (team stats, key player performances, etc.)

For each game, structure the response as JSON with this format:
{
  "games": [
    {
      "event_id": "unique_game_id",
      "home_team": "Team Name",
      "away_team": "Team Name",
      "home_score": 0,
      "away_score": 0,
      "game_status": "STATUS_FINAL|STATUS_IN_PROGRESS|STATUS_SCHEDULED",
      "game_date": "ISO 8601 datetime",
      "quarter_or_period": "Q4|3rd Period|9th Inning|etc",
      "time_remaining": "2:45|Final|etc",
      "advanced_stats": {
        "home_total_yards": 0,
        "away_total_yards": 0,
        "home_turnovers": 0,
        "away_turnovers": 0,
        "key_performances": ["Player stats or highlights"]
      }
    }
  ]
}

${query ? `Additional context: ${query}` : ''}

Provide accurate, real-time data. If no games are available, return an empty games array.`;

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
            content: 'You are a sports data API that provides accurate, real-time sports scores and statistics. Always return valid JSON.'
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

    console.log(`OpenAI returned ${parsedData.games?.length || 0} games`);

    // Process and store each game
    const results = [];
    const games = parsedData.games || [];

    for (const game of games) {
      const scoreData: ScoreData = {
        event_id: game.event_id || `${league}-${game.home_team}-${game.away_team}-${new Date().getTime()}`,
        sport: league.toLowerCase().includes('nfl') || league.toLowerCase().includes('football') ? 'football' :
               league.toLowerCase().includes('nba') || league.toLowerCase().includes('basketball') ? 'basketball' :
               league.toLowerCase().includes('mlb') || league.toLowerCase().includes('baseball') ? 'baseball' :
               league.toLowerCase().includes('nhl') || league.toLowerCase().includes('hockey') ? 'hockey' : 'other',
        league: league.toUpperCase(),
        home_team: game.home_team,
        away_team: game.away_team,
        home_score: game.home_score || 0,
        away_score: game.away_score || 0,
        game_status: game.game_status || 'STATUS_SCHEDULED',
        game_date: game.game_date || new Date().toISOString(),
        last_updated: new Date().toISOString(),
        advanced_stats: game.advanced_stats || null,
      };

      // Upsert the score (update if exists, insert if new)
      const { data: upsertData, error } = await supabase
        .from('sports_scores')
        .upsert(scoreData, { onConflict: 'event_id' })
        .select()
        .single();

      if (error) {
        console.error('Error upserting score:', error);
      } else {
        results.push(upsertData);
      }
    }

    console.log(`Successfully processed ${results.length} games via OpenAI`);

    return new Response(
      JSON.stringify({
        success: true,
        count: results.length,
        scores: results,
        source: 'OpenAI',
        raw_response: parsedData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('Error fetching sports scores via OpenAI:', error);
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
