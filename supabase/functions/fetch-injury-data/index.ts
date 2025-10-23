import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { league, team } = await req.json();

    console.log(`[fetch-injury-data] Fetching injury data for league: ${league}, team: ${team || 'all'}`);

    // In production, you would call an injury API like:
    // - ESPN API
    // - RotoWire API
    // - Official league APIs
    // For now, we'll use a simulated approach with OpenAI

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    // Use GPT to fetch/parse injury data
    const prompt = `You are a sports injury data API. Return the current injury report for ${team || 'all teams'} in the ${league} in JSON format.

Return an array of injuries with this exact structure:
[
  {
    "team": "Team Name",
    "player_name": "Player Full Name",
    "position": "Position (e.g. QB, PG, P, C)",
    "injury_status": "Out|Doubtful|Questionable|Probable",
    "injury_type": "Injury description",
    "impact_level": "High|Medium|Low",
    "last_updated": "ISO date string"
  }
]

Only return the JSON array, no other text.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a sports data API that returns JSON.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const injuryDataText = data.choices[0].message.content;

    // Parse JSON from response
    let injuries;
    try {
      injuries = JSON.parse(injuryDataText);
    } catch (parseError) {
      console.error('[fetch-injury-data] Failed to parse OpenAI response:', injuryDataText);
      injuries = [];
    }

    console.log(`[fetch-injury-data] Fetched ${injuries.length} injuries`);

    // Store in database
    const insertPromises = injuries.map((injury: any) => {
      return supabase.from('injury_reports').upsert({
        team: injury.team,
        league: league,
        player_name: injury.player_name,
        position: injury.position,
        injury_status: injury.injury_status,
        injury_type: injury.injury_type,
        impact_level: injury.impact_level || 'Medium',
        report_date: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }, {
        onConflict: 'team,player_name',
        ignoreDuplicates: false
      });
    });

    await Promise.all(insertPromises);

    return new Response(
      JSON.stringify({
        injuries,
        count: injuries.length,
        message: `Fetched and stored ${injuries.length} injury reports`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("fetch-injury-data error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
