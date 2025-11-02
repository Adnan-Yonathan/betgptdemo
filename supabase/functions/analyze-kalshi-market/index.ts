import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// CONFIGURATION
// ============================================================================

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

// ============================================================================
// AI ANALYSIS
// ============================================================================

async function analyzeMarketWithAI(
  market: any,
  relatedData: any = {}
): Promise<any> {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }

  // Build context for AI
  const context = buildAnalysisContext(market, relatedData);

  const prompt = `Analyze this Kalshi market concisely. Provide ONLY the most critical insights.

MARKET: ${context}

Return JSON with:
{
  "model_probability": <decimal 0-1>,
  "edge": <decimal>,
  "confidence_score": <0-100>,
  "recommendation": "<strong_yes|yes|no|strong_no|hold|avoid>",
  "reasoning": "<2-3 sentences max - only KEY points>",
  "key_factors": ["<top 3 factors only>"],
  "expected_value": <number>,
  "kelly_fraction": <decimal>
}

Focus on: recent performance, key matchup factors, value edge. Be concise and data-driven.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a sports betting analyst. Provide concise, data-driven analysis with ONLY essential information.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    return analysis;

  } catch (error) {
    console.error('[AI ANALYSIS] Error:', error);
    throw error;
  }
}

function buildAnalysisContext(market: any, relatedData: any): string {
  const parts: string[] = [];

  // Market info
  parts.push(`Title: ${market.title}`);
  if (market.subtitle) parts.push(`Subtitle: ${market.subtitle}`);
  parts.push(`Ticker: ${market.ticker}`);
  parts.push(`Sport: ${market.sport_key || 'Unknown'}`);
  parts.push(`Status: ${market.status}`);

  // Pricing
  const yesProbability = market.yes_ask ? (market.yes_ask / 100).toFixed(3) : 'N/A';
  const noProbability = market.no_ask ? (market.no_ask / 100).toFixed(3) : 'N/A';

  parts.push(`\nCURRENT MARKET PRICES:`);
  parts.push(`YES: Bid ${market.yes_bid}¢ / Ask ${market.yes_ask}¢ (Implied prob: ${yesProbability})`);
  parts.push(`NO: Bid ${market.no_bid}¢ / Ask ${market.no_ask}¢ (Implied prob: ${noProbability})`);

  // Market stats
  parts.push(`\nMARKET STATS:`);
  parts.push(`Volume: ${market.volume || 0}`);
  parts.push(`Open Interest: ${market.open_interest || 0}`);
  parts.push(`Liquidity: $${market.liquidity || 0}`);

  // Timing
  const closeTime = new Date(market.close_time);
  const timeUntilClose = closeTime.getTime() - Date.now();
  const hoursUntilClose = Math.floor(timeUntilClose / (1000 * 60 * 60));
  parts.push(`\nTIMING:`);
  parts.push(`Closes: ${closeTime.toISOString()}`);
  parts.push(`Time until close: ${hoursUntilClose} hours`);

  // Related data (team stats, player stats, etc.)
  if (relatedData.teamStats) {
    parts.push(`\nTEAM STATISTICS:`);
    parts.push(JSON.stringify(relatedData.teamStats, null, 2));
  }

  if (relatedData.playerStats) {
    parts.push(`\nPLAYER STATISTICS:`);
    parts.push(JSON.stringify(relatedData.playerStats, null, 2));
  }

  if (relatedData.historicalData) {
    parts.push(`\nHISTORICAL DATA:`);
    parts.push(JSON.stringify(relatedData.historicalData, null, 2));
  }

  if (relatedData.bettingOdds) {
    parts.push(`\nSPORTSBOOK ODDS (for comparison):`);
    parts.push(JSON.stringify(relatedData.bettingOdds, null, 2));
  }

  return parts.join('\n');
}

// ============================================================================
// DATA FETCHING
// ============================================================================

async function fetchRelatedData(supabase: any, market: any): Promise<any> {
  const relatedData: any = {};

  try {
    // Extract team names from market title (basic parsing)
    const teamNames = extractTeamNames(market.title, market.sport_key);

    // Fetch recent team/player stats if applicable
    if (teamNames.length > 0 && market.sport_key === 'NBA') {
      // Fetch recent player stats for teams
      const { data: playerStats } = await supabase
        .from('player_performance_history')
        .select('*')
        .in('team', teamNames)
        .gte('game_date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('game_date', { ascending: false })
        .limit(50);

      if (playerStats && playerStats.length > 0) {
        relatedData.playerStats = playerStats;
      }

      // Fetch betting odds for comparison
      const { data: bettingOdds } = await supabase
        .from('betting_odds')
        .select('*')
        .or(teamNames.map(team => `home_team.ilike.%${team}%,away_team.ilike.%${team}%`).join(','))
        .gte('commence_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('last_updated', { ascending: false })
        .limit(20);

      if (bettingOdds && bettingOdds.length > 0) {
        relatedData.bettingOdds = bettingOdds;
      }
    }

  } catch (error) {
    console.error('[RELATED DATA] Error fetching:', error);
    // Continue without related data
  }

  return relatedData;
}

function extractTeamNames(title: string, sportKey: string): string[] {
  // Simple team name extraction (can be improved with better parsing)
  const commonTeams: Record<string, string[]> = {
    NBA: ['Lakers', 'Celtics', 'Warriors', 'Nets', 'Heat', 'Bucks', 'Mavericks', 'Suns', 'Nuggets', 'Clippers'],
    NFL: ['Chiefs', 'Bills', 'Eagles', 'Cowboys', '49ers', 'Ravens', 'Bengals', 'Dolphins'],
    MLB: ['Yankees', 'Dodgers', 'Red Sox', 'Astros', 'Braves', 'Mets', 'Cubs'],
    NHL: ['Maple Leafs', 'Bruins', 'Rangers', 'Penguins', 'Capitals', 'Lightning'],
  };

  const teams = commonTeams[sportKey] || [];
  return teams.filter(team => title.includes(team));
}

// ============================================================================
// STORE ANALYSIS
// ============================================================================

async function storeAnalysis(supabase: any, marketTicker: string, analysis: any): Promise<void> {
  const analyticsData = {
    market_ticker: marketTicker,
    model_probability: analysis.model_probability,
    market_probability: analysis.market_probability,
    edge: analysis.edge,
    confidence_score: analysis.confidence_score,
    recommendation: analysis.recommendation,
    reasoning: analysis.reasoning,
    key_factors: analysis.key_factors || [],
    kelly_fraction: analysis.kelly_fraction,
    expected_value: analysis.expected_value,
    analyzed_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // Expires in 1 hour
  };

  const { error } = await supabase
    .from('kalshi_market_analytics')
    .upsert(analyticsData, {
      onConflict: 'market_ticker',
    });

  if (error) {
    console.error('[STORE ANALYSIS] Error:', error);
    throw error;
  }

  console.log(`[STORE ANALYSIS] Stored analysis for ${marketTicker}`);
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

    // Parse request
    const { ticker } = await req.json();

    if (!ticker) {
      return new Response(
        JSON.stringify({
          error: 'Market ticker is required',
          success: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    console.log(`[ANALYZE MARKET] Analyzing ${ticker}`);

    // Fetch market from database
    const { data: market, error: marketError } = await supabase
      .from('kalshi_markets')
      .select('*')
      .eq('ticker', ticker)
      .single();

    if (marketError || !market) {
      return new Response(
        JSON.stringify({
          error: 'Market not found',
          success: false,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404,
        }
      );
    }

    // Fetch related data
    const relatedData = await fetchRelatedData(supabase, market);

    // Perform AI analysis
    const analysis = await analyzeMarketWithAI(market, relatedData);

    // Add market probability to analysis
    analysis.market_probability = market.yes_ask ? market.yes_ask / 100 : null;

    // Store analysis in database
    await storeAnalysis(supabase, ticker, analysis);

    // Return response
    return new Response(
      JSON.stringify({
        success: true,
        ticker,
        market: {
          title: market.title,
          yes_ask: market.yes_ask,
          no_ask: market.no_ask,
          volume: market.volume,
        },
        analysis,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('[ANALYZE MARKET] Error:', error);
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
