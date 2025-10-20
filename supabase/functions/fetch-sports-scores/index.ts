import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ESPNCompetitor {
  team: {
    displayName: string;
  };
  score: string;
  homeAway: string;
}

interface ESPNCompetition {
  id: string;
  date: string;
  status: {
    type: {
      name: string;
    };
  };
  competitors: ESPNCompetitor[];
}

interface ESPNEvent {
  id: string;
  competitions: ESPNCompetition[];
}

interface ESPNResponse {
  events: ESPNEvent[];
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

    // Parse request body to get league (default to NFL)
    const { league = 'nfl' } = await req.json().catch(() => ({ league: 'nfl' }));
    
    // Fetch data from ESPN API
    const espnUrl = `https://site.web.api.espn.com/apis/site/v2/sports/football/${league}/scoreboard`;
    console.log(`Fetching scores from: ${espnUrl}`);
    
    const response = await fetch(espnUrl);
    
    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`);
    }

    const data: ESPNResponse = await response.json();
    const events = data.events || [];
    
    console.log(`Found ${events.length} events`);

    // Process and store each game
    const results = [];
    for (const event of events) {
      const competition = event.competitions[0];
      const homeTeam = competition.competitors.find(c => c.homeAway === 'home');
      const awayTeam = competition.competitors.find(c => c.homeAway === 'away');

      if (!homeTeam || !awayTeam) continue;

      const scoreData = {
        event_id: competition.id,
        sport: 'football',
        league: league.toUpperCase(),
        home_team: homeTeam.team.displayName,
        away_team: awayTeam.team.displayName,
        home_score: parseInt(homeTeam.score) || 0,
        away_score: parseInt(awayTeam.score) || 0,
        game_status: competition.status.type.name,
        game_date: new Date(competition.date).toISOString(),
        last_updated: new Date().toISOString(),
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

    console.log(`Successfully processed ${results.length} games`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        count: results.length,
        scores: results 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error fetching sports scores:', error);
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
